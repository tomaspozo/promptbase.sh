import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { AppContainer } from "@/components/app-container";
import { Logo } from "@/components/logo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserMenu } from "@/components/user-menu";

/**
 * Workspace layout — a persistent top bar (workspace switcher on the left,
 * account avatar on the right) above a hairline, present on every /$slug page,
 * then the page content in the shared column.
 */
export const Route = createFileRoute("/_auth/$slug")({
  component: TenantLayout,
});

function TenantLayout() {
  const { slug } = Route.useParams();
  return (
    <main className="min-h-dvh">
      <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <WorkspaceSwitcher slug={slug} />
          </div>
          <UserMenu slug={slug} />
        </div>
      </div>
      <AppContainer>
        <Outlet />
      </AppContainer>
    </main>
  );
}
