begin;

select plan(10);

\ir ./fixtures/purchase_demo.inc

select results_eq(
  $$ select code, name, status
     from public.suppliers
     where code = 'NCCDEMO01' $$,
  $$ values ('NCCDEMO01'::text, 'Nguyễn Phong Demo'::text, 'active'::text) $$,
  'demo seed creates an active supplier for purchase smoke'
);

select results_eq(
  $$ select count(*)::integer
     from public.purchase_receipts pr
     join public.suppliers s on s.id = pr.supplier_id
     where s.code = 'NCCDEMO01'
       and pr.status = 'draft' $$,
  $$ values (1) $$,
  'demo seed creates one draft purchase receipt'
);

select results_eq(
  $$ select count(*)::integer
     from public.purchase_receipts pr
     join public.suppliers s on s.id = pr.supplier_id
     where s.code = 'NCCDEMO01'
       and pr.status = 'posted'
       and pr.supplier_document_no in ('HD-DEMO-NORMAL-001', 'HD-DEMO-PHYSICAL-001') $$,
  $$ values (2) $$,
  'demo seed creates posted normal and physical purchase receipts'
);

select results_eq(
  $$ select (pr.remaining_amount - coalesce(sum(spa.allocated_amount), 0))::integer
     from public.purchase_receipts pr
     left join public.supplier_payment_allocations spa on spa.purchase_receipt_id = pr.id
     where pr.supplier_document_no = 'HD-DEMO-NORMAL-001'
     group by pr.id, pr.remaining_amount $$,
  $$ values (240000) $$,
  'posted normal demo receipt leaves payable remaining for supplier payment smoke'
);

select results_eq(
  $$ select count(*)::integer, sum(ir.initial_area_m2)::numeric(14,3)
     from public.inventory_rolls ir
     join public.stock_movements sm on sm.inventory_roll_id = ir.id
     join public.purchase_receipts pr on pr.id = sm.purchase_receipt_id
     where pr.supplier_document_no = 'HD-DEMO-PHYSICAL-001' $$,
  $$ values (2, 320.000::numeric(14,3)) $$,
  'posted physical demo receipt creates roll objects'
);

select results_eq(
  $$ select count(*)::integer, sum(ish.area_m2)::numeric(14,3)
     from public.inventory_sheets ish
     join public.stock_movements sm on sm.inventory_sheet_id = ish.id
     join public.purchase_receipts pr on pr.id = sm.purchase_receipt_id
     where pr.supplier_document_no = 'HD-DEMO-PHYSICAL-001' $$,
  $$ values (3, 8.931::numeric(14,3)) $$,
  'posted physical demo receipt creates sheet objects'
);

select results_eq(
  $$ select inventory_object_type, count(*)::integer
     from public.stock_movements sm
     join public.purchase_receipts pr on pr.id = sm.purchase_receipt_id
     where pr.supplier_document_no = 'HD-DEMO-PHYSICAL-001'
     group by inventory_object_type
     order by inventory_object_type $$,
  $$ values ('roll'::text, 2), ('sheet'::text, 3) $$,
  'demo physical stock movements are object-linked'
);

select results_eq(
  $$ select sp.code like 'PCPN%' as has_payment_code, sp.amount::integer, sp.payment_method
     from public.supplier_payments sp
     join public.suppliers s on s.id = sp.supplier_id
     where s.code = 'NCCDEMO01' $$,
  $$ values (true, 120000, 'cash'::text) $$,
  'demo seed creates one supplier payment voucher'
);

select results_eq(
  $$ select ce.amount_delta::integer
     from public.cashbook_entries ce
     join public.supplier_payments sp on sp.cashbook_voucher_id = ce.cashbook_voucher_id
     join public.suppliers s on s.id = sp.supplier_id
     where s.code = 'NCCDEMO01' $$,
  $$ values (-120000) $$,
  'demo supplier payment creates matching cashbook outflow'
);

select results_eq(
  $$ select (
       coalesce(sum(pr.remaining_amount), 0)
       - coalesce((
         select sum(spa.allocated_amount)
         from public.supplier_payment_allocations spa
         join public.purchase_receipts paid_pr on paid_pr.id = spa.purchase_receipt_id
         where paid_pr.supplier_id = s.id
       ), 0)
     )::integer
     from public.suppliers s
     join public.purchase_receipts pr on pr.supplier_id = s.id
     where s.code = 'NCCDEMO01'
       and pr.status = 'posted'
     group by s.id $$,
  $$ values (4250000) $$,
  'demo supplier has nonzero payable after payment allocation'
);

select * from finish();
rollback;
