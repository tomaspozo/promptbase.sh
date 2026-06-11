-- Member-safe read of the Supabase organization a workspace is connected to.
-- public.organizations RLS is owner-scoped, so a plain member can't read the
-- org row — but they should still SEE which org the workspace deploys into
-- (read-only; reconnect/disconnect stay owner-only in the UI/RPCs).
--
-- SECURITY DEFINER: verifies the caller is a member of the tenant, then returns
-- only the safe public fields of the linked org (never the Vault secret ids).

CREATE OR REPLACE FUNCTION api.organization_read_for_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_org_id  uuid;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.tenants WHERE id = p_tenant_id;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'supabase_org_id', o.supabase_org_id,
    'supabase_org_name', o.supabase_org_name
  )
  INTO v_result
  FROM public.organizations o
  WHERE o.id = v_org_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api.organization_read_for_tenant(uuid) TO authenticated, service_role;
