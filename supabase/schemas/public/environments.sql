-- Environments — each maps to ONE real Supabase project (dev, prod, …) under a
-- tenant. Holds the Vault secret id for that project's promptbase edge-function
-- key (never the key itself), plus install state.
--
-- Tenant-scoped reads use the active-tenant JWT claim (mirror `memberships`).
-- Writes (create/install/update/delete) happen through the `environment-install`
-- edge function + permission-guarded `api.environment_*` RPCs (service_role),
-- so there are no direct authenticated write policies.

CREATE TABLE IF NOT EXISTS public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supabase_project_ref TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  secret_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  installed BOOLEAN NOT NULL DEFAULT false,
  promptbase_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One environment per Supabase project (re-install updates it in place).
  UNIQUE (supabase_project_ref)
);

ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environments TO authenticated, service_role;

-- Idempotent migrations for already-created databases (the CREATE TABLE IF NOT
-- EXISTS above is skipped when the table already exists, so column + constraint
-- changes need explicit ALTERs).
ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS promptbase_version text;
ALTER TABLE public.environments DROP CONSTRAINT IF EXISTS environments_tenant_id_name_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'environments_supabase_project_ref_key'
      AND conrelid = 'public.environments'::regclass
  ) THEN
    ALTER TABLE public.environments
      ADD CONSTRAINT environments_supabase_project_ref_key UNIQUE (supabase_project_ref);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_environments_tenant_id ON public.environments (tenant_id);

DROP POLICY IF EXISTS members_read_environments ON public.environments;
CREATE POLICY members_read_environments ON public.environments
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public._auth_tenant_id()));

DROP TRIGGER IF EXISTS trg_environments_updated_at ON public.environments;
CREATE TRIGGER trg_environments_updated_at
  BEFORE UPDATE ON public.environments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
