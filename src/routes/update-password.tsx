import { createFileRoute } from "@tanstack/react-router";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthShell } from "@/components/auth-shell";

/**
 * /update-password — recovery destination AND in-app password change.
 * Top-level (not gated by _auth): a recovery session has no tenant claim yet,
 * and an already-signed-in user can also change their password here.
 */
export const Route = createFileRoute("/update-password")({
  component: UpdatePasswordPage,
});

function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow="Set new password"
      title="Choose a new password."
      subtitle="At least 6 characters."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
