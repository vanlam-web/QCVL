create table if not exists public.product_boms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  version integer not null,
  status text not null default 'active',
  notes text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint product_boms_status_check check (status in ('active', 'archived')),
  constraint product_boms_version_check check (version > 0),
  constraint product_boms_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint product_boms_product_version_key unique (organization_id, product_id, version)
);

create unique index if not exists product_boms_one_active
  on public.product_boms (organization_id, product_id)
  where status = 'active';

create table if not exists public.product_bom_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  bom_id uuid not null references public.product_boms(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null,
  sort_order integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  constraint product_bom_items_quantity_check check (quantity > 0),
  constraint product_bom_items_component_org_fkey foreign key (component_product_id, organization_id)
    references public.products(id, organization_id) on delete restrict
);

create index if not exists idx_product_bom_items_bom
  on public.product_bom_items (organization_id, bom_id, sort_order);

create table if not exists public.order_item_bom_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  source_type text not null,
  source_bom_id uuid references public.product_boms(id) on delete restrict,
  source_bom_version integer,
  snapshot_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint order_item_bom_snapshots_source_type_check check (source_type in ('standard_bom')),
  constraint order_item_bom_snapshots_payload_object_check check (jsonb_typeof(snapshot_payload) = 'object')
);

create unique index if not exists order_item_bom_snapshots_one_per_item
  on public.order_item_bom_snapshots (organization_id, order_item_id);

create or replace function public.save_product_bom_v1_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_product_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version_value integer;
  bom_id_value uuid;
  item_value jsonb;
  component_id_value uuid;
  quantity_value numeric(12,3);
  sort_order_value integer := 0;
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

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception 'product is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'bom items are required' using errcode = '22023';
  end if;

  for item_value in select value from jsonb_array_elements(p_items) loop
    component_id_value := (item_value->>'component_product_id')::uuid;
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);

    if component_id_value = p_product_id then
      raise exception 'bom cannot reference itself' using errcode = '22023';
    end if;

    if quantity_value <= 0 then
      raise exception 'bom item quantity is invalid' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.products p
      join public.product_inventory_settings pis
        on pis.product_id = p.id
       and pis.organization_id = p.organization_id
      where p.id = component_id_value
        and p.organization_id = p_organization_id
        and p.status = 'active'
        and pis.inventory_shape = 'normal'
        and pis.stock_unit_id is not null
    ) then
      raise exception 'bom v1 supports active normal inventory components only' using errcode = '22023';
    end if;
  end loop;

  update public.product_boms
  set status = 'archived'
  where organization_id = p_organization_id
    and product_id = p_product_id
    and status = 'active';

  select coalesce(max(version), 0) + 1
    into next_version_value
  from public.product_boms
  where organization_id = p_organization_id
    and product_id = p_product_id;

  insert into public.product_boms (
    organization_id,
    product_id,
    version,
    status,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_product_id,
    next_version_value,
    'active',
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_actor_user_id
  )
  returning id into bom_id_value;

  for item_value in select value from jsonb_array_elements(p_items) loop
    sort_order_value := sort_order_value + 1;
    insert into public.product_bom_items (
      organization_id,
      bom_id,
      component_product_id,
      quantity,
      sort_order,
      notes
    )
    values (
      p_organization_id,
      bom_id_value,
      (item_value->>'component_product_id')::uuid,
      (item_value->>'quantity')::numeric,
      sort_order_value,
      nullif(btrim(coalesce(item_value->>'notes', '')), '')
    );
  end loop;

  return jsonb_build_object(
    'id', bom_id_value,
    'product_id', p_product_id,
    'version', next_version_value,
    'status', 'active'
  );
end;
$$;

create or replace function public.apply_standard_bom_v1_after_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record record;
  bom_record record;
  component_record record;
  snapshot_items jsonb := '[]'::jsonb;
begin
  select o.id, o.status, o.order_type, o.created_by
    into order_record
  from public.orders o
  where o.id = new.order_id
    and o.organization_id = new.organization_id;

  if order_record.id is null or order_record.order_type <> 'invoice' or order_record.status <> 'completed' then
    return new;
  end if;

  select pb.*
    into bom_record
  from public.product_boms pb
  where pb.organization_id = new.organization_id
    and pb.product_id = new.product_id
    and pb.status = 'active'
  order by pb.version desc
  limit 1;

  if bom_record.id is null then
    return new;
  end if;

  for component_record in
    select
      pbi.component_product_id,
      p.code,
      p.name,
      pbi.quantity,
      pbi.sort_order,
      pis.stock_unit_id
    from public.product_bom_items pbi
    join public.products p
      on p.id = pbi.component_product_id
     and p.organization_id = pbi.organization_id
    join public.product_inventory_settings pis
      on pis.product_id = pbi.component_product_id
     and pis.organization_id = pbi.organization_id
    where pbi.organization_id = new.organization_id
      and pbi.bom_id = bom_record.id
      and pis.inventory_shape = 'normal'
      and pis.stock_unit_id is not null
    order by pbi.sort_order
  loop
    snapshot_items := snapshot_items || jsonb_build_array(jsonb_build_object(
      'component_product_id', component_record.component_product_id,
      'code', component_record.code,
      'name', component_record.name,
      'quantity_per_parent', component_record.quantity,
      'quantity_delta', -(component_record.quantity * new.quantity),
      'sort_order', component_record.sort_order
    ));

    insert into public.stock_movements (
      organization_id,
      product_id,
      movement_type,
      quantity_delta,
      stock_unit_id,
      display_quantity,
      display_unit_id,
      inventory_object_type,
      order_id,
      order_item_id,
      reason,
      created_by
    )
    values (
      new.organization_id,
      component_record.component_product_id,
      'sale_deduction',
      -(component_record.quantity * new.quantity),
      component_record.stock_unit_id,
      component_record.quantity * new.quantity,
      component_record.stock_unit_id,
      null,
      new.order_id,
      new.id,
      'checkout_bom_v1',
      order_record.created_by
    );
  end loop;

  insert into public.order_item_bom_snapshots (
    organization_id,
    order_item_id,
    source_type,
    source_bom_id,
    source_bom_version,
    snapshot_payload
  )
  values (
    new.organization_id,
    new.id,
    'standard_bom',
    bom_record.id,
    bom_record.version,
    jsonb_build_object(
      'bom_id', bom_record.id,
      'version', bom_record.version,
      'mode', 'single_level_normal_v1',
      'items', snapshot_items
    )
  )
  on conflict (organization_id, order_item_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_apply_standard_bom_v1_after_order_item on public.order_items;
create trigger trg_apply_standard_bom_v1_after_order_item
after insert on public.order_items
for each row
execute function public.apply_standard_bom_v1_after_order_item();

grant execute on function public.save_product_bom_v1_tx(uuid, uuid, uuid, jsonb, text) to service_role;
