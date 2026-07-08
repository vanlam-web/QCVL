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
  customer_id_value uuid;
  price_list_id_value uuid;
  order_id_value uuid;
  order_code_value text;
  payment_receipt_id_value uuid;
  receipt_code_value text;
  cash_account_id_value uuid;
  bank_account_id_value uuid;
  cash_amount_value numeric(12,0);
  bank_amount_value numeric(12,0);
  total_received_value numeric(12,0);
  old_debt_payment_value numeric(12,0);
  change_returned_value numeric(12,0);
  sale_payment_value numeric(12,0);
  debt_amount_value numeric(12,0);
  subtotal_amount_value numeric(12,0) := 0;
  discount_amount_value numeric(12,0) := 0;
  total_amount_value numeric(12,0);
  payment_status_value text;
  receipt_type_value text;
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  settings_record record;
  quantity_value numeric(12,3);
  width_m_value numeric(12,3);
  height_m_value numeric(12,3);
  linear_m_value numeric(12,3);
  stock_delta_value numeric(12,3);
  unit_price_value numeric(12,0);
  line_subtotal_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_total_value numeric(12,0);
  order_item_id_value uuid;
  method_line_no integer := 0;
  payment_method_id_value uuid;
  remaining_debt_payment numeric(12,0);
  debt_order_record record;
  allocation_amount numeric(12,0);
  outstanding_before numeric(12,0);
  outstanding_after numeric(12,0);
  allocation_line_no integer := 0;
  debt_allocation_id_value uuid;
  customer_balance_value numeric(12,0);
  retail_debt_note_value text;
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
    raise exception 'checkout items are required' using errcode = '22023';
  end if;

  customer_id_value := nullif(p_payload->>'customer_id', '')::uuid;
  retail_debt_note_value := nullif(btrim(coalesce(p_payload->>'retail_debt_note', '')), '');
  cash_amount_value := coalesce(((p_payload->'payment')->>'cash_amount')::numeric, 0);
  bank_amount_value := coalesce(((p_payload->'payment')->>'bank_amount')::numeric, 0);
  old_debt_payment_value := coalesce(((p_payload->'payment')->>'old_debt_payment_amount')::numeric, 0);
  change_returned_value := coalesce(((p_payload->'payment')->>'change_returned_amount')::numeric, 0);
  total_received_value := cash_amount_value + bank_amount_value;

  if cash_amount_value < 0 or bank_amount_value < 0 or old_debt_payment_value < 0 or change_returned_value < 0 then
    raise exception 'payment amounts must be non-negative' using errcode = '22023';
  end if;

  if old_debt_payment_value > 0 and customer_id_value is null then
    raise exception 'customer_id is required for old debt payment' using errcode = '22023';
  end if;

  if bank_amount_value > 0 then
    bank_account_id_value := nullif((p_payload->'payment')->>'bank_account_id', '')::uuid;

    if bank_account_id_value is null or not exists (
      select 1
      from public.finance_accounts fa
      where fa.id = bank_account_id_value
        and fa.organization_id = p_organization_id
        and fa.account_type = 'bank'
        and fa.is_active = true
    ) then
      raise exception 'bank_account_id must reference an active bank account' using errcode = '22023';
    end if;
  end if;

  select fa.id
    into cash_account_id_value
  from public.finance_accounts fa
  where fa.organization_id = p_organization_id
    and fa.account_type = 'cash'
    and fa.is_default_cash = true
    and fa.is_active = true
  limit 1;

  if cash_amount_value > 0 and cash_account_id_value is null then
    raise exception 'default cash account is not configured' using errcode = '22023';
  end if;

  select pl.id
    into price_list_id_value
  from public.price_lists pl
  where pl.organization_id = p_organization_id
    and pl.is_default = true
    and pl.is_active = true
  limit 1;

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
  sale_payment_value := least(total_amount_value, greatest(total_received_value - old_debt_payment_value, 0));
  debt_amount_value := total_amount_value - sale_payment_value;

  if debt_amount_value > 0 and customer_id_value is null and retail_debt_note_value is null then
    raise exception 'retail_debt_note is required for retail debt' using errcode = '22023';
  end if;

  payment_status_value := case
    when debt_amount_value = 0 then 'paid'
    when sale_payment_value > 0 then 'partial'
    else 'unpaid'
  end;

  order_code_value := public.next_order_code(p_organization_id, 'HD');

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
    'invoice',
    'completed',
    order_code_value,
    0,
    customer_id_value,
    coalesce(
      (
        select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name, 'phone', c.phone)
        from public.customers c
        where c.id = customer_id_value
          and c.organization_id = p_organization_id
      ),
      jsonb_build_object('type', 'retail')
    ),
    price_list_id_value,
    subtotal_amount_value,
    discount_amount_value,
    total_amount_value,
    sale_payment_value,
    debt_amount_value,
    change_returned_value,
    payment_status_value,
    p_payload->>'note',
    p_actor_user_id
  )
  returning id into order_id_value;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := (item_value->>'quantity')::numeric;
    width_m_value := nullif(item_value->>'width_m', '')::numeric;
    height_m_value := nullif(item_value->>'height_m', '')::numeric;
    linear_m_value := nullif(item_value->>'linear_m', '')::numeric;
    unit_price_value := (item_value->>'unit_price')::numeric;
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_total_value := line_subtotal_value - line_discount_value;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id;

    select pis.*
      into settings_record
    from public.product_inventory_settings pis
    where pis.product_id = product_id_value
      and pis.organization_id = p_organization_id;

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
      width_m_value,
      height_m_value,
      linear_m_value,
      unit_price_value,
      line_subtotal_value,
      line_discount_value,
      coalesce(item_value->>'price_source', 'manual'),
      line_total_value,
      item_value->>'note'
    )
    returning id into order_item_id_value;

    if settings_record.stock_unit_id is not null then
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

      if stock_delta_value <= 0 then
        raise exception 'stock deduction quantity is invalid' using errcode = '22023';
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
        order_id,
        order_item_id,
        reason,
        created_by
      )
      values (
        p_organization_id,
        product_id_value,
        'sale_deduction',
        -stock_delta_value,
        settings_record.stock_unit_id,
        stock_delta_value,
        settings_record.stock_unit_id,
        null,
        order_id_value,
        order_item_id_value,
        'checkout',
        p_actor_user_id
      );
    end if;
  end loop;

  if total_received_value > 0 then
    receipt_code_value := public.next_payment_receipt_code(p_organization_id);
    receipt_type_value := case
      when sale_payment_value > 0 and old_debt_payment_value > 0 then 'mixed_sale_and_debt'
      when old_debt_payment_value > 0 then 'debt_collection'
      else 'sale_payment'
    end;

    insert into public.payment_receipts (
      organization_id,
      code,
      base_code,
      revision_no,
      status,
      receipt_type,
      customer_id,
      order_id,
      total_received_amount,
      sale_payment_amount,
      debt_collection_amount,
      change_returned_amount,
      created_by
    )
    values (
      p_organization_id,
      receipt_code_value,
      receipt_code_value,
      0,
      'posted',
      receipt_type_value,
      customer_id_value,
      order_id_value,
      total_received_value,
      sale_payment_value,
      old_debt_payment_value,
      change_returned_value,
      p_actor_user_id
    )
    returning id into payment_receipt_id_value;

    if cash_amount_value > 0 then
      method_line_no := method_line_no + 1;
      insert into public.payment_receipt_methods (
        organization_id,
        payment_receipt_id,
        line_no,
        finance_account_id,
        method_type,
        amount
      )
      values (
        p_organization_id,
        payment_receipt_id_value,
        method_line_no,
        cash_account_id_value,
        'cash',
        cash_amount_value
      )
      returning id into payment_method_id_value;

      insert into public.cashbook_entries (
        organization_id,
        finance_account_id,
        source_type,
        payment_receipt_method_id,
        status,
        direction,
        amount_delta,
        description,
        created_by
      )
      values (
        p_organization_id,
        cash_account_id_value,
        'payment_receipt_method',
        payment_method_id_value,
        'posted',
        'in',
        cash_amount_value,
        'Checkout ' || order_code_value,
        p_actor_user_id
      );
    end if;

    if bank_amount_value > 0 then
      method_line_no := method_line_no + 1;
      insert into public.payment_receipt_methods (
        organization_id,
        payment_receipt_id,
        line_no,
        finance_account_id,
        method_type,
        amount,
        bank_transaction_ref
      )
      values (
        p_organization_id,
        payment_receipt_id_value,
        method_line_no,
        bank_account_id_value,
        'bank_transfer',
        bank_amount_value,
        (p_payload->'payment')->>'bank_transaction_ref'
      )
      returning id into payment_method_id_value;

      insert into public.cashbook_entries (
        organization_id,
        finance_account_id,
        source_type,
        payment_receipt_method_id,
        status,
        direction,
        amount_delta,
        description,
        created_by
      )
      values (
        p_organization_id,
        bank_account_id_value,
        'payment_receipt_method',
        payment_method_id_value,
        'posted',
        'in',
        bank_amount_value,
        'Checkout ' || order_code_value,
        p_actor_user_id
      );
    end if;
  end if;

  if debt_amount_value > 0 then
    customer_balance_value := (
      select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
      from public.orders o
      left join public.customer_debt_allocations a on a.order_id = o.id
      where o.organization_id = p_organization_id
        and o.customer_id is not distinct from customer_id_value
        and o.order_type = 'invoice'
        and o.status = 'completed'
    );

    insert into public.customer_debt_entries (
      organization_id,
      customer_id,
      order_id,
      entry_type,
      amount_delta,
      balance_after_order,
      balance_after_customer,
      retail_debt_note,
      created_by
    )
    values (
      p_organization_id,
      customer_id_value,
      order_id_value,
      'invoice_debt',
      debt_amount_value,
      debt_amount_value,
      customer_balance_value,
      retail_debt_note_value,
      p_actor_user_id
    );
  end if;

  remaining_debt_payment := old_debt_payment_value;
  while remaining_debt_payment > 0 loop
    select
      o.id as order_id,
      o.debt_amount - coalesce(sum(a.allocated_amount), 0) as outstanding
      into debt_order_record
    from public.orders o
    left join public.customer_debt_allocations a on a.order_id = o.id
    where o.organization_id = p_organization_id
      and o.customer_id = customer_id_value
      and o.order_type = 'invoice'
      and o.status = 'completed'
      and o.id <> order_id_value
    group by o.id, o.debt_amount, o.created_at
    having o.debt_amount - coalesce(sum(a.allocated_amount), 0) > 0
    order by o.created_at asc, o.code asc
    limit 1;

    if debt_order_record.order_id is null then
      raise exception 'debt collection cannot exceed outstanding debt' using errcode = '22023';
    end if;

    outstanding_before := debt_order_record.outstanding;
    allocation_amount := least(remaining_debt_payment, outstanding_before);
    outstanding_after := outstanding_before - allocation_amount;
    allocation_line_no := allocation_line_no + 1;

    insert into public.customer_debt_allocations (
      organization_id,
      payment_receipt_id,
      line_no,
      customer_id,
      order_id,
      allocated_amount,
      order_debt_before,
      order_debt_after
    )
    values (
      p_organization_id,
      payment_receipt_id_value,
      allocation_line_no,
      customer_id_value,
      debt_order_record.order_id,
      allocation_amount,
      outstanding_before,
      outstanding_after
    )
    returning id into debt_allocation_id_value;

    customer_balance_value := (
      select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
      from public.orders o
      left join public.customer_debt_allocations a on a.order_id = o.id
      where o.organization_id = p_organization_id
        and o.customer_id = customer_id_value
        and o.order_type = 'invoice'
        and o.status = 'completed'
    );

    insert into public.customer_debt_entries (
      organization_id,
      customer_id,
      order_id,
      entry_type,
      amount_delta,
      balance_after_order,
      balance_after_customer,
      payment_receipt_id,
      debt_allocation_id,
      created_by
    )
    values (
      p_organization_id,
      customer_id_value,
      debt_order_record.order_id,
      'debt_payment',
      -allocation_amount,
      outstanding_after,
      customer_balance_value,
      payment_receipt_id_value,
      debt_allocation_id_value,
      p_actor_user_id
    );

    remaining_debt_payment := remaining_debt_payment - allocation_amount;
  end loop;

  return jsonb_build_object(
    'order_id', order_id_value,
    'order_code', order_code_value,
    'payment_receipt_id', payment_receipt_id_value,
    'order', jsonb_build_object(
      'id', order_id_value,
      'code', order_code_value,
      'order_type', 'invoice',
      'status', 'completed',
      'total_amount', total_amount_value,
      'paid_amount', sale_payment_value,
      'debt_amount', debt_amount_value,
      'payment_status', payment_status_value
    ),
    'payment_receipt', case
      when payment_receipt_id_value is null then null
      else jsonb_build_object(
        'id', payment_receipt_id_value,
        'code', receipt_code_value,
        'total_received_amount', total_received_value
      )
    end,
    'inventory_warnings', '[]'::jsonb,
    'total_amount', total_amount_value,
    'paid_amount', sale_payment_value,
    'debt_amount', debt_amount_value,
    'change_returned_amount', change_returned_value
  );
end;
$$;

create or replace function public.collect_customer_debt_tx(
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
  customer_id_value uuid := nullif(p_payload->>'customer_id', '')::uuid;
  cash_amount_value numeric(12,0) := coalesce((p_payload->>'cash_amount')::numeric, 0);
  bank_amount_value numeric(12,0) := coalesce((p_payload->>'bank_amount')::numeric, 0);
  bank_account_id_value uuid;
  cash_account_id_value uuid;
  total_amount_value numeric(12,0);
  outstanding_value numeric(12,0);
  payment_receipt_id_value uuid;
  receipt_code_value text;
  method_line_no integer := 0;
  payment_method_id_value uuid;
  remaining_debt_payment numeric(12,0);
  debt_order_record record;
  allocation_amount numeric(12,0);
  outstanding_before numeric(12,0);
  outstanding_after numeric(12,0);
  allocation_line_no integer := 0;
  debt_allocation_id_value uuid;
  customer_balance_value numeric(12,0);
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

  if customer_id_value is null then
    raise exception 'customer_id is required for debt collection' using errcode = '22023';
  end if;

  if cash_amount_value < 0 or bank_amount_value < 0 then
    raise exception 'payment amounts must be non-negative' using errcode = '22023';
  end if;

  total_amount_value := cash_amount_value + bank_amount_value;

  select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
    into outstanding_value
  from public.orders o
  left join public.customer_debt_allocations a on a.order_id = o.id
  where o.organization_id = p_organization_id
    and o.customer_id = customer_id_value
    and o.order_type = 'invoice'
    and o.status = 'completed';

  if total_amount_value <= 0 or total_amount_value > coalesce(outstanding_value, 0) then
    raise exception 'debt collection cannot exceed outstanding debt' using errcode = '22023';
  end if;

  select fa.id
    into cash_account_id_value
  from public.finance_accounts fa
  where fa.organization_id = p_organization_id
    and fa.account_type = 'cash'
    and fa.is_default_cash = true
    and fa.is_active = true
  limit 1;

  if cash_amount_value > 0 and cash_account_id_value is null then
    raise exception 'default cash account is not configured' using errcode = '22023';
  end if;

  if bank_amount_value > 0 then
    bank_account_id_value := nullif(p_payload->>'bank_account_id', '')::uuid;

    if bank_account_id_value is null or not exists (
      select 1
      from public.finance_accounts fa
      where fa.id = bank_account_id_value
        and fa.organization_id = p_organization_id
        and fa.account_type = 'bank'
        and fa.is_active = true
    ) then
      raise exception 'bank_account_id must reference an active bank account' using errcode = '22023';
    end if;
  end if;

  receipt_code_value := public.next_payment_receipt_code(p_organization_id);

  insert into public.payment_receipts (
    organization_id,
    code,
    base_code,
    revision_no,
    status,
    receipt_type,
    customer_id,
    order_id,
    total_received_amount,
    sale_payment_amount,
    debt_collection_amount,
    change_returned_amount,
    created_by
  )
  values (
    p_organization_id,
    receipt_code_value,
    receipt_code_value,
    0,
    'posted',
    'debt_collection',
    customer_id_value,
    null,
    total_amount_value,
    0,
    total_amount_value,
    0,
    p_actor_user_id
  )
  returning id into payment_receipt_id_value;

  if cash_amount_value > 0 then
    method_line_no := method_line_no + 1;
    insert into public.payment_receipt_methods (
      organization_id,
      payment_receipt_id,
      line_no,
      finance_account_id,
      method_type,
      amount
    )
    values (
      p_organization_id,
      payment_receipt_id_value,
      method_line_no,
      cash_account_id_value,
      'cash',
      cash_amount_value
    )
    returning id into payment_method_id_value;

    insert into public.cashbook_entries (
      organization_id,
      finance_account_id,
      source_type,
      payment_receipt_method_id,
      status,
      direction,
      amount_delta,
      description,
      created_by
    )
    values (
      p_organization_id,
      cash_account_id_value,
      'payment_receipt_method',
      payment_method_id_value,
      'posted',
      'in',
      cash_amount_value,
      'Debt collection ' || receipt_code_value,
      p_actor_user_id
    );
  end if;

  if bank_amount_value > 0 then
    method_line_no := method_line_no + 1;
    insert into public.payment_receipt_methods (
      organization_id,
      payment_receipt_id,
      line_no,
      finance_account_id,
      method_type,
      amount,
      bank_transaction_ref
    )
    values (
      p_organization_id,
      payment_receipt_id_value,
      method_line_no,
      bank_account_id_value,
      'bank_transfer',
      bank_amount_value,
      p_payload->>'bank_transaction_ref'
    )
    returning id into payment_method_id_value;

    insert into public.cashbook_entries (
      organization_id,
      finance_account_id,
      source_type,
      payment_receipt_method_id,
      status,
      direction,
      amount_delta,
      description,
      created_by
    )
    values (
      p_organization_id,
      bank_account_id_value,
      'payment_receipt_method',
      payment_method_id_value,
      'posted',
      'in',
      bank_amount_value,
      'Debt collection ' || receipt_code_value,
      p_actor_user_id
    );
  end if;

  remaining_debt_payment := total_amount_value;
  while remaining_debt_payment > 0 loop
    select
      o.id as order_id,
      o.debt_amount - coalesce(sum(a.allocated_amount), 0) as outstanding
      into debt_order_record
    from public.orders o
    left join public.customer_debt_allocations a on a.order_id = o.id
    where o.organization_id = p_organization_id
      and o.customer_id = customer_id_value
      and o.order_type = 'invoice'
      and o.status = 'completed'
    group by o.id, o.debt_amount, o.created_at
    having o.debt_amount - coalesce(sum(a.allocated_amount), 0) > 0
    order by o.created_at asc, o.code asc
    limit 1;

    if debt_order_record.order_id is null then
      raise exception 'debt collection cannot exceed outstanding debt' using errcode = '22023';
    end if;

    outstanding_before := debt_order_record.outstanding;
    allocation_amount := least(remaining_debt_payment, outstanding_before);
    outstanding_after := outstanding_before - allocation_amount;
    allocation_line_no := allocation_line_no + 1;

    insert into public.customer_debt_allocations (
      organization_id,
      payment_receipt_id,
      line_no,
      customer_id,
      order_id,
      allocated_amount,
      order_debt_before,
      order_debt_after
    )
    values (
      p_organization_id,
      payment_receipt_id_value,
      allocation_line_no,
      customer_id_value,
      debt_order_record.order_id,
      allocation_amount,
      outstanding_before,
      outstanding_after
    )
    returning id into debt_allocation_id_value;

    customer_balance_value := (
      select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
      from public.orders o
      left join public.customer_debt_allocations a on a.order_id = o.id
      where o.organization_id = p_organization_id
        and o.customer_id = customer_id_value
        and o.order_type = 'invoice'
        and o.status = 'completed'
    );

    insert into public.customer_debt_entries (
      organization_id,
      customer_id,
      order_id,
      entry_type,
      amount_delta,
      balance_after_order,
      balance_after_customer,
      payment_receipt_id,
      debt_allocation_id,
      created_by
    )
    values (
      p_organization_id,
      customer_id_value,
      debt_order_record.order_id,
      'debt_payment',
      -allocation_amount,
      outstanding_after,
      customer_balance_value,
      payment_receipt_id_value,
      debt_allocation_id_value,
      p_actor_user_id
    );

    remaining_debt_payment := remaining_debt_payment - allocation_amount;
  end loop;

  return jsonb_build_object(
    'payment_receipt_id', payment_receipt_id_value,
    'payment_receipt_code', receipt_code_value,
    'allocated_amount', total_amount_value
  );
end;
$$;
