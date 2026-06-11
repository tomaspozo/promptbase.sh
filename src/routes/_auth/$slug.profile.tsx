import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/loading";
import { PageHeader, Breadcrumb } from "@/components/page-header";

/**
 * Account profile — personal, not workspace-scoped (reached from the UserMenu).
 * Edits the caller's display name; email is read-only.
 */
export const Route = createFileRoute("/_auth/$slug/profile")({
  component: ProfilePage,
});

interface Profile {
  email: string | null;
  display_name: string | null;
  created_at: string;
}

function ProfilePage() {
  const { slug } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("profile_get");
      if (error) {
        setError(error.message);
        setProfile(null);
        return;
      }
      const p = (data as unknown as Profile) ?? null;
      setProfile(p);
      setDisplayName(p?.display_name ?? "");
    }
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("profile_update", {
        p_display_name: displayName.trim() || null,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setStatus("Saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl animate-rise space-y-8">
      <PageHeader
        back={
          <Breadcrumb to="/$slug" params={{ slug }}>
            Workspace
          </Breadcrumb>
        }
        title="Profile"
        subtitle="Your personal account details. These are shared across all your workspaces."
      />

        {error && (
          <p role="alert" className="callout-error">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="callout-success">
            {status}
          </p>
        )}

        {profile === undefined ? (
          <Loading />
        ) : (
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email ?? ""}
                disabled
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button type="submit" disabled={saving} className="h-10">
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
    </div>
  );
}
