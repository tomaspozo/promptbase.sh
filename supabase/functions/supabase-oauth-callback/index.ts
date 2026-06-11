// Platform OAuth callback. The browser sends the authorization `code` (after the
// user consents on Supabase) plus the tenant to link. We exchange the code for
// tokens (confidential client — client_secret stays here), read which Supabase
// org the token grants, and persist everything via the _admin_organization_connect
// RPC (membership check + uniqueness + Vault + tenant link).
//
// auth: 'user' — invoked by the logged-in user's browser via functions.invoke.

import { withSupabase } from "@supabase/server";
import { jsonResponse, errorResponse } from "../_shared/responses.ts";

const SUPA_API = "https://api.supabase.com";

interface CallbackBody {
  code?: string;
  redirect_uri?: string;
  tenant_id?: string;
}

export default {
  fetch: withSupabase(
    { auth: "user", supabaseOptions: { db: { schema: "api" } } },
    async (req, ctx) => {
      if (req.method !== "POST") return errorResponse("POST only", 405);

      const { code, redirect_uri, tenant_id } =
        (await req.json()) as CallbackBody;
      if (!code || !redirect_uri || !tenant_id) {
        return errorResponse("code, redirect_uri and tenant_id are required", 400);
      }

      const clientId = Deno.env.get("SB_OAUTH_CLIENT_ID");
      const clientSecret = Deno.env.get("SB_OAUTH_SECRET");
      if (!clientId || !clientSecret) {
        return errorResponse("OAuth is not configured on the server", 500);
      }

      const {
        data: { user },
        error: userErr,
      } = await ctx.supabase.auth.getUser();
      if (userErr || !user) return errorResponse("Not authenticated", 401);

      // 1. Exchange the authorization code for tokens (Basic auth, form body).
      const tokenRes = await fetch(`${SUPA_API}/v1/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri,
        }),
      });
      if (!tokenRes.ok) {
        return errorResponse(`Token exchange failed: ${await tokenRes.text()}`, 400);
      }
      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
      };

      // 2. Which org does this token grant access to?
      const orgRes = await fetch(`${SUPA_API}/v1/organizations`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!orgRes.ok) {
        return errorResponse(`Failed to read organizations: ${await orgRes.text()}`, 400);
      }
      const orgs = (await orgRes.json()) as Array<{ id: string; name?: string }>;
      const org = Array.isArray(orgs) ? orgs[0] : null;
      if (!org) return errorResponse("No organization available on this token", 400);

      // 3. Persist: membership check + uniqueness + Vault + tenant link, atomically.
      // rpc cast: supabaseAdmin has no Database generic here, so the arg type
      // can't be inferred — validated by the RPC signature at runtime.
      const rpc = ctx.supabaseAdmin.rpc.bind(ctx.supabaseAdmin) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc(
        "_admin_organization_connect",
        {
          p_user_id: user.id,
          p_tenant_id: tenant_id,
          p_supabase_org_id: org.id,
          p_supabase_org_name: org.name ?? null,
          p_access_token: tokens.access_token,
          p_refresh_token: tokens.refresh_token ?? null,
        },
      );
      if (error) return errorResponse(error.message, 400);

      return jsonResponse({ organization: data });
    },
  ),
};
