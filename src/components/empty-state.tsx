import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Branded empty state — a green-tinted icon chip, a DM Mono title, a hint, and
 * an optional action. One consistent treatment for every empty list/section.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      )}
      <p className="font-mono text-sm font-medium tracking-[-0.01em]">{title}</p>
      {children && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {children}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
