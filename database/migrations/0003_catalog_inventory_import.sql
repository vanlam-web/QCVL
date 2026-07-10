create table if not exists product_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_product_groups_org_active
  on product_groups (organization_id, is_active);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  status text not null default 'active',
  unit_name text not null default 'Can cap nhat',
  sell_method text not null default 'quantity',
  product_kind text not null default 'goods',
  product_group_id uuid references product_groups(id),
  inventory_shape text not null default 'normal',
  track_inventory boolean not null default true,
  latest_purchase_cost numeric(18,2),
  latest_purchase_cost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table products add column if not exists product_group_id uuid references product_groups(id);
alter table products add column if not exists sell_method text not null default 'quantity';
alter table products add column if not exists product_kind text not null default 'goods';
alter table products add column if not exists inventory_shape text not null default 'normal';
alter table products add column if not exists track_inventory boolean not null default true;
alter table products add column if not exists latest_purchase_cost numeric(18,2);
alter table products add column if not exists latest_purchase_cost_at timestamptz;

create index if not exists idx_products_org_group
  on products (organization_id, product_group_id);
create index if not exists idx_products_org_inventory_shape
  on products (organization_id, inventory_shape);
create index if not exists idx_products_org_product_kind
  on products (organization_id, product_kind);
create index if not exists idx_products_org_status
  on products (organization_id, status);
create index if not exists idx_products_org_updated
  on products (organization_id, updated_at desc, created_at desc);

create table if not exists inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  unit_kind text not null default 'quantity',
  decimal_precision integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table inventory_units add column if not exists unit_kind text not null default 'quantity';
alter table inventory_units add column if not exists decimal_precision integer not null default 3;
alter table inventory_units add column if not exists is_active boolean not null default true;
alter table inventory_units add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_inventory_units_org_active
  on inventory_units (organization_id, is_active);
create index if not exists idx_inventory_units_org_kind
  on inventory_units (organization_id, unit_kind);

create table if not exists product_inventory_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  track_inventory boolean not null default true,
  inventory_shape text not null default 'normal',
  stock_unit_id uuid references inventory_units(id),
  default_allow_negative boolean not null default true,
  roll_default_margin_width_m numeric(12,3),
  roll_default_margin_length_m numeric(12,3),
  roll_allow_rotate boolean,
  sheet_width_m numeric(12,3),
  sheet_length_m numeric(12,3),
  sheet_default_cut_margin_m numeric(12,3),
  sheet_remnant_min_area_m2 numeric(12,3) not null default 0.300,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id)
);

alter table product_inventory_settings add column if not exists default_allow_negative boolean not null default true;
alter table product_inventory_settings add column if not exists roll_default_margin_width_m numeric(12,3);
alter table product_inventory_settings add column if not exists roll_default_margin_length_m numeric(12,3);
alter table product_inventory_settings add column if not exists roll_allow_rotate boolean;
alter table product_inventory_settings add column if not exists sheet_width_m numeric(12,3);
alter table product_inventory_settings add column if not exists sheet_length_m numeric(12,3);
alter table product_inventory_settings add column if not exists sheet_default_cut_margin_m numeric(12,3);
alter table product_inventory_settings add column if not exists sheet_remnant_min_area_m2 numeric(12,3) not null default 0.300;
alter table product_inventory_settings add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_product_inventory_settings_org_shape
  on product_inventory_settings (organization_id, inventory_shape);
create index if not exists idx_product_inventory_settings_stock_unit
  on product_inventory_settings (organization_id, stock_unit_id);

create table if not exists product_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sale_unit_id uuid not null references inventory_units(id),
  stock_unit_id uuid not null references inventory_units(id),
  stock_qty_per_sale_unit numeric(18,6) not null,
  is_default_purchase_unit boolean not null default false,
  is_default_sale_unit boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id, sale_unit_id)
);

create index if not exists idx_product_unit_conversions_product
  on product_unit_conversions (organization_id, product_id, is_active);

create table if not exists price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_price_lists_org_default
  on price_lists (organization_id, is_default, is_active);

create table if not exists price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  price_list_id uuid not null references price_lists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unit_price numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists price_list_items_price_product_uidx
  on price_list_items (price_list_id, product_id);
create index if not exists idx_price_list_items_org_product
  on price_list_items (organization_id, product_id);

create table if not exists inventory_provisional_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  source_type text not null,
  source_label text,
  initial_qty numeric(18,6),
  remaining_qty numeric(18,6),
  stock_unit_id uuid references inventory_units(id),
  status text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_provisional_balances add column if not exists source_label text;
alter table inventory_provisional_balances add column if not exists initial_qty numeric(18,6);
alter table inventory_provisional_balances add column if not exists remaining_qty numeric(18,6);
alter table inventory_provisional_balances add column if not exists stock_unit_id uuid;
alter table inventory_provisional_balances add column if not exists status text;
alter table inventory_provisional_balances add column if not exists note text;
alter table inventory_provisional_balances add column if not exists created_at timestamptz not null default now();
alter table inventory_provisional_balances add column if not exists updated_at timestamptz not null default now();

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'inventory_provisional_balances'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%source_type%'
  loop
    execute format('alter table inventory_provisional_balances drop constraint %I', constraint_name);
  end loop;
end $$;

alter table inventory_provisional_balances
  add constraint inventory_provisional_balances_source_type_check
  check (source_type in ('kiotviet_import'));

delete from inventory_provisional_balances a
using inventory_provisional_balances b
where a.ctid < b.ctid
  and a.organization_id = b.organization_id
  and a.product_id = b.product_id
  and a.source_type = b.source_type;

create unique index if not exists inventory_provisional_balances_org_product_source_uidx
  on inventory_provisional_balances (organization_id, product_id, source_type);
create index if not exists idx_inventory_provisional_balances_product
  on inventory_provisional_balances (organization_id, product_id, status);

create table if not exists stocktakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  status text not null default 'draft',
  source_type text not null default 'manual',
  source_system text,
  source_code text,
  source_created_at timestamptz,
  source_balanced_at timestamptz,
  note text,
  balanced_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table stocktakes add column if not exists source_system text;
alter table stocktakes add column if not exists source_code text;
alter table stocktakes add column if not exists source_created_at timestamptz;
alter table stocktakes add column if not exists source_balanced_at timestamptz;
alter table stocktakes add column if not exists created_by uuid;
alter table stocktakes alter column created_by drop not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'stocktakes'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%source_type%'
  loop
    execute format('alter table stocktakes drop constraint %I', constraint_name);
  end loop;
end $$;

alter table stocktakes
  add constraint stocktakes_source_type_check
  check (source_type in ('manual', 'product_edit', 'kiotviet_import'));

create unique index if not exists stocktakes_org_source_system_code_uidx
  on stocktakes (organization_id, source_system, source_code)
  where source_system is not null and source_code is not null;
create index if not exists idx_stocktakes_org_status_created
  on stocktakes (organization_id, status, created_at desc);
create index if not exists idx_stocktakes_org_source
  on stocktakes (organization_id, source_system, source_code);

create table if not exists stocktake_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stocktake_id uuid not null references stocktakes(id) on delete cascade,
  line_no integer not null,
  product_id uuid references products(id),
  stock_unit_id uuid references inventory_units(id),
  system_qty numeric(18,6),
  actual_qty numeric(18,6),
  difference_qty numeric(18,6),
  inventory_object_type text,
  inventory_roll_id uuid,
  inventory_sheet_id uuid,
  note text,
  source_row_number integer,
  source_product_code text,
  source_product_name text,
  source_unit_name text,
  line_difference_value numeric(18,2),
  line_actual_value numeric(18,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stocktake_id, line_no)
);

alter table stocktake_items alter column product_id drop not null;
alter table stocktake_items alter column stock_unit_id drop not null;
alter table stocktake_items alter column system_qty drop not null;
alter table stocktake_items alter column actual_qty drop not null;
alter table stocktake_items alter column difference_qty drop not null;
alter table stocktake_items add column if not exists source_row_number integer;
alter table stocktake_items add column if not exists source_product_code text;
alter table stocktake_items add column if not exists source_product_name text;
alter table stocktake_items add column if not exists source_unit_name text;
alter table stocktake_items add column if not exists line_actual_value numeric(18,2);
alter table stocktake_items add column if not exists line_difference_value numeric(18,2);
alter table stocktake_items add column if not exists inventory_object_type text;
alter table stocktake_items add column if not exists inventory_roll_id uuid;
alter table stocktake_items add column if not exists inventory_sheet_id uuid;
alter table stocktake_items add column if not exists updated_at timestamptz not null default now();

create unique index if not exists stocktake_items_stocktake_source_row_uidx
  on stocktake_items (stocktake_id, source_row_number)
  where source_row_number is not null;
create index if not exists idx_stocktake_items_stocktake
  on stocktake_items (organization_id, stocktake_id, line_no);
create index if not exists idx_stocktake_items_product
  on stocktake_items (organization_id, product_id);

create table if not exists product_boms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  version integer not null,
  status text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, product_id, version)
);

create index if not exists idx_product_boms_product_status
  on product_boms (organization_id, product_id, status);

create table if not exists product_bom_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  bom_id uuid not null references product_boms(id) on delete cascade,
  component_product_id uuid not null references products(id),
  quantity numeric(18,6) not null,
  calculation_payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 1,
  notes text
);

alter table product_bom_items add column if not exists calculation_payload jsonb not null default '{}'::jsonb;
alter table product_bom_items add column if not exists sort_order integer not null default 1;
alter table product_bom_items add column if not exists notes text;

create index if not exists idx_product_bom_items_bom
  on product_bom_items (organization_id, bom_id, sort_order);
create index if not exists idx_product_bom_items_component
  on product_bom_items (organization_id, component_product_id);
