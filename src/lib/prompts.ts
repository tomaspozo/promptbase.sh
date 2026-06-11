import { createClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/fn-error";

/**
 * Call an environment's promptbase-manage via the platform prompts-proxy.
 * Throws a readable Error on failure. `action` is one of: list, get, create,
 * save_version, publish, unpublish, delete.
 */
export async function promptsCall<T = unknown>(
  envId: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("prompts-proxy", {
    body: { env_id: envId, action, ...payload },
  });
  if (error) throw new Error(await readFunctionError(error));
  return data as T;
}

/** Detect {{variable}} names across the given templates (unique, in order). */
export function detectVariables(...templates: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const t of templates) {
    if (!t) continue;
    for (const m of t.matchAll(/\{\{(\w+)\}\}/g)) seen.add(m[1]);
  }
  return [...seen];
}

/** Interpolate {{vars}} with the provided values (missing vars left as-is). */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** Slugify a name into a url-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
