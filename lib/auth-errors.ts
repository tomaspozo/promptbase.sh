import type { AuthError } from "@supabase/supabase-js"

/**
 * Maps Supabase auth errors to friendly, action-oriented messages.
 *
 * Pass any thrown value — the helper checks the `code` field (stable, set by
 * the Supabase JS SDK) first and falls back to `message` substring matching
 * for SDK versions that don't surface `code`. Unknown errors fall through
 * to the original message so debugging isn't worse than before.
 */
export function formatAuthError(err: unknown): string {
  const fallback = "Something went wrong. Please try again."

  if (!err) return fallback

  const e = err as Partial<AuthError> & { code?: string; message?: string }

  switch (e.code) {
    case "invalid_credentials":
      return "Wrong email or password."
    case "email_not_confirmed":
      return "Please confirm your email before signing in. Check your inbox for the link."
    case "user_already_exists":
    case "email_address_invalid":
      return "An account with this email already exists. Try signing in instead."
    case "weak_password":
      return "That password is too weak. Use at least 8 characters."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again."
    case "signup_disabled":
      return "Signups are currently disabled for this project."
    case "otp_expired":
      return "This link has expired. Request a new one."
    default:
      break
  }

  const msg = (e.message ?? "").toLowerCase()
  if (msg.includes("invalid login credentials")) return "Wrong email or password."
  if (msg.includes("email not confirmed"))
    return "Please confirm your email before signing in. Check your inbox for the link."
  if (msg.includes("user already registered"))
    return "An account with this email already exists. Try signing in instead."
  if (msg.includes("password should be at least"))
    return "That password is too weak. Use at least 8 characters."
  if (msg.includes("rate limit")) return "Too many attempts. Wait a minute and try again."

  return e.message || fallback
}
