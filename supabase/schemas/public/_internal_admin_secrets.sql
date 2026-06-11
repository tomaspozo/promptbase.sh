-- Vault secret write/read-by-id helpers (project-owned; _internal_admin.sql
-- stays @agentlink-managed, which provides read-by-name `_internal_admin_get_secret`).
--
-- `create` returns the Vault secret id to store on a table column
-- (organizations.oauth_*_secret_id, environments.secret_id); `read` fetches the
-- decrypted value by that id. service_role only — invoked by platform edge
-- functions (supabase-oauth-callback, environment-install, prompts-proxy) via
-- supabaseAdmin.rpc().

CREATE OR REPLACE FUNCTION public._internal_admin_create_secret(secret text, name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN vault.create_secret(secret, name);
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_create_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._internal_admin_create_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public._internal_admin_read_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = secret_id
  LIMIT 1;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_read_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._internal_admin_read_secret(uuid) TO service_role;
