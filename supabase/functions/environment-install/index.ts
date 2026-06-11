// One-click install: deploys promptbase into a user's Supabase project via the
// Management API (using the org's OAuth token), then records the environment.
//
//   1. run the promptbase migration (creates the promptbase schema + tables)
//   2. deploy promptbase-get + promptbase-manage edge functions
//   3. read the project's secret API key (the proxy uses it to call the functions)
//   4. store the secret in Vault + upsert the environments row (installed = true)
//
// auth: 'user' — invoked by the logged-in user's browser via functions.invoke.

import { withSupabase } from "@supabase/server";
import { jsonResponse, errorResponse } from "../_shared/responses.ts";
import {
  PROMPTBASE_GET_SRC,
  PROMPTBASE_MANAGE_SRC,
  PROMPTBASE_DENO_JSON,
  PROMPTBASE_MIGRATION_SQL,
  PROMPTBASE_VERSION,
} from "../_shared/promptbase-templates.ts";

const SUPA_API = "https://api.supabase.com";

interface InstallBody {
  tenant_id?: string;
  project_ref?: string;
  name?: string;
}

async function deployFunction(
  ref: string,
  token: string,
  slug: string,
  source: string,
): Promise<string | null> {
  const fd = new FormData();
  fd.append(
    "metadata",
    JSON.stringify({
      entrypoint_path: "index.ts",
      import_map_path: "deno.json",
      verify_jwt: false,
      name: slug,
    }),
  );
  fd.append(
    "file",
    new File([source], "index.ts", { type: "application/typescript" }),
  );
  fd.append(
    "file",
    new File([PROMPTBASE_DENO_JSON], "deno.json", { type: "application/json" }),
  );

  const res = await fetch(
    `${SUPA_API}/v1/projects/${ref}/functions/deploy?slug=${slug}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd },
  );
  if (!res.ok)
    return `Deploy ${slug} failed (${res.status}): ${await res.text()}`;
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Round-trips the deployed functions to prove the install works: publish a
// throwaway prompt via promptbase-manage, read it back via promptbase-get, then
// delete it. Returns an error string on failure, or null on success.
async function verifyInstall(
  projectUrl: string,
  secret: string,
): Promise<string | null> {
  const manageUrl = `${projectUrl}/functions/v1/promptbase-manage`;
  const headers = {
    "Content-Type": "application/json",
    "x-promptbase-key": secret,
    apikey: secret,
  };
  const slug = `promptbase-healthcheck-${crypto.randomUUID().slice(0, 8)}`;

  // A freshly-deployed function isn't invocable instantly — retry the first call.
  let promptId: string | undefined;
  let lastErr = "no response";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(1500);
    try {
      const r = await fetch(manageUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "upsert_published",
          slug,
          name: "promptbase health check",
          system: "ok",
        }),
      });
      if (r.ok) {
        promptId = ((await r.json()) as { prompt_id?: string }).prompt_id;
        break;
      }
      lastErr = `${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!promptId) {
    return `Install verification failed — promptbase-manage didn't respond: ${lastErr}`;
  }

  // Read it back through the runtime function.
  let getOk = false;
  try {
    const getRes = await fetch(
      `${projectUrl}/functions/v1/promptbase-get?slug=${slug}`,
      { headers },
    );
    getOk =
      getRes.ok &&
      ((await getRes.json()) as { system?: string }).system === "ok";
  } catch {
    getOk = false;
  }

  // Always clean up the throwaway prompt.
  await fetch(manageUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "delete", prompt_id: promptId }),
  }).catch(() => {});

  if (!getOk) {
    return "Install verification failed — promptbase-get didn't return the test prompt. The schema may not be exposed yet; try again in a moment.";
  }
  return null;
}

export default {
  fetch: withSupabase(
    { auth: "user", supabaseOptions: { db: { schema: "api" } } },
    async (req, ctx) => {
      if (req.method !== "POST") return errorResponse("POST only", 405);

      const { tenant_id, project_ref, name } =
        (await req.json()) as InstallBody;
      if (!tenant_id || !project_ref || !name) {
        return errorResponse(
          "tenant_id, project_ref and name are required",
          400,
        );
      }

      const {
        data: { user },
        error: userErr,
      } = await ctx.supabase.auth.getUser();
      if (userErr || !user) return errorResponse("Not authenticated", 401);

      // rpc cast: supabaseAdmin has no Database generic here.
      const rpc = ctx.supabaseAdmin.rpc.bind(ctx.supabaseAdmin) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      // Org OAuth token (also verifies owner/admin + that the tenant is linked).
      const tok = await rpc("_admin_tenant_org_token", {
        p_user_id: user.id,
        p_tenant_id: tenant_id,
      });
      if (tok.error || !tok.data) {
        return errorResponse(
          tok.error?.message ?? "No connected organization",
          400,
        );
      }
      const token = tok.data as string;
      const projectUrl = `https://${project_ref}.supabase.co`;

      // 1. Migration.
      const migRes = await fetch(
        `${SUPA_API}/v1/projects/${project_ref}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: PROMPTBASE_MIGRATION_SQL }),
        },
      );
      if (!migRes.ok) {
        return errorResponse(
          `Migration failed (${migRes.status}): ${await migRes.text()}`,
          400,
        );
      }

      // 1b. Expose the promptbase schema to PostgREST so the deployed functions
      // can read it (the Data API only serves schemas in its exposed list).
      const cfgRes = await fetch(
        `${SUPA_API}/v1/projects/${project_ref}/postgrest`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!cfgRes.ok) {
        return errorResponse(
          `Failed to read the project's API config (${cfgRes.status}). Your Supabase OAuth token may be missing the project-config scope — update the OAuth app's scopes and RECONNECT your organization (the existing token keeps its old scopes). ${await cfgRes.text()}`,
          400,
        );
      }
      const cfg = (await cfgRes.json()) as {
        db_schema?: string;
        db_extra_search_path?: string;
      };
      const schemas = (cfg.db_schema ?? "public, graphql_public")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!schemas.includes("promptbase")) {
        schemas.push("promptbase");
        const searchPath = (cfg.db_extra_search_path ?? "public, extensions")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!searchPath.includes("promptbase")) searchPath.push("promptbase");
        const patchRes = await fetch(
          `${SUPA_API}/v1/projects/${project_ref}/postgrest`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              db_schema: schemas.join(", "),
              db_extra_search_path: searchPath.join(", "),
            }),
          },
        );
        if (!patchRes.ok) {
          return errorResponse(
            `Failed to expose the promptbase schema (${patchRes.status}): ${await patchRes.text()}`,
            400,
          );
        }
      }

      // 2. A dedicated shared secret for the deployed functions.
      //
      // The deployed promptbase-* functions verify a custom secret manually (in
      // the `x-promptbase-key` header) rather than via @supabase/server's
      // auth: 'secret' — that mode only matches the project's DEFAULT secret key
      // (SUPABASE_SECRET_KEY in the function env), so a custom project API key
      // would never validate. Instead we generate a random secret, set it as the
      // project function-secret PROMPTBASE_SECRET, and store the same value in
      // our Vault. This way the platform never holds the project's master key.
      //
      // Set BEFORE deploy so the functions have it from their first invocation.
      // A fresh secret is generated on every (re)install — it rotates the value
      // in both places at once, so they always stay in sync.
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const secret =
        "pbk_" +
        Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

      const secretRes = await fetch(
        `${SUPA_API}/v1/projects/${project_ref}/secrets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([{ name: "PROMPTBASE_SECRET", value: secret }]),
        },
      );
      if (!secretRes.ok) {
        return errorResponse(
          `Failed to set the PROMPTBASE_SECRET function secret (${secretRes.status}): ${await secretRes.text()}`,
          400,
        );
      }

      // 3. Deploy both functions.
      const e1 = await deployFunction(
        project_ref,
        token,
        "promptbase-get",
        PROMPTBASE_GET_SRC,
      );
      if (e1) return errorResponse(e1, 400);
      const e2 = await deployFunction(
        project_ref,
        token,
        "promptbase-manage",
        PROMPTBASE_MANAGE_SRC,
      );
      if (e2) return errorResponse(e2, 400);

      // 3b. Verify the install end-to-end before recording it: publish a
      // throwaway prompt via promptbase-manage, read it back via promptbase-get,
      // then delete it. Retries because a freshly-deployed function takes a
      // moment to become invocable.
      const verifyErr = await verifyInstall(projectUrl, secret);
      if (verifyErr) return errorResponse(verifyErr, 400);

      // 4. Persist env + secret + version (only after verification passed).
      const env = await rpc("_admin_environment_create", {
        p_user_id: user.id,
        p_tenant_id: tenant_id,
        p_name: name,
        p_project_ref: project_ref,
        p_url: projectUrl,
        p_secret: secret,
        p_version: PROMPTBASE_VERSION,
      });
      if (env.error) return errorResponse(env.error.message, 400);

      return jsonResponse({ environment: env.data });
    },
  ),
};
