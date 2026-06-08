import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Placeholder protected dashboard. Replace with your app's main UI.
 *
 * Available:
 *   - createClient (server)        → @/lib/supabase/server
 *   - createClient (browser/client) → @/lib/supabase/client
 *   - useSignUpFlow / useSignInFlow / useResendEmail / etc. → @/lib/auth
 *   - UI primitives                → @/components/ui/*
 *   - AuthShell                    → @/components/auth-shell
 */
export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rule flex items-baseline justify-between pt-4">
          <p className="label">Dashboard</p>
          <LogoutButton />
        </div>

        <div className="mt-12 animate-rise space-y-6">
          <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
            Hello, {user?.email}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Frontend scaffold — no design applied yet. Replace this page with
            your app's main UI.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/settings/members">Manage members</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
