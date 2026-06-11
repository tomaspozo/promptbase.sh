import { Link } from "@tanstack/react-router";
import { PageHeading } from "@/components/page-heading";
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
        <div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Compass className="size-6" />
        </div>
        <PageHeading>Page not found</PageHeading>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have
          moved. Check the URL, or head back to the start.
        </p>
        <div className="mt-8">
          <Button asChild className="h-10">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
