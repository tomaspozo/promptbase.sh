import { Link, createFileRoute } from "@tanstack/react-router";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";

/**
 * Placeholder protected dashboard. Replace with your app's main UI.
 * `context.user` (decoded JWT claims) is provided by the root route.
 */
export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const email = (user?.email as string | undefined) ?? "";

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rule flex items-baseline justify-between pt-4">
          <p className="label">Dashboard</p>
          <LogoutButton />
        </div>

        <div className="mt-12 animate-rise space-y-6">
          <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
            Hello, {email}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Frontend scaffold — no design applied yet. Replace this page with
            your app&apos;s main UI.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/settings/members">Manage members</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
