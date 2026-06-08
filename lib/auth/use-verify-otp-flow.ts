"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import type { AuthEmailKind, VerifyResult } from "./types";

interface VerifyInput {
  email: string;
  token: string;
}

export function useVerifyOtpFlow(kind: AuthEmailKind) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: VerifyInput): Promise<VerifyResult | null> {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const sdkType = kind === "recovery" ? "recovery" : "email";

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: input.email,
        token: input.token,
        type: sdkType,
      });
      if (verifyError) throw verifyError;

      if (kind === "recovery") {
        return { kind: "recovery" };
      }

      if (data.session) {
        await supabase.auth.refreshSession();
        return { kind: "signed_in" };
      }
      return { kind: "needs_password_setup" };
    } catch (err) {
      setError(formatAuthError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, setError };
}
