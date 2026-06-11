-- Plan management RPCs (project-owned). MVP has no payment provider, so
-- "upgrade" simply flips the workspace to the Pro plan after the user confirms
-- in the UI. SECURITY INVOKER: the owner check is here; the tenants UPDATE runs
-- as the caller and passes the authorized_update_tenant isolation policy.

CREATE OR REPLACE FUNCTION api.tenant_upgrade(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role    text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM public.memberships
  WHERE tenant_id = p_tenant_id AND user_id = v_user_id;

  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can change the plan';
  END IF;

  UPDATE public.tenants
  SET plan = 'pro'
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object('id', p_tenant_id, 'plan', 'pro');
END;
$$;

GRANT EXECUTE ON FUNCTION api.tenant_upgrade(uuid) TO authenticated, service_role;

-- Rename a workspace (owners/admins). Used by onboarding to default the name
-- to the connected Supabase org. SECURITY INVOKER: the role check is here; the
-- tenants UPDATE passes the authorized_update_tenant isolation policy.
CREATE OR REPLACE FUNCTION api.tenant_rename(p_tenant_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role    text;
  v_name    text := trim(coalesce(p_name, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  SELECT role INTO v_role
  FROM public.memberships
  WHERE tenant_id = p_tenant_id AND user_id = v_user_id;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners or admins can rename the workspace';
  END IF;

  UPDATE public.tenants SET name = v_name WHERE id = p_tenant_id;

  RETURN jsonb_build_object('id', p_tenant_id, 'name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION api.tenant_rename(uuid, text) TO authenticated, service_role;
