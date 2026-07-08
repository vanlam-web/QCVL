-- Purchase/Supplier demo data for local smoke validation.
-- Run after migrations/seed. The script is idempotent and only replaces rows
-- tied to supplier code NCCDEMO01 / supplier documents HD-DEMO-*.

do $$
declare
  org_id constant uuid := '00000000-0000-4000-8000-000000000001';
  actor_id uuid;
  v_supplier_id constant uuid := '00000000-0000-4000-8000-00000000d501';
  draft_receipt_id uuid;
  normal_receipt_id uuid;
  physical_receipt_id uuid;
begin
  select p.user_id
    into actor_id
  from public.profiles p
  where p.organization_id = org_id
    and p.status = 'active'
  order by p.created_at
  limit 1;

  if actor_id is null then
    actor_id := '00000000-0000-4000-8000-00000000d500';

    insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (
      actor_id,
      'authenticated',
      'authenticated',
      'purchase-demo-actor@qc.local',
      now(),
      now(),
      now()
    )
    on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

    insert into public.profiles (user_id, organization_id, display_name, status)
    values (actor_id, org_id, 'Purchase Demo Actor', 'active')
    on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        display_name = excluded.display_name,
        status = excluded.status,
        updated_at = now();
  end if;

  delete from public.supplier_payment_allocations spa
  using public.supplier_payments sp
  where spa.supplier_payment_id = sp.id
    and sp.supplier_id = v_supplier_id;

  delete from public.supplier_payment_allocations spa
  using public.purchase_receipts pr
  where spa.purchase_receipt_id = pr.id
    and pr.supplier_id = v_supplier_id;

  delete from public.cashbook_entries ce
  using public.cashbook_vouchers cv
  where ce.cashbook_voucher_id = cv.id
    and (
      cv.related_supplier_id = v_supplier_id
      or cv.related_purchase_receipt_id in (
        select pr.id from public.purchase_receipts pr where pr.supplier_id = v_supplier_id
      )
      or cv.related_supplier_payment_id in (
        select sp.id from public.supplier_payments sp where sp.supplier_id = v_supplier_id
      )
    );

  update public.cashbook_vouchers cv
  set related_supplier_payment_id = null
  where cv.related_supplier_payment_id in (
    select sp.id from public.supplier_payments sp where sp.supplier_id = v_supplier_id
  );

  delete from public.supplier_payments sp
  where sp.supplier_id = v_supplier_id;

  delete from public.cashbook_vouchers cv
  where cv.related_supplier_id = v_supplier_id
    or cv.related_purchase_receipt_id in (
      select pr.id from public.purchase_receipts pr where pr.supplier_id = v_supplier_id
    );

  delete from public.stock_movements sm
  where sm.purchase_receipt_id in (
    select pr.id from public.purchase_receipts pr where pr.supplier_id = v_supplier_id
  );

  delete from public.inventory_rolls ir
  where ir.code like 'PN%-L%-R%'
    and ir.note in (
      select 'purchase receipt ' || pr.code
      from public.purchase_receipts pr
      where pr.supplier_id = v_supplier_id
    );

  delete from public.inventory_sheets ish
  where ish.code like 'PN%-L%-S%'
    and ish.note in (
      select 'purchase receipt ' || pr.code
      from public.purchase_receipts pr
      where pr.supplier_id = v_supplier_id
    );

  delete from public.purchase_receipts pr
  where pr.supplier_id = v_supplier_id;

  insert into public.suppliers (
    id,
    organization_id,
    code,
    name,
    phone,
    email,
    address,
    tax_code,
    linked_customer_id,
    notes,
    status
  )
  values (
    v_supplier_id,
    org_id,
    'NCCDEMO01',
    'Nguyễn Phong Demo',
    '0909000001',
    'ncc-demo@example.local',
    'Kho vật tư demo',
    'DEMO-TAX-01',
    '00000000-0000-4000-8000-000000000501',
    'Dữ liệu demo Purchase/Supplier để smoke UI local.',
    'active'
  )
  on conflict (id) do update
  set code = excluded.code,
      name = excluded.name,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      tax_code = excluded.tax_code,
      linked_customer_id = excluded.linked_customer_id,
      notes = excluded.notes,
      status = excluded.status,
      updated_at = now();

  draft_receipt_id := public.save_purchase_receipt_draft_tx(
    actor_id,
    org_id,
    null,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'received_at', '2026-07-02T08:30:00+07:00',
      'supplier_document_no', 'HD-DEMO-DRAFT-001',
      'notes', 'Phiếu nháp demo: dùng để kiểm form sửa/lưu draft.',
      'discount_amount', 0,
      'paid_amount', 0,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'inventory_shape', 'normal',
          'unit_name', 'Cái',
          'quantity', 2,
          'unit_cost', 50000,
          'discount_amount', 0
        )
      )
    )
  );

  normal_receipt_id := public.save_purchase_receipt_draft_tx(
    actor_id,
    org_id,
    null,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'received_at', '2026-07-02T09:00:00+07:00',
      'supplier_document_no', 'HD-DEMO-NORMAL-001',
      'notes', 'Phiếu nhập thường đã post, còn nợ một phần sau thanh toán NCC.',
      'discount_amount', 0,
      'paid_amount', 0,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'inventory_shape', 'normal',
          'unit_name', 'Cái',
          'quantity', 6,
          'unit_cost', 60000,
          'discount_amount', 0
        )
      )
    )
  );

  perform public.post_purchase_receipt_tx(
    actor_id,
    org_id,
    normal_receipt_id,
    '{}'::jsonb
  );

  physical_receipt_id := public.save_purchase_receipt_draft_tx(
    actor_id,
    org_id,
    null,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'received_at', '2026-07-02T09:30:00+07:00',
      'supplier_document_no', 'HD-DEMO-PHYSICAL-001',
      'notes', 'Phiếu nhập cuộn/tấm đã post, sinh object vật lý trong kho.',
      'discount_amount', 0,
      'paid_amount', 0,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000302',
          'inventory_shape', 'roll',
          'unit_name', 'Cuộn',
          'quantity', 2,
          'unit_cost', 1600000,
          'discount_amount', 0,
          'physical_payload', jsonb_build_object(
            'rolls', jsonb_build_object(
              'width_m', 3.2,
              'lengths_m', jsonb_build_array(50, 50)
            )
          )
        ),
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000301',
          'inventory_shape', 'sheet',
          'unit_name', 'Tấm',
          'quantity', 3,
          'unit_cost', 270000,
          'discount_amount', 0,
          'physical_payload', jsonb_build_object(
            'sheet_groups', jsonb_build_array(
              jsonb_build_object('width_m', 1.22, 'length_m', 2.44, 'quantity', 2),
              jsonb_build_object('width_m', 1.22, 'length_m', 2.44, 'quantity', 1)
            )
          )
        )
      )
    )
  );

  perform public.post_purchase_receipt_tx(
    actor_id,
    org_id,
    physical_receipt_id,
    '{}'::jsonb
  );

  perform public.pay_supplier_tx(
    actor_id,
    org_id,
    v_supplier_id,
    jsonb_build_object(
      'payment_method', 'cash',
      'paid_at', '2026-07-02T10:00:00+07:00',
      'note', 'Thanh toán demo một phần phiếu nhập thường',
      'allocations', jsonb_build_array(
        jsonb_build_object('purchase_receipt_id', normal_receipt_id, 'amount', 120000)
      )
    )
  );
end;
$$;
