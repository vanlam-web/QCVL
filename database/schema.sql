create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  email text not null,
  password_hash text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create unique index if not exists users_email_unique_idx on users (lower(email));
create index if not exists users_organization_status_idx on users (organization_id, status);

create table if not exists workstations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists workstations_organization_status_idx on workstations (organization_id, status);

create table if not exists permissions (
  code text primary key check (code ~ '^perm\.[a-z0-9_]+$'),
  module text not null,
  description text not null,
  status text not null default 'active' check (status in ('active', 'inactive'))
);

create table if not exists user_permissions (
  user_id uuid not null references users(id) on delete cascade,
  permission_code text not null references permissions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create index if not exists user_permissions_permission_idx on user_permissions (permission_code);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists pos_product_usage (
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id text not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id)
);

create index if not exists pos_product_usage_rank_idx
  on pos_product_usage (organization_id, usage_count desc, product_id);

insert into permissions (code, module, description)
values
  ('perm.create_order', 'pos', 'Create POS orders'),
  ('perm.view_shift_report', 'pos', 'View shift reports'),
  ('perm.access_admin_panel', 'admin', 'Access admin panel'),
  ('perm.manage_users', 'admin', 'Manage users and permissions'),
  ('perm.apply_discount', 'pos', 'Apply order discounts'),
  ('perm.edit_order_locked', 'sales', 'Edit locked orders'),
  ('perm.edit_price_book', 'catalog', 'Edit price books'),
  ('perm.manage_finance', 'finance', 'Manage finance'),
  ('perm.manage_inventory', 'inventory', 'Manage inventory'),
  ('perm.refund_order', 'sales', 'Refund orders')
on conflict (code) do update
set module = excluded.module,
    description = excluded.description,
    status = 'active';

insert into organizations (code, name)
values ('VAN-LAM', 'Xuong Van Lam')
on conflict (code) do update set name = excluded.name;

insert into workstations (organization_id, code, name)
select id, 'POS-01', 'Quay thu ngan 1'
from organizations
where code = 'VAN-LAM'
on conflict (organization_id, code) do update
set name = excluded.name,
    status = 'active';
