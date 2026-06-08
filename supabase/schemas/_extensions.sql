-- @agentlink pg_graphql
-- @type extension_drop
-- @summary Drops the pg_graphql extension to enforce schema isolation
-- @description Supabase projects ship with pg_graphql pre-installed, which exposes
--   the database via a /graphql/v1 endpoint and creates graphql / graphql_public
--   schemas. AgentLink enforces strict schema isolation: only the `api` schema is
--   exposed, and all access flows through RPC functions. Leaving pg_graphql enabled
--   would bypass that boundary. Dropping the extension (idempotent, CASCADE) is
--   sufficient — /graphql/v1 stops working the moment pg_graphql is gone. The
--   graphql / graphql_public schemas are left in place because they are owned by
--   supabase_admin on cloud and can't be dropped from a normal role; without the
--   extension they are empty namespaces with nothing exposed.
-- @related api schema, RPC-first architecture
DROP EXTENSION IF EXISTS pg_graphql CASCADE;

-- @agentlink pg_net
-- @type extension
-- @summary Async HTTP requests from PostgreSQL
-- @description Enables non-blocking HTTP calls (GET, POST, etc.) directly from SQL.
--   Used by _admin_call_edge_function to invoke Supabase Edge Functions
--   without waiting for a response (fire-and-forget via net.http_post).
-- @example SELECT net.http_post('https://example.com/api', '{"key":"value"}'::jsonb);
-- @related _internal_admin_call_edge_function, _admin_enqueue_task
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- @agentlink pg_cron
-- @type extension
-- @summary Scheduled job execution inside PostgreSQL
-- @description Runs SQL statements or function calls on a cron schedule.
--   Useful for periodic maintenance, data aggregation, or retry loops.
--   Jobs are created with cron.schedule() and managed in the cron schema.
-- @example SELECT cron.schedule('nightly-cleanup', '0 3 * * *', $$DELETE FROM logs WHERE created_at < now() - interval '30 days'$$);
-- @related pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- @agentlink pgmq
-- @type extension
-- @summary Lightweight transactional message queue for PostgreSQL
-- @description Provides durable, exactly-once message processing with
--   visibility timeouts. AgentLink uses PGMQ to queue async tasks that
--   are processed by the internal-queue-worker edge function. The extension
--   auto-creates its own pgmq schema.
-- @example SELECT pgmq.send('my_queue', '{"task":"process"}'::jsonb);
-- @related agentlink_tasks, _admin_enqueue_task, internal-queue-worker
CREATE EXTENSION IF NOT EXISTS pgmq VERSION '1.5.1';
