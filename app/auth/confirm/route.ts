import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Single PKCE callback for all email-link types: signup, magic link,
 * recovery, and email change.
 *
 * The redirect URL we send Supabase Auth (in `internal-send-auth-email`'s
 * REDIRECT_PATHS) points here. After clicking the email link, the user
 * lands at `/auth/confirm?code=<pkce>&type=<email_action_type>` and we:
 *
 *   1. exchangeCodeForSession(code) — mints the real session via cookies.
 *   2. Branch on `type`:
 *        recovery     → /update-password (single-purpose recovery session)
 *        email_change → /auth/email-change-success (in-place success page)
 *        signup       → /protected (refresh happens server-side via the cookie)
 *        magiclink    → /protected
 *
 *   3. If exchange fails (code expired, opened on another device, etc.),
 *      redirect to /auth/confirm-error with the message in `?reason=`.
 *
 * NOTE: workspace invitations don't come through here — they have their
 * own /accept-invite route because the URL also carries `?token=` for
 * the invitation_accept RPC.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type") ?? "signup";
  const next = searchParams.get("next");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    const url = new URL("/auth/sign-in", origin);
    url.searchParams.set("error", errorParam);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL("/auth/sign-in", origin);
    url.searchParams.set(
      "error",
      "Missing auth code. Open the email link directly, or paste the 8-digit code on /auth/check-inbox.",
    );
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/auth/sign-in", origin);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  // Branch on the email_action_type that came back in the redirect.
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/update-password", origin));
  }
  if (type === "email_change") {
    // The auth.users row is updated server-side. Just confirm and continue.
    return NextResponse.redirect(new URL("/protected", origin));
  }

  // signup / magiclink / fallback. The session cookie now carries a JWT
  // with the tenant_id claim populated by _hook_custom_access_token (the
  // hook re-runs on the next mint, which exchangeCodeForSession does).
  return NextResponse.redirect(new URL(next ?? "/protected", origin));
}
