/**
 * Kick off the Supabase OAuth connect/reconnect flow for a tenant. Builds the
 * authorize URL (public client id) with a CSRF nonce + the tenant in `state`,
 * then redirects. The callback (/oauth/supabase/callback) finishes the exchange.
 * Reconnecting re-mints the token — use it after changing OAuth scopes.
 */
export function startSupabaseConnect(tenantId: string): void {
  const clientId = import.meta.env.VITE_SB_OAUTH_CLIENT_ID as string;
  const nonce = crypto.randomUUID();
  sessionStorage.setItem("pb_oauth_nonce", nonce);
  const state = btoa(JSON.stringify({ t: tenantId, n: nonce }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const url = new URL("https://api.supabase.com/v1/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${window.location.origin}/oauth/supabase/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}
