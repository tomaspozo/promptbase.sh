// promptbase.sh runtime helper — developers copy this into their own edge
// function's `_shared/` folder. Fetches a published prompt from the project's
// promptbase-get function, interpolates {{variables}}, and caches for 60s.
// Auth uses the PROMPTBASE_SECRET function-secret the install flow set on this
// project (available to every edge function here) — no extra setup.

type PromptVars = Record<string, string>;
interface PromptResult {
  system: string;
  user: string | null;
}

const cache = new Map<string, { result: PromptResult; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function interpolate(t: string, vars: PromptVars): string {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export async function getPrompt(
  slug: string,
  vars: PromptVars = {},
  options?: { ttl?: number },
): Promise<PromptResult> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secret = Deno.env.get("PROMPTBASE_SECRET")!;
  const ttl = options?.ttl ?? CACHE_TTL;

  const cached = cache.get(slug);
  if (cached && Date.now() - cached.ts < ttl) {
    const r = cached.result;
    return {
      system: interpolate(r.system, vars),
      user: r.user ? interpolate(r.user, vars) : null,
    };
  }

  const res = await fetch(`${url}/functions/v1/promptbase-get?slug=${slug}`, {
    headers: { "x-promptbase-key": secret, apikey: secret },
  });
  if (!res.ok) throw new Error(`promptbase: failed to fetch prompt "${slug}"`);

  const data = await res.json();
  cache.set(slug, { result: data, ts: Date.now() });
  return {
    system: interpolate(data.system, vars),
    user: data.user ? interpolate(data.user, vars) : null,
  };
}
