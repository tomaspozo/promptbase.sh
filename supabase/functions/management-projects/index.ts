// Lists the Supabase projects in a connected org, for the add-environment
// dropdown. Reads the org's OAuth access token from Vault (via the admin RPC,
// which checks ownership) and calls the Management API.
//
// auth: 'user' — invoked by the logged-in user's browser via functions.invoke.

import { withSupabase } from "@supabase/server";
import { jsonResponse, errorResponse } from "../_shared/responses.ts";

const SUPA_API = "https://api.supabase.com";

interface Body {
  org_id?: string;
}

export default {
  fetch: withSupabase(
    { auth: "user", supabaseOptions: { db: { schema: "api" } } },
    async (req, ctx) => {
      if (req.method !== "POST") return errorResponse("POST only", 405);

      const { org_id } = (await req.json()) as Body;
      if (!org_id) return errorResponse("org_id required", 400);

      const {
        data: { user },
        error: userErr,
      } = await ctx.supabase.auth.getUser();
      if (userErr || !user) return errorResponse("Not authenticated", 401);

      // rpc cast: supabaseAdmin has no Database generic here (args validated by
      // the RPC signature at runtime).
      const rpc = ctx.supabaseAdmin.rpc.bind(ctx.supabaseAdmin) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>;
      const { data: token, error } = await rpc("_admin_organization_token", {
        p_user_id: user.id,
        p_org_id: org_id,
      });
      if (error || !token) {
        return errorResponse(error?.message ?? "Organization token not found", 400);
      }

      const res = await fetch(`${SUPA_API}/v1/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return errorResponse(`Failed to list projects: ${await res.text()}`, 400);
      }
      const projects = (await res.json()) as Array<{
        id: string;
        name: string;
        region: string;
        organization_id: string;
      }>;

      return jsonResponse({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          region: p.region,
        })),
      });
    },
  ),
};
