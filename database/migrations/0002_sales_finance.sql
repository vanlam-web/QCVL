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
  base_code text,
  revision_no integer not null default 0,
  revised_from_order_id text references orders(id) on delete set null,
  replaced_by_order_id text references orders(id) on delete set null,
  cancel_reason_type text,
  revision_reason_code text,
  revision_reason_note text,
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
