# Phase 1B Customer Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Phase 1 customer slice: customer groups, customers, customer selection in POS, and price resolution by customer group or default price list.

**Architecture:** Extend the existing Sales catalog/pricing boundary instead of creating a separate customer service. Supabase migrations own customer/customer group schema and safe customer-code generation; Edge Function catalog routes enforce account permissions and organization scope; React POS consumes typed catalog service methods and keeps selected customer local to the draft UI.

**Tech Stack:** Supabase/Postgres migrations and pgTAP, Deno Edge Functions, React/Vite/TypeScript, Vitest, Playwright.

---

## Scope Lock

This plan builds on Phase 1A already merged into `main`.

Included:

- `customers`
- `customer_groups`
- optional unique phone per organization
- required customer code and name
- auto-generated customer code `KH000001`, `KH000002`, ...
- customer group price list selection
- `GET/POST/PATCH /api/v1/customers`
- `GET/POST/PATCH /api/v1/customer-groups`
- `POST /api/v1/pricing/resolve` accepts optional `customer_id`
- POS customer search/create/select panel
- POS price refresh when selected customer changes

Not included:

- quote/invoice persistence
- checkout
- manual price editing
- recent manual price history UI
- debt allocation
- cashbook
- inventory, stocktake, rolls, sheets, production reconciliation

Inventory Source of Truth commit `6549920` affects future stock work only. Do not add stock fields or product stock editing in this Phase 1B slice.

---

## Source Of Truth

- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-PRICING.md`
- `docs/04-DATABASE/Sales/POS-TABLES.md`
- `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`
- `docs/DEVELOPMENT-PLAN.md`

---

## File Structure

Create:

- `supabase/migrations/202606300002_sales_customers.sql` - customer groups, customers, phone normalization, customer code generator, service role grants.
- `supabase/tests/database/005_sales_customers.test.sql` - pgTAP schema/function tests.
- `src/features/pos/CustomerPanel.tsx` - POS customer search/create/select UI.
- `src/features/pos/CustomerPanel.test.tsx` - customer panel tests.

Modify:

- `supabase/functions/api/contracts.ts` - add customer/customer group DTOs and repository methods; extend `resolvePrices` input.
- `supabase/functions/api/repositories/foundation-repository.ts` - implement customer/customer group repository methods and customer-aware pricing.
- `supabase/functions/api/use-cases/catalog.ts` - add customer validation/use-cases and parse `customer_id` in price resolve.
- `supabase/functions/api/routes/catalog.ts` - mount customer/customer-group routes.
- `supabase/functions/api/routes/router.ts` - route customer/customer-group paths to catalog handler.
- `supabase/tests/functions/catalog_test.ts` - add route/use-case tests for customers and customer pricing.
- `src/features/catalog/types.ts` - add customer/customer group DTO types and extend `ResolvedPrice.price_source`.
- `src/features/catalog/catalog-service.ts` - add customer methods and `resolvePrices(productIds, customerId?)`.
- `src/features/pos/PosShell.tsx` - keep selected customer and pass it to price resolution.
- `src/features/pos/PosShell.test.tsx` - cover selected customer price refresh.
- `src/styles/index.css` - compact POS customer panel styles.
- `docs/PHASE-CHECKLIST.md` - mark Phase 1A complete and add Phase 1B status.

---

## Task 1: Customer Database Schema

**Files:**

- Create: `supabase/migrations/202606300002_sales_customers.sql`
- Create: `supabase/tests/database/005_sales_customers.test.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write failing pgTAP schema tests**

Create `supabase/tests/database/005_sales_customers.test.sql`:

```sql
begin;

select plan(34);

select has_table('public', 'customer_groups');
select has_column('public', 'customer_groups', 'organization_id');
select has_column('public', 'customer_groups', 'code');
select has_column('public', 'customer_groups', 'name');
select has_column('public', 'customer_groups', 'price_list_id');
select has_column('public', 'customer_groups', 'is_active');
select col_not_null('public', 'customer_groups', 'organization_id');
select col_not_null('public', 'customer_groups', 'code');
select col_not_null('public', 'customer_groups', 'name');
select col_not_null('public', 'customer_groups', 'price_list_id');
select col_not_null('public', 'customer_groups', 'is_active');
select has_index('public', 'customer_groups', 'idx_customer_groups_org_active');
select has_index('public', 'customer_groups', 'idx_customer_groups_org_price_list');

select has_table('public', 'customers');
select has_column('public', 'customers', 'organization_id');
select has_column('public', 'customers', 'code');
select has_column('public', 'customers', 'name');
select has_column('public', 'customers', 'phone');
select has_column('public', 'customers', 'phone_normalized');
select has_column('public', 'customers', 'customer_group_id');
select col_not_null('public', 'customers', 'organization_id');
select col_not_null('public', 'customers', 'code');
select col_not_null('public', 'customers', 'name');
select has_index('public', 'customers', 'idx_customers_org_name');
select has_index('public', 'customers', 'idx_customers_org_code');
select has_index('public', 'customers', 'idx_customers_org_group');
select has_index('public', 'customers', 'idx_customers_org_phone_normalized');

select has_function('public', 'normalize_customer_phone', array['text']);
select has_function('public', 'next_customer_code', array['uuid']);

select is(
  public.normalize_customer_phone(' 090 123-4567 '),
  '0901234567',
  'phone normalization keeps digits'
);

select like(
  public.next_customer_code('00000000-0000-4000-8000-000000000001'),
  'KH______',
  'next customer code uses KH000001 format'
);

insert into public.customer_groups (id, organization_id, code, name, price_list_id)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000001',
  'DAILY',
  'Dai ly',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.customers (organization_id, code, name, phone, customer_group_id)
values (
  '00000000-0000-4000-8000-000000000001',
  'KH000001',
  'Cong ty ABC',
  '090 123 4567',
  '00000000-0000-4000-8000-000000000401'
);

select is(
  (select phone_normalized from public.customers where code = 'KH000001'),
  '0901234567',
  'customer phone_normalized is generated'
);

select throws_ok(
  $$ insert into public.customers (organization_id, code, name, phone)
     values ('00000000-0000-4000-8000-000000000001', 'KH000002', 'Khach trung SDT', '0901234567') $$,
  null,
  null,
  'duplicate normalized phone is rejected'
);

select finish();
rollback;
```

- [ ] **Step 2: Run DB tests to verify RED**

Run: `npm run test:db`

Expected if local Supabase is running: FAIL because `customers`, `customer_groups`, `normalize_customer_phone`, and `next_customer_code` do not exist.

- [ ] **Step 3: Add customer migration**

Create `supabase/migrations/202606300002_sales_customers.sql`:

```sql
create table public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  price_list_id uuid not null references public.price_lists(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_groups_org_code_key unique (organization_id, code),
  constraint customer_groups_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint customer_groups_name_check check (char_length(btrim(name)) between 1 and 120)
);

create index idx_customer_groups_org_active on public.customer_groups (organization_id, is_active);
create index idx_customer_groups_org_price_list on public.customer_groups (organization_id, price_list_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  phone text,
  phone_normalized text,
  customer_group_id uuid references public.customer_groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_org_code_key unique (organization_id, code),
  constraint customers_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint customers_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint customers_phone_check check (phone is null or char_length(btrim(phone)) between 1 and 30),
  constraint customers_phone_normalized_check check (phone_normalized is null or char_length(phone_normalized) between 6 and 20)
);

create unique index customers_org_phone_normalized_key
  on public.customers (organization_id, phone_normalized)
  where phone_normalized is not null;

create index idx_customers_org_name on public.customers (organization_id, name);
create index idx_customers_org_code on public.customers (organization_id, code);
create index idx_customers_org_group on public.customers (organization_id, customer_group_id);
create index idx_customers_org_phone_normalized on public.customers (organization_id, phone_normalized)
  where phone_normalized is not null;

create or replace function public.normalize_customer_phone(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(input, ''), '[^0-9]+', '', 'g'), '')
$$;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone = nullif(btrim(new.phone), '');
  new.phone_normalized = public.normalize_customer_phone(new.phone);
  return new;
end;
$$;

create trigger set_customers_phone_normalized
before insert or update of phone on public.customers
for each row execute function public.set_customer_phone_normalized();

create trigger set_customer_groups_updated_at
before update on public.customer_groups
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace function public.next_customer_code(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(code from 3)::integer), 0) + 1
    into next_number
  from public.customers
  where organization_id = p_organization_id
    and code ~ '^KH[0-9]{6}$';

  return 'KH' || lpad(next_number::text, 6, '0');
end;
$$;

alter table public.customer_groups enable row level security;
alter table public.customers enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.customer_groups, public.customers to service_role;
grant execute on function public.normalize_customer_phone(text) to service_role;
grant execute on function public.next_customer_code(uuid) to service_role;
```

- [ ] **Step 4: Seed one customer group and one customer**

Append to `supabase/seed.sql` after price list seed:

```sql
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
```

- [ ] **Step 5: Run DB verification**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: `005_sales_customers.test.sql` passes and total DB tests increase from 97.

- [ ] **Step 6: Commit database slice**

```bash
git add supabase/migrations/202606300002_sales_customers.sql supabase/tests/database/005_sales_customers.test.sql supabase/seed.sql
git commit -m "feat: add customer sales schema"
```

---

## Task 2: Backend Customer APIs

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `supabase/functions/api/routes/catalog.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Modify: `supabase/tests/functions/catalog_test.ts`

- [ ] **Step 1: Add failing function route tests**

Add tests to `supabase/tests/functions/catalog_test.ts`:

```ts
Deno.test("customer routes normalize optional phone and auto code", async () => {
  const repository = repo(["perm.create_order"]);
  repository.createCustomer = (input) =>
    Promise.resolve({
      id: "customer-1",
      code: input.code ?? "KH000002",
      name: input.name,
      phone: input.phone ?? null,
      customer_group_id: input.customerGroupId ?? null,
      customer_group: null,
    });

  const response = await routeRequest(
    new Request("http://local/api/v1/customers", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ name: " Cong ty ABC ", phone: " 090 123 4567 " }),
    }),
    "trace",
    options(repository),
  );

  const body = await response.json();
  assertEquals(response.status, 201);
  assertEquals(body.data.code, "KH000002");
  assertEquals(body.data.name, "Cong ty ABC");
  assertEquals(body.data.phone, "090 123 4567");
});

Deno.test("price resolution accepts a customer id", async () => {
  const repository = repo(["perm.create_order"]);
  repository.resolvePrices = (input) =>
    Promise.resolve([
      {
        product_id: input.productIds[0],
        unit_price: input.customerId === "customer-1" ? 100000 : 120000,
        price_source: "customer_group_price_list",
        price_list_id: "price-list-2",
      },
    ]);

  const response = await routeRequest(
    new Request("http://local/api/v1/pricing/resolve", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ product_ids: ["product-1"], customer_id: "customer-1" }),
    }),
    "trace",
    options(repository),
  );

  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.data.items[0].unit_price, 100000);
  assertEquals(body.data.items[0].price_source, "customer_group_price_list");
});
```

- [ ] **Step 2: Run function tests to verify RED**

Run: `npm run test:functions`

Expected: FAIL because customer repository methods and `customer_id` pricing support do not exist.

- [ ] **Step 3: Extend contracts**

In `supabase/functions/api/contracts.ts`, add:

```ts
export type PriceSource =
  | "default_price_list"
  | "customer_group_price_list"
  | "fallback_default_price_list";

export interface CustomerGroupData {
  id: string;
  code: string;
  name: string;
  price_list_id: string;
  is_active: boolean;
}

export interface CustomerData {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  customer_group_id: string | null;
  customer_group: { id: string; code: string; name: string } | null;
}
```

Add repository methods:

```ts
  listCustomers(input: {
    organizationId: string;
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: CustomerData[]; total: number }>;
  createCustomer(input: {
    organizationId: string;
    code?: string;
    name: string;
    phone?: string;
    customerGroupId?: string | null;
  }): Promise<CustomerData>;
  updateCustomer(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    phone?: string | null;
    customerGroupId?: string | null;
  }): Promise<CustomerData | null>;
  listCustomerGroups(input: { organizationId: string; activeOnly: boolean }): Promise<CustomerGroupData[]>;
  createCustomerGroup(input: {
    organizationId: string;
    code: string;
    name: string;
    priceListId: string;
  }): Promise<CustomerGroupData>;
  updateCustomerGroup(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    priceListId?: string;
    isActive?: boolean;
  }): Promise<CustomerGroupData | null>;
```

Extend `resolvePrices`:

```ts
  resolvePrices(input: {
    organizationId: string;
    productIds: string[];
    customerId?: string;
  }): Promise<ResolvedPriceData[]>;
```

- [ ] **Step 4: Add use-case parsing and permission rules**

In `supabase/functions/api/use-cases/catalog.ts`, add `listCustomers`, `createCustomer`, `updateCustomer`, `listCustomerGroups`, `createCustomerGroup`, `updateCustomerGroup`.

Use rules:

- customers lookup/create/update require `perm.create_order`
- customer groups read requires `perm.create_order`
- customer groups write requires `perm.edit_price_book`
- trim `code`, `name`, `phone`
- empty code becomes `undefined` on create so repository auto-generates
- `customer_group_id = null` clears the group
- map duplicate code/phone to `RESOURCE_CONFLICT`

- [ ] **Step 5: Mount routes**

In `supabase/functions/api/routes/router.ts`, route these paths to `handleCatalog`:

```ts
url.pathname === "/api/v1/customers" ||
url.pathname.startsWith("/api/v1/customers/") ||
url.pathname === "/api/v1/customer-groups" ||
url.pathname.startsWith("/api/v1/customer-groups/")
```

In `supabase/functions/api/routes/catalog.ts`, add:

```ts
if (url.pathname === "/api/v1/customers") {
  if (request.method === "GET") return successResponse(await listCustomers(...), traceId);
  if (request.method === "POST") return successResponse(await createCustomer(...), traceId, { status: 201 });
}

const customerMatch = url.pathname.match(/^\/api\/v1\/customers\/([^/]+)$/);
if (customerMatch !== null && request.method === "PATCH") {
  return successResponse(await updateCustomer(...), traceId);
}
```

Repeat the same pattern for `/api/v1/customer-groups`.

- [ ] **Step 6: Implement repository methods**

In `supabase/functions/api/repositories/foundation-repository.ts`:

- `listCustomers` selects `id, code, name, phone, customer_group_id, customer_groups(id, code, name)`
- `createCustomer` calls RPC `next_customer_code` when code is missing
- `createCustomer` inserts `code`, `name`, `phone`, `customer_group_id`
- `updateCustomer` patches only provided fields
- `listCustomerGroups` filters `is_active = true` unless `activeOnly=false`
- `resolvePrices`:
  - validates all products are active
  - loads customer's active group price list if `customerId` is present and customer belongs to a group
  - otherwise uses active default price list
  - falls back to default list for products missing in customer group list
  - returns `customer_group_price_list`, `default_price_list`, or `fallback_default_price_list`

- [ ] **Step 7: Run function verification**

Run: `npm run test:functions`

Expected: all function tests pass.

- [ ] **Step 8: Commit backend slice**

```bash
git add supabase/functions/api/contracts.ts supabase/functions/api/repositories/foundation-repository.ts supabase/functions/api/use-cases/catalog.ts supabase/functions/api/routes/catalog.ts supabase/functions/api/routes/router.ts supabase/tests/functions/catalog_test.ts
git commit -m "feat: add customer pricing api"
```

---

## Task 3: Frontend Customer Service And POS Panel

**Files:**

- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Create: `src/features/pos/CustomerPanel.tsx`
- Create: `src/features/pos/CustomerPanel.test.tsx`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Add failing CustomerPanel test**

Create `src/features/pos/CustomerPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomerPanel } from './CustomerPanel'
import type { Customer } from '../catalog/types'

const customer: Customer = {
  id: 'customer-1',
  code: 'KH000001',
  name: 'Khach le',
  phone: null,
  customer_group_id: null,
  customer_group: null,
}

describe('CustomerPanel', () => {
  it('searches and selects a customer', async () => {
    const service = {
      listCustomers: vi.fn(async () => ({ items: [customer], page: 1, page_size: 20, total: 1 })),
      createCustomer: vi.fn(),
    }
    const onSelectCustomer = vi.fn()

    render(<CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={onSelectCustomer} />)

    await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
    await userEvent.click(screen.getByRole('button', { name: 'Tìm khách' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Chọn KH000001 Khach le' }))

    expect(service.listCustomers).toHaveBeenCalledWith({ search: 'khach' })
    expect(onSelectCustomer).toHaveBeenCalledWith(customer)
  })
})
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- src/features/pos/CustomerPanel.test.tsx`

Expected: FAIL because `CustomerPanel` does not exist.

- [ ] **Step 3: Add customer frontend types and service methods**

In `src/features/catalog/types.ts`, add:

```ts
export interface CustomerGroup {
  id: string;
  code: string;
  name: string;
  price_list_id: string;
  is_active: boolean;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  customer_group_id: string | null;
  customer_group: { id: string; code: string; name: string } | null;
}

export interface CustomerListResponse {
  items: Customer[];
  page: number;
  page_size: number;
  total: number;
}
```

Extend `ResolvedPrice.price_source` with `customer_group_price_list`.

In `src/features/catalog/catalog-service.ts`, add:

```ts
listCustomers: (input: { search?: string } = {}) => api.request<CustomerListResponse>(...),
createCustomer: (input: { code?: string; name: string; phone?: string; customer_group_id?: string | null }) =>
  api.request<Customer>('/api/v1/customers', { method: 'POST', body: JSON.stringify(input) }),
resolvePrices: (productIds: string[], customerId?: string) =>
  api.request<ResolvePricesResponse>('/api/v1/pricing/resolve', {
    method: 'POST',
    body: JSON.stringify({ product_ids: productIds, customer_id: customerId }),
  }),
```

- [ ] **Step 4: Implement CustomerPanel**

Create `src/features/pos/CustomerPanel.tsx` with:

- selected customer summary
- search input
- search result buttons
- quick create form with optional code and phone, required name
- clear customer button
- API errors through `formatApiError`

Use accessible labels:

- `aria-label="Khách hàng"`
- input label `Tìm khách`
- form label `Tạo khách nhanh`
- select button name `Chọn ${code} ${name}`

- [ ] **Step 5: Run CustomerPanel test**

Run: `npm test -- src/features/pos/CustomerPanel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Wire CustomerPanel into PosShell**

In `src/features/pos/PosShell.tsx`:

- add `selectedCustomer` state
- render `<CustomerPanel service={catalogService} selectedCustomer={selectedCustomer} onSelectCustomer={setSelectedCustomer} />`
- when loading prices, call `catalogService.resolvePrices(productIds, selectedCustomer?.id)`
- include `selectedCustomer` in the price-loading effect dependency

- [ ] **Step 7: Update PosShell tests**

Extend `src/features/pos/PosShell.test.tsx` so fake `catalogService.resolvePrices` asserts `customerId` is passed after selecting a customer.

- [ ] **Step 8: Run frontend verification**

Run:

```bash
npm test -- src/features/pos/CustomerPanel.test.tsx src/features/pos/PosShell.test.tsx src/features/catalog/CatalogPage.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit frontend slice**

```bash
git add src/features/catalog/types.ts src/features/catalog/catalog-service.ts src/features/pos/CustomerPanel.tsx src/features/pos/CustomerPanel.test.tsx src/features/pos/PosShell.tsx src/features/pos/PosShell.test.tsx src/styles/index.css
git commit -m "feat: add pos customer selection"
```

---

## Task 4: Verification, Checklist, And Server Handoff

**Files:**

- Modify: `docs/PHASE-CHECKLIST.md`

- [ ] **Step 1: Update phase checklist**

In `docs/PHASE-CHECKLIST.md`:

- mark Phase 1A as merged to `main`
- add Phase 1B branch `codex/phase-1b-customer-pricing`
- add completed/remaining checklist for customers and customer pricing
- note Inventory Source of Truth exists but implementation is deferred until Phase 4 stock work

- [ ] **Step 2: Run full local verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npm run test:e2e
```

Expected:

- lint PASS
- typecheck PASS
- unit tests PASS
- build PASS
- function tests PASS
- e2e PASS or skip only server bootstrap if service-role env is missing

- [ ] **Step 3: Run DB verification where Supabase is available**

On server/shared Supabase environment, run:

```powershell
cd D:\AI\QC-OMS
git fetch origin
git checkout codex/phase-1b-customer-pricing
git pull origin codex/phase-1b-customer-pricing
npm.cmd run supabase:reset
npm.cmd run test:db
npm.cmd run test:functions
```

Expected:

- `supabase:reset` applies `202606300002_sales_customers.sql`
- `test:db` passes all DB tests including `005_sales_customers.test.sql`
- `test:functions` passes all function tests

- [ ] **Step 4: Server smoke test**

After server runtime is restarted from the correct mirror path, test:

- login `admin@qc.local / 123456`
- `/api/v1/customers` returns seeded `KH000001`
- `POST /api/v1/customers` without `code` creates the next `KH...` code
- duplicate phone returns conflict
- `/api/v1/pricing/resolve` with `customer_id` returns 200

- [ ] **Step 5: Commit checklist update**

```bash
git add docs/PHASE-CHECKLIST.md
git commit -m "docs: track phase 1b customer pricing"
```

- [ ] **Step 6: Push branch**

```bash
git push -u origin codex/phase-1b-customer-pricing
```

Open a PR titled:

```text
Phase 1B: Customer selection and customer pricing
```

PR body:

```markdown
## Summary
- Add customer and customer group schema/API.
- Resolve POS prices by selected customer group or default price list.
- Add POS customer search/create/select panel.

## Verification
- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run test:functions
- npm run test:e2e
- Server supabase:reset
- Server test:db
- Server API smoke for /customers and /pricing/resolve
```

---

## Self-Review

Spec coverage:

- Required customer code/name: Task 1 migration constraints and Task 2 validation.
- Optional unique phone: Task 1 phone normalization/unique index and Task 2 conflict mapping.
- Auto-generated `KH000001`: Task 1 `next_customer_code` and Task 2 repository create.
- No customer group uses default price list: Task 2 repository price resolution.
- Customer group uses group price list: Task 2 repository price resolution.
- POS customer selection: Task 3 CustomerPanel and PosShell wiring.

Intentionally deferred:

- recent manual price history
- order persistence
- checkout/payment/debt/cashbook
- inventory/stock editing/stocktake

Placeholder scan: no `TBD`, `TODO`, `FIXME`, or unspecified task remains in this plan.
