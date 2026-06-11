import { cn } from "@/lib/utils";

/**
 * promptbase.sh mark — the wordmark's "p" in DM Mono (the brand mono face) plus
 * the brand green dot: "p." The "p" inherits the surrounding text color
 * (currentColor); the dot is always brand green. Size it with a text-size class.
 *
 *   <Logo className="text-2xl" />                 // size via font-size
 *   <Logo className="text-xl text-foreground" />  // explicit color
 *
 * The favicon (public/favicon.svg) is the same mark as a standalone SVG.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-label="promptbase.sh"
      className={cn(
        "select-none font-mono font-medium leading-none tracking-tight",
        className,
      )}
    >
      p
      <span className="text-primary text-[1.4em] leading-0 mx-[-0.09em] align-baseline">
        .
      </span>
    </span>
  );
}
