import { useEffect } from "react";
import { Loading } from "@/components/loading";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
  slug: string;
}

/**
 * /app — resolve the user's active workspace and redirect into it (/$slug).
 * Workspace-level onboarding (connecting Supabase) happens at /$slug/onboarding,
 * reached from the workspace home once you're inside.
 */
export const Route = createFileRoute("/_auth/app")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    async function go() {
      const supabase = createClient();
      const { data } = await supabase.rpc("tenant_list");
      const first = ((data as unknown as Tenant[]) ?? [])[0];
      // Every account is provisioned with a workspace on signup; if somehow
      // there's none, stay on the loader rather than route to a dead end.
      if (!first) return;
      navigate({ to: "/$slug", params: { slug: first.slug } });
    }
    void go();
  }, [navigate]);

  return (
    <main className="grid min-h-dvh place-items-center">
      <Loading />
    </main>
  );
}
