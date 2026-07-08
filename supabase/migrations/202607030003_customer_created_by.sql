alter table public.customers
  add column if not exists created_by uuid references public.profiles(user_id) on delete set null;

create index if not exists idx_customers_org_created_by
  on public.customers (organization_id, created_by);
