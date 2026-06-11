-- Service-role-only RPCs for the platform edge functions (OAuth / install /
-- proxy). Mirror api._admin_enqueue_task: SECURITY DEFINER, REVOKE from
-- authenticated, GRANT to service_role only.
--
-- These hold the privileged DB + Vault logic so the edge functions stay thin
-- (external HTTP only). Edge functions reach the platform DB ONLY through these
-- — PostgREST/service_role can't touch public.* tables or Vault directly because
-- only the `api` schema is exposed.

-- Connect a Supabase org to a tenant after a successful OAuth handshake. Stores
-- the access + refresh tokens in Vault, upserts the organization (enforcing one
-- platform org per Supabase org), and links the tenant.
CREATE OR REPLACE FUNCTION api._admin_organization_connect(
  p_user_id uuid,
  p_tenant_id uuid,
  p_supabase_org_id text,
  p_supabase_org_name text,
  p_access_token text,
  p_refresh_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role           text;
  v_org_id         uuid;
  v_existing_owner uuid;
  v_token_secret   uuid;
  v_refresh_secret uuid;
BEGIN
  -- Caller must be owner/admin of the tenant.
  SELECT role INTO v_role FROM public.memberships
   WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized for this tenant' USING ERRCODE = '42501';
  END IF;

  -- One platform organization per Supabase org.
  SELECT id, owner_id INTO v_org_id, v_existing_owner
    FROM public.organizations WHERE supabase_org_id = p_supabase_org_id;
  IF v_org_id IS NOT NULL AND v_existing_owner <> p_user_id THEN
    RAISE EXCEPTION 'This Supabase organization is already connected by another account'
      USING ERRCODE = '23505';
  END IF;

  v_token_secret := vault.create_secret(
    p_access_token, 'org_' || p_supabase_org_id || '_access_' || gen_random_uuid());
  v_refresh_secret := vault.create_secret(
    p_refresh_token, 'org_' || p_supabase_org_id || '_refresh_' || gen_random_uuid());

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations
      (owner_id, supabase_org_id, supabase_org_name, oauth_token_secret_id, oauth_refresh_secret_id)
    VALUES (p_user_id, p_supabase_org_id, p_supabase_org_name, v_token_secret, v_refresh_secret)
    RETURNING id INTO v_org_id;
  ELSE
    UPDATE public.organizations
       SET supabase_org_name      = p_supabase_org_name,
           oauth_token_secret_id   = v_token_secret,
           oauth_refresh_secret_id = v_refresh_secret,
           updated_at = now()
     WHERE id = v_org_id;
  END IF;

  UPDATE public.tenants SET organization_id = v_org_id WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'id', v_org_id,
    'supabase_org_id', p_supabase_org_id,
    'name', p_supabase_org_name
  );
END;
$$;

REVOKE ALL ON FUNCTION api._admin_organization_connect(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_organization_connect(uuid, uuid, text, text, text, text)
  TO service_role;

-- Return a decrypted org access token (for Management API calls), after checking
-- the user owns the org. Used by management-projects / environment-install.
CREATE OR REPLACE FUNCTION api._admin_organization_token(p_user_id uuid, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
  v_token     text;
BEGIN
  SELECT oauth_token_secret_id INTO v_secret_id
    FROM public.organizations
   WHERE id = p_org_id AND owner_id = p_user_id;
  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = '42501';
  END IF;
  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets WHERE id = v_secret_id;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION api._admin_organization_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_organization_token(uuid, uuid) TO service_role;

-- Return the OAuth token for the org a tenant is linked to, after checking the
-- caller is owner/admin of the tenant and the tenant is linked. Used by
-- environment-install (which has a tenant_id, not an org_id).
CREATE OR REPLACE FUNCTION api._admin_tenant_org_token(p_user_id uuid, p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_org_id    uuid;
  v_secret_id uuid;
  v_token     text;
BEGIN
  SELECT role INTO v_role FROM public.memberships
   WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized for this tenant' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id FROM public.tenants WHERE id = p_tenant_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'This workspace is not connected to a Supabase organization'
      USING ERRCODE = '42501';
  END IF;

  SELECT oauth_token_secret_id INTO v_secret_id
    FROM public.organizations WHERE id = v_org_id;
  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets WHERE id = v_secret_id;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION api._admin_tenant_org_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_tenant_org_token(uuid, uuid) TO service_role;

-- Persist an installed environment: store the project's edge-function secret in
-- Vault and upsert the environments row (re-install updates it). Checks the
-- caller is owner/admin of the tenant.
DROP FUNCTION IF EXISTS api._admin_environment_create(uuid, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION api._admin_environment_create(
  p_user_id uuid,
  p_tenant_id uuid,
  p_name text,
  p_project_ref text,
  p_url text,
  p_secret text,
  p_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role         text;
  v_owner_tenant uuid;
  v_secret_id    uuid;
  v_env          record;
BEGIN
  SELECT role INTO v_role FROM public.memberships
   WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized for this tenant' USING ERRCODE = '42501';
  END IF;

  -- One environment per Supabase project, globally. Re-install (same tenant)
  -- updates in place; another tenant claiming the same project is rejected.
  SELECT tenant_id INTO v_owner_tenant FROM public.environments
   WHERE supabase_project_ref = p_project_ref;
  IF v_owner_tenant IS NOT NULL AND v_owner_tenant <> p_tenant_id THEN
    RAISE EXCEPTION 'This Supabase project is already connected to another workspace'
      USING ERRCODE = '23505';
  END IF;

  v_secret_id := vault.create_secret(
    p_secret, 'env_' || p_project_ref || '_secret_' || gen_random_uuid());

  INSERT INTO public.environments
    (tenant_id, name, supabase_project_ref, supabase_url, secret_id, installed, promptbase_version)
  VALUES (p_tenant_id, p_name, p_project_ref, p_url, v_secret_id, true, p_version)
  ON CONFLICT (supabase_project_ref) DO UPDATE
    SET name               = EXCLUDED.name,
        supabase_url       = EXCLUDED.supabase_url,
        secret_id          = EXCLUDED.secret_id,
        installed          = true,
        promptbase_version = EXCLUDED.promptbase_version,
        updated_at         = now()
  RETURNING * INTO v_env;

  RETURN jsonb_build_object(
    'id', v_env.id,
    'name', v_env.name,
    'supabase_project_ref', v_env.supabase_project_ref,
    'supabase_url', v_env.supabase_url,
    'installed', v_env.installed,
    'promptbase_version', v_env.promptbase_version
  );
END;
$$;

REVOKE ALL ON FUNCTION api._admin_environment_create(uuid, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_environment_create(uuid, uuid, text, text, text, text, text)
  TO service_role;

-- Return an environment's project URL + decrypted secret key, after checking the
-- caller is a member of the env's tenant. Used by prompts-proxy to forward CRUD
-- to the env's promptbase-manage function (the browser never sees the secret).
CREATE OR REPLACE FUNCTION api._admin_environment_proxy(p_user_id uuid, p_env_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_url       text;
  v_secret_id uuid;
  v_secret    text;
BEGIN
  SELECT tenant_id, supabase_url, secret_id
    INTO v_tenant_id, v_url, v_secret_id
    FROM public.environments WHERE id = p_env_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Environment not found' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
     WHERE tenant_id = v_tenant_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for this environment' USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE id = v_secret_id;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Environment is not installed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('url', v_url, 'secret', v_secret);
END;
$$;

REVOKE ALL ON FUNCTION api._admin_environment_proxy(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_environment_proxy(uuid, uuid) TO service_role;
