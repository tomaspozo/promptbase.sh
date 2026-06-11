import type { ReactNode } from "react";

/**
 * Centered content column for the gated app. The page chrome (the persistent
 * top bar) lives in the $slug layout; this is just the padded column the page
 * content sits in. One source of truth for width + padding so sections align.
 */
export function AppContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-12">{children}</div>;
}
