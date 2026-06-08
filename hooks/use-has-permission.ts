"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { permissionsFromClaims, hasPermissions } from "@/lib/permissions";

/**
 * Client hook: whether the current user holds the required permission(s) in
 * their ACTIVE workspace, read from the JWT (app_metadata.permissions). Same
 * name + semantics as the Vite template's hook so the mental model is shared.
 *
 * ⚠️ UX ONLY — never security. The real gate is the backend
 * `auth_verify_access()` guard inside every mutating RPC, which returns 403
 * regardless of what the UI shows. Hiding/disabling a control does not secure
 * it; never weaken a backend guard because the frontend hides a button.
 *
 * Fails safe: returns `false` while claims are loading. getClaims() returns the
 * live (auto-refreshed) claims, so there's no separate tenant-readiness race to
 * manage here. Re-evaluates on auth state changes (sign-in, workspace switch).
 */
export function useHasPermission(
  permission: string | string[],
  mode: "all" | "any" = "all",
): boolean {
  const [held, setHeld] = useState<string[] | null>(null); // null = loading

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.auth.getClaims();
      if (active) setHeld(permissionsFromClaims(data?.claims));
    }

    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (held === null) return false; // fail safe while loading
  const required = Array.isArray(permission) ? permission : [permission];
  return hasPermissions(held, required, mode);
}
