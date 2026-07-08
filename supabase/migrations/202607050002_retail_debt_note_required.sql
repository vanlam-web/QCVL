create or replace function public.enforce_retail_debt_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_type = 'invoice_debt'
    and new.customer_id = public.default_retail_customer_id(new.organization_id)
    and nullif(btrim(coalesce(new.retail_debt_note, '')), '') is null
  then
    raise exception 'retail_debt_note is required for KH000001 debt' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_retail_debt_note_before_write on public.customer_debt_entries;

create trigger enforce_retail_debt_note_before_write
before insert or update on public.customer_debt_entries
for each row execute function public.enforce_retail_debt_note();

grant execute on function public.enforce_retail_debt_note() to service_role;
