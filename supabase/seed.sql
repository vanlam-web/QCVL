insert into public.organizations (id, code, name, status)
values ('00000000-0000-4000-8000-000000000001', 'VAN-LAM', 'Xưởng Văn Lâm', 'active')
on conflict (id) do update
set code = excluded.code,
    name = excluded.name,
    status = excluded.status;

insert into public.workstations (id, organization_id, code, name, status)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'POS-01',
  'Quầy thu ngân 1',
  'active'
)
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    status = excluded.status;

insert into public.permissions (code, module, description, status)
values
  ('perm.view_shift_report', 'reports', 'View shift reports', 'active'),
  ('perm.access_admin_panel', 'administration', 'Access the administration panel', 'active'),
  ('perm.create_order', 'sales', 'Create sales orders', 'active'),
  ('perm.edit_order_locked', 'sales', 'Edit locked sales orders', 'active'),
  ('perm.apply_discount', 'sales', 'Apply discounts to sales orders', 'active'),
  ('perm.refund_order', 'sales', 'Refund sales orders', 'active'),
  ('perm.manage_inventory', 'inventory', 'Manage inventory records', 'active'),
  ('perm.manage_finance', 'finance', 'Manage finance accounts, debts, cashbook and reconciliation', 'active'),
  ('perm.edit_price_book', 'catalog', 'Manage products and price lists', 'active'),
  ('perm.manage_users', 'administration', 'Manage users and permissions', 'active')
on conflict (code) do update
set module = excluded.module,
    description = excluded.description,
    status = excluded.status;

insert into public.price_lists (id, organization_id, code, name, is_default, is_active)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'DEFAULT',
  'Bảng giá chung',
  true,
  true
)
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    is_default = excluded.is_default,
    is_active = excluded.is_active;

insert into public.products (id, organization_id, code, name, status, unit_name, sell_method)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'MICA-3MM',
    'Mica 3mm',
    'active',
    'm',
    'linear_m'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000001',
    'DECAL-PP',
    'Decal PP',
    'active',
    'm²',
    'area_m2'
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000001',
    'STANDEE',
    'Standee chữ X',
    'active',
    'cái',
    'quantity'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    status = excluded.status,
    unit_name = excluded.unit_name,
    sell_method = excluded.sell_method;

insert into public.price_list_items (organization_id, price_list_id, product_id, unit_price)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000301',
    120000
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    65000
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000303',
    180000
  )
on conflict (price_list_id, product_id) do update
set organization_id = excluded.organization_id,
    unit_price = excluded.unit_price;

insert into public.customer_groups (id, organization_id, code, name, price_list_id, is_active)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000001',
  'DAILY',
  'Đại lý',
  '00000000-0000-4000-8000-000000000201',
  true
)
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    price_list_id = excluded.price_list_id,
    is_active = excluded.is_active;

insert into public.customers (id, organization_id, code, name, phone, customer_group_id)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000001',
  'KH000001',
  'Khách lẻ',
  null,
  null
)
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    phone = excluded.phone,
    customer_group_id = excluded.customer_group_id;

insert into public.inventory_units (id, organization_id, code, name, unit_kind, decimal_precision, is_active)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000001',
    'M2',
    'Mét vuông',
    'area',
    3,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000001',
    'M',
    'Mét tới',
    'length',
    3,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000001',
    'CAI',
    'Cái',
    'quantity',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000604',
    '00000000-0000-4000-8000-000000000001',
    'TAM',
    'Tấm',
    'quantity',
    0,
    true
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    unit_kind = excluded.unit_kind,
    decimal_precision = excluded.decimal_precision,
    is_active = excluded.is_active;

insert into public.product_inventory_settings (
  id,
  organization_id,
  product_id,
  track_inventory,
  inventory_shape,
  stock_unit_id,
  default_allow_negative,
  roll_default_margin_width_m,
  roll_default_margin_length_m,
  roll_allow_rotate,
  sheet_width_m,
  sheet_length_m,
  sheet_default_cut_margin_m,
  sheet_remnant_min_area_m2
)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000301',
    true,
    'sheet',
    '00000000-0000-4000-8000-000000000602',
    true,
    null,
    null,
    null,
    1.220,
    2.440,
    0.003,
    0.300
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000302',
    true,
    'roll',
    '00000000-0000-4000-8000-000000000601',
    true,
    0.010,
    0.010,
    false,
    null,
    null,
    null,
    0.300
  ),
  (
    '00000000-0000-4000-8000-000000000703',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000303',
    true,
    'normal',
    '00000000-0000-4000-8000-000000000603',
    true,
    null,
    null,
    null,
    null,
    null,
    null,
    0.300
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    product_id = excluded.product_id,
    track_inventory = excluded.track_inventory,
    inventory_shape = excluded.inventory_shape,
    stock_unit_id = excluded.stock_unit_id,
    default_allow_negative = excluded.default_allow_negative,
    roll_default_margin_width_m = excluded.roll_default_margin_width_m,
    roll_default_margin_length_m = excluded.roll_default_margin_length_m,
    roll_allow_rotate = excluded.roll_allow_rotate,
    sheet_width_m = excluded.sheet_width_m,
    sheet_length_m = excluded.sheet_length_m,
    sheet_default_cut_margin_m = excluded.sheet_default_cut_margin_m,
    sheet_remnant_min_area_m2 = excluded.sheet_remnant_min_area_m2;

insert into public.product_unit_conversions (
  id,
  organization_id,
  product_id,
  sale_unit_id,
  stock_unit_id,
  stock_qty_per_sale_unit,
  is_active
)
values
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000602',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000601',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000803',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000603',
    1,
    true
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    product_id = excluded.product_id,
    sale_unit_id = excluded.sale_unit_id,
    stock_unit_id = excluded.stock_unit_id,
    stock_qty_per_sale_unit = excluded.stock_qty_per_sale_unit,
    is_active = excluded.is_active;

insert into public.finance_accounts (
  id,
  organization_id,
  code,
  name,
  account_type,
  bank_name,
  bank_account_no,
  is_default_cash,
  is_active
)
values
  (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    'CASH',
    'Quỹ tiền mặt',
    'cash',
    null,
    null,
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000001',
    'MB01',
    'MB Bank',
    'bank',
    'MB Bank',
    '0000000001',
    false,
    true
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    account_type = excluded.account_type,
    bank_name = excluded.bank_name,
    bank_account_no = excluded.bank_account_no,
    is_default_cash = excluded.is_default_cash,
    is_active = excluded.is_active;

insert into public.production_machines (id, organization_id, code, name, status, default_product_id)
values
  (
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000000001',
    'IN-BAT',
    'In bạt',
    'active',
    '00000000-0000-4000-8000-000000000302'
  ),
  (
    '00000000-0000-4000-8000-000000001102',
    '00000000-0000-4000-8000-000000000001',
    'IN-DECAL',
    'In decal',
    'active',
    '00000000-0000-4000-8000-000000000302'
  ),
  (
    '00000000-0000-4000-8000-000000001103',
    '00000000-0000-4000-8000-000000000001',
    'CNC',
    'Cắt CNC',
    'active',
    '00000000-0000-4000-8000-000000000301'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    status = excluded.status,
    default_product_id = excluded.default_product_id;

insert into public.production_queue_items (
  id,
  organization_id,
  production_machine_id,
  source,
  raw_file_name,
  status,
  parse_status,
  parsed_payload
)
values (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000001102',
  'manual_simulator',
  'KH000001_DECAL-PP_120x50_x2',
  'queued',
  'ok',
  '{"customer_code":"KH000001","product_code":"DECAL-PP","width_cm":120,"height_cm":50,"quantity":2}'::jsonb
)
on conflict (id) do update
set production_machine_id = excluded.production_machine_id,
    source = excluded.source,
    raw_file_name = excluded.raw_file_name,
    status = excluded.status,
    parse_status = excluded.parse_status,
    parsed_payload = excluded.parsed_payload,
    claimed_by = null,
    claimed_at = null,
    handled_at = null;
