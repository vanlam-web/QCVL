create table if not exists customer_debt_adjustments (
  id text primary key default gen_random_uuid()::text,
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id text not null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  source_code text not null,
  source_system text not null default 'kiotviet',
  source_file text,
  source_row integer,
  transaction_type text not null default 'adjustment',
  amount_delta numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null,
  balance_after numeric(14,2) not null default 0,
  status text not null check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_system, source_code)
);

create index if not exists customer_debt_adjustments_customer_idx
  on customer_debt_adjustments (organization_id, customer_id, status, created_at desc);
