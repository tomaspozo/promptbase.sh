#!/usr/bin/env python3
"""Generate supabase/functions/_shared/promptbase-templates.ts from the
deno-checked templates in supabase/functions/_templates/promptbase/.

The templates are the source of truth (type-checked with `deno check`); this
script JSON-escapes them into string constants that the environment-install
edge function uploads to a user's project via the Management API.

Run from the repo root:  python3 scripts/gen-promptbase-templates.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
base = ROOT / "supabase/functions/_templates/promptbase"
get_src = (base / "promptbase-get/index.ts").read_text()
manage_src = (base / "promptbase-manage/index.ts").read_text()
deno_json = (base / "promptbase-get/deno.json").read_text()
migration = (base / "migration.sql").read_text()
version = (base / "VERSION").read_text().strip()

out = '''// AUTO-GENERATED from supabase/functions/_templates/promptbase/ — do not edit by
// hand. Regenerate after changing the templates (the templates are the
// deno-checked source of truth):
//   python3 scripts/gen-promptbase-templates.py
//
// These are the deployable artifacts the environment-install function uploads
// into a user's Supabase project via the Management API.

export const PROMPTBASE_GET_SRC = %s;

export const PROMPTBASE_MANAGE_SRC = %s;

export const PROMPTBASE_DENO_JSON = %s;

export const PROMPTBASE_MIGRATION_SQL = %s;

export const PROMPTBASE_VERSION = %s;
''' % (json.dumps(get_src), json.dumps(manage_src), json.dumps(deno_json), json.dumps(migration), json.dumps(version))

(ROOT / "supabase/functions/_shared/promptbase-templates.ts").write_text(out)
print("wrote supabase/functions/_shared/promptbase-templates.ts")
