import { requirePermission } from "@/lib/permissions.server";

/**
 * Settings section server guard.
 *
 * The proxy middleware (`lib/supabase/proxy.ts`) path-gates unauth'd users to
 * sign-in. This layout adds the PERMISSION gate for /settings/* — you need
 * `membership.read` to view the members area. It runs server-side before the
 * client `members/page.tsx` renders, so an unprivileged user is redirected to
 * /forbidden rather than seeing a flash of the page.
 *
 * Note: this is also the first explicit auth-layer guard for /settings/* —
 * previously it was only path-gated by middleware (it sits outside /protected).
 *
 * ⚠️ UX only. The backend `auth_verify_access()` guard inside each RPC is the
 * real gate; a user who bypasses the UI still gets a 403.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("membership.read");
  return <>{children}</>;
}
