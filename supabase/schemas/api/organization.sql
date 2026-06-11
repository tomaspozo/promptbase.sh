-- Organization RPCs. Org rows are created by the supabase-oauth-callback edge
-- function (service_role); these are the client-facing reads. RLS already scopes
-- to the owner; the WHERE is belt-and-suspenders.

CREATE OR REPLACE FUNCTION api.organization_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'supabase_org_id', o.supabase_org_id,
    'supabase_org_name', o.supabase_org_name,
    'created_at', o.created_at
  ) ORDER BY o.created_at), '[]'::jsonb)
  INTO v_result
  FROM public.organizations o
  WHERE o.owner_id = v_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api.organization_list() TO authenticated, service_role;
