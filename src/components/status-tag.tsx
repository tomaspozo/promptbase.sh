import type { ReactNode } from "react";

/**
 * Quiet status indicator — a colored dot + mono micro-label. Reads as state,
 * not a button. Shared by the environment and prompt cards.
 */
export function StatusTag({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </span>
  );
}
