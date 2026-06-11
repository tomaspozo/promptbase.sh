import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, X, History, Variable, Database, Code } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist-form";
import { Wordmark } from "@/components/wordmark";
import styles from "@/styles/landing.module.css";

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
        Use <code>{`{{variables}}`}</code> in both system and user templates,
        pass values at runtime.
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

function Home() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link className={styles.logo} to="/">
            <Wordmark />
          </Link>
          <div className={styles.navRight}>
            <span className={styles.navBadge}>early access</span>
            <Link className={styles.navLogin} to="/auth/sign-in">
              Log in
            </Link>
          </div>
        </div>
      </nav>

      <div className={styles.hero}>
        <p className={styles.eyebrow}>Prompt management you own</p>
        <h1 className={styles.title}>
          Your prompts deserve
          <br />
          better than a <em>const</em>
        </h1>
        <p className={styles.heroSub}>
          Version-controlled system prompts and message templates that run in
          your own Supabase — easily editable by your team.
        </p>

        <WaitlistForm />
      </div>

      <hr className={styles.divider} />

      <section className={styles.section}>
        <p className={styles.sectionLabel}>how it works</p>

        <div className={styles.step}>
          <span className={styles.stepNum}>01</span>
          <div>
            <p className={styles.stepTitle}>
              Connect your Supabase — one click
            </p>
            <p className={styles.stepDesc}>
              Sign in, authorize your Supabase organization, and pick a project.
              We deploy the prompt store and edge functions into it for you — no
              CLI, no migrations to run.
            </p>
          </div>
        </div>

        <div className={styles.step}>
          <span className={styles.stepNum}>02</span>
          <div>
            <p className={styles.stepTitle}>
              Your team edits prompts — no GitHub needed
            </p>
            <p className={styles.stepDesc}>
              Invite your partner or content team. They edit system prompts and
              message templates, publish new versions, and roll back — all from a
              clean UI, right in promptbase.
            </p>
          </div>
        </div>

        <div className={styles.step}>
          <span className={styles.stepNum}>03</span>
          <div>
            <p className={styles.stepTitle}>
              Fetch at runtime, not at deploy time
            </p>
            <p className={styles.stepDesc}>
              Pull the latest published version from your own project. Changes go
              live instantly — no server restart, no redeploy.
            </p>
            <div className={styles.codeBlock}>
              <span className={styles.kw}>const</span> {"{ system, user } = "}
              <span className={styles.kw}>await</span> getPrompt(
              <span className={styles.str}>&apos;onboarding-email&apos;</span>,
              {" {"}
              {"\n"} name: user.name,{"\n"} product:{" "}
              <span className={styles.str}>&apos;Acme&apos;</span>
              {"\n})"}
              {"\n\n"}
              <span className={styles.cm}>
                {"// works with ai-sdk, OpenAI, Anthropic, or raw fetch"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      <section className={styles.section}>
        <p className={styles.sectionLabel}>what it is / what it&apos;s not</p>
        <div className={styles.scopeGrid}>
          <div>
            <p className={`${styles.scopeColTitle} ${styles.yes}`}>
              what it is
            </p>
            {SCOPE_IS.map((item) => (
              <div className={styles.scopeItem} key={item}>
                <Check className={styles.yes} />
                {item}
              </div>
            ))}
          </div>
          <div>
            <p className={`${styles.scopeColTitle} ${styles.no}`}>
              what it&apos;s not
            </p>
            {SCOPE_NOT.map((item) => (
              <div className={styles.scopeItem} key={item}>
                <X className={styles.no} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      <section className={styles.section} style={{ paddingBottom: "3.5rem" }}>
        <p className={styles.sectionLabel}>features</p>
        <div className={styles.featuresGrid}>
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div className={styles.feat} key={feat.title}>
                <div className={styles.featIcon}>
                  <Icon />
                </div>
                <p className={styles.featTitle}>{feat.title}</p>
                <p className={styles.featDesc}>{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Wordmark className={styles.footerLogo} />
          <p className={styles.footerCredit}>
            Built by{" "}
            <a
              href="https://x.com/tomaspozo"
              target="_blank"
              rel="noopener noreferrer"
            >
              tomaspozo
            </a>{" "}
            with{" "}
            <a
              href="https://agentlink.sh"
              target="_blank"
              rel="noopener noreferrer"
            >
              agentlink.sh
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
