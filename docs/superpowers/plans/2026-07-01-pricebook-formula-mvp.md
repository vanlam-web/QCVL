# PriceBook Formula MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first persisted PriceBook formula slice where price list cells can be manual or formula-driven from `products.latest_purchase_cost`.

**Architecture:** Add schema support for latest purchase cost, formula rules, and formula-backed price list items. Keep formula evaluation in backend helper functions so `/pricing/resolve`, preview, and apply use the same rounding and tier rules. Extend the existing catalog/price-book page into a compact operational grid instead of introducing a separate module.

**Tech Stack:** Supabase Postgres migrations/RPC-style repository access, Deno Edge Function API, React/Vite frontend, Vitest, Deno tests, pgTAP.

---

## Source Of Truth

- Remote spec branch: `origin/codex/spec-purchase-supplier-bom`
- Head includes: `20d6fe5 docs: specify pricebook formula implementation scope`
- Key docs:
  - `docs/02-PRD-UX-PhongCanh/PriceBook/01-PRICE-LIST.md`
  - `docs/02-PRD-UX-PhongCanh/PriceBook/02-PRICE-LIST-DETAIL.md`
  - `docs/04-DATABASE/Sales/POS-TABLES.md`
  - `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`

## Scope

In:
- `products.latest_purchase_cost`, `products.latest_purchase_cost_at`, `products.latest_purchase_cost_updated_by`.
- `price_formula_rules` persisted structured rules; first slice filters only `name_contains`, `code_contains`, `sell_method`, and active products. No product group schema/filter.
- `price_list_items.pricing_mode` and `formula_rule_id`.
- Backend formula evaluation using latest purchase cost only.
- Backend rounding up to 1,000 VND.
- Backend tier overlap validation; gaps allowed with unmatched profit = 0.
- `POST /api/v1/price-lists/formulas/preview`.
- `POST /api/v1/price-lists/formulas/apply`.
- `/pricing/resolve` returns formula prices dynamically.
- PriceBook page shows active price lists dynamically and a minimal formula workflow.

Out:
- Average cost selector.
- Free-form Excel expression editor.
- Multiple rounding options.
- Full Purchase/Supplier receipt UI.
- Auto-creating missing `25/26/30/35/40` price lists.

---

## Task 1: Schema And DB Tests

**Files:**
- Modify: `supabase/migrations/202606300001_sales_catalog_pricing.sql`
- Create: `supabase/migrations/202607010004_pricebook_formula_mvp.sql`
- Modify: `supabase/tests/database/004_sales_catalog_pricing.test.sql`

- [x] **Step 1: Write failing DB tests**

Add assertions to `supabase/tests/database/004_sales_catalog_pricing.test.sql`:

```sql
select plan(62);

select has_column('public', 'products', 'latest_purchase_cost', 'products.latest_purchase_cost exists');
select has_column('public', 'products', 'latest_purchase_cost_at', 'products.latest_purchase_cost_at exists');
select has_column('public', 'products', 'latest_purchase_cost_updated_by', 'products.latest_purchase_cost_updated_by exists');
select col_is_null('public', 'products', 'latest_purchase_cost', 'products.latest_purchase_cost can be missing before purchase data');
select col_is_null('public', 'products', 'latest_purchase_cost_at', 'products.latest_purchase_cost_at can be missing before purchase data');

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

select has_column('public', 'price_list_items', 'pricing_mode', 'price_list_items.pricing_mode exists');
select has_column('public', 'price_list_items', 'formula_rule_id', 'price_list_items.formula_rule_id exists');
```

Update the plan count from `41` to `62`. Keep existing assertions.

- [x] **Step 2: Run DB tests and verify RED**

Run:

```bash
npm run test:db
```

Expected: FAIL because the new columns/table do not exist.

- [x] **Step 3: Add base migration changes**

Modify `supabase/migrations/202606300001_sales_catalog_pricing.sql`:

```sql
alter table public.products add column latest_purchase_cost numeric(12,0);
alter table public.products add column latest_purchase_cost_at timestamptz;
alter table public.products add column latest_purchase_cost_updated_by uuid references public.profiles(user_id) on delete set null;
alter table public.products add constraint products_latest_purchase_cost_check check (
  latest_purchase_cost is null or latest_purchase_cost >= 0
);

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

create index idx_price_formula_rules_org_active on public.price_formula_rules (organization_id, is_active);

alter table public.price_list_items
  add column pricing_mode text not null default 'manual',
  add column formula_rule_id uuid references public.price_formula_rules(id) on delete set null,
  alter column unit_price drop not null,
  drop constraint price_list_items_unit_price_check,
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
```

Add trigger and grants:

```sql
create trigger set_price_formula_rules_updated_at
before update on public.price_formula_rules
for each row execute function public.set_updated_at();

alter table public.price_formula_rules enable row level security;

grant select, insert, update, delete on
  public.price_formula_rules
to service_role;
```

- [x] **Step 4: Add forward migration**

Create `supabase/migrations/202607010004_pricebook_formula_mvp.sql` with additive/compatible changes:

```sql
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
```

- [x] **Step 5: Run DB tests and verify GREEN**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: PASS.

- [x] **Step 6: Commit Task 1**

```bash
git add supabase/migrations/202606300001_sales_catalog_pricing.sql supabase/migrations/202607010004_pricebook_formula_mvp.sql supabase/tests/database/004_sales_catalog_pricing.test.sql
git commit -m "feat: add price formula schema"
```

---

## Task 2: Formula Evaluation Helpers

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/tests/functions/price_formula_test.ts`

- [x] **Step 1: Write failing helper tests**

Create `supabase/tests/functions/price_formula_test.ts`:

```ts
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  computeFormulaPrice,
  validatePriceFormula,
} from "../../functions/api/repositories/foundation-repository.ts";

Deno.test("formula rounds final prices up to 1000 VND", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: 100001,
    costFormula: { type: "amount_plus_percent", amount: 5000, percent_of_latest_purchase_cost: 8 },
    profitFormula: { type: "fixed", amount: 25000 },
    priceListAdjustment: { type: "amount", amount: 20000 },
  });

  assertEquals(result, {
    latest_purchase_cost: 100001,
    cost_amount: 13001,
    profit_amount: 25000,
    adjustment_amount: 20000,
    computed_price: 159000,
  });
});

Deno.test("formula treats missing latest purchase cost as zero", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: null,
    costFormula: { type: "fixed", amount: 5000 },
    profitFormula: { type: "tiers", tiers: [{ operator: ">", value: 100000, amount: 40000 }] },
    priceListAdjustment: { type: "percent", percent: 10 },
  });

  assertEquals(result.computed_price, 6000);
});

Deno.test("profit tiers are evaluated top-down and gaps are allowed", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: 150000,
    costFormula: { type: "fixed", amount: 0 },
    profitFormula: {
      type: "tiers",
      tiers: [
        { operator: "<=", value: 100000, amount: 25000 },
        { operator: ">", value: 200000, amount: 60000 },
      ],
    },
    priceListAdjustment: { type: "amount", amount: 0 },
  });

  assertEquals(result.profit_amount, 0);
  assertEquals(result.computed_price, 150000);
});

Deno.test("formula validation blocks obvious overlapping tiers", () => {
  assertThrows(
    () =>
      validatePriceFormula({
        name: "Overlap",
        product_filter: {},
        cost_formula: { type: "fixed", amount: 0 },
        profit_formula: {
          type: "tiers",
          tiers: [
            { operator: "<=", value: 100000, amount: 25000 },
            { operator: "<", value: 120000, amount: 30000 },
          ],
        },
        price_list_adjustments: {},
      }),
    Error,
    "FORMULA_TIER_OVERLAP",
  );
});
```

- [x] **Step 2: Run helper tests and verify RED**

Run:

```bash
npx deno test supabase/tests/functions/price_formula_test.ts --allow-env --allow-net
```

Expected: FAIL because helper functions do not exist.

- [x] **Step 3: Add helper types and implementation**

In `supabase/functions/api/contracts.ts`, add `price_formula` sources:

```ts
export type PriceSource =
  | "default_price_list"
  | "customer_group_price_list"
  | "fallback_default_price_list"
  | "latest_purchase_cost"
  | "latest_purchase_cost_missing_zero"
  | "price_formula"
  | "price_formula_missing_cost_zero";
```

In `supabase/functions/api/repositories/foundation-repository.ts`, export helpers:

```ts
type CostFormula = { type: "fixed"; amount: number } | {
  type: "amount_plus_percent";
  amount?: number;
  percent_of_latest_purchase_cost?: number;
};

type ProfitTier =
  | { operator: "<" | "<=" | ">" | ">=" | "="; value: number; amount?: number; percent?: number }
  | { from_exclusive?: number; from_inclusive?: number; to_exclusive?: number; to_inclusive?: number; amount?: number; percent?: number };

type ProfitFormula = { type: "fixed"; amount: number } | { type: "tiers"; tiers: ProfitTier[] };
type PriceListAdjustment = { type: "amount"; amount: number } | { type: "percent"; percent: number };

export function computeFormulaPrice(input: {
  latestPurchaseCost: number | null;
  costFormula: CostFormula;
  profitFormula: ProfitFormula;
  priceListAdjustment?: PriceListAdjustment;
}): {
  latest_purchase_cost: number;
  cost_amount: number;
  profit_amount: number;
  adjustment_amount: number;
  computed_price: number;
} {
  const latest = input.latestPurchaseCost ?? 0;
  const costAmount = computeCost(input.costFormula, latest);
  const profitAmount = computeProfit(input.profitFormula, latest);
  const beforeAdjustment = latest + costAmount + profitAmount;
  const adjustmentAmount = computeAdjustment(input.priceListAdjustment, beforeAdjustment);
  return {
    latest_purchase_cost: latest,
    cost_amount: costAmount,
    profit_amount: profitAmount,
    adjustment_amount: adjustmentAmount,
    computed_price: roundUpToThousand(beforeAdjustment + adjustmentAmount),
  };
}
```

Add internal `computeCost`, `computeProfit`, `computeAdjustment`, `roundUpToThousand`, `validatePriceFormula`, and tier interval overlap helpers.

- [x] **Step 4: Run helper tests and verify GREEN**

Run:

```bash
npx deno test supabase/tests/functions/price_formula_test.ts --allow-env --allow-net
```

Expected: PASS.

- [x] **Step 5: Commit Task 2**

```bash
git add supabase/functions/api/contracts.ts supabase/functions/api/repositories/foundation-repository.ts supabase/tests/functions/price_formula_test.ts
git commit -m "feat: add price formula evaluator"
```

---

## Task 3: Backend API Preview And Apply

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `supabase/functions/api/routes/catalog.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/tests/functions/catalog_test.ts`

- [x] **Step 1: Write failing route tests**

Add to `supabase/tests/functions/catalog_test.ts`:

```ts
Deno.test("price formula preview requires edit_price_book and returns computed rows", async () => {
  const response = await call(
    "/api/v1/price-lists/formulas/preview",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Fomex",
        product_filter: { name_contains: "Mica" },
        cost_formula: { type: "fixed", amount: 5000 },
        profit_formula: { type: "fixed", amount: 25000 },
        price_list_adjustments: { "pl-1": { type: "amount", amount: 20000 } },
      }),
    },
    repo(["perm.edit_price_book"], {
      previewPriceFormula: () => Promise.resolve({
        affected_count: 1,
        items: [
          {
            product_id: "p-1",
            product_code: "MICA-3MM",
            product_name: "Mica 3mm",
            latest_purchase_cost: 100000,
            current_mode: "manual",
            current_unit_price: 120000,
            computed_prices: [
              {
                price_list_id: "pl-1",
                price_list_name: "Bảng giá chung",
                current_unit_price: 120000,
                computed_unit_price: 150000,
                delta: 30000,
              },
            ],
          },
        ],
      }),
    }),
  );

  assertEquals(response.status, 200);
  const body = await data(response) as { affected_count: number };
  assertEquals(body.affected_count, 1);
});

Deno.test("price formula apply persists selected formula cells", async () => {
  let applied = false;
  const response = await call(
    "/api/v1/price-lists/formulas/apply",
    {
      method: "POST",
      body: JSON.stringify({
        formula: {
          name: "Fomex",
          product_filter: {},
          cost_formula: { type: "fixed", amount: 5000 },
          profit_formula: { type: "fixed", amount: 25000 },
          price_list_adjustments: { "pl-1": { type: "amount", amount: 20000 } },
        },
        selected_items: [{ product_id: "p-1", price_list_id: "pl-1" }],
      }),
    },
    repo(["perm.edit_price_book"], {
      applyPriceFormula: () => {
        applied = true;
        return Promise.resolve({ formula_rule_id: "rule-1", affected_count: 1 });
      },
    }),
  );

  assertEquals(response.status, 200);
  assert(applied, "formula should be applied through repository");
});
```

- [x] **Step 2: Run route tests and verify RED**

Run:

```bash
npx deno test supabase/tests/functions/catalog_test.ts --allow-env --allow-net
```

Expected: FAIL with 404 or missing repository methods.

- [x] **Step 3: Extend contracts and use-cases**

Add repository methods to `FoundationRepository`:

```ts
previewPriceFormula(input: {
  organizationId: string;
  formula: Record<string, unknown>;
}): Promise<PriceFormulaPreviewData>;

applyPriceFormula(input: {
  organizationId: string;
  actorUserId: string;
  formula: Record<string, unknown>;
  selectedItems: Array<{ product_id: string; price_list_id: string }>;
}): Promise<{ formula_rule_id: string; affected_count: number }>;
```

Add `previewPriceFormula` and `applyPriceFormula` use-cases requiring `perm.edit_price_book`, parsing JSON and calling `validatePriceFormula`.

- [x] **Step 4: Add routes**

In `supabase/functions/api/routes/catalog.ts`, pass `actorUserId` into catalog context and add:

```ts
if (url.pathname === "/api/v1/price-lists/formulas/preview" && request.method === "POST") {
  return successResponse(await previewPriceFormula(dependencies.repository, context, await request.json()), traceId);
}

if (url.pathname === "/api/v1/price-lists/formulas/apply" && request.method === "POST") {
  return successResponse(await applyPriceFormula(dependencies.repository, context, await request.json()), traceId);
}
```

- [x] **Step 5: Implement repository preview/apply**

In `foundation-repository.ts`:
- `previewPriceFormula` loads active products matching filter and active price lists.
- `applyPriceFormula` inserts one `price_formula_rules` row and upserts selected `price_list_items` as `pricing_mode = 'formula'`, `formula_rule_id = new rule`.
- Apply returns affected count.

- [x] **Step 6: Run function tests**

Run:

```bash
npm run test:functions
npx deno check supabase/functions/api/index.ts
```

Expected: PASS.

- [x] **Step 7: Commit Task 3**

```bash
git add supabase/functions/api supabase/tests/functions/catalog_test.ts
git commit -m "feat: add price formula api"
```

---

## Task 4: Dynamic Formula Price Resolve

**Files:**
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/tests/functions/pricing_resolution_test.ts`

- [x] **Step 1: Write failing resolve tests**

Add to `pricing_resolution_test.ts`:

```ts
Deno.test("price resolution uses formula mode over manual unit price", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: null,
    priceRows: [
      {
        product_id: "p-1",
        price_list_id: "pl-default",
        unit_price: null,
        pricing_mode: "formula",
        formula_rule_id: "rule-1",
      },
    ],
    latestPurchaseCosts: new Map([["p-1", 100000]]),
    formulaRules: new Map([[
      "rule-1",
      {
        cost_formula: { type: "fixed", amount: 5000 },
        profit_formula: { type: "fixed", amount: 25000 },
        price_list_adjustments: { "pl-default": { type: "amount", amount: 20000 } },
      },
    ]]),
  });

  assertEquals(items[0].unit_price, 150000);
  assertEquals(items[0].price_source, "price_formula");
});
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
npx deno test supabase/tests/functions/pricing_resolution_test.ts --allow-env --allow-net
```

Expected: FAIL because `resolvePriceRows` does not accept formula rows.

- [x] **Step 3: Update resolver**

Update `PriceRow` to include:

```ts
unit_price: number | string | null;
pricing_mode?: "manual" | "formula";
formula_rule_id?: string | null;
```

Update price item query:

```ts
.select("product_id, unit_price, price_list_id, pricing_mode, formula_rule_id, price_formula_rules(cost_formula, profit_formula, price_list_adjustments)")
```

When `pricing_mode = 'formula'`, call `computeFormulaPrice` using product latest purchase cost and the row formula. Return:
- `price_formula` if latest cost exists.
- `price_formula_missing_cost_zero` if latest cost is missing.

- [x] **Step 4: Run resolver/function tests**

Run:

```bash
npx deno test supabase/tests/functions/pricing_resolution_test.ts --allow-env --allow-net
npm run test:functions
```

Expected: PASS.

- [x] **Step 5: Commit Task 4**

```bash
git add supabase/functions/api/repositories/foundation-repository.ts supabase/tests/functions/pricing_resolution_test.ts
git commit -m "feat: resolve formula prices dynamically"
```

---

## Task 5: Frontend PriceBook Grid

**Files:**
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `src/styles/index.css`

- [x] **Step 1: Write failing UI tests**

Add to `CatalogPage.test.tsx`:

```ts
it('shows dynamic price list columns and previews formula results', async () => {
  const service = makeService({
    listPriceLists: vi.fn(async () => ({
      items: [
        { id: 'pl-default', code: 'DEFAULT', name: 'Bảng giá chung', is_default: true, is_active: true },
        { id: 'pl-25', code: '25', name: '25', is_default: false, is_active: true },
      ],
    })),
    previewPriceFormula: vi.fn(async () => ({
      affected_count: 1,
      items: [
        {
          product_id: 'p-1',
          product_code: 'MICA-3MM',
          product_name: 'Mica 3mm',
          latest_purchase_cost: 100000,
          current_mode: 'manual',
          current_unit_price: 120000,
          computed_prices: [
            { price_list_id: 'pl-default', price_list_name: 'Bảng giá chung', current_unit_price: 120000, computed_unit_price: 150000, delta: 30000 },
          ],
        },
      ],
    })),
  });

  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />);

  expect(await screen.findByText('Bảng giá chung')).toBeInTheDocument();
  expect(screen.getByText('25')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Tạo công thức cho bộ lọc này' }));
  await userEvent.type(screen.getByLabelText('Tên công thức'), 'Fomex');
  await userEvent.type(screen.getByLabelText('Chi phí cố định'), '5000');
  await userEvent.type(screen.getByLabelText('Lợi nhuận cố định'), '25000');
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }));

  expect(await screen.findByText('150.000')).toBeInTheDocument();
});
```

- [x] **Step 2: Run UI tests and verify RED**

Run:

```bash
npx vitest run src/features/catalog/CatalogPage.test.tsx
```

Expected: FAIL because services/UI methods do not exist.

- [x] **Step 3: Extend frontend service/types**

Add `PriceList`, `PriceFormulaPreview`, `PriceFormulaInput`, `FormulaApplyResult` to `src/features/catalog/types.ts`.

Add methods to `createCatalogService`:

```ts
listPriceLists: () => api.request<PriceListResponse>('/api/v1/price-lists')
previewPriceFormula: (input: PriceFormulaInput) =>
  api.request<PriceFormulaPreview>('/api/v1/price-lists/formulas/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  })
applyPriceFormula: (input: { formula: PriceFormulaInput; selected_items: Array<{ product_id: string; price_list_id: string }> }) =>
  api.request<FormulaApplyResult>('/api/v1/price-lists/formulas/apply', {
    method: 'POST',
    body: JSON.stringify(input),
  })
```

- [x] **Step 4: Implement minimal grid UI**

In `CatalogPage.tsx`:
- Load `listPriceLists()` alongside products.
- Show product columns: `Mã hàng`, `Tên hàng`, `Giá nhập cuối`, dynamic price list names.
- Add a compact formula panel with:
  - `Tên công thức`
  - `Chi phí cố định`
  - `Lợi nhuận cố định`
  - `Xem trước`
  - `Áp dụng công thức`
- Preview renders computed prices.
- Apply sends all previewed product/price list pairs.

- [x] **Step 5: Run UI tests**

Run:

```bash
npx vitest run src/features/catalog/CatalogPage.test.tsx
npm test
```

Expected: PASS.

- [x] **Step 6: Commit Task 5**

```bash
git add src/features/catalog src/styles/index.css
git commit -m "feat: add price formula grid"
```

---

## Task 6: Final Verification, PR, Deploy, Smoke

**Files:**
- No new files unless verification reveals defects.

- [x] **Step 1: Run full verification**

Run:

```bash
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npx deno check supabase/functions/api/index.ts
npm run supabase:reset
npm run test:db
```

Expected: all pass. `npm run build` may keep the existing Vite chunk warning only.

- [ ] **Step 2: Push and create PR**

Run:

```bash
git push -u origin codex/pricebook-formula-mvp
```

Create PR title:

```text
feat: add pricebook formula mvp
```

PR summary:

```md
## Summary
- Add persisted PriceBook formula schema and formula-backed price list cells.
- Add preview/apply APIs and dynamic formula price resolution from latest purchase cost.
- Extend PriceBook UI with active price list grid and simple formula preview/apply controls.

## Verification
- git diff --check
- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run test:functions
- npx deno check supabase/functions/api/index.ts
- npm run supabase:reset
- npm run test:db
```

- [ ] **Step 3: Merge after checks**

Wait for GitHub checks. Merge only if checks pass and there are no conflicts.

- [ ] **Step 4: Deploy Cloud**

After merge:

```bash
git switch main
git pull --ff-only origin main
npx supabase db push --linked --yes
npx supabase functions deploy api --project-ref yentlbgbtmumilbzttge --use-api
```

- [ ] **Step 5: Cloud smoke**

Smoke:
- `GET /api/v1/me`
- `GET /api/v1/price-lists`
- `POST /api/v1/price-lists/formulas/preview`
- `POST /api/v1/price-lists/formulas/apply`
- `POST /api/v1/pricing/resolve` confirms `price_formula` or `price_formula_missing_cost_zero`.
- UI `/products` shows formula panel and preview.

---

## Self-Review

- Spec coverage: schema, latest purchase cost, structured formulas, preview/apply, dynamic price resolution, rounding, tier validation, dynamic price list columns, and manual/formula mode are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: backend uses snake_case API payload fields; frontend maps these as typed objects matching the existing API style.
