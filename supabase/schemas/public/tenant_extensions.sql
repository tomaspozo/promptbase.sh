-- promptbase.sh additions to the scaffolded `tenants` table (project-owned;
-- multitenancy.sql stays @agentlink-managed).
--
--  - organization_id: links a tenant to a connected Supabase org. A tenant with
--    organization_id = NULL is "unlinked" and cannot create environments or
--    prompts until connected via OAuth (the onboarding gate).
--  - plan: billing tier. 'free' = 1 tenant per org; 'pro' = unlimited. No payment
--    provider in the MVP — gates only.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON public.tenants (organization_id);
