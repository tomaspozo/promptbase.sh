-- @agentlink profiles
-- @type table
-- @summary User profile data synced from auth.users on signup
-- @description Stores display name, email, and avatar for each authenticated user.
--   Automatically populated by _internal_admin_handle_new_user trigger. Protected by
--   RLS policies that restrict access to the owning user only.
-- @related _internal_admin_handle_new_user, set_updated_at, api.profile_get, api.profile_update
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Table privileges (Supabase no longer auto-grants). api.* RPCs are SECURITY
-- INVOKER, so the caller role needs DML; RLS still gates rows. anon omitted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;

DROP POLICY IF EXISTS users_read_own_profile ON public.profiles;
CREATE POLICY users_read_own_profile ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Members of the same tenant can read each other's profiles (display name +
-- avatar). Required by api.membership_list's LEFT JOIN profiles under INVOKER —
-- without this policy the join silently drops rows for everyone except the
-- caller. Composed with users_read_own_profile via OR.
DROP POLICY IF EXISTS members_read_tenant_profiles ON public.profiles;
CREATE POLICY members_read_tenant_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT user_id
      FROM public.memberships
      WHERE tenant_id = public._auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS users_update_own_profile ON public.profiles;
CREATE POLICY users_update_own_profile ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));

-- Auto-update updated_at on row modification
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create profile row when a new user signs up
DROP TRIGGER IF EXISTS trg_auth_users_new_user ON auth.users;
CREATE TRIGGER trg_auth_users_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._internal_admin_handle_new_user();
