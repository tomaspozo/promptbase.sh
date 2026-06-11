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

## Architecture (how it actually works)

**Prompts live in the user's OWN Supabase project, not ours.** The platform database stores only **metadata** (accounts, orgs, workspaces, environments). Prompt content is never stored on our servers — that's the "you own it" guarantee.

**Hierarchy:** User → **Organization** (1 per connected Supabase org; holds the OAuth tokens in Vault) → **Workspace** (= a scaffolded `tenant`, gains `organization_id` + `plan`; the unit of billing + membership) → **Environment** (1 per real Supabase project) → **Prompts / versions** (live in that project, in a deployed `promptbase` schema).

**One-click install** (`supabase/functions/environment-install`): using the org's OAuth token + the Supabase Management API — run the migration (`promptbase` schema + `prompts`/`prompt_versions`), expose the schema to PostgREST, set a dedicated **`PROMPTBASE_SECRET`** function-secret, deploy the two edge functions, then **verify end-to-end** (publish→fetch→delete a healthcheck prompt) before recording the environment. No CLI — it's all OAuth + Management API.

**Deployed edge functions (in the user's project), templated under `supabase/functions/_templates/promptbase/`:**

- `promptbase-manage` — prompt CRUD (`list/get/create/save_draft/publish/unpublish/delete/upsert_published`).
- `promptbase-get` — runtime read of the published version by slug (the developer's app calls this; helper in `_shared/promptbase.ts`).
- Both use `auth: "none"` + a manual timing-safe check of the `x-promptbase-key` header against `PROMPTBASE_SECRET`. (`@supabase/server`'s `auth: "secret"` only matches the project's *default* secret key, so a custom key can't validate — hence the manual check.)

**The proxy** (`supabase/functions/prompts-proxy`, `auth: "user"`): the browser never holds env secrets. Browser → proxy → membership check → reads the env secret from Vault (`_admin_environment_proxy`) → calls the env's `promptbase-manage` with `x-promptbase-key`. The proxy also stamps `created_by` (the caller's display name from `profile_get`) onto version-creating actions.

**Draft / version model:** a **draft** is a single mutable working copy stored on the prompt (`draft_*` columns), overwritten on each *Save draft*, never versioned. **Versions** are immutable snapshots created only on *Publish*; History lists publishes (vN · date · by who). **Promote** copies a published version into another environment (`upsert_published`).

**Versioning the templates:** each env records `promptbase_version`; the UI flags "update available" when it differs from `PROMPTBASE_VERSION` (`src/lib/promptbase-version.ts`, mirrors `_templates/promptbase/VERSION`). Re-deploy re-runs the migration — `CREATE TABLE IF NOT EXISTS` is skipped for existing tables, so schema changes use idempotent `ALTER … ADD COLUMN IF NOT EXISTS`. Bump VERSION + `python3 scripts/gen-promptbase-templates.py` whenever a template changes.

**Plan gating:** `tenants.plan` (`free` | `pro`). Free = 1 owned workspace per account; `api.tenant_create` enforces it (raises with `HINT = 'plan_limit'`), and the WorkspaceSwitcher mirrors the gate + opens an upgrade dialog. MVP has no billing, so `api.tenant_upgrade` just flips the workspace to `pro`.

## Multi-tenancy

A **workspace = a scaffolded `tenant`**. The `tenants` + `memberships` + `invitations` tables are kept; workspaces gain `organization_id` + `plan`. **Prompts are NOT in the platform DB** — they live per-environment in the user's project, so isolation there is the deployed `PROMPTBASE_SECRET` + the platform's membership check in the proxy. Platform-side metadata (orgs/environments) is tenant-scoped via RLS on `tenant_id`; permission/action authz is via RPC `auth_verify_access()` guards. The active workspace is pinned to the session (`tenant_select` / claims); switching re-mints the JWT (`refreshSession()`).

## Look & feel

- **Entry point:** public-facing. `/` is a marketing **landing page** whose "Get early access" form starts the **sign-up** flow (early-access waitlist — see the Early-access waitlist section), plus a top-right **Log in** link to `/auth/sign-in`. The gated app lives behind auth: the post-login resolver `/app` redirects to the active workspace at **`/$slug`**; every workspace page shares a sticky top bar (workspace switcher + account menu) and the standard `PageHeader` (`src/components/page-header.tsx`). Landing is `src/routes/index.tsx` with scoped styles in `src/styles/landing.module.css`.
- **Brand colors:** green accent `#1D9E75` (dark `#0F6E56`), warm paper backgrounds (`#ffffff` / `#f6f6f4` light, `#1a1a18` / `#242422` dark). Follows system color scheme on the landing.
- **Typography:** DM Mono (display headline + labels, eyebrows, code) and DM Sans (body). The hero headline is set in DM Mono, leaning into the "better than a `const`" code theme; the emphasized word (`const`) is distinguished by green color only, not italic. Self-hosted via `@fontsource`, imported in `src/routes/__root.tsx`. (Instrument Serif was trialled and dropped — too common on vibe-coded apps.)

> Note: the full brand is now the **global** shadcn/Tailwind theme in `src/styles/globals.css` (`:root` + `.dark`): green `--primary`, warm paper backgrounds, green focus rings, landing red/amber state colors, **DM Sans body + DM Mono labels** (`--font-sans`/`--font-mono`), and an 8px radius (`--radius: 0.625rem` → `rounded-md` = 8px). So auth + dashboard + all shadcn components match the landing exactly (same fonts, same radius, same colors). The landing keeps its own self-contained CSS module but uses the same tokens. The old Swiss stack (Hanken Grotesk / IBM Plex Mono, 2px radius) is fully removed.

## Frontend stack

**TanStack Start (SSR) on Vite** — migrated from the original Next.js scaffold (agentlink scaffolds Next.js or a TanStack Router SPA, not Start, so the Start setup is hand-rolled).

- **Routing:** file-based under `src/routes/`. `__root.tsx` is the document shell (head, fonts, `ThemeProvider`) and loads the user via a `createServerFn` in `beforeLoad` → `context.user` (decoded JWT claims). `_anon.tsx` / `_auth.tsx` are pathless gate layouts (redirect signed-in users away from auth pages / redirect signed-out users to sign-in). `routeTree.gen.ts` is generated by the Vite plugin — git-ignored, never hand-edit.
- **Supabase clients:** `src/lib/supabase/client.ts` (browser, `@supabase/ssr` `createBrowserClient` — cookie-backed) and `src/lib/supabase/server.ts` (`getSupabaseServerClient()`, `createServerClient` + `@tanstack/react-start/server` `getCookies`/`setCookie`). Both use `{ db: { schema: "api" } }`. The session is read/refreshed in the root `beforeLoad` (replaces the old Next.js middleware/`proxy.ts`).
- **Auth gating:** session gate in `_auth.tsx beforeLoad`; **early-access approval gate** in the same `beforeLoad` (`!isAllowedFromClaims(context.user)` → `/pending`); permission gate in `src/routes/_auth/settings.members.tsx beforeLoad` via `permissionsFromClaims(context.user)` (replaces `permissions.server.ts`). All UX-only — the backend `auth_verify_access()` RPC guard is the real gate.
- **Client auth flows:** the `src/lib/auth/*` hooks are reused unchanged; the `@supabase/ssr` browser client writes the session to cookies, and forms call `router.invalidate()` after a successful auth action so the root re-reads `context.user` before entering a gated route.
- **Tooling:** `vite.config.ts` (`tanstackStart()` + `@vitejs/plugin-react` + `@tailwindcss/vite`), `@/*` → `src/*`. `pnpm dev` / `pnpm build` (Vite). **Note:** `vite build` does not type-check (esbuild strips types); typed-route navigation is intentionally loose in a few spots. Run `tsc --noEmit` separately if you want type coverage.

## Early-access waitlist

Sign-up is gated by a manual approval step. New users sign up + verify their email, then wait on `/pending` until an admin approves them.

- **Flag:** `profiles.allowed boolean not null default false` (added in `supabase/schemas/public/waitlist.sql`). Surfaced to the frontend as JWT claim `app_metadata.allowed` by `public._hook_custom_access_token`. Read via `isAllowedFromClaims()` in `src/lib/permissions.ts`.
- **Invited users bypass the waitlist:** `public._internal_admin_handle_new_user` sets `allowed = true` when `NEW.invited_at IS NOT NULL` or a pending invitation matches the email. Organic sign-ups stay `false`.
- **Approval = a manual DB write:** `UPDATE public.profiles SET allowed = true WHERE email = '…';` (Supabase Studio or SQL). A trigger (`trg_profiles_approved` → `public._waitlist_on_approved`) enqueues the branded approval email via the existing pgmq queue → `internal-queue-worker` → **`internal-send-approval-email`** edge function (template at `…/_templates/approval.tsx`, reusing the shared brand chrome). The email links to `${APP_URL}/pending`.
- **Frontend flow:** landing "Get early access" → `/auth/sign-up?email=…` (prefilled) → verify → `/auth/confirm` → `/dashboard` → `_auth` gate → **`/pending`** (`src/routes/pending.tsx`). `/pending` refreshes the session on mount + a "Check status" button; once `allowed` flips, the next mint carries `app_metadata.allowed = true` and the route forwards to `/dashboard`.
- **Write-safety:** no `api.*` RPC writes `allowed` (only `display_name`/`avatar_url` are mutable via `api.profile_update`); `public` isn't exposed via the Data API, so users can't self-approve.
- **Managed-function overrides:** `_hook_custom_access_token` and `_internal_admin_handle_new_user` had their `-- @agentlink` annotations **removed** (project-owned now) to add the `allowed` claim and the invite-bypass. They no longer receive CLI template updates; other functions in those files stay managed.
- **Env:** `APP_URL` (e.g. `http://localhost:3000` dev) drives the email links — used by both the approval and team-invite functions. Set it as a secret before deploying to cloud.
- **Caveat — `db types` output path:** `agentlink.json` still has `frontend: nextjs`, so `db types` writes to a root `types/database.ts` (Next.js path) rather than `src/types/`. The app uses the `src/types/database.ts` placeholder and casts RPC results, so this is harmless — delete the stray root `types/` if regenerated, or move it to `src/types/` if you want the real generated types.

## Main entities

Platform DB (metadata only):

- **organization** — one per connected Supabase org; owner-scoped; holds the OAuth access/refresh tokens (in Vault). `public/organizations.sql`.
- **workspace / tenant / membership / invitation** — scaffolded; a workspace = a tenant (gains `organization_id` + `plan`); members edit prompts. Billing + access boundary.
- **environment** — one per real Supabase project a workspace deploys into; tenant-scoped; stores the project ref/URL, the Vault `secret_id`, `installed`, and `promptbase_version`. `public/environments.sql`.
- **early-access / `profiles.allowed`** — real sign-up + manual approval gate (see the Early-access waitlist section).

In the user's OWN project (the `promptbase` schema deployed by install — never in the platform DB):

- **prompt** — a named prompt (slug/key, optional description) + its **draft** working copy (`draft_*` columns).
- **prompt_version** — an immutable publish snapshot (system + user template + variables + `created_by`); one is live (`is_published`). History & rollback.
- **variable** — the `{{variables}}` a template expects; values supplied at runtime by the developer's app.

## Decisions to track

- **DONE: waitlist is a real sign-up + approval gate** (`profiles.allowed`, see Early-access waitlist section). Approval is manual via Supabase Studio for now; a future admin UI (`/admin/waitlist` + `waitlist.approve` permission) could replace the manual SQL.
- Icons: using `lucide-react` (Tabler icons from the original mockup mapped to lucide equivalents; `ti-brand-supabase` → `Database`).
- Footer now credits **Built by [tomaspozo](https://x.com/tomaspozo) with [agentlink.sh](https://agentlink.sh)** (replaced the placeholder GitHub/Supabase links).
- **DONE: full brand promoted to the global theme** (`src/styles/globals.css`): green `--primary` (#1d9e75) + green `--ring`, warm paper backgrounds, landing red/amber state colors, **DM Sans body + DM Mono labels**, and 8px radius (`--radius: 0.625rem`). Hardcoded `rounded-[2px]` overrides removed from the auth forms (they use `rounded-md` now). Hanken Grotesk + IBM Plex Mono `@fontsource` deps removed. Auth + dashboard now match the landing pixel-for-pixel on fonts/radius/colors.
- **DONE: migrated the frontend from Next.js to TanStack Start (SSR)** — see the "Frontend stack" section above. App code moved under `src/`; Next.js/PostCSS removed. Env vars renamed `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (update `.env.local`). The protected dashboard route is now `/dashboard` (was `/protected`).
- `agentlink.json` still reads `"frontend": "nextjs"` — **stale but intentionally left as-is.** agentlink's managed resources are backend SQL/config (`@agentlink`-annotated), not frontend files, so `--force-update` won't touch the hand-rolled Start frontend. Don't let the field mislead you: the frontend is TanStack Start.
- Lint uses a minimal flat config (TS parser, no rule set) since the Next eslint preset was removed; `vite build` is the real gate. Tighten with `typescript-eslint` recommended rules later if desired.
