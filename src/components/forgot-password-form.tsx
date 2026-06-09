import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPasswordFlow } from "@/lib/auth";

/**
 * Forgot-password form. Delegates to `useResetPasswordFlow`. On success,
 * routes to /auth/check-inbox?type=recovery — where the user can paste
 * the OTP or click the email link to reach /update-password.
 */
export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const reset = useResetPasswordFlow();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await reset.submit({ email });
    if (ok) {
      navigate({
        to: "/auth/check-inbox",
        search: { type: "recovery", email },
      });
    }
  }

  return (
    <div className={className} {...props}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-[2px]"
            autoFocus
          />
        </div>

        {reset.error && (
          <p
            role="alert"
            className="border border-[color:var(--down)]/30 bg-[color:var(--down)]/5 px-3 py-2 font-mono text-xs text-[color:var(--down)]"
          >
            {reset.error}
          </p>
        )}

        <Button type="submit" disabled={reset.loading} className="h-11 w-full">
          {reset.loading ? "Sending…" : "Send reset email"}
        </Button>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
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
