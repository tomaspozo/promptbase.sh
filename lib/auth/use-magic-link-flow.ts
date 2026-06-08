"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";

interface MagicLinkInput {
  email: string;
  emailRedirectTo?: string | null;
  shouldCreateUser?: boolean;
}

export function useMagicLinkFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(input: MagicLinkInput): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        input.emailRedirectTo === undefined
          ? `${window.location.origin}/auth/confirm`
          : input.emailRedirectTo;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          shouldCreateUser: input.shouldCreateUser ?? true,
        },
      });
      if (otpError) throw otpError;

      setSentTo(input.email);
      return true;
    } catch (err) {
      setError(formatAuthError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, sentTo, setError };
}
