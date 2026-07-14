create table if not exists customer_snapshots (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  data jsonb not null,
  source_type text not null default 'kiotviet_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists customer_snapshots_org_updated_idx
  on customer_snapshots (organization_id, updated_at desc);

create table if not exists supplier_snapshots (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  data jsonb not null,
  source_type text not null default 'kiotviet_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists supplier_snapshots_org_updated_idx
  on supplier_snapshots (organization_id, updated_at desc);

create table if not exists purchase_receipt_snapshots (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  data jsonb not null,
  source_type text not null default 'kiotviet_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists purchase_receipt_snapshots_org_updated_idx
  on purchase_receipt_snapshots (organization_id, updated_at desc);
