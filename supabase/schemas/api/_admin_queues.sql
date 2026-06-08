-- @agentlink agentlink_tasks
-- @type queue
-- @summary Default PGMQ queue for async task processing
-- @description A durable message queue backed by PGMQ. Tasks are enqueued with
--   api._admin_enqueue_task and processed by the internal-queue-worker edge function.
--   Messages contain a function_name and payload. Failed tasks stay in the
--   queue and become visible again after the visibility timeout expires.
--   Retries are bounded: the internal-queue-worker archives any message whose read_ct
--   exceeds QUEUE_MAX_RETRIES (default 5, override via the edge function
--   secret of the same name). Abandoned messages land in pgmq.a_agentlink_tasks
--   with a [max-retries-exceeded] log line for post-mortem inspection.
-- @example SELECT api._admin_enqueue_task('internal-send-auth-email', '{"to":"user@example.com"}'::jsonb);
-- @related _admin_enqueue_task, _admin_queue_read, _admin_queue_delete, _admin_queue_archive, internal-queue-worker, pgmq

-- Create default queue (idempotent)
-- Also validates that msg_id column exists — if it's missing (e.g. after a pgmq
-- extension upgrade that didn't migrate existing tables), drop and recreate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'pgmq' AND table_name = 'q_agentlink_tasks'
  ) THEN
    PERFORM pgmq.create('agentlink_tasks');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pgmq' AND table_name = 'q_agentlink_tasks' AND column_name = 'msg_id'
  ) THEN
    -- Queue table exists but is missing msg_id (stale schema from older pgmq version)
    PERFORM pgmq.drop_queue('agentlink_tasks');
    PERFORM pgmq.create('agentlink_tasks');
  END IF;
END;
$$;

-- Clean up old function names
DROP FUNCTION IF EXISTS public._internal_queue_read(integer, integer);
DROP FUNCTION IF EXISTS public._internal_queue_delete(bigint);
DROP FUNCTION IF EXISTS public._internal_queue_archive(bigint);
DROP FUNCTION IF EXISTS public._admin_queue_read(integer, integer);
DROP FUNCTION IF EXISTS public._admin_queue_delete(bigint);
DROP FUNCTION IF EXISTS public._admin_queue_archive(bigint);
DROP FUNCTION IF EXISTS public._admin_enqueue_task(text, jsonb, integer);

-- @agentlink _admin_enqueue_task
-- @type function
-- @summary Enqueues an async task to the PGMQ agentlink_tasks queue
-- @description Sends a message to the agentlink_tasks queue containing the
--   target edge function name and payload. Supports optional delay in seconds.
--   After enqueuing, fires the internal-queue-worker edge function via pg_net so tasks
--   are processed promptly without waiting for a cron trigger.
-- @signature api._admin_enqueue_task(function_name text, payload jsonb DEFAULT '{}'::jsonb, delay_seconds integer DEFAULT 0)
-- @returns bigint — PGMQ message ID
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT api._admin_enqueue_task('internal-send-auth-email', '{"to":"user@example.com"}'::jsonb);
-- @related agentlink_tasks, _admin_queue_read, internal-queue-worker, pgmq
CREATE OR REPLACE FUNCTION api._admin_enqueue_task(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb,
  delay_seconds integer DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  msg_id bigint;
BEGIN
  SELECT pgmq.send(
    'agentlink_tasks',
    jsonb_build_object(
      'function_name', function_name,
      'payload', payload
    ),
    delay_seconds
  ) INTO msg_id;

  -- Fire the queue worker via pg_net (fire-and-forget)
  PERFORM public._internal_admin_call_edge_function('internal-queue-worker');

  RETURN msg_id;
END;
$$;

REVOKE ALL ON FUNCTION api._admin_enqueue_task(text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_enqueue_task(text, jsonb, integer) TO service_role;

-- @agentlink _admin_queue_read
-- @type function
-- @summary Reads messages from the agentlink_tasks queue
-- @description Wrapper around pgmq.read that reads up to `qty` messages with a
--   visibility timeout of `vt` seconds. Messages become invisible to other
--   readers for the duration of the timeout. Used by the internal-queue-worker.
--   Lives in api schema so edge functions can call it via adminClient.rpc().
-- @signature api._admin_queue_read(qty integer DEFAULT 5, vt integer DEFAULT 30)
-- @returns TABLE (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT * FROM api._admin_queue_read(10, 60);
-- @related agentlink_tasks, _admin_queue_delete, _admin_queue_archive, internal-queue-worker
CREATE OR REPLACE FUNCTION api._admin_queue_read(
  qty integer DEFAULT 5,
  vt integer DEFAULT 30
)
RETURNS TABLE (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT msg_id, read_ct, enqueued_at, vt, message FROM pgmq.read('agentlink_tasks', vt, qty);
$$;

REVOKE ALL ON FUNCTION api._admin_queue_read(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_queue_read(integer, integer) TO service_role;

-- @agentlink _admin_queue_delete
-- @type function
-- @summary Deletes a processed message from the agentlink_tasks queue
-- @description Permanently removes a message by ID. Use after successfully
--   processing a task when you don't need to keep a record.
--   Prefer _admin_queue_archive if you want to retain history.
-- @signature api._admin_queue_delete(id bigint)
-- @returns boolean
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT api._admin_queue_delete(42);
-- @related agentlink_tasks, _admin_queue_read, _admin_queue_archive
CREATE OR REPLACE FUNCTION api._admin_queue_delete(id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pgmq.delete('agentlink_tasks', id);
$$;

REVOKE ALL ON FUNCTION api._admin_queue_delete(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_queue_delete(bigint) TO service_role;

-- @agentlink _admin_queue_archive
-- @type function
-- @summary Archives a processed message from the agentlink_tasks queue
-- @description Moves a message to the archive table instead of deleting it.
--   Preserves a full history of processed tasks for debugging or auditing.
--   This is the default completion strategy used by the internal-queue-worker.
-- @signature api._admin_queue_archive(id bigint)
-- @returns boolean
-- @security SECURITY DEFINER — only service_role can execute
-- @example SELECT api._admin_queue_archive(42);
-- @related agentlink_tasks, _admin_queue_read, _admin_queue_delete, internal-queue-worker
CREATE OR REPLACE FUNCTION api._admin_queue_archive(id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pgmq.archive('agentlink_tasks', id);
$$;

REVOKE ALL ON FUNCTION api._admin_queue_archive(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api._admin_queue_archive(bigint) TO service_role;

-- @agentlink process-stale-tasks
-- @type cron
-- @summary Retries failed/stale tasks stuck in the queue
-- @description Fires the internal-queue-worker edge function every minute via pg_cron.
--   When _admin_enqueue_task runs, it triggers the worker immediately via pg_net,
--   but if that invocation fails or misses messages, this cron ensures they are
--   retried within 60 seconds. Retries are bounded by the worker's max-retry
--   check (QUEUE_MAX_RETRIES, default 5) — messages exceeding the limit are
--   archived rather than retried forever.
-- @related _admin_enqueue_task, internal-queue-worker, agentlink_tasks
SELECT cron.schedule(
  'process-stale-tasks',
  '* * * * *',
  $$SELECT public._internal_admin_call_edge_function('internal-queue-worker')$$
);
