"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";

interface ResetPasswordInput {
  email: string;
  redirectTo?: string | null;
}

export function useResetPasswordFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(input: ResetPasswordInput): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        input.redirectTo === undefined
          ? `${window.location.origin}/auth/confirm`
          : input.redirectTo;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        input.email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (resetError) throw resetError;

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
