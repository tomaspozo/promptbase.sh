/**
 * Extract a human-readable message from a `supabase.functions.invoke()` error.
 * On a non-2xx response supabase-js sets a generic `FunctionsHttpError`; the
 * real message is in the JSON body (our edge functions return `{ error }`).
 */
export async function readFunctionError(error: unknown): Promise<string> {
  const e = error as {
    message?: string;
    context?: { json?: () => Promise<{ error?: string }> };
  };
  try {
    const body = await e.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // fall back to the generic message
  }
  return e.message ?? "Request failed";
}
