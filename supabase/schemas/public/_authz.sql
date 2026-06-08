-- ============================================================
-- Authorization guards — the PRIMARY permission gate for api.* RPCs
--
-- The authorization model has four layers, each with one job:
--   1. Schema isolation  — only api.* functions are exposed; public tables
--                           are unreachable via the Data API. This is the
--                           table boundary.
--   2. RPC permission guard (THIS FILE) — every mutating api.* RPC calls
--                           public.auth_verify_access('<entity>.<action>')
--                           as its first statement. This is the permission
--                           gate, and it is PRIMARY.
--   3. RLS, isolation-only — every table has a cheap policy scoping to
--                           tenant_id / user_id. It is the backstop against
--                           a forgotten WHERE — never where permissions are
--                           checked.
--   4. Frontend guard     — useHasPermission() / route guards. UX only,
--                           never security.
--
-- Both helpers wrap public._auth_has_permission (defined in _rbac.sql),
-- which reads app_metadata.permissions from the JWT — populated by
-- _hook_custom_access_token on every mint. So these are JWT-only: zero DB
-- reads, and they evaluate against the caller's ACTIVE workspace.
--
-- public is NOT exposed to the Data API — these are internal guards called
-- from api.* RPCs (and, if ever needed, RLS). The frontend never calls
-- them; it decodes app_metadata.permissions from the access token directly.
--
-- Apply order: this file MUST run after _rbac.sql (it depends on
-- public._auth_has_permission) and before the api/*.sql files that call it.
-- ============================================================

-- auth_verify_access — RAISES on deny. Call as the FIRST statement of every
-- mutating api.* RPC (after the Not-authenticated / No-tenant null guards).
-- ERRCODE 42501 (insufficient_privilege) maps to PostgREST HTTP 403 — distinct
-- from a bare RAISE EXCEPTION (SQLSTATE P0001 → HTTP 400). The MESSAGE surfaces
-- verbatim in the client's error.message; DETAIL/HINT ride along in the
-- PostgREST JSON error body for structured handling.
CREATE OR REPLACE FUNCTION public.auth_verify_access(p_permission text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public._auth_has_permission(p_permission) THEN
    RAISE EXCEPTION 'Permission denied: %', p_permission
      USING
        ERRCODE = '42501',  -- insufficient_privilege → PostgREST HTTP 403
        DETAIL  = 'The active workspace role does not grant this permission.',
        HINT    = 'Required permission: ' || p_permission;
  END IF;
END;
$$;

-- auth_has_access — boolean form, for conditional branching INSIDE an RPC
-- (e.g. return a richer payload to admins). Never raises. LANGUAGE sql STABLE
-- so the planner can inline it, matching _auth_has_permission.
CREATE OR REPLACE FUNCTION public.auth_has_access(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public._auth_has_permission(p_permission);
$$;

-- Lock down execution: revoke the implicit PUBLIC grant Postgres adds to new
-- functions, then grant only to the roles that run RPCs. anon never holds
-- permissions (the array is empty), so it is intentionally excluded.
REVOKE ALL ON FUNCTION public.auth_verify_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_has_access(text)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_verify_access(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_has_access(text)    TO authenticated, service_role;
