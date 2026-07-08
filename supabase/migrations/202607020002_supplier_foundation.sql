do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_id_org_key'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_id_org_key unique (id, organization_id);
  end if;
end;
$$;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  phone text,
  email text,
  address text,
  tax_code text,
  linked_customer_id uuid,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_org_code_key unique (organization_id, code),
  constraint suppliers_id_org_key unique (id, organization_id),
  constraint suppliers_linked_customer_org_fkey foreign key (linked_customer_id, organization_id)
    references public.customers(id, organization_id) on delete restrict,
  constraint suppliers_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint suppliers_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint suppliers_phone_check check (phone is null or char_length(btrim(phone)) between 1 and 30),
  constraint suppliers_email_check check (email is null or char_length(btrim(email)) between 3 and 254),
  constraint suppliers_status_check check (status in ('active', 'inactive'))
);

create index idx_suppliers_org_status on public.suppliers (organization_id, status);
create index idx_suppliers_org_code on public.suppliers (organization_id, code);
create index idx_suppliers_org_name on public.suppliers (organization_id, name);
create index idx_suppliers_org_phone on public.suppliers (organization_id, phone)
  where phone is not null;
create index idx_suppliers_org_linked_customer on public.suppliers (organization_id, linked_customer_id)
  where linked_customer_id is not null;

create or replace function public.next_supplier_code(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(s.code from 4)::integer), 0) + 1
    into next_number
  from public.suppliers s
  where s.organization_id = p_organization_id
    and s.code ~ '^NCC[0-9]{6}$';

  return 'NCC' || lpad(next_number::text, 6, '0');
end;
$$;

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

grant select, insert, update, delete on public.suppliers to service_role;
grant execute on function public.next_supplier_code(uuid) to service_role;
