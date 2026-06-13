import { Link, createFileRoute } from "@tanstack/react-router";
import { History, Variable, Database, Code } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist-form";
import { PromptArtifact } from "@/components/prompt-artifact";
import { Wordmark } from "@/components/wordmark";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const Route = createFileRoute("/")({
  component: Home,
});

/** The product lifecycle — three real verbs, not decorative 01/02/03. */
const LIFECYCLE = [
  {
    verb: "install",
    body: "Authorize Supabase once. We add a prompt schema and two edge functions to your project — that's the whole footprint. Your prompts live in your database; we never store a copy.",
    spotlight: false,
  },
  {
    verb: "edit",
    body: "Invite your teammates — members write and publish prompts from a clean editor, saved straight to your Supabase. No pull request, no deploy, no waiting on an engineer.",
    spotlight: true,
  },
  {
    verb: "use",
    body: "Drop the getPrompt helper into your app — or ask your agent to add it — and call it anywhere. It reads the published version directly from your database, through your own edge function. Nothing routes through us.",
    spotlight: false,
  },
];

const FEATURES = [
  {
    icon: History,
    title: "Full version history",
    body: "Every publish is a version. Roll back to any of them in one click.",
  },
  {
    icon: Variable,
    title: "Variable interpolation",
    body: (
      <>
        Use <code className="font-mono text-primary">{`{{variables}}`}</code> in
        both system and user templates, filled with real values at runtime.
      </>
    ),
  },
  {
    icon: Database,
    title: "Your infra, always",
    body: "Runs entirely on your own Supabase. No new vendors, no data leaving your stack.",
  },
  {
    icon: Code,
    title: "Any LLM, any framework",
    body: "Works with ai-sdk, OpenAI, Anthropic, and anything that accepts a plain string.",
  },
];

const eyebrow =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-primary";
const sectionLabel =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60";

function Home() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      {/* NAV */}
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-5 sm:px-8">
          <Link
            to="/"
            className="font-mono text-[15px] font-medium text-foreground"
          >
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline">
              early access
            </span>
            <Link
              to="/auth/sign-in"
              className="rounded-md border border-border px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary"
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO — left thesis, right self-resolving artifact */}
      <header className="mx-auto max-w-[900px] px-6 pb-16 pt-16 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <p className={eyebrow}>Prompt management you own</p>
            <h1 className="mt-4 font-mono text-[34px] font-medium leading-[1.12] tracking-[-0.02em] sm:text-[44px]">
              Your prompts shouldn&apos;t
              <br className="hidden sm:block" /> be buried in code.
            </h1>
            <p className="mt-5 max-w-[440px] text-[17px] leading-[1.6] text-muted-foreground">
              Edit your system prompts and message templates like documents,
              version every change, and ship without a redeploy — all running in
              your own Supabase.
            </p>
            <div className="mt-8">
              <WaitlistForm />
            </div>
          </div>

          <div className="lg:pt-2">
            <PromptArtifact />
          </div>
        </div>
      </header>

      <hr className="mx-auto max-w-[900px] border-border" />

      {/* LIFECYCLE — connect / edit / fetch */}
      <section className="mx-auto max-w-[900px] px-6 py-14 sm:px-8">
        <p className={sectionLabel}>Setup to runtime</p>
        <div className="mt-8 space-y-1">
          {LIFECYCLE.map((step) => (
            <div
              key={step.verb}
              className={`grid grid-cols-[84px_1fr] items-baseline gap-4 rounded-lg px-3 py-4 sm:grid-cols-[120px_1fr] ${
                step.spotlight ? "bg-primary/[0.05]" : ""
              }`}
            >
              <span className="font-mono text-sm text-primary">
                {step.verb}
              </span>
              <p
                className={`text-[15px] leading-[1.6] ${
                  step.spotlight ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <hr className="mx-auto max-w-[900px] border-border" />

      {/* SCOPE — one declarative statement */}
      <section className="mx-auto max-w-[900px] px-6 py-14 sm:px-8">
        <p className={sectionLabel}>Scope</p>
        <p className="mt-6 max-w-[620px] text-[19px] leading-[1.55]">
          Prompt storage, versioning, and runtime delivery.{" "}
          <span className="text-muted-foreground">
            That&apos;s the whole job. Not an observability platform, not an
            evals framework, not a conversation manager — not another Langfuse.
          </span>
        </p>
      </section>

      <hr className="mx-auto max-w-[900px] border-border" />

      {/* FEATURES — scannable spec list, plain labels */}
      <section className="mx-auto max-w-[900px] px-6 py-14 sm:px-8">
        <p className={sectionLabel}>Features</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="rounded-xl bg-secondary p-5">
                <Icon className="mb-3 size-[18px] text-primary" />
                <p className="mb-1.5 text-[15px] font-medium">{feat.title}</p>
                <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
                  {feat.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-5 sm:px-8">
          <Wordmark className="font-mono text-[13px] text-muted-foreground/70" />
          <div className="flex items-center gap-2 sm:gap-4">
            <p className="text-[13px] text-muted-foreground/70">
              Built by{" "}
              <a
                href="https://x.com/tomaspozo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                tomaspozo
              </a>{" "}
              with{" "}
              <a
                href="https://agentlink.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                agentlink.sh
              </a>
            </p>
            <ThemeSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
