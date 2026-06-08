/**
 * Auth hooks layer (Next.js — mirror of Vite's lib/auth).
 *
 * Each hook wraps one supabase.auth.* call (or RPC, in the case of
 * useAcceptInvite) with the canonical post-call logic. See the Vite
 * mirror at src/lib/auth/index.ts for full reasoning — both
 * implementations stay in sync.
 *
 * Used by:
 *   - app/auth/sign-in/page.tsx        → useSignInFlow + useMagicLinkFlow
 *   - app/auth/sign-up/page.tsx        → useSignUpFlow
 *   - app/auth/check-inbox/page.tsx    → useResendEmail + useVerifyOtpFlow
 *   - app/auth/forgot-password/page.tsx → useResetPasswordFlow
 *   - app/auth/update-password/page.tsx → useUpdatePasswordFlow
 *   - app/auth/confirm/route.ts         → exchangeCodeForSession server-side
 *   - app/accept-invite/page.tsx        → useAcceptInvite
 */
export { useSignUpFlow } from "./use-sign-up-flow";
export { useSignInFlow } from "./use-sign-in-flow";
export { useMagicLinkFlow } from "./use-magic-link-flow";
export { useResetPasswordFlow } from "./use-reset-password-flow";
export { useUpdatePasswordFlow } from "./use-update-password-flow";
export { useVerifyOtpFlow } from "./use-verify-otp-flow";
export { useResendEmail } from "./use-resend-email";
export { useAcceptInvite } from "./use-accept-invite";
export type { AuthEmailKind, SignUpResult, VerifyResult } from "./types";
