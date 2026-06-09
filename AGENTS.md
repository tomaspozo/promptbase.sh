<!-- agentlink:config:start -->
# Project Configuration

This is a **local** Supabase project running in Docker.

## Local Development Commands

| Task | Command |
|------|---------|
| Start Supabase | `supabase start` |
| Apply schemas | `npx agentlink-sh@latest db apply` |
| Generate migration | `npx agentlink-sh@latest db migrate name` |
| Generate types | `npx agentlink-sh@latest db types` |
| Run SQL | `npx agentlink-sh@latest db sql "SELECT ..."` |
| Serve edge functions | `supabase functions serve` |
| Deploy to production | `npx agentlink-sh@latest env deploy prod --yes` |
| Switch environment | `npx agentlink-sh@latest env use <name>` |
| List environments | `npx agentlink-sh@latest env list` |

## Finding connection details

Run `supabase status` to get the local API URL, DB URL, publishable key, and secret key.

## Deployment

**The agent deploys to the active dev env freely; it does not target `prod` without explicit user approval.** Local mode means the active DB is your Docker Supabase — `db apply` and `supabase functions serve` run there as part of normal feature work, no developer approval needed. Production deploys (`npx agentlink-sh@latest env deploy prod` from a project that has prod connected) are always developer-initiated, never autonomous.
<!-- agentlink:config:end -->

# promptbase.sh — Project Brief

## What we're building

**Version-controlled prompt management you own — it runs entirely in your own Supabase.** System prompts and user message templates live in a database you own, are editable through a clean UI by non-engineers (partners, content teams), and are fetched at runtime by application code — so prompt changes go live instantly without a redeploy.

> Positioning note: lead with **ownership** ("you own it / runs in your Supabase / your data never leaves your stack"), **not** "self-hosted" — the latter reads as an install/ops burden rather than the actual value (control + data ownership). Security/privacy are *consequences* of ownership, not the headline. Eyebrow copy: **"Prompt management you own."**

**Target user:** developers and small teams building LLM-powered products who are tired of hardcoding prompts in `const` strings, want their prompts editable by non-engineers, and don't want to ship data to a third-party prompt SaaS.

**Positioning (what it is NOT):** not an observability platform, not an evals framework, not a conversation manager, not a tool/function registry, not "another Langfuse." Scope stays deliberately narrow: prompt storage, versioning, and runtime delivery.

## Features (v1)

- System prompt management
- User message templates
- Variable interpolation — `{{variables}}` in both system and user templates, values passed at runtime
- Full version history & one-click rollback (publish/draft model)
- Team-editable via a web UI — no GitHub required to edit a prompt
- Runtime fetch of the latest published version (SDK / RPC), framework-agnostic (ai-sdk, OpenAI, Anthropic, raw fetch)
- One-command install onto the user's own Supabase

**Deferred / explicitly out of scope:** observability, evals, conversation/thread management, tool registries.

## Multi-tenancy

A **tenant = a workspace** (a team/project that owns a set of prompts). The scaffolded `tenants` + `memberships` + `invitations` tables are kept. Prompts, prompt versions, and variables are all **tenant-scoped** — isolation enforced by RLS on `tenant_id`, permission/action authz via RPC guards. Team editing (the core value prop) maps directly onto memberships/invitations.

## Look & feel

- **Entry point:** public-facing. `/` is a marketing **landing page** (currently a "coming soon" + waitlist page). The gated editor app will live behind auth (e.g. `/dashboard`). Landing is implemented at `app/page.tsx` with scoped styles in `app/landing.module.css`.
- **Brand colors:** green accent `#1D9E75` (dark `#0F6E56`), warm paper backgrounds (`#ffffff` / `#f6f6f4` light, `#1a1a18` / `#242422` dark). Follows system color scheme on the landing.
- **Typography:** DM Mono (display headline + labels, eyebrows, code) and DM Sans (body). The hero headline is set in DM Mono, leaning into the "better than a `const`" code theme; the emphasized word (`const`) is distinguished by green color only, not italic. Loaded via `next/font` in `app/layout.tsx`. (Instrument Serif was trialled and dropped — too common on vibe-coded apps.)

> Note: the app's auth/scaffold pages still use the default Swiss theme (Hanken Grotesk / IBM Plex Mono). The promptbase brand stack is currently scoped to the landing page. Align the editor UI to the brand stack when it's built.

## Main entities

- **prompt** — a named, tenant-scoped prompt (e.g. `onboarding-email`). Has a slug/key, optional description.
- **prompt_version** — an immutable revision of a prompt's system + user template, with publish state (draft/published) enabling history & rollback.
- **variable** — the `{{variables}}` a prompt template expects; values supplied at runtime.
- **tenant / membership / invitation** — scaffolded; a tenant is a workspace, members edit prompts.
- **waitlist** (pre-launch) — landing-page email capture; currently a localStorage placeholder in `components/waitlist-form.tsx`, to be wired to an edge function / `api.waitlist_join` RPC.

## Decisions to track

- Landing waitlist form is a **frontend placeholder** (localStorage). Wire it to a real backend before launch.
- Icons: using `lucide-react` (Tabler icons from the original mockup mapped to lucide equivalents; `ti-brand-supabase` → `Database`).
- Footer GitHub/Supabase links are placeholders pointing at the bare domains — update once the repo exists.
- Brand fonts/colors are landing-scoped for now; promote to a shared theme when building the editor app.
- **Planned: migrate the frontend from Next.js to TanStack Start** (ref: https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs). Deferred — current site is built on the scaffolded Next.js app. When migrating: the landing (`app/page.tsx` + `app/landing.module.css`), the `WaitlistForm` client component, the `next/font` setup in `app/layout.tsx`, and the Supabase auth/scaffold pages all move to Start's routing/SSR model. The CSS module and brand fonts port over with minor changes; `next/font` → TanStack/`@fontsource` or a `<link>` approach.
