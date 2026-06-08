-- @agentlink _auth_tenant_id
-- @type function
-- @summary Extracts tenant_id from the current user's JWT app_metadata
-- @description Reads tenant_id from auth.jwt()->'app_metadata' and returns it as uuid.
--   Used in RLS policies to scope queries to the current tenant. Returns NULL if no
--   tenant is selected.
-- @signature _auth_tenant_id()
-- @returns uuid
-- @security SECURITY INVOKER — runs as the calling user
-- @related tenants, memberships, _auth_tenant_role
CREATE OR REPLACE FUNCTION public._auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ((auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
$$;

-- @agentlink _auth_tenant_role
-- @type function
-- @summary Extracts tenant_role from the current user's JWT app_metadata
-- @description Reads tenant_role from auth.jwt()->'app_metadata' and returns it as text.
--   Possible values: 'owner', 'admin', 'member', 'viewer'. Returns NULL if no tenant
--   is selected.
-- @signature _auth_tenant_role()
-- @returns text
-- @security SECURITY INVOKER — runs as the calling user
-- @related tenants, memberships, _auth_tenant_id, _auth_has_role
CREATE OR REPLACE FUNCTION public._auth_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'tenant_role');
$$;

-- @agentlink _auth_has_role
-- @type function
-- @summary Checks if the current user's tenant role meets a minimum level
-- @description Looks up the user's current tenant_role and the requested minimum
--   role in public.roles, comparing their `rank` columns. Returns true if the
--   user's rank is >= the requested minimum. The hierarchy is data — change rank
--   values (or insert a new role row) to reshape it without code edits. Prefer
--   _auth_has_permission for fine-grained checks; use _auth_has_role only when
--   you genuinely want a hierarchy (e.g. "any role at admin or above").
--   LANGUAGE sql STABLE so the planner can inline this inside RLS predicates.
-- @signature _auth_has_role(p_minimum_role text)
-- @returns boolean
-- @security SECURITY INVOKER — runs as the calling user
-- @related _auth_tenant_role, _auth_has_permission, roles
CREATE OR REPLACE FUNCTION public._auth_has_role(p_minimum_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT rank FROM public.roles WHERE name = public._auth_tenant_role())
      >=
    (SELECT rank FROM public.roles WHERE name = p_minimum_role),
    false
  );
$$;

-- @agentlink _auth_is_tenant_member
-- @type function
-- @summary Checks if the current user is a member of the given tenant
-- @description SECURITY DEFINER function that queries public.memberships directly,
--   bypassing RLS to avoid recursion when used inside RLS policies on the tenants
--   table. LANGUAGE sql STABLE so the planner can inline this inside RLS predicates.
-- @signature _auth_is_tenant_member(p_tenant_id uuid)
-- @returns boolean
-- @security SECURITY DEFINER — bypasses RLS to avoid recursion
-- @related tenants, memberships, _auth_tenant_id
CREATE OR REPLACE FUNCTION public._auth_is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id
      AND user_id = (SELECT auth.uid())
  );
$$;
