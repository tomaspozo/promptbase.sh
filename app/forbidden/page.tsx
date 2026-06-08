import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 403 page. Reached when a server `requirePermission(...)` guard denies access.
 * Stays auth-gated (an unauthenticated user hitting /forbidden is still bounced
 * to sign-in by the proxy middleware allowlist).
 */
export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 rounded-2xl bg-muted p-4">
        <ShieldAlert className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-medium tracking-[-0.02em]">
        You don&apos;t have access
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Your role in this workspace doesn&apos;t grant permission to view this
        page. Ask an admin to update your role, or switch to a workspace where
        you have access.
      </p>
      <Button asChild className="mt-6">
        <Link href="/protected">Back to dashboard</Link>
      </Button>
    </div>
  );
}
