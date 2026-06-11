import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startSupabaseConnect } from "@/lib/connect-supabase";
import { useHasPermission } from "@/hooks/use-has-permission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { UpgradeDialog } from "@/components/upgrade-dialog";

/**
 * Settings · Workspace. Shows the workspace plan and the connected Supabase
 * organization, with a reconnect action (re-mints the OAuth token — needed
 * after changing the OAuth app's scopes).
 */
export const Route = createFileRoute("/_auth/$slug/settings/")({
  component: WorkspaceSettingsPage,
});

interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  organization_id: string | null;
  plan: string;
}

interface Organization {
  supabase_org_id: string;
  supabase_org_name: string | null;
}

function WorkspaceSettingsPage() {
  const { slug } = Route.useParams();
  const [tenant, setTenant] = useState<Tenant | null | undefined>(undefined);
  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const canManageOrg = useHasPermission("organization.create");

  async function load() {
    const supabase = createClient();
    const { data: tlist, error: tErr } = await supabase.rpc("tenant_list");
    if (tErr) {
      setError(tErr.message);
      setTenant(null);
      return;
    }
    const t =
      ((tlist as unknown as Tenant[]) ?? []).find((x) => x.slug === slug) ??
      null;
    setTenant(t);
    // Member-safe org read (organization_list is owner-only; this RPC lets any
    // member see the connected org read-only).
    if (t?.organization_id) {
      const { data: o } = await supabase.rpc("organization_read_for_tenant", {
        p_tenant_id: t.id,
      });
      setOrg((o as unknown as Organization) ?? null);
    } else {
      setOrg(null);
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  function reconnect() {
    if (!tenant) return;
    setConnecting(true);
    startSupabaseConnect(tenant.id);
  }

  return (
    <div className="animate-rise space-y-10">
      <p className="text-sm text-muted-foreground">
        Your plan and the Supabase organization this workspace deploys into.
      </p>

      {error && (
        <p
          role="alert"
          className="callout-error"
        >
          {error}
        </p>
      )}

      {tenant === undefined ? (
        <Loading />
      ) : tenant === null ? (
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="label">Workspace</h2>
            <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Plan</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={tenant.plan === "free" ? "outline" : "default"}
                    className="capitalize"
                  >
                    {tenant.plan}
                  </Badge>
                  {tenant.plan === "free" && tenant.role === "owner" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => setUpgradeOpen(true)}
                    >
                      Upgrade
                    </Button>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h2 className="label">Supabase organization</h2>
            {org ? (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {org.supabase_org_name ?? "Connected organization"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {org.supabase_org_id}
                    </p>
                  </div>
                  <Badge>connected</Badge>
                </div>
                {canManageOrg && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                    <Button
                      onClick={reconnect}
                      disabled={connecting}
                      variant="outline"
                      className="h-10 self-start"
                    >
                      {connecting ? "Redirecting…" : "Reconnect"}
                    </Button>
                    <p className="font-mono text-xs text-muted-foreground">
                      Reconnect to refresh access — e.g. after changing your
                      Supabase OAuth app&rsquo;s scopes (the existing token keeps
                      its old scopes).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Plug}
                title="No Supabase organization"
                action={
                  canManageOrg ? (
                    <Button asChild size="sm">
                      <Link to="/$slug/onboarding" params={{ slug }}>
                        Connect Supabase
                      </Link>
                    </Button>
                  ) : undefined
                }
              >
                This workspace isn&rsquo;t linked to a Supabase organization yet.
              </EmptyState>
            )}
          </section>
        </>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        tenantId={tenant?.id ?? null}
        onUpgraded={load}
      />
    </div>
  );
}
