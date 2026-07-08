drop function if exists public.revise_quote_tx(uuid, uuid, uuid, jsonb);

drop index if exists public.idx_orders_source_quote_code;

alter table public.orders
  drop column if exists source_quote_code;

create or replace function public.save_quote_tx(
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
  customer_id_value uuid;
  price_list_id_value uuid;
  order_id_value uuid;
  order_code_value text;
  subtotal_amount_value numeric(12,0) := 0;
  discount_amount_value numeric(12,0) := 0;
  total_amount_value numeric(12,0);
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  quantity_value numeric(12,3);
  unit_price_value numeric(12,0);
  line_subtotal_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_total_value numeric(12,0);
  customer_snapshot_value jsonb;
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

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'quote items are required' using errcode = '22023';
  end if;

  customer_id_value := nullif(p_payload->>'customer_id', '')::uuid;
  if customer_id_value is not null and not exists (
    select 1
    from public.customers c
    where c.id = customer_id_value
      and c.organization_id = p_organization_id
  ) then
    raise exception 'customer_id is invalid' using errcode = '22023';
  end if;

  price_list_id_value := nullif(p_payload->>'price_list_id', '')::uuid;
  if price_list_id_value is not null and not exists (
    select 1
    from public.price_lists pl
    where pl.id = price_list_id_value
      and pl.organization_id = p_organization_id
  ) then
    raise exception 'price_list_id is invalid' using errcode = '22023';
  end if;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
    unit_price_value := coalesce((item_value->>'unit_price')::numeric, 0);
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);

    if quantity_value <= 0 or unit_price_value < 0 then
      raise exception 'item quantity and unit price are invalid' using errcode = '22023';
    end if;

    if line_discount_value < 0 or line_discount_value > line_subtotal_value then
      raise exception 'item discount amount is invalid' using errcode = '22023';
    end if;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id
      and p.status = 'active';

    if product_record.id is null then
      raise exception 'product is not active' using errcode = '22023';
    end if;

    subtotal_amount_value := subtotal_amount_value + line_subtotal_value;
    discount_amount_value := discount_amount_value + line_discount_value;
  end loop;

  total_amount_value := subtotal_amount_value - discount_amount_value;
  order_code_value := public.next_order_code(p_organization_id, 'BG');

  customer_snapshot_value := case
    when jsonb_typeof(p_payload->'customer_snapshot') = 'object' then p_payload->'customer_snapshot'
    when customer_id_value is not null then (
      select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name, 'phone', c.phone)
      from public.customers c
      where c.id = customer_id_value
        and c.organization_id = p_organization_id
    )
    else jsonb_build_object('type', 'retail', 'name', 'Khach le')
  end;

  insert into public.orders (
    organization_id,
    code,
    order_type,
    status,
    base_code,
    revision_no,
    customer_id,
    customer_snapshot,
    price_list_id,
    subtotal_amount,
    discount_amount,
    total_amount,
    paid_amount,
    debt_amount,
    change_returned_amount,
    payment_status,
    note,
    created_by
  )
  values (
    p_organization_id,
    order_code_value,
    'quote',
    'active',
    order_code_value,
    0,
    customer_id_value,
    customer_snapshot_value,
    price_list_id_value,
    subtotal_amount_value,
    discount_amount_value,
    total_amount_value,
    0,
    0,
    0,
    'not_applicable',
    p_payload->>'note',
    p_actor_user_id
  )
  returning id into order_id_value;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := (item_value->>'quantity')::numeric;
    unit_price_value := (item_value->>'unit_price')::numeric;
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_total_value := line_subtotal_value - line_discount_value;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id;

    insert into public.order_items (
      organization_id,
      order_id,
      line_no,
      product_id,
      product_snapshot,
      sell_method,
      quantity,
      width_m,
      height_m,
      linear_m,
      unit_price,
      line_subtotal_amount,
      discount_amount,
      price_source,
      line_total,
      note
    )
    values (
      p_organization_id,
      order_id_value,
      line_no_value,
      product_id_value,
      jsonb_build_object(
        'id', product_record.id,
        'code', product_record.code,
        'name', product_record.name,
        'unit_name', product_record.unit_name,
        'sell_method', product_record.sell_method
      ),
      product_record.sell_method,
      quantity_value,
      nullif(item_value->>'width_m', '')::numeric,
      nullif(item_value->>'height_m', '')::numeric,
      nullif(item_value->>'linear_m', '')::numeric,
      unit_price_value,
      line_subtotal_value,
      line_discount_value,
      coalesce(item_value->>'price_source', 'manual'),
      line_total_value,
      item_value->>'note'
    );
  end loop;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    p_organization_id,
    order_id_value,
    null,
    'active',
    'quote_created',
    p_actor_user_id
  );

  return jsonb_build_object(
    'order_id', order_id_value,
    'order_code', order_code_value,
    'order', jsonb_build_object(
      'id', order_id_value,
      'code', order_code_value,
      'order_type', 'quote',
      'status', 'active',
      'total_amount', total_amount_value
    ),
    'total_amount', total_amount_value
  );
end;
$$;

grant execute on function public.save_quote_tx(uuid, uuid, jsonb) to service_role;
