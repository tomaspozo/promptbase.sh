"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckInboxCard } from "@/components/check-inbox-card";
import type { AuthEmailKind, VerifyResult } from "@/lib/auth";

const VALID_TYPES: ReadonlyArray<Exclude<AuthEmailKind, "invite">> = [
  "signup",
  "magiclink",
  "recovery",
];

function CheckInboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawType = searchParams?.get("type") ?? "";
  const email = searchParams?.get("email") ?? "";

  const type = (
    VALID_TYPES.includes(rawType as never) ? rawType : "signup"
  ) as Exclude<AuthEmailKind, "invite">;

  function onVerified(result: VerifyResult) {
    if (result.kind === "recovery") {
      router.push("/update-password");
      return;
    }
    router.push("/protected");
  }

  function onBack() {
    if (type === "signup") router.push("/auth/sign-up");
    else if (type === "recovery") router.push("/auth/forgot-password");
    else router.push("/auth/sign-in");
  }

  if (!email) {
    // Direct hit without context — bounce to sign-in.
    router.push("/auth/sign-in");
    return null;
  }

  return (
    <CheckInboxCard
      type={type}
      email={email}
      onVerified={onVerified}
      onBack={onBack}
    />
  );
}

export default function CheckInboxPage() {
  return (
    <Suspense fallback={null}>
      <CheckInboxInner />
    </Suspense>
  );
}
