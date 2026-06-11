import { useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { isAllowedFromClaims } from "@/lib/permissions";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";

/**
 * Early-access waiting room. Reached when an authenticated user's profile is
 * not yet approved (the _auth gate redirects them here). Top-level route — NOT
 * under _anon (which would bounce signed-in users away) or _auth (which would
 * redirect-loop). On approval the user's next token mint carries
 * app_metadata.allowed = true, so refreshing the session forwards them on.
 */
export const Route = createFileRoute("/pending")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/auth/sign-in" });
    }
    if (isAllowedFromClaims(context.user)) {
      throw redirect({ to: "/app" });
    }
  },
  component: PendingPage,
});

function PendingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  // Re-mint the token (picks up app_metadata.allowed if just approved) and
  // re-run route guards. If approved, this route's beforeLoad redirects to
  // /app; otherwise we stay here. No manual navigate (that would loop
  // back through the _auth gate).
  async function checkStatus() {
    setChecking(true);
    try {
      const supabase = createClient();
      await supabase.auth.refreshSession();
      await router.invalidate();
    } finally {
      setChecking(false);
      setCheckedOnce(true);
    }
  }

  // Auto-check on mount so arriving from the approval email forwards once approved.
  useEffect(() => {
    void checkStatus();
  }, []);

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <div className="rule flex items-baseline justify-between pt-4">
          <p className="label">Early access</p>
          <LogoutButton />
        </div>

        <div className="mt-12 animate-rise">
          <PageHeading>You&rsquo;re on the list.</PageHeading>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for signing up — your email is verified and your account is
            waiting for approval. We&rsquo;ll email you the moment you&rsquo;re
            in. You can close this tab; the email link brings you right back.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Button onClick={checkStatus} disabled={checking} className="h-10">
              {checking ? "Checking…" : "Check status"}
            </Button>
            {checkedOnce && !checking && (
              <span className="font-mono text-xs text-muted-foreground">
                Not approved yet.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
