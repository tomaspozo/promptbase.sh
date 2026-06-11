-- promptbase.sh — per-environment schema, deployed into the USER's Supabase
-- project by the platform install flow. Prompt content lives here, in the
-- customer's own database; the platform never stores it.

create schema if not exists promptbase;

create table if not exists promptbase.prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Draft = a single mutable working copy per prompt (overwritten on each save,
-- never versioned). Versions (below) are immutable publish snapshots only.
-- CREATE TABLE IF NOT EXISTS is skipped for existing tables, so add the draft
-- columns idempotently for environments installed before this version.
alter table promptbase.prompts add column if not exists draft_system text;
alter table promptbase.prompts add column if not exists draft_user_template text;
alter table promptbase.prompts add column if not exists draft_variables jsonb default '[]';
alter table promptbase.prompts add column if not exists draft_updated_at timestamptz;
alter table promptbase.prompts add column if not exists draft_updated_by text;

create table if not exists promptbase.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references promptbase.prompts(id) on delete cascade,
  system text not null,
  user_template text,
  variables jsonb default '[]',
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  created_by text
);

-- At most one published version per prompt.
create unique index if not exists one_published_per_prompt
  on promptbase.prompt_versions(prompt_id)
  where is_published = true;

-- Access: the promptbase-* functions call PostgREST with the project's secret
-- key (service_role), so grant it access to the new schema. RLS is enabled with
-- no policies so the tables are NOT readable by anon/authenticated even though
-- the schema is exposed to the Data API — only service_role (which bypasses RLS)
-- can touch them.
grant usage on schema promptbase to service_role;
grant all privileges on all tables in schema promptbase to service_role;
alter default privileges in schema promptbase grant all on tables to service_role;

alter table promptbase.prompts enable row level security;
alter table promptbase.prompt_versions enable row level security;
