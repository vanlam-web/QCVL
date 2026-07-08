create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_groups_org_code_key unique (organization_id, code),
  constraint product_groups_id_org_key unique (id, organization_id),
  constraint product_groups_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint product_groups_name_check check (char_length(btrim(name)) between 1 and 120)
);

create unique index if not exists product_groups_one_active_default_per_org
  on public.product_groups (organization_id)
  where is_default = true and is_active = true;

create index if not exists idx_product_groups_org_active
  on public.product_groups (organization_id, is_active);

create trigger set_product_groups_updated_at
before update on public.product_groups
for each row execute function public.set_updated_at();

insert into public.product_groups (organization_id, code, name, is_default, is_active)
select o.id, 'GENERAL', 'Giá chung', true, true
from public.organizations o
where not exists (
  select 1
  from public.product_groups pg
  where pg.organization_id = o.id
    and pg.is_default = true
    and pg.is_active = true
);

alter table public.products
  add column if not exists product_group_id uuid;

update public.products p
set product_group_id = pg.id
from public.product_groups pg
where pg.organization_id = p.organization_id
  and pg.is_default = true
  and pg.is_active = true
  and p.product_group_id is null;

alter table public.products
  add constraint products_product_group_org_fkey foreign key (product_group_id, organization_id)
    references public.product_groups(id, organization_id) on delete restrict;

create index if not exists idx_products_org_group
  on public.products (organization_id, product_group_id);

alter table public.product_groups enable row level security;

grant select, insert, update, delete on public.product_groups to service_role;
