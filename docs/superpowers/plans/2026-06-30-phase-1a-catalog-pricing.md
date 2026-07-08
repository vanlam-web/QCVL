# Phase 1A Catalog Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Sales catalog slice: product admin, default price lists, active POS product grid, and price resolution without reintroducing workstation login or legacy discount models.

**Architecture:** Keep the existing Phase 0 foundation intact and add a focused Sales catalog/pricing boundary. Supabase migrations own durable schema and seed permissions, Edge Function routes enforce account permissions and organization scope, and React pages consume typed services through the existing API client.

**Tech Stack:** Supabase/Postgres migrations and pgTAP, Deno Edge Functions with zod-style validation patterns already present in the repo, React/Vite/TypeScript, Vitest, Playwright.

---

## Scope Lock

This plan supersedes any older implementation plan that assumed `discount_items jsonb`, `discount_rate`, POS workstation login, or workstation headers from the frontend.

Supabase/Docker verification runs on the shared server environment. If `npm run test:db`, `npm run supabase:reset`, or local function integration checks fail on a dev laptop because local Postgres/Supabase is not running, treat that as an environment limitation rather than a product failure, continue code reviewable changes, and request the same command output from the server Codex before marking the task complete.

Phase 1A includes:

- `products`
- `price_lists`
- `price_list_items`
- `GET/POST/PATCH /api/v1/products`
- `GET/POST/PATCH /api/v1/price-lists`
- `PUT/DELETE /api/v1/price-lists/{id}/items/{product_id}`
- `POST /api/v1/pricing/resolve`
- Dashboard `Hàng hóa` module
- POS quick product grid showing only active products

Phase 1A explicitly does not include:

- Customer CRUD
- customer groups
- manual customer-product recent price history UI
- quote/invoice persistence
- checkout
- debt allocation
- cashbook vouchers
- inventory, rolls, sheets stock management, BOM, QR/barcode

The deferred topics still constrain the implementation:

- Customers will require `customer_code` and `customer_name`; phone will be optional but unique within organization.
- Missing customer code will auto-generate `KH000001`, `KH000002`, and so on.
- No customer group will mean default/common price list.
- No separate customer/group discount exists in Phase 1.
- Manual POS price will not update any price list; later it will write recent price history by customer + product and show max 5 recent prices behind a button.
- Inactive products are never searchable/selectable in POS; product admin can show them via status filter.
- Rolls are not sold directly; sheets mainly sell by `m tới` or `m2`; `linear_m` prices are per 1 `m tới`.
- POS drafts stay local only.
- Server persists only quotes/invoices with snapshots in later phases.
- Editing finalized documents later creates `.01` versions and cancels the old document instead of deleting it.
- New order payment and old debt payment are separate later actions.
- Overpayment later is either returned or explicitly applied to old debt; no prepayment/customer negative balance in MVP.
- Cashbook later tracks cash vs bank account; bank transfer requires one selected bank account; mixed cash + one bank account is allowed, multiple bank accounts in one payment is not.
- Generated vouchers from invoices/debt must not diverge from source documents.

---

## File Structure

Create:

- `supabase/migrations/202606300001_sales_catalog_pricing.sql` - Sales catalog/pricing schema, constraints, RLS enablement, helper trigger, and service_role grants for new Sales tables.
- `supabase/tests/database/004_sales_catalog_pricing.test.sql` - pgTAP assertions for Sales catalog/pricing schema and constraints.
- `supabase/functions/api/use-cases/catalog.ts` - product and price list validation/business rules.
- `supabase/functions/api/routes/catalog.ts` - HTTP routing for product, price list, and price resolution endpoints.
- `supabase/tests/functions/catalog_test.ts` - function route unit tests with fake repository.
- `src/features/catalog/types.ts` - frontend catalog DTOs.
- `src/features/catalog/catalog-service.ts` - browser API wrapper for catalog endpoints.
- `src/features/catalog/CatalogPage.tsx` - product admin UI.
- `src/features/catalog/CatalogPage.test.tsx` - product admin UI tests.
- `src/features/pos/ProductGrid.tsx` - POS active product grid.
- `src/features/pos/ProductGrid.test.tsx` - POS grid tests.

Modify:

- `supabase/functions/api/contracts.ts` - add catalog repository types and methods.
- `supabase/functions/api/repositories/foundation-repository.ts` - implement catalog repository methods using Supabase.
- `supabase/functions/api/routes/router.ts` - mount catalog routes.
- `supabase/seed.sql` - seed default price list, sample products, sample price rows, and `perm.edit_price_book`.
- `src/lib/api/types.ts` - export catalog DTO types if current import graph needs shared API types.
- `src/app/router.tsx` - add `/products` route.
- `src/features/dashboard/DashboardPage.tsx` - enable `Hàng hóa` when user has `perm.edit_price_book`.
- `src/features/dashboard/DashboardPage.test.tsx` - cover module permission.
- `src/features/pos/PosShell.tsx` - render product grid in K03 area and add selected items to a local display-only cart placeholder.
- `src/features/pos/PosShell.test.tsx` - cover active product grid display.
- `src/styles/index.css` - add compact admin/product/POS grid styles matching existing app tone.

---

## Task 1: Database Schema And Permission Seed

**Files:**

- Create: `supabase/migrations/202606300001_sales_catalog_pricing.sql`
- Modify: `supabase/seed.sql`
- Create: `supabase/tests/database/004_sales_catalog_pricing.test.sql`

- [ ] **Step 1: Write failing pgTAP schema tests**

Create `supabase/tests/database/004_sales_catalog_pricing.test.sql`:

```sql
begin;

select plan(41);

select has_table('public', 'products');
select has_column('public', 'products', 'organization_id');
select has_column('public', 'products', 'code');
select has_column('public', 'products', 'name');
select has_column('public', 'products', 'status');
select has_column('public', 'products', 'unit_name');
select has_column('public', 'products', 'sell_method');
select col_not_null('public', 'products', 'organization_id');
select col_not_null('public', 'products', 'code');
select col_not_null('public', 'products', 'name');
select col_not_null('public', 'products', 'status');
select col_not_null('public', 'products', 'unit_name');
select col_not_null('public', 'products', 'sell_method');
select has_index('public', 'products', 'idx_products_org_status');
select has_index('public', 'products', 'idx_products_org_code');
select has_index('public', 'products', 'idx_products_org_name');

select has_table('public', 'price_lists');
select has_column('public', 'price_lists', 'organization_id');
select has_column('public', 'price_lists', 'code');
select has_column('public', 'price_lists', 'name');
select has_column('public', 'price_lists', 'is_default');
select has_column('public', 'price_lists', 'is_active');
select col_not_null('public', 'price_lists', 'organization_id');
select col_not_null('public', 'price_lists', 'code');
select col_not_null('public', 'price_lists', 'name');
select col_not_null('public', 'price_lists', 'is_default');
select col_not_null('public', 'price_lists', 'is_active');
select has_index('public', 'price_lists', 'idx_price_lists_org_active');
select has_index('public', 'price_lists', 'idx_price_lists_org_default');

select has_table('public', 'price_list_items');
select has_column('public', 'price_list_items', 'organization_id');
select has_column('public', 'price_list_items', 'price_list_id');
select has_column('public', 'price_list_items', 'product_id');
select has_column('public', 'price_list_items', 'unit_price');
select col_not_null('public', 'price_list_items', 'organization_id');
select col_not_null('public', 'price_list_items', 'price_list_id');
select col_not_null('public', 'price_list_items', 'product_id');
select col_not_null('public', 'price_list_items', 'unit_price');
select has_index('public', 'price_list_items', 'idx_price_list_items_list_product');
select has_index('public', 'price_list_items', 'idx_price_list_items_product');

select results_eq(
  $$ select count(*)::integer from public.permissions where code = 'perm.edit_price_book' $$,
  array[1],
  'edit price book permission is seeded'
);

select finish();
rollback;
```

- [ ] **Step 2: Run DB tests to verify RED**

Run: `npm run test:db`

Expected on a machine with local Supabase running: FAIL in `004_sales_catalog_pricing.test.sql` because the Sales catalog/pricing tables do not exist.

Expected on this shared-server setup if local Supabase is not running: FAIL with a connection error such as `LegacyDbConnectError`. In that case, continue with the migration and run DB verification on the server after implementation.

- [ ] **Step 3: Add Sales catalog/pricing migration**

Create `supabase/migrations/202606300001_sales_catalog_pricing.sql` with:

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active',
  unit_name text not null,
  sell_method text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_org_code_key unique (organization_id, code),
  constraint products_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint products_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint products_status_check check (status in ('active', 'inactive')),
  constraint products_unit_name_check check (char_length(btrim(unit_name)) between 1 and 30),
  constraint products_sell_method_check check (sell_method in ('quantity', 'area_m2', 'linear_m', 'sheet', 'combo'))
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
  constraint price_lists_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint price_lists_name_check check (char_length(btrim(name)) between 1 and 120)
);

create unique index price_lists_one_active_default_per_org
  on public.price_lists (organization_id)
  where is_default = true and is_active = true;

create index idx_price_lists_org_active on public.price_lists (organization_id, is_active);
create index idx_price_lists_org_default on public.price_lists (organization_id, is_default);

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  unit_price numeric(12,0) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_items_list_product_key unique (price_list_id, product_id),
  constraint price_list_items_unit_price_check check (unit_price >= 0)
);

create index idx_price_list_items_list_product on public.price_list_items (price_list_id, product_id);
create index idx_price_list_items_product on public.price_list_items (organization_id, product_id);

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_price_lists_updated_at
before update on public.price_lists
for each row execute function public.set_updated_at();

create trigger set_price_list_items_updated_at
before update on public.price_list_items
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
```

- [ ] **Step 4: Add permission/service_role seed and grants**

Modify `supabase/seed.sql` to include:

```sql
insert into public.permissions (code, module, description)
values
  ('perm.edit_price_book', 'catalog', 'Manage products and price lists')
on conflict (code) do update
set module = excluded.module,
    description = excluded.description,
    status = 'active';
```

Append service role grants to `supabase/migrations/202606300001_sales_catalog_pricing.sql` after the new tables are created:

```sql
grant select, insert, update, delete on
  public.products,
  public.price_lists,
  public.price_list_items
to service_role;
```

- [ ] **Step 5: Verify DB GREEN**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected:

- `npm run supabase:reset` exits 0.
- `npm run test:db` exits 0 and includes `004_sales_catalog_pricing.test.sql`.
- If these commands cannot connect on the dev laptop, send the exact same commands to server Codex and require the output before closing Task 1.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202606300001_sales_catalog_pricing.sql supabase/seed.sql supabase/tests/database/004_sales_catalog_pricing.test.sql
git commit -m "feat: add sales catalog pricing schema"
```

---

## Task 2: Catalog API Routes

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/functions/api/use-cases/catalog.ts`
- Create: `supabase/functions/api/routes/catalog.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Create: `supabase/tests/functions/catalog_test.ts`

- [ ] **Step 1: Write failing function tests**

Create `supabase/tests/functions/catalog_test.ts` covering:

```ts
Deno.test("catalog routes require account permissions", async () => {
  // create_order can list active products and resolve prices.
  // edit_price_book can create/update products and price lists.
  // missing permission returns 403 PERMISSION_DENIED.
});

Deno.test("product search hides inactive products for POS users", async () => {
  // repository receives status: "active" when actor only has perm.create_order.
});

Deno.test("price resolution uses default price list without discount model", async () => {
  // response contains unit_price, price_source, price_list_id.
  // response does not contain discount_rate or discount_items.
});
```

Use the same `createApp`, `AuthClient`, and fake repository style as `supabase/tests/functions/users_test.ts`. The fake repository must implement the new catalog methods added in Step 3.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:functions`

Expected: FAIL because `catalog_test.ts` references catalog repository methods/routes that do not exist.

- [ ] **Step 3: Add catalog contracts**

Modify `supabase/functions/api/contracts.ts` with these exported types:

```ts
export type ProductStatus = "active" | "inactive";
export type SellMethod = "quantity" | "area_m2" | "linear_m" | "sheet" | "combo";
export type PriceSource = "default_price_list" | "fallback_default_price_list";

export interface ProductData {
  id: string;
  code: string;
  name: string;
  status: ProductStatus;
  unit_name: string;
  sell_method: SellMethod;
}

export interface PriceListData {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

export interface ResolvedPriceData {
  product_id: string;
  unit_price: number;
  price_source: PriceSource;
  price_list_id: string;
}
```

Extend `FoundationRepository` with:

```ts
listProducts(input: {
  organizationId: string;
  search?: string;
  status: ProductStatus | "all";
  page: number;
  pageSize: number;
}): Promise<{ items: ProductData[]; total: number }>;
createProduct(input: {
  organizationId: string;
  code: string;
  name: string;
  status: ProductStatus;
  unitName: string;
  sellMethod: SellMethod;
}): Promise<ProductData>;
updateProduct(input: {
  organizationId: string;
  id: string;
  code?: string;
  name?: string;
  status?: ProductStatus;
  unitName?: string;
  sellMethod?: SellMethod;
}): Promise<ProductData | null>;
listPriceLists(input: { organizationId: string; activeOnly: boolean }): Promise<PriceListData[]>;
createPriceList(input: {
  organizationId: string;
  code: string;
  name: string;
  isDefault: boolean;
}): Promise<PriceListData>;
updatePriceList(input: {
  organizationId: string;
  id: string;
  code?: string;
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
}): Promise<PriceListData | null>;
upsertPriceListItem(input: {
  organizationId: string;
  priceListId: string;
  productId: string;
  unitPrice: number;
}): Promise<ResolvedPriceData>;
deletePriceListItem(input: {
  organizationId: string;
  priceListId: string;
  productId: string;
}): Promise<boolean>;
resolvePrices(input: {
  organizationId: string;
  productIds: string[];
}): Promise<ResolvedPriceData[]>;
```

- [ ] **Step 4: Implement catalog use cases**

Create `supabase/functions/api/use-cases/catalog.ts` with focused functions:

```ts
export const CATALOG_PAGE_SIZE_MAX = 100;

export function requireAnyPermission(permissions: PermissionCode[], allowed: PermissionCode[]): void {
  if (!allowed.some((permission) => permissions.includes(permission))) {
    throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}
```

Implement:

- `listProducts(repository, context, url)`
- `createProduct(repository, context, body)`
- `updateProduct(repository, context, id, body)`
- `listPriceLists(repository, context, url)`
- `createPriceList(repository, context, body)`
- `updatePriceList(repository, context, id, body)`
- `upsertPriceListItem(repository, context, priceListId, productId, body)`
- `deletePriceListItem(repository, context, priceListId, productId)`
- `resolvePrices(repository, context, body)`

Validation rules:

- `perm.create_order` can list products but backend forces `status = active`.
- `perm.edit_price_book` can list `active`, `inactive`, or `all`.
- Product `code`, `name`, `unit_name` trim to non-empty strings.
- `sell_method` must be one of `quantity`, `area_m2`, `linear_m`, `sheet`, `combo`.
- Price list item `unit_price` must be an integer number `>= 0`.
- `resolvePrices` accepts one or more product IDs and returns no discount fields.

- [ ] **Step 5: Implement routes and router mount**

Create `supabase/functions/api/routes/catalog.ts` following `routes/users.ts` style:

```ts
export async function handleCatalog(
  request: Request,
  traceId: string,
  dependencies: CatalogRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: null,
  });
  if (currentUser === null) {
    throw new ApiError({ status: 403, code: "ACCOUNT_INACTIVE", message: "Account is inactive." });
  }

  const context = {
    organizationId: currentUser.organization.id,
    permissions: currentUser.permissions,
  };

  // Route /api/v1/products, /api/v1/price-lists, /api/v1/pricing/resolve.
}
```

Modify `supabase/functions/api/routes/router.ts` to dispatch:

- `/api/v1/products`
- `/api/v1/products/{id}`
- `/api/v1/price-lists`
- `/api/v1/price-lists/{id}`
- `/api/v1/price-lists/{id}/items/{product_id}`
- `/api/v1/pricing/resolve`

- [ ] **Step 6: Implement repository methods**

Modify `supabase/functions/api/repositories/foundation-repository.ts`:

- Use `.from("products")` for product list/create/update.
- Use `.from("price_lists")` for price list list/create/update.
- Use `.from("price_list_items")` for item upsert/delete.
- `resolvePrices` loads the active default price list for the organization and active products only.
- If a product has no default price item, return `unit_price: 0`, `price_source: "default_price_list"`, and the default price list id so POS can still show the product while catalog setup is incomplete.

- [ ] **Step 7: Verify API GREEN**

Run:

```bash
npm run test:functions
npm run lint
npm run typecheck
```

Expected:

- Function tests pass.
- Lint and typecheck pass.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/catalog_test.ts
git commit -m "feat: add catalog pricing API"
```

---

## Task 3: Product Admin UI

**Files:**

- Create: `src/features/catalog/types.ts`
- Create: `src/features/catalog/catalog-service.ts`
- Create: `src/features/catalog/CatalogPage.tsx`
- Create: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/dashboard/DashboardPage.test.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write failing dashboard and catalog UI tests**

Update `src/features/dashboard/DashboardPage.test.tsx`:

```tsx
it('enables product catalog for accounts with edit price book permission', async () => {
  const onOpenCatalog = vi.fn();
  render(
    <DashboardPage
      currentUser={{ ...currentUser, permissions: ['perm.edit_price_book'] }}
      onOpenPos={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenCatalog={onOpenCatalog}
      onSignOut={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Hàng hóa' }));
  expect(onOpenCatalog).toHaveBeenCalled();
});
```

Create `src/features/catalog/CatalogPage.test.tsx`:

```tsx
it('lists products and creates a product', async () => {
  const service = {
    listProducts: vi.fn().mockResolvedValue({
      items: [{ id: 'p-1', code: 'MICA-3MM', name: 'Mica 3mm', status: 'active', unit_name: 'm', sell_method: 'linear_m' }],
      page: 1,
      page_size: 20,
      total: 1,
    }),
    createProduct: vi.fn().mockResolvedValue({ id: 'p-2', code: 'DECAL', name: 'Decal', status: 'active', unit_name: 'm2', sell_method: 'area_m2' }),
    updateProduct: vi.fn(),
  };

  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />);

  expect(await screen.findByText('MICA-3MM')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Mã hàng'), 'DECAL');
  await userEvent.type(screen.getByLabelText('Tên hàng'), 'Decal');
  await userEvent.type(screen.getByLabelText('Đơn vị'), 'm2');
  await userEvent.selectOptions(screen.getByLabelText('Cách bán'), 'area_m2');
  await userEvent.click(screen.getByRole('button', { name: 'Thêm hàng hóa' }));

  expect(service.createProduct).toHaveBeenCalledWith({
    code: 'DECAL',
    name: 'Decal',
    status: 'active',
    unit_name: 'm2',
    sell_method: 'area_m2',
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/dashboard/DashboardPage.test.tsx src/features/catalog/CatalogPage.test.tsx`

Expected: FAIL because catalog props/files do not exist.

- [ ] **Step 3: Add frontend catalog types and service**

Create `src/features/catalog/types.ts`:

```ts
export type ProductStatus = 'active' | 'inactive';
export type SellMethod = 'quantity' | 'area_m2' | 'linear_m' | 'sheet' | 'combo';

export interface Product {
  id: string;
  code: string;
  name: string;
  status: ProductStatus;
  unit_name: string;
  sell_method: SellMethod;
}

export interface ProductListResponse {
  items: Product[];
  page: number;
  page_size: number;
  total: number;
}
```

Create `src/features/catalog/catalog-service.ts`:

```ts
import { createApiClient } from '../../lib/api/client';
import type { Product, ProductListResponse, ProductStatus, SellMethod } from './types';

export interface CatalogApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export function createCatalogService(api: CatalogApiRequester) {
  return {
    listProducts: (input: { search?: string; status?: ProductStatus | 'all' } = {}) => {
      const params = new URLSearchParams();
      if (input.search) params.set('search', input.search);
      if (input.status) params.set('status', input.status);
      const query = params.toString();
      return api.request<ProductListResponse>(`/api/v1/products${query ? `?${query}` : ''}`);
    },
    createProduct: (input: { code: string; name: string; status: ProductStatus; unit_name: string; sell_method: SellMethod }) =>
      api.request<Product>('/api/v1/products', { method: 'POST', body: JSON.stringify(input) }),
    updateProduct: (id: string, input: Partial<{ code: string; name: string; status: ProductStatus; unit_name: string; sell_method: SellMethod }>) =>
      api.request<Product>(`/api/v1/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;

export function createBrowserCatalogService(getAccessToken: () => Promise<string | null>) {
  return createCatalogService(createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '', getAccessToken }));
}
```

- [ ] **Step 4: Add dashboard and route wiring**

Modify `DashboardPage` props to include `onOpenCatalog`, compute:

```ts
const canCatalog = currentUser.permissions.includes('perm.edit_price_book');
```

Change `Hàng hóa` button:

```tsx
<button disabled={!canCatalog} type="button" onClick={onOpenCatalog}>
  Hàng hóa
</button>
```

Modify `src/app/router.tsx`:

- import `CatalogPage` and `createBrowserCatalogService`
- add `<Route path="/products" element={<CatalogRoute />} />`
- add `onOpenCatalog={() => navigate('/products')}` to `DashboardPage`
- require `perm.edit_price_book` in `CatalogRoute`

- [ ] **Step 5: Implement CatalogPage**

Create `src/features/catalog/CatalogPage.tsx` with:

- header `Hàng hóa`
- `Trang chủ` button
- search input
- status filter `active | inactive | all`
- create form for code, name, unit, sell_method, status
- table showing code, name, unit, sell_method, status
- action button toggling active/inactive through `service.updateProduct`

- [ ] **Step 6: Verify UI GREEN**

Run:

```bash
npm test -- src/features/dashboard/DashboardPage.test.tsx src/features/catalog/CatalogPage.test.tsx
npm run lint
npm run typecheck
```

Expected: tests, lint, and typecheck pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/router.tsx src/features/dashboard src/features/catalog src/styles/index.css
git commit -m "feat: add product catalog admin"
```

---

## Task 4: POS Quick Product Grid

**Files:**

- Create: `src/features/pos/ProductGrid.tsx`
- Create: `src/features/pos/ProductGrid.test.tsx`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write failing product grid tests**

Create `src/features/pos/ProductGrid.test.tsx`:

```tsx
it('renders active products and selects one', async () => {
  const onSelectProduct = vi.fn();
  render(
    <ProductGrid
      products={[
        { id: 'p-1', code: 'MICA-3MM', name: 'Mica 3mm', status: 'active', unit_name: 'm', sell_method: 'linear_m' },
      ]}
      prices={{ 'p-1': { unit_price: 120000, price_source: 'default_price_list', price_list_id: 'pl-1' } }}
      loading={false}
      onSelectProduct={onSelectProduct}
    />,
  );

  expect(screen.getByText('Mica 3mm')).toBeInTheDocument();
  expect(screen.getByText('120.000/m')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Mica 3mm/ }));
  expect(onSelectProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }));
});
```

Update `src/features/pos/PosShell.test.tsx` to assert K03 shows the grid heading `Sản phẩm nhanh`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/pos/ProductGrid.test.tsx src/features/pos/PosShell.test.tsx`

Expected: FAIL because `ProductGrid` does not exist and POS shell still shows the Phase 0 placeholder.

- [ ] **Step 3: Implement ProductGrid**

Create `src/features/pos/ProductGrid.tsx`:

```tsx
import type { Product } from '../catalog/types';

export interface ResolvedPrice {
  unit_price: number;
  price_source: 'default_price_list' | 'fallback_default_price_list';
  price_list_id: string;
}

export function ProductGrid({
  products,
  prices,
  loading,
  onSelectProduct,
}: {
  products: Product[];
  prices: Record<string, ResolvedPrice>;
  loading: boolean;
  onSelectProduct: (product: Product) => void;
}) {
  if (loading) return <p>Đang tải sản phẩm...</p>;
  if (products.length === 0) return <p>Chưa có sản phẩm đang bán.</p>;

  return (
    <section aria-label="Sản phẩm nhanh" className="product-grid-panel">
      <h2>Sản phẩm nhanh</h2>
      <div className="product-grid">
        {products.slice(0, 12).map((product) => {
          const price = prices[product.id]?.unit_price ?? 0;
          return (
            <button key={product.id} type="button" onClick={() => onSelectProduct(product)}>
              <strong>{product.name}</strong>
              <span>{price.toLocaleString('vi-VN')}/{product.unit_name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire POS shell to product service**

Modify `PosShell` to receive:

```ts
catalogService: CatalogService;
```

On mount:

- call `catalogService.listProducts({ status: 'active' })`
- call `/api/v1/pricing/resolve` through a catalog service method for returned product IDs
- store up to 12 products and price map
- when selected, add a display-only cart row with product name, unit, and resolved price

Keep checkout disabled and do not persist drafts to the server in Phase 1A.

- [ ] **Step 5: Verify POS GREEN**

Run:

```bash
npm test -- src/features/pos/ProductGrid.test.tsx src/features/pos/PosShell.test.tsx
npm run lint
npm run typecheck
```

Expected: tests, lint, and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/pos src/styles/index.css
git commit -m "feat: show active products in POS"
```

---

## Task 5: End-To-End Verification And Server Readiness

**Files:**

- Modify only if needed: `tests` or `playwright` files already present in the repo.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npm run supabase:reset
npm run test:db
```

Expected:

- All commands exit 0.
- `test:functions` may skip integration checks if `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are absent.
- `supabase:reset` and `test:db` may need to run on the shared server rather than the dev laptop.

- [ ] **Step 2: Run browser smoke test**

Start dev server if not already running:

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/login` and verify:

- login with `admin@qc.local / 123456`
- dashboard shows enabled `Hàng hóa` only if the admin has `perm.edit_price_book`
- product admin can create an active product
- POS shows the active product in `Sản phẩm nhanh`
- inactive product does not appear in POS after toggling status

- [ ] **Step 3: Push branch**

```bash
git status --short --branch
git push origin codex/phase-1a
```

Expected:

- Worktree clean before push.
- Remote branch updates successfully.

---

## Self-Review Against `90e501e`

- Customer required code/name, optional unique phone, auto code, and no-group default price list are deferred, not contradicted.
- Pricing uses `price_lists` + `price_list_items`; this plan does not create `discount_items`, `discount_rate`, or a generic discount model.
- POS price resolution uses default price list in Phase 1A; customer group price list resolution is left for the customer slice.
- Manual price history is deferred and explicitly constrained to customer + product, max 5 prices behind a button.
- Inactive products are hidden from POS and visible in product admin through status filter.
- Rolls/sheets rules are represented through `sell_method` and do not attempt inventory or stock conversion.
- Orders, local drafts, quote/invoice snapshots, `.01` document versions, debt, payment, and cashbook are documented as later slices and not implemented here.
