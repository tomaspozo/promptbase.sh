-- @agentlink _hook_before_user_created
-- @type function
-- @summary Auth hook that restricts signups to allowed email domains
-- @description Reads ALLOWED_SIGNUP_DOMAINS from vault (comma-separated).
--   Empty or unset = allow all signups. Returns an error object to GoTrue
--   when the user's email domain is not in the allow list.
-- @signature _hook_before_user_created(event jsonb)
-- @returns jsonb
-- @security SECURITY DEFINER — granted to supabase_auth_admin
-- @related _internal_admin_get_secret, auth.hook.before_user_created

CREATE OR REPLACE FUNCTION public._hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed_domains text;
  user_email text;
  user_domain text;
  domain text;
  domains text[];
BEGIN
  allowed_domains := public._internal_admin_get_secret('ALLOWED_SIGNUP_DOMAINS');

  -- No restriction configured → allow all signups
  IF allowed_domains IS NULL OR trim(allowed_domains) = '' THEN
    RETURN event;
  END IF;

  user_email := event->'user'->>'email';
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Email is required for signup.'
      )
    );
  END IF;

  user_domain := lower(split_part(user_email, '@', 2));
  domains := string_to_array(allowed_domains, ',');

  FOREACH domain IN ARRAY domains LOOP
    IF lower(trim(domain)) = user_domain THEN
      RETURN event;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Signups are restricted to authorized domains.'
    )
  );
END;
$$;

-- Grants that the Supabase dashboard auto-applies when an auth hook is
-- enabled via the UI. Listed here so declarative apply (which doesn't go
-- through the dashboard) keeps the hook usable: supabase_auth_admin needs
-- USAGE on the schema to resolve the function name AND EXECUTE on the
-- function itself. Idempotent.
REVOKE ALL ON FUNCTION public._hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public._hook_before_user_created(jsonb) TO supabase_auth_admin;
