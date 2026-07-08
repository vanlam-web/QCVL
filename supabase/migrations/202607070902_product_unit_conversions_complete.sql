alter table public.product_unit_conversions
  add column if not exists is_default_purchase_unit boolean not null default false,
  add column if not exists is_default_sale_unit boolean not null default false;

create unique index if not exists product_unit_conversions_one_purchase_default
  on public.product_unit_conversions (organization_id, product_id)
  where is_active = true and is_default_purchase_unit = true;

create unique index if not exists product_unit_conversions_one_sale_default
  on public.product_unit_conversions (organization_id, product_id)
  where is_active = true and is_default_sale_unit = true;
