import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { isAllowedFromClaims } from "@/lib/permissions";

/**
 * Auth gate (pathless layout). Unauthenticated users are sent to sign-in with a
 * `next` param. Authenticated-but-not-approved users (early-access waitlist) are
 * sent to /pending. `context.user` is the decoded JWT claims provided by the
 * root route's beforeLoad.
 */
export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/auth/sign-in",
        search: { next: location.href },
      });
    }
    if (!isAllowedFromClaims(context.user)) {
      throw redirect({ to: "/pending" });
    }
  },
  component: () => <Outlet />,
});
