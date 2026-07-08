begin;

select plan(32);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000715',
  'authenticated',
  'authenticated',
  'material-opening-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000715',
  '00000000-0000-4000-8000-000000000001',
  'Material Opening Test User'
);

insert into public.inventory_units (id, organization_id, code, name, unit_kind, decimal_precision, is_active)
values (
  '20000000-0000-4000-8000-000000000615',
  '00000000-0000-4000-8000-000000000001',
  'RAM',
  'Ram',
  'package',
  0,
  true
);

select has_table('public', 'inventory_provisional_balances', 'inventory provisional balance table exists');
select has_table('public', 'inventory_material_openings', 'inventory material opening log table exists');
select has_column('public', 'inventory_provisional_balances', 'source_label', 'provisional balances store source label');
select has_column('public', 'inventory_provisional_balances', 'created_by', 'provisional balances store creator');
select has_column('public', 'inventory_material_openings', 'inventory_shape', 'material openings store inventory shape');
select has_column('public', 'inventory_material_openings', 'source_type', 'material openings store source type');
select has_column('public', 'inventory_material_openings', 'input_payload', 'material openings store input payload');
select has_column('public', 'inventory_material_openings', 'result_payload', 'material openings store result payload');
select has_index('public', 'inventory_provisional_balances', 'idx_inventory_provisional_balances_product', 'provisional balances product/status index exists');
select has_index('public', 'inventory_provisional_balances', 'inventory_provisional_balances_one_kiotviet_import', 'provisional balances enforce one KiotViet import source per product');
select has_index('public', 'inventory_material_openings', 'idx_inventory_material_openings_product_time', 'material openings product/time index exists');
select has_index('public', 'inventory_material_openings', 'idx_inventory_material_openings_created_by', 'material openings created-by index exists');

select has_function(
  'public',
  'open_normal_material_tx',
  array['uuid', 'uuid', 'jsonb'],
  'normal material opening transaction rpc exists'
);

insert into public.product_unit_conversions (
  organization_id,
  product_id,
  sale_unit_id,
  stock_unit_id,
  stock_qty_per_sale_unit,
  is_active
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000303',
  '20000000-0000-4000-8000-000000000615',
  '00000000-0000-4000-8000-000000000603',
  500,
  true
);

insert into public.inventory_rolls (
  id,
  organization_id,
  product_id,
  code,
  width_m,
  initial_length_m,
  remaining_length_m,
  initial_area_m2,
  remaining_area_m2,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000302',
  'ROLL-KHUI-TEST',
  1.2,
  10,
  10,
  12,
  12,
  '20000000-0000-4000-8000-000000000715'
);

insert into public.inventory_sheets (
  id,
  organization_id,
  product_id,
  code,
  sheet_kind,
  width_m,
  length_m,
  area_m2,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000302',
  'SHEET-KHUI-TEST',
  'full',
  1.2,
  2.4,
  2.88,
  '20000000-0000-4000-8000-000000000715'
);

insert into public.inventory_provisional_balances (
  id,
  organization_id,
  product_id,
  source_type,
  source_label,
  initial_qty,
  remaining_qty,
  stock_unit_id,
  status,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000302',
  'kiotviet_import',
  'KiotViet import test',
  10,
  10,
  '00000000-0000-4000-8000-000000000603',
  'open',
  '20000000-0000-4000-8000-000000000715'
);

select lives_ok(
  $$
    update public.inventory_provisional_balances
    set status = 'fully_normalized'
    where id = '20000000-0000-4000-8000-000000000901'
  $$,
  'provisional balances allow fully_normalized status'
);

select lives_ok(
  $$
    update public.inventory_provisional_balances
    set status = 'closed'
    where id = '20000000-0000-4000-8000-000000000901'
  $$,
  'provisional balances allow closed status'
);

select throws_ok(
  $$
    update public.inventory_provisional_balances
    set status = 'active'
    where id = '20000000-0000-4000-8000-000000000901'
  $$,
  '23514',
  null,
  'provisional balances reject active status'
);

select throws_ok(
  $$
    insert into public.inventory_provisional_balances (
      organization_id,
      product_id,
      source_type,
      initial_qty,
      remaining_qty,
      stock_unit_id,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000302',
      'kiotviet_import',
      5,
      5,
      '00000000-0000-4000-8000-000000000603',
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  '23505',
  null,
  'provisional balances allow one KiotViet import source per product in MVP'
);

create temporary table material_opening_results (
  name text primary key,
  result jsonb not null
) on commit drop;

insert into material_opening_results (name, result)
values (
  'normal_conversion',
  public.open_normal_material_tx(
    '20000000-0000-4000-8000-000000000715',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'product_id', '00000000-0000-4000-8000-000000000303',
      'inventory_shape', 'normal',
      'opened_unit_id', '20000000-0000-4000-8000-000000000615',
      'opened_qty', 1,
      'old_remaining_qty', 0,
      'note', 'Khui ram giấy'
    )
  )
);

select is(
  (select result->>'inventory_shape' from material_opening_results where name = 'normal_conversion'),
  'normal',
  'normal opening result keeps inventory shape'
);

select is(
  (select (result->>'opened_stock_qty')::numeric from material_opening_results where name = 'normal_conversion'),
  500::numeric,
  'normal opening result converts opened package to stock quantity'
);

select is(
  (select count(*)::integer from public.inventory_material_openings where id = ((select result->>'id' from material_opening_results where name = 'normal_conversion')::uuid)),
  1,
  'normal opening writes one material opening log'
);

select is(
  (
    select count(*)::integer
    from public.stocktakes
    where organization_id = '00000000-0000-4000-8000-000000000001'
      and source_type = 'material_opening'
  ),
  0,
  'normal opening does not create stocktake'
);

select is(
  (select count(*)::integer from public.inventory_rolls where product_id = '00000000-0000-4000-8000-000000000303'),
  0,
  'normal opening does not create roll object'
);

select is(
  (select count(*)::integer from public.inventory_sheets where product_id = '00000000-0000-4000-8000-000000000303'),
  0,
  'normal opening does not create sheet object'
);

select is(
  (select count(*)::integer from public.stock_movements where reason = 'material_opening_normal'),
  0,
  'normal opening log-only path does not write zero-delta stock movement'
);

select throws_ok(
  $$
    select public.open_normal_material_tx(
      '20000000-0000-4000-8000-000000000715',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000303',
        'inventory_shape', 'normal',
        'opened_unit_id', '00000000-0000-4000-8000-000000000601',
        'opened_qty', 1
      )
    )
  $$,
  '22023',
  'active product unit conversion is required',
  'normal opening rejects opened unit without active conversion'
);

select throws_ok(
  $$
    select public.open_normal_material_tx(
      '20000000-0000-4000-8000-000000000715',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000302',
        'inventory_shape', 'normal',
        'opened_unit_id', '00000000-0000-4000-8000-000000000601',
        'opened_qty', 1
      )
    )
  $$,
  '22023',
  'normal material opening requires normal inventory shape',
  'normal opening rejects roll or sheet products'
);

select throws_ok(
  $$
    select public.open_normal_material_tx(
      '20000000-0000-4000-8000-000000000715',
      '00000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'product_id', '00000000-0000-4000-8000-000000000303',
        'inventory_shape', 'normal',
        'opened_unit_id', '20000000-0000-4000-8000-000000000615',
        'opened_qty', 0
      )
    )
  $$,
  '22023',
  'opened quantity must be positive',
  'normal opening rejects zero quantity'
);

select throws_ok(
  $$
    insert into public.inventory_material_openings (
      organization_id,
      product_id,
      inventory_shape,
      source_type,
      old_inventory_roll_id,
      input_payload,
      result_payload,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000303',
      'normal',
      'manual_normal',
      '20000000-0000-4000-8000-000000000801',
      '{}'::jsonb,
      '{}'::jsonb,
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  '23514',
  null,
  'material openings reject roll object columns for normal shape'
);

select lives_ok(
  $$
    insert into public.inventory_material_openings (
      organization_id,
      product_id,
      inventory_shape,
      source_type,
      old_inventory_roll_id,
      input_payload,
      result_payload,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000302',
      'roll',
      'standard_object',
      '20000000-0000-4000-8000-000000000801',
      '{}'::jsonb,
      '{}'::jsonb,
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  'material openings allow roll object columns for roll shape'
);

select throws_ok(
  $$
    insert into public.inventory_material_openings (
      organization_id,
      product_id,
      inventory_shape,
      source_type,
      old_inventory_sheet_id,
      input_payload,
      result_payload,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000302',
      'roll',
      'standard_object',
      '20000000-0000-4000-8000-000000000802',
      '{}'::jsonb,
      '{}'::jsonb,
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  '23514',
  null,
  'material openings reject sheet object columns for roll shape'
);

select lives_ok(
  $$
    insert into public.inventory_material_openings (
      organization_id,
      product_id,
      inventory_shape,
      source_type,
      old_inventory_sheet_id,
      input_payload,
      result_payload,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000302',
      'sheet',
      'standard_object',
      '20000000-0000-4000-8000-000000000802',
      '{}'::jsonb,
      '{}'::jsonb,
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  'material openings allow sheet object columns for sheet shape'
);

select throws_ok(
  $$
    insert into public.inventory_material_openings (
      organization_id,
      product_id,
      inventory_shape,
      source_type,
      old_inventory_roll_id,
      input_payload,
      result_payload,
      created_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000302',
      'sheet',
      'standard_object',
      '20000000-0000-4000-8000-000000000801',
      '{}'::jsonb,
      '{}'::jsonb,
      '20000000-0000-4000-8000-000000000715'
    )
  $$,
  '23514',
  null,
  'material openings reject roll object columns for sheet shape'
);

select * from finish();
rollback;
