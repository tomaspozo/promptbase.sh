/**
 * internal-send-auth-email — handles all Supabase Auth emails via Resend + React Email
 *
 * Called exclusively by internal-queue-worker (via _hook_send_email →
 * api._admin_enqueue_task → pg_net → internal-queue-worker → here).
 * Uses withSupabase({ auth: 'secret' }) — only internal-queue-worker/service_role
 * invokes it.
 *
 * Naming convention: `internal-` prefix marks system-only edge functions wired
 * to a specific upstream payload shape (here: GoTrue's auth-hook payload). Do
 * NOT use this for general-purpose application emails — when the generic
 * `internal-send-email` ships, use that with `{ to, template, data }` instead.
 */

import * as React from "npm:react@18.3.1";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { withSupabase } from "@supabase/server";
import { ConfirmationEmail } from "./_templates/confirmation.tsx";
import { MagicLinkEmail } from "./_templates/magic-link.tsx";
import { RecoveryEmail } from "./_templates/recovery.tsx";
import { InviteEmail } from "./_templates/invite.tsx";
import { EmailChangeEmail } from "./_templates/email-change.tsx";

interface AuthHookUser {
  id: string;
  email?: string;
  email_new?: string;
  [key: string]: unknown;
}

interface AuthHookEmailData {
  token: string;
  token_hash: string;
  redirect_to?: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
  [key: string]: unknown;
}

interface AuthHookPayload {
  user: AuthHookUser;
  email_data: AuthHookEmailData;
}

const SUBJECTS: Record<string, string> = {
  signup: "Confirm your email",
  magiclink: "Your login link",
  recovery: "Reset your password",
  invite: "You've been invited",
  email_change: "Confirm your email change",
};

/**
 * Post-verification redirect URL per email type.
 *
 * After the user clicks the verification link, Supabase Auth verifies
 * the token and redirects to this URL with `?code=<auth_code>` (PKCE).
 *
 * Every resulting URL must be in Auth's allowed redirect list:
 *   Local  → config.toml [auth] additional_redirect_urls
 *   Cloud  → Dashboard → Auth → URL Configuration
 *   Tip: use wildcards, e.g. http://localhost:5173/**
 *
 * The defaults below match the canonical auth flow shipped by the scaffold:
 *   - signup / magiclink / recovery / email_change → /auth/confirm
 *     (single PKCE callback that exchanges the code, branches on type, and
 *      navigates: signup/magiclink → /dashboard, recovery → /auth/update-password)
 *   - invite → /accept-invite (handles workspace-invitation acceptance,
 *     receives both ?code and ?token in the URL)
 *
 * Customize the paths if your app's routes differ; remove an entry to fall
 * back to the bare APP_URL.
 */
const REDIRECT_PATHS: Record<string, string> = {
  signup: "/auth/confirm",
  magiclink: "/auth/confirm",
  recovery: "/auth/confirm",
  email_change: "/auth/confirm",
  invite: "/accept-invite",
};

function getRedirectUrl(appUrl: string, type: string): string {
  const base = appUrl.replace(/\/+$/, "");
  const path = REDIRECT_PATHS[type] ?? "";
  // For the PKCE callback (/auth/confirm), embed ?type= in redirect_to so the
  // route can branch (recovery → /update-password, email_change → success,
  // signup/magiclink → /dashboard). Supabase's /auth/v1/verify drops the
  // verify URL's `?type=` param when redirecting and only appends `&code=…`
  // to whatever redirect_to we provide — existing query params are preserved,
  // so this is how we plumb the email_action_type through to the SPA.
  if (path === "/auth/confirm") {
    return `${base}${path}?type=${encodeURIComponent(type)}`;
  }
  return `${base}${path}`;
}

function buildVerificationUrl(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string,
): string {
  const base = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: tokenHash,
    type: emailActionType,
    ...(redirectTo ? { redirect_to: redirectTo } : {}),
  });
  return `${base}?${params.toString()}`;
}

export default {
  fetch: withSupabase(
    { auth: "secret", supabaseOptions: { db: { schema: "api" } } },
    async (req, _ctx) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const { user, email_data } = (await req.json()) as AuthHookPayload;
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const appName = Deno.env.get("APP_NAME") ?? "App";
      const fromEmail =
        Deno.env.get("RESEND_FROM_EMAIL") ?? `${appName} <noreply@example.com>`;

      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }

      const resend = new Resend(resendApiKey);
      const emailActionType = email_data.email_action_type ?? "signup";
      const appUrl = Deno.env.get("APP_URL") ?? email_data.site_url ?? "";
      const redirectTo = getRedirectUrl(appUrl, emailActionType);

      const sendOne = async (
        to: string,
        subject: string,
        element: React.ReactElement,
      ): Promise<{ error: unknown } | null> => {
        const [html, text] = await Promise.all([
          renderAsync(element),
          renderAsync(element, { plainText: true }),
        ]);
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: [to],
          subject,
          html,
          text,
        });
        return error ? { error } : null;
      };

      // Dual email-change: send to both current and new email
      if (
        emailActionType === "email_change" &&
        email_data.token_hash_new &&
        email_data.token_new &&
        user.email_new
      ) {
        const currentUrl = buildVerificationUrl(
          supabaseUrl,
          email_data.token_hash_new,
          emailActionType,
          redirectTo,
        );
        const newUrl = buildVerificationUrl(
          supabaseUrl,
          email_data.token_hash,
          emailActionType,
          redirectTo,
        );

        const currentElement = React.createElement(EmailChangeEmail, {
          verificationUrl: currentUrl,
          token: email_data.token,
          isNewEmail: false,
        });
        const newElement = React.createElement(EmailChangeEmail, {
          verificationUrl: newUrl,
          token: email_data.token_new,
          isNewEmail: true,
        });

        const subject = SUBJECTS.email_change;
        const err1 = await sendOne(user.email!, subject, currentElement);
        if (err1) throw err1.error;
        const err2 = await sendOne(user.email_new, subject, newElement);
        if (err2) throw err2.error;
        return new Response("OK", { status: 200 });
      }

      // Standard single-email flow
      const tokenHash = email_data.token_hash;
      const token =
        emailActionType === "email_change" && user.email_new
          ? (email_data.token_new ?? email_data.token)
          : email_data.token;
      const verificationUrl = buildVerificationUrl(
        supabaseUrl,
        tokenHash,
        emailActionType,
        redirectTo,
      );
      const to = user.email ?? user.email_new;
      if (!to) {
        throw new Error("No recipient email");
      }

      let element: React.ReactElement;
      let subject: string;

      switch (emailActionType) {
        case "signup": {
          subject = SUBJECTS.signup;
          element = React.createElement(ConfirmationEmail, {
            verificationUrl,
            token: email_data.token,
          });
          break;
        }
        case "magiclink": {
          subject = SUBJECTS.magiclink;
          element = React.createElement(MagicLinkEmail, {
            verificationUrl,
            token: email_data.token,
          });
          break;
        }
        case "recovery": {
          subject = SUBJECTS.recovery;
          element = React.createElement(RecoveryEmail, {
            verificationUrl,
            token: email_data.token,
          });
          break;
        }
        case "invite": {
          subject = SUBJECTS.invite;
          element = React.createElement(InviteEmail, { verificationUrl });
          break;
        }
        case "email_change": {
          subject = SUBJECTS.email_change;
          element = React.createElement(EmailChangeEmail, {
            verificationUrl,
            token,
            isNewEmail: !!user.email_new,
          });
          break;
        }
        default: {
          subject = SUBJECTS.signup;
          element = React.createElement(ConfirmationEmail, {
            verificationUrl,
            token: email_data.token,
          });
        }
      }

      const err = await sendOne(to, subject, element);
      if (err) throw err.error;
      return new Response("OK", { status: 200 });
    },
  ),
};
