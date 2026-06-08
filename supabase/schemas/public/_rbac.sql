-- ============================================================
-- Role-based access control: roles, permissions, role_permissions
--
-- Why three tables instead of enums:
--   Postgres enums are append-only — you can ALTER TYPE ... ADD VALUE,
--   but you can't rename, remove, or reorder values without rebuilding
--   the type and every column that uses it. Apps grow new permissions
--   constantly ("charts.create", "billing.read", ...), so we model the
--   role and permission sets as data, not types.
--
-- The tradeoff vs. enums is type-safety: a typo in INSERT INTO
-- role_permissions writes a string, not a compile error. The FKs in
-- role_permissions → roles/permissions catch typos at write time, so
-- you can't reference a role or permission that doesn't exist.
--
-- Apply order: this file MUST run before multitenancy.sql because
-- public.memberships.role and public.invitations.role hold FKs into
-- public.roles(name).
-- ============================================================

-- @agentlink roles
-- @type table
-- @summary Defines the role names used across the app
-- @description Lookup table for role names referenced by memberships, invitations,
--   session_tenants, and role_permissions. Apps add new roles by inserting rows here;
--   existing role columns FK back via ON UPDATE CASCADE so renaming a role propagates
--   automatically. The `rank` column drives _auth_has_role's hierarchy check (higher
--   rank = more privileged). The `invitable` column prevents 'owner' (or any role you
--   choose) from being assigned via invitations.
-- @related permissions, role_permissions, memberships, invitations, session_tenants
CREATE TABLE IF NOT EXISTS public.roles (
  name        TEXT PRIMARY KEY,
  rank        INT NOT NULL,
  description TEXT,
  invitable   BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
-- Base table privileges. Supabase no longer auto-grants DML on new public
-- tables (default changed 2026); api.* RPCs are SECURITY INVOKER so the caller
-- role needs the grant. The REVOKE below then trims authenticated to read-only.
-- service_role keeps full DML (it seeds this reference data). anon omitted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated, service_role;

-- Defense in depth: the SELECT policy below is the only client-facing access path.
-- Revoke INSERT/UPDATE/DELETE so even a future RLS bug can't expose writes —
-- writes only happen through SECURITY DEFINER functions and via service_role
-- (which bypasses RLS by default and retains its grants).
REVOKE INSERT, UPDATE, DELETE ON public.roles FROM anon, authenticated;

DROP POLICY IF EXISTS authenticated_read_roles ON public.roles;
CREATE POLICY authenticated_read_roles ON public.roles
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.roles (name, rank, description, invitable) VALUES
  ('owner',  4, 'Full control of the workspace',                              false),
  ('admin',  3, 'Manage members, invite users, change settings',              true),
  ('member', 2, 'Standard access to workspace resources',                     true),
  ('viewer', 1, 'Read-only access',                                           true)
ON CONFLICT (name) DO NOTHING;

-- @agentlink permissions
-- @type table
-- @summary Defines the permission names available to roles
-- @description Lookup table for permission names. Apps add domain permissions here
--   (e.g. 'charts.create', 'billing.update') and bind them to roles via
--   role_permissions. The naming convention is dot-separated 'resource.action'.
--   _auth_has_permission(text) reads from JWT — the names here exist so the FK in
--   role_permissions catches typos at INSERT time.
-- @related roles, role_permissions, _auth_has_permission
CREATE TABLE IF NOT EXISTS public.permissions (
  name        TEXT PRIMARY KEY,
  description TEXT
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.permissions FROM anon, authenticated;

DROP POLICY IF EXISTS authenticated_read_permissions ON public.permissions;
CREATE POLICY authenticated_read_permissions ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.permissions (name, description) VALUES
  ('tenant.update',     'Update workspace settings (name, slug)'),
  ('tenant.delete',     'Delete the workspace and all its data'),
  ('membership.read',   'See other members of the workspace'),
  ('membership.update', 'Change other members'' roles'),
  ('membership.delete', 'Remove members from the workspace'),
  ('invitation.create', 'Invite new members'),
  ('invitation.delete', 'Revoke pending invitations')
ON CONFLICT (name) DO NOTHING;

-- @agentlink role_permissions
-- @type table
-- @summary Binds permissions to roles
-- @description Each row grants one permission to one role. The matrix is fully
--   explicit (no computed inheritance) — owner's row count for a permission is
--   independent of admin's, so apps can build non-hierarchical roles later
--   (e.g. a 'billing_admin' that has billing perms but not membership perms)
--   without restructuring. _hook_custom_access_token reads this table to populate
--   app_metadata.permissions on every JWT mint.
-- @related roles, permissions, _hook_custom_access_token, _auth_has_permission
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_name       TEXT NOT NULL REFERENCES public.roles(name)       ON UPDATE CASCADE ON DELETE CASCADE,
  permission_name TEXT NOT NULL REFERENCES public.permissions(name) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (role_name, permission_name)
);

-- The PK covers (role_name, permission_name) — leftmost-prefix gives us role_name
-- lookups for free, but permission_name-only lookups (used by ON UPDATE/DELETE
-- CASCADE from public.permissions) need their own index. Without it, every
-- cascade does a seq scan on role_permissions.
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_name
  ON public.role_permissions (permission_name);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.role_permissions FROM anon, authenticated;

DROP POLICY IF EXISTS authenticated_read_role_permissions ON public.role_permissions;
CREATE POLICY authenticated_read_role_permissions ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- supabase_auth_admin needs to read role_permissions during the access-token hook.
-- Grants are explicit because RLS on the table denies non-authenticated roles.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions TO supabase_auth_admin;

-- Default matrix. Owner has everything; admin has everything except tenant.delete;
-- member can read the team; viewer can read the team. Apps extend this with their
-- own (role_name, permission_name) rows.
INSERT INTO public.role_permissions (role_name, permission_name) VALUES
  ('owner',  'tenant.update'),
  ('owner',  'tenant.delete'),
  ('owner',  'membership.read'),
  ('owner',  'membership.update'),
  ('owner',  'membership.delete'),
  ('owner',  'invitation.create'),
  ('owner',  'invitation.delete'),
  ('admin',  'tenant.update'),
  ('admin',  'membership.read'),
  ('admin',  'membership.update'),
  ('admin',  'membership.delete'),
  ('admin',  'invitation.create'),
  ('admin',  'invitation.delete'),
  ('member', 'membership.read'),
  ('viewer', 'membership.read')
ON CONFLICT (role_name, permission_name) DO NOTHING;

-- @agentlink _auth_has_permission
-- @type function
-- @summary Checks if the current user holds a named permission in their current tenant
-- @description Reads app_metadata.permissions from auth.jwt() (populated by
--   _hook_custom_access_token on every JWT mint) and tests whether the requested
--   permission is in the array. Returns false when no tenant is selected or the
--   permission is not granted. LANGUAGE sql STABLE so the planner can inline the
--   call inside RLS predicates — no per-row function-call overhead, no table reads.
-- @signature _auth_has_permission(p_permission text)
-- @returns boolean
-- @security SECURITY INVOKER — runs as the calling user; only reads JWT
-- @example USING ((SELECT public._auth_has_permission('charts.delete')))
-- @related _auth_has_role, _hook_custom_access_token, role_permissions
CREATE OR REPLACE FUNCTION public._auth_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->'permissions') ? p_permission,
    false
  );
$$;
