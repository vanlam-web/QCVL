create table public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  price_list_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_groups_org_code_key unique (organization_id, code),
  constraint customer_groups_id_org_key unique (id, organization_id),
  constraint customer_groups_price_list_org_fkey foreign key (price_list_id, organization_id)
    references public.price_lists(id, organization_id) on delete restrict,
  constraint customer_groups_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint customer_groups_name_check check (char_length(btrim(name)) between 1 and 120)
);

create index idx_customer_groups_org_active on public.customer_groups (organization_id, is_active);
create index idx_customer_groups_org_price_list on public.customer_groups (organization_id, price_list_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  phone text,
  phone_normalized text,
  customer_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_org_code_key unique (organization_id, code),
  constraint customers_customer_group_org_fkey foreign key (customer_group_id, organization_id)
    references public.customer_groups(id, organization_id) on delete restrict,
  constraint customers_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint customers_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint customers_phone_check check (phone is null or char_length(btrim(phone)) between 1 and 30),
  constraint customers_phone_normalized_check check (
    phone_normalized is null or char_length(phone_normalized) between 6 and 20
  )
);

create unique index customers_org_phone_normalized_key
  on public.customers (organization_id, phone_normalized)
  where phone_normalized is not null;

create index idx_customers_org_name on public.customers (organization_id, name);
create index idx_customers_org_code on public.customers (organization_id, code);
create index idx_customers_org_group on public.customers (organization_id, customer_group_id);
create index idx_customers_org_phone_normalized on public.customers (organization_id, phone_normalized)
  where phone_normalized is not null;

create or replace function public.normalize_customer_phone(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(input, ''), '[^0-9]+', '', 'g'), '')
$$;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone = nullif(btrim(new.phone), '');
  new.phone_normalized = public.normalize_customer_phone(new.phone);
  return new;
end;
$$;

create trigger set_customers_phone_normalized
before insert or update of phone on public.customers
for each row execute function public.set_customer_phone_normalized();

create trigger set_customer_groups_updated_at
before update on public.customer_groups
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace function public.next_customer_code(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(c.code from 3)::integer), 0) + 1
    into next_number
  from public.customers c
  where c.organization_id = p_organization_id
    and c.code ~ '^KH[0-9]{6}$';

  return 'KH' || lpad(next_number::text, 6, '0');
end;
$$;

alter table public.customer_groups enable row level security;
alter table public.customers enable row level security;

grant select, insert, update, delete on
  public.customer_groups,
  public.customers
to service_role;

grant execute on function public.normalize_customer_phone(text) to service_role;
grant execute on function public.next_customer_code(uuid) to service_role;
