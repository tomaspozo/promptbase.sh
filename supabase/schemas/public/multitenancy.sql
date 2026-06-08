-- ============================================================
-- Multitenancy: tables, RLS policies, indexes, triggers
-- Order within file: tenants → memberships → invitations → session_tenants
-- (each FKs into something defined above it).
--
-- Role columns (memberships.role, invitations.role, session_tenants.tenant_role)
-- FK into public.roles(name) ON UPDATE CASCADE — defined in _rbac.sql, which
-- runs first in the schema apply order. Renaming a role propagates everywhere
-- automatically.
--
-- RLS here is ISOLATION-ONLY: policies scope rows by tenant_id / user_id and
-- never check permissions. Permission/action authz (membership.update,
-- invitation.create, ...) lives in the api.* RPCs via
-- public.auth_verify_access(...). See public/_authz.sql for the full model.
-- ============================================================

-- @agentlink tenants
-- @type table
-- @summary Tenant/workspace entities for multitenancy
-- @description Each tenant represents an organization or workspace. Users are linked
--   to tenants via the memberships table. RLS restricts access to members only
--   (isolation); tenant.update / tenant.delete permission checks belong in the
--   api.* RPC via auth_verify_access, not in policies.
-- @related memberships, invitations, session_tenants, _auth_is_tenant_member, auth_verify_access
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
-- Table privileges. Supabase no longer auto-grants DML on new public tables
-- (default changed 2026). The api.* RPCs are SECURITY INVOKER, so they touch
-- this table AS the caller — which needs the grant. RLS still gates rows, and
-- public is not exposed via the Data API, so this doesn't widen the REST
-- surface. anon is intentionally omitted (anon-facing RPCs are SECURITY DEFINER).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated, service_role;

-- RLS here is ISOLATION-ONLY (membership scope). Permission/action checks
-- (tenant.update / tenant.delete) belong in the api.* RPC via
-- public.auth_verify_access(...) — not in policies. There is no
-- api.tenant_update / api.tenant_delete RPC in the scaffold yet; when one is
-- added it guards with auth_verify_access('tenant.update'|'tenant.delete').
-- Helper calls are wrapped in (SELECT ...) so the planner promotes them to
-- InitPlans (one evaluation per query, not per row). _auth_is_tenant_member is
-- LANGUAGE sql STABLE so it can be inlined too — the wrap is universal best
-- practice and matches Supabase's docs.
DROP POLICY IF EXISTS members_read_own_tenant ON public.tenants;
CREATE POLICY members_read_own_tenant ON public.tenants
  FOR SELECT TO authenticated
  USING ((SELECT public._auth_is_tenant_member(id)));

DROP POLICY IF EXISTS authorized_update_tenant ON public.tenants;
CREATE POLICY authorized_update_tenant ON public.tenants
  FOR UPDATE TO authenticated
  USING ((SELECT public._auth_is_tenant_member(id)));

DROP POLICY IF EXISTS authorized_delete_tenant ON public.tenants;
CREATE POLICY authorized_delete_tenant ON public.tenants
  FOR DELETE TO authenticated
  USING ((SELECT public._auth_is_tenant_member(id)));

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- @agentlink memberships
-- @type table
-- @summary Links users to tenants with role-based access
-- @description Join table between auth.users and tenants. Each row assigns a user
--   a role within a tenant. The role column FKs into public.roles(name) — apps
--   add new roles by inserting into roles, no schema change required. Protected
--   by RLS that scopes access to the user's current tenant.
-- @related tenants, roles, _auth_tenant_id, auth_verify_access, api.membership_list
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' REFERENCES public.roles(name) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships (tenant_id, user_id);

-- Hot path: _hook_custom_access_token's "oldest membership" fallback runs
--   SELECT ... FROM memberships WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
-- on every JWT mint when no per-session pin exists. A composite (user_id,
-- created_at) index lets the planner walk the index in order and stop at row 1
-- — no separate Sort node. Leftmost-prefix means this also covers plain
-- WHERE user_id = $1 lookups, so we drop the redundant single-column index.
DROP INDEX IF EXISTS public.idx_memberships_user_id;
CREATE INDEX IF NOT EXISTS idx_memberships_user_id_created_at
  ON public.memberships (user_id, created_at);

-- RLS here is ISOLATION-ONLY (tenant scope + ownership). The membership.read /
-- membership.update / membership.delete permission checks live in the api.*
-- RPCs via public.auth_verify_access(...). Two complementary read policies
-- (composed with OR by Postgres):
--   1. members_read_memberships → see members of your currently selected tenant
--      (drives api.membership_list, which guards membership.read in the RPC).
--   2. users_read_own_memberships → see YOUR OWN membership rows across ALL tenants,
--      even before a tenant is selected (drives api.tenant_list — without this, a
--      user with no JWT tenant_id claim would see zero memberships and the tenant
--      picker would be empty).
DROP POLICY IF EXISTS members_read_memberships ON public.memberships;
CREATE POLICY members_read_memberships ON public.memberships
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public._auth_tenant_id()));

DROP POLICY IF EXISTS users_read_own_memberships ON public.memberships;
CREATE POLICY users_read_own_memberships ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS authorized_insert_memberships ON public.memberships;
CREATE POLICY authorized_insert_memberships ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public._auth_tenant_id()));

-- Drop legacy admins_* policies if upgrading from a pre-RBAC scaffold.
DROP POLICY IF EXISTS admins_insert_memberships ON public.memberships;
DROP POLICY IF EXISTS admins_delete_memberships ON public.memberships;
DROP POLICY IF EXISTS admins_update_memberships ON public.memberships;

-- DELETE/UPDATE policies are isolation + the cheap self-protection business
-- rule (user_id != auth.uid() prevents self-removal/self-promotion). The
-- membership.delete / membership.update PERMISSION is checked in the RPC via
-- auth_verify_access — not here. The RPCs (api.membership_remove /
-- api.membership_update_role) also apply both predicates explicitly, so this
-- policy is the backstop.
DROP POLICY IF EXISTS authorized_delete_memberships ON public.memberships;
CREATE POLICY authorized_delete_memberships ON public.memberships
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public._auth_tenant_id())
    AND user_id != (SELECT auth.uid())
  );

-- USING and WITH CHECK both apply: row must already match before the update,
-- and after the update the membership must still belong to the same tenant
-- (we don't allow moving a membership across tenants).
DROP POLICY IF EXISTS authorized_update_memberships ON public.memberships;
CREATE POLICY authorized_update_memberships ON public.memberships
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public._auth_tenant_id())
    AND user_id != (SELECT auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT public._auth_tenant_id())
    AND user_id != (SELECT auth.uid())
  );

-- @agentlink invitations
-- @type table
-- @summary Pending invitations to join a tenant
-- @description Stores email-based invitations with a unique token. Invitations expire
--   and can be accepted once. The role column FKs to public.roles(name); the
--   `role <> 'owner'` CHECK enforces that ownership is never assignable via
--   invitation (owners are minted on tenant creation only, defense-in-depth on
--   top of the api guard that also verifies roles.invitable=true).
-- @related tenants, memberships, roles, api.invitation_create, api.invitation_accept
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' REFERENCES public.roles(name) ON UPDATE CASCADE
    CHECK (role <> 'owner'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token) WHERE accepted_at IS NULL;

-- FK index: invitations.tenant_id FKs tenants(id) ON DELETE CASCADE. Without
-- this index, deleting a tenant seq-scans invitations and the RLS policies
-- below (which all filter by tenant_id) seq-scan on every read.
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON public.invitations (tenant_id);

-- Isolation-only (tenant scope). The invitation.create / invitation.delete
-- permission checks live in the api.* RPCs via auth_verify_access.
DROP POLICY IF EXISTS admins_read_invitations ON public.invitations;
DROP POLICY IF EXISTS authorized_read_invitations ON public.invitations;
CREATE POLICY authorized_read_invitations ON public.invitations
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public._auth_tenant_id()));

DROP POLICY IF EXISTS authorized_delete_invitations ON public.invitations;
CREATE POLICY authorized_delete_invitations ON public.invitations
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public._auth_tenant_id()));

-- @agentlink session_tenants
-- @type table
-- @summary Per-session tenant pin — the source of truth for which tenant a device is using
-- @description One row per active auth.sessions row. The custom access-token hook
--   reads this on every JWT mint to inject tenant_id/tenant_role/permissions for
--   the requesting session. This is what makes tenant selection per-device:
--   different sessions (phone vs. laptop) hold independent rows. Cascade-deleted
--   when the session ends, the user is removed, or the tenant is deleted, so
--   stale pins can't accumulate. The membership-sync trigger below keeps
--   tenant_role aligned when an admin changes a user's role mid-session.
-- @related auth.sessions, memberships, _hook_custom_access_token, api.tenant_select
CREATE TABLE IF NOT EXISTS public.session_tenants (
  session_id  UUID PRIMARY KEY REFERENCES auth.sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  tenant_role TEXT NOT NULL REFERENCES public.roles(name)   ON UPDATE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_tenants ENABLE ROW LEVEL SECURITY;
-- Base grant; the REVOKE below trims authenticated to read-only (writes go
-- through the SECURITY DEFINER _internal_admin_set_session_tenant).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tenants TO authenticated, service_role;

-- Composite (user_id, tenant_id) covers the membership-sync trigger's
--   WHERE user_id = $1 AND tenant_id = $2
-- as a single B-tree probe (vs. bitmap-and on two separate indexes), and
-- via leftmost-prefix also handles bare user_id lookups — so we drop the
-- redundant single-column user_id index. The standalone tenant_id index
-- stays because it's the FK index for ON DELETE CASCADE from public.tenants.
DROP INDEX IF EXISTS public.idx_session_tenants_user_id;
CREATE INDEX IF NOT EXISTS idx_session_tenants_user_tenant
  ON public.session_tenants (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_tenants_tenant_id
  ON public.session_tenants (tenant_id);

-- Defense in depth: the SELECT policy below is the only client-facing access
-- path. Writes only happen through _internal_admin_set_session_tenant
-- (SECURITY DEFINER) and the membership-sync trigger.
REVOKE INSERT, UPDATE, DELETE ON public.session_tenants FROM anon, authenticated;

-- supabase_auth_admin executes the access-token hook and needs to read this table.
GRANT SELECT ON public.session_tenants TO supabase_auth_admin;

-- Users can read their own pins (e.g. for "current device" UI). Writes only via
-- the api.tenant_select RPC, which delegates to a SECURITY DEFINER helper.
DROP POLICY IF EXISTS users_read_own_session_tenants ON public.session_tenants;
CREATE POLICY users_read_own_session_tenants ON public.session_tenants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- @agentlink _internal_admin_sync_session_tenants_on_membership
-- @type function
-- @summary Trigger that keeps session_tenants in sync with membership changes
-- @description Fires AFTER UPDATE OR DELETE on public.memberships. On role change,
--   updates tenant_role on every session_tenants row for that (user, tenant) pair
--   so the next refresh mints the correct permissions. On membership deletion,
--   removes the pins so the affected user falls back to another tenant (or none)
--   on next refresh. Note: in-flight JWTs keep their old claims until refresh —
--   this is an inherent JWT limitation, mitigated by the configured jwt_expiry.
-- @signature _internal_admin_sync_session_tenants_on_membership()
-- @returns trigger
-- @security SECURITY DEFINER — bypasses session_tenants RLS to do the sync write
-- @related session_tenants, memberships, _hook_custom_access_token
CREATE OR REPLACE FUNCTION public._internal_admin_sync_session_tenants_on_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.session_tenants
    WHERE user_id = OLD.user_id
      AND tenant_id = OLD.tenant_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    UPDATE public.session_tenants
    SET tenant_role = NEW.role,
        updated_at  = now()
    WHERE user_id = NEW.user_id
      AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_sync_session_tenants ON public.memberships;
CREATE TRIGGER trg_memberships_sync_session_tenants
  AFTER UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public._internal_admin_sync_session_tenants_on_membership();
