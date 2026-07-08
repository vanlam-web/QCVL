alter table public.order_items
  drop constraint if exists order_items_price_source_check;

alter table public.order_items
  add constraint order_items_price_source_check check (
    price_source in (
      'customer_group',
      'customer_group_price_list',
      'default_price_list',
      'fallback_default_price_list',
      'latest_purchase_cost',
      'latest_purchase_cost_missing_zero',
      'manual'
    )
  );
