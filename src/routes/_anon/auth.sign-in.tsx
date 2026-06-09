import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/login-form";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/_anon/auth/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: SignInPage,
});

function SignInPage() {
  const { next } = Route.useSearch();
  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      subtitle="Sign in with your email and password, or request a one-time link."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
