begin;

select plan(19);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '90000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'quote-admin@example.test',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name, status)
values (
  '90000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Quote Admin',
  'active'
);

insert into public.user_permissions (user_id, permission_code, granted_by)
values (
  '90000000-0000-4000-8000-000000000001',
  'perm.create_order',
  '90000000-0000-4000-8000-000000000001'
);

select has_function(
  'public',
  'save_quote_tx',
  array['uuid', 'uuid', 'jsonb'],
  'quote save transaction rpc exists'
);

create temporary table quote_results (
  name text primary key,
  result jsonb not null
) on commit drop;

insert into quote_results (name, result)
values (
  'base_quote',
  public.save_quote_tx(
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', null,
      'customer_snapshot', jsonb_build_object('type', 'retail', 'name', 'Khach le'),
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'discount_amount', 10000,
          'price_source', 'manual',
          'note', 'Bao gia test'
        )
      ),
      'note', 'Bao gia phase 3A'
    )
  )
);

select ok(
  (select result->>'order_code' from quote_results where name = 'base_quote') like 'BG%',
  'save quote creates BG code'
);

select is(
  (select order_type from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  'quote',
  'saved order is quote'
);

select is(
  (select status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  'active',
  'quote stays active'
);

select is(
  (select payment_status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  'not_applicable',
  'quote payment status is not applicable'
);

select is(
  (select customer_id from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  '00000000-0000-4000-8000-000000000501'::uuid,
  'quote without selected customer is assigned to KH000001'
);

select is(
  (select customer_snapshot->>'code' from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  'KH000001',
  'quote without selected customer stores KH000001 snapshot'
);

select is(
  (select total_amount from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  170000::numeric,
  'quote stores server-calculated total after line discount'
);

select is(
  (select count(*)::integer from public.stock_movements where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  0,
  'quote creates no stock movement'
);

select is(
  (select count(*)::integer from public.payment_receipts where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  0,
  'quote creates no payment receipt'
);

select is(
  (select count(*)::integer from public.customer_debt_entries where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  0,
  'quote creates no debt entry'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where customer_id = '00000000-0000-4000-8000-000000000501'
      and order_type = 'quote'
      and code = (select result->>'order_code' from quote_results where name = 'base_quote')
  ),
  1,
  'KH000001 quote history includes no-selected-customer quote'
);

insert into quote_results (name, result)
values (
  'copied_quote',
  public.save_quote_tx(
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', null,
      'customer_snapshot', jsonb_build_object('type', 'retail', 'name', 'Khach le'),
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 2,
          'unit_price', 180000,
          'discount_amount', 0,
          'price_source', 'manual'
        )
      ),
      'note', 'Bao gia moi tu noi dung cu'
    )
  )
);

select ok(
  (select result->>'order_code' from quote_results where name = 'copied_quote') like 'BG%',
  'saving reopened draft creates a new BG code'
);

select isnt(
  (select result->>'order_code' from quote_results where name = 'copied_quote'),
  (select result->>'order_code' from quote_results where name = 'base_quote'),
  'new quote is independent from original quote'
);

insert into quote_results (name, result)
values (
  'invoice_from_draft',
  public.checkout_order_tx(
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'customer_id', null,
      'retail_debt_note', 'khach le no',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 180000,
          'discount_amount', 0,
          'price_source', 'manual'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', 180000,
        'bank_amount', 0,
        'old_debt_payment_amount', 0,
        'change_returned_amount', 0
      )
    )
  )
);

select is(
  (select status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)),
  'active',
  'checkout from reopened draft does not convert original quote'
);

select is(
  (select order_type from public.orders where id = ((select result->>'order_id' from quote_results where name = 'invoice_from_draft')::uuid)),
  'invoice',
  'checkout from reopened draft creates normal invoice'
);

select is(
  (select source_quote_id from public.orders where id = ((select result->>'order_id' from quote_results where name = 'invoice_from_draft')::uuid)),
  null::uuid,
  'invoice does not store source quote id in phase 3A'
);

select is(
  (select customer_id from public.orders where id = ((select result->>'order_id' from quote_results where name = 'invoice_from_draft')::uuid)),
  '00000000-0000-4000-8000-000000000501'::uuid,
  'checkout without selected customer is assigned to KH000001'
);

select is(
  (select count(*)::integer from public.order_status_history where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid) and to_status = 'converted'),
  0,
  'checkout from draft writes no quote conversion history'
);

select * from finish();
rollback;
