import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/sign-up-form";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/_anon/auth/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="Get started in seconds."
      subtitle="One workspace per account. You can invite teammates after signup."
    >
      <SignUpForm />
    </AuthShell>
  );
}
