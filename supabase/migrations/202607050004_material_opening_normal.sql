create table if not exists public.inventory_provisional_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  source_type text not null default 'kiotviet_import',
  source_label text,
  initial_qty numeric(18,6) not null,
  remaining_qty numeric(18,6) not null,
  stock_unit_id uuid not null,
  status text not null default 'open',
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_provisional_balances_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint inventory_provisional_balances_stock_unit_org_fkey foreign key (stock_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint inventory_provisional_balances_qty_check check (initial_qty >= 0 and remaining_qty >= 0 and remaining_qty <= initial_qty),
  constraint inventory_provisional_balances_status_check check (status in ('open', 'fully_normalized', 'closed')),
  constraint inventory_provisional_balances_source_check check (source_type in ('kiotviet_import'))
);

create index if not exists idx_inventory_provisional_balances_product
  on public.inventory_provisional_balances (organization_id, product_id, status);

create unique index if not exists inventory_provisional_balances_one_kiotviet_import
  on public.inventory_provisional_balances (organization_id, product_id, source_type)
  where source_type = 'kiotviet_import';

create table if not exists public.inventory_material_openings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  inventory_shape text not null,
  source_type text not null,
  provisional_balance_id uuid references public.inventory_provisional_balances(id) on delete restrict,
  old_inventory_roll_id uuid references public.inventory_rolls(id) on delete restrict,
  new_inventory_roll_id uuid references public.inventory_rolls(id) on delete restrict,
  old_inventory_sheet_id uuid references public.inventory_sheets(id) on delete restrict,
  new_inventory_sheet_id uuid references public.inventory_sheets(id) on delete restrict,
  old_snapshot jsonb not null default '{}'::jsonb,
  input_payload jsonb not null,
  result_payload jsonb not null,
  warning_codes text[] not null default '{}'::text[],
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inventory_material_openings_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint inventory_material_openings_shape_check check (inventory_shape in ('normal', 'roll', 'sheet')),
  constraint inventory_material_openings_source_check check (source_type in ('manual_normal', 'standard_object', 'kiotviet_provisional')),
  constraint inventory_material_openings_provisional_check check (
    (source_type = 'kiotviet_provisional' and provisional_balance_id is not null)
    or (source_type <> 'kiotviet_provisional' and provisional_balance_id is null)
  ),
  constraint inventory_material_openings_shape_object_check check (
    (
      inventory_shape = 'normal'
      and old_inventory_roll_id is null
      and new_inventory_roll_id is null
      and old_inventory_sheet_id is null
      and new_inventory_sheet_id is null
    )
    or (
      inventory_shape = 'roll'
      and old_inventory_sheet_id is null
      and new_inventory_sheet_id is null
    )
    or (
      inventory_shape = 'sheet'
      and old_inventory_roll_id is null
      and new_inventory_roll_id is null
    )
  ),
  constraint inventory_material_openings_payload_check check (
    jsonb_typeof(old_snapshot) = 'object'
    and jsonb_typeof(input_payload) = 'object'
    and jsonb_typeof(result_payload) = 'object'
  )
);

create index if not exists idx_inventory_material_openings_product_time
  on public.inventory_material_openings (organization_id, product_id, created_at desc);

create index if not exists idx_inventory_material_openings_created_by
  on public.inventory_material_openings (organization_id, created_by, created_at desc);

create index if not exists idx_inventory_material_openings_provisional
  on public.inventory_material_openings (organization_id, provisional_balance_id)
  where provisional_balance_id is not null;

alter table public.inventory_provisional_balances enable row level security;
alter table public.inventory_material_openings enable row level security;

create trigger set_inventory_provisional_balances_updated_at
before update on public.inventory_provisional_balances
for each row execute function public.set_updated_at();

create or replace function public.open_normal_material_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_id_value uuid;
  opened_unit_id_value uuid;
  opened_qty_value numeric(18,6);
  old_remaining_qty_value numeric(18,6);
  note_value text;
  settings_record record;
  product_record record;
  conversion_record record;
  opening_id_value uuid;
  opened_stock_qty_value numeric(18,6);
  result_payload_value jsonb;
  created_at_value timestamptz;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception 'actor profile is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'material opening payload is invalid' using errcode = '22023';
  end if;

  product_id_value := (p_payload->>'product_id')::uuid;
  opened_unit_id_value := (p_payload->>'opened_unit_id')::uuid;
  opened_qty_value := coalesce((p_payload->>'opened_qty')::numeric, 0);
  old_remaining_qty_value := coalesce((p_payload->>'old_remaining_qty')::numeric, 0);
  note_value := nullif(btrim(coalesce(p_payload->>'note', '')), '');

  if coalesce(p_payload->>'inventory_shape', '') <> 'normal' then
    raise exception 'normal material opening requires normal inventory shape' using errcode = '22023';
  end if;

  if opened_qty_value <= 0 then
    raise exception 'opened quantity must be positive' using errcode = '22023';
  end if;

  if old_remaining_qty_value < 0 then
    raise exception 'old remaining quantity must be non-negative' using errcode = '22023';
  end if;

  select p.id, p.code, p.name
    into product_record
  from public.products p
  where p.id = product_id_value
    and p.organization_id = p_organization_id
    and p.status = 'active';

  if product_record.id is null then
    raise exception 'product not found' using errcode = '23503';
  end if;

  select pis.inventory_shape, pis.stock_unit_id
    into settings_record
  from public.product_inventory_settings pis
  where pis.product_id = product_id_value
    and pis.organization_id = p_organization_id;

  if settings_record.stock_unit_id is null then
    raise exception 'inventory settings not found' using errcode = '23503';
  end if;

  if settings_record.inventory_shape <> 'normal' then
    raise exception 'normal material opening requires normal inventory shape' using errcode = '22023';
  end if;

  select puc.sale_unit_id, puc.stock_unit_id, puc.stock_qty_per_sale_unit, iu.code, iu.name
    into conversion_record
  from public.product_unit_conversions puc
  join public.inventory_units iu
    on iu.id = puc.sale_unit_id
   and iu.organization_id = puc.organization_id
  where puc.product_id = product_id_value
    and puc.organization_id = p_organization_id
    and puc.sale_unit_id = opened_unit_id_value
    and puc.stock_unit_id = settings_record.stock_unit_id
    and puc.is_active = true
    and iu.is_active = true;

  if conversion_record.sale_unit_id is null then
    raise exception 'active product unit conversion is required' using errcode = '22023';
  end if;

  opened_stock_qty_value := opened_qty_value * conversion_record.stock_qty_per_sale_unit;
  result_payload_value := jsonb_build_object(
    'opened_stock_qty', opened_stock_qty_value,
    'stock_unit_id', settings_record.stock_unit_id,
    'stock_movement_id', null
  );

  insert into public.inventory_material_openings (
    organization_id,
    product_id,
    inventory_shape,
    source_type,
    old_snapshot,
    input_payload,
    result_payload,
    warning_codes,
    note,
    created_by
  )
  values (
    p_organization_id,
    product_id_value,
    'normal',
    'manual_normal',
    jsonb_build_object('old_remaining_qty', old_remaining_qty_value),
    p_payload,
    result_payload_value,
    '{}'::text[],
    note_value,
    p_actor_user_id
  )
  returning id, created_at into opening_id_value, created_at_value;

  return jsonb_build_object(
    'id', opening_id_value,
    'product_id', product_id_value,
    'inventory_shape', 'normal',
    'source_type', 'manual_normal',
    'opened_unit_id', opened_unit_id_value,
    'opened_qty', opened_qty_value,
    'opened_stock_qty', opened_stock_qty_value,
    'stock_movement_id', null,
    'warnings', '[]'::jsonb,
    'created_at', created_at_value
  );
end;
$$;

grant select, insert, update, delete on
  public.inventory_provisional_balances,
  public.inventory_material_openings
to service_role;

grant execute on function public.open_normal_material_tx(uuid, uuid, jsonb) to service_role;
