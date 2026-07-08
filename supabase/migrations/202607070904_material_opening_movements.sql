alter table public.stock_movements
  add column if not exists material_opening_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_material_openings_id_org_key'
  ) then
    alter table public.inventory_material_openings
      add constraint inventory_material_openings_id_org_key unique (id, organization_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_movements_material_opening_org_fkey'
  ) then
    alter table public.stock_movements
      add constraint stock_movements_material_opening_org_fkey foreign key (material_opening_id, organization_id)
        references public.inventory_material_openings(id, organization_id) on delete restrict;
  end if;
end;
$$;

drop index if exists idx_stock_movements_material_opening;
create index idx_stock_movements_material_opening
  on public.stock_movements (organization_id, material_opening_id)
  where material_opening_id is not null;

alter table public.stock_movements
  drop constraint if exists stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check check (
    movement_type in (
      'sale_deduction',
      'invoice_reversal',
      'invoice_revision',
      'stocktake_adjustment',
      'manual_adjustment',
      'remnant_created',
      'remnant_discarded',
      'purchase_receipt',
      'material_opening'
    )
  );

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
  old_stock_movement_id_value uuid;
  stock_movement_id_value uuid;
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
    'old_remaining_qty', old_remaining_qty_value,
    'opened_stock_qty', opened_stock_qty_value,
    'stock_unit_id', settings_record.stock_unit_id,
    'old_stock_movement_id', null,
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

  if old_remaining_qty_value > 0 then
    insert into public.stock_movements (
      organization_id,
      product_id,
      movement_type,
      quantity_delta,
      stock_unit_id,
      display_quantity,
      display_unit_id,
      material_opening_id,
      reason,
      created_by
    )
    values (
      p_organization_id,
      product_id_value,
      'material_opening',
      -old_remaining_qty_value,
      settings_record.stock_unit_id,
      -old_remaining_qty_value,
      settings_record.stock_unit_id,
      opening_id_value,
      coalesce(note_value, 'Khui vật tư: đưa phần cũ về 0'),
      p_actor_user_id
    )
    returning id into old_stock_movement_id_value;
  end if;

  insert into public.stock_movements (
    organization_id,
    product_id,
    movement_type,
    quantity_delta,
    stock_unit_id,
    display_quantity,
    display_unit_id,
    material_opening_id,
    reason,
    created_by
  )
  values (
    p_organization_id,
    product_id_value,
    'material_opening',
    opened_stock_qty_value,
    settings_record.stock_unit_id,
    opened_qty_value,
    opened_unit_id_value,
    opening_id_value,
    coalesce(note_value, 'Khui vật tư mới'),
    p_actor_user_id
  )
  returning id into stock_movement_id_value;

  result_payload_value := jsonb_set(
    jsonb_set(
      result_payload_value,
      '{old_stock_movement_id}',
      coalesce(to_jsonb(old_stock_movement_id_value), 'null'::jsonb)
    ),
    '{stock_movement_id}',
    coalesce(to_jsonb(stock_movement_id_value), 'null'::jsonb)
  );

  update public.inventory_material_openings
  set result_payload = result_payload_value
  where id = opening_id_value
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'id', opening_id_value,
    'product_id', product_id_value,
    'inventory_shape', 'normal',
    'source_type', 'manual_normal',
    'opened_unit_id', opened_unit_id_value,
    'opened_qty', opened_qty_value,
    'opened_stock_qty', opened_stock_qty_value,
    'stock_movement_id', stock_movement_id_value,
    'warnings', '[]'::jsonb,
    'created_at', created_at_value
  );
end;
$$;

grant execute on function public.open_normal_material_tx(uuid, uuid, jsonb) to service_role;
