import { cn } from "@/lib/utils";

/**
 * Branded loading indicator — the landing's green pulse dot + a mono micro-label.
 * Replaces bare "Loading…" text throughout the app.
 */
export function Loading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 animate-pulse-slow rounded-full bg-primary" />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">
        {label}
      </span>
    </div>
  );
}

/** Full-viewport centered loader for route resolvers / redirect screens. */
export function PageLoading({ label }: { label?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Loading label={label} />
    </main>
  );
}
