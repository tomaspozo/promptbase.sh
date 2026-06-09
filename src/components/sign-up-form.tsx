import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignUpFlow } from "@/lib/auth";

/**
 * Sign-up form. Delegates the `!data.session` branch and post-signup
 * `refreshSession()` to `useSignUpFlow`. On a `pending` result, routes
 * to /auth/check-inbox?type=signup&email=… (where the user can paste
 * the OTP, click the email link, or resend).
 */
export function SignUpForm({
  defaultEmail,
  className,
  ...props
}: { defaultEmail?: string } & React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const signUp = useSignUpFlow();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await signUp.submit({
      email,
      password,
      displayName,
      organizationName,
    });
    if (!result) return;
    if (result.kind === "pending") {
      navigate({
        to: "/auth/check-inbox",
        search: { type: "signup", email: result.email },
      });
    } else {
      await router.invalidate();
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className={className} {...props}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="display-name">Your name</Label>
          <Input
            id="display-name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            required
            minLength={1}
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="organization-name">Workspace name</Label>
          <Input
            id="organization-name"
            type="text"
            autoComplete="organization"
            placeholder="Acme, Inc."
            required
            minLength={1}
            maxLength={100}
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>

        {signUp.error && (
          <p
            role="alert"
            className="border border-[color:var(--down)]/30 bg-[color:var(--down)]/5 px-3 py-2 font-mono text-xs text-[color:var(--down)]"
          >
            {signUp.error}
          </p>
        )}

        <Button type="submit" disabled={signUp.loading} className="h-11 w-full">
          {signUp.loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
