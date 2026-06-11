import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The product's editorial display heading — DM Mono, tight tracking, matching
 * the landing's "better than a const" headline. Use for every page <h1> so the
 * app speaks the same typographic voice as the marketing site.
 */
export function PageHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "font-mono text-[1.75rem] font-medium leading-[1.1] tracking-[-0.02em] sm:text-4xl",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/** Green accent word inside a heading — the landing's <em> treatment. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}
