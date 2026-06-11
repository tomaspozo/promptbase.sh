import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/fn-error";
import { PROMPTBASE_VERSION } from "@/lib/promptbase-version";
import { useHasPermission } from "@/hooks/use-has-permission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/loading";
import { PageHeader, Breadcrumb } from "@/components/page-header";

/**
 * Environment settings — the project connection, the deployed promptbase
 * version + resources, and a re-deploy action (re-runs environment-install to
 * push the latest functions/schema/key into the user's project).
 */
export const Route = createFileRoute(
  "/_auth/$slug/environments/$envId/settings",
)({
  component: EnvironmentSettingsPage,
});

interface Environment {
  id: string;
  name: string;
  supabase_project_ref: string;
  supabase_url: string;
  installed: boolean;
  promptbase_version: string | null;
  created_at: string;
  updated_at: string;
}

interface Tenant {
  id: string;
  slug: string;
}

// What environment-install deploys into the user's project. Shown so the user
// can see exactly what promptbase added to their Supabase project.
const RESOURCES = [
  {
    label: "Edge function: promptbase-manage",
    detail: "Prompt CRUD — create, version, publish, delete",
  },
  {
    label: "Edge function: promptbase-get",
    detail: "Runtime read — fetch the published prompt by slug",
  },
  {
    label: "Schema: promptbase",
    detail: "Tables prompts + prompt_versions (exposed on the Data API)",
  },
  {
    label: "Function secret: PROMPTBASE_SECRET",
    detail: "Dedicated shared secret the platform uses to reach the functions",
  },
];

function EnvironmentSettingsPage() {
  const { slug, envId } = Route.useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [env, setEnv] = useState<Environment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState(false);
  const canUpdate = useHasPermission("environment.update");

  async function loadEnv() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("environment_get", {
      p_env_id: envId,
    });
    if (error) {
      setError(error.message);
      setEnv(null);
    } else {
      setEnv(data as unknown as Environment);
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: tlist } = await supabase.rpc("tenant_list");
      setTenant(
        ((tlist as unknown as Tenant[]) ?? []).find(
          (t) => t.slug === slug,
        ) ?? null,
      );
      await loadEnv();
    }
    void load();
  }, [envId, slug]);

  async function redeploy() {
    if (!tenant || !env) return;
    setRedeploying(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke("environment-install", {
        body: {
          tenant_id: tenant.id,
          project_ref: env.supabase_project_ref,
          name: env.name,
        },
      });
      if (error) {
        setError(await readFunctionError(error));
        return;
      }
      await loadEnv();
    } finally {
      setRedeploying(false);
    }
  }

  const outdated =
    !!env?.promptbase_version && env.promptbase_version !== PROMPTBASE_VERSION;

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        back={
          <Breadcrumb
            to="/$slug/environments/$envId"
            params={{ slug, envId }}
          >
            {env?.name ?? "Environment"}
          </Breadcrumb>
        }
        title="Environment settings"
        subtitle="The Supabase project this environment is deployed into, and what promptbase installed there."
      />

      {error && (
          <p
            role="alert"
            className="callout-error"
          >
            {error}
          </p>
        )}

        {env === undefined ? (
          <Loading />
        ) : env === null ? (
          <p className="text-sm text-muted-foreground">Environment not found.</p>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="label">Project connection</h2>
              <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Environment name
                  </dt>
                  <dd className="mt-1 font-medium">{env.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={env.installed ? "default" : "outline"}>
                      {env.installed ? "installed" : "pending"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Project ref</dt>
                  <dd className="mt-1 font-mono text-sm">
                    {env.supabase_project_ref}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Project URL</dt>
                  <dd className="mt-1 font-mono text-xs break-all">
                    {env.supabase_url}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="label">Deployed version</h2>
                {outdated ? (
                  <Badge variant="outline" className="text-[color:var(--mid)]">
                    update available
                  </Badge>
                ) : (
                  <Badge variant="outline">up to date</Badge>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-mono text-sm">
                    promptbase {env.promptbase_version ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {outdated
                      ? `Latest is ${PROMPTBASE_VERSION}. Re-deploy to update.`
                      : `Latest is ${PROMPTBASE_VERSION}.`}
                  </p>
                </div>
                {canUpdate && (
                  <Button
                    onClick={redeploy}
                    disabled={redeploying}
                    variant={outdated ? "default" : "outline"}
                  >
                    {redeploying
                      ? "Deploying…"
                      : outdated
                        ? "Update"
                        : "Re-deploy"}
                  </Button>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                Last deployed {new Date(env.updated_at).toLocaleString()}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="label">Deployed resources</h2>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {RESOURCES.map((r) => (
                  <li key={r.label} className="flex items-start gap-3 p-4">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
    </div>
  );
}
