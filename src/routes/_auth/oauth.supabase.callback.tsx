import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_auth/oauth/supabase/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    error:
      typeof s.error_description === "string"
        ? s.error_description
        : typeof s.error === "string"
          ? s.error
          : undefined,
  }),
  component: CallbackPage,
});

function decodeState(state: string): { t: string; n: string } | null {
  try {
    const b64 = state.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function CallbackPage() {
  const { code, state, error: oauthError } = Route.useSearch();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Connecting your Supabase organization…");
  const [failed, setFailed] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (oauthError) return fail(oauthError);
      if (!code || !state) return fail("Missing authorization code.");

      const decoded = decodeState(state);
      const nonce = sessionStorage.getItem("pb_oauth_nonce");
      if (!decoded || decoded.n !== nonce) {
        return fail("Invalid or expired connection request. Please try again.");
      }
      sessionStorage.removeItem("pb_oauth_nonce");

      const supabase = createClient();

      // Resolve the slug of the workspace being connected so we can redirect
      // back into it (the callback URL itself isn't slug-scoped).
      let targetSlug: string | null = null;
      try {
        const { data } = await supabase.rpc("tenant_list");
        targetSlug =
          ((data as unknown as { id: string; slug: string }[]) ?? []).find(
            (t) => t.id === decoded.t,
          )?.slug ?? null;
      } catch {
        // fall back to /app
      }
      setSlug(targetSlug);

      const { error } = await supabase.functions.invoke("supabase-oauth-callback", {
        body: {
          code,
          redirect_uri: `${window.location.origin}/oauth/supabase/callback`,
          tenant_id: decoded.t,
        },
      });
      if (error) {
        let msg = error.message ?? "Failed to connect.";
        try {
          const body = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          // keep the generic message
        }
        return fail(msg);
      }

      setMessage("Connected! Redirecting…");
      setTimeout(() => {
        // Back to onboarding so the user can name the workspace (defaulted to
        // the org name) before landing in it.
        if (targetSlug)
          navigate({ to: "/$slug/onboarding", params: { slug: targetSlug } });
        else navigate({ to: "/app" });
      }, 800);
    }

    function fail(msg: string) {
      setFailed(true);
      setMessage(msg);
    }

    void run();
  }, []);

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="label mb-6">Supabase</p>
        {failed ? (
          <>
            <p className="callout-error text-left" role="alert">
              {message}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() =>
                slug
                  ? navigate({ to: "/$slug/onboarding", params: { slug } })
                  : navigate({ to: "/app" })
              }
            >
              Back to onboarding
            </Button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="size-1.5 animate-pulse-slow rounded-full bg-primary" />
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
