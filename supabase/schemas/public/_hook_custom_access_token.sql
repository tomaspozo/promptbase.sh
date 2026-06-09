-- PROJECT-OWNED OVERRIDE (no @agentlink annotation): customized for the
-- early-access waitlist. Fires on every JWT mint (sign-in and refresh).
-- Resolves the active tenant (session pin → oldest membership fallback) and
-- injects app_metadata.tenant_id / tenant_role / permissions, PLUS
-- app_metadata.allowed (from profiles.allowed) so the frontend _auth gate can
-- route not-allowed users to /pending. SECURITY DEFINER — runs as the owner so
-- reads against public.* succeed for supabase_auth_admin; the REVOKE+GRANT pair
-- below bounds invocation to supabase_auth_admin only.
CREATE OR REPLACE FUNCTION public._hook_custom_access_token(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id          uuid;
  v_session_id       uuid;
  v_original_claims  jsonb := COALESCE(event->'claims', '{}'::jsonb);
  v_new_claims       jsonb := '{}'::jsonb;
  v_app_meta         jsonb := COALESCE(v_original_claims->'app_metadata', '{}'::jsonb);
  v_tenant_id        uuid;
  v_tenant_role      text;
  v_permissions      text[];
  v_allowed          boolean := false;
  v_claim            text;
BEGIN
  -- Safe parse: malformed/missing UUIDs collapse to NULL instead of erroring
  -- the whole function and dropping the JWT mint. event->>... returns NULL
  -- when the key is missing; ::uuid on a non-UUID text would raise — guard
  -- with a regex first. We could rely on Supabase always sending a valid
  -- UUID, but the cost of being defensive here is one regexp_match per mint.
  IF (event->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := (event->>'user_id')::uuid;
  END IF;
  IF (v_original_claims->>'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_session_id := (v_original_claims->>'session_id')::uuid;
  END IF;

  -- Build new_claims by copying ONLY the claims Supabase Auth's validator
  -- recognises. Matches the canonical "Custom Access Token Hook" example
  -- shape from the Supabase docs and is forward-compatible: anything else
  -- in the event we don't know about is silently dropped, which is the
  -- safe default (the validator rejects outputs containing claims it
  -- doesn't expect, which manifests as the JWT mint silently falling back
  -- to the original unmodified claims — a confusing failure mode).
  --   Required claims (validator errors if missing):
  --     iss, aud, exp, iat, sub, role, aal, session_id, email, phone, is_anonymous
  --   Optional claims worth preserving:
  --     user_metadata, amr, jti, nbf, client_id
  --   app_metadata is set explicitly below.
  FOREACH v_claim IN ARRAY ARRAY[
    'iss', 'aud', 'exp', 'iat', 'sub', 'role', 'aal',
    'session_id', 'email', 'phone', 'is_anonymous',
    'user_metadata', 'amr', 'jti', 'nbf', 'client_id'
  ] LOOP
    IF v_original_claims ? v_claim THEN
      v_new_claims := jsonb_set(v_new_claims, ARRAY[v_claim], v_original_claims->v_claim);
    END IF;
  END LOOP;

  -- Pass 1: per-session pin. user_id predicate is defense in depth — the
  -- only writer (api.tenant_select via _internal_admin_set_session_tenant)
  -- already enforces user_id = auth.uid(), but matching it here too means a
  -- session_tenants row with a wrong user_id (e.g. left over after sign-out
  -- + sign-in reuses a recycled session_id) won't inject the wrong tenant.
  IF v_session_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    SELECT tenant_id, tenant_role
      INTO v_tenant_id, v_tenant_role
    FROM public.session_tenants
    WHERE session_id = v_session_id
      AND user_id    = v_user_id;
  END IF;

  -- Pass 2: fallback to oldest membership (single-tenant zero-touch).
  -- Hot path on every JWT mint when no pin is set — relies on the
  -- composite index idx_memberships_user_id_created_at to stop at row 1
  -- without a separate sort.
  IF v_tenant_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT tenant_id, role
      INTO v_tenant_id, v_tenant_role
    FROM public.memberships
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Strip stale tenant claims that may have been in the original
  -- app_metadata, then add fresh ones if a tenant resolved. This matters
  -- because we preserve other app_metadata keys the application may have
  -- set (e.g. provider data) — we just want OUR three keys to be the
  -- authoritative source from the resolution above, not whatever was
  -- baked in previously.
  v_app_meta := v_app_meta - 'tenant_id' - 'tenant_role' - 'permissions' - 'allowed';

  IF v_tenant_id IS NOT NULL THEN
    SELECT array_agg(permission_name)
      INTO v_permissions
    FROM public.role_permissions
    WHERE role_name = v_tenant_role;

    v_app_meta := v_app_meta || jsonb_build_object(
      'tenant_id',   v_tenant_id::text,
      'tenant_role', v_tenant_role,
      'permissions', COALESCE(to_jsonb(v_permissions), '[]'::jsonb)
    );
  END IF;

  -- Waitlist gate: surface profiles.allowed on every mint, independent of
  -- tenant resolution (a user may be allowed before any tenant is selected).
  IF v_user_id IS NOT NULL THEN
    SELECT allowed INTO v_allowed FROM public.profiles WHERE id = v_user_id;
  END IF;
  v_app_meta := v_app_meta || jsonb_build_object('allowed', COALESCE(v_allowed, false));

  v_new_claims := jsonb_set(v_new_claims, '{app_metadata}', v_app_meta);

  RETURN jsonb_build_object('claims', v_new_claims);
END;
$$;

-- Grants that the Supabase dashboard auto-applies when an auth hook is
-- enabled via the UI. Listed here so declarative apply (which doesn't
-- go through the dashboard) keeps the hook usable: supabase_auth_admin
-- needs USAGE on the schema to resolve the function name AND EXECUTE
-- on the function itself. REVOKE removes the default PUBLIC EXECUTE so
-- only the auth admin role can invoke it. Idempotent — re-applying
-- these on every db apply is fine.
REVOKE ALL ON FUNCTION public._hook_custom_access_token(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public._hook_custom_access_token(jsonb) TO supabase_auth_admin;
