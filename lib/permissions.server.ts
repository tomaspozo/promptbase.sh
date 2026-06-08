//
// Server-only permission guards. This module uses `next/navigation`'s
// redirect() and the cookie-backed server Supabase client, so it can only run
// in Server Components / Route Handlers / middleware — never a client bundle.
// (We don't add the `server-only` package to keep dependencies minimal; the
// server-only APIs below already fail if imported client-side. Add
// `import "server-only";` here if you want hard build-time enforcement.)
//
// ⚠️ UX-adjacent only for redirects — the real permission gate is the backend
// `auth_verify_access()` guard inside every mutating RPC.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { permissionsFromClaims, hasPermissions } from "@/lib/permissions";

/** Permissions for the active workspace, read from the session's JWT claims. */
export async function getPermissions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return permissionsFromClaims(data?.claims);
}

/**
 * Server-side route guard. Call at the top of a layout/page server component;
 * redirects to /forbidden when the active workspace lacks the permission(s).
 *
 *   export default async function SettingsLayout({ children }) {
 *     await requirePermission("membership.read");
 *     return <>{children}</>;
 *   }
 */
export async function requirePermission(
  permission: string | string[],
  mode: "all" | "any" = "all",
): Promise<void> {
  const held = await getPermissions();
  const required = Array.isArray(permission) ? permission : [permission];
  if (!hasPermissions(held, required, mode)) {
    redirect("/forbidden");
  }
}
