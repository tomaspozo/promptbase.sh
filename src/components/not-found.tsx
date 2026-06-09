import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Branded 404. Wired as the root route's notFoundComponent, so it renders
 * inside the themed document shell (fonts + colors from globals.css).
 */
export function NotFound() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-2xl animate-rise flex-col items-center px-6 py-24 text-center">
        <p className="label mb-6">Error 404</p>
        <div className="mb-5 rounded-2xl bg-muted p-4">
          <Compass className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have
          moved. Check the URL, or head back to the start.
        </p>
        <div className="mt-8">
          <Button asChild className="h-11">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
