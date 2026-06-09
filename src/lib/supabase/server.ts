import { getCookies, setCookie } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server Supabase client for TanStack Start. Reads/writes the session cookie
 * via Start's server helpers (`getCookies`/`setCookie`), so calls made inside
 * server functions and route `beforeLoad`/`loader` see the authenticated user
 * and refresh the session cookie when needed.
 *
 * All data access goes through the `api` schema (RPC-first).
 */
export function getSupabaseServerClient() {
  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      db: { schema: "api" },
      cookies: {
        getAll() {
          return Object.entries(getCookies()).map(([name, value]) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            setCookie(name, value, options),
          );
        },
      },
    },
  );
}
