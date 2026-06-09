import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/sign-up-form";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/_anon/auth/sign-up")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { email } = Route.useSearch();
  return (
    <AuthShell
      eyebrow="Create account"
      title="Get started in seconds."
      subtitle="One workspace per account. You can invite teammates after signup."
    >
      <SignUpForm defaultEmail={email} />
    </AuthShell>
  );
}
