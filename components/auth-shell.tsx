"use client";

import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  back?: { label?: string; onClick: () => void };
  /** Optional so loading states render without a body. */
  children?: ReactNode;
}

/**
 * Shared chrome for /auth/* pages — Next.js mirror of the Vite component.
 * Same visual language: .rule + .label header, animate-rise body.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  back,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <div className="rule flex items-baseline justify-between pt-4">
          {back ? (
            <button
              type="button"
              onClick={back.onClick}
              className="text-sm font-medium hover:text-muted-foreground"
            >
              {back.label ?? "← Back"}
            </button>
          ) : (
            <span />
          )}
          <p className="label">{eyebrow}</p>
        </div>

        <div className="mt-12 animate-rise">
          <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </main>
  );
}
