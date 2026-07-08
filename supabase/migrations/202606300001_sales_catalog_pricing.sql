create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active',
  unit_name text not null,
  sell_method text not null,
  latest_purchase_cost numeric(12,0),
  latest_purchase_cost_at timestamptz,
  latest_purchase_cost_updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_org_code_key unique (organization_id, code),
  constraint products_id_org_key unique (id, organization_id),
  constraint products_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint products_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint products_status_check check (status in ('active', 'inactive')),
  constraint products_unit_name_check check (char_length(btrim(unit_name)) between 1 and 30),
  constraint products_sell_method_check check (
    sell_method in ('quantity', 'area_m2', 'linear_m', 'sheet', 'combo')
  ),
  constraint products_latest_purchase_cost_check check (
    latest_purchase_cost is null or latest_purchase_cost >= 0
  )
);

create index idx_products_org_status on public.products (organization_id, status);
create index idx_products_org_code on public.products (organization_id, code);
create index idx_products_org_name on public.products (organization_id, name);

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_lists_org_code_key unique (organization_id, code),
  constraint price_lists_id_org_key unique (id, organization_id),
  constraint price_lists_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint price_lists_name_check check (char_length(btrim(name)) between 1 and 120)
);

create unique index price_lists_one_active_default_per_org
  on public.price_lists (organization_id)
  where is_default = true and is_active = true;

create index idx_price_lists_org_active on public.price_lists (organization_id, is_active);
create index idx_price_lists_org_default on public.price_lists (organization_id, is_default);

create table public.price_formula_rules (
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

create index idx_price_formula_rules_org_active
  on public.price_formula_rules (organization_id, is_active);

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  price_list_id uuid not null,
  product_id uuid not null,
  unit_price numeric(12,0),
  pricing_mode text not null default 'manual',
  formula_rule_id uuid references public.price_formula_rules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_items_list_product_key unique (price_list_id, product_id),
  constraint price_list_items_price_list_org_fkey foreign key (price_list_id, organization_id)
    references public.price_lists(id, organization_id) on delete cascade,
  constraint price_list_items_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint price_list_items_pricing_mode_check check (pricing_mode in ('manual', 'formula')),
  constraint price_list_items_price_mode_value_check check (
    (
      pricing_mode = 'manual'
      and unit_price is not null
      and unit_price >= 0
    )
    or (
      pricing_mode = 'formula'
      and formula_rule_id is not null
    )
  )
);

create index idx_price_list_items_list_product on public.price_list_items (price_list_id, product_id);
create index idx_price_list_items_product on public.price_list_items (organization_id, product_id);

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_price_lists_updated_at
before update on public.price_lists
for each row execute function public.set_updated_at();

create trigger set_price_formula_rules_updated_at
before update on public.price_formula_rules
for each row execute function public.set_updated_at();

create trigger set_price_list_items_updated_at
before update on public.price_list_items
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_formula_rules enable row level security;
alter table public.price_list_items enable row level security;

grant select, insert, update, delete on
  public.products,
  public.price_lists,
  public.price_formula_rules,
  public.price_list_items
to service_role;
