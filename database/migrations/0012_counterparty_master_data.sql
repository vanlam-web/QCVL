create table if not exists employees (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  phone text,
  note text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employees_org_code_uidx
  on employees (organization_id, lower(code));

create index if not exists employees_org_status_name_idx
  on employees (organization_id, status, name);

create table if not exists delivery_partners (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  phone text,
  note text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_partners_org_code_uidx
  on delivery_partners (organization_id, lower(code));

create index if not exists delivery_partners_org_status_name_idx
  on delivery_partners (organization_id, status, name);
