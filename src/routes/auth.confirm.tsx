import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Single PKCE callback for all email-link types: signup, magic link, recovery,
 * and email change. Runs server-side so `exchangeCodeForSession` can mint the
 * session into cookies, then redirects based on the email action type.
 *
 * Workspace invitations have their own /accept-invite route (the URL also
 * carries ?token= for the invitation_accept RPC).
 */
const exchangeCode = createServerFn({ method: "GET" })
  .validator(
    (d: { code?: string; type?: string; next?: string; error?: string }) => d,
  )
  .handler(async ({ data }): Promise<{ to: string }> => {
    if (data.error || !data.code) {
      return { to: "/auth/sign-in" };
    }
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    if (error) {
      return { to: "/auth/sign-in" };
    }
    if (data.type === "recovery") return { to: "/update-password" };
    if (data.type === "email_change") return { to: "/dashboard" };
    // signup / magiclink / fallback — the session cookie now carries the
    // tenant_id claim populated by _hook_custom_access_token on this mint.
    return { to: data.next ?? "/dashboard" };
  });

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
    error:
      typeof search.error_description === "string"
        ? search.error_description
        : typeof search.error === "string"
          ? search.error
          : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const { to } = await exchangeCode({ data: deps });
    throw redirect({ to });
  },
});
