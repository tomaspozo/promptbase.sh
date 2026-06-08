-- @agentlink api
-- @type schema
-- @summary Public-facing schema exposed via PostgREST / Supabase Data API
-- @description The only schema exposed to clients through the Supabase Data API.
--   All client-callable RPC functions live here as api.{entity}_{action}.
--   Tables and internal functions stay in the public schema and are never
--   exposed directly. Grants USAGE to anon, authenticated, and service_role
--   so pages that render before the session is established (and any RPC
--   intentionally exposed to anon) can resolve the schema. Per-function
--   EXECUTE is still the security boundary — grant EXPLICITLY to anon on
--   a function-by-function basis; leave client RPCs granted to
--   authenticated + service_role only.
-- @example SELECT api.todos_list();
-- @related _internal_admin_get_secret, _internal_admin_call_edge_function
CREATE SCHEMA IF NOT EXISTS api;
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
