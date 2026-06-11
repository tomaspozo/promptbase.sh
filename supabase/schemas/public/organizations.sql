-- Organizations — one per connected Supabase org (via OAuth), owned by a user.
--
-- Holds the Vault secret ids for the org's OAuth access + refresh tokens (never
-- the tokens themselves). `supabase_org_id` is UNIQUE → exactly one platform
-- organization per Supabase org. Rows are created server-side by the
-- `supabase-oauth-callback` edge function (service_role, after the OAuth
-- handshake), so org identity is verified rather than user-claimed — hence no
-- authenticated INSERT policy. Users only read/manage their own.

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supabase_org_id TEXT NOT NULL UNIQUE,
  supabase_org_name TEXT,
  oauth_token_secret_id UUID,
  oauth_refresh_secret_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations (owner_id);

DROP POLICY IF EXISTS owner_read_organizations ON public.organizations;
CREATE POLICY owner_read_organizations ON public.organizations
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS owner_update_organizations ON public.organizations;
CREATE POLICY owner_update_organizations ON public.organizations
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS owner_delete_organizations ON public.organizations;
CREATE POLICY owner_delete_organizations ON public.organizations
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
