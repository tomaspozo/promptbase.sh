"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useResendEmail,
  useVerifyOtpFlow,
  type AuthEmailKind,
  type VerifyResult,
} from "@/lib/auth";

interface CheckInboxCardProps {
  type: Exclude<AuthEmailKind, "invite">;
  email: string;
  onVerified: (result: VerifyResult) => void;
  onBack: () => void;
}

const COPY: Record<
  Exclude<AuthEmailKind, "invite">,
  { eyebrow: string; title: string; tail: string; cta: string }
> = {
  signup: {
    eyebrow: "Confirm email",
    title: "Check your inbox",
    tail: "Enter the 8-digit code below to finish creating your account, or click the link in the email.",
    cta: "Verify and continue",
  },
  magiclink: {
    eyebrow: "Sign in",
    title: "Check your inbox",
    tail: "Enter the 8-digit code below to sign in, or click the link in the email.",
    cta: "Verify and sign in",
  },
  recovery: {
    eyebrow: "Reset password",
    title: "Check your inbox",
    tail: "Enter the 8-digit code below to set a new password, or click the link in the email.",
    cta: "Verify and continue",
  },
};

/**
 * Shared "Check your inbox" UI — Next.js mirror of the Vite component.
 * The OTP input is always visible (cross-device PKCE escape hatch).
 * See template/vite/src/components/check-inbox-card.tsx for the full
 * reasoning; both components stay in sync.
 */
export function CheckInboxCard({
  type,
  email,
  onVerified,
  onBack,
}: CheckInboxCardProps) {
  const copy = COPY[type];
  const [code, setCode] = useState("");

  const verify = useVerifyOtpFlow(type);
  const resender = useResendEmail({ type, email });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== 8) {
      verify.setError("Enter the 8-digit code from your email");
      return;
    }
    const result = await verify.submit({ email, token });
    if (result) onVerified(result);
  }

  const error = verify.error ?? resender.error;

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <div className="rule flex items-baseline justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium hover:text-muted-foreground"
          >
            ← Back
          </button>
          <p className="label">{copy.eyebrow}</p>
        </div>

        <div className="mt-12 animate-rise">
          <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent an email to{" "}
            <span className="font-mono text-foreground">{email}</span>.{" "}
            {copy.tail}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={10}
                placeholder="12345678"
                value={code}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setCode(next);
                  if (verify.error) verify.setError(null);
                }}
                className="h-12 rounded-[2px] text-center font-mono text-lg tracking-[0.35em]"
                autoFocus
              />
            </div>

            {error && (
              <p
                role="alert"
                className="border border-[color:var(--down)]/30 bg-[color:var(--down)]/5 px-3 py-2 font-mono text-xs text-[color:var(--down)]"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={verify.loading || code.length !== 8}
              className="h-11 w-full"
            >
              {verify.loading ? "Verifying…" : copy.cta}
            </Button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <button
                type="button"
                onClick={() => void resender.resend()}
                disabled={resender.loading || resender.cooldownLeft > 0}
                className="font-medium text-foreground underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
              >
                {resender.loading
                  ? "Resending…"
                  : resender.cooldownLeft > 0
                    ? `Resend in ${resender.cooldownLeft}s`
                    : "Resend email"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
