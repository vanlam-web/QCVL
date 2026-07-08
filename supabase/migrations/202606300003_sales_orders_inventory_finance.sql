create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  order_type text not null,
  status text not null,
  source_quote_id uuid references public.orders(id) on delete restrict,
  base_code text not null,
  revision_no integer not null default 0,
  revised_from_order_id uuid references public.orders(id) on delete restrict,
  replaced_by_order_id uuid references public.orders(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  customer_snapshot jsonb not null,
  price_list_id uuid references public.price_lists(id) on delete restrict,
  subtotal_amount numeric(12,0) not null default 0,
  discount_amount numeric(12,0) not null default 0,
  total_amount numeric(12,0) not null default 0,
  paid_amount numeric(12,0) not null default 0,
  debt_amount numeric(12,0) not null default 0,
  change_returned_amount numeric(12,0) not null default 0,
  payment_status text not null,
  note text,
  cancel_reason_type text,
  cancelled_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_org_code_key unique (organization_id, code),
  constraint orders_id_org_key unique (id, organization_id),
  constraint orders_order_type_check check (order_type in ('quote', 'invoice')),
  constraint orders_status_check check (
    (order_type = 'quote' and status in ('active', 'converted', 'cancelled'))
    or (order_type = 'invoice' and status in ('completed', 'cancelled'))
  ),
  constraint orders_amounts_check check (
    subtotal_amount >= 0
    and discount_amount >= 0
    and total_amount >= 0
    and paid_amount >= 0
    and debt_amount >= 0
    and change_returned_amount >= 0
    and discount_amount <= subtotal_amount
    and total_amount = subtotal_amount - discount_amount
  ),
  constraint orders_payment_status_check check (payment_status in ('not_applicable', 'unpaid', 'partial', 'paid')),
  constraint orders_quote_money_check check (
    order_type <> 'quote'
    or (paid_amount = 0 and debt_amount = 0 and change_returned_amount = 0 and payment_status = 'not_applicable')
  ),
  constraint orders_invoice_money_check check (
    order_type <> 'invoice'
    or (
      paid_amount <= total_amount
      and debt_amount = total_amount - paid_amount
      and (
        (debt_amount = 0 and payment_status = 'paid')
        or (debt_amount > 0 and paid_amount > 0 and payment_status = 'partial')
        or (debt_amount > 0 and paid_amount = 0 and payment_status = 'unpaid')
      )
    )
  ),
  constraint orders_cancel_reason_check check (
    (status <> 'cancelled' and cancel_reason_type is null)
    or (status = 'cancelled' and cancel_reason_type in ('user_cancelled', 'revised'))
  ),
  constraint orders_customer_snapshot_object_check check (jsonb_typeof(customer_snapshot) = 'object'),
  constraint orders_base_code_check check (char_length(btrim(base_code)) > 0),
  constraint orders_revision_code_check check (
    (
      revision_no = 0
      and code = base_code
      and revised_from_order_id is null
    )
    or (
      revision_no > 0
      and code = base_code || '.' || lpad(revision_no::text, 2, '0')
      and revised_from_order_id is not null
    )
  )
);

create index idx_orders_org_type_status on public.orders (organization_id, order_type, status);
create index idx_orders_org_customer on public.orders (organization_id, customer_id);
create index idx_orders_org_created_at on public.orders (organization_id, created_at desc);
create index idx_orders_source_quote on public.orders (organization_id, source_quote_id)
  where source_quote_id is not null;
create index idx_orders_org_base_revision on public.orders (organization_id, base_code, revision_no);
create index idx_orders_revised_from on public.orders (organization_id, revised_from_order_id)
  where revised_from_order_id is not null;
create index idx_orders_replaced_by on public.orders (organization_id, replaced_by_order_id)
  where replaced_by_order_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  line_no integer not null,
  product_id uuid references public.products(id) on delete restrict,
  product_snapshot jsonb not null,
  sell_method text not null,
  quantity numeric(12,3) not null,
  width_m numeric(12,3),
  height_m numeric(12,3),
  linear_m numeric(12,3),
  unit_price numeric(12,0) not null,
  line_subtotal_amount numeric(12,0) not null,
  discount_amount numeric(12,0) not null default 0,
  price_source text not null,
  line_total numeric(12,0) not null,
  note text,
  created_at timestamptz not null default now(),
  constraint order_items_order_line_key unique (order_id, line_no),
  constraint order_items_product_snapshot_object_check check (jsonb_typeof(product_snapshot) = 'object'),
  constraint order_items_sell_method_check check (sell_method in ('quantity', 'area_m2', 'linear_m', 'sheet', 'combo')),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_amounts_check check (
    unit_price >= 0
    and line_subtotal_amount >= 0
    and discount_amount >= 0
    and line_total >= 0
    and discount_amount <= line_subtotal_amount
    and line_total = line_subtotal_amount - discount_amount
  ),
  constraint order_items_price_source_check check (
    price_source in (
      'customer_group',
      'customer_group_price_list',
      'default_price_list',
      'fallback_default_price_list',
      'latest_purchase_cost',
      'latest_purchase_cost_missing_zero',
      'manual'
    )
  )
);

create index idx_order_items_order on public.order_items (organization_id, order_id, line_no);
create index idx_order_items_product on public.order_items (organization_id, product_id)
  where product_id is not null;

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid not null references public.profiles(user_id) on delete restrict,
  changed_at timestamptz not null default now()
);

create index idx_order_status_history_order on public.order_status_history (organization_id, order_id, changed_at desc);

create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  unit_kind text not null,
  decimal_precision integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_units_org_code_key unique (organization_id, code),
  constraint inventory_units_id_org_key unique (id, organization_id),
  constraint inventory_units_code_check check (char_length(btrim(code)) between 1 and 30),
  constraint inventory_units_name_check check (char_length(btrim(name)) between 1 and 60),
  constraint inventory_units_kind_check check (unit_kind in ('quantity', 'length', 'area', 'weight', 'volume', 'package')),
  constraint inventory_units_decimal_precision_check check (decimal_precision between 0 and 6)
);

create index idx_inventory_units_org_active on public.inventory_units (organization_id, is_active);
create index idx_inventory_units_org_kind on public.inventory_units (organization_id, unit_kind);

create table public.product_inventory_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  track_inventory boolean not null default true,
  inventory_shape text not null,
  stock_unit_id uuid not null,
  default_allow_negative boolean not null default true,
  roll_default_margin_width_m numeric(12,3),
  roll_default_margin_length_m numeric(12,3),
  roll_allow_rotate boolean,
  sheet_width_m numeric(12,3),
  sheet_length_m numeric(12,3),
  sheet_default_cut_margin_m numeric(12,3),
  sheet_remnant_min_area_m2 numeric(12,3) not null default 0.300,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_inventory_settings_org_product_key unique (organization_id, product_id),
  constraint product_inventory_settings_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete cascade,
  constraint product_inventory_settings_stock_unit_org_fkey foreign key (stock_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint product_inventory_settings_shape_check check (inventory_shape in ('normal', 'roll', 'sheet')),
  constraint product_inventory_settings_remnant_min_check check (sheet_remnant_min_area_m2 >= 0),
  constraint product_inventory_settings_roll_margin_check check (
    (roll_default_margin_width_m is null or roll_default_margin_width_m >= 0)
    and (roll_default_margin_length_m is null or roll_default_margin_length_m >= 0)
  ),
  constraint product_inventory_settings_sheet_size_check check (
    (sheet_width_m is null or sheet_width_m > 0)
    and (sheet_length_m is null or sheet_length_m > 0)
    and (sheet_default_cut_margin_m is null or sheet_default_cut_margin_m >= 0)
  )
);

create index idx_product_inventory_settings_org_shape on public.product_inventory_settings (organization_id, inventory_shape);
create index idx_product_inventory_settings_stock_unit on public.product_inventory_settings (organization_id, stock_unit_id);

create table public.product_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  sale_unit_id uuid not null,
  stock_unit_id uuid not null,
  stock_qty_per_sale_unit numeric(18,6) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_unit_conversions_product_sale_key unique (organization_id, product_id, sale_unit_id),
  constraint product_unit_conversions_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete cascade,
  constraint product_unit_conversions_sale_unit_org_fkey foreign key (sale_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint product_unit_conversions_stock_unit_org_fkey foreign key (stock_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint product_unit_conversions_qty_check check (stock_qty_per_sale_unit > 0)
);

create index idx_product_unit_conversions_product on public.product_unit_conversions (organization_id, product_id, is_active);

create table public.inventory_rolls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  code text not null,
  width_m numeric(12,3) not null,
  initial_length_m numeric(12,3) not null,
  remaining_length_m numeric(12,3) not null,
  initial_area_m2 numeric(14,3) not null,
  remaining_area_m2 numeric(14,3) not null,
  status text not null default 'available',
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_rolls_product_code_key unique (organization_id, product_id, code),
  constraint inventory_rolls_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint inventory_rolls_measure_check check (
    width_m > 0
    and initial_length_m >= 0
    and remaining_length_m >= 0
    and initial_area_m2 >= 0
    and remaining_area_m2 >= 0
  ),
  constraint inventory_rolls_status_check check (status in ('available', 'in_use', 'empty', 'discarded'))
);

create index idx_inventory_rolls_product_status on public.inventory_rolls (organization_id, product_id, status);
create index idx_inventory_rolls_width_remaining on public.inventory_rolls (
  organization_id,
  product_id,
  width_m,
  remaining_length_m
);

create table public.inventory_sheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  code text not null,
  sheet_kind text not null,
  width_m numeric(12,3) not null,
  length_m numeric(12,3) not null,
  area_m2 numeric(14,3) not null,
  status text not null default 'available',
  source_order_item_id uuid references public.order_items(id) on delete restrict,
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_sheets_product_code_key unique (organization_id, product_id, code),
  constraint inventory_sheets_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint inventory_sheets_kind_check check (sheet_kind in ('full', 'in_use', 'remnant')),
  constraint inventory_sheets_measure_check check (width_m > 0 and length_m > 0 and area_m2 > 0),
  constraint inventory_sheets_status_check check (status in ('available', 'used', 'discarded'))
);

create index idx_inventory_sheets_product_status on public.inventory_sheets (organization_id, product_id, status);
create index idx_inventory_sheets_fit_lookup on public.inventory_sheets (
  organization_id,
  product_id,
  status,
  width_m,
  length_m,
  area_m2
);

create table public.stocktakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  status text not null default 'draft',
  source_type text not null default 'manual',
  note text,
  balanced_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stocktakes_org_code_key unique (organization_id, code),
  constraint stocktakes_id_org_key unique (id, organization_id),
  constraint stocktakes_status_check check (status in ('draft', 'balanced', 'cancelled')),
  constraint stocktakes_source_type_check check (source_type in ('manual', 'product_edit')),
  constraint stocktakes_balanced_at_check check (
    (status = 'balanced' and balanced_at is not null)
    or (status <> 'balanced' and balanced_at is null)
  )
);

create index idx_stocktakes_org_status_created on public.stocktakes (organization_id, status, created_at desc);
create index idx_stocktakes_org_created_by on public.stocktakes (organization_id, created_by, created_at desc);

create table public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  stocktake_id uuid not null references public.stocktakes(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null,
  stock_unit_id uuid not null,
  system_qty numeric(18,6) not null,
  actual_qty numeric(18,6) not null,
  difference_qty numeric(18,6) not null,
  inventory_object_type text,
  inventory_roll_id uuid references public.inventory_rolls(id) on delete restrict,
  inventory_sheet_id uuid references public.inventory_sheets(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  constraint stocktake_items_line_key unique (stocktake_id, line_no),
  constraint stocktake_items_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint stocktake_items_stock_unit_org_fkey foreign key (stock_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint stocktake_items_difference_check check (difference_qty = actual_qty - system_qty),
  constraint stocktake_items_inventory_object_check check (
    (inventory_object_type is null and inventory_roll_id is null and inventory_sheet_id is null)
    or (inventory_object_type = 'roll' and inventory_roll_id is not null and inventory_sheet_id is null)
    or (inventory_object_type = 'sheet' and inventory_sheet_id is not null and inventory_roll_id is null)
  )
);

create index idx_stocktake_items_stocktake on public.stocktake_items (organization_id, stocktake_id, line_no);
create index idx_stocktake_items_product on public.stocktake_items (organization_id, product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  movement_type text not null,
  quantity_delta numeric(18,6) not null,
  stock_unit_id uuid not null,
  display_quantity numeric(18,6),
  display_unit_id uuid references public.inventory_units(id) on delete restrict,
  inventory_object_type text,
  inventory_roll_id uuid references public.inventory_rolls(id) on delete restrict,
  inventory_sheet_id uuid references public.inventory_sheets(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  stocktake_id uuid references public.stocktakes(id) on delete restrict,
  stocktake_item_id uuid references public.stocktake_items(id) on delete restrict,
  reason text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stock_movements_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint stock_movements_stock_unit_org_fkey foreign key (stock_unit_id, organization_id)
    references public.inventory_units(id, organization_id) on delete restrict,
  constraint stock_movements_quantity_check check (quantity_delta <> 0),
  constraint stock_movements_type_check check (
    movement_type in ('sale_deduction', 'stocktake_adjustment', 'manual_adjustment', 'remnant_created', 'remnant_discarded')
  ),
  constraint stock_movements_inventory_object_check check (
    (inventory_object_type is null and inventory_roll_id is null and inventory_sheet_id is null)
    or (inventory_object_type = 'roll' and inventory_roll_id is not null and inventory_sheet_id is null)
    or (inventory_object_type = 'sheet' and inventory_sheet_id is not null and inventory_roll_id is null)
  )
);

create index idx_stock_movements_product_time on public.stock_movements (organization_id, product_id, created_at desc);
create index idx_stock_movements_order_item on public.stock_movements (organization_id, order_item_id)
  where order_item_id is not null;
create index idx_stock_movements_stocktake on public.stock_movements (organization_id, stocktake_id)
  where stocktake_id is not null;
create index idx_stock_movements_roll on public.stock_movements (organization_id, inventory_roll_id)
  where inventory_roll_id is not null;
create index idx_stock_movements_sheet on public.stock_movements (organization_id, inventory_sheet_id)
  where inventory_sheet_id is not null;

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  account_type text not null,
  bank_name text,
  bank_account_no text,
  is_default_cash boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_org_code_key unique (organization_id, code),
  constraint finance_accounts_id_org_key unique (id, organization_id),
  constraint finance_accounts_type_check check (account_type in ('cash', 'bank')),
  constraint finance_accounts_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint finance_accounts_bank_fields_check check (
    (account_type = 'cash' and bank_name is null and bank_account_no is null)
    or (account_type = 'bank' and char_length(btrim(coalesce(bank_name, ''))) > 0)
  )
);

create unique index finance_accounts_one_default_cash_per_org
  on public.finance_accounts (organization_id)
  where account_type = 'cash' and is_default_cash = true and is_active = true;
create index idx_finance_accounts_org_type_active on public.finance_accounts (organization_id, account_type, is_active);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  base_code text not null,
  revision_no integer not null default 0,
  status text not null default 'posted',
  receipt_type text not null,
  customer_id uuid references public.customers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  total_received_amount numeric(12,0) not null,
  sale_payment_amount numeric(12,0) not null default 0,
  debt_collection_amount numeric(12,0) not null default 0,
  change_returned_amount numeric(12,0) not null default 0,
  revised_from_receipt_id uuid references public.payment_receipts(id) on delete restrict,
  replaced_by_receipt_id uuid references public.payment_receipts(id) on delete restrict,
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_receipts_org_code_key unique (organization_id, code),
  constraint payment_receipts_id_org_key unique (id, organization_id),
  constraint payment_receipts_status_check check (status in ('posted', 'cancelled')),
  constraint payment_receipts_type_check check (receipt_type in ('sale_payment', 'debt_collection', 'mixed_sale_and_debt')),
  constraint payment_receipts_amounts_check check (
    total_received_amount >= 0
    and sale_payment_amount >= 0
    and debt_collection_amount >= 0
    and change_returned_amount >= 0
    and total_received_amount = sale_payment_amount + debt_collection_amount
  ),
  constraint payment_receipts_revision_check check (
    (revision_no = 0 and code = base_code and revised_from_receipt_id is null)
    or (revision_no > 0 and code = base_code || '.' || lpad(revision_no::text, 2, '0') and revised_from_receipt_id is not null)
  )
);

create index idx_payment_receipts_org_status_created on public.payment_receipts (organization_id, status, created_at desc);
create index idx_payment_receipts_customer on public.payment_receipts (organization_id, customer_id, created_at desc)
  where customer_id is not null;
create index idx_payment_receipts_order on public.payment_receipts (organization_id, order_id)
  where order_id is not null;
create index idx_payment_receipts_base_revision on public.payment_receipts (organization_id, base_code, revision_no);

create table public.payment_receipt_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_receipt_id uuid not null references public.payment_receipts(id) on delete cascade,
  line_no integer not null,
  finance_account_id uuid not null,
  method_type text not null,
  amount numeric(12,0) not null,
  bank_transaction_ref text,
  note text,
  created_at timestamptz not null default now(),
  constraint payment_receipt_methods_line_key unique (payment_receipt_id, line_no),
  constraint payment_receipt_methods_account_org_fkey foreign key (finance_account_id, organization_id)
    references public.finance_accounts(id, organization_id) on delete restrict,
  constraint payment_receipt_methods_method_account_check check (method_type in ('cash', 'bank_transfer')),
  constraint payment_receipt_methods_amount_check check (amount > 0)
);

create unique index payment_receipt_methods_one_cash
  on public.payment_receipt_methods (payment_receipt_id)
  where method_type = 'cash';
create unique index payment_receipt_methods_one_bank
  on public.payment_receipt_methods (payment_receipt_id)
  where method_type = 'bank_transfer';
create index idx_payment_receipt_methods_receipt on public.payment_receipt_methods (
  organization_id,
  payment_receipt_id,
  line_no
);
create index idx_payment_receipt_methods_account on public.payment_receipt_methods (organization_id, finance_account_id);

create table public.customer_debt_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_receipt_id uuid not null references public.payment_receipts(id) on delete restrict,
  line_no integer not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  allocated_amount numeric(12,0) not null,
  order_debt_before numeric(12,0) not null,
  order_debt_after numeric(12,0) not null,
  created_at timestamptz not null default now(),
  constraint customer_debt_allocations_line_key unique (payment_receipt_id, line_no),
  constraint customer_debt_allocations_amount_check check (
    allocated_amount > 0
    and order_debt_before > 0
    and order_debt_after >= 0
    and allocated_amount = order_debt_before - order_debt_after
  )
);

create index idx_customer_debt_allocations_receipt on public.customer_debt_allocations (
  organization_id,
  payment_receipt_id,
  line_no
);
create index idx_customer_debt_allocations_customer_order on public.customer_debt_allocations (
  organization_id,
  customer_id,
  order_id
);

create table public.customer_debt_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  entry_type text not null,
  amount_delta numeric(12,0) not null,
  balance_after_order numeric(12,0) not null,
  balance_after_customer numeric(12,0),
  payment_receipt_id uuid references public.payment_receipts(id) on delete restrict,
  debt_allocation_id uuid references public.customer_debt_allocations(id) on delete restrict,
  retail_debt_note text,
  reason text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint customer_debt_entries_type_check check (entry_type in ('invoice_debt', 'debt_payment', 'debt_reversal')),
  constraint customer_debt_entries_amount_check check (
    amount_delta <> 0
    and balance_after_order >= 0
    and (balance_after_customer is null or balance_after_customer >= 0)
  ),
  constraint customer_debt_entries_retail_note_check check (
    customer_id is not null
    or (entry_type = 'invoice_debt' and char_length(btrim(coalesce(retail_debt_note, ''))) > 0)
  ),
  constraint customer_debt_entries_payment_check check (
    entry_type <> 'debt_payment' or payment_receipt_id is not null
  )
);

create index idx_customer_debt_entries_customer_time on public.customer_debt_entries (
  organization_id,
  customer_id,
  created_at desc
) where customer_id is not null;
create index idx_customer_debt_entries_order_time on public.customer_debt_entries (
  organization_id,
  order_id,
  created_at desc
);
create index idx_customer_debt_entries_receipt on public.customer_debt_entries (organization_id, payment_receipt_id)
  where payment_receipt_id is not null;

create table public.cashbook_vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  base_code text not null,
  revision_no integer not null default 0,
  voucher_direction text not null,
  voucher_type text not null,
  status text not null default 'posted',
  finance_account_id uuid not null,
  amount numeric(12,0) not null,
  is_business_accounted boolean not null default true,
  counterparty_type text not null default 'none',
  counterparty_name text,
  counterparty_phone text,
  related_order_id uuid references public.orders(id) on delete restrict,
  related_customer_id uuid references public.customers(id) on delete restrict,
  revised_from_voucher_id uuid references public.cashbook_vouchers(id) on delete restrict,
  replaced_by_voucher_id uuid references public.cashbook_vouchers(id) on delete restrict,
  reason text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashbook_vouchers_org_code_key unique (organization_id, code),
  constraint cashbook_vouchers_account_org_fkey foreign key (finance_account_id, organization_id)
    references public.finance_accounts(id, organization_id) on delete restrict,
  constraint cashbook_vouchers_direction_check check (voucher_direction in ('in', 'out')),
  constraint cashbook_vouchers_type_check check (
    voucher_type in ('other_income', 'material_purchase', 'customer_refund', 'operating_expense', 'other_expense')
  ),
  constraint cashbook_vouchers_counterparty_type_check check (
    counterparty_type in ('customer', 'supplier', 'employee', 'other', 'none')
  ),
  constraint cashbook_vouchers_status_check check (status in ('posted', 'cancelled')),
  constraint cashbook_vouchers_amount_check check (amount > 0),
  constraint cashbook_vouchers_revision_check check (
    (revision_no = 0 and code = base_code and revised_from_voucher_id is null)
    or (revision_no > 0 and code = base_code || '.' || lpad(revision_no::text, 2, '0') and revised_from_voucher_id is not null)
  )
);

create index idx_cashbook_vouchers_org_status_created on public.cashbook_vouchers (
  organization_id,
  status,
  created_at desc
);
create index idx_cashbook_vouchers_account on public.cashbook_vouchers (
  organization_id,
  finance_account_id,
  created_at desc
);
create index idx_cashbook_vouchers_base_revision on public.cashbook_vouchers (organization_id, base_code, revision_no);

create table public.cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  finance_account_id uuid not null,
  entry_time timestamptz not null default now(),
  source_type text not null,
  payment_receipt_method_id uuid references public.payment_receipt_methods(id) on delete restrict,
  cashbook_voucher_id uuid references public.cashbook_vouchers(id) on delete restrict,
  status text not null default 'posted',
  direction text not null,
  amount_delta numeric(12,0) not null,
  is_business_accounted boolean not null default true,
  running_balance numeric(12,0),
  description text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cashbook_entries_account_org_fkey foreign key (finance_account_id, organization_id)
    references public.finance_accounts(id, organization_id) on delete restrict,
  constraint cashbook_entries_source_type_check check (source_type in ('payment_receipt_method', 'cashbook_voucher')),
  constraint cashbook_entries_status_check check (status in ('posted', 'cancelled')),
  constraint cashbook_entries_direction_check check (direction in ('in', 'out')),
  constraint cashbook_entries_amount_direction_check check (
    (direction = 'in' and amount_delta > 0)
    or (direction = 'out' and amount_delta < 0)
  ),
  constraint cashbook_entries_source_check check (
    (source_type = 'payment_receipt_method' and payment_receipt_method_id is not null and cashbook_voucher_id is null)
    or (source_type = 'cashbook_voucher' and cashbook_voucher_id is not null and payment_receipt_method_id is null)
  )
);

create unique index cashbook_entries_one_payment_method
  on public.cashbook_entries (payment_receipt_method_id)
  where payment_receipt_method_id is not null;
create unique index cashbook_entries_one_voucher
  on public.cashbook_entries (cashbook_voucher_id)
  where cashbook_voucher_id is not null;
create index idx_cashbook_entries_account_time on public.cashbook_entries (
  organization_id,
  finance_account_id,
  status,
  entry_time desc
);
create index idx_cashbook_entries_payment_method on public.cashbook_entries (organization_id, payment_receipt_method_id)
  where payment_receipt_method_id is not null;
create index idx_cashbook_entries_voucher on public.cashbook_entries (organization_id, cashbook_voucher_id)
  where cashbook_voucher_id is not null;

create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  status text not null default 'draft',
  period_start timestamptz not null,
  period_end timestamptz not null,
  balanced_at timestamptz,
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_reconciliations_org_code_key unique (organization_id, code),
  constraint cash_reconciliations_id_org_key unique (id, organization_id),
  constraint cash_reconciliations_status_check check (status in ('draft', 'balanced', 'cancelled')),
  constraint cash_reconciliations_period_check check (period_start < period_end),
  constraint cash_reconciliations_balanced_at_check check (
    (status = 'balanced' and balanced_at is not null)
    or (status <> 'balanced' and balanced_at is null)
  )
);

create index idx_cash_reconciliations_org_status_period on public.cash_reconciliations (
  organization_id,
  status,
  period_end desc
);

create table public.cash_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  cash_reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
  line_no integer not null,
  finance_account_id uuid not null,
  system_balance numeric(12,0) not null,
  actual_balance numeric(12,0) not null,
  difference_amount numeric(12,0) not null,
  note text,
  created_at timestamptz not null default now(),
  constraint cash_reconciliation_items_line_key unique (cash_reconciliation_id, line_no),
  constraint cash_reconciliation_items_account_key unique (cash_reconciliation_id, finance_account_id),
  constraint cash_reconciliation_items_account_org_fkey foreign key (finance_account_id, organization_id)
    references public.finance_accounts(id, organization_id) on delete restrict,
  constraint cash_reconciliation_items_difference_check check (difference_amount = actual_balance - system_balance)
);

create index idx_cash_reconciliation_items_reconciliation on public.cash_reconciliation_items (
  organization_id,
  cash_reconciliation_id,
  line_no
);
create index idx_cash_reconciliation_items_account on public.cash_reconciliation_items (
  organization_id,
  finance_account_id
);

create or replace function public.next_order_code(p_organization_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(o.code from char_length(p_prefix) + 1 for 6)::integer), 0) + 1
    into next_number
  from public.orders o
  where o.organization_id = p_organization_id
    and o.code ~ ('^' || p_prefix || '[0-9]{6}$');

  return p_prefix || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.next_stocktake_code(p_organization_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select 'KK' || lpad((coalesce(max(substring(code from 3 for 6)::integer), 0) + 1)::text, 6, '0')
  from public.stocktakes
  where organization_id = p_organization_id
    and code ~ '^KK[0-9]{6}$'
$$;

create or replace function public.next_payment_receipt_code(p_organization_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select 'PT' || lpad((coalesce(max(substring(code from 3 for 6)::integer), 0) + 1)::text, 6, '0')
  from public.payment_receipts
  where organization_id = p_organization_id
    and code ~ '^PT[0-9]{6}$'
$$;

create or replace function public.next_cashbook_voucher_code(p_organization_id uuid, p_direction text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text;
  next_number integer;
begin
  prefix := case when p_direction = 'out' then 'PC' else 'PT' end;

  select coalesce(max(substring(v.code from 3 for 6)::integer), 0) + 1
    into next_number
  from public.cashbook_vouchers v
  where v.organization_id = p_organization_id
    and v.code ~ ('^' || prefix || '[0-9]{6}$');

  return prefix || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.next_cash_reconciliation_code(p_organization_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select 'DS' || lpad((coalesce(max(substring(code from 3 for 6)::integer), 0) + 1)::text, 6, '0')
  from public.cash_reconciliations
  where organization_id = p_organization_id
    and code ~ '^DS[0-9]{6}$'
$$;

create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger set_inventory_units_updated_at
before update on public.inventory_units
for each row execute function public.set_updated_at();

create trigger set_product_inventory_settings_updated_at
before update on public.product_inventory_settings
for each row execute function public.set_updated_at();

create trigger set_product_unit_conversions_updated_at
before update on public.product_unit_conversions
for each row execute function public.set_updated_at();

create trigger set_inventory_rolls_updated_at
before update on public.inventory_rolls
for each row execute function public.set_updated_at();

create trigger set_inventory_sheets_updated_at
before update on public.inventory_sheets
for each row execute function public.set_updated_at();

create trigger set_stocktakes_updated_at
before update on public.stocktakes
for each row execute function public.set_updated_at();

create trigger set_finance_accounts_updated_at
before update on public.finance_accounts
for each row execute function public.set_updated_at();

create trigger set_payment_receipts_updated_at
before update on public.payment_receipts
for each row execute function public.set_updated_at();

create trigger set_cashbook_vouchers_updated_at
before update on public.cashbook_vouchers
for each row execute function public.set_updated_at();

create trigger set_cash_reconciliations_updated_at
before update on public.cash_reconciliations
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_units enable row level security;
alter table public.product_inventory_settings enable row level security;
alter table public.product_unit_conversions enable row level security;
alter table public.inventory_rolls enable row level security;
alter table public.inventory_sheets enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stocktakes enable row level security;
alter table public.stocktake_items enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_receipt_methods enable row level security;
alter table public.customer_debt_entries enable row level security;
alter table public.customer_debt_allocations enable row level security;
alter table public.cashbook_vouchers enable row level security;
alter table public.cashbook_entries enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.cash_reconciliation_items enable row level security;

create or replace function public.checkout_order_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id_value uuid;
  price_list_id_value uuid;
  order_id_value uuid;
  order_code_value text;
  payment_receipt_id_value uuid;
  receipt_code_value text;
  cash_account_id_value uuid;
  bank_account_id_value uuid;
  cash_amount_value numeric(12,0);
  bank_amount_value numeric(12,0);
  total_received_value numeric(12,0);
  old_debt_payment_value numeric(12,0);
  change_returned_value numeric(12,0);
  sale_payment_value numeric(12,0);
  debt_amount_value numeric(12,0);
  subtotal_amount_value numeric(12,0) := 0;
  discount_amount_value numeric(12,0) := 0;
  total_amount_value numeric(12,0);
  payment_status_value text;
  receipt_type_value text;
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  settings_record record;
  quantity_value numeric(12,3);
  unit_price_value numeric(12,0);
  line_subtotal_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_total_value numeric(12,0);
  order_item_id_value uuid;
  method_line_no integer := 0;
  payment_method_id_value uuid;
  remaining_debt_payment numeric(12,0);
  debt_order_record record;
  allocation_amount numeric(12,0);
  outstanding_before numeric(12,0);
  outstanding_after numeric(12,0);
  allocation_line_no integer := 0;
  debt_allocation_id_value uuid;
  customer_balance_value numeric(12,0);
  retail_debt_note_value text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception 'actor profile is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'checkout items are required' using errcode = '22023';
  end if;

  customer_id_value := nullif(p_payload->>'customer_id', '')::uuid;
  retail_debt_note_value := nullif(btrim(coalesce(p_payload->>'retail_debt_note', '')), '');
  cash_amount_value := coalesce(((p_payload->'payment')->>'cash_amount')::numeric, 0);
  bank_amount_value := coalesce(((p_payload->'payment')->>'bank_amount')::numeric, 0);
  old_debt_payment_value := coalesce(((p_payload->'payment')->>'old_debt_payment_amount')::numeric, 0);
  change_returned_value := coalesce(((p_payload->'payment')->>'change_returned_amount')::numeric, 0);
  total_received_value := cash_amount_value + bank_amount_value;

  if cash_amount_value < 0 or bank_amount_value < 0 or old_debt_payment_value < 0 or change_returned_value < 0 then
    raise exception 'payment amounts must be non-negative' using errcode = '22023';
  end if;

  if old_debt_payment_value > 0 and customer_id_value is null then
    raise exception 'customer_id is required for old debt payment' using errcode = '22023';
  end if;

  if bank_amount_value > 0 then
    bank_account_id_value := nullif((p_payload->'payment')->>'bank_account_id', '')::uuid;

    if bank_account_id_value is null or not exists (
      select 1
      from public.finance_accounts fa
      where fa.id = bank_account_id_value
        and fa.organization_id = p_organization_id
        and fa.account_type = 'bank'
        and fa.is_active = true
    ) then
      raise exception 'bank_account_id must reference an active bank account' using errcode = '22023';
    end if;
  end if;

  select fa.id
    into cash_account_id_value
  from public.finance_accounts fa
  where fa.organization_id = p_organization_id
    and fa.account_type = 'cash'
    and fa.is_default_cash = true
    and fa.is_active = true
  limit 1;

  if cash_amount_value > 0 and cash_account_id_value is null then
    raise exception 'default cash account is not configured' using errcode = '22023';
  end if;

  select pl.id
    into price_list_id_value
  from public.price_lists pl
  where pl.organization_id = p_organization_id
    and pl.is_default = true
    and pl.is_active = true
  limit 1;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
    unit_price_value := coalesce((item_value->>'unit_price')::numeric, 0);
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);

    if quantity_value <= 0 or unit_price_value < 0 then
      raise exception 'item quantity and unit price are invalid' using errcode = '22023';
    end if;

    if line_discount_value < 0 or line_discount_value > line_subtotal_value then
      raise exception 'item discount amount is invalid' using errcode = '22023';
    end if;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id
      and p.status = 'active';

    if product_record.id is null then
      raise exception 'product is not active' using errcode = '22023';
    end if;

    subtotal_amount_value := subtotal_amount_value + line_subtotal_value;
    discount_amount_value := discount_amount_value + line_discount_value;
  end loop;

  total_amount_value := subtotal_amount_value - discount_amount_value;
  sale_payment_value := least(total_amount_value, greatest(total_received_value - old_debt_payment_value, 0));
  debt_amount_value := total_amount_value - sale_payment_value;

  if debt_amount_value > 0 and customer_id_value is null and retail_debt_note_value is null then
    raise exception 'retail_debt_note is required for retail debt' using errcode = '22023';
  end if;

  payment_status_value := case
    when debt_amount_value = 0 then 'paid'
    when sale_payment_value > 0 then 'partial'
    else 'unpaid'
  end;

  order_code_value := public.next_order_code(p_organization_id, 'HD');

  insert into public.orders (
    organization_id,
    code,
    order_type,
    status,
    base_code,
    revision_no,
    customer_id,
    customer_snapshot,
    price_list_id,
    subtotal_amount,
    discount_amount,
    total_amount,
    paid_amount,
    debt_amount,
    change_returned_amount,
    payment_status,
    note,
    created_by
  )
  values (
    p_organization_id,
    order_code_value,
    'invoice',
    'completed',
    order_code_value,
    0,
    customer_id_value,
    coalesce(
      (
        select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name, 'phone', c.phone)
        from public.customers c
        where c.id = customer_id_value
          and c.organization_id = p_organization_id
      ),
      jsonb_build_object('type', 'retail')
    ),
    price_list_id_value,
    subtotal_amount_value,
    discount_amount_value,
    total_amount_value,
    sale_payment_value,
    debt_amount_value,
    change_returned_value,
    payment_status_value,
    p_payload->>'note',
    p_actor_user_id
  )
  returning id into order_id_value;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := (item_value->>'quantity')::numeric;
    unit_price_value := (item_value->>'unit_price')::numeric;
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_total_value := line_subtotal_value - line_discount_value;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id;

    select pis.*
      into settings_record
    from public.product_inventory_settings pis
    where pis.product_id = product_id_value
      and pis.organization_id = p_organization_id;

    insert into public.order_items (
      organization_id,
      order_id,
      line_no,
      product_id,
      product_snapshot,
      sell_method,
      quantity,
      unit_price,
      line_subtotal_amount,
      discount_amount,
      price_source,
      line_total,
      note
    )
    values (
      p_organization_id,
      order_id_value,
      line_no_value,
      product_id_value,
      jsonb_build_object(
        'id', product_record.id,
        'code', product_record.code,
        'name', product_record.name,
        'unit_name', product_record.unit_name,
        'sell_method', product_record.sell_method
      ),
      product_record.sell_method,
      quantity_value,
      unit_price_value,
      line_subtotal_value,
      line_discount_value,
      coalesce(item_value->>'price_source', 'manual'),
      line_total_value,
      item_value->>'note'
    )
    returning id into order_item_id_value;

    if settings_record.stock_unit_id is not null then
      insert into public.stock_movements (
        organization_id,
        product_id,
        movement_type,
        quantity_delta,
        stock_unit_id,
        display_quantity,
        display_unit_id,
        inventory_object_type,
        order_id,
        order_item_id,
        reason,
        created_by
      )
      values (
        p_organization_id,
        product_id_value,
        'sale_deduction',
        -quantity_value,
        settings_record.stock_unit_id,
        quantity_value,
        settings_record.stock_unit_id,
        null,
        order_id_value,
        order_item_id_value,
        'checkout',
        p_actor_user_id
      );
    end if;
  end loop;

  if total_received_value > 0 then
    receipt_code_value := public.next_payment_receipt_code(p_organization_id);
    receipt_type_value := case
      when sale_payment_value > 0 and old_debt_payment_value > 0 then 'mixed_sale_and_debt'
      when old_debt_payment_value > 0 then 'debt_collection'
      else 'sale_payment'
    end;

    insert into public.payment_receipts (
      organization_id,
      code,
      base_code,
      revision_no,
      status,
      receipt_type,
      customer_id,
      order_id,
      total_received_amount,
      sale_payment_amount,
      debt_collection_amount,
      change_returned_amount,
      created_by
    )
    values (
      p_organization_id,
      receipt_code_value,
      receipt_code_value,
      0,
      'posted',
      receipt_type_value,
      customer_id_value,
      order_id_value,
      total_received_value,
      sale_payment_value,
      old_debt_payment_value,
      change_returned_value,
      p_actor_user_id
    )
    returning id into payment_receipt_id_value;

    if cash_amount_value > 0 then
      method_line_no := method_line_no + 1;
      insert into public.payment_receipt_methods (
        organization_id,
        payment_receipt_id,
        line_no,
        finance_account_id,
        method_type,
        amount
      )
      values (
        p_organization_id,
        payment_receipt_id_value,
        method_line_no,
        cash_account_id_value,
        'cash',
        cash_amount_value
      )
      returning id into payment_method_id_value;

      insert into public.cashbook_entries (
        organization_id,
        finance_account_id,
        source_type,
        payment_receipt_method_id,
        status,
        direction,
        amount_delta,
        description,
        created_by
      )
      values (
        p_organization_id,
        cash_account_id_value,
        'payment_receipt_method',
        payment_method_id_value,
        'posted',
        'in',
        cash_amount_value,
        'Checkout ' || order_code_value,
        p_actor_user_id
      );
    end if;

    if bank_amount_value > 0 then
      method_line_no := method_line_no + 1;
      insert into public.payment_receipt_methods (
        organization_id,
        payment_receipt_id,
        line_no,
        finance_account_id,
        method_type,
        amount,
        bank_transaction_ref
      )
      values (
        p_organization_id,
        payment_receipt_id_value,
        method_line_no,
        bank_account_id_value,
        'bank_transfer',
        bank_amount_value,
        (p_payload->'payment')->>'bank_transaction_ref'
      )
      returning id into payment_method_id_value;

      insert into public.cashbook_entries (
        organization_id,
        finance_account_id,
        source_type,
        payment_receipt_method_id,
        status,
        direction,
        amount_delta,
        description,
        created_by
      )
      values (
        p_organization_id,
        bank_account_id_value,
        'payment_receipt_method',
        payment_method_id_value,
        'posted',
        'in',
        bank_amount_value,
        'Checkout ' || order_code_value,
        p_actor_user_id
      );
    end if;
  end if;

  if debt_amount_value > 0 then
    customer_balance_value := (
      select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
      from public.orders o
      left join public.customer_debt_allocations a on a.order_id = o.id
      where o.organization_id = p_organization_id
        and o.customer_id is not distinct from customer_id_value
        and o.order_type = 'invoice'
        and o.status = 'completed'
    );

    insert into public.customer_debt_entries (
      organization_id,
      customer_id,
      order_id,
      entry_type,
      amount_delta,
      balance_after_order,
      balance_after_customer,
      retail_debt_note,
      created_by
    )
    values (
      p_organization_id,
      customer_id_value,
      order_id_value,
      'invoice_debt',
      debt_amount_value,
      debt_amount_value,
      customer_balance_value,
      retail_debt_note_value,
      p_actor_user_id
    );
  end if;

  remaining_debt_payment := old_debt_payment_value;
  while remaining_debt_payment > 0 loop
    select
      o.id as order_id,
      o.debt_amount - coalesce(sum(a.allocated_amount), 0) as outstanding
      into debt_order_record
    from public.orders o
    left join public.customer_debt_allocations a on a.order_id = o.id
    where o.organization_id = p_organization_id
      and o.customer_id = customer_id_value
      and o.order_type = 'invoice'
      and o.status = 'completed'
      and o.id <> order_id_value
    group by o.id, o.debt_amount, o.created_at
    having o.debt_amount - coalesce(sum(a.allocated_amount), 0) > 0
    order by o.created_at asc, o.code asc
    limit 1;

    if debt_order_record.order_id is null then
      raise exception 'debt collection cannot exceed outstanding debt' using errcode = '22023';
    end if;

    outstanding_before := debt_order_record.outstanding;
    allocation_amount := least(remaining_debt_payment, outstanding_before);
    outstanding_after := outstanding_before - allocation_amount;
    allocation_line_no := allocation_line_no + 1;

    insert into public.customer_debt_allocations (
      organization_id,
      payment_receipt_id,
      line_no,
      customer_id,
      order_id,
      allocated_amount,
      order_debt_before,
      order_debt_after
    )
    values (
      p_organization_id,
      payment_receipt_id_value,
      allocation_line_no,
      customer_id_value,
      debt_order_record.order_id,
      allocation_amount,
      outstanding_before,
      outstanding_after
    )
    returning id into debt_allocation_id_value;

    customer_balance_value := (
      select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
      from public.orders o
      left join public.customer_debt_allocations a on a.order_id = o.id
      where o.organization_id = p_organization_id
        and o.customer_id = customer_id_value
        and o.order_type = 'invoice'
        and o.status = 'completed'
    );

    insert into public.customer_debt_entries (
      organization_id,
      customer_id,
      order_id,
      entry_type,
      amount_delta,
      balance_after_order,
      balance_after_customer,
      payment_receipt_id,
      debt_allocation_id,
      created_by
    )
    values (
      p_organization_id,
      customer_id_value,
      debt_order_record.order_id,
      'debt_payment',
      -allocation_amount,
      outstanding_after,
      customer_balance_value,
      payment_receipt_id_value,
      debt_allocation_id_value,
      p_actor_user_id
    );

    remaining_debt_payment := remaining_debt_payment - allocation_amount;
  end loop;

  return jsonb_build_object(
    'order_id', order_id_value,
    'order_code', order_code_value,
    'payment_receipt_id', payment_receipt_id_value,
    'order', jsonb_build_object(
      'id', order_id_value,
      'code', order_code_value,
      'order_type', 'invoice',
      'status', 'completed',
      'total_amount', total_amount_value,
      'paid_amount', sale_payment_value,
      'debt_amount', debt_amount_value,
      'payment_status', payment_status_value
    ),
    'payment_receipt', case
      when payment_receipt_id_value is null then null
      else jsonb_build_object(
        'id', payment_receipt_id_value,
        'code', receipt_code_value,
        'total_received_amount', total_received_value
      )
    end,
    'inventory_warnings', '[]'::jsonb,
    'total_amount', total_amount_value,
    'paid_amount', sale_payment_value,
    'debt_amount', debt_amount_value,
    'change_returned_amount', change_returned_value
  );
end;
$$;


create or replace function public.save_quote_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id_value uuid;
  price_list_id_value uuid;
  order_id_value uuid;
  order_code_value text;
  subtotal_amount_value numeric(12,0) := 0;
  discount_amount_value numeric(12,0) := 0;
  total_amount_value numeric(12,0);
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  quantity_value numeric(12,3);
  unit_price_value numeric(12,0);
  line_subtotal_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_total_value numeric(12,0);
  customer_snapshot_value jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception 'actor profile is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'quote items are required' using errcode = '22023';
  end if;

  customer_id_value := nullif(p_payload->>'customer_id', '')::uuid;
  if customer_id_value is not null and not exists (
    select 1
    from public.customers c
    where c.id = customer_id_value
      and c.organization_id = p_organization_id
  ) then
    raise exception 'customer_id is invalid' using errcode = '22023';
  end if;

  price_list_id_value := nullif(p_payload->>'price_list_id', '')::uuid;
  if price_list_id_value is not null and not exists (
    select 1
    from public.price_lists pl
    where pl.id = price_list_id_value
      and pl.organization_id = p_organization_id
  ) then
    raise exception 'price_list_id is invalid' using errcode = '22023';
  end if;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
    unit_price_value := coalesce((item_value->>'unit_price')::numeric, 0);
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);

    if quantity_value <= 0 or unit_price_value < 0 then
      raise exception 'item quantity and unit price are invalid' using errcode = '22023';
    end if;

    if line_discount_value < 0 or line_discount_value > line_subtotal_value then
      raise exception 'item discount amount is invalid' using errcode = '22023';
    end if;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id
      and p.status = 'active';

    if product_record.id is null then
      raise exception 'product is not active' using errcode = '22023';
    end if;

    subtotal_amount_value := subtotal_amount_value + line_subtotal_value;
    discount_amount_value := discount_amount_value + line_discount_value;
  end loop;

  total_amount_value := subtotal_amount_value - discount_amount_value;
  order_code_value := public.next_order_code(p_organization_id, 'BG');

  customer_snapshot_value := case
    when jsonb_typeof(p_payload->'customer_snapshot') = 'object' then p_payload->'customer_snapshot'
    when customer_id_value is not null then (
      select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name, 'phone', c.phone)
      from public.customers c
      where c.id = customer_id_value
        and c.organization_id = p_organization_id
    )
    else jsonb_build_object('type', 'retail', 'name', 'Khach le')
  end;

  insert into public.orders (
    organization_id,
    code,
    order_type,
    status,
    base_code,
    revision_no,
    customer_id,
    customer_snapshot,
    price_list_id,
    subtotal_amount,
    discount_amount,
    total_amount,
    paid_amount,
    debt_amount,
    change_returned_amount,
    payment_status,
    note,
    created_by
  )
  values (
    p_organization_id,
    order_code_value,
    'quote',
    'active',
    order_code_value,
    0,
    customer_id_value,
    customer_snapshot_value,
    price_list_id_value,
    subtotal_amount_value,
    discount_amount_value,
    total_amount_value,
    0,
    0,
    0,
    'not_applicable',
    p_payload->>'note',
    p_actor_user_id
  )
  returning id into order_id_value;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    quantity_value := (item_value->>'quantity')::numeric;
    unit_price_value := (item_value->>'unit_price')::numeric;
    line_subtotal_value := round(quantity_value * unit_price_value);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_total_value := line_subtotal_value - line_discount_value;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id;

    insert into public.order_items (
      organization_id,
      order_id,
      line_no,
      product_id,
      product_snapshot,
      sell_method,
      quantity,
      width_m,
      height_m,
      linear_m,
      unit_price,
      line_subtotal_amount,
      discount_amount,
      price_source,
      line_total,
      note
    )
    values (
      p_organization_id,
      order_id_value,
      line_no_value,
      product_id_value,
      jsonb_build_object(
        'id', product_record.id,
        'code', product_record.code,
        'name', product_record.name,
        'unit_name', product_record.unit_name,
        'sell_method', product_record.sell_method
      ),
      product_record.sell_method,
      quantity_value,
      nullif(item_value->>'width_m', '')::numeric,
      nullif(item_value->>'height_m', '')::numeric,
      nullif(item_value->>'linear_m', '')::numeric,
      unit_price_value,
      line_subtotal_value,
      line_discount_value,
      coalesce(item_value->>'price_source', 'manual'),
      line_total_value,
      item_value->>'note'
    );
  end loop;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    p_organization_id,
    order_id_value,
    null,
    'active',
    'quote_created',
    p_actor_user_id
  );

  return jsonb_build_object(
    'order_id', order_id_value,
    'order_code', order_code_value,
    'order', jsonb_build_object(
      'id', order_id_value,
      'code', order_code_value,
      'order_type', 'quote',
      'status', 'active',
      'total_amount', total_amount_value
    ),
    'total_amount', total_amount_value
  );
end;
$$;

create or replace function public.collect_customer_debt_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id_value uuid := nullif(p_payload->>'customer_id', '')::uuid;
  cash_amount_value numeric(12,0) := coalesce((p_payload->>'cash_amount')::numeric, 0);
  bank_amount_value numeric(12,0) := coalesce((p_payload->>'bank_amount')::numeric, 0);
  total_amount_value numeric(12,0);
  outstanding_value numeric(12,0);
begin
  total_amount_value := cash_amount_value + bank_amount_value;

  select coalesce(sum(o.debt_amount), 0) - coalesce(sum(a.allocated_amount), 0)
    into outstanding_value
  from public.orders o
  left join public.customer_debt_allocations a on a.order_id = o.id
  where o.organization_id = p_organization_id
    and o.customer_id = customer_id_value
    and o.order_type = 'invoice'
    and o.status = 'completed';

  if total_amount_value <= 0 or total_amount_value > coalesce(outstanding_value, 0) then
    raise exception 'debt collection cannot exceed outstanding debt' using errcode = '22023';
  end if;

  return public.checkout_order_tx(
    p_actor_user_id,
    p_organization_id,
    jsonb_build_object(
      'customer_id', customer_id_value,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', '00000000-0000-4000-8000-000000000303',
          'quantity', 1,
          'unit_price', 0,
          'price_source', 'manual'
        )
      ),
      'payment', jsonb_build_object(
        'cash_amount', cash_amount_value,
        'bank_amount', bank_amount_value,
        'bank_account_id', p_payload->>'bank_account_id',
        'old_debt_payment_amount', total_amount_value
      )
    )
  );
end;
$$;

create or replace function public.adjust_normal_product_stock_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_product_id uuid,
  p_actual_qty numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_record record;
  settings_record record;
  stocktake_id_value uuid;
  stocktake_item_id_value uuid;
  stocktake_code_value text;
  stocktake_note_value text;
  system_qty_value numeric(18,6);
  difference_qty_value numeric(18,6);
  created_at_value timestamptz;
begin
  if p_actual_qty < 0 or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'actual quantity and reason are required' using errcode = '22023';
  end if;

  select p.id, p.code, p.name
    into product_record
  from public.products p
  where p.id = p_product_id
    and p.organization_id = p_organization_id;

  if product_record.id is null then
    raise exception 'product not found' using errcode = '23503';
  end if;

  select pis.inventory_shape, pis.stock_unit_id
    into settings_record
  from public.product_inventory_settings pis
  where pis.product_id = p_product_id
    and pis.organization_id = p_organization_id;

  if settings_record.stock_unit_id is null then
    raise exception 'inventory settings not found' using errcode = '23503';
  end if;

  if settings_record.inventory_shape <> 'normal' then
    raise exception 'roll and sheet products reject total stock adjustment' using errcode = '22023';
  end if;

  select coalesce(sum(sm.quantity_delta), 0)
    into system_qty_value
  from public.stock_movements sm
  where sm.product_id = p_product_id
    and sm.organization_id = p_organization_id;

  difference_qty_value := p_actual_qty - system_qty_value;
  stocktake_code_value := public.next_stocktake_code(p_organization_id);
  stocktake_note_value := 'Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa: '
    || product_record.name || ' (' || product_record.code || ')';

  insert into public.stocktakes (
    organization_id,
    code,
    status,
    source_type,
    note,
    balanced_at,
    created_by
  )
  values (
    p_organization_id,
    stocktake_code_value,
    'balanced',
    'product_edit',
    stocktake_note_value,
    now(),
    p_actor_user_id
  )
  returning id, created_at into stocktake_id_value, created_at_value;

  insert into public.stocktake_items (
    organization_id,
    stocktake_id,
    line_no,
    product_id,
    stock_unit_id,
    system_qty,
    actual_qty,
    difference_qty,
    note
  )
  values (
    p_organization_id,
    stocktake_id_value,
    1,
    p_product_id,
    settings_record.stock_unit_id,
    system_qty_value,
    p_actual_qty,
    difference_qty_value,
    p_reason
  )
  returning id into stocktake_item_id_value;

  if difference_qty_value <> 0 then
    insert into public.stock_movements (
      organization_id,
      product_id,
      movement_type,
      quantity_delta,
      stock_unit_id,
      display_quantity,
      display_unit_id,
      stocktake_id,
      stocktake_item_id,
      reason,
      created_by
    )
    values (
      p_organization_id,
      p_product_id,
      'stocktake_adjustment',
      difference_qty_value,
      settings_record.stock_unit_id,
      difference_qty_value,
      settings_record.stock_unit_id,
      stocktake_id_value,
      stocktake_item_id_value,
      p_reason,
      p_actor_user_id
    );
  end if;

  return jsonb_build_object(
    'id', stocktake_id_value,
    'code', stocktake_code_value,
    'status', 'balanced',
    'source_type', 'product_edit',
    'created_at', created_at_value,
    'balanced_at', created_at_value,
    'note', stocktake_note_value
  );
end;
$$;

create or replace function public.revise_invoice_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_order_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_payload->>'revision_reason', '')), '') is null then
    raise exception 'revision_reason is required' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'organization_id', p_organization_id,
    'actor_user_id', p_actor_user_id,
    'status', 'not_implemented'
  );
end;
$$;

grant select, insert, update, delete on
  public.orders,
  public.order_items,
  public.order_status_history,
  public.inventory_units,
  public.product_inventory_settings,
  public.product_unit_conversions,
  public.inventory_rolls,
  public.inventory_sheets,
  public.stock_movements,
  public.stocktakes,
  public.stocktake_items,
  public.finance_accounts,
  public.payment_receipts,
  public.payment_receipt_methods,
  public.customer_debt_entries,
  public.customer_debt_allocations,
  public.cashbook_vouchers,
  public.cashbook_entries,
  public.cash_reconciliations,
  public.cash_reconciliation_items
to service_role;

grant execute on function public.next_order_code(uuid, text) to service_role;
grant execute on function public.next_stocktake_code(uuid) to service_role;
grant execute on function public.next_payment_receipt_code(uuid) to service_role;
grant execute on function public.next_cashbook_voucher_code(uuid, text) to service_role;
grant execute on function public.next_cash_reconciliation_code(uuid) to service_role;
grant execute on function public.checkout_order_tx(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_quote_tx(uuid, uuid, jsonb) to service_role;
grant execute on function public.collect_customer_debt_tx(uuid, uuid, jsonb) to service_role;
grant execute on function public.adjust_normal_product_stock_tx(uuid, uuid, uuid, numeric, text) to service_role;
grant execute on function public.revise_invoice_tx(uuid, uuid, uuid, jsonb) to service_role;
