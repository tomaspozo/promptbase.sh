-- @agentlink _hook_send_email
-- @type function
-- @summary Auth hook that enqueues email jobs into PGMQ
-- @description Enqueues the GoTrue email event into the agentlink_tasks queue
--   via _admin_enqueue_task. The internal-queue-worker picks it up and invokes
--   the internal-send-auth-email edge function asynchronously — no timeout
--   pressure from GoTrue.
-- @signature _hook_send_email(event jsonb)
-- @returns jsonb
-- @security SECURITY DEFINER — granted to supabase_auth_admin
-- @related api._admin_enqueue_task, internal-send-auth-email, internal-queue-worker, auth.hook.send_email

CREATE OR REPLACE FUNCTION public._hook_send_email(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM api._admin_enqueue_task(
    'internal-send-auth-email',
    event
  );
  RETURN event;
END;
$$;

-- Grants that the Supabase dashboard auto-applies when an auth hook is
-- enabled via the UI. Listed here so declarative apply (which doesn't go
-- through the dashboard) keeps the hook usable: supabase_auth_admin needs
-- USAGE on the schema to resolve the function name AND EXECUTE on the
-- function itself. Idempotent.
REVOKE ALL ON FUNCTION public._hook_send_email(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public._hook_send_email(jsonb) TO supabase_auth_admin;
