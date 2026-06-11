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
    async (req) => {
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

      // Always send the token-based accept link — never pre-create the user.
      //
      // We deliberately do NOT call supabaseAdmin.auth.admin.generateLink({
      // type: "invite" }) anymore: it created a brand-new auth.users row the
      // instant the owner sent the invite (with invited_at set). The invitee
      // then "already existed" and could never sign up ("An account with this
      // email already exists"), and the account showed up in the dashboard
      // before they ever accepted.
      //
      // The invite flow is signup-based instead: the recipient clicks this
      // link → /accept-invite → "Create an account" → signUp() (invited_at
      // stays NULL). public._internal_admin_handle_new_user sees the pending
      // invitation for their email and skips personal-tenant creation; after
      // they confirm + sign in, /accept-invite calls api.invitation_accept to
      // join the workspace. Existing users just sign in and accept. Either way
      // the auth user is created on SIGNUP, not on invite.
      const inviteUrl = `${appUrl}/accept-invite?token=${token}`;

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
