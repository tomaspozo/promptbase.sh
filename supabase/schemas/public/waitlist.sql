-- Early-access waitlist gate.
--
-- profiles.allowed controls whether a verified user reaches the app (true) or
-- the /pending "you're on the list" screen (false, the default). It's surfaced
-- to the frontend as the JWT claim app_metadata.allowed by
-- public._hook_custom_access_token. Invited users get allowed = true at signup
-- (see public._internal_admin_handle_new_user); organic signups start false and
-- are approved manually:
--
--   UPDATE public.profiles SET allowed = true WHERE email = 'user@example.com';
--
-- which fires the approval email via the trigger below.
--
-- Write-safety: no api.* RPC writes `allowed` (api.profile_update only touches
-- display_name/avatar_url) and the public schema isn't exposed via the Data
-- API, so users cannot self-approve.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed boolean NOT NULL DEFAULT false;

-- When a profile is approved (allowed flips false -> true), enqueue a branded
-- approval email through the existing pgmq queue + worker pipeline
-- (api._admin_enqueue_task -> internal-queue-worker -> internal-send-approval-email).
CREATE OR REPLACE FUNCTION public._waitlist_on_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM api._admin_enqueue_task(
    'internal-send-approval-email',
    jsonb_build_object(
      'email', NEW.email,
      'display_name', NEW.display_name
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._waitlist_on_approved() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_approved ON public.profiles;
CREATE TRIGGER trg_profiles_approved
  AFTER UPDATE OF allowed ON public.profiles
  FOR EACH ROW
  WHEN (NEW.allowed AND NOT OLD.allowed)
  EXECUTE FUNCTION public._waitlist_on_approved();
