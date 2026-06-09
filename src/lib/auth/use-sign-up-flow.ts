import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import type { SignUpResult } from "./types";

interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
  organizationName?: string;
  emailRedirectTo?: string | null;
}

/**
 * Wraps `supabase.auth.signUp` with the canonical post-signup logic.
 * See the Vite mirror at template/vite/src/lib/auth/use-sign-up-flow.ts
 * for the full reasoning — both implementations are kept in sync.
 */
export function useSignUpFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: SignUpInput): Promise<SignUpResult | null> {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        input.emailRedirectTo === undefined
          ? `${window.location.origin}/auth/confirm`
          : input.emailRedirectTo;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          data: {
            display_name: input.displayName?.trim() ?? "",
            organization_name: input.organizationName?.trim() ?? "",
          },
        },
      });
      if (signUpError) throw signUpError;

      if (!data.session) {
        return { kind: "pending", email: input.email };
      }

      await supabase.auth.refreshSession();
      return { kind: "authenticated" };
    } catch (err) {
      setError(formatAuthError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, setError };
}
