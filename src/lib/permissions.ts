/**
 * Permission helpers shared across server components, middleware, and client
 * components. Permissions live in the access-token JWT under
 * `app_metadata.permissions` (populated by `_hook_custom_access_token` on every
 * mint) — NOT in `user.app_metadata` (the `auth.users` DB column, which stays
 * empty in this scaffold because tenant context lives only in the JWT claim).
 *
 * ⚠️ Reading permissions here is for UX gating only. The real gate is the
 * backend `auth_verify_access()` guard inside every mutating RPC, which returns
 * 403 regardless of what the UI shows. Hiding a control does not secure it.
 *
 * Pure functions only (no `next/navigation`, no server client) so this module
 * is safe to import from any runtime — server component, Edge middleware, or
 * client component.
 */

/** Decode a JWT payload. atob exists in Node, Edge, and the browser. */
export function decodeJwtPayload(
  token: string | undefined,
): Record<string, any> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return null;
  }
}

/**
 * Read the permissions array from an ALREADY-DECODED claims object — the shape
 * `supabase.auth.getClaims()` returns. Prefer this in server components and
 * middleware (getClaims already hands you the decoded payload — no re-decode).
 */
export function permissionsFromClaims(
  claims: Record<string, any> | null | undefined,
): string[] {
  const perms = claims?.app_metadata?.permissions;
  return Array.isArray(perms) ? perms : [];
}

/** Read permissions from a raw access-token string (decode + extract). */
export function readPermissions(accessToken: string | undefined): string[] {
  return permissionsFromClaims(decodeJwtPayload(accessToken));
}

export function hasPermission(held: string[], required: string): boolean {
  return held.includes(required);
}

export function hasPermissions(
  held: string[],
  required: string[],
  mode: "all" | "any" = "all",
): boolean {
  return mode === "all"
    ? required.every((p) => held.includes(p))
    : required.some((p) => held.includes(p));
}
