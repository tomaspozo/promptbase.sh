import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Auth gate (pathless layout). Replaces the Next.js middleware redirect:
 * unauthenticated users are sent to sign-in with a `next` param so they return
 * here after signing in. `context.user` is the decoded JWT claims provided by
 * the root route's beforeLoad.
 */
export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/auth/sign-in",
        search: { next: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
