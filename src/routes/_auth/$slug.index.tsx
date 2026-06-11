import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { promptsCall } from "@/lib/prompts";
import { PROMPTBASE_VERSION } from "@/lib/promptbase-version";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { PageHeading } from "@/components/page-heading";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  organization_id: string | null;
  plan: string;
}

interface Environment {
  id: string;
  name: string;
  supabase_project_ref: string;
  supabase_url: string;
  installed: boolean;
  promptbase_version: string | null;
  created_at: string;
}

export const Route = createFileRoute("/_auth/$slug/")({
  component: TenantPage,
});

/** Lazily fetches an installed environment's prompt count via the proxy. */
function PromptCount({ envId }: { envId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    promptsCall<{ prompts: unknown[] }>(envId, "list")
      .then((r) => active && setCount(r.prompts.length))
      .catch(() => active && setCount(null));
    return () => {
      active = false;
    };
  }, [envId]);
  if (count === null) return null;
  return <> · {count === 1 ? "1 prompt" : `${count} prompts`}</>;
}

function TenantPage() {
  const { slug } = Route.useParams();
  const [tenant, setTenant] = useState<Tenant | null | undefined>(undefined);
  const [envs, setEnvs] = useState<Environment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: tlist } = await supabase.rpc("tenant_list");
      const t =
        ((tlist as unknown as Tenant[]) ?? []).find((x) => x.slug === slug) ??
        null;
      setTenant(t);
      if (t?.organization_id) {
        const { data, error } = await supabase.rpc("environment_list");
        if (error) setError(error.message);
        else setEnvs((data as unknown as Environment[]) ?? []);
      }
    }
    void load();
  }, [slug]);

  return (
    <>
      <div className="animate-rise space-y-8">
        {tenant === undefined ? (
          <Loading />
        ) : tenant === null ? (
          <p className="text-sm text-muted-foreground">Workspace not found.</p>
        ) : !tenant.organization_id ? (
          <div className="space-y-4">
            <PageHeading>Connect Supabase to get started</PageHeading>
            <p className="max-w-prose text-sm text-muted-foreground">
              This workspace isn&rsquo;t linked to a Supabase organization yet.
            </p>
            <Button asChild className="h-10">
              <Link to="/$slug/onboarding" params={{ slug }}>
                Connect Supabase
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <PageHeader
              title="Environments"
              actions={
                <Button asChild className="h-10">
                  <Link to="/$slug/environments/new" params={{ slug }}>
                    Add environment
                  </Link>
                </Button>
              }
            />

            {error && (
              <p role="alert" className="callout-error">
                {error}
              </p>
            )}

            {envs === null ? (
              <Loading />
            ) : envs.length === 0 ? (
              <EmptyState icon={Boxes} title="No environments yet">
                Add one to deploy promptbase into a Supabase project.
              </EmptyState>
            ) : (
              <div className="grid gap-3">
                {envs.map((e) => {
                  const outdated =
                    !!e.promptbase_version &&
                    e.promptbase_version !== PROMPTBASE_VERSION;
                  return (
                    <Link
                      key={e.id}
                      to="/$slug/environments/$envId"
                      params={{ slug, envId: e.id }}
                      className="block rounded-lg border border-border p-4 transition-colors hover:border-foreground/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium">{e.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {e.supabase_project_ref}
                          </p>
                        </div>
                        <StatusTag
                          color={
                            e.installed
                              ? "var(--up)"
                              : "var(--mid)"
                          }
                        >
                          {e.installed ? "installed" : "pending"}
                        </StatusTag>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          promptbase {e.promptbase_version ?? "—"}
                          {e.installed && <PromptCount envId={e.id} />}
                        </span>
                        {outdated && (
                          <span
                            className={cn(
                              "flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]",
                              "text-[color:var(--mid)]",
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-[color:var(--mid)]" />
                            update available
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
