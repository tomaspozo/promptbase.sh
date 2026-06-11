import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Lock, MoreHorizontal } from "lucide-react";
import {
  promptsCall,
  detectVariables,
  interpolate,
  slugify,
} from "@/lib/prompts";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useHasPermission } from "@/hooks/use-has-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";
import { Breadcrumb } from "@/components/page-header";
import { Loading } from "@/components/loading";
import { StatusTag } from "@/components/status-tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnvOption {
  id: string;
  name: string;
}

interface Version {
  id: string;
  system: string;
  user_template: string | null;
  variables: unknown;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
}
interface Prompt {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  draft_system: string | null;
  draft_user_template: string | null;
  draft_variables: unknown;
}

const TOOLS = [
  { key: "ai-sdk", label: "ai-sdk" },
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "fetch", label: "raw fetch" },
] as const;

// Shared text-box metrics so the highlight overlay lines up pixel-for-pixel
// with the textarea on top of it.
const FIELD_BOX =
  "w-full whitespace-pre-wrap break-words rounded-md border px-3 py-2 font-mono text-sm leading-relaxed";

/** Render text with {{variables}} tokens highlighted in brand green. */
function highlightVars(text: string) {
  if (!text) return null;
  return text.split(/(\{\{\w+\}\})/g).map((part, i) =>
    /^\{\{\w+\}\}$/.test(part) ? (
      <span key={i} className="rounded-sm bg-primary/15 text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Auto-growing prompt textarea with a live {{variable}} highlight overlay and a
 * character count. The textarea sits transparent on top of a mirror div that
 * renders the highlighted text; the caret stays visible via caret-foreground.
 */
function PromptField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minRows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const minHeight = `calc(${minRows} * 1.625em + 1rem)`;

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {value.length} chars
        </span>
      </div>
      <div className="relative" style={{ minHeight }}>
        <div
          aria-hidden
          style={{ minHeight }}
          className={cn(
            FIELD_BOX,
            "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-foreground",
          )}
        >
          {highlightVars(value)}
          {"\n"}
        </div>
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{ minHeight }}
          className={cn(
            FIELD_BOX,
            "relative block resize-none border-input bg-transparent text-transparent caret-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
          )}
        />
      </div>
    </div>
  );
}

/** Underline tab button for the right-column inspect panels. */
function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className="-mb-px border-b-2 border-transparent pb-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary data-[active=true]:font-medium data-[active=true]:text-foreground"
    >
      {children}
    </button>
  );
}

export const Route = createFileRoute(
  "/_auth/$slug/environments/$envId/prompts/$promptId",
)({
  component: PromptEditor,
});

// Full, runnable Supabase Edge Function examples — imports + withSupabase
// ({ auth: "user" }) + getPrompt + the chosen LLM call. The getPrompt helper is
// the _shared/promptbase.ts file the install flow drops into the project.
function buildSnippet(tool: string, slug: string, vars: string[]): string {
  const varsObj = vars.length
    ? `{ ${vars.map((v) => `${v}: "…"`).join(", ")} }`
    : "{}";
  const s = slug || "your-slug";

  const tools: Record<string, { imports: string; body: string }> = {
    "ai-sdk": {
      imports:
        `import { generateText } from "npm:ai";\n` +
        `import { openai } from "npm:@ai-sdk/openai";\n`,
      body: `    const { text } = await generateText({
      model: openai("gpt-4o"),
      system,
      prompt: user ?? "",
    });

    return Response.json({ text });`,
    },
    openai: {
      imports: `import OpenAI from "npm:openai";\n`,
      body: `    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user ?? "" },
      ],
    });

    return Response.json(completion.choices[0].message);`,
    },
    anthropic: {
      imports: `import Anthropic from "npm:@anthropic-ai/sdk";\n`,
      body: `    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user ?? "" }],
    });

    return Response.json(message.content);`,
    },
    fetch: {
      imports: "",
      body: `    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${Deno.env.get("OPENAI_API_KEY")}\`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user ?? "" },
        ],
      }),
    });

    return Response.json(await res.json());`,
    },
  };

  const t = tools[tool] ?? tools["ai-sdk"];

  return `import { withSupabase } from "npm:@supabase/server";
${t.imports}import { getPrompt } from "../_shared/promptbase.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, _ctx) => {
    const { system, user } = await getPrompt("${s}", ${varsObj});

${t.body}
  }),
};`;
}

function PromptEditor() {
  // Aliased: this page also has a prompt `slug` of its own.
  const { slug: workspaceSlug, envId, promptId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = promptId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugLocked, setSlugLocked] = useState(false);
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("");
  const [userTemplate, setUserTemplate] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);

  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [tool, setTool] = useState<string>("ai-sdk");

  // Lifecycle actions (unpublish / delete / restore / promote).
  const canWrite = useHasPermission("prompt.write");
  const [busy, setBusy] = useState<string | null>(null);
  const [otherEnvs, setOtherEnvs] = useState<EnvOption[]>([]);
  const [promoteTarget, setPromoteTarget] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);
  const [tab, setTab] = useState<"preview" | "snippet" | "history">("preview");

  const variables = useMemo(
    () => detectVariables(system, userTemplate),
    [system, userTemplate],
  );

  const publishedVersion = useMemo(
    () => versions.find((v) => v.is_published) ?? null,
    [versions],
  );

  // Unpublished changes: the working copy differs from what's live (or nothing
  // is published yet but there's content).
  const dirty = useMemo(() => {
    if (!publishedVersion) return !!(system || userTemplate);
    return (
      system !== publishedVersion.system ||
      userTemplate !== (publishedVersion.user_template ?? "")
    );
  }, [system, userTemplate, publishedVersion]);

  // Sibling environments in this workspace — promote targets.
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.rpc("environment_list");
      const envs = ((data as unknown as EnvOption[]) ?? []).filter(
        (e) => e.id !== envId,
      );
      setOtherEnvs(envs);
    }
    void load();
  }, [envId]);

  async function refreshVersions(id: string) {
    const { versions } = await promptsCall<{ versions: Version[] }>(
      envId,
      "get",
      { prompt_id: id },
    );
    setVersions(versions);
  }

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  function unpublish() {
    if (isNew) return;
    void runAction("unpublish", async () => {
      await promptsCall(envId, "unpublish", { prompt_id: promptId });
      await refreshVersions(promptId);
      setStatus("Unpublished");
    });
  }

  function deletePrompt() {
    if (isNew) return;
    if (
      !window.confirm(
        "Delete this prompt and all its versions? This cannot be undone.",
      )
    )
      return;
    void runAction("delete", async () => {
      await promptsCall(envId, "delete", { prompt_id: promptId });
      navigate({
        to: "/$slug/environments/$envId",
        params: { slug: workspaceSlug, envId },
      });
    });
  }

  // Re-publish a past version's content as a new live version.
  function restore(v: Version) {
    if (isNew) return;
    void runAction(`restore:${v.id}`, async () => {
      await promptsCall(envId, "publish", {
        prompt_id: promptId,
        system: v.system,
        user_template: v.user_template,
        variables: v.variables,
      });
      setSystem(v.system);
      setUserTemplate(v.user_template ?? "");
      await refreshVersions(promptId);
      setStatus("Re-published");
    });
  }

  function promote() {
    if (!promoteTarget || !publishedVersion) return;
    const target = otherEnvs.find((e) => e.id === promoteTarget);
    void runAction("promote", async () => {
      await promptsCall(promoteTarget, "upsert_published", {
        slug,
        name,
        description: description || null,
        system: publishedVersion.system,
        user_template: publishedVersion.user_template,
        variables: publishedVersion.variables,
      });
      setPromoteOpen(false);
      setStatus(`Promoted to ${target?.name ?? "target"}`);
    });
  }

  // Load a past version into the editor (guards against clobbering edits).
  function loadVersion(v: Version, n: number) {
    const differs =
      system !== v.system || userTemplate !== (v.user_template ?? "");
    if (
      differs &&
      (system || userTemplate) &&
      !window.confirm(
        "Replace the editor contents with this version? Unsaved edits will be lost.",
      )
    )
      return;
    setSystem(v.system);
    setUserTemplate(v.user_template ?? "");
    setStatus(`Loaded v${n}`);
  }

  useEffect(() => {
    if (isNew) return;
    async function load() {
      try {
        const { prompt, versions } = await promptsCall<{
          prompt: Prompt;
          versions: Version[];
        }>(envId, "get", { prompt_id: promptId });
        setName(prompt.name);
        setSlug(prompt.slug);
        setSlugLocked(true);
        setDescription(prompt.description ?? "");
        // Working copy = the draft if present, else the published version.
        const published = versions.find((v) => v.is_published);
        if (typeof prompt.draft_system === "string") {
          setSystem(prompt.draft_system);
          setUserTemplate(prompt.draft_user_template ?? "");
        } else if (published) {
          setSystem(published.system);
          setUserTemplate(published.user_template ?? "");
        }
        setVersions(versions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load prompt");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [envId, promptId, isNew]);

  // Auto-slug from the name until the first publish locks it.
  useEffect(() => {
    if (!slugLocked) setSlug(slugify(name));
  }, [name, slugLocked]);

  async function persistVersion(publish: boolean) {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const content = {
        system,
        user_template: userTemplate || null,
        variables,
      };
      let id = isNew ? "" : promptId;
      if (isNew || !id) {
        // create seeds the draft from the content in one call.
        const { prompt } = await promptsCall<{ prompt: Prompt }>(
          envId,
          "create",
          { slug, name, description: description || null, ...content },
        );
        id = prompt.id;
        if (publish) {
          await promptsCall(envId, "publish", { prompt_id: id, ...content });
        }
      } else if (publish) {
        // Snapshot the current content into a new live version.
        await promptsCall(envId, "publish", { prompt_id: id, ...content });
      } else {
        // Overwrite the working copy — no version created.
        await promptsCall(envId, "save_draft", { prompt_id: id, ...content });
      }
      setStatus(publish ? "Published" : "Draft saved");
      if (isNew) {
        navigate({
          to: "/$slug/environments/$envId/prompts/$promptId",
          params: { slug: workspaceSlug, envId, promptId: id },
          replace: true,
        });
      } else {
        const { versions } = await promptsCall<{ versions: Version[] }>(
          envId,
          "get",
          { prompt_id: id },
        );
        setVersions(versions);
        setSlugLocked(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const snippet = buildSnippet(tool, slug, variables);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="animate-rise">
      {/* Header — breadcrumb + status + anchored actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Breadcrumb
            to="/$slug/environments/$envId"
            params={{ slug: workspaceSlug, envId }}
          >
            Prompts
          </Breadcrumb>
          {!isNew && (
            <StatusTag
              color={
                publishedVersion && !dirty ? "var(--up)" : "var(--mid)"
              }
            >
              {!publishedVersion
                ? "draft"
                : dirty
                  ? "unpublished changes"
                  : "published"}
            </StatusTag>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className="rounded-md bg-[color:var(--up)]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--up)]">
              {status}
            </span>
          )}
          <Button
            onClick={() => persistVersion(false)}
            disabled={saving || !canWrite || !name || !slug}
            variant="outline"
            size="sm"
            className="h-9"
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            onClick={() => persistVersion(true)}
            disabled={saving || !canWrite || !name || !slug || !system}
            size="sm"
            className="h-9"
          >
            Publish
          </Button>
          {!isNew && canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {publishedVersion && (
                  <DropdownMenuItem
                    onClick={unpublish}
                    disabled={busy === "unpublish"}
                  >
                    {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
                  </DropdownMenuItem>
                )}
                {otherEnvs.length > 0 && (
                  <DropdownMenuItem onClick={() => setPromoteOpen(true)}>
                    Promote to…
                  </DropdownMenuItem>
                )}
                {(publishedVersion || otherEnvs.length > 0) && (
                  <DropdownMenuSeparator />
                )}
                <DropdownMenuItem
                  onClick={deletePrompt}
                  disabled={busy === "delete"}
                  className="text-[color:var(--down)] focus:text-[color:var(--down)]"
                >
                  {busy === "delete" ? "Deleting…" : "Delete prompt"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Metadata — compact, clearly-editable fields */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Email classifier"
            className="h-10 text-base font-medium"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            {slugLocked && (
              <Lock
                className="size-3 text-muted-foreground"
                aria-label="Locked after first publish"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              disabled={slugLocked}
              placeholder="auto-from-name"
              className="h-10 font-mono text-sm disabled:opacity-100"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              aria-label="Copy slug"
              title="Copy slug"
              onClick={() => {
                if (!slug) return;
                navigator.clipboard?.writeText(slug);
                setSlugCopied(true);
                window.setTimeout(() => setSlugCopied(false), 1200);
              }}
            >
              {slugCopied ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this prompt does"
            className="h-10"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 callout-error">
          {error}
        </p>
      )}

      {/* Body — compose (left) · inspect tabs (right) */}
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <PromptField
            id="system"
            label="System prompt"
            value={system}
            onChange={setSystem}
            placeholder="You are a helpful assistant for {{product}}…"
            minRows={8}
          />
          <PromptField
            id="user"
            label="User template (optional)"
            value={userTemplate}
            onChange={setUserTemplate}
            placeholder="Write a welcome email for {{name}}."
            minRows={4}
          />
          {variables.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="label">variables</span>
              {variables.map((v) => (
                <Badge key={v} variant="outline" className="font-mono">
                  {v}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Right — inspect tabs */}
        <div>
          <div className="flex gap-5 border-b border-border">
            <Tab active={tab === "preview"} onClick={() => setTab("preview")}>
              Preview
            </Tab>
            <Tab active={tab === "snippet"} onClick={() => setTab("snippet")}>
              Snippet
            </Tab>
            {!isNew && (
              <Tab active={tab === "history"} onClick={() => setTab("history")}>
                History
              </Tab>
            )}
          </div>

          <div className="mt-5">
            {tab === "preview" && (
              <div className="space-y-3">
                {variables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add {"{{variables}}"} to your prompt to fill them in here.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {variables.map((v) => (
                      <div key={v} className="grid gap-1">
                        <Label
                          htmlFor={`var-${v}`}
                          className="font-mono text-xs"
                        >
                          {v}
                        </Label>
                        <Input
                          id={`var-${v}`}
                          value={varValues[v] ?? ""}
                          onChange={(e) =>
                            setVarValues((s) => ({
                              ...s,
                              [v]: e.target.value,
                            }))
                          }
                          className="h-9 rounded-md"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-md border border-border bg-secondary p-3">
                  <p className="label mb-1">system</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                    {interpolate(system, varValues) || "—"}
                  </pre>
                  {userTemplate && (
                    <>
                      <p className="label mb-1 mt-3">user</p>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                        {interpolate(userTemplate, varValues)}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === "snippet" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="label">Edge function</p>
                  <div className="flex gap-1">
                    {TOOLS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTool(t.key)}
                        className={`rounded-md px-2 py-1 font-mono text-xs ${
                          tool === t.key
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <CodeBlock code={snippet} language="tsx" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(snippet);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied ✓" : "Copy snippet"}
                </Button>
              </div>
            )}

            {tab === "history" && !isNew && (
              <div className="space-y-1">
                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No published versions yet — publish to start the history.
                    Drafts aren&rsquo;t versioned.
                  </p>
                ) : (
                  versions.map((v, i) => {
                    const n = versions.length - i;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="tnum font-mono text-xs">v{n}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {new Date(
                              v.published_at ?? v.created_at,
                            ).toLocaleString()}
                            {v.created_by ? ` · by ${v.created_by}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {v.is_published && <Badge>published</Badge>}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => loadVersion(v, n)}
                          >
                            Load
                          </Button>
                          {canWrite && !v.is_published && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => restore(v)}
                              disabled={busy === `restore:${v.id}`}
                            >
                              {busy === `restore:${v.id}`
                                ? "Restoring…"
                                : "Restore"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Promote dialog (opened from the ⋯ menu) */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote prompt</DialogTitle>
            <DialogDescription>
              Copy the published version into another environment — it publishes
              there too.
            </DialogDescription>
          </DialogHeader>
          {!publishedVersion ? (
            <p className="callout">Publish a version first to promote it.</p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="promote-target">Target environment</Label>
              <Select
                id="promote-target"
                value={promoteTarget}
                onChange={(e) => setPromoteTarget(e.target.value)}
              >
                <option value="">Select environment…</option>
                {otherEnvs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={promote}
              disabled={
                !canWrite ||
                !promoteTarget ||
                !publishedVersion ||
                busy === "promote"
              }
            >
              {busy === "promote" ? "Promoting…" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
