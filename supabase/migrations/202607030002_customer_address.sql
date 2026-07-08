alter table public.customers
  add column if not exists address text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'customers_address_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_address_check
      check (address is null or char_length(btrim(address)) between 1 and 300);
  end if;
end;
$$;
