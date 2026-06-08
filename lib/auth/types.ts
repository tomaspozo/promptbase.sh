/**
 * Shared types for the auth hooks layer.
 *
 * Email "type" matches GoTrue's email_action_type vocabulary, so
 * check-inbox / verify-otp / resend share a single discriminator.
 */
export type AuthEmailKind = "signup" | "magiclink" | "recovery" | "invite";

export type SignUpResult =
  | { kind: "authenticated" }
  | { kind: "pending"; email: string };

export type VerifyResult =
  | { kind: "signed_in" }
  | { kind: "recovery" }
  | { kind: "needs_password_setup" };
