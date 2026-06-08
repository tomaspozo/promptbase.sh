import { SignUpForm } from "@/components/sign-up-form";
import { AuthShell } from "@/components/auth-shell";

export default function SignUpPage() {
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
