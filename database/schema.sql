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
  username text,
  phone text,
  birthday date,
  region text,
  ward text,
  address text,
  note text,
  password_hash text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create unique index if not exists users_email_unique_idx on users (lower(email));
create unique index if not exists users_org_username_uidx
  on users (organization_id, lower(username))
  where username is not null and btrim(username) <> '';
create index if not exists users_organization_status_idx on users (organization_id, status);
create index if not exists users_org_created_idx on users (organization_id, created_at desc);

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

create table if not exists orders (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  order_type text not null check (order_type in ('invoice', 'quote')),
  status text not null,
  customer_id text,
  customer_snapshot jsonb not null,
  seller_snapshot jsonb not null,
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  debt_amount numeric(14,2) not null default 0,
  payment_status text not null,
  note text not null default '',
  source_quote_id text references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists orders_org_type_created_idx
  on orders (organization_id, order_type, created_at desc);

create index if not exists orders_org_updated_created_idx
  on orders (organization_id, updated_at desc, created_at desc);

create index if not exists orders_org_customer_idx
  on orders (organization_id, customer_id);

create table if not exists order_items (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  quantity numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create index if not exists order_items_order_idx on order_items (order_id, sort_order);

create table if not exists payment_receipts (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  customer_id text,
  order_id text references orders(id) on delete set null,
  total_received_amount numeric(14,2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists payment_receipt_methods (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  payment_receipt_id text not null references payment_receipts(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  method text not null check (method in ('cash', 'bank_transfer')),
  finance_account_id text not null,
  amount numeric(14,2) not null,
  bank_transaction_ref text,
  allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_debt_entries (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id text not null,
  order_id text not null references orders(id) on delete cascade,
  original_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  remaining_debt numeric(14,2) not null,
  status text not null check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create index if not exists customer_debt_entries_customer_idx
  on customer_debt_entries (organization_id, customer_id, status, created_at desc);

create index if not exists customer_debt_entries_customer_updated_idx
  on customer_debt_entries (organization_id, customer_id, status, updated_at desc, created_at desc);

create table if not exists cashbook_entries (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  status text not null default 'posted',
  direction text not null check (direction in ('in', 'out')),
  amount_delta numeric(14,2) not null,
  finance_account jsonb not null,
  counterparty jsonb not null,
  note text not null default '',
  source_type text not null,
  source jsonb not null default '{}'::jsonb,
  allocations jsonb not null default '[]'::jsonb,
  is_business_accounted boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists cashbook_entries_org_created_idx
  on cashbook_entries (organization_id, created_at desc);

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
