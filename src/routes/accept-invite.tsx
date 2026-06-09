import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAcceptInvite } from "@/lib/auth";

/**
 * Workspace-invitation acceptance. Two URL shapes hit this route:
 *  - PKCE new user: ?token=…&code=… (exchange, then invitation_accept)
 *  - Existing user: ?token=… (must already have a session, else → sign-in)
 */
export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token, code } = Route.useSearch();
  const navigate = useNavigate();

  if (!token) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Missing token."
        subtitle="The invitation link is incomplete. Ask your inviter to send it again."
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => navigate({ to: "/auth/sign-in" })}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return <AcceptInviteFlow token={token} code={code ?? null} />;
}

function AcceptInviteFlow({
  token,
  code,
}: {
  token: string;
  code: string | null;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const { loading, error } = useAcceptInvite({
    token,
    code,
    onAccepted: async () => {
      await router.invalidate();
      navigate({ to: "/dashboard" });
    },
    onNeedsAuth: () =>
      navigate({
        to: "/auth/sign-in",
        search: { next: `/accept-invite?token=${token}` },
      }),
  });

  if (loading) {
    return <AuthShell eyebrow="Joining workspace" title="Just a moment…" />;
  }

  if (error) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Couldn't accept this invitation."
        subtitle={error}
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => navigate({ to: "/auth/sign-in" })}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return null;
}
