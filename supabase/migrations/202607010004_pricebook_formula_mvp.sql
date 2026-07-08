alter table public.products
  add column if not exists latest_purchase_cost numeric(12,0),
  add column if not exists latest_purchase_cost_at timestamptz,
  add column if not exists latest_purchase_cost_updated_by uuid references public.profiles(user_id) on delete set null;

alter table public.products
  drop constraint if exists products_latest_purchase_cost_check;

alter table public.products
  add constraint products_latest_purchase_cost_check check (
    latest_purchase_cost is null or latest_purchase_cost >= 0
  );

create table if not exists public.price_formula_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  product_filter jsonb not null default '{}'::jsonb,
  cost_formula jsonb not null,
  profit_formula jsonb not null,
  price_list_adjustments jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_formula_rules_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint price_formula_rules_product_filter_object_check check (jsonb_typeof(product_filter) = 'object'),
  constraint price_formula_rules_cost_formula_object_check check (jsonb_typeof(cost_formula) = 'object'),
  constraint price_formula_rules_profit_formula_object_check check (jsonb_typeof(profit_formula) = 'object'),
  constraint price_formula_rules_adjustments_object_check check (jsonb_typeof(price_list_adjustments) = 'object')
);

create index if not exists idx_price_formula_rules_org_active
  on public.price_formula_rules (organization_id, is_active);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_price_formula_rules_updated_at'
  ) then
    create trigger set_price_formula_rules_updated_at
    before update on public.price_formula_rules
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.price_formula_rules enable row level security;

grant select, insert, update, delete on public.price_formula_rules to service_role;

alter table public.price_list_items
  add column if not exists pricing_mode text not null default 'manual',
  add column if not exists formula_rule_id uuid references public.price_formula_rules(id) on delete set null;

alter table public.price_list_items
  alter column unit_price drop not null;

alter table public.price_list_items
  drop constraint if exists price_list_items_unit_price_check,
  drop constraint if exists price_list_items_pricing_mode_check,
  drop constraint if exists price_list_items_price_mode_value_check;

alter table public.price_list_items
  add constraint price_list_items_pricing_mode_check check (pricing_mode in ('manual', 'formula')),
  add constraint price_list_items_price_mode_value_check check (
    (
      pricing_mode = 'manual'
      and unit_price is not null
      and unit_price >= 0
    )
    or (
      pricing_mode = 'formula'
      and formula_rule_id is not null
    )
  );

create or replace function public.apply_price_formula_tx(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_formula jsonb,
  p_selected_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule_id uuid;
  v_affected_count integer := 0;
begin
  if p_formula is null or jsonb_typeof(p_formula) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_selected_items is null or jsonb_typeof(p_selected_items) <> 'array' or jsonb_array_length(p_selected_items) = 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  insert into public.price_formula_rules (
    organization_id,
    name,
    product_filter,
    cost_formula,
    profit_formula,
    price_list_adjustments,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_formula->>'name',
    coalesce(p_formula->'product_filter', '{}'::jsonb),
    p_formula->'cost_formula',
    p_formula->'profit_formula',
    coalesce(p_formula->'price_list_adjustments', '{}'::jsonb),
    p_actor_user_id,
    p_actor_user_id
  )
  returning id into v_rule_id;

  with selected_items as (
    select distinct
      (item->>'product_id')::uuid as product_id,
      (item->>'price_list_id')::uuid as price_list_id
    from jsonb_array_elements(p_selected_items) as item
  ),
  upserted as (
    insert into public.price_list_items (
      organization_id,
      product_id,
      price_list_id,
      unit_price,
      pricing_mode,
      formula_rule_id
    )
    select
      p_organization_id,
      product_id,
      price_list_id,
      null,
      'formula',
      v_rule_id
    from selected_items
    on conflict (price_list_id, product_id)
    do update set
      unit_price = null,
      pricing_mode = 'formula',
      formula_rule_id = excluded.formula_rule_id,
      updated_at = now()
    returning 1
  )
  select count(*) into v_affected_count from upserted;

  return jsonb_build_object(
    'formula_rule_id', v_rule_id,
    'affected_count', v_affected_count
  );
end;
$$;

grant execute on function public.apply_price_formula_tx(uuid, uuid, jsonb, jsonb) to service_role;
