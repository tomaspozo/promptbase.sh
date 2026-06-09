import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";

interface UseAcceptInviteOptions {
  token: string;
  code: string | null;
  onAccepted: (tenant: { id: string; name: string; slug: string; role: string }) => void;
  onNeedsAuth: () => void;
}

/**
 * Workspace-invitation acceptance with auth-lock guard. See the Vite mirror
 * at template/vite/src/lib/auth/use-accept-invite.ts for the full reasoning
 * about both URL shapes (PKCE-new-user vs. existing-user) and the race
 * condition between onAuthStateChange and the explicit chain.
 */
export function useAcceptInvite({
  token,
  code,
  onAccepted,
  onNeedsAuth,
}: UseAcceptInviteOptions) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (handledRef.current || !mounted) return;
      handledRef.current = true;

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: tenant, error: rpcError } = await supabase.rpc(
          "invitation_accept",
          { p_token: token },
        );
        if (rpcError) throw rpcError;

        await new Promise((r) => setTimeout(r, 0));
        await supabase.auth.refreshSession();

        if (mounted)
          onAccepted(tenant as { id: string; name: string; slug: string; role: string });
      } catch (err) {
        if (mounted) setError(formatAuthError(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (code) {
      void run();
      return () => {
        mounted = false;
      };
    }

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        void run();
      } else {
        setLoading(false);
        onNeedsAuth();
      }
    });

    return () => {
      mounted = false;
    };
  }, [token, code]);

  return { loading, error, setError };
}
