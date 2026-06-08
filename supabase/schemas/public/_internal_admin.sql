-- @agentlink _internal_admin_get_secret
-- @type function
-- @summary Retrieves an encrypted secret from Vault by name
-- @description Looks up a secret in vault.decrypted_secrets by its name and
--   returns the decrypted value. Used by other _internal_admin functions
--   to fetch SUPABASE_URL and SUPABASE_SECRET_KEY at runtime.
-- @signature _internal_admin_get_secret(secret_name text)
-- @returns text
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT _internal_admin_get_secret('SUPABASE_URL');
-- @related vault, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY
CREATE OR REPLACE FUNCTION public._internal_admin_get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;

  RETURN secret_value;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_get_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._internal_admin_get_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public._internal_admin_get_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._internal_admin_get_secret(text) TO service_role;

-- @agentlink _internal_admin_call_edge_function
-- @type function
-- @summary Invokes a Supabase Edge Function via async HTTP POST
-- @description Builds the full URL from the SUPABASE_URL secret, attaches the
--   SUPABASE_SECRET_KEY as the apikey header, and fires a non-blocking HTTP POST
--   using pg_net. Returns the pg_net request ID for optional tracking.
-- @signature _internal_admin_call_edge_function(function_name text, payload jsonb DEFAULT '{}'::jsonb)
-- @returns bigint — pg_net request ID
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT _internal_admin_call_edge_function('internal-queue-worker');
-- @related pg_net, _internal_admin_get_secret, internal-queue-worker
CREATE OR REPLACE FUNCTION public._internal_admin_call_edge_function(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  supabase_url text;
  service_key text;
  request_id bigint;
  full_url text;
BEGIN
  supabase_url := public._internal_admin_get_secret('SUPABASE_URL');
  service_key := public._internal_admin_get_secret('SUPABASE_SECRET_KEY');

  IF supabase_url IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_URL secret not found in Vault';
  END IF;

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_SECRET_KEY secret not found in Vault';
  END IF;

  full_url := supabase_url || '/functions/v1/' || function_name;

  SELECT net.http_post(
    url := full_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key
    ),
    body := payload
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_call_edge_function(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._internal_admin_call_edge_function(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._internal_admin_call_edge_function(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._internal_admin_call_edge_function(text, jsonb) TO service_role;

-- @agentlink set_updated_at
-- @type function
-- @summary Generic trigger function that sets updated_at to now()
-- @description Reusable BEFORE UPDATE trigger function. Attach to any table with
--   an updated_at column: CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON {table}
--   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- @signature set_updated_at()
-- @returns trigger
-- @security SECURITY INVOKER — runs as the trigger caller, no privilege escalation
-- @related profiles, trg_profiles_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- @agentlink _internal_admin_handle_new_user
-- @type function
-- @summary Creates profile and (for direct signups without pending invites) default tenant
-- @description Trigger function that fires after INSERT on auth.users. Always creates
--   a profile row. For direct signups, ALSO creates a personal tenant (workspace) and
--   an owner membership — UNLESS the user has a pending workspace invitation, in which
--   case the personal tenant is skipped (the user will accept the invite via
--   api.invitation_accept and join the inviter's tenant; creating a parallel personal
--   tenant would surprise them and leave dead workspaces around).
--
--   Three skip-personal-tenant paths:
--     1. NEW.invited_at IS NOT NULL — user was created via auth.admin.generateLink
--        ({ type: 'invite' }) or auth.admin.inviteUserByEmail. Original "admin invited
--        you to the app" flow.
--     2. A pending invitation matches NEW.email — the user is mid-flight in the
--        redesigned /accept-invite flow, which calls signUp() (so invited_at IS NULL)
--        but expects to join the invited tenant once they confirm their email.
--     3. (Implicit) The COALESCE chain falls back to "{display_name}'s Workspace"
--        when raw_user_meta_data->>'organization_name' is NULL — OAuth signups still
--        get a sensible default tenant name.
--
--   Email comparison is case-insensitive (lower()) on both sides — auth.users.email
--   is normalized but invitations.email isn't, so we normalize at compare time.
--
--   No JWT claim writes — _hook_custom_access_token reads memberships at every JWT
--   mint and auto-selects the user's oldest membership when no per-session pin exists.
--   For users skipped here, the membership comes from the subsequent invitation_accept
--   call, and the next refresh mints a JWT with the right tenant_id.
-- @signature _internal_admin_handle_new_user()
-- @returns trigger
-- @security SECURITY DEFINER — required because it reads from auth.users which RLS can't access
-- @related profiles, tenants, memberships, invitations, trg_auth_users_new_user, _hook_custom_access_token, api.invitation_accept
CREATE OR REPLACE FUNCTION public._internal_admin_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
  v_organization_name text;
  v_tenant_name text;
  v_tenant_id uuid;
  v_slug_base text;
  v_slug text;
  v_has_pending_invite boolean;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Org name from the signup form (NULL for OAuth, admin-created users, or
  -- forms that don't collect it — fall back to the auto-generated name).
  v_organization_name := NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), '');

  -- Create profile (always — every user needs one)
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  );

  -- A pending invite means the user is intentionally being routed to an
  -- existing workspace; don't auto-create a parallel personal one.
  v_has_pending_invite := EXISTS (
    SELECT 1 FROM public.invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  );

  -- Skip personal tenant creation for two reasons:
  --   1. invited_at IS NOT NULL → user was admin-invited via generateLink
  --   2. A pending workspace invitation is waiting for this email
  IF NEW.invited_at IS NULL AND NOT v_has_pending_invite THEN
    v_tenant_name := COALESCE(v_organization_name, v_display_name || '''s Workspace');

    -- Slugify the tenant name; fall back to email local-part if slugification
    -- produces an empty string (e.g. all non-ASCII characters).
    v_slug_base := trim(both '-' from regexp_replace(lower(v_tenant_name), '[^a-z0-9]+', '-', 'g'));
    IF v_slug_base = '' THEN
      v_slug_base := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9]', '-', 'g');
    END IF;
    v_slug := v_slug_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    INSERT INTO public.tenants (name, slug)
    VALUES (v_tenant_name, v_slug)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._internal_admin_handle_new_user() TO service_role;

-- ============================================================
-- Tenant / membership / invitation privileged helpers
--
-- Why these live here: every operation below either writes to auth.users
-- (claims) or needs to bypass RLS to validate a token. They MUST be DEFINER.
-- DEFINER functions in api trigger the Supabase database linter (lints
-- 0028/0029) when callable by anon/authenticated. The fix is to keep the
-- DEFINER side-effects out of api: the api wrappers (api.tenant_*, etc.)
-- are SECURITY INVOKER, validate the caller, and delegate here. Linter
-- only inspects exposed schemas — public is invisible to it, so DEFINER
-- helpers in public are warning-free.
--
-- Defense-in-depth: every helper checks (SELECT auth.uid()) = p_user_id
-- before doing anything privileged. Even if an attacker bypasses the api
-- wrapper, they can't escalate to another user's identity.
-- ============================================================

-- @agentlink _internal_admin_set_session_tenant
-- @type function
-- @summary Pins a tenant to the calling user's current device session
-- @description Upserts public.session_tenants for the caller's current session so
--   the next JWT mint for this device picks up the chosen tenant. The session_id
--   is read from auth.jwt() inside this function (NOT from a parameter) — Supabase
--   signs the JWT, so the session_id we read is guaranteed to belong to the calling
--   user. That removes the auth.sessions ownership check we used to do (which
--   depended on postgres having SELECT on auth.sessions, NOT granted on Supabase
--   Cloud) without weakening security: a malicious authenticated caller can't pass
--   a forged session_id because there is no session_id parameter to forge.
--   Bypasses session_tenants RLS so the api wrapper doesn't need its own
--   INSERT/UPDATE policy.
-- @signature _internal_admin_set_session_tenant(p_user_id uuid, p_tenant_id uuid, p_role text)
-- @returns void
-- @security SECURITY DEFINER — bypasses session_tenants RLS to write the pin
-- @related session_tenants, api.tenant_select, _hook_custom_access_token
CREATE OR REPLACE FUNCTION public._internal_admin_set_session_tenant(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot set session tenant for another user';
  END IF;

  -- Read session_id from the caller's signed JWT — auth.jwt() works inside
  -- SECURITY DEFINER because the request-level GUC (request.jwt.claims) is
  -- session state, not role-bound. Whatever session_id we read here is by
  -- construction the calling user's real session.
  v_session_id := NULLIF((SELECT auth.jwt()->>'session_id'), '')::uuid;
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'No session — JWT is missing session_id';
  END IF;

  INSERT INTO public.session_tenants (session_id, user_id, tenant_id, tenant_role, updated_at)
  VALUES (v_session_id, p_user_id, p_tenant_id, p_role, now())
  ON CONFLICT (session_id) DO UPDATE
    SET tenant_id   = EXCLUDED.tenant_id,
        tenant_role = EXCLUDED.tenant_role,
        user_id     = EXCLUDED.user_id,  -- safety: rewrite user_id to caller's
        updated_at  = now();
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_set_session_tenant(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._internal_admin_set_session_tenant(uuid, uuid, text) TO authenticated, service_role;

-- @agentlink _internal_admin_create_tenant
-- @type function
-- @summary Atomically creates a tenant + owner membership for the caller
-- @description Inserts a new tenants row and an owner membership for the calling
--   user — all in one transaction so partial failures don't leave orphaned tenants.
--   Returns the new tenant's id. Validates that the calling user matches p_user_id
--   (defense in depth — the api wrapper already does this). Does NOT pin the new
--   tenant to the caller's session — api.tenant_create calls
--   _internal_admin_set_session_tenant separately so the caller can refresh their
--   JWT and start working in the new tenant immediately.
-- @signature _internal_admin_create_tenant(p_user_id uuid, p_name text, p_slug text)
-- @returns uuid — new tenant id
-- @security SECURITY DEFINER — bypasses tenants/memberships RLS to do the multi-row write atomically
-- @related api.tenant_create, _internal_admin_set_session_tenant
CREATE OR REPLACE FUNCTION public._internal_admin_create_tenant(
  p_user_id uuid,
  p_name text,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot create tenant on behalf of another user';
  END IF;

  INSERT INTO public.tenants (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'owner');

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_create_tenant(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._internal_admin_create_tenant(uuid, text, text) TO authenticated, service_role;

-- @agentlink _internal_admin_create_invitation
-- @type function
-- @summary Atomically creates an invitation row + enqueues the invite email
-- @description Validates the calling user is an admin of the given tenant, inserts
--   the invitation, and enqueues internal-invite-member via api._admin_enqueue_task.
--   Returns the new invitation row. Bypasses RLS on invitations so the api wrapper
--   doesn't need its own INSERT policy — admin-only access is enforced here.
-- @signature _internal_admin_create_invitation(p_user_id uuid, p_tenant_id uuid, p_email text, p_role text)
-- @returns jsonb — { id, email, role, token, expires_at }
-- @security SECURITY DEFINER — bypasses invitations RLS + reaches api._admin_enqueue_task (service_role only)
-- @related api.invitation_create, api._admin_enqueue_task, internal-invite-member
CREATE OR REPLACE FUNCTION public._internal_admin_create_invitation(
  p_user_id uuid,
  p_tenant_id uuid,
  p_email text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation record;
  v_tenant_name text;
  v_caller_role text;
  v_role_invitable boolean;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot create invitation on behalf of another user';
  END IF;

  -- Caller must hold invitation.create in the target tenant. We resolve the role
  -- from the actual membership row (DEFINER bypasses RLS) rather than trusting
  -- JWT claims — guards against stale claims for users with multiple tenants —
  -- and check it against role_permissions.
  SELECT role INTO v_caller_role
  FROM public.memberships
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_name = v_caller_role
      AND permission_name = 'invitation.create'
  ) THEN
    RAISE EXCEPTION 'Your role does not permit creating invitations';
  END IF;

  -- The invited role must be marked invitable (default seed: 'owner' is not).
  SELECT invitable INTO v_role_invitable FROM public.roles WHERE name = p_role;
  IF v_role_invitable IS NULL THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  ELSIF NOT v_role_invitable THEN
    RAISE EXCEPTION 'Role % cannot be assigned via invitation', p_role;
  END IF;

  INSERT INTO public.invitations (tenant_id, email, role, invited_by)
  VALUES (p_tenant_id, p_email, p_role, p_user_id)
  RETURNING * INTO v_invitation;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

  PERFORM api._admin_enqueue_task(
    'internal-invite-member',
    jsonb_build_object(
      'email', v_invitation.email,
      'token', v_invitation.token::text,
      'tenant_name', v_tenant_name
    )
  );

  RETURN jsonb_build_object(
    'id', v_invitation.id,
    'email', v_invitation.email,
    'role', v_invitation.role,
    'token', v_invitation.token,
    'expires_at', v_invitation.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_create_invitation(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._internal_admin_create_invitation(uuid, uuid, text, text) TO authenticated, service_role;

-- @agentlink _internal_admin_complete_invitation
-- @type function
-- @summary Validates a token and atomically creates the membership
-- @description Looks up the invitation by token (bypassing RLS — the accepting user
--   isn't an admin of the inviting tenant yet, so they can't read invitations under
--   normal RLS). Verifies it's not expired or already accepted, creates the
--   membership, and marks the invitation accepted. Returns the tenant data for the
--   api wrapper to surface to the client.
--
--   No JWT claim writes — the api wrapper calls _internal_admin_set_session_tenant
--   to pin the new tenant to the accepting user's current device session, so the
--   next refresh mints the right claims. Other devices fall back to the hook's
--   "oldest membership" rule on their next refresh.
-- @signature _internal_admin_complete_invitation(p_user_id uuid, p_token uuid)
-- @returns jsonb — { id, name, slug, role }
-- @security SECURITY DEFINER — needs to bypass RLS on invitations
-- @related api.invitation_accept, _internal_admin_set_session_tenant
CREATE OR REPLACE FUNCTION public._internal_admin_complete_invitation(
  p_user_id uuid,
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation record;
  v_tenant record;
  v_existing_role text;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot accept invitation on behalf of another user';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    -- Idempotency: a user clicking the same invite link twice (slow first
    -- click, second tab, etc.) should land in the workspace, not see an error.
    -- If the token exists at all and the caller already has a membership in
    -- that tenant, treat as success. Otherwise the token is genuinely invalid.
    SELECT i.tenant_id, m.role
      INTO v_invitation.tenant_id, v_existing_role
    FROM public.invitations i
    LEFT JOIN public.memberships m
      ON m.tenant_id = i.tenant_id AND m.user_id = p_user_id
    WHERE i.token = p_token;

    IF v_existing_role IS NOT NULL THEN
      SELECT * INTO v_tenant FROM public.tenants WHERE id = v_invitation.tenant_id;
      RETURN jsonb_build_object(
        'id', v_tenant.id,
        'name', v_tenant.name,
        'slug', v_tenant.slug,
        'role', v_existing_role,
        'already_member', true
      );
    END IF;

    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_invitation.tenant_id, p_user_id, v_invitation.role)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  UPDATE public.invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_invitation.tenant_id;

  RETURN jsonb_build_object(
    'id', v_tenant.id,
    'name', v_tenant.name,
    'slug', v_tenant.slug,
    'role', v_invitation.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_complete_invitation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._internal_admin_complete_invitation(uuid, uuid) TO authenticated, service_role;

-- @agentlink _internal_admin_resend_invitation
-- @type function
-- @summary Re-enqueues internal-invite-member for an existing invitation
-- @description Looks up the invitation by id (bypassing RLS), verifies it belongs
--   to a tenant the caller is a member of with invitation.create permission, and
--   re-fires the queue task. Does NOT mutate the invitations row — the original
--   token continues to be valid until expires_at. supabase.auth.resend() does not
--   support type='invite', so this RPC is the canonical resend path.
-- @signature _internal_admin_resend_invitation(p_user_id uuid, p_invitation_id uuid)
-- @returns jsonb — { id, email, expires_at }
-- @security SECURITY DEFINER — bypasses invitations RLS to read tenant_name, reaches api._admin_enqueue_task
-- @related api.invitation_resend, api._admin_enqueue_task, internal-invite-member
CREATE OR REPLACE FUNCTION public._internal_admin_resend_invitation(
  p_user_id uuid,
  p_invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation record;
  v_tenant_name text;
  v_caller_role text;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot resend invitation on behalf of another user';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already accepted/expired';
  END IF;

  -- Permission gate: caller must be a tenant admin (invitation.create) of the
  -- invitation's tenant. Resolves from membership rows directly (bypassing RLS)
  -- to guard against stale JWT claims for users with multiple tenants.
  SELECT role INTO v_caller_role
  FROM public.memberships
  WHERE tenant_id = v_invitation.tenant_id AND user_id = p_user_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_name = v_caller_role
      AND permission_name = 'invitation.create'
  ) THEN
    RAISE EXCEPTION 'Your role does not permit resending invitations';
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = v_invitation.tenant_id;

  PERFORM api._admin_enqueue_task(
    'internal-invite-member',
    jsonb_build_object(
      'email', v_invitation.email,
      'token', v_invitation.token::text,
      'tenant_name', v_tenant_name
    )
  );

  RETURN jsonb_build_object(
    'id', v_invitation.id,
    'email', v_invitation.email,
    'expires_at', v_invitation.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public._internal_admin_resend_invitation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._internal_admin_resend_invitation(uuid, uuid) TO authenticated, service_role;
