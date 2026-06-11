import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdatePasswordFlow } from "@/lib/auth";

/**
 * Update-password form. Used by /update-password — both the recovery
 * destination after a `type=recovery` link click and the in-app password
 * change flow. Identical UX in both cases.
 */
export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const flow = useUpdatePasswordFlow();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      flow.setError("Passwords don't match");
      return;
    }
    const ok = await flow.submit(password);
    if (ok) {
      await router.invalidate();
      navigate({ to: "/app" });
    }
  }

  return (
    <div className={className} {...props}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-md"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-10 rounded-md"
          />
        </div>

        {flow.error && (
          <p
            role="alert"
            className="callout-error"
          >
            {flow.error}
          </p>
        )}

        <Button type="submit" disabled={flow.loading} className="h-10 w-full">
          {flow.loading ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
