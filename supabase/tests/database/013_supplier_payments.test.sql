begin;

select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000813',
  'authenticated',
  'authenticated',
  'purchase-p5-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  'Purchase P5 Test User'
);

insert into public.suppliers (id, organization_id, code, name)
values (
  '00000000-0000-4000-8000-000000000830',
  '00000000-0000-4000-8000-000000000001',
  'NCC930001',
  'NCC P5'
);

insert into public.organizations (id, code, name, status)
values (
  '00000000-0000-4000-8000-000000000002',
  'P5-OTHER',
  'Tổ chức khác P5',
  'active'
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
  '00000000-0000-4000-8000-000000000831',
  '00000000-0000-4000-8000-000000000001',
  'P5-NORMAL',
  'Hàng thường P5',
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
  '00000000-0000-4000-8000-000000000832',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000831',
  true,
  'normal',
  '00000000-0000-4000-8000-000000000603',
  true
);

insert into public.finance_accounts (
  id,
  organization_id,
  code,
  name,
  account_type,
  bank_name,
  bank_account_no,
  is_active,
  is_default_cash
) values (
  '00000000-0000-4000-8000-000000000930',
  '00000000-0000-4000-8000-000000000001',
  'P5BANK',
  'Ngân hàng P5',
  'bank',
  'VCB',
  '123456789',
  true,
  false
), (
  '00000000-0000-4000-8000-000000000931',
  '00000000-0000-4000-8000-000000000001',
  'P5BANKOFF',
  'Ngân hàng P5 ngừng dùng',
  'bank',
  'VCB',
  '987654321',
  false,
  false
), (
  '00000000-0000-4000-8000-000000000932',
  '00000000-0000-4000-8000-000000000002',
  'P5BANKOTHER',
  'Ngân hàng P5 khác tổ chức',
  'bank',
  'VCB',
  '555555555',
  true,
  false
);

select has_function(
  'public',
  'pay_supplier_tx',
  array['uuid', 'uuid', 'uuid', 'jsonb'],
  'supplier payment transaction rpc exists'
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000830',
    'received_at', '2026-07-02T13:00:00+07:00',
    'supplier_document_no', 'HD-NCC-P5-001',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000831',
        'unit_name', 'cái',
        'quantity', 3,
        'unit_cost', 100000,
        'discount_amount', 0
      )
    )
  )
) as receipt_full_id
\gset

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000830',
    'received_at', '2026-07-02T13:10:00+07:00',
    'supplier_document_no', 'HD-NCC-P5-002',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000831',
        'unit_name', 'cái',
        'quantity', 2,
        'unit_cost', 100000,
        'discount_amount', 0
      )
    )
  )
) as receipt_partial_id
\gset

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000830',
    'received_at', '2026-07-02T13:20:00+07:00',
    'supplier_document_no', 'HD-NCC-P5-DRAFT',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000831',
        'unit_name', 'cái',
        'quantity', 1,
        'unit_cost', 100000,
        'discount_amount', 0
      )
    )
  )
) as receipt_draft_id
\gset

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000830',
    'received_at', '2026-07-02T13:30:00+07:00',
    'supplier_document_no', 'HD-NCC-P5-003',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000831',
        'unit_name', 'cái',
        'quantity', 1,
        'unit_cost', 80000,
        'discount_amount', 0
      )
    )
  )
) as receipt_multi_id
\gset

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  :'receipt_full_id',
  '{}'::jsonb
);

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  :'receipt_multi_id',
  '{}'::jsonb
);

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  :'receipt_partial_id',
  '{}'::jsonb
);

select public.pay_supplier_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000830',
  jsonb_build_object(
    'payment_method', 'cash',
    'paid_at', '2026-07-02T14:00:00+07:00',
    'note', 'Thanh toán đủ phiếu 001',
    'allocations', jsonb_build_array(
      jsonb_build_object('purchase_receipt_id', :'receipt_full_id', 'amount', 300000)
    )
  )
) as full_payment_result
\gset

select results_eq(
  $$ select code like 'PCPN%' as has_pcpn_code, amount::integer, payment_method, status
     from public.supplier_payments
     where note = 'Thanh toán đủ phiếu 001' $$,
  $$ values (true, 300000, 'cash'::text, 'posted'::text) $$,
  'cash payment creates posted PCPN supplier payment'
);

select results_eq(
  $$ select amount_delta::integer, direction, source_type
     from public.cashbook_entries
     where cashbook_voucher_id = (
       select cashbook_voucher_id
       from public.supplier_payments
       where note = 'Thanh toán đủ phiếu 001'
     ) $$,
  $$ values (-300000, 'out'::text, 'cashbook_voucher'::text) $$,
  'supplier payment creates matching cashbook outflow'
);

select results_eq(
  $$ select allocated_amount::integer
     from public.supplier_payment_allocations
     where supplier_payment_id = (
       select id from public.supplier_payments where note = 'Thanh toán đủ phiếu 001'
     )
       and purchase_receipt_id = (
         select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P5-001'
       ) $$,
  $$ values (300000) $$,
  'payment allocation links to selected posted receipt'
);

select public.pay_supplier_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000830',
  jsonb_build_object(
    'payment_method', 'bank_transfer',
    'finance_account_id', '00000000-0000-4000-8000-000000000930',
    'allocations', jsonb_build_array(
      jsonb_build_object('purchase_receipt_id', :'receipt_partial_id', 'amount', 50000)
    )
  )
) as partial_payment_result
\gset

select results_eq(
  $$ select sp.payment_method, sp.finance_account_id, spa.allocated_amount::integer
     from public.supplier_payments sp
     join public.supplier_payment_allocations spa on spa.supplier_payment_id = sp.id
     where sp.amount = 50000 $$,
  $$ values ('bank_transfer'::text, '00000000-0000-4000-8000-000000000930'::uuid, 50000) $$,
  'bank transfer payment uses one selected active bank account'
);

select results_eq(
  $$ select pr.supplier_document_no, (pr.remaining_amount - coalesce(sum(spa.allocated_amount), 0))::integer as outstanding_after_p5
     from public.purchase_receipts pr
     left join public.supplier_payment_allocations spa on spa.purchase_receipt_id = pr.id
     where pr.supplier_document_no in ('HD-NCC-P5-001', 'HD-NCC-P5-002')
     group by pr.id, pr.supplier_document_no, pr.remaining_amount
     order by pr.supplier_document_no $$,
  $$ values ('HD-NCC-P5-001'::text, 0), ('HD-NCC-P5-002'::text, 150000) $$,
  'remaining payable is derived from posted receipt remaining minus selected payments'
);

select public.pay_supplier_tx(
  '20000000-0000-4000-8000-000000000813',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000830',
  jsonb_build_object(
    'payment_method', 'cash',
    'note', 'Thanh toán nhiều phiếu',
    'allocations', jsonb_build_array(
      jsonb_build_object('purchase_receipt_id', :'receipt_partial_id', 'amount', 100000),
      jsonb_build_object('purchase_receipt_id', :'receipt_multi_id', 'amount', 80000)
    )
  )
) as multi_payment_result
\gset

select results_eq(
  $$ select pr.supplier_document_no, spa.allocated_amount::integer
     from public.supplier_payment_allocations spa
     join public.purchase_receipts pr on pr.id = spa.purchase_receipt_id
     where spa.supplier_payment_id = (
       select id from public.supplier_payments where note = 'Thanh toán nhiều phiếu'
     )
     order by pr.supplier_document_no $$,
  $$ values ('HD-NCC-P5-002'::text, 100000), ('HD-NCC-P5-003'::text, 80000) $$,
  'one supplier payment creates exact allocations for multiple selected receipts'
);

select results_eq(
  $$ select sp.amount::integer, ce.amount_delta::integer
     from public.supplier_payments sp
     join public.cashbook_entries ce on ce.cashbook_voucher_id = sp.cashbook_voucher_id
     where sp.note = 'Thanh toán nhiều phiếu' $$,
  $$ values (180000, -180000) $$,
  'multi-receipt supplier payment creates one cashbook outflow for total allocated amount'
);

select throws_ok(
  $$ select public.pay_supplier_tx(
       '20000000-0000-4000-8000-000000000813',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000830',
       jsonb_build_object(
         'payment_method', 'cash',
         'allocations', jsonb_build_array(
           jsonb_build_object(
             'purchase_receipt_id',
             (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P5-002'),
             'amount',
             200000
           )
         )
       )
     ) $$,
  '22023',
  'supplier payment exceeds selected receipt remaining payable',
  'overpayment is rejected in backend transaction'
);

select throws_ok(
  $$ select public.pay_supplier_tx(
       '20000000-0000-4000-8000-000000000813',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000830',
       jsonb_build_object(
         'payment_method', 'cash',
         'allocations', jsonb_build_array(
           jsonb_build_object(
             'purchase_receipt_id',
             (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P5-DRAFT'),
             'amount',
             10000
           )
         )
       )
     ) $$,
  '22023',
  'supplier payment receipt must be posted',
  'non-posted receipt payment is rejected'
);

select throws_ok(
  $$ select public.pay_supplier_tx(
       '20000000-0000-4000-8000-000000000813',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000830',
       jsonb_build_object(
         'payment_method', 'bank_transfer',
         'finance_account_id', '00000000-0000-4000-8000-000000000931',
         'allocations', jsonb_build_array(
           jsonb_build_object(
             'purchase_receipt_id',
             (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P5-002'),
             'amount',
             10000
           )
         )
       )
     ) $$,
  '22023',
  'finance account is invalid',
  'inactive bank account is rejected'
);

select throws_ok(
  $$ select public.pay_supplier_tx(
       '20000000-0000-4000-8000-000000000813',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000830',
       jsonb_build_object(
         'payment_method', 'bank_transfer',
         'finance_account_id', '00000000-0000-4000-8000-000000000932',
         'allocations', jsonb_build_array(
           jsonb_build_object(
             'purchase_receipt_id',
             (select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P5-002'),
             'amount',
             10000
           )
         )
       )
     ) $$,
  '22023',
  'finance account is invalid',
  'wrong-organization bank account is rejected'
);

select results_eq(
  $$ select count(*)::integer
     from public.supplier_payments
     where supplier_id = '00000000-0000-4000-8000-000000000830' $$,
  $$ values (3) $$,
  'rejected payments leave no extra supplier payment rows'
);

select results_eq(
  $$ select count(*)::integer
     from public.cashbook_vouchers v
     join public.supplier_payments sp on sp.cashbook_voucher_id = v.id
     where sp.supplier_id = '00000000-0000-4000-8000-000000000830' $$,
  $$ values (3) $$,
  'each successful supplier payment has a linked cashbook voucher'
);

select results_eq(
  $$ select (
       (select sum(remaining_amount)
        from public.purchase_receipts
        where supplier_id = '00000000-0000-4000-8000-000000000830'
          and status = 'posted')
       -
       (select coalesce(sum(spa.allocated_amount), 0)
        from public.supplier_payment_allocations spa
        join public.purchase_receipts pr on pr.id = spa.purchase_receipt_id
        where pr.supplier_id = '00000000-0000-4000-8000-000000000830'
          and pr.status = 'posted')
     )::integer $$,
  $$ values (50000) $$,
  'supplier current payable can be derived from posted receipts minus P5 allocations'
);

select results_eq(
  $$ select
       (select count(*)::integer
        from public.supplier_payments
        where supplier_id = '00000000-0000-4000-8000-000000000830'),
       (select count(*)::integer
        from public.supplier_payment_allocations spa
        join public.supplier_payments sp on sp.id = spa.supplier_payment_id
        where sp.supplier_id = '00000000-0000-4000-8000-000000000830'),
       (select count(*)::integer
        from public.cashbook_vouchers v
        join public.supplier_payments sp on sp.cashbook_voucher_id = v.id
        where sp.supplier_id = '00000000-0000-4000-8000-000000000830'),
       (select count(*)::integer
        from public.cashbook_entries ce
        join public.supplier_payments sp on sp.cashbook_voucher_id = ce.cashbook_voucher_id
        where sp.supplier_id = '00000000-0000-4000-8000-000000000830') $$,
  $$ values (3, 4, 3, 3) $$,
  'successful payments are the only payment/allocation/cashbook side effects after rejected attempts'
);

select * from finish();
rollback;
