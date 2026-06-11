import { cn } from "@/lib/utils";

/**
 * The "promptbase.sh" wordmark with the brand-green period. Use anywhere the
 * brand name appears as text. Inherits font + color from context; only the dot
 * is green.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn(className)}>
      promptbase
      <span className="text-primary text-[1.4em] leading-0 mx-[-0.09em] align-baseline">
        .
      </span>
      sh
    </span>
  );
}
