import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/fn-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loading } from "@/components/loading";
import { PageHeader, Breadcrumb } from "@/components/page-header";

interface Tenant {
  id: string;
  slug: string;
  organization_id: string | null;
}

interface Project {
  id: string;
  name: string;
  region: string;
}

export const Route = createFileRoute(
  "/_auth/$slug/environments/new",
)({
  component: NewEnvironment,
});

function NewEnvironment() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectRef, setProjectRef] = useState("");
  const [name, setName] = useState("Production");
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: tlist } = await supabase.rpc("tenant_list");
      const t =
        ((tlist as unknown as Tenant[]) ?? []).find(
          (x) => x.slug === slug,
        ) ?? null;
      setTenant(t);
      if (t?.organization_id) {
        // Projects already installed in this workspace — one env per project.
        const { data: elist } = await supabase.rpc("environment_list");
        const used = new Set(
          ((elist as unknown as { supabase_project_ref: string }[]) ?? []).map(
            (e) => e.supabase_project_ref,
          ),
        );
        const { data, error } = await supabase.functions.invoke(
          "management-projects",
          { body: { org_id: t.organization_id } },
        );
        if (error) setError(await readFunctionError(error));
        else
          setProjects(
            ((data?.projects as Project[]) ?? []).filter((p) => !used.has(p.id)),
          );
      }
    }
    void load();
  }, [slug]);

  async function install(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !projectRef) return;
    setInstalling(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke(
      "environment-install",
      { body: { tenant_id: tenant.id, project_ref: projectRef, name } },
    );
    if (error) {
      setError(await readFunctionError(error));
      setInstalling(false);
      return;
    }
    // Drop the user straight into the new environment — the empty prompt list
    // nudges them to create their first prompt.
    const envId = (data as { environment?: { id?: string } } | null)?.environment
      ?.id;
    if (envId) {
      navigate({
        to: "/$slug/environments/$envId",
        params: { slug, envId },
      });
    } else {
      navigate({ to: "/$slug", params: { slug } });
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        back={
          <Breadcrumb to="/$slug" params={{ slug }}>
            Environments
          </Breadcrumb>
        }
        title="Add an environment"
        subtitle="Pick a Supabase project. We'll deploy the promptbase functions and prompt storage into it and verify the install."
      />

      {error && (
        <p role="alert" className="callout-error">
          {error}
        </p>
      )}

      <form onSubmit={install} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="project">Supabase project</Label>
              {projects === null ? (
                <Loading label="Loading projects" />
              ) : (
                <Select
                  id="project"
                  value={projectRef}
                  onChange={(e) => setProjectRef(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a project…
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="env-name">Environment name</Label>
              <Input
                id="env-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 rounded-md"
              />
            </div>

            <Button
              type="submit"
              disabled={installing || !projectRef}
              className="h-10 w-full"
            >
              {installing ? "Installing…" : "Install"}
            </Button>
          </form>
    </div>
  );
}
