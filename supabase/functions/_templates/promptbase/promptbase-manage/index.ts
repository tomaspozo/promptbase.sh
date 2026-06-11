// promptbase-manage — deployed into the USER's Supabase project by the platform
// install flow. Prompt CRUD over the `promptbase` schema. Called only by the
// platform's prompts-proxy (server-to-server). Action-based POST body
// (proxy-friendly): { action, ... }.
//
// Auth: a dedicated shared secret. The install flow sets PROMPTBASE_SECRET as a
// project function-secret and stores the same value in the platform Vault; the
// proxy sends it in the `x-promptbase-key` header. We verify it manually
// (auth: "none") because @supabase/server's auth: "secret" only matches the
// project's DEFAULT secret key (SUPABASE_SECRET_KEY) — it can't validate a
// custom key. supabaseAdmin still works under auth: "none".
//
// Self-contained: no platform _shared imports, so it's portable into any project.

import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Constant-time string compare to avoid leaking the secret via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorized(req: Request): boolean {
  const expected = Deno.env.get("PROMPTBASE_SECRET");
  const provided = req.headers.get("x-promptbase-key");
  return !!expected && !!provided && timingSafeEqual(provided, expected);
}

interface ManageBody {
  action:
    | "list"
    | "get"
    | "create"
    | "save_draft"
    | "publish"
    | "unpublish"
    | "delete"
    | "upsert_published";
  prompt_id?: string;
  slug?: string;
  name?: string;
  description?: string;
  system?: string;
  user_template?: string | null;
  variables?: unknown;
  created_by?: string | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  fetch: withSupabase(
    { auth: "none", supabaseOptions: { db: { schema: "promptbase" } } },
    async (req: Request, { supabaseAdmin }: { supabaseAdmin: SupabaseClient }) => {
      if (req.method !== "POST") return json({ error: "POST only" }, 405);
      if (!authorized(req)) return json({ error: "Invalid credentials" }, 401);

      const body = (await req.json()) as ManageBody;
      const db = supabaseAdmin.schema("promptbase");

      // Draft fields for the prompts row (a single mutable working copy).
      const draftCols = () => ({
        draft_system: body.system,
        draft_user_template: body.user_template ?? null,
        draft_variables: body.variables ?? [],
        draft_updated_at: new Date().toISOString(),
        draft_updated_by: body.created_by ?? null,
        updated_at: new Date().toISOString(),
      });

      switch (body.action) {
        case "list": {
          // Prompts with their published version (if any).
          const { data: prompts, error } = await db
            .from("prompts")
            .select(
              "id, slug, name, description, created_at, updated_at, draft_updated_at",
            )
            .order("updated_at", { ascending: false });
          if (error) return json({ error: error.message }, 400);

          const { data: published } = await db
            .from("prompt_versions")
            .select("prompt_id, id, published_at")
            .eq("is_published", true);
          const pubByPrompt = new Map(
            (published ?? []).map((v) => [v.prompt_id, v]),
          );
          return json({
            prompts: (prompts ?? []).map((p) => ({
              ...p,
              published_version: pubByPrompt.get(p.id) ?? null,
            })),
          });
        }

        case "get": {
          if (!body.prompt_id) return json({ error: "prompt_id required" }, 400);
          // The prompt row carries the draft (working copy) in its draft_* cols.
          const { data: prompt, error } = await db
            .from("prompts")
            .select("*")
            .eq("id", body.prompt_id)
            .single();
          if (error || !prompt) return json({ error: "not found" }, 404);
          // Versions are immutable publish snapshots, newest first.
          const { data: versions } = await db
            .from("prompt_versions")
            .select("*")
            .eq("prompt_id", body.prompt_id)
            .order("created_at", { ascending: false });
          return json({ prompt, versions: versions ?? [] });
        }

        case "create": {
          if (!body.slug || !body.name)
            return json({ error: "slug and name required" }, 400);
          // Seed the draft on create if content was supplied.
          const seedDraft = typeof body.system === "string";
          const { data, error } = await db
            .from("prompts")
            .insert({
              slug: body.slug,
              name: body.name,
              description: body.description ?? null,
              ...(seedDraft ? draftCols() : {}),
            })
            .select()
            .single();
          if (error) return json({ error: error.message }, 400);
          return json({ prompt: data }, 201);
        }

        case "save_draft": {
          // Overwrite the single working copy — never creates a version.
          if (!body.prompt_id || typeof body.system !== "string")
            return json({ error: "prompt_id and system required" }, 400);
          const { data, error } = await db
            .from("prompts")
            .update(draftCols())
            .eq("id", body.prompt_id)
            .select()
            .single();
          if (error) return json({ error: error.message }, 400);
          return json({ prompt: data });
        }

        case "publish": {
          // Snapshot the supplied content into a new immutable published
          // version, then sync the draft to match what's now live.
          if (!body.prompt_id || typeof body.system !== "string")
            return json({ error: "prompt_id and system required" }, 400);
          const now = new Date().toISOString();
          await db
            .from("prompt_versions")
            .update({ is_published: false, published_at: null })
            .eq("prompt_id", body.prompt_id)
            .eq("is_published", true);
          const { data: version, error } = await db
            .from("prompt_versions")
            .insert({
              prompt_id: body.prompt_id,
              system: body.system,
              user_template: body.user_template ?? null,
              variables: body.variables ?? [],
              is_published: true,
              published_at: now,
              created_by: body.created_by ?? null,
            })
            .select()
            .single();
          if (error) return json({ error: error.message }, 400);
          await db.from("prompts").update(draftCols()).eq("id", body.prompt_id);
          return json({ version });
        }

        case "unpublish": {
          if (!body.prompt_id) return json({ error: "prompt_id required" }, 400);
          const { error } = await db
            .from("prompt_versions")
            .update({ is_published: false, published_at: null })
            .eq("prompt_id", body.prompt_id)
            .eq("is_published", true);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        case "delete": {
          if (!body.prompt_id) return json({ error: "prompt_id required" }, 400);
          const { error } = await db
            .from("prompts")
            .delete()
            .eq("id", body.prompt_id);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        // Promote target: find-or-create the prompt by slug, snapshot a new
        // published version, and sync the target's draft to it — in one call.
        case "upsert_published": {
          if (!body.slug || !body.name || typeof body.system !== "string")
            return json({ error: "slug, name and system required" }, 400);
          const now = new Date().toISOString();

          const { data: found } = await db
            .from("prompts")
            .select("id")
            .eq("slug", body.slug)
            .maybeSingle();

          let promptId = found?.id as string | undefined;
          if (!promptId) {
            const { data: created, error: cErr } = await db
              .from("prompts")
              .insert({
                slug: body.slug,
                name: body.name,
                description: body.description ?? null,
                ...draftCols(),
              })
              .select("id")
              .single();
            if (cErr) return json({ error: cErr.message }, 400);
            promptId = created.id;
          } else {
            await db.from("prompts").update(draftCols()).eq("id", promptId);
          }

          await db
            .from("prompt_versions")
            .update({ is_published: false, published_at: null })
            .eq("prompt_id", promptId)
            .eq("is_published", true);
          const { data: ver, error: vErr } = await db
            .from("prompt_versions")
            .insert({
              prompt_id: promptId,
              system: body.system,
              user_template: body.user_template ?? null,
              variables: body.variables ?? [],
              is_published: true,
              published_at: now,
              created_by: body.created_by ?? null,
            })
            .select("id")
            .single();
          if (vErr) return json({ error: vErr.message }, 400);

          return json({ ok: true, prompt_id: promptId, version_id: ver.id });
        }

        default:
          return json({ error: "unknown action" }, 400);
      }
    },
  ),
};
