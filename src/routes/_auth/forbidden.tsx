import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeading } from "@/components/page-heading";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 403 page. Reached when a route permission guard denies access. Sits under
 * _auth, so an unauthenticated user is bounced to sign-in first.
 */
export const Route = createFileRoute("/_auth/forbidden")({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <div className="mb-5 grid size-12 place-items-center rounded-xl bg-[color:var(--down)]/10 text-[color:var(--down)]">
        <ShieldAlert className="size-6" />
      </div>
      <PageHeading>You don&apos;t have access</PageHeading>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Your role in this workspace doesn&apos;t grant permission to view this
        page. Ask an admin to update your role, or switch to a workspace where
        you have access.
      </p>
      <Button asChild className="mt-6">
        <Link to="/app">Back to app</Link>
      </Button>
    </div>
  );
}
