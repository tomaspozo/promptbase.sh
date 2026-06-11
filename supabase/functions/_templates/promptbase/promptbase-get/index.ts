// promptbase-get — deployed into the USER's Supabase project. Runtime read for
// developer apps (and the platform's preview/promote): given ?slug=, returns the
// published version's { system, user, variables }.
//
// Auth: the dedicated PROMPTBASE_SECRET shared secret, sent in the
// `x-promptbase-key` header and verified manually (auth: "none").

import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Constant-time string compare to avoid leaking the secret via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorized(req: Request): boolean {
  const expected = Deno.env.get("PROMPTBASE_SECRET");
  const provided = req.headers.get("x-promptbase-key");
  return !!expected && !!provided && timingSafeEqual(provided, expected);
}

export default {
  fetch: withSupabase(
    { auth: "none", supabaseOptions: { db: { schema: "promptbase" } } },
    async (
      req: Request,
      { supabaseAdmin }: { supabaseAdmin: SupabaseClient },
    ) => {
      if (!authorized(req)) return json({ error: "Invalid credentials" }, 401);
      const slug = new URL(req.url).searchParams.get("slug");
      if (!slug) return json({ error: "slug required" }, 400);

      const { data, error } = await supabaseAdmin
        .schema("promptbase")
        .from("prompt_versions")
        .select("system, user_template, variables, prompts!inner(slug)")
        .eq("is_published", true)
        .eq("prompts.slug", slug)
        .single();

      if (error || !data) return json({ error: "not found" }, 404);

      return json({
        system: data.system,
        user: data.user_template,
        variables: data.variables,
      });
    },
  ),
};
