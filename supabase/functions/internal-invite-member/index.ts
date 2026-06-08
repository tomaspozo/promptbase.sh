// @agentlink internal-invite-member
// @type edge_function
// @summary Sends branded team invitation emails via Resend + React Email
// @description Called by internal-queue-worker when api.invitation_create (via
//   public._internal_admin_create_invitation) enqueues an internal-invite-member task.
//   For new users, creates an Auth account via generateLink({ type: 'invite' }) — this sets
//   invited_at on auth.users so _internal_admin_handle_new_user skips default tenant creation.
//   For existing users, sends a direct link. Uses withSupabase({ auth: 'secret' }) since
//   only internal-queue-worker/service_role invokes it.
//   Naming convention: `internal-` prefix marks system-only edge functions never
//   called from client code.
// @related api.invitation_create, api.invitation_accept, internal-queue-worker

import * as React from "npm:react@18.3.1";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { withSupabase } from "@supabase/server";
import { TeamInviteEmail } from "./_templates/team-invite.tsx";

interface InvitePayload {
  email: string;
  token: string;
  tenant_name: string;
}

export default {
  fetch: withSupabase(
    { auth: "secret", supabaseOptions: { db: { schema: "api" } } },
    async (req, { supabaseAdmin }) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const { email, token, tenant_name } = (await req.json()) as InvitePayload;
      const appUrl = (
        Deno.env.get("APP_URL") ?? "http://localhost:5173"
      ).replace(/\/+$/, "");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const appName = Deno.env.get("APP_NAME") ?? "App";
      const fromEmail =
        Deno.env.get("RESEND_FROM_EMAIL") ?? `${appName} <noreply@example.com>`;

      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }

      const resend = new Resend(resendApiKey);
      const directUrl = `${appUrl}/accept-invite?token=${token}`;

      let inviteUrl: string;

      // Try to create user via Auth admin API (for new users).
      // generateLink sets invited_at on auth.users, which prevents
      // _internal_admin_handle_new_user from creating a default tenant.
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo: directUrl,
          },
        });

      if (!linkError && linkData?.properties?.action_link) {
        // New user — use the Auth verification link (creates session on click)
        inviteUrl = linkData.properties.action_link;
      } else {
        // Existing user — use direct link (they'll log in if needed)
        inviteUrl = directUrl;
      }

      // Render and send the branded email
      const element = React.createElement(TeamInviteEmail, {
        inviteUrl,
        tenantName: tenant_name,
        appName,
      });

      const [html, text] = await Promise.all([
        renderAsync(element),
        renderAsync(element, { plainText: true }),
      ]);

      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject: `You've been invited to join ${tenant_name}`,
        html,
        text,
      });

      if (sendError) {
        console.error("Failed to send invite email:", sendError);
        throw sendError;
      }

      return new Response("OK", { status: 200 });
    },
  ),
};
