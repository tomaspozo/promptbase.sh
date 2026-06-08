-- @agentlink api.profile_get
-- @type function
-- @summary Returns the current user's profile as JSON
-- @description Fetches the authenticated user's profile from public.profiles and
--   returns a controlled JSON shape via jsonb_build_object. Returns NULL if no
--   profile exists.
-- @signature api.profile_get()
-- @returns jsonb
-- @security SECURITY INVOKER — runs as the calling user, RLS applies
-- @related profiles, api.profile_update
CREATE OR REPLACE FUNCTION api.profile_get()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT INTO v_result jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at
  )
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());

  RETURN v_result;
END;
$$;

-- @agentlink api.profile_update
-- @type function
-- @summary Updates the current user's profile fields
-- @description Accepts optional fields and applies COALESCE to preserve existing
--   values when NULL is passed. Returns the updated profile via api.profile_get().
-- @signature api.profile_update(p_display_name text, p_avatar_url text)
-- @returns jsonb
-- @security SECURITY INVOKER — runs as the calling user, RLS applies
-- @related profiles, api.profile_get
CREATE OR REPLACE FUNCTION api.profile_update(
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE public.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = (SELECT auth.uid());

  SELECT INTO v_result api.profile_get();
  RETURN v_result;
END;
$$;
