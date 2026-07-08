create or replace function public.validate_purchase_physical_payload(
  p_inventory_shape text,
  p_quantity numeric,
  p_physical_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  roll_width_value numeric;
  roll_length_value numeric;
  roll_count_value integer := 0;
  sheet_group_value jsonb;
  sheet_width_value numeric;
  sheet_length_value numeric;
  sheet_quantity_value numeric;
  sheet_count_value integer := 0;
begin
  if p_inventory_shape = 'normal' then
    return 0;
  end if;

  if p_physical_payload is null or jsonb_typeof(p_physical_payload) <> 'object' then
    raise exception '% physical payload is invalid', p_inventory_shape using errcode = '22023';
  end if;

  if p_inventory_shape = 'roll' then
    if jsonb_typeof(p_physical_payload->'rolls') <> 'object'
      or jsonb_typeof(p_physical_payload#>'{rolls,lengths_m}') <> 'array'
      or jsonb_array_length(p_physical_payload#>'{rolls,lengths_m}') = 0
    then
      raise exception 'roll physical payload is invalid' using errcode = '22023';
    end if;

    roll_width_value := coalesce((p_physical_payload#>>'{rolls,width_m}')::numeric, 0);
    if roll_width_value <= 0 then
      raise exception 'roll physical payload is invalid' using errcode = '22023';
    end if;

    for roll_length_value in
      select value::text::numeric
      from jsonb_array_elements(p_physical_payload#>'{rolls,lengths_m}') as value
    loop
      if roll_length_value <= 0 then
        raise exception 'roll physical payload is invalid' using errcode = '22023';
      end if;
      roll_count_value := roll_count_value + 1;
    end loop;

    if p_quantity <> roll_count_value then
      raise exception 'roll quantity must match physical roll count' using errcode = '22023';
    end if;

    return roll_count_value;
  end if;

  if p_inventory_shape = 'sheet' then
    if jsonb_typeof(p_physical_payload->'sheet_groups') <> 'array'
      or jsonb_array_length(p_physical_payload->'sheet_groups') = 0
    then
      raise exception 'sheet physical payload is invalid' using errcode = '22023';
    end if;

    for sheet_group_value in
      select value
      from jsonb_array_elements(p_physical_payload->'sheet_groups') as value
    loop
      sheet_width_value := coalesce((sheet_group_value->>'width_m')::numeric, 0);
      sheet_length_value := coalesce((sheet_group_value->>'length_m')::numeric, 0);
      sheet_quantity_value := coalesce((sheet_group_value->>'quantity')::numeric, 0);

      if sheet_width_value <= 0
        or sheet_length_value <= 0
        or sheet_quantity_value <= 0
        or sheet_quantity_value <> trunc(sheet_quantity_value)
      then
        raise exception 'sheet physical payload is invalid' using errcode = '22023';
      end if;

      sheet_count_value := sheet_count_value + sheet_quantity_value::integer;
    end loop;

    if p_quantity <> sheet_count_value then
      raise exception 'sheet quantity must match physical sheet count' using errcode = '22023';
    end if;

    return sheet_count_value;
  end if;

  raise exception 'purchase item inventory shape is invalid' using errcode = '22023';
end;
$$;

create or replace function public.save_purchase_receipt_draft_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_receipt_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_id_value uuid;
  code_value text;
  supplier_id_value uuid;
  received_at_value timestamptz;
  supplier_document_no_value text;
  notes_value text;
  receipt_discount_value numeric(12,0);
  paid_amount_value numeric(12,0);
  subtotal_amount_value numeric(12,0) := 0;
  payable_amount_value numeric(12,0);
  remaining_amount_value numeric(12,0);
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  settings_record record;
  inventory_shape_value text;
  physical_payload_value jsonb;
  unit_name_value text;
  quantity_value numeric(18,6);
  unit_cost_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_amount_value numeric(12,0);
  seen_product_ids uuid[] := array[]::uuid[];
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
    raise exception 'purchase receipt items are required' using errcode = '22023';
  end if;

  supplier_id_value := nullif(p_payload->>'supplier_id', '')::uuid;
  if supplier_id_value is null or not exists (
    select 1
    from public.suppliers s
    where s.id = supplier_id_value
      and s.organization_id = p_organization_id
      and s.status = 'active'
  ) then
    raise exception 'supplier must be active' using errcode = '22023';
  end if;

  received_at_value := coalesce(nullif(p_payload->>'received_at', '')::timestamptz, now());
  supplier_document_no_value := nullif(btrim(coalesce(p_payload->>'supplier_document_no', '')), '');
  notes_value := nullif(btrim(coalesce(p_payload->>'notes', '')), '');
  receipt_discount_value := coalesce((p_payload->>'discount_amount')::numeric, 0);
  paid_amount_value := coalesce((p_payload->>'paid_amount')::numeric, 0);

  if receipt_discount_value < 0 or paid_amount_value < 0 then
    raise exception 'receipt amounts must be non-negative' using errcode = '22023';
  end if;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    inventory_shape_value := coalesce(nullif(item_value->>'inventory_shape', ''), 'normal');
    unit_name_value := btrim(coalesce(item_value->>'unit_name', ''));
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
    unit_cost_value := coalesce((item_value->>'unit_cost')::numeric, 0);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    physical_payload_value := item_value->'physical_payload';
    line_amount_value := round(quantity_value * unit_cost_value) - line_discount_value;

    if inventory_shape_value not in ('normal', 'roll', 'sheet') then
      raise exception 'purchase item inventory shape is invalid' using errcode = '22023';
    end if;
    if product_id_value = any(seen_product_ids) then
      raise exception 'duplicate product in purchase receipt' using errcode = '22023';
    end if;
    seen_product_ids := array_append(seen_product_ids, product_id_value);

    if unit_name_value = '' or char_length(unit_name_value) > 30 then
      raise exception 'unit name is invalid' using errcode = '22023';
    end if;
    if quantity_value <= 0 or unit_cost_value < 0 or line_discount_value < 0 or line_amount_value < 0 then
      raise exception 'item amounts are invalid' using errcode = '22023';
    end if;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id
      and p.status = 'active';

    if product_record.id is null then
      raise exception 'product must be active' using errcode = '22023';
    end if;

    select pis.*
      into settings_record
    from public.product_inventory_settings pis
    where pis.product_id = product_id_value
      and pis.organization_id = p_organization_id;

    if settings_record.id is null or settings_record.inventory_shape <> inventory_shape_value then
      raise exception 'purchase item inventory shape does not match product settings' using errcode = '22023';
    end if;

    perform public.validate_purchase_physical_payload(inventory_shape_value, quantity_value, physical_payload_value);
    subtotal_amount_value := subtotal_amount_value + line_amount_value;
  end loop;

  if receipt_discount_value > subtotal_amount_value then
    raise exception 'receipt discount exceeds subtotal' using errcode = '22023';
  end if;

  payable_amount_value := subtotal_amount_value - receipt_discount_value;
  remaining_amount_value := payable_amount_value - paid_amount_value;
  code_value := nullif(btrim(coalesce(p_payload->>'code', '')), '');

  if p_receipt_id is null then
    receipt_id_value := gen_random_uuid();
    code_value := coalesce(code_value, public.next_purchase_receipt_code(p_organization_id));

    insert into public.purchase_receipts (
      id,
      organization_id,
      code,
      supplier_id,
      received_at,
      status,
      supplier_document_no,
      subtotal_amount,
      discount_amount,
      payable_amount,
      paid_amount,
      remaining_amount,
      notes,
      created_by
    ) values (
      receipt_id_value,
      p_organization_id,
      code_value,
      supplier_id_value,
      received_at_value,
      'draft',
      supplier_document_no_value,
      subtotal_amount_value,
      receipt_discount_value,
      payable_amount_value,
      paid_amount_value,
      remaining_amount_value,
      notes_value,
      p_actor_user_id
    );
  else
    receipt_id_value := p_receipt_id;

    if not exists (
      select 1
      from public.purchase_receipts pr
      where pr.id = receipt_id_value
        and pr.organization_id = p_organization_id
        and pr.status = 'draft'
    ) then
      raise exception 'purchase receipt draft not found' using errcode = '22023';
    end if;

    update public.purchase_receipts
    set
      code = coalesce(code_value, code),
      supplier_id = supplier_id_value,
      received_at = received_at_value,
      supplier_document_no = supplier_document_no_value,
      subtotal_amount = subtotal_amount_value,
      discount_amount = receipt_discount_value,
      payable_amount = payable_amount_value,
      paid_amount = paid_amount_value,
      remaining_amount = remaining_amount_value,
      notes = notes_value
    where id = receipt_id_value
      and organization_id = p_organization_id
      and status = 'draft';

    delete from public.purchase_receipt_items
    where purchase_receipt_id = receipt_id_value
      and organization_id = p_organization_id;
  end if;

  line_no_value := 0;
  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    inventory_shape_value := coalesce(nullif(item_value->>'inventory_shape', ''), 'normal');
    unit_name_value := btrim(coalesce(item_value->>'unit_name', ''));
    quantity_value := (item_value->>'quantity')::numeric;
    unit_cost_value := (item_value->>'unit_cost')::numeric;
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    physical_payload_value := item_value->'physical_payload';
    line_amount_value := round(quantity_value * unit_cost_value) - line_discount_value;

    insert into public.purchase_receipt_items (
      organization_id,
      purchase_receipt_id,
      product_id,
      line_no,
      inventory_shape,
      unit_name_snapshot,
      quantity,
      unit_cost,
      discount_amount,
      line_amount,
      physical_payload
    ) values (
      p_organization_id,
      receipt_id_value,
      product_id_value,
      line_no_value,
      inventory_shape_value,
      unit_name_value,
      quantity_value,
      unit_cost_value,
      line_discount_value,
      line_amount_value,
      case when inventory_shape_value = 'normal' then null else physical_payload_value end
    );
  end loop;

  return receipt_id_value;
end;
$$;

create or replace function public.post_purchase_receipt_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_receipt_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_record record;
  supplier_record record;
  item_record record;
  settings_record record;
  stock_unit_record record;
  finance_account_id_value uuid;
  payment_method_value text;
  paid_amount_value numeric(12,0);
  voucher_id_value uuid;
  voucher_code_value text;
  voucher_reason_value text;
  posted_at_value timestamptz := now();
  item_count integer;
  roll_width_value numeric;
  roll_length_value numeric;
  roll_area_value numeric;
  sheet_group_value jsonb;
  sheet_width_value numeric;
  sheet_length_value numeric;
  sheet_quantity_value integer;
  sheet_index_value integer;
  sheet_area_value numeric;
  object_index_value integer;
  object_code_value text;
  roll_id_value uuid;
  sheet_id_value uuid;
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

  select pr.*
    into receipt_record
  from public.purchase_receipts pr
  where pr.id = p_receipt_id
    and pr.organization_id = p_organization_id
  for update;

  if receipt_record.id is null then
    raise exception 'purchase receipt not found' using errcode = '22023';
  end if;

  if receipt_record.status <> 'draft' then
    raise exception 'purchase receipt is not draft' using errcode = '22023';
  end if;

  select s.*
    into supplier_record
  from public.suppliers s
  where s.id = receipt_record.supplier_id
    and s.organization_id = p_organization_id;

  if supplier_record.id is null then
    raise exception 'supplier not found' using errcode = '22023';
  end if;

  select count(*)
    into item_count
  from public.purchase_receipt_items pri
  where pri.purchase_receipt_id = p_receipt_id
    and pri.organization_id = p_organization_id;

  if item_count = 0 then
    raise exception 'purchase receipt has no items' using errcode = '22023';
  end if;

  paid_amount_value := receipt_record.paid_amount;
  payment_method_value := nullif(p_payload->>'payment_method', '');

  if paid_amount_value > 0 then
    if payment_method_value not in ('cash', 'bank_transfer') then
      raise exception 'payment method is required' using errcode = '22023';
    end if;

    if payment_method_value = 'cash' then
      select fa.id
        into finance_account_id_value
      from public.finance_accounts fa
      where fa.organization_id = p_organization_id
        and fa.account_type = 'cash'
        and fa.is_default_cash = true
        and fa.is_active = true
      limit 1;
    else
      finance_account_id_value := nullif(p_payload->>'finance_account_id', '')::uuid;
    end if;

    if finance_account_id_value is null or not exists (
      select 1
      from public.finance_accounts fa
      where fa.id = finance_account_id_value
        and fa.organization_id = p_organization_id
        and fa.is_active = true
        and (
          (payment_method_value = 'cash' and fa.account_type = 'cash')
          or (payment_method_value = 'bank_transfer' and fa.account_type = 'bank')
        )
    ) then
      raise exception 'finance account is invalid' using errcode = '22023';
    end if;
  end if;

  for item_record in
    select pri.*
    from public.purchase_receipt_items pri
    where pri.purchase_receipt_id = p_receipt_id
      and pri.organization_id = p_organization_id
    order by pri.line_no
  loop
    select pis.*
      into settings_record
    from public.product_inventory_settings pis
    where pis.product_id = item_record.product_id
      and pis.organization_id = p_organization_id;

    if settings_record.id is null or settings_record.stock_unit_id is null then
      raise exception 'inventory settings are required' using errcode = '22023';
    end if;
    if settings_record.inventory_shape <> item_record.inventory_shape then
      raise exception 'purchase item inventory shape does not match product settings' using errcode = '22023';
    end if;

    select iu.*
      into stock_unit_record
    from public.inventory_units iu
    where iu.id = settings_record.stock_unit_id
      and iu.organization_id = p_organization_id
      and iu.is_active = true;

    if stock_unit_record.id is null then
      raise exception 'stock unit is invalid' using errcode = '22023';
    end if;

    perform public.validate_purchase_physical_payload(item_record.inventory_shape, item_record.quantity, item_record.physical_payload);

    if item_record.inventory_shape = 'normal' then
      if lower(btrim(item_record.unit_name_snapshot)) not in (
        lower(btrim(stock_unit_record.name)),
        lower(btrim(stock_unit_record.code))
      ) then
        raise exception 'purchase unit must match stock unit in P3' using errcode = '22023';
      end if;

      insert into public.stock_movements (
        organization_id,
        product_id,
        movement_type,
        quantity_delta,
        stock_unit_id,
        display_quantity,
        display_unit_id,
        inventory_object_type,
        purchase_receipt_id,
        purchase_receipt_item_id,
        reason,
        created_by
      )
      values (
        p_organization_id,
        item_record.product_id,
        'purchase_receipt',
        item_record.quantity,
        settings_record.stock_unit_id,
        item_record.quantity,
        settings_record.stock_unit_id,
        null,
        p_receipt_id,
        item_record.id,
        'purchase receipt ' || receipt_record.code,
        p_actor_user_id
      );
    elsif item_record.inventory_shape = 'roll' then
      roll_width_value := (item_record.physical_payload#>>'{rolls,width_m}')::numeric;
      object_index_value := 0;
      for roll_length_value in
        select value::text::numeric
        from jsonb_array_elements(item_record.physical_payload#>'{rolls,lengths_m}') as value
      loop
        object_index_value := object_index_value + 1;
        roll_area_value := round(roll_width_value * roll_length_value, 3);
        object_code_value := receipt_record.code || '-L' || item_record.line_no || '-R' || lpad(object_index_value::text, 3, '0');

        insert into public.inventory_rolls (
          organization_id,
          product_id,
          code,
          width_m,
          initial_length_m,
          remaining_length_m,
          initial_area_m2,
          remaining_area_m2,
          status,
          note,
          created_by
        )
        values (
          p_organization_id,
          item_record.product_id,
          object_code_value,
          roll_width_value,
          roll_length_value,
          roll_length_value,
          roll_area_value,
          roll_area_value,
          'available',
          'purchase receipt ' || receipt_record.code,
          p_actor_user_id
        )
        returning id into roll_id_value;

        insert into public.stock_movements (
          organization_id,
          product_id,
          movement_type,
          quantity_delta,
          stock_unit_id,
          display_quantity,
          display_unit_id,
          inventory_object_type,
          inventory_roll_id,
          purchase_receipt_id,
          purchase_receipt_item_id,
          reason,
          created_by
        )
        values (
          p_organization_id,
          item_record.product_id,
          'purchase_receipt',
          roll_area_value,
          settings_record.stock_unit_id,
          roll_area_value,
          settings_record.stock_unit_id,
          'roll',
          roll_id_value,
          p_receipt_id,
          item_record.id,
          'purchase receipt ' || receipt_record.code,
          p_actor_user_id
        );
      end loop;
    elsif item_record.inventory_shape = 'sheet' then
      object_index_value := 0;
      for sheet_group_value in
        select value
        from jsonb_array_elements(item_record.physical_payload->'sheet_groups') as value
      loop
        sheet_width_value := (sheet_group_value->>'width_m')::numeric;
        sheet_length_value := (sheet_group_value->>'length_m')::numeric;
        sheet_quantity_value := (sheet_group_value->>'quantity')::integer;
        sheet_area_value := round(sheet_width_value * sheet_length_value, 3);

        for sheet_index_value in 1..sheet_quantity_value loop
          object_index_value := object_index_value + 1;
          object_code_value := receipt_record.code || '-L' || item_record.line_no || '-S' || lpad(object_index_value::text, 3, '0');

          insert into public.inventory_sheets (
            organization_id,
            product_id,
            code,
            sheet_kind,
            width_m,
            length_m,
            area_m2,
            status,
            note,
            created_by
          )
          values (
            p_organization_id,
            item_record.product_id,
            object_code_value,
            'full',
            sheet_width_value,
            sheet_length_value,
            sheet_area_value,
            'available',
            'purchase receipt ' || receipt_record.code,
            p_actor_user_id
          )
          returning id into sheet_id_value;

          insert into public.stock_movements (
            organization_id,
            product_id,
            movement_type,
            quantity_delta,
            stock_unit_id,
            display_quantity,
            display_unit_id,
            inventory_object_type,
            inventory_sheet_id,
            purchase_receipt_id,
            purchase_receipt_item_id,
            reason,
            created_by
          )
          values (
            p_organization_id,
            item_record.product_id,
            'purchase_receipt',
            1,
            settings_record.stock_unit_id,
            1,
            settings_record.stock_unit_id,
            'sheet',
            sheet_id_value,
            p_receipt_id,
            item_record.id,
            'purchase receipt ' || receipt_record.code,
            p_actor_user_id
          );
        end loop;
      end loop;
    end if;

    update public.products
    set
      latest_purchase_cost = item_record.unit_cost,
      latest_purchase_cost_at = posted_at_value,
      latest_purchase_cost_updated_by = p_actor_user_id
    where id = item_record.product_id
      and organization_id = p_organization_id;
  end loop;

  if paid_amount_value > 0 then
    voucher_code_value := public.next_cashbook_voucher_code(p_organization_id, 'out');
    voucher_reason_value := 'Phiếu nhập ' || receipt_record.code
      || ' - ' || supplier_record.code || ' - ' || supplier_record.name
      || coalesce(' - CT NCC ' || receipt_record.supplier_document_no, '')
      || ' - ' || case when payment_method_value = 'bank_transfer' then 'Chuyển khoản' else 'Tiền mặt' end;

    insert into public.cashbook_vouchers (
      organization_id,
      code,
      base_code,
      revision_no,
      voucher_direction,
      voucher_type,
      status,
      finance_account_id,
      amount,
      is_business_accounted,
      counterparty_type,
      counterparty_name,
      counterparty_phone,
      related_purchase_receipt_id,
      related_supplier_id,
      reason,
      created_by
    )
    values (
      p_organization_id,
      voucher_code_value,
      voucher_code_value,
      0,
      'out',
      'material_purchase',
      'posted',
      finance_account_id_value,
      paid_amount_value,
      true,
      'supplier',
      supplier_record.code || ' - ' || supplier_record.name,
      supplier_record.phone,
      p_receipt_id,
      supplier_record.id,
      voucher_reason_value,
      p_actor_user_id
    )
    returning id into voucher_id_value;

    insert into public.cashbook_entries (
      organization_id,
      finance_account_id,
      source_type,
      cashbook_voucher_id,
      status,
      direction,
      amount_delta,
      description,
      created_by
    )
    values (
      p_organization_id,
      finance_account_id_value,
      'cashbook_voucher',
      voucher_id_value,
      'posted',
      'out',
      -paid_amount_value,
      voucher_reason_value,
      p_actor_user_id
    );
  end if;

  update public.purchase_receipts
  set
    status = 'posted',
    posted_by = p_actor_user_id,
    posted_at = posted_at_value,
    updated_at = posted_at_value
  where id = p_receipt_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'purchase_receipt_id', p_receipt_id,
    'status', 'posted',
    'posted_at', posted_at_value,
    'cashbook_voucher_id', voucher_id_value
  );
end;
$$;

grant execute on function public.validate_purchase_physical_payload(text, numeric, jsonb) to service_role;
grant execute on function public.save_purchase_receipt_draft_tx(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.post_purchase_receipt_tx(uuid, uuid, uuid, jsonb) to service_role;
