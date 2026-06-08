import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthShell } from "@/components/auth-shell";

/**
 * /update-password — recovery destination AND in-app password change.
 *
 * The proxy middleware whitelists /update-password so it's reachable
 * without a session-pinned tenant claim — fine, because at this point
 * the user has either:
 *   - just exchanged a recovery code (single-purpose session, no tenant)
 *   - is already signed in for a routine password change
 * Both paths legally call `auth.updateUser({ password })`.
 */
export default function UpdatePasswordPage() {
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
