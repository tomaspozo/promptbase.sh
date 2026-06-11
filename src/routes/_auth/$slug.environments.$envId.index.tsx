import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { promptsCall } from "@/lib/prompts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { PageHeader, Breadcrumb } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";

interface Prompt {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  updated_at: string;
  published_version: { id: string; published_at: string } | null;
}

export const Route = createFileRoute("/_auth/$slug/environments/$envId/")({
  component: PromptListPage,
});

function PromptListPage() {
  const { slug, envId } = Route.useParams();
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { prompts } = await promptsCall<{ prompts: Prompt[] }>(
          envId,
          "list",
        );
        setPrompts(prompts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load prompts");
      }
    }
    void load();
  }, [envId]);

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        back={
          <Breadcrumb to="/$slug" params={{ slug }}>
            Environments
          </Breadcrumb>
        }
        title="Prompts"
        actions={
          <>
            <Button asChild variant="outline" className="h-10">
              <Link
                to="/$slug/environments/$envId/settings"
                params={{ slug, envId }}
              >
                Settings
              </Link>
            </Button>
            <Button asChild className="h-10">
              <Link
                to="/$slug/environments/$envId/prompts/$promptId"
                params={{ slug, envId, promptId: "new" }}
              >
                New prompt
              </Link>
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="callout-error">
          {error}
        </p>
      )}

      {prompts === null ? (
        <Loading />
      ) : prompts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Create your first prompt"
          action={
            <Button asChild>
              <Link
                to="/$slug/environments/$envId/prompts/$promptId"
                params={{ slug, envId, promptId: "new" }}
              >
                New prompt
              </Link>
            </Button>
          }
        >
          Add a system prompt and message template, then publish it to use from
          your app.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {prompts.map((p) => (
            <Link
              key={p.id}
              to="/$slug/environments/$envId/prompts/$promptId"
              params={{ slug, envId, promptId: p.id }}
              className="block rounded-lg border border-border p-4 transition-colors hover:border-foreground/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {p.slug}
                  </p>
                </div>
                <StatusTag color={p.published_version ? "var(--up)" : "var(--mid)"}>
                  {p.published_version ? "published" : "draft"}
                </StatusTag>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {p.description ?? ""}
                </span>
                <span className="tnum shrink-0 font-mono text-xs text-muted-foreground">
                  updated {new Date(p.updated_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
