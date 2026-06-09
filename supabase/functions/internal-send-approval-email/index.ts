// Sends the branded "early access approved" email via Resend + React Email.
//
// Invoked by internal-queue-worker when public._waitlist_on_approved (the
// trigger on profiles.allowed false -> true) enqueues an
// internal-send-approval-email task. Uses withSupabase({ auth: 'secret' })
// since only internal-queue-worker / service_role invokes it.
// Naming convention: `internal-` prefix marks system-only edge functions.

import * as React from "npm:react@18.3.1";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { withSupabase } from "@supabase/server";
import { ApprovalEmail } from "./_templates/approval.tsx";

interface ApprovalPayload {
  email: string;
  display_name?: string | null;
}

export default {
  fetch: withSupabase(
    { auth: "secret", supabaseOptions: { db: { schema: "api" } } },
    async (req) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const { email, display_name } = (await req.json()) as ApprovalPayload;
      const appUrl = (
        Deno.env.get("APP_URL") ?? "http://localhost:3000"
      ).replace(/\/+$/, "");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const appName = Deno.env.get("APP_NAME") ?? "App";
      const fromEmail =
        Deno.env.get("RESEND_FROM_EMAIL") ?? `${appName} <noreply@example.com>`;

      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }

      const resend = new Resend(resendApiKey);
      // Land on /pending — it refreshes the session and auto-forwards to the
      // dashboard now that profiles.allowed = true.
      const signInUrl = `${appUrl}/pending`;

      const element = React.createElement(ApprovalEmail, {
        signInUrl,
        displayName: display_name ?? null,
        appName,
      });

      const [html, text] = await Promise.all([
        renderAsync(element),
        renderAsync(element, { plainText: true }),
      ]);

      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject: `You're in — your ${appName} access is approved`,
        html,
        text,
      });

      if (sendError) {
        console.error("Failed to send approval email:", sendError);
        throw sendError;
      }

      return new Response("OK", { status: 200 });
    },
  ),
};
