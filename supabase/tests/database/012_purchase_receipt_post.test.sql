begin;

select plan(14);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000812',
  'authenticated',
  'authenticated',
  'purchase-p3-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  'Purchase P3 Test User'
);

insert into public.suppliers (id, organization_id, code, name)
values (
  '00000000-0000-4000-8000-000000000820',
  '00000000-0000-4000-8000-000000000001',
  'NCC920001',
  'NCC P3'
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
) values (
  '00000000-0000-4000-8000-000000000821',
  '00000000-0000-4000-8000-000000000001',
  'P3-NORMAL',
  'Hàng thường P3',
  'active',
  'cái',
  'quantity',
  80000
);

insert into public.product_inventory_settings (
  id,
  organization_id,
  product_id,
  track_inventory,
  inventory_shape,
  stock_unit_id,
  default_allow_negative
) values (
  '00000000-0000-4000-8000-000000000822',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000821',
  true,
  'normal',
  '00000000-0000-4000-8000-000000000603',
  true
);

select has_function(
  'public',
  'post_purchase_receipt_tx',
  array['uuid', 'uuid', 'uuid', 'jsonb'],
  'purchase receipt post transaction rpc exists'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000820',
    'received_at', '2026-07-02T10:00:00+07:00',
    'supplier_document_no', 'HD-NCC-P3-001',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000821',
        'unit_name', 'cái',
        'quantity', 3,
        'unit_cost', 90000,
        'discount_amount', 0
      )
    )
  )
) as unpaid_receipt_id
\gset

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  :'unpaid_receipt_id',
  '{}'::jsonb
) as unpaid_post_result
\gset

select results_eq(
  $$ select status, posted_by, posted_at is not null
     from public.purchase_receipts
     where supplier_document_no = 'HD-NCC-P3-001' $$,
  $$ values ('posted'::text, '20000000-0000-4000-8000-000000000812'::uuid, true) $$,
  'post marks draft receipt as posted with audit'
);

select results_eq(
  $$ select quantity_delta::numeric(18,6), movement_type, purchase_receipt_id, purchase_receipt_item_id is not null
     from public.stock_movements
     where purchase_receipt_id = (
       select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-001'
     ) $$,
  $$ select 3.000000::numeric(18,6), 'purchase_receipt'::text, id, true
     from public.purchase_receipts
     where supplier_document_no = 'HD-NCC-P3-001' $$,
  'post creates positive stock movement for normal item'
);

select results_eq(
  $$ select latest_purchase_cost::integer, latest_purchase_cost_at is not null, latest_purchase_cost_updated_by
     from public.products
     where id = '00000000-0000-4000-8000-000000000821' $$,
  $$ values (90000, true, '20000000-0000-4000-8000-000000000812'::uuid) $$,
  'post updates latest purchase cost from receipt item'
);

select results_eq(
  $$ select count(*)::integer from public.cashbook_entries
     where description like '%PN%' and description like '%NCC920001%' $$,
  array[0],
  'unpaid post creates no cashbook entry'
);

select throws_ok(
  $$ select public.post_purchase_receipt_tx(
       '20000000-0000-4000-8000-000000000812',
       '00000000-0000-4000-8000-000000000001',
       (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-001'),
       '{}'::jsonb
     ) $$,
  '22023',
  'purchase receipt is not draft',
  'double post is rejected'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000820',
    'received_at', '2026-07-02T11:00:00+07:00',
    'supplier_document_no', 'HD-NCC-P3-002',
    'discount_amount', 0,
    'paid_amount', 270000,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000821',
        'unit_name', 'cái',
        'quantity', 3,
        'unit_cost', 90000,
        'discount_amount', 0
      )
    )
  )
) as paid_receipt_id
\gset

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  :'paid_receipt_id',
  jsonb_build_object('payment_method', 'cash')
) as paid_post_result
\gset

select results_eq(
  $$ select v.voucher_direction, v.voucher_type, v.counterparty_type, v.counterparty_name, v.related_purchase_receipt_id
     from public.cashbook_vouchers v
     where v.related_purchase_receipt_id = (
       select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-002'
     ) $$,
  $$ select 'out'::text, 'material_purchase'::text, 'supplier'::text, 'NCC920001 - NCC P3'::text, id
     from public.purchase_receipts
     where supplier_document_no = 'HD-NCC-P3-002' $$,
  'paid post creates supplier material purchase voucher'
);

select results_eq(
  $$ select direction, amount_delta::integer, description like '%HD-NCC-P3-002%'
     from public.cashbook_entries
     where cashbook_voucher_id = (
       select id
       from public.cashbook_vouchers
       where related_purchase_receipt_id = (
         select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-002'
       )
     ) $$,
  $$ values ('out'::text, -270000, true) $$,
  'paid post creates cashbook outflow with supplier document note'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000820',
    'received_at', '2026-07-02T11:30:00+07:00',
    'supplier_document_no', 'HD-NCC-P3-003',
    'discount_amount', 0,
    'paid_amount', 300000,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000821',
        'unit_name', 'cái',
        'quantity', 3,
        'unit_cost', 90000,
        'discount_amount', 0
      )
    )
  )
) as overpaid_receipt_id
\gset

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  :'overpaid_receipt_id',
  jsonb_build_object('payment_method', 'cash')
) as overpaid_post_result
\gset

select results_eq(
  $$ select status, remaining_amount::integer
     from public.purchase_receipts
     where supplier_document_no = 'HD-NCC-P3-003' $$,
  $$ values ('posted'::text, -30000) $$,
  'overpaid post is allowed and stores negative remaining amount'
);

select results_eq(
  $$ select amount_delta::integer
     from public.cashbook_entries
     where cashbook_voucher_id = (
       select id
       from public.cashbook_vouchers
       where related_purchase_receipt_id = (
         select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-003'
       )
     ) $$,
  $$ values (-300000) $$,
  'overpaid post creates cashbook outflow for full paid amount'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000820',
    'received_at', '2026-07-02T11:45:00+07:00',
    'supplier_document_no', 'HD-NCC-P3-UNIT',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000821',
        'unit_name', 'ram',
        'quantity', 1,
        'unit_cost', 90000,
        'discount_amount', 0
      )
    )
  )
) as unit_mismatch_receipt_id
\gset

select throws_ok(
  $$ select public.post_purchase_receipt_tx(
       '20000000-0000-4000-8000-000000000812',
       '00000000-0000-4000-8000-000000000001',
       (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-UNIT'),
       '{}'::jsonb
     ) $$,
  '22023',
  'purchase unit must match stock unit in P3',
  'unit mismatch is rejected before stock movement'
);

select results_eq(
  $$ select pr.status, count(sm.id)::integer
     from public.purchase_receipts pr
     left join public.stock_movements sm on sm.purchase_receipt_id = pr.id
     where pr.supplier_document_no = 'HD-NCC-P3-UNIT'
     group by pr.status $$,
  $$ values ('draft'::text, 0) $$,
  'unit mismatch rejection leaves receipt draft without stock movement'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000820',
    'received_at', '2026-07-02T12:00:00+07:00',
    'supplier_document_no', 'HD-NCC-P3-ROLL',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000821',
        'unit_name', 'cái',
        'quantity', 1,
        'unit_cost', 90000,
        'discount_amount', 0
      )
    )
  )
) as roll_receipt_id
\gset

update public.purchase_receipt_items
set inventory_shape = 'roll'
where purchase_receipt_id = (
  select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-ROLL'
);

select throws_ok(
  $$ select public.post_purchase_receipt_tx(
       '20000000-0000-4000-8000-000000000812',
       '00000000-0000-4000-8000-000000000001',
       (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-ROLL'),
       '{}'::jsonb
     ) $$,
  '22023',
  'purchase item inventory shape does not match product settings',
  'shape mismatch is rejected before physical purchase side effects'
);

select results_eq(
  $$ select status from public.purchase_receipts where supplier_document_no = 'HD-NCC-P3-ROLL' $$,
  $$ values ('draft'::text) $$,
  'shape mismatch rejection leaves receipt draft'
);

select * from finish();
rollback;
