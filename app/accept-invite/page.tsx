"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAcceptInvite } from "@/lib/auth";

/**
 * Workspace-invitation acceptance.
 *
 * Two URL shapes hit this route — same as the Vite mirror at
 * routes/accept-invite.tsx. See that file for the full reasoning.
 */
function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const code = searchParams?.get("code");

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
          onClick={() => router.push("/auth/sign-in")}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  const { loading, error } = useAcceptInvite({
    token,
    code: code ?? null,
    onAccepted: () => router.push("/protected"),
    onNeedsAuth: () => {
      const next = `/accept-invite?token=${token}`;
      router.push(`/auth/sign-in?next=${encodeURIComponent(next)}`);
    },
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
          onClick={() => router.push("/auth/sign-in")}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return null;
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
