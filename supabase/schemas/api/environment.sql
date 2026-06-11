-- Environment RPCs. Reads are scoped to the caller's ACTIVE tenant (the
-- tenant_id JWT claim, set by api.tenant_select). Creation + install happen in
-- the environment-install edge function (service_role), not here.

CREATE OR REPLACE FUNCTION api.environment_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public._auth_tenant_id();
  v_result jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant selected';
  END IF;

  PERFORM public.auth_verify_access('environment.read');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'supabase_project_ref', e.supabase_project_ref,
    'supabase_url', e.supabase_url,
    'is_default', e.is_default,
    'installed', e.installed,
    'promptbase_version', e.promptbase_version,
    'created_at', e.created_at
  ) ORDER BY e.created_at), '[]'::jsonb)
  INTO v_result
  FROM public.environments e
  WHERE e.tenant_id = v_tenant_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api.environment_list() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION api.environment_get(p_env_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public._auth_tenant_id();
  v_result jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant selected';
  END IF;

  PERFORM public.auth_verify_access('environment.read');

  SELECT jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'supabase_project_ref', e.supabase_project_ref,
    'supabase_url', e.supabase_url,
    'is_default', e.is_default,
    'installed', e.installed,
    'promptbase_version', e.promptbase_version,
    'created_at', e.created_at,
    'updated_at', e.updated_at
  )
  INTO v_result
  FROM public.environments e
  WHERE e.id = p_env_id AND e.tenant_id = v_tenant_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Environment not found';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api.environment_get(uuid) TO authenticated, service_role;
