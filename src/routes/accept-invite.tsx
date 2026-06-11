import { useEffect, useState } from "react";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { CheckCircle2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import { useSignUpFlow, useSignInFlow } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/loading";

/**
 * Workspace-invitation acceptance — self-contained, no forced sign-in bounce.
 * Shows the invite context (via anon invitation_preview) and lets the visitor
 * continue inline: create an account (email locked to the invite) or sign in.
 *
 * URL shapes that land here:
 *  - ?token=…            → logged-out visitor: preview + inline form
 *  - ?token=… + session  → existing user: auto-accept
 *  - ?token=…&code=…     → returning from the signup-confirmation email
 *                          (emailRedirectTo points back here) → exchange + accept
 */
export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: AcceptInvitePage,
});

interface Preview {
  valid: boolean;
  reason?: string; // not_found | expired | accepted
  tenant_name?: string;
  tenant_slug?: string;
  role?: string;
  invited_email?: string;
  invited_by_name?: string;
}

type Phase =
  | "loading"
  | "accepting"
  | "form"
  | "pending"
  | "accepted"
  | "error"
  | "missing"
  | "wrong_account";

function AcceptInvitePage() {
  const { token, code } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "signin">("create");

  // Create-account form
  const signUp = useSignUpFlow();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  // Sign-in form
  const signIn = useSignInFlow();
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  async function accept() {
    setPhase("accepting");
    setError(null);
    const supabase = createClient();
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) {
        setError(formatAuthError(exErr));
        setPhase("error");
        return;
      }
    }
    const { data, error: rpcErr } = await supabase.rpc("invitation_accept", {
      p_token: token,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setPhase("error");
      return;
    }
    await supabase.auth.refreshSession();
    await router.invalidate();
    const tenant = data as unknown as { slug: string };
    navigate({ to: "/$slug", params: { slug: tenant.slug } });
  }

  useEffect(() => {
    if (!token) {
      setPhase("missing");
      return;
    }
    async function init() {
      const supabase = createClient();
      const { data: pv } = await supabase.rpc("invitation_preview", {
        p_token: token,
      });
      const p = (pv as unknown as Preview) ?? { valid: false };
      setPreview(p);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session);

      if (!p.valid) {
        setPhase(p.reason === "accepted" ? "accepted" : "error");
        return;
      }
      // Returning from the confirmation email (code) → exchange + accept.
      // The signup email was locked to the invite, so the exchanged session
      // is guaranteed to be the invited account.
      if (code) {
        void accept();
        return;
      }
      // Existing session: only auto-accept if it's the INVITED account.
      // invitation_accept joins auth.uid() by token alone — a mismatched
      // signed-in user would otherwise be silently joined to the workspace
      // (and the invite burned). Guard it.
      if (session) {
        if (session.user.email === p.invited_email) {
          void accept();
        } else {
          setSignedInEmail(session.user.email ?? "(unknown)");
          setPhase("wrong_account");
        }
        return;
      }
      setSigninEmail(p.invited_email ?? "");
      setPhase("form");
    }
    void init();
  }, [token]);

  // ---- terminal / transitional states ----

  if (phase === "missing") {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Missing token"
        subtitle="The invitation link is incomplete. Ask your inviter to send it again."
      >
        <Button
          variant="outline"
          className="h-10 w-full"
          onClick={() => navigate({ to: "/auth/sign-in" })}
        >
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (phase === "loading" || phase === "accepting") {
    return (
      <AuthShell
        eyebrow="Invitation"
        title={phase === "accepting" ? "Joining workspace…" : "Just a moment…"}
      >
        <Loading />
      </AuthShell>
    );
  }

  if (phase === "error") {
    return (
      <AuthShell
        eyebrow="Invitation"
        title={
          preview?.reason === "expired"
            ? "This invitation expired"
            : preview && !preview.valid
              ? "Invitation not found"
              : "Couldn't accept this invitation"
        }
        subtitle={
          error ??
          (preview?.reason === "expired"
            ? "Ask your inviter to send a fresh invitation."
            : "This invitation link is invalid. Ask your inviter to send it again.")
        }
      >
        <Button
          variant="outline"
          className="h-10 w-full"
          onClick={() => navigate({ to: "/auth/sign-in" })}
        >
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (phase === "accepted") {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Already accepted"
        subtitle="This invitation has already been used."
      >
        {hasSession && preview?.tenant_slug ? (
          <Button
            className="h-10 w-full"
            onClick={() =>
              navigate({
                to: "/$slug",
                params: { slug: preview.tenant_slug! },
              })
            }
          >
            Continue to {preview.tenant_name}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-10 w-full"
            onClick={() => navigate({ to: "/auth/sign-in" })}
          >
            Sign in to your account
          </Button>
        )}
      </AuthShell>
    );
  }

  if (phase === "wrong_account") {
    return (
      <AuthShell
        eyebrow="Wrong account"
        title="You're signed in as a different user"
        subtitle={
          <>
            This invitation was sent to{" "}
            <strong>{preview?.invited_email}</strong>, but you're signed in as{" "}
            <strong>{signedInEmail}</strong>. Sign out to accept it as the
            invited address.
          </>
        }
      >
        <Button
          className="h-10 w-full"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            setSignedInEmail(null);
            setHasSession(false);
            setSigninEmail(preview?.invited_email ?? "");
            setMode("create");
            setPhase("form");
          }}
        >
          Sign out and continue
        </Button>
      </AuthShell>
    );
  }

  if (phase === "pending") {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Check your inbox"
        subtitle={
          <>
            We sent a confirmation link to{" "}
            <strong>{preview?.invited_email}</strong>. Click it to finish joining{" "}
            <strong>{preview?.tenant_name}</strong>.
          </>
        }
      >
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <MailCheck className="size-5 shrink-0 text-primary" />
          The link brings you right back here and joins the workspace
          automatically.
        </div>
      </AuthShell>
    );
  }

  // ---- phase === "form": valid invite, no session ----
  const role = preview?.role ?? "member";
  return (
    <AuthShell
      eyebrow="Invitation"
      title={`Join ${preview?.tenant_name ?? "the workspace"}`}
      subtitle={
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          {preview?.invited_by_name
            ? `${preview.invited_by_name} invited you`
            : "You're invited"}{" "}
          as <strong className="text-foreground">{role}</strong>.
        </span>
      }
    >
      {mode === "create" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await signUp.submit({
              email: preview?.invited_email ?? "",
              password,
              displayName: name,
              emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
            });
            if (!res) return;
            if (res.kind === "pending") setPhase("pending");
            else void accept();
          }}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-md"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={preview?.invited_email ?? ""}
              readOnly
              className="h-10 rounded-md bg-muted/50 text-muted-foreground"
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
              className="h-10 rounded-md"
            />
          </div>

          {signUp.error && (
            <p role="alert" className="callout-error">
              {signUp.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={signUp.loading}
            className="h-10 w-full"
          >
            {signUp.loading ? "Creating account…" : "Create account & join"}
          </Button>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </button>
          </p>
        </form>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await signIn.submit({
              email: signinEmail,
              password: signinPassword,
            });
            if (ok) void accept();
          }}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
              className="h-10 rounded-md"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={signinPassword}
              onChange={(e) => setSigninPassword(e.target.value)}
              className="h-10 rounded-md"
            />
          </div>

          {signIn.error && (
            <p role="alert" className="callout-error">
              {signIn.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={signIn.loading}
            className="h-10 w-full"
          >
            {signIn.loading ? "Signing in…" : "Sign in & join"}
          </Button>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <button
              type="button"
              onClick={() => setMode("create")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Create one
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
