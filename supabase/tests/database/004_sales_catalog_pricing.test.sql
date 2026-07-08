begin;

select plan(59);

select has_table('public', 'products', 'products table exists');
select has_column('public', 'products', 'organization_id', 'products.organization_id exists');
select has_column('public', 'products', 'code', 'products.code exists');
select has_column('public', 'products', 'name', 'products.name exists');
select has_column('public', 'products', 'status', 'products.status exists');
select has_column('public', 'products', 'unit_name', 'products.unit_name exists');
select has_column('public', 'products', 'sell_method', 'products.sell_method exists');
select has_column('public', 'products', 'latest_purchase_cost', 'products.latest_purchase_cost exists');
select has_column('public', 'products', 'latest_purchase_cost_at', 'products.latest_purchase_cost_at exists');
select has_column('public', 'products', 'latest_purchase_cost_updated_by', 'products.latest_purchase_cost_updated_by exists');
select col_not_null('public', 'products', 'organization_id', 'products.organization_id is not null');
select col_not_null('public', 'products', 'code', 'products.code is not null');
select col_not_null('public', 'products', 'name', 'products.name is not null');
select col_not_null('public', 'products', 'status', 'products.status is not null');
select col_not_null('public', 'products', 'unit_name', 'products.unit_name is not null');
select col_not_null('public', 'products', 'sell_method', 'products.sell_method is not null');
select col_is_null('public', 'products', 'latest_purchase_cost', 'products.latest_purchase_cost can be missing before purchase data');
select col_is_null('public', 'products', 'latest_purchase_cost_at', 'products.latest_purchase_cost_at can be missing before purchase data');
select has_index('public', 'products', 'idx_products_org_status', 'products has organization/status index');
select has_index('public', 'products', 'idx_products_org_code', 'products has organization/code index');
select has_index('public', 'products', 'idx_products_org_name', 'products has organization/name index');

select has_table('public', 'price_lists', 'price_lists table exists');
select has_column('public', 'price_lists', 'organization_id', 'price_lists.organization_id exists');
select has_column('public', 'price_lists', 'code', 'price_lists.code exists');
select has_column('public', 'price_lists', 'name', 'price_lists.name exists');
select has_column('public', 'price_lists', 'is_default', 'price_lists.is_default exists');
select has_column('public', 'price_lists', 'is_active', 'price_lists.is_active exists');
select col_not_null('public', 'price_lists', 'organization_id', 'price_lists.organization_id is not null');
select col_not_null('public', 'price_lists', 'code', 'price_lists.code is not null');
select col_not_null('public', 'price_lists', 'name', 'price_lists.name is not null');
select col_not_null('public', 'price_lists', 'is_default', 'price_lists.is_default is not null');
select col_not_null('public', 'price_lists', 'is_active', 'price_lists.is_active is not null');
select has_index('public', 'price_lists', 'idx_price_lists_org_active', 'price_lists has organization/active index');
select has_index('public', 'price_lists', 'idx_price_lists_org_default', 'price_lists has organization/default index');

select has_table('public', 'price_list_items', 'price_list_items table exists');
select has_column('public', 'price_list_items', 'organization_id', 'price_list_items.organization_id exists');
select has_column('public', 'price_list_items', 'price_list_id', 'price_list_items.price_list_id exists');
select has_column('public', 'price_list_items', 'product_id', 'price_list_items.product_id exists');
select has_column('public', 'price_list_items', 'unit_price', 'price_list_items.unit_price exists');
select has_column('public', 'price_list_items', 'pricing_mode', 'price_list_items.pricing_mode exists');
select has_column('public', 'price_list_items', 'formula_rule_id', 'price_list_items.formula_rule_id exists');
select col_not_null('public', 'price_list_items', 'organization_id', 'price_list_items.organization_id is not null');
select col_not_null('public', 'price_list_items', 'price_list_id', 'price_list_items.price_list_id is not null');
select col_not_null('public', 'price_list_items', 'product_id', 'price_list_items.product_id is not null');
select has_index('public', 'price_list_items', 'idx_price_list_items_list_product', 'price_list_items has list/product index');
select has_index('public', 'price_list_items', 'idx_price_list_items_product', 'price_list_items has product index');

select has_table('public', 'price_formula_rules', 'price_formula_rules table exists');
select has_column('public', 'price_formula_rules', 'organization_id', 'price_formula_rules.organization_id exists');
select has_column('public', 'price_formula_rules', 'name', 'price_formula_rules.name exists');
select has_column('public', 'price_formula_rules', 'product_filter', 'price_formula_rules.product_filter exists');
select has_column('public', 'price_formula_rules', 'cost_formula', 'price_formula_rules.cost_formula exists');
select has_column('public', 'price_formula_rules', 'profit_formula', 'price_formula_rules.profit_formula exists');
select has_column('public', 'price_formula_rules', 'price_list_adjustments', 'price_formula_rules.price_list_adjustments exists');
select has_column('public', 'price_formula_rules', 'is_active', 'price_formula_rules.is_active exists');
select has_column('public', 'price_formula_rules', 'created_by', 'price_formula_rules.created_by exists');
select has_column('public', 'price_formula_rules', 'updated_by', 'price_formula_rules.updated_by exists');
select has_index('public', 'price_formula_rules', 'idx_price_formula_rules_org_active', 'price_formula_rules has organization/active index');

select has_function(
  'public',
  'apply_price_formula_tx',
  array['uuid', 'uuid', 'jsonb', 'jsonb'],
  'price formula apply transaction rpc exists'
);

select results_eq(
  $$ select count(*)::integer from public.permissions where code = 'perm.edit_price_book' $$,
  array[1],
  'edit price book permission is seeded'
);

select finish();
rollback;
