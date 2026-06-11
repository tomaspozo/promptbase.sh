import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";

/**
 * Left-aligned breadcrumb back-link, mono micro-label style. Pass router Link
 * props (to/params) + the parent's name as children:
 *   <Breadcrumb to="/$slug" params={{ slug }}>Environments</Breadcrumb>
 */
export function Breadcrumb({
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className="label inline-flex w-fit items-center gap-1 transition-colors hover:text-foreground"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

/**
 * The one page header every main page shares: an optional breadcrumb, the DM
 * Mono title (+ optional inline status), an optional subtitle, right-aligned
 * actions, and an optional tab row below. Sits at the top of the content column
 * (the global workspace bar lives in the $slug layout), so spacing is uniform
 * across every page.
 */
export function PageHeader({
  back,
  title,
  subtitle,
  status,
  actions,
  tabs,
  className,
}: {
  back?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {back}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PageHeading>{title}</PageHeading>
            {status}
          </div>
          {subtitle && (
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {tabs && (
        <nav className="flex gap-5 border-b border-border pt-2">{tabs}</nav>
      )}
    </header>
  );
}
