import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startSupabaseConnect } from "@/lib/connect-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/loading";
import { PageHeader, Breadcrumb } from "@/components/page-header";
import { Wordmark } from "@/components/wordmark";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  organization_id: string | null;
}

/**
 * Connect THIS workspace (resolved by slug) to a Supabase organization, then
 * name the workspace (defaulted to the org name) before continuing. Lives under
 * the $slug layout so each workspace onboards independently.
 */
export const Route = createFileRoute("/_auth/$slug/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null | undefined>(undefined);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [wsName, setWsName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.rpc("tenant_list");
      const t =
        ((data as unknown as Tenant[]) ?? []).find((x) => x.slug === slug) ??
        null;
      setTenant(t);
      if (t?.organization_id) {
        const { data: o } = await supabase.rpc("organization_read_for_tenant", {
          p_tenant_id: t.id,
        });
        const name =
          (o as { supabase_org_name?: string | null } | null)
            ?.supabase_org_name ?? null;
        setOrgName(name);
        setWsName(name || t.name);
      } else {
        setWsName(t?.name ?? "");
      }
    }
    void load();
  }, [slug]);

  function connect() {
    if (!tenant) return;
    setConnecting(true);
    startSupabaseConnect(tenant.id);
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const name = wsName.trim();
      if (name && name !== tenant.name) {
        const { error } = await supabase.rpc("tenant_rename", {
          p_tenant_id: tenant.id,
          p_name: name,
        });
        if (error) {
          setError(error.message);
          return;
        }
      }
      navigate({ to: "/$slug", params: { slug } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl animate-rise space-y-6">
      <PageHeader
        back={
          <Breadcrumb to="/$slug" params={{ slug }}>
            Workspace
          </Breadcrumb>
        }
        title="Connect your Supabase"
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <Wordmark /> runs entirely in <em>your</em> Supabase. Connect your
        Supabase organization so we can deploy prompt storage into your projects
        — no prompt data ever touches our servers.
      </p>

      {tenant === undefined ? (
        <Loading />
      ) : tenant === null ? (
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      ) : tenant.organization_id ? (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <span>
              Connected to{" "}
              <strong>
                {orgName ?? "your Supabase organization"}
              </strong>
              .
            </span>
          </p>

          <form onSubmit={finish} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="h-10"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Defaulted to your Supabase organization — change it to anything
                you like.
              </p>
            </div>

            {error && (
              <p role="alert" className="callout-error">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving || !wsName.trim()}
                className="h-10"
              >
                {saving ? "Saving…" : "Continue"}
              </Button>
              <Button
                type="button"
                onClick={connect}
                disabled={connecting}
                variant="outline"
                className="h-10"
              >
                {connecting ? "Redirecting…" : "Reconnect"}
              </Button>
            </div>
          </form>

          <p className="font-mono text-xs text-muted-foreground">
            Reconnect to refresh access — e.g. after changing your Supabase OAuth
            app&rsquo;s scopes (the existing token keeps its old scopes).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Button onClick={connect} disabled={connecting} className="h-10">
            {connecting
              ? "Redirecting to Supabase…"
              : "Connect Supabase organization"}
          </Button>
          <p className="font-mono text-xs text-muted-foreground">
            You&rsquo;ll be sent to Supabase to authorize, then brought back
            here.
          </p>
        </div>
      )}
    </div>
  );
}
