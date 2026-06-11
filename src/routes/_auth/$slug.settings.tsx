import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { PageHeader, Breadcrumb } from "@/components/page-header";

/**
 * Settings layout — nested under the $slug workspace layout (which already
 * provides the AppContainer shell). Adds the section header + tab nav
 * (Workspace · Members); child pages render just their content.
 */
export const Route = createFileRoute("/_auth/$slug/settings")({
  component: SettingsLayout,
});

function SettingsTab({
  to,
  slug,
  exact,
  children,
}: {
  to: "/$slug/settings" | "/$slug/settings/members";
  slug: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={exact ? { exact: true } : undefined}
      className="-mb-px border-b-2 border-transparent pb-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-primary data-[status=active]:font-medium data-[status=active]:text-foreground"
    >
      {children}
    </Link>
  );
}

function SettingsLayout() {
  const { slug } = Route.useParams();
  return (
    <>
      <PageHeader
        back={
          <Breadcrumb to="/$slug" params={{ slug }}>
            Workspace
          </Breadcrumb>
        }
        title="Settings"
        tabs={
          <>
            <SettingsTab to="/$slug/settings" slug={slug} exact>
              Workspace
            </SettingsTab>
            <SettingsTab to="/$slug/settings/members" slug={slug}>
              Members
            </SettingsTab>
          </>
        }
      />

      <div className="mt-10">
        <Outlet />
      </div>
    </>
  );
}
