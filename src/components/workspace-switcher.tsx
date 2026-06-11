import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Lock, Plus, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/prompts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan: string;
}

/**
 * Top-left workspace menu — switch between workspaces, create a new one, and
 * (consolidated here to keep the header uncluttered) jump to settings or log
 * out. tenant_select / tenant_create pin the tenant to the session, so a single
 * refreshSession() lands the caller in the right workspace.
 */
export function WorkspaceSwitcher({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  async function loadWorkspaces() {
    const supabase = createClient();
    const { data } = await supabase.rpc("tenant_list");
    setWorkspaces((data as unknown as Workspace[]) ?? []);
  }

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  const current = workspaces.find((w) => w.slug === slug);

  // Plan gate (mirrors the api.tenant_create check): Free accounts own one
  // workspace; owning a Pro workspace lifts the cap.
  const ownedCount = workspaces.filter((w) => w.role === "owner").length;
  const hasPro = workspaces.some(
    (w) => w.role === "owner" && w.plan !== "free",
  );
  const atFreeLimit = ownedCount >= 1 && !hasPro;

  async function switchTo(w: Workspace) {
    if (w.slug === slug) return;
    const supabase = createClient();
    await supabase.rpc("tenant_select", { p_tenant_id: w.id });
    await supabase.auth.refreshSession();
    await router.invalidate();
    navigate({ to: "/$slug", params: { slug: w.slug } });
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const newSlug = `${slugify(trimmed)}-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await supabase.rpc("tenant_create", {
        p_name: trimmed,
        p_slug: newSlug,
      });
      if (error) {
        if ((error as { hint?: string }).hint === "plan_limit") {
          setCreateOpen(false);
          setUpgradeOpen(true);
        } else {
          setError(error.message);
        }
        return;
      }
      await supabase.auth.refreshSession();
      await router.invalidate();
      setCreateOpen(false);
      setName("");
      navigate({ to: "/$slug", params: { slug: newSlug } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted data-[state=open]:bg-muted"
          >
            <div className="bg-primary size-3 rounded-full pr-2"></div>
            <span className="max-w-[12rem] truncate text-base font-medium">
              {current?.name ?? "Workspace"}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => switchTo(w)}
              className="justify-between gap-2"
            >
              <span className="truncate">{w.name}</span>
              {w.slug === slug && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="justify-between gap-2"
            onClick={() =>
              atFreeLimit ? setUpgradeOpen(true) : setCreateOpen(true)
            }
          >
            <span className="flex items-center gap-2">
              <Plus className="size-4" />
              New workspace
            </span>
            {atFreeLimit && <Lock className="size-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="gap-2">
            <Link to="/$slug/settings" params={{ slug }}>
              <Settings className="size-4" />
              Workspace settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A workspace isolates its own environments, prompts, and members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createWorkspace} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                autoFocus
              />
            </div>
            {error && (
              <p className="callout-error" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        tenantId={current?.id ?? null}
        onUpgraded={loadWorkspaces}
      />
    </>
  );
}
