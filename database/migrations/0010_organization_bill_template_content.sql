alter table organizations add column if not exists invoice_title text;
alter table organizations add column if not exists quote_title text;
alter table organizations add column if not exists footer_note text;
alter table organizations add column if not exists show_product_code boolean;
alter table organizations add column if not exists show_unit boolean;
alter table organizations add column if not exists show_discount boolean;
alter table organizations add column if not exists logo_data_url text;

update organizations
set invoice_title = coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG')
where invoice_title is null or btrim(invoice_title) = '';

update organizations
set quote_title = coalesce(nullif(btrim(quote_title), ''), 'BÁO GIÁ')
where quote_title is null or btrim(quote_title) = '';

update organizations
set footer_note = coalesce(footer_note, '')
where footer_note is null;

update organizations
set show_product_code = coalesce(show_product_code, true),
    show_unit = coalesce(show_unit, true),
    show_discount = coalesce(show_discount, true)
where show_product_code is null
   or show_unit is null
   or show_discount is null;

alter table organizations
  alter column invoice_title set default 'HÓA ĐƠN BÁN HÀNG',
  alter column quote_title set default 'BÁO GIÁ',
  alter column footer_note set default '',
  alter column show_product_code set default true,
  alter column show_unit set default true,
  alter column show_discount set default true;

alter table organizations
  alter column invoice_title set not null,
  alter column quote_title set not null,
  alter column footer_note set not null,
  alter column show_product_code set not null,
  alter column show_unit set not null,
  alter column show_discount set not null;
