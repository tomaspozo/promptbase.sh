import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client. Uses @supabase/ssr so the session is persisted in
 * cookies (not localStorage) — that lets the TanStack Start server read the
 * session during SSR. All data access goes through the `api` schema (RPCs).
 */
export function createClient() {
  return createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { db: { schema: "api" } },
  );
}
