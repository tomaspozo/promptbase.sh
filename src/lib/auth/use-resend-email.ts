import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import type { AuthEmailKind } from "./types";

interface ResendOptions {
  type: AuthEmailKind;
  email: string;
  cooldownSeconds?: number;
  emailRedirectTo?: string | null;
}

/**
 * Type-aware resend wrapper. See the Vite mirror at
 * template/vite/src/lib/auth/use-resend-email.ts for the full reasoning
 * about which Supabase API each kind delegates to.
 */
export function useResendEmail({
  type,
  email,
  cooldownSeconds = 30,
  emailRedirectTo,
}: ResendOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (cooldownLeft <= 0) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current === null) {
      intervalRef.current = window.setInterval(() => {
        setCooldownLeft((s) => Math.max(0, s - 1));
      }, 1000);
    }
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cooldownLeft]);

  async function resend(): Promise<boolean> {
    if (cooldownLeft > 0 || loading) return false;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        emailRedirectTo === undefined
          ? `${window.location.origin}/auth/confirm`
          : emailRedirectTo;

      switch (type) {
        case "signup": {
          const { error: e } = await supabase.auth.resend({
            type: "signup",
            email,
            ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
          });
          if (e) throw e;
          break;
        }
        case "magiclink": {
          const { error: e } = await supabase.auth.signInWithOtp({
            email,
            options: {
              ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
              shouldCreateUser: true,
            },
          });
          if (e) throw e;
          break;
        }
        case "recovery": {
          const { error: e } = await supabase.auth.resetPasswordForEmail(
            email,
            redirectTo ? { redirectTo } : undefined,
          );
          if (e) throw e;
          break;
        }
        case "invite": {
          throw new Error(
            "Workspace invitations are resent via api.invitation_resend, " +
              "not the auth resend hook. Use the /settings/members page.",
          );
        }
      }

      setCooldownLeft(cooldownSeconds);
      return true;
    } catch (err) {
      setError(formatAuthError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { resend, loading, error, cooldownLeft, setError };
}
