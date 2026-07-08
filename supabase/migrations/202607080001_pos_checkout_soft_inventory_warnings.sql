alter function public.checkout_order_tx(uuid, uuid, jsonb)
  rename to checkout_order_tx_base_20260708;

create or replace function public.checkout_order_tx(
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
  result_value jsonb;
  warnings_value jsonb := '[]'::jsonb;
  item_value jsonb;
  product_record record;
  settings_record record;
  product_id_value uuid;
  quantity_value numeric(12,3);
  width_m_value numeric(12,3);
  height_m_value numeric(12,3);
  linear_m_value numeric(12,3);
  stock_delta_value numeric(12,3);
  available_qty_value numeric(18,6);
begin
  if jsonb_typeof(p_payload->'items') = 'array' then
    for item_value in select value from jsonb_array_elements(p_payload->'items') loop
      product_id_value := nullif(item_value->>'product_id', '')::uuid;
      quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
      width_m_value := nullif(item_value->>'width_m', '')::numeric;
      height_m_value := nullif(item_value->>'height_m', '')::numeric;
      linear_m_value := nullif(item_value->>'linear_m', '')::numeric;

      select p.*
        into product_record
      from public.products p
      where p.id = product_id_value
        and p.organization_id = p_organization_id
        and p.status = 'active';

      select pis.*
        into settings_record
      from public.product_inventory_settings pis
      where pis.product_id = product_id_value
        and pis.organization_id = p_organization_id;

      if product_record.id is not null and settings_record.stock_unit_id is not null then
        stock_delta_value := case
          when product_record.sell_method = 'area_m2'
            and width_m_value is not null
            and height_m_value is not null
            then width_m_value * height_m_value * quantity_value
          when product_record.sell_method = 'linear_m'
            and linear_m_value is not null
            then linear_m_value * quantity_value
          else quantity_value
        end;

        select coalesce(sum(sm.quantity_delta), 0)
          into available_qty_value
        from public.stock_movements sm
        where sm.organization_id = p_organization_id
          and sm.product_id = product_id_value;

        if stock_delta_value > 0 and available_qty_value - stock_delta_value < 0 then
          warnings_value := warnings_value || jsonb_build_array(jsonb_build_object(
            'product_id', product_id_value,
            'code', 'NEGATIVE_STOCK',
            'message', 'Ton kho vat ly se am sau khi ban.'
          ));
        end if;

        if settings_record.inventory_shape in ('roll', 'sheet')
          and nullif(item_value->>'inventory_roll_id', '') is null
          and nullif(item_value->>'inventory_sheet_id', '') is null
        then
          warnings_value := warnings_value || jsonb_build_array(jsonb_build_object(
            'product_id', product_id_value,
            'code', 'PENDING_MATERIAL_RECONCILIATION',
            'message', 'Chua gan cuon/tam vat ly; can doi soat vat tu sau.'
          ));
        end if;
      end if;
    end loop;
  end if;

  result_value := public.checkout_order_tx_base_20260708(p_actor_user_id, p_organization_id, p_payload);
  return jsonb_set(result_value, '{inventory_warnings}', warnings_value, true);
end;
$$;

grant execute on function public.checkout_order_tx(uuid, uuid, jsonb) to service_role;
