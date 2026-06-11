import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { CheckInboxCard } from "@/components/check-inbox-card";
import type { AuthEmailKind, VerifyResult } from "@/lib/auth";

const VALID_TYPES = ["signup", "magiclink", "recovery"] as const;

export const Route = createFileRoute("/_anon/auth/check-inbox")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search.type === "string" ? search.type : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  beforeLoad: ({ search }) => {
    // Direct hit without context — bounce to sign-in.
    if (!search.email) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: CheckInboxPage,
});

function CheckInboxPage() {
  const { type: rawType, email } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const type = (
    VALID_TYPES.includes(rawType as never) ? rawType : "signup"
  ) as Exclude<AuthEmailKind, "invite">;

  async function onVerified(result: VerifyResult) {
    // OTP verification set a session cookie — refresh root context first.
    await router.invalidate();
    if (result.kind === "recovery") {
      navigate({ to: "/update-password" });
      return;
    }
    navigate({ to: "/app" });
  }

  function onBack() {
    if (type === "signup") navigate({ to: "/auth/sign-up" });
    else if (type === "recovery") navigate({ to: "/auth/forgot-password" });
    else navigate({ to: "/auth/sign-in" });
  }

  return (
    <CheckInboxCard
      type={type}
      email={email!}
      onVerified={onVerified}
      onBack={onBack}
    />
  );
}
