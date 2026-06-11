// Forwards prompt CRUD from the browser to an environment's promptbase-manage
// function. The browser can't call that function directly (it would need the
// project's secret key) — so this proxy: verifies the user is a member of the
// env's tenant, reads the env secret from Vault (via _admin_environment_proxy),
// and forwards the { action, ... } body, returning the function's JSON.
//
// auth: 'user' — invoked by the logged-in user's browser via functions.invoke.

import { withSupabase } from "@supabase/server";
import { jsonResponse, errorResponse } from "../_shared/responses.ts";

interface ProxyBody {
  env_id?: string;
  action?: string;
  [k: string]: unknown;
}

export default {
  fetch: withSupabase(
    { auth: "user", supabaseOptions: { db: { schema: "api" } } },
    async (req, ctx) => {
      if (req.method !== "POST") return errorResponse("POST only", 405);

      // If you see this line in the logs, the proxy's own auth: 'user' PASSED —
      // so any 401 is coming from the upstream promptbase-manage call, not here.
      console.log("[prompts-proxy] handler entered (user auth ok)");

      const { env_id, ...managePayload } = (await req.json()) as ProxyBody;
      if (!env_id || !managePayload.action) {
        return errorResponse("env_id and action are required", 400);
      }

      const {
        data: { user },
        error: userErr,
      } = await ctx.supabase.auth.getUser();
      if (userErr || !user) return errorResponse("Not authenticated", 401);
      console.log(`[prompts-proxy] user=${user.id} env=${env_id} action=${managePayload.action}`);

      // rpc cast: supabaseAdmin has no Database generic here.
      const rpc = ctx.supabaseAdmin.rpc.bind(ctx.supabaseAdmin) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const conn = await rpc("_admin_environment_proxy", {
        p_user_id: user.id,
        p_env_id: env_id,
      });
      if (conn.error || !conn.data) {
        return errorResponse(conn.error?.message ?? "Environment not found", 400);
      }
      const { url, secret } = conn.data as { url: string; secret: string };

      // Stamp the caller as the author. The deployed prompt store lives in the
      // user's own project and can't see platform display names, so denormalize
      // the caller's name/email here and forward it as created_by.
      const userRpc = ctx.supabase.rpc.bind(ctx.supabase) as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown }>;
      const { data: profile } = await userRpc("profile_get");
      const p = profile as {
        display_name?: string | null;
        email?: string | null;
      } | null;
      const actor = p?.display_name || p?.email || null;

      const res = await fetch(`${url}/functions/v1/promptbase-manage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The deployed function verifies this dedicated secret manually.
          "x-promptbase-key": secret,
          // Present so the platform gateway routes the call (value unused —
          // the function is deployed with verify_jwt = false).
          apikey: secret,
        },
        body: JSON.stringify({ ...managePayload, created_by: actor }),
      });

      const text = await res.text();
      // Upstream status disambiguates: a 401 here is from the deployed
      // promptbase-manage (auth check), NOT from this proxy.
      console.log(
        `[prompts-proxy] upstream ${url}/functions/v1/promptbase-manage -> ${res.status} ${text.slice(0, 200)}`,
      );
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text || "Upstream returned no body" };
      }
      return jsonResponse(payload, res.status);
    },
  ),
};
