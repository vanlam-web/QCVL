create table if not exists supplier_payment_operations (
  organization_id uuid not null references organizations(id) on delete cascade,
  operation_id uuid not null,
  supplier_id text not null,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, operation_id)
);

create index if not exists supplier_payment_operations_org_created_idx
  on supplier_payment_operations (organization_id, created_at desc);