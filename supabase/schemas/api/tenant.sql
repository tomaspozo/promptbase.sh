-- @agentlink api.tenant_select
-- @type function
-- @summary Pins a tenant to the calling device's session and returns the tenant data
-- @description SECURITY INVOKER. Verifies the calling user is a member of the
--   requested tenant, then upserts public.session_tenants for the caller's
--   current session_id (extracted from auth.jwt()). _hook_custom_access_token
--   reads this pin on the next JWT mint and injects the corresponding
--   tenant_id/tenant_role/permissions into app_metadata. After calling this,
--   the client should call supabase.auth.refreshSession() to pick up the new
--   claims. Switching on phone never moves the laptop's pin — they have
--   different session_ids.
-- @signature api.tenant_select(p_tenant_id uuid)
-- @returns jsonb
-- @security SECURITY INVOKER — RLS applies; privileged write is delegated to _internal_admin_set_session_tenant
-- @related tenants, memberships, session_tenants, _internal_admin_set_session_tenant, _hook_custom_access_token
CREATE OR REPLACE FUNCTION api.tenant_select(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role    text;
  v_tenant  record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Reads memberships for the calling user. Works under RLS thanks to the
  -- users_read_own_memberships policy added in multitenancy.sql.
  SELECT role INTO v_role
  FROM public.memberships
  WHERE tenant_id = p_tenant_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  -- Members can read their tenant via members_read_own_tenant policy.
  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- The DEFINER helper reads session_id from auth.jwt() itself — never trusts
  -- a session_id passed by the caller.
  PERFORM public._internal_admin_set_session_tenant(v_user_id, p_tenant_id, v_role);

  RETURN jsonb_build_object(
    'id', v_tenant.id,
    'name', v_tenant.name,
    'slug', v_tenant.slug,
    'role', v_role
  );
END;
$$;

-- @agentlink api.tenant_list
-- @type function
-- @summary Lists all tenants the current user belongs to
-- @description SECURITY INVOKER. Returns a JSON array of tenants with the user's
--   role in each. Relies on the users_read_own_memberships RLS policy to expose
--   the caller's memberships across tenants (the tenant-scoped policy alone would
--   only show memberships in the currently selected tenant).
-- @signature api.tenant_list()
-- @returns jsonb
-- @security SECURITY INVOKER — RLS applies
-- @related tenants, memberships, users_read_own_memberships
CREATE OR REPLACE FUNCTION api.tenant_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'slug', t.slug,
    'role', m.role
  )), '[]'::jsonb)
  INTO v_result
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = (SELECT auth.uid());

  RETURN v_result;
END;
$$;

-- @agentlink api.tenant_create
-- @type function
-- @summary Creates a new tenant with the current user as owner and pins it to the session
-- @description SECURITY INVOKER. Delegates the atomic multi-row write
--   (tenant + owner membership) to public._internal_admin_create_tenant, then
--   pins the new tenant to the caller's current session via
--   _internal_admin_set_session_tenant so a single supabase.auth.refreshSession()
--   on the client lands them inside the new workspace.
-- @signature api.tenant_create(p_name text, p_slug text)
-- @returns jsonb
-- @security SECURITY INVOKER — privileged work delegated to _internal_admin_*
-- @related tenants, memberships, session_tenants, api.tenant_select, _internal_admin_create_tenant
CREATE OR REPLACE FUNCTION api.tenant_create(p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_tenant_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_tenant_id := public._internal_admin_create_tenant(v_user_id, p_name, p_slug);

  -- Pin to this session so the next refresh starts in the new tenant. Skip
  -- when the caller has no session_id (rare — service-role calls or
  -- admin-API mints); the hook's "oldest membership" fallback resolves the
  -- tenant on next JWT mint anyway. The DEFINER helper reads session_id
  -- from auth.jwt() — never accepts it as a parameter — so this guard is
  -- only here to skip the call cleanly when there's no session at all.
  IF NULLIF(auth.jwt()->>'session_id', '') IS NOT NULL THEN
    PERFORM public._internal_admin_set_session_tenant(v_user_id, v_tenant_id, 'owner');
  END IF;

  RETURN jsonb_build_object(
    'id', v_tenant_id,
    'name', p_name,
    'slug', p_slug,
    'role', 'owner'
  );
END;
$$;

-- @agentlink api.invitation_create
-- @type function
-- @summary Creates an invitation and enqueues the invite email
-- @description SECURITY INVOKER. Resolves the caller's current tenant from JWT
--   claims, then delegates to public._internal_admin_create_invitation which
--   validates admin role, inserts the invitation, and enqueues
--   internal-invite-member. Returns the invitation data.
-- @signature api.invitation_create(p_email text, p_role text DEFAULT 'member')
-- @returns jsonb
-- @security SECURITY INVOKER — privileged work delegated to _internal_admin_create_invitation
-- @related invitations, memberships, _internal_admin_create_invitation, internal-invite-member
CREATE OR REPLACE FUNCTION api.invitation_create(
  p_email text,
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_tenant_id uuid := public._auth_tenant_id();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant selected';
  END IF;

  -- Primary permission gate (403 if denied). The DEFINER helper below ALSO
  -- re-checks role_permissions from the memberships row — kept deliberately:
  -- it's DB-authoritative (defends stale JWTs + direct helper calls), where
  -- this guard is the fast JWT-only, user-facing check.
  PERFORM public.auth_verify_access('invitation.create');

  RETURN public._internal_admin_create_invitation(v_user_id, v_tenant_id, p_email, p_role);
END;
$$;

-- @agentlink api.invitation_accept
-- @type function
-- @summary Accepts a tenant invitation, joins the tenant, and pins it to the session
-- @description SECURITY INVOKER. Delegates token validation + membership write to
--   public._internal_admin_complete_invitation (which bypasses invitations RLS, since
--   the accepting user isn't a member yet), then pins the accepted tenant to the
--   caller's current session_id so a single refreshSession() on the client lands
--   them inside the joined workspace.
-- @signature api.invitation_accept(p_token uuid)
-- @returns jsonb
-- @security SECURITY INVOKER — privileged work delegated to _internal_admin_complete_invitation
-- @related invitations, memberships, session_tenants, _internal_admin_complete_invitation
CREATE OR REPLACE FUNCTION api.invitation_accept(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_result := public._internal_admin_complete_invitation(v_user_id, p_token);

  -- Pin to this session — the user almost always wants to start working in the
  -- tenant they just accepted into. They can switch later with tenant_select.
  -- Skip when there's no session_id (service-role / admin-API context); the
  -- hook's "oldest membership" fallback resolves the tenant on next mint.
  IF NULLIF(auth.jwt()->>'session_id', '') IS NOT NULL THEN
    PERFORM public._internal_admin_set_session_tenant(
      v_user_id,
      (v_result->>'id')::uuid,
      v_result->>'role'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- @agentlink api.membership_list
-- @type function
-- @summary Lists all members of the current tenant
-- @description SECURITY INVOKER. Calls auth_verify_access('membership.read') first
--   (403 if denied), then returns a JSON array of members with their profile info and
--   roles, scoped to the current tenant from JWT claims. The memberships isolation RLS
--   policy backstops the tenant scope; the members_read_tenant_profiles policy on
--   public.profiles exposes co-members' profile fields for the LEFT JOIN.
-- @signature api.membership_list()
-- @returns jsonb
-- @security SECURITY INVOKER — auth_verify_access gates the permission; isolation RLS backstops
-- @related memberships, profiles, _auth_tenant_id, members_read_tenant_profiles
CREATE OR REPLACE FUNCTION api.membership_list()
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

  -- Primary permission gate: a caller without membership.read gets a clear
  -- 403 rather than a silent empty array. The WHERE below scopes to the
  -- active tenant; the memberships isolation RLS policy is the backstop.
  PERFORM public.auth_verify_access('membership.read');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'user_id', m.user_id,
    'role', m.role,
    'email', p.email,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', m.created_at
  )), '[]'::jsonb)
  INTO v_result
  FROM public.memberships m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.tenant_id = v_tenant_id;

  RETURN v_result;
END;
$$;

-- @agentlink api.invitation_list
-- @type function
-- @summary Lists pending invitations for the current tenant
-- @description SECURITY INVOKER. Returns a JSON array of pending (unaccepted, unexpired)
--   invitations for the caller's current tenant from JWT claims. Calls
--   auth_verify_access('invitation.create') first, so a caller without that permission
--   gets a 403 rather than an empty array. The invitations isolation RLS policy backstops
--   the tenant scope.
-- @signature api.invitation_list()
-- @returns jsonb
-- @security SECURITY INVOKER — RLS applies on invitations
-- @related invitations, _auth_tenant_id, authorized_read_invitations
CREATE OR REPLACE FUNCTION api.invitation_list()
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

  -- Primary permission gate (same permission that gates creating invitations).
  PERFORM public.auth_verify_access('invitation.create');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'email', i.email,
    'role', i.role,
    'invited_by', i.invited_by,
    'expires_at', i.expires_at,
    'created_at', i.created_at
  ) ORDER BY i.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.invitations i
  WHERE i.tenant_id = v_tenant_id
    AND i.accepted_at IS NULL
    AND i.expires_at > now();

  RETURN v_result;
END;
$$;

-- @agentlink api.invitation_revoke
-- @type function
-- @summary Cancels a pending invitation
-- @description SECURITY INVOKER. Calls auth_verify_access('invitation.delete') as the
--   primary permission gate (403 if denied), then deletes the invitation scoped to the
--   active tenant. The invitations isolation RLS policy is the backstop. No DEFINER
--   helper needed because no cross-RLS work is required.
-- @signature api.invitation_revoke(p_invitation_id uuid)
-- @returns jsonb — { id }
-- @security SECURITY INVOKER — auth_verify_access gates the permission; isolation RLS backstops
-- @related invitations, authorized_delete_invitations
CREATE OR REPLACE FUNCTION api.invitation_revoke(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Primary permission gate (403 if denied).
  PERFORM public.auth_verify_access('invitation.delete');

  -- Explicit tenant scope (the isolation RLS policy is the backstop).
  DELETE FROM public.invitations
  WHERE id = p_invitation_id
    AND tenant_id = (SELECT public._auth_tenant_id());

  IF NOT FOUND THEN
    -- Either the row doesn't exist or it's outside the active tenant.
    RAISE EXCEPTION 'Invitation not found or not permitted';
  END IF;

  RETURN jsonb_build_object('id', p_invitation_id);
END;
$$;

-- @agentlink api.invitation_resend
-- @type function
-- @summary Re-enqueues the invite email for an existing pending invitation
-- @description SECURITY INVOKER. Re-fires internal-invite-member for an invitation
--   that's already in the table — does NOT create a new row, so the original token
--   keeps working. supabase.auth.resend() does not accept type='invite', so this
--   is the only sanctioned resend path. Delegates to the DEFINER helper so the
--   tenant_name lookup works without granting tenants read to the caller.
-- @signature api.invitation_resend(p_invitation_id uuid)
-- @returns jsonb — { id, email, expires_at }
-- @security SECURITY INVOKER — privileged work delegated to _internal_admin_resend_invitation
-- @related invitations, _internal_admin_resend_invitation, internal-invite-member
CREATE OR REPLACE FUNCTION api.invitation_resend(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_tenant_id uuid := public._auth_tenant_id();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant selected';
  END IF;

  -- Primary permission gate (same permission that gates creating invitations).
  PERFORM public.auth_verify_access('invitation.create');

  -- Then confirm the invitation exists in the active tenant before delegating
  -- to the DEFINER helper (which re-checks role_permissions independently).
  IF NOT EXISTS (
    SELECT 1 FROM public.invitations
    WHERE id = p_invitation_id
      AND tenant_id = v_tenant_id
      AND accepted_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Invitation not found or not permitted';
  END IF;

  RETURN public._internal_admin_resend_invitation(v_user_id, p_invitation_id);
END;
$$;

-- @agentlink api.membership_remove
-- @type function
-- @summary Removes a member from the current tenant
-- @description SECURITY INVOKER. Calls auth_verify_access('membership.delete') as the
--   primary permission gate (403 if denied), then deletes the membership scoped to the
--   active tenant and excluding self-removal. The memberships isolation RLS policy is
--   the backstop. The _internal_admin_sync_session_tenants_on_membership trigger cascades
--   the deletion to session_tenants so the affected user falls back to another tenant on
--   next refresh.
-- @signature api.membership_remove(p_membership_id uuid)
-- @returns jsonb — { id }
-- @security SECURITY INVOKER — auth_verify_access gates the permission; isolation RLS backstops
-- @related memberships, authorized_delete_memberships, _internal_admin_sync_session_tenants_on_membership
CREATE OR REPLACE FUNCTION api.membership_remove(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Primary permission gate (403 if denied).
  PERFORM public.auth_verify_access('membership.delete');

  -- Explicit tenant scope + no self-removal (the memberships isolation RLS
  -- policy enforces both as the backstop).
  DELETE FROM public.memberships
  WHERE id = p_membership_id
    AND tenant_id = (SELECT public._auth_tenant_id())
    AND user_id != v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found or not permitted';
  END IF;

  RETURN jsonb_build_object('id', p_membership_id);
END;
$$;

-- @agentlink api.membership_update_role
-- @type function
-- @summary Changes a member's role within the current tenant
-- @description SECURITY INVOKER. Calls auth_verify_access('membership.update') as the
--   primary permission gate (403 if denied), rejects 'owner' (ownership is never
--   assignable post-creation), then updates memberships.role scoped to the active tenant
--   and excluding self-promotion. The memberships isolation RLS policy is the backstop.
--   The membership-sync trigger cascades the role change to session_tenants automatically;
--   in-flight JWTs keep stale claims until expiry.
-- @signature api.membership_update_role(p_membership_id uuid, p_role text)
-- @returns jsonb — { id, role }
-- @security SECURITY INVOKER — auth_verify_access gates the permission; isolation RLS backstops
-- @related memberships, authorized_update_memberships, _internal_admin_sync_session_tenants_on_membership
CREATE OR REPLACE FUNCTION api.membership_update_role(
  p_membership_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role_invitable boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Primary permission gate (403 if denied).
  PERFORM public.auth_verify_access('membership.update');

  -- Owner is never assignable; matches the invitations CHECK constraint.
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Role owner cannot be assigned';
  END IF;

  -- Validate the role exists and is invitable (mirrors invitation_create's check).
  SELECT invitable INTO v_role_invitable FROM public.roles WHERE name = p_role;
  IF v_role_invitable IS NULL THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  ELSIF NOT v_role_invitable THEN
    RAISE EXCEPTION 'Role % cannot be assigned', p_role;
  END IF;

  -- Explicit tenant scope + no self-promotion (the memberships isolation RLS
  -- policy enforces both as the backstop).
  UPDATE public.memberships
  SET role = p_role
  WHERE id = p_membership_id
    AND tenant_id = (SELECT public._auth_tenant_id())
    AND user_id != v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found or not permitted';
  END IF;

  RETURN jsonb_build_object('id', p_membership_id, 'role', p_role);
END;
$$;

-- @agentlink api.invitation_preview
-- @type function
-- @summary Public-callable preview of an invitation (workspace + inviter)
-- @description SECURITY DEFINER. Looks up an invitation by token without
--   requiring authentication, so the /accept-invite page (and the
--   contextual banner on /auth/sign-in and /auth/sign-up) can show the
--   workspace name and inviter context BEFORE the user signs in. Returns
--   a `valid` discriminator with `reason` on the unhappy path. Granted
--   to anon + authenticated.
--
--   Privacy: returns the inviter's display name only (not email). The
--   invited email IS returned because the recipient already knows their
--   own address — the page uses it to pre-fill the sign-up form and to
--   detect "wrong account signed in" mismatches.
--
--   Threat model: an attacker would need to guess a 122-bit-entropy
--   gen_random_uuid() token to enumerate invitations. The exposed
--   surface (workspace name + role + inviter name + invited email) is
--   identical to what the email recipient already sees, so a guessed
--   token leaks no more than the email itself being intercepted.
-- @signature api.invitation_preview(p_token uuid)
-- @returns jsonb — { valid, reason?, tenant_name?, tenant_slug?, role?, invited_email?, invited_by_name?, expires_at? }
-- @security SECURITY DEFINER — needs to read invitations + tenants + profiles for unauth callers
-- @related invitations, tenants, profiles, _internal_admin_complete_invitation, api.invitation_accept
CREATE OR REPLACE FUNCTION api.invitation_preview(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inv record;
  v_inviter_name text;
BEGIN
  SELECT
    i.email,
    i.role,
    i.invited_by,
    i.accepted_at,
    i.expires_at,
    i.tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug
  INTO v_inv
  FROM public.invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    -- Surface tenant_name/slug so the "already accepted" screen can
    -- offer a "Continue to <workspace>" CTA instead of a dead end.
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'accepted',
      'tenant_name', v_inv.tenant_name,
      'tenant_slug', v_inv.tenant_slug
    );
  END IF;

  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'tenant_name', v_inv.tenant_name
    );
  END IF;

  -- Inviter's display name — graceful when the profile is missing
  -- (can happen if the inviter's profile row was deleted).
  SELECT display_name INTO v_inviter_name
  FROM public.profiles
  WHERE id = v_inv.invited_by;

  RETURN jsonb_build_object(
    'valid', true,
    'tenant_name', v_inv.tenant_name,
    'tenant_slug', v_inv.tenant_slug,
    'role', v_inv.role,
    'invited_email', v_inv.email,
    'invited_by_name', v_inviter_name,
    'expires_at', v_inv.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION api.invitation_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.invitation_preview(uuid) TO anon, authenticated, service_role;
