begin;

select plan(45);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000701',
  'authenticated',
  'authenticated',
  'checkout-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000001',
  'Checkout Test User'
);

select has_function(
  'public',
  'checkout_order_tx',
  array['uuid', 'uuid', 'jsonb'],
  'checkout transaction rpc exists'
);

select has_function(
  'public',
  'collect_customer_debt_tx',
  array['uuid', 'uuid', 'jsonb'],
  'debt collection transaction rpc exists'
);

select has_function(
  'public',
  'revise_invoice_tx',
  array['uuid', 'uuid', 'uuid', 'jsonb'],
  'invoice revision transaction rpc exists'
);

create temporary table checkout_results (
  name text primary key,
  result jsonb not null
) on commit drop;

insert into checkout_results (name, result)
values (
  'cash_full_paid',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 180000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (select count(*)::integer from public.orders where code = (select result->>'order_code' from checkout_results where name = 'cash_full_paid')),
  1,
  'cash checkout creates one order'
);

select is(
  (select count(*)::integer from public.order_items where order_id = ((select result->>'order_id' from checkout_results where name = 'cash_full_paid')::uuid)),
  1,
  'cash checkout creates one order item'
);

select is(
  (select count(*)::integer from public.stock_movements where order_id = ((select result->>'order_id' from checkout_results where name = 'cash_full_paid')::uuid) and movement_type = 'sale_deduction'),
  1,
  'cash checkout creates one sale deduction stock movement'
);

select is(
  (select count(*)::integer from public.payment_receipts where order_id = ((select result->>'order_id' from checkout_results where name = 'cash_full_paid')::uuid)),
  1,
  'cash checkout creates one payment receipt'
);

insert into public.products (
  id,
  organization_id,
  code,
  name,
  status,
  unit_name,
  sell_method,
  latest_purchase_cost
)
values (
  '20000000-0000-4000-8000-000000000306',
  '00000000-0000-4000-8000-000000000001',
  'COMBO-TEST',
  'Combo test vật tư cấu thành',
  'active',
  'bộ',
  'combo',
  0
);

select public.save_product_bom_v1_tx(
  '20000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000306',
  jsonb_build_array(
    jsonb_build_object(
      'component_product_id', '00000000-0000-4000-8000-000000000303',
      'quantity', 2,
      'notes', 'Vật tư cấu thành test'
    )
  ),
  'BOM combo test'
);

insert into checkout_results (name, result)
values (
  'combo_snapshot',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '20000000-0000-4000-8000-000000000306',
          'quantity', 2,
          'unit_price', 120000,
          'price_source', 'manual'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 240000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (
    select product_snapshot->>'sell_method'
    from public.order_items
    where order_id = ((select result->>'order_id' from checkout_results where name = 'combo_snapshot')::uuid)
  ),
  'combo',
  'combo checkout stores product snapshot sell method'
);

select is(
  (
    select count(*)::integer
    from public.order_item_bom_snapshots
    where order_item_id in (
      select id from public.order_items
      where order_id = ((select result->>'order_id' from checkout_results where name = 'combo_snapshot')::uuid)
    )
  ),
  1,
  'combo checkout stores BOM snapshot'
);

select is(
  (
    select sum(quantity_delta)
    from public.stock_movements
    where order_id = ((select result->>'order_id' from checkout_results where name = 'combo_snapshot')::uuid)
      and product_id = '00000000-0000-4000-8000-000000000303'
      and movement_type = 'sale_deduction'
  ),
  -4::numeric,
  'combo checkout deducts component stock'
);

select is(
  (
    select count(*)::integer
    from public.stock_movements
    where order_id = ((select result->>'order_id' from checkout_results where name = 'combo_snapshot')::uuid)
      and product_id = '20000000-0000-4000-8000-000000000306'
  ),
  0,
  'combo checkout does not deduct combo product stock'
);

select is(
  (
    select count(*)::integer
    from public.payment_receipt_methods prm
    join public.payment_receipts pr on pr.id = prm.payment_receipt_id
    where pr.order_id = ((select result->>'order_id' from checkout_results where name = 'cash_full_paid')::uuid)
  ),
  1,
  'cash checkout creates one payment method'
);

select is(
  (
    select count(*)::integer
    from public.cashbook_entries ce
    join public.payment_receipt_methods prm on prm.id = ce.payment_receipt_method_id
    join public.payment_receipts pr on pr.id = prm.payment_receipt_id
    where pr.order_id = ((select result->>'order_id' from checkout_results where name = 'cash_full_paid')::uuid)
  ),
  1,
  'cash checkout creates one cashbook entry'
);

insert into checkout_results (name, result)
values (
  'line_discount',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'discount_amount', 30000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 150000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (select subtotal_amount from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'line_discount')::uuid)),
  180000::numeric,
  'discount checkout stores subtotal before discount'
);

select is(
  (select discount_amount from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'line_discount')::uuid)),
  30000::numeric,
  'discount checkout stores invoice discount'
);

select is(
  (select total_amount from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'line_discount')::uuid)),
  150000::numeric,
  'discount checkout stores payable total after discount'
);

select is(
  (select line_total from public.order_items where order_id = ((select result->>'order_id' from checkout_results where name = 'line_discount')::uuid)),
  150000::numeric,
  'discount checkout stores line total after discount'
);

insert into checkout_results (name, result)
values (
  'partial_paid',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'retail_debt_note', 'partial paid retail debt fixture',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 80000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

insert into checkout_results (name, result)
values (
  'area_dimensions',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000302',
          'quantity', 2,
          'width_m', 1.2,
          'height_m', 0.5,
          'unit_price', 65000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 130000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (
    select width_m
    from public.order_items
    where order_id = ((select result->>'order_id' from checkout_results where name = 'area_dimensions')::uuid)
  ),
  1.2::numeric,
  'checkout stores line width snapshot'
);

select is(
  (
    select height_m
    from public.order_items
    where order_id = ((select result->>'order_id' from checkout_results where name = 'area_dimensions')::uuid)
  ),
  0.5::numeric,
  'checkout stores line height snapshot'
);

select is(
  (
    select quantity_delta
    from public.stock_movements
    where order_id = ((select result->>'order_id' from checkout_results where name = 'area_dimensions')::uuid)
  ),
  -1.2::numeric,
  'area checkout deducts width times height times quantity from stock'
);

select is(
  (select debt_amount from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'partial_paid')::uuid)),
  100000::numeric,
  'partial checkout stores invoice-level debt'
);

select is(
  (select count(*)::integer from public.customer_debt_entries where order_id = ((select result->>'order_id' from checkout_results where name = 'partial_paid')::uuid) and entry_type = 'invoice_debt'),
  1,
  'partial checkout creates invoice debt entry'
);

insert into checkout_results (name, result)
values (
  'mixed_payment',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 100000,
        'bank_amount', 80000,
        'bank_account_id', '00000000-0000-4000-8000-000000000902',
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (
    select count(*)::integer
    from public.payment_receipt_methods prm
    join public.payment_receipts pr on pr.id = prm.payment_receipt_id
    where pr.order_id = ((select result->>'order_id' from checkout_results where name = 'mixed_payment')::uuid)
  ),
  2,
  'mixed checkout creates two payment methods'
);

select is(
  (
    select count(*)::integer
    from public.cashbook_entries ce
    join public.payment_receipt_methods prm on prm.id = ce.payment_receipt_method_id
    join public.payment_receipts pr on pr.id = prm.payment_receipt_id
    where pr.order_id = ((select result->>'order_id' from checkout_results where name = 'mixed_payment')::uuid)
  ),
  2,
  'mixed checkout creates two cashbook entries'
);

insert into checkout_results (name, result)
values (
  'old_debt_payment',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 230000,
        'bank_amount', 0,
        'old_debt_payment_amount', 50000
      )
    )
  )
);

select is(
  (select count(*)::integer from public.customer_debt_allocations where payment_receipt_id = ((select result->>'payment_receipt_id' from checkout_results where name = 'old_debt_payment')::uuid)),
  1,
  'old debt payment creates one allocation'
);

select is(
  (
    select allocated_amount
    from public.customer_debt_allocations
    where payment_receipt_id = ((select result->>'payment_receipt_id' from checkout_results where name = 'old_debt_payment')::uuid)
  ),
  50000::numeric,
  'old debt payment allocates requested amount'
);

select is(
  (
    select order_id
    from public.customer_debt_allocations
    where payment_receipt_id = ((select result->>'payment_receipt_id' from checkout_results where name = 'old_debt_payment')::uuid)
  ),
  ((select result->>'order_id' from checkout_results where name = 'partial_paid')::uuid),
  'old debt payment allocates to oldest unpaid invoice first'
);

insert into checkout_results (name, result)
values (
  'return_change',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 180000,
        'bank_amount', 0,
        'change_returned_amount', 20000,
        'old_debt_payment_amount', 0,
        'overpayment_handling', 'return_change'
      )
    )
  )
);

select is(
  (select change_returned_amount from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'return_change')::uuid)),
  20000::numeric,
  'return change checkout stores change_returned'
);

select is(
  (
    select coalesce(min(balance_after_customer), 0)
    from public.customer_debt_entries
    where customer_id = '00000000-0000-4000-8000-000000000501'
  ) >= 0,
  true,
  'return change checkout does not create negative customer debt'
);

insert into checkout_results (name, result)
values (
  'apply_old_debt',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 230000,
        'bank_amount', 0,
        'old_debt_payment_amount', 50000,
        'overpayment_handling', 'apply_old_debt'
      )
    )
  )
);

select is(
  (
    select allocated_amount
    from public.customer_debt_allocations
    where payment_receipt_id = ((select result->>'payment_receipt_id' from checkout_results where name = 'apply_old_debt')::uuid)
  ),
  50000::numeric,
  'apply old debt checkout allocates surplus to old debt'
);

select throws_ok(
  $$
    select public.checkout_order_tx(
      '20000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'customer_id', '00000000-0000-4000-8000-000000000501',
        'items', jsonb_build_array(
          jsonb_build_object(
            'product_id', '00000000-0000-4000-8000-000000000303',
            'quantity', 1,
            'unit_price', 180000,
            'price_source', 'default_price_list'
          )
        ),
        'payment', jsonb_build_object(
          'cash_amount', 0,
          'bank_amount', 180000,
          'bank_account_id', '00000000-0000-4000-8000-000000000901',
          'old_debt_payment_amount', 0
        )
      )
    )
  $$,
  '22023',
  'bank_account_id must reference an active bank account',
  'invalid bank account is rejected'
);

insert into checkout_results (name, result)
values (
  'standalone_debt_source',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'retail_debt_note', 'standalone retail debt fixture',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 50000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 0,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

insert into checkout_results (name, result)
values (
  'standalone_debt_collection',
  public.collect_customer_debt_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'cash_amount', 20000
    )
  )
);

select is(
  (select count(*)::integer from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'standalone_debt_collection')::uuid)),
  0,
  'standalone debt collection does not create an invoice order'
);

select is(
  (
    select receipt_type
    from public.payment_receipts
    where id = ((select result->>'payment_receipt_id' from checkout_results where name = 'standalone_debt_collection')::uuid)
  ),
  'debt_collection',
  'standalone debt collection creates a debt collection receipt'
);

select is(
  (select count(*)::integer from public.orders where code = 'HD999999'),
  0,
  'invalid payment does not leave a sentinel order'
);

select throws_ok(
  $$
    select public.collect_customer_debt_tx(
      '20000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'customer_id', '00000000-0000-4000-8000-000000000501',
        'cash_amount', 40000
      )
    )
  $$,
  '22023',
  'debt collection cannot exceed outstanding debt',
  'debt collection rejects overpayment'
);

select throws_ok(
  $$
    select public.checkout_order_tx(
      '20000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'customer_id', null,
        'items', jsonb_build_array(
          jsonb_build_object(
            'product_id', '00000000-0000-4000-8000-000000000303',
            'quantity', 1,
            'unit_price', 50000,
            'price_source', 'default_price_list'
          )
        ),
        'payment', jsonb_build_object(
          'cash_amount', 0,
          'bank_amount', 0,
          'old_debt_payment_amount', 0
        )
      )
    )
  $$,
  '22023',
  'retail_debt_note is required for KH000001 debt',
  'retail customer debt requires an identifying note'
);

insert into checkout_results (name, result)
values (
  'no_selected_customer_debt',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', null,
      'retail_debt_note', 'khach le no tai quay',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 50000,
          'price_source', 'default_price_list'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 0,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select is(
  (select customer_id from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'no_selected_customer_debt')::uuid)),
  '00000000-0000-4000-8000-000000000501'::uuid,
  'checkout debt without selected customer is assigned to KH000001'
);

select is(
  (select customer_snapshot->>'code' from public.orders where id = ((select result->>'order_id' from checkout_results where name = 'no_selected_customer_debt')::uuid)),
  'KH000001',
  'checkout debt without selected customer stores KH000001 snapshot'
);

select is(
  (select customer_id from public.customer_debt_entries where order_id = ((select result->>'order_id' from checkout_results where name = 'no_selected_customer_debt')::uuid)),
  '00000000-0000-4000-8000-000000000501'::uuid,
  'retail debt without selected customer is tracked under KH000001'
);

insert into public.products (
  id,
  organization_id,
  code,
  name,
  status,
  unit_name,
  sell_method,
  latest_purchase_cost
)
values (
  '20000000-0000-4000-8000-000000000307',
  '00000000-0000-4000-8000-000000000001',
  'ROLL-PENDING',
  'Cuon can gan sau',
  'active',
  'm2',
  'area_m2',
  0
);

insert into public.product_inventory_settings (
  id,
  organization_id,
  product_id,
  track_inventory,
  inventory_shape,
  stock_unit_id,
  default_allow_negative
)
values (
  '20000000-0000-4000-8000-000000000308',
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000307',
  true,
  'roll',
  '00000000-0000-4000-8000-000000000601',
  true
);

insert into checkout_results (name, result)
values (
  'roll_pending_reconciliation',
  public.checkout_order_tx(
    '20000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', '00000000-0000-4000-8000-000000000501',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '20000000-0000-4000-8000-000000000307',
          'quantity', 2,
          'width_m', 1.2,
          'height_m', 2,
          'unit_price', 180000,
          'price_source', 'manual'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 360000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0
      )
    )
  )
);

select ok(
  exists (
    select 1
    from jsonb_array_elements((select result->'inventory_warnings' from checkout_results where name = 'roll_pending_reconciliation')) warning
    where warning->>'code' = 'NEGATIVE_STOCK'
      and warning->>'product_id' = '20000000-0000-4000-8000-000000000307'
  ),
  'checkout returns warning when sale makes physical stock negative'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements((select result->'inventory_warnings' from checkout_results where name = 'roll_pending_reconciliation')) warning
    where warning->>'code' = 'PENDING_MATERIAL_RECONCILIATION'
      and warning->>'product_id' = '20000000-0000-4000-8000-000000000307'
  ),
  'checkout returns warning when roll object is not assigned'
);

select is(
  (
    select inventory_object_type
    from public.stock_movements
    where order_id = ((select result->>'order_id' from checkout_results where name = 'roll_pending_reconciliation')::uuid)
      and product_id = '20000000-0000-4000-8000-000000000307'
  ),
  null,
  'roll sale without object is stored as pending material reconciliation'
);

select throws_ok(
  $$
    select public.revise_invoice_tx(
      '20000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000001',
      (select (result->>'order_id')::uuid from checkout_results where name = 'cash_full_paid'),
      jsonb_build_object()
    )
  $$,
  '22023',
  'revision_reason is required',
  'invoice revision requires a reason'
);

select throws_ok(
  $$
    select public.revise_invoice_tx(
      '20000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000001',
      (select (result->>'order_id')::uuid from checkout_results where name = 'cash_full_paid'),
      jsonb_build_object('revision_reason', 'Sai giá')
    )
  $$,
  '0A000',
  'invoice revision is not implemented yet',
  'invoice revision returns explicit disabled error instead of fake success'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where order_type = 'invoice'
      and status = 'completed'
      and created_by = '20000000-0000-4000-8000-000000000701'
  ),
  12,
  'successful checkout attempts leave twelve completed invoices'
);

select * from finish();
rollback;
