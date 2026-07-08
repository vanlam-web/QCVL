create extension if not exists pgcrypto with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_code_key unique (code),
  constraint organizations_code_format_check check (code ~ '^[A-Z0-9-]+$'),
  constraint organizations_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint organizations_status_check check (status in ('active', 'inactive'))
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  display_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check check (char_length(btrim(display_name)) between 1 and 100),
  constraint profiles_status_check check (status in ('active', 'inactive'))
);

create index idx_profiles_organization_id on public.profiles (organization_id);
create index idx_profiles_org_status on public.profiles (organization_id, status);

create table public.workstations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workstations_org_code_key unique (organization_id, code),
  constraint workstations_code_format_check check (code ~ '^[A-Z0-9-]+$'),
  constraint workstations_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint workstations_status_check check (status in ('active', 'inactive'))
);

create index idx_workstations_org_status on public.workstations (organization_id, status);

create table public.permissions (
  code text primary key,
  module text not null,
  description text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint permissions_code_format_check check (code ~ '^perm\.[a-z0-9_]+$'),
  constraint permissions_module_check check (char_length(btrim(module)) between 1 and 100),
  constraint permissions_description_check check (char_length(btrim(description)) between 1 and 255),
  constraint permissions_status_check check (status in ('active', 'deprecated'))
);

create table public.user_permissions (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete restrict,
  granted_by uuid not null references public.profiles(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create index idx_user_permissions_permission_code on public.user_permissions (permission_code);

create table public.permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  target_user_id uuid not null references public.profiles(user_id) on delete restrict,
  action text not null,
  permissions_before jsonb not null,
  permissions_after jsonb not null,
  trace_id text not null,
  created_at timestamptz not null default now(),
  constraint permission_audit_logs_action_check check (action in ('grant', 'revoke', 'replace')),
  constraint permission_audit_logs_before_is_array_check check (jsonb_typeof(permissions_before) = 'array'),
  constraint permission_audit_logs_after_is_array_check check (jsonb_typeof(permissions_after) = 'array'),
  constraint permission_audit_logs_trace_id_check check (char_length(btrim(trace_id)) > 0)
);

create index idx_permission_audit_target_time on public.permission_audit_logs (target_user_id, created_at desc);
create index idx_permission_audit_actor_time on public.permission_audit_logs (actor_user_id, created_at desc);
create index idx_permission_audit_org_time on public.permission_audit_logs (organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_workstations_updated_at
before update on public.workstations
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.workstations enable row level security;
alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.permission_audit_logs enable row level security;
