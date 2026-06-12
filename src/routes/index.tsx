import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, X, History, Variable, Database, Code } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist-form";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/")({
  component: Home,
});

const SCOPE_IS = [
  "System prompt management",
  "User message templates",
  "Variable interpolation",
  "Version history & rollback",
  "Easily editable by your team",
  "Runs on your own Supabase",
];

const SCOPE_NOT = [
  "An observability platform",
  "An evals framework",
  "A conversation manager",
  "A tool/function registry",
  "Another Langfuse",
];

const FEATURES = [
  {
    icon: History,
    title: "Full version history",
    desc: "Every publish is a version. Roll back to any of them in one click.",
  },
  {
    icon: Variable,
    title: "Variable interpolation",
    desc: (
      <>
        Use <code className="font-mono text-[11px]">{`{{variables}}`}</code> in
        both system and user templates, pass values at runtime.
      </>
    ),
  },
  {
    icon: Database,
    title: "Your infra, always",
    desc: "Runs entirely on your own Supabase project. No new vendors, no data leaving your stack.",
  },
  {
    icon: Code,
    title: "Any LLM, any framework",
    desc: "Compatible with ai-sdk, OpenAI, Anthropic, and anything that accepts a plain string.",
  },
];

const sectionLabel =
  "mb-8 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70";

function Home() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      {/* NAV */}
      <nav className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-[720px] items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-[7px] font-mono text-[15px] font-medium text-foreground"
          >
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
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

      {/* HERO */}
      <div className="mx-auto max-w-[720px] px-8 pb-12 pt-20 text-center">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.1em] text-primary">
          Prompt management you own
        </p>
        <h1 className="mb-5 font-mono text-[38px] leading-[1.1] tracking-[-0.02em] sm:text-[52px]">
          Your prompts deserve
          <br />
          better than a <span className="text-primary">const</span>
        </h1>
        <p className="mx-auto mb-10 max-w-[440px] text-[17px] leading-[1.6] text-muted-foreground">
          Version-controlled system prompts and message templates that run in
          your own Supabase — easily editable by your team.
        </p>

        <WaitlistForm />
      </div>

      <hr className="mx-auto max-w-[720px] border-border" />

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[720px] px-8 py-12">
        <p className={sectionLabel}>how it works</p>

        <div className="grid grid-cols-[32px_1fr] gap-4 border-b border-border py-5">
          <span className="pt-0.5 font-mono text-xs text-muted-foreground/70">
            01
          </span>
          <div>
            <p className="mb-1.5 text-[15px] font-medium">
              Connect your Supabase — one click
            </p>
            <p className="text-sm leading-[1.6] text-muted-foreground">
              Sign in, authorize your Supabase organization, and pick a project.
              We deploy the prompt store and edge functions into it for you — no
              CLI, no migrations to run.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[32px_1fr] gap-4 border-b border-border py-5">
          <span className="pt-0.5 font-mono text-xs text-muted-foreground/70">
            02
          </span>
          <div>
            <p className="mb-1.5 text-[15px] font-medium">
              Your team edits prompts — no GitHub needed
            </p>
            <p className="text-sm leading-[1.6] text-muted-foreground">
              Invite your partner or content team. They edit system prompts and
              message templates, publish new versions, and roll back — all from
              a clean UI, right in promptbase.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[32px_1fr] gap-4 py-5">
          <span className="pt-0.5 font-mono text-xs text-muted-foreground/70">
            03
          </span>
          <div>
            <p className="mb-1.5 text-[15px] font-medium">
              Fetch at runtime, not at deploy time
            </p>
            <p className="text-sm leading-[1.6] text-muted-foreground">
              Pull the latest published version from your own project. Changes
              go live instantly — no server restart, no redeploy.
            </p>
            <pre className="mt-2.5 overflow-x-auto whitespace-pre rounded-md border border-border bg-secondary px-3.5 py-3 font-mono text-xs leading-[1.8] text-muted-foreground">
              <span className="text-primary">const</span> {"{ system, user } = "}
              <span className="text-primary">await</span> getPrompt(
              <span className="text-mid">&apos;onboarding-email&apos;</span>
              {", {"}
              {"\n"}  name: user.name,{"\n"}  product:{" "}
              <span className="text-mid">&apos;Acme&apos;</span>
              {"\n})"}
              {"\n\n"}
              <span className="text-muted-foreground/60">
                {"// works with ai-sdk, OpenAI, Anthropic, or raw fetch"}
              </span>
            </pre>
          </div>
        </div>
      </section>

      <hr className="mx-auto max-w-[720px] border-border" />

      {/* SCOPE */}
      <section className="mx-auto max-w-[720px] px-8 py-12">
        <p className={sectionLabel}>what it is / what it&apos;s not</p>
        <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-secondary px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
              what it is
            </p>
            {SCOPE_IS.map((item) => (
              <div
                key={item}
                className="mb-2 flex items-start gap-2 text-[13px] leading-[1.4] text-muted-foreground"
              >
                <Check className="mt-px size-3.5 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-down">
              what it&apos;s not
            </p>
            {SCOPE_NOT.map((item) => (
              <div
                key={item}
                className="mb-2 flex items-start gap-2 text-[13px] leading-[1.4] text-muted-foreground"
              >
                <X className="mt-px size-3.5 shrink-0 text-down" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="mx-auto max-w-[720px] border-border" />

      {/* FEATURES */}
      <section className="mx-auto max-w-[720px] px-8 pb-14 pt-12">
        <p className={sectionLabel}>features</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-xl bg-secondary px-5 py-4"
              >
                <Icon className="mb-2 size-[18px] text-primary" />
                <p className="mb-1 text-sm font-medium">{feat.title}</p>
                <p className="text-[13px] leading-[1.5] text-muted-foreground">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-8 py-5">
        <div className="mx-auto flex max-w-[720px] items-center justify-between">
          <Wordmark className="font-mono text-[13px] text-muted-foreground/70" />
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
        </div>
      </footer>
    </div>
  );
}
