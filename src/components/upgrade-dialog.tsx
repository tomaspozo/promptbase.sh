import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRO_FEATURES = [
  "Unlimited workspaces",
  "Unlimited environments & prompts",
  "Invite your whole team",
];

/**
 * Upgrade-to-Pro dialog. MVP has no billing, so confirming simply flips the
 * workspace to the Pro plan via api.tenant_upgrade — the dialog itself is the
 * confirmation step.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  tenantId,
  onUpgraded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string | null;
  onUpgraded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("tenant_upgrade", {
        p_tenant_id: tenantId,
      });
      if (error) {
        setError(error.message);
        return;
      }
      onUpgraded?.();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            The Free plan includes a single workspace. Pro lifts the limit.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="callout-error">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button onClick={upgrade} disabled={busy || !tenantId}>
            {busy ? "Upgrading…" : "Upgrade to Pro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
