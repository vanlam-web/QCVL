begin;

select plan(79);

select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order_items table exists');
select has_table('public', 'order_status_history', 'order_status_history table exists');

select has_column('public', 'orders', 'code', 'orders.code exists');
select has_column('public', 'orders', 'order_type', 'orders.order_type exists');
select has_column('public', 'orders', 'status', 'orders.status exists');
select has_column('public', 'orders', 'base_code', 'orders.base_code exists');
select has_column('public', 'orders', 'revision_no', 'orders.revision_no exists');
select has_column('public', 'orders', 'revised_from_order_id', 'orders.revised_from_order_id exists');
select has_column('public', 'orders', 'replaced_by_order_id', 'orders.replaced_by_order_id exists');
select has_column('public', 'orders', 'customer_snapshot', 'orders.customer_snapshot exists');
select has_column('public', 'orders', 'paid_amount', 'orders.paid_amount exists');
select has_column('public', 'orders', 'debt_amount', 'orders.debt_amount exists');
select has_column('public', 'orders', 'change_returned_amount', 'orders.change_returned_amount exists');
select has_column('public', 'orders', 'payment_status', 'orders.payment_status exists');
select has_index('public', 'orders', 'idx_orders_org_type_status', 'orders has type/status index');
select has_index('public', 'orders', 'idx_orders_org_base_revision', 'orders has base/revision index');

select has_column('public', 'order_items', 'order_id', 'order_items.order_id exists');
select has_column('public', 'order_items', 'line_no', 'order_items.line_no exists');
select has_column('public', 'order_items', 'product_snapshot', 'order_items.product_snapshot exists');
select has_column('public', 'order_items', 'sell_method', 'order_items.sell_method exists');
select has_column('public', 'order_items', 'quantity', 'order_items.quantity exists');
select has_column('public', 'order_items', 'unit_price', 'order_items.unit_price exists');
select has_column('public', 'order_items', 'price_source', 'order_items.price_source exists');
select has_column('public', 'order_items', 'line_total', 'order_items.line_total exists');
select has_table('public', 'inventory_units', 'inventory_units table exists');
select has_table('public', 'product_inventory_settings', 'product_inventory_settings table exists');
select has_table('public', 'product_unit_conversions', 'product_unit_conversions table exists');
select has_table('public', 'inventory_rolls', 'inventory_rolls table exists');
select has_table('public', 'inventory_sheets', 'inventory_sheets table exists');
select has_table('public', 'stock_movements', 'stock_movements table exists');
select has_table('public', 'stocktakes', 'stocktakes table exists');
select has_table('public', 'stocktake_items', 'stocktake_items table exists');

select has_column('public', 'product_inventory_settings', 'inventory_shape', 'product_inventory_settings.inventory_shape exists');
select has_column('public', 'product_inventory_settings', 'stock_unit_id', 'product_inventory_settings.stock_unit_id exists');
select has_column('public', 'inventory_rolls', 'remaining_length_m', 'inventory_rolls.remaining_length_m exists');
select has_column('public', 'inventory_rolls', 'remaining_area_m2', 'inventory_rolls.remaining_area_m2 exists');
select has_column('public', 'inventory_sheets', 'sheet_kind', 'inventory_sheets.sheet_kind exists');
select has_column('public', 'inventory_sheets', 'area_m2', 'inventory_sheets.area_m2 exists');
select has_column('public', 'stock_movements', 'movement_type', 'stock_movements.movement_type exists');
select has_column('public', 'stock_movements', 'quantity_delta', 'stock_movements.quantity_delta exists');
select has_column('public', 'stock_movements', 'inventory_object_type', 'stock_movements.inventory_object_type exists');
select has_column('public', 'stock_movements', 'inventory_roll_id', 'stock_movements.inventory_roll_id exists');
select has_column('public', 'stock_movements', 'inventory_sheet_id', 'stock_movements.inventory_sheet_id exists');
select has_column('public', 'stocktakes', 'source_type', 'stocktakes.source_type exists');
select has_column('public', 'stocktake_items', 'difference_qty', 'stocktake_items.difference_qty exists');
select has_index('public', 'stock_movements', 'idx_stock_movements_product_time', 'stock movements has product/time index');
select has_index('public', 'stock_movements', 'idx_stock_movements_order_item', 'stock movements has order item index');

select has_table('public', 'finance_accounts', 'finance_accounts table exists');
select has_table('public', 'payment_receipts', 'payment_receipts table exists');
select has_table('public', 'payment_receipt_methods', 'payment_receipt_methods table exists');
select has_table('public', 'customer_debt_entries', 'customer_debt_entries table exists');
select has_table('public', 'customer_debt_allocations', 'customer_debt_allocations table exists');
select has_table('public', 'cashbook_vouchers', 'cashbook_vouchers table exists');
select has_table('public', 'cashbook_entries', 'cashbook_entries table exists');
select has_table('public', 'cash_reconciliations', 'cash_reconciliations table exists');
select has_table('public', 'cash_reconciliation_items', 'cash_reconciliation_items table exists');

select has_column('public', 'finance_accounts', 'account_type', 'finance_accounts.account_type exists');
select has_column('public', 'payment_receipts', 'receipt_type', 'payment_receipts.receipt_type exists');
select has_column('public', 'payment_receipts', 'sale_payment_amount', 'payment_receipts.sale_payment_amount exists');
select has_column('public', 'payment_receipts', 'debt_collection_amount', 'payment_receipts.debt_collection_amount exists');
select has_column('public', 'payment_receipt_methods', 'finance_account_id', 'payment_receipt_methods.finance_account_id exists');
select has_column('public', 'payment_receipt_methods', 'method_type', 'payment_receipt_methods.method_type exists');
select has_column('public', 'customer_debt_entries', 'balance_after_order', 'customer_debt_entries.balance_after_order exists');
select has_column('public', 'customer_debt_allocations', 'order_debt_before', 'customer_debt_allocations.order_debt_before exists');
select has_column('public', 'cashbook_entries', 'source_type', 'cashbook_entries.source_type exists');
select has_column('public', 'cashbook_entries', 'amount_delta', 'cashbook_entries.amount_delta exists');
select has_column('public', 'cashbook_entries', 'is_business_accounted', 'cashbook_entries.is_business_accounted exists');
select has_column('public', 'cashbook_vouchers', 'is_business_accounted', 'cashbook_vouchers.is_business_accounted exists');
select has_column('public', 'cashbook_vouchers', 'counterparty_type', 'cashbook_vouchers.counterparty_type exists');
select has_column('public', 'cashbook_vouchers', 'counterparty_name', 'cashbook_vouchers.counterparty_name exists');
select has_column('public', 'cashbook_vouchers', 'counterparty_phone', 'cashbook_vouchers.counterparty_phone exists');

select results_eq(
  $$ select count(*)::integer from public.permissions where code = 'perm.manage_finance' $$,
  array[1],
  'manage finance permission is seeded'
);

select results_eq(
  $$ select count(*)::integer from information_schema.check_constraints
     where constraint_name = 'orders_revision_code_check' $$,
  array[1],
  'invoice revision code check exists'
);

select results_eq(
  $$ select count(*)::integer from information_schema.check_constraints
     where constraint_name = 'stock_movements_inventory_object_check' $$,
  array[1],
  'stock movement object check exists'
);

select results_eq(
  $$ select count(*)::integer from information_schema.check_constraints
     where constraint_name = 'payment_receipt_methods_method_account_check' $$,
  array[1],
  'payment method account check exists'
);

select results_eq(
  $$ select count(*)::integer from public.finance_accounts where code = 'CASH' and account_type = 'cash' $$,
  array[1],
  'default cash account is seeded'
);

select results_eq(
  $$ select count(*)::integer from public.finance_accounts where code = 'MB01' and account_type = 'bank' $$,
  array[1],
  'seed bank account is available'
);

select has_function(
  'public',
  'adjust_normal_product_stock_tx',
  array['uuid', 'uuid', 'uuid', 'numeric', 'text'],
  'normal product stock adjustment rpc exists'
);

select * from finish();
rollback;
