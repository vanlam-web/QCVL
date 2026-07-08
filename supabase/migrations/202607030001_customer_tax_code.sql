alter table public.customers
  add column tax_code text;

alter table public.customers
  add constraint customers_tax_code_check
  check (tax_code is null or char_length(btrim(tax_code)) between 1 and 50);
