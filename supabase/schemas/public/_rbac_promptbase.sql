-- promptbase.sh permissions + role mappings (project-owned; _rbac.sql stays
-- @agentlink-managed). Seeded idempotently. _hook_custom_access_token picks
-- these up into app_metadata.permissions on the next token mint.

INSERT INTO public.permissions (name, description) VALUES
  ('organization.read',   'View connected Supabase organizations'),
  ('organization.create', 'Connect a Supabase organization'),
  ('organization.delete', 'Disconnect a Supabase organization'),
  ('environment.read',    'View environments'),
  ('environment.create',  'Add and install an environment'),
  ('environment.update',  'Update environment settings'),
  ('environment.delete',  'Remove an environment'),
  ('prompt.read',         'View prompts in an environment'),
  ('prompt.write',        'Create, edit, and publish prompts')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_name) VALUES
  -- owner: everything
  ('owner', 'organization.read'),
  ('owner', 'organization.create'),
  ('owner', 'organization.delete'),
  ('owner', 'environment.read'),
  ('owner', 'environment.create'),
  ('owner', 'environment.update'),
  ('owner', 'environment.delete'),
  ('owner', 'prompt.read'),
  ('owner', 'prompt.write'),
  -- admin: manage org + environments + prompts
  ('admin', 'organization.read'),
  ('admin', 'organization.create'),
  ('admin', 'environment.read'),
  ('admin', 'environment.create'),
  ('admin', 'environment.update'),
  ('admin', 'environment.delete'),
  ('admin', 'prompt.read'),
  ('admin', 'prompt.write'),
  -- member: read org/envs, edit prompts
  ('member', 'organization.read'),
  ('member', 'environment.read'),
  ('member', 'prompt.read'),
  ('member', 'prompt.write'),
  -- viewer: read-only
  ('viewer', 'organization.read'),
  ('viewer', 'environment.read'),
  ('viewer', 'prompt.read')
ON CONFLICT (role_name, permission_name) DO NOTHING;
