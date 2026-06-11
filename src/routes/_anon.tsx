import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Anon-only pathless layout. Signed-in users are bounced to the dashboard so
 * they don't see the sign-in / sign-up screens. The pending-confirmation
 * screens (check-inbox) are reached without a session, so they pass through.
 */
export const Route = createFileRoute("/_anon")({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/app" });
    }
  },
  component: () => <Outlet />,
});
