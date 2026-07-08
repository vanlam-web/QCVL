alter table public.products
  add column if not exists product_kind text not null default 'goods';

alter table public.products
  drop constraint if exists products_product_kind_check;

alter table public.products
  add constraint products_product_kind_check check (
    product_kind in ('goods', 'service', 'auxiliary_material', 'roll', 'sheet', 'combo')
  );

update public.products p
set product_kind = case
  when p.sell_method = 'combo' then 'combo'
  when pis.inventory_shape = 'roll' then 'roll'
  when pis.inventory_shape = 'sheet' then 'sheet'
  when p.sell_method = 'quantity' and pis.track_inventory = false then 'service'
  else 'goods'
end
from public.product_inventory_settings pis
where pis.product_id = p.id
  and pis.organization_id = p.organization_id;

update public.products
set product_kind = 'combo'
where sell_method = 'combo'
  and product_kind <> 'combo';

create index if not exists idx_products_org_kind
  on public.products (organization_id, product_kind);
