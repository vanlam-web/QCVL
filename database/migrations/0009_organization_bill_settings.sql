alter table organizations add column if not exists shop_name text;
alter table organizations add column if not exists shop_address text;
alter table organizations add column if not exists shop_phone text;
alter table organizations add column if not exists default_bill_template text;

update organizations
set shop_name = coalesce(nullif(btrim(shop_name), ''), name)
where shop_name is null or btrim(shop_name) = '';

update organizations
set shop_address = coalesce(shop_address, '')
where shop_address is null;

update organizations
set shop_phone = coalesce(shop_phone, '')
where shop_phone is null;

update organizations
set default_bill_template = 'a4'
where default_bill_template is null
   or btrim(default_bill_template) = ''
   or default_bill_template not in ('a4', 'k80');

alter table organizations
  alter column shop_name set default '',
  alter column shop_address set default '',
  alter column shop_phone set default '',
  alter column default_bill_template set default 'a4';

alter table organizations
  alter column shop_name set not null,
  alter column shop_address set not null,
  alter column shop_phone set not null,
  alter column default_bill_template set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_default_bill_template_check'
  ) then
    alter table organizations
      add constraint organizations_default_bill_template_check
      check (default_bill_template in ('a4', 'k80'));
  end if;
end $$;
