begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000814',
  'authenticated',
  'authenticated',
  'purchase-p4-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000814',
  '00000000-0000-4000-8000-000000000001',
  'Purchase P4 Test User'
);

insert into public.suppliers (id, organization_id, code, name)
values (
  '00000000-0000-4000-8000-000000000840',
  '00000000-0000-4000-8000-000000000001',
  'NCC940001',
  'NCC P4'
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
  '00000000-0000-4000-8000-000000000841',
  '00000000-0000-4000-8000-000000000001',
  'P4-ROLL',
  'Bạt cuộn P4',
  'active',
  'm2',
  'area_m2',
  0
), (
  '00000000-0000-4000-8000-000000000842',
  '00000000-0000-4000-8000-000000000001',
  'P4-SHEET',
  'Mica tấm P4',
  'active',
  'tấm',
  'sheet',
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
) values (
  '00000000-0000-4000-8000-000000000843',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000841',
  true,
  'roll',
  '00000000-0000-4000-8000-000000000601',
  true
), (
  '00000000-0000-4000-8000-000000000844',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000842',
  true,
  'sheet',
  '00000000-0000-4000-8000-000000000604',
  true
);

select public.save_purchase_receipt_draft_tx(
  '20000000-0000-4000-8000-000000000814',
  '00000000-0000-4000-8000-000000000001',
  null,
  jsonb_build_object(
    'supplier_id', '00000000-0000-4000-8000-000000000840',
    'received_at', '2026-07-02T15:00:00+07:00',
    'supplier_document_no', 'HD-NCC-P4-001',
    'discount_amount', 0,
    'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000841',
        'inventory_shape', 'roll',
        'unit_name', 'cuộn',
        'quantity', 3,
        'unit_cost', 1000000,
        'discount_amount', 0,
        'physical_payload', jsonb_build_object(
          'rolls', jsonb_build_object('width_m', 3.2, 'lengths_m', jsonb_build_array(50, 50, 45))
        )
      ),
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000842',
        'inventory_shape', 'sheet',
        'unit_name', 'tấm',
        'quantity', 3,
        'unit_cost', 250000,
        'discount_amount', 0,
        'physical_payload', jsonb_build_object(
          'sheet_groups', jsonb_build_array(
            jsonb_build_object('width_m', 1.22, 'length_m', 2.44, 'quantity', 2),
            jsonb_build_object('width_m', 1.0, 'length_m', 2.0, 'quantity', 1)
          )
        )
      )
    )
  )
) as physical_receipt_id
\gset

select results_eq(
  $$ select product_id, inventory_shape, physical_payload is not null
     from public.purchase_receipt_items
     where purchase_receipt_id = (
       select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P4-001'
     )
     order by line_no $$,
  $$ values
       ('00000000-0000-4000-8000-000000000841'::uuid, 'roll'::text, true),
       ('00000000-0000-4000-8000-000000000842'::uuid, 'sheet'::text, true) $$,
  'draft save stores roll and sheet physical payloads'
);

select public.post_purchase_receipt_tx(
  '20000000-0000-4000-8000-000000000814',
  '00000000-0000-4000-8000-000000000001',
  :'physical_receipt_id',
  '{}'::jsonb
);

select results_eq(
  $$ select count(*)::integer, sum(initial_length_m)::numeric(12,3), sum(initial_area_m2)::numeric(14,3)
     from public.inventory_rolls
     where product_id = '00000000-0000-4000-8000-000000000841'
       and code like 'PN%' $$,
  $$ values (3, 145.000::numeric(12,3), 464.000::numeric(14,3)) $$,
  'post creates one roll object per physical roll with length and area'
);

select results_eq(
  $$ select initial_length_m::numeric(12,3), remaining_length_m::numeric(12,3), initial_area_m2::numeric(14,3), remaining_area_m2::numeric(14,3), status
     from public.inventory_rolls
     where product_id = '00000000-0000-4000-8000-000000000841'
       and code like 'PN%'
     order by initial_length_m desc, code $$,
  $$ values
       (50.000::numeric(12,3), 50.000::numeric(12,3), 160.000::numeric(14,3), 160.000::numeric(14,3), 'available'::text),
       (50.000::numeric(12,3), 50.000::numeric(12,3), 160.000::numeric(14,3), 160.000::numeric(14,3), 'available'::text),
       (45.000::numeric(12,3), 45.000::numeric(12,3), 144.000::numeric(14,3), 144.000::numeric(14,3), 'available'::text) $$,
  'roll objects preserve same-spec and different-length physical rolls'
);

select results_eq(
  $$ select count(*)::integer, sum(area_m2)::numeric(14,3)
     from public.inventory_sheets
     where product_id = '00000000-0000-4000-8000-000000000842'
       and code like 'PN%' $$,
  $$ values (3, 7.954::numeric(14,3)) $$,
  'post creates one sheet object per physical sheet across size groups'
);

select results_eq(
  $$ select width_m::numeric(12,3), length_m::numeric(12,3), area_m2::numeric(14,3), sheet_kind, status, count(*)::integer
     from public.inventory_sheets
     where product_id = '00000000-0000-4000-8000-000000000842'
       and code like 'PN%'
     group by width_m, length_m, area_m2, sheet_kind, status
     order by width_m desc $$,
  $$ values
       (1.220::numeric(12,3), 2.440::numeric(12,3), 2.977::numeric(14,3), 'full'::text, 'available'::text, 2),
       (1.000::numeric(12,3), 2.000::numeric(12,3), 2.000::numeric(14,3), 'full'::text, 'available'::text, 1) $$,
  'sheet objects preserve each size group without manual sheet codes'
);

select results_eq(
  $$ select inventory_object_type, count(*)::integer, sum(quantity_delta)::numeric(18,6), bool_and(purchase_receipt_item_id is not null)
     from public.stock_movements
     where purchase_receipt_id = (
       select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P4-001'
     )
     group by inventory_object_type
     order by inventory_object_type $$,
  $$ values
       ('roll'::text, 3, 464.000000::numeric(18,6), true),
       ('sheet'::text, 3, 3.000000::numeric(18,6), true) $$,
  'post creates object-linked purchase stock movements for roll and sheet objects'
);

select throws_ok(
  $$ select public.save_purchase_receipt_draft_tx(
       '20000000-0000-4000-8000-000000000814',
       '00000000-0000-4000-8000-000000000001',
       null,
       jsonb_build_object(
         'supplier_id', '00000000-0000-4000-8000-000000000840',
         'received_at', '2026-07-02T15:30:00+07:00',
         'items', jsonb_build_array(
           jsonb_build_object(
             'product_id', '00000000-0000-4000-8000-000000000841',
             'inventory_shape', 'roll',
             'unit_name', 'cuộn',
             'quantity', 1,
             'unit_cost', 100000,
             'discount_amount', 0,
             'physical_payload', jsonb_build_object(
               'rolls', jsonb_build_object('width_m', 3.2, 'lengths_m', jsonb_build_array())
             )
           )
         )
       )
     ) $$,
  '22023',
  'roll physical payload is invalid',
  'invalid roll physical payload is rejected before draft side effects'
);

select throws_ok(
  $$ select public.save_purchase_receipt_draft_tx(
       '20000000-0000-4000-8000-000000000814',
       '00000000-0000-4000-8000-000000000001',
       null,
       jsonb_build_object(
         'supplier_id', '00000000-0000-4000-8000-000000000840',
         'received_at', '2026-07-02T15:40:00+07:00',
         'items', jsonb_build_array(
           jsonb_build_object(
             'product_id', '00000000-0000-4000-8000-000000000841',
             'inventory_shape', 'sheet',
             'unit_name', 'tấm',
             'quantity', 1,
             'unit_cost', 100000,
             'discount_amount', 0,
             'physical_payload', jsonb_build_object(
               'sheet_groups', jsonb_build_array(
                 jsonb_build_object('width_m', 1.22, 'length_m', 2.44, 'quantity', 1)
               )
             )
           )
         )
       )
     ) $$,
  '22023',
  'purchase item inventory shape does not match product settings',
  'shape mismatch is rejected before draft side effects'
);

select results_eq(
  $$ select count(*)::integer
     from public.purchase_receipts
     where supplier_id = '00000000-0000-4000-8000-000000000840'
       and status = 'draft' $$,
  $$ values (0) $$,
  'invalid P4 drafts do not leave draft receipts behind'
);

select results_eq(
  $$ select
       (select count(*)::integer from public.inventory_rolls where product_id = '00000000-0000-4000-8000-000000000841'),
       (select count(*)::integer from public.inventory_sheets where product_id = '00000000-0000-4000-8000-000000000842'),
       (select count(*)::integer
        from public.stock_movements
        where purchase_receipt_id = (
          select id from public.purchase_receipts where supplier_document_no = 'HD-NCC-P4-001'
        )) $$,
  $$ values (3, 3, 6) $$,
  'P4 post side effects are limited to successful physical receipt'
);

select * from finish();
rollback;
