begin;

select plan(42);

select has_table('public', 'purchase_receipts', 'purchase receipts table exists');
select has_table('public', 'purchase_receipt_items', 'purchase receipt items table exists');

select has_column('public', 'purchase_receipts', 'organization_id', 'purchase receipts organization exists');
select has_column('public', 'purchase_receipts', 'code', 'purchase receipts code exists');
select has_column('public', 'purchase_receipts', 'supplier_id', 'purchase receipts supplier exists');
select has_column('public', 'purchase_receipts', 'received_at', 'purchase receipts received_at exists');
select has_column('public', 'purchase_receipts', 'status', 'purchase receipts status exists');
select has_column('public', 'purchase_receipts', 'supplier_document_no', 'purchase receipts supplier document exists');
select has_column('public', 'purchase_receipts', 'subtotal_amount', 'purchase receipts subtotal exists');
select has_column('public', 'purchase_receipts', 'discount_amount', 'purchase receipts discount exists');
select has_column('public', 'purchase_receipts', 'payable_amount', 'purchase receipts payable exists');
select has_column('public', 'purchase_receipts', 'paid_amount', 'purchase receipts paid exists');
select has_column('public', 'purchase_receipts', 'remaining_amount', 'purchase receipts remaining exists');
select has_column('public', 'purchase_receipts', 'notes', 'purchase receipts notes exists');
select has_column('public', 'purchase_receipts', 'created_by', 'purchase receipts creator exists');
select has_column('public', 'purchase_receipts', 'posted_by', 'purchase receipts poster exists');
select has_column('public', 'purchase_receipts', 'cancelled_by', 'purchase receipts canceller exists');

select has_column('public', 'purchase_receipt_items', 'purchase_receipt_id', 'purchase receipt items receipt exists');
select has_column('public', 'purchase_receipt_items', 'product_id', 'purchase receipt items product exists');
select has_column('public', 'purchase_receipt_items', 'line_no', 'purchase receipt items line no exists');
select has_column('public', 'purchase_receipt_items', 'inventory_shape', 'purchase receipt items inventory shape exists');
select has_column('public', 'purchase_receipt_items', 'unit_name_snapshot', 'purchase receipt items unit snapshot exists');
select has_column('public', 'purchase_receipt_items', 'quantity', 'purchase receipt items quantity exists');
select has_column('public', 'purchase_receipt_items', 'unit_cost', 'purchase receipt items unit cost exists');
select has_column('public', 'purchase_receipt_items', 'discount_amount', 'purchase receipt items discount exists');
select has_column('public', 'purchase_receipt_items', 'line_amount', 'purchase receipt items line amount exists');
select has_column('public', 'purchase_receipt_items', 'physical_payload', 'purchase receipt items physical payload exists');

select col_not_null('public', 'purchase_receipts', 'organization_id', 'purchase receipts organization not null');
select col_not_null('public', 'purchase_receipts', 'code', 'purchase receipts code not null');
select col_not_null('public', 'purchase_receipts', 'supplier_id', 'purchase receipts supplier not null');
select col_not_null('public', 'purchase_receipts', 'status', 'purchase receipts status not null');
select col_not_null('public', 'purchase_receipt_items', 'quantity', 'purchase receipt item quantity not null');
select col_not_null('public', 'purchase_receipt_items', 'unit_cost', 'purchase receipt item unit cost not null');
select col_not_null('public', 'purchase_receipt_items', 'line_amount', 'purchase receipt item line amount not null');

select has_function('public', 'next_purchase_receipt_code', array['uuid'], 'purchase receipt code generator exists');
select ok(
  public.next_purchase_receipt_code('00000000-0000-4000-8000-000000000001') ~ '^PN[0-9]{6}$',
  'next purchase receipt code uses PN000001 format'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000811',
  'authenticated',
  'authenticated',
  'purchase-p2-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000001',
  'Purchase P2 Test User'
);

insert into public.suppliers (id, organization_id, code, name)
values (
  '00000000-0000-4000-8000-000000000810',
  '00000000-0000-4000-8000-000000000001',
  'NCC910001',
  'NCC P2'
);

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
  created_by
) values (
  '00000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000001',
  'PN900001',
  '00000000-0000-4000-8000-000000000810',
  '2026-07-01T10:00:00+07:00',
  'draft',
  'HD-NCC-001',
  190000,
  10000,
  180000,
  50000,
  130000,
  '20000000-0000-4000-8000-000000000811'
);

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
  line_amount
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000301',
  1,
  'normal',
  'tấm',
  2,
  100000,
  10000,
  190000
);

select results_eq(
  $$ select subtotal_amount::integer, payable_amount::integer, remaining_amount::integer
     from public.purchase_receipts where code = 'PN900001' $$,
  $$ values (190000, 180000, 130000) $$,
  'draft stores computed totals without side effects'
);

select results_eq(
  $$ select count(*)::integer from public.stock_movements where reason like '%PN900001%' $$,
  array[0],
  'draft purchase receipt does not create stock movement'
);

select results_eq(
  $$ select count(*)::integer from public.cashbook_entries where description like '%PN900001%' $$,
  array[0],
  'draft purchase receipt does not create cashbook entry'
);

select throws_ok(
  $$ insert into public.purchase_receipt_items (
       organization_id, purchase_receipt_id, product_id, line_no, inventory_shape,
       unit_name_snapshot, quantity, unit_cost, discount_amount, line_amount
     ) values (
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000811',
       '00000000-0000-4000-8000-000000000301',
       2, 'normal', 'tấm', 1, 100000, 0, 100000
     ) $$,
  '23505',
  'duplicate key value violates unique constraint "purchase_receipt_items_receipt_product_key"',
  'duplicate product in a draft receipt is rejected'
);

select throws_ok(
  $$ insert into public.purchase_receipt_items (
       organization_id, purchase_receipt_id, product_id, line_no, inventory_shape,
       unit_name_snapshot, quantity, unit_cost, discount_amount, line_amount
     ) values (
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000811',
       '00000000-0000-4000-8000-000000000302',
       3, 'normal', 'tấm', 1, 100000, 200000, -100000
     ) $$,
  '23514',
  'new row for relation "purchase_receipt_items" violates check constraint "purchase_receipt_items_amount_check"',
  'line amounts cannot be negative'
);

select results_eq(
  $$ select count(*)::integer from information_schema.check_constraints
     where constraint_name = 'purchase_receipts_status_check' $$,
  array[1],
  'purchase receipt status is constrained'
);

select * from finish();
rollback;
