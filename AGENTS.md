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
