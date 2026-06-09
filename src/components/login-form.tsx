import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignInFlow, useMagicLinkFlow } from "@/lib/auth";

type Mode = "password" | "magic_link";

/**
 * Sign-in form with magic-link toggle. Uses the shared hooks layer so the
 * `!data.session` and `refreshSession` logic stays consistent with the
 * sign-up flow.
 *
 * On success: navigates to the `next` prop if present, else /dashboard.
 * For magic-link mode: navigates to /auth/check-inbox?type=magiclink&email=…
 */
export function LoginForm({
  next,
  className,
  ...props
}: { next?: string } & React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const passwordFlow = useSignInFlow();
  const magicLinkFlow = useMagicLinkFlow();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "password") {
      const ok = await passwordFlow.submit({ email, password });
      if (ok) {
        // Refresh root context (reads the new session cookie) before entering
        // a gated route, otherwise the _auth gate sees a stale null user.
        await router.invalidate();
        navigate({ to: next ?? "/dashboard" });
      }
    } else {
      const ok = await magicLinkFlow.submit({ email });
      if (ok) {
        navigate({
          to: "/auth/check-inbox",
          search: { type: "magiclink", email },
        });
      }
    }
  }

  const loading = passwordFlow.loading || magicLinkFlow.loading;
  const error = passwordFlow.error ?? magicLinkFlow.error;

  return (
    <div className={className} {...props}>
      <form onSubmit={onSubmit} className="space-y-4">
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

        {mode === "password" && (
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-md"
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="border border-[color:var(--down)]/30 bg-[color:var(--down)]/5 px-3 py-2 font-mono text-xs text-[color:var(--down)]"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading
            ? mode === "password"
              ? "Signing in…"
              : "Sending link…"
            : mode === "password"
              ? "Sign in"
              : "Send sign-in link"}
        </Button>

        <div className="flex items-center justify-between pt-2 text-sm">
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4"
            onClick={() => {
              setMode((m) => (m === "password" ? "magic_link" : "password"));
              passwordFlow.setError?.(null);
              magicLinkFlow.setError?.(null);
            }}
          >
            {mode === "password"
              ? "Send me a sign-in link"
              : "Use a password instead"}
          </button>
          {mode === "password" && (
            <Link
              to="/auth/forgot-password"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Forgot password?
            </Link>
          )}
        </div>

        <p className="pt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            to="/auth/sign-up"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
