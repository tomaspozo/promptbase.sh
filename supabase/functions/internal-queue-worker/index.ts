// @agentlink internal-queue-worker
// @type edge_function
// @summary Processes async tasks from the agentlink_tasks PGMQ queue
// @description Reads pending messages from the queue, invokes the target edge
//   function for each task, and archives successful messages. Failed tasks
//   remain in the queue and become visible again after the visibility timeout
//   expires, enabling automatic retry. Retries are bounded by QUEUE_MAX_RETRIES
//   (default 5): once pgmq's read_ct exceeds the limit, the message is
//   archived with a [max-retries-exceeded] log line instead of being retried
//   forever. Override by setting the QUEUE_MAX_RETRIES secret.
//   Secured with auth: 'secret' so only secret key holders can invoke it.
//   Naming convention: `internal-` prefix marks system-only edge functions
//   never called from client code — only enqueued or fired via pg_net by
//   trusted DB code (auth hooks, admin RPCs, cron).
// @example SELECT api._admin_enqueue_task('internal-send-auth-email', '{"user":{},"email_data":{}}'::jsonb);
// @related agentlink_tasks, _admin_enqueue_task, _admin_queue_read, _admin_queue_archive

// @ts-nocheck
import { withSupabase } from "@supabase/server";
import { jsonResponse } from "../_shared/responses.ts";

const DEFAULT_MAX_RETRIES = 5;
const parsedMaxRetries = Number(Deno.env.get("QUEUE_MAX_RETRIES"));
const MAX_RETRIES = Number.isFinite(parsedMaxRetries) && parsedMaxRetries > 0
  ? parsedMaxRetries
  : DEFAULT_MAX_RETRIES;

export default {
  fetch: withSupabase(
    { auth: "secret", supabaseOptions: { db: { schema: "api" } } },
    async (_req, { supabaseAdmin }) => {
      const { data: messages, error: readError } = await supabaseAdmin.rpc(
        "_admin_queue_read",
        { qty: 5, vt: 30 },
      );

      if (readError) {
        console.error("Failed to read queue:", readError);
        return jsonResponse({ error: readError.message }, 500);
      }

      if (!messages || messages.length === 0) {
        return jsonResponse({ processed: 0 });
      }

      let processed = 0;
      let abandoned = 0;

      for (const msg of messages) {
        const { function_name, payload } = msg.message;

        // Bounded retries: once read_ct exceeds the limit, archive instead of
        // retrying forever. pgmq increments read_ct on each read, so read_ct=N
        // means this message has been delivered to the worker N times.
        if (msg.read_ct > MAX_RETRIES) {
          console.error(
            `[max-retries-exceeded] Task ${msg.msg_id} (${function_name}) ` +
              `read_ct=${msg.read_ct} exceeded QUEUE_MAX_RETRIES=${MAX_RETRIES}, archiving.`,
          );
          await supabaseAdmin.rpc("_admin_queue_archive", { id: msg.msg_id });
          abandoned++;
          continue;
        }

        try {
          const { error: invokeError } = await supabaseAdmin.functions.invoke(
            function_name,
            { body: payload },
          );

          if (invokeError) {
            console.error(
              `Task ${msg.msg_id} (${function_name}) failed ` +
                `(attempt ${msg.read_ct}/${MAX_RETRIES}):`,
              invokeError,
            );
            // Leave in queue — becomes visible again after VT expires
            continue;
          }

          // Archive on success (keeps history)
          await supabaseAdmin.rpc("_admin_queue_archive", { id: msg.msg_id });
          processed++;
        } catch (err) {
          console.error(
            `Task ${msg.msg_id} (${function_name}) threw ` +
              `(attempt ${msg.read_ct}/${MAX_RETRIES}):`,
            err,
          );
          // Leave in queue for retry
        }
      }

      return jsonResponse({
        processed,
        abandoned,
        total: messages.length,
      });
    },
  ),
};
