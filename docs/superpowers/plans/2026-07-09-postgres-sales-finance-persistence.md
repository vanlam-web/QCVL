# PostgreSQL Sales And Finance Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move POS checkout, quotations, customer debt, payment receipts, and cashbook from in-memory demo arrays to PostgreSQL so NAS restart does not lose customer 11 invoices or debt.

**Architecture:** Keep the current HTTP contracts stable for the frontend. Add proper PostgreSQL tables and a sales-finance repository, then route write/read APIs through the repository while preserving demo seed data. Do not touch visual UI except where tests reveal stale reload behavior.

**Tech Stack:** Node.js HTTP server, TypeScript, PostgreSQL 16, `pg`, Vitest, Playwright NAS smoke.

---

## Guardrails

- Work only on local/dev `127.0.0.1:3202` first.
- Do not deploy NAS until all tests, typecheck, lint, build, bundle verify, and manual API checks pass.
- Do not remove in-memory fixtures until PostgreSQL reads return equivalent data.
- Final state must not be hybrid for sales/finance runtime data: checkout, quotes, sales documents, debt, debt collection, and cashbook must read/write PostgreSQL as source of truth.
- In-memory fixtures may remain only as seed source or fallback for non-sales/finance demo endpoints.
- Keep frontend API shape unchanged.
- Commit after each phase.
- NAS deploy only after user says push/deploy.

## Current Progress Snapshot

- Done: Task 1 restart tests for customer 11 checkout and bank debt collection.
- Done: Task 2 schema DDL in `database/schema.sql`.
- Done: Task 3-6 repository and API routing for newly-created sales/finance data.
- Done: Task 7B code path: when repository supports sales/finance methods, sales documents, customer debt, cashbook, and customer financial totals use repository data instead of RAM merge.
- Done: Task 7C verification script `npm run verify:sales-finance-persistence`.
- Done: ran migration against NAS PostgreSQL on 2026-07-09.
- Done: seeded demo sales/finance data into PostgreSQL through repository startup seed.
- Done: real DB restart proof on NAS with `HD-POS-021-4330498D` and `PT-CN-MRD47JDC-72CF`.
- Done: NAS deploy and smoke verified on `http://100.84.228.125:3200`.

## File Map

- Modify: `database/schema.sql`
  - Add tables for orders, order_items, payment_receipts, payment_receipt_methods, customer_debt_entries, cashbook_entries.
- Modify: `server/db.ts`
  - Add migration helpers and repository methods for sales/finance persistence.
- Modify: `server/http.ts`
  - Replace in-memory reads/writes for sales documents, checkout, quotes, debt collections, customer debt, and cashbook with repository calls.
- Modify: `server/http.test.ts`
  - Add restart-style persistence tests.
- Modify: `scripts/db-migrate.mjs`
  - Keep migration idempotent and NAS-safe if current script needs schema file changes.
- Modify: `docs/04-DATABASE/Sales/POS-TABLES.md`
  - Mark current runtime tables as implemented.
- Modify: `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
  - Mark payment/debt tables as implemented.
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`
  - Add deploy rule: run migration before restart when schema changes.

---

### Task 1: Baseline Reproduction And Contract Lock

**Files:**
- Modify: `server/http.test.ts`

- [x] **Step 1: Add failing persistence test for checkout after restart**

Add a test that creates a handler, posts checkout for `customer-011`, then creates a second handler using the same repository and expects the invoice/debt to still exist.

```ts
test('persists POS checkout invoice debt across handler restart', async () => {
  const repository = makeRepository()
  const firstHandler = createHttpHandler({ repository })
  const authorization = await login(firstHandler)

  const checkout = await firstHandler(new Request('http://api.local/api/v1/orders/checkout', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      customer_id: 'customer-011',
      note: 'Persistent customer 11 invoice',
      items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000 }],
      payment: { cash_amount: 300000, bank_amount: 0, bank_account_id: null },
    }),
  }))
  const checkoutBody = await checkout.json()

  const secondHandler = createHttpHandler({ repository })
  const documents = await secondHandler(new Request('http://api.local/api/v1/sales-documents?customer_id=customer-011&type=invoice&page=1&page_size=20', { headers: { authorization } }))
  const debt = await secondHandler(new Request('http://api.local/api/v1/finance/customers/customer-011/debt', { headers: { authorization } }))
  const documentsBody = await documents.json()
  const debtBody = await debt.json()

  expect(checkout.status).toBe(201)
  expect(documentsBody.data.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: checkoutBody.data.order.id, debt_amount: 300000, payment_status: 'partial' }),
  ]))
  expect(debtBody.data.total_debt).toBe(300000)
  expect(debtBody.data.invoices).toEqual(expect.arrayContaining([
    expect.objectContaining({ order_id: checkoutBody.data.order.id, remaining_debt: 300000 }),
  ]))
})
```

- [x] **Step 2: Run failing test**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: FAIL because current in-memory handler loses data when runtime is recreated.

- [x] **Step 3: Add failing persistence test for debt collection after restart**

Create an invoice for `customer-011`, collect `100000` by bank, create a second handler, then verify remaining debt and cashbook entry persist.

- [x] **Step 4: Run failing test**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: FAIL until PostgreSQL repository owns sales/finance writes.

---

### Task 2: PostgreSQL Schema

**Files:**
- Modify: `database/schema.sql`

- [x] **Step 1: Add sales tables**

Add idempotent table DDL:

```sql
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  order_type text not null check (order_type in ('invoice', 'quote')),
  status text not null,
  customer_id text,
  customer_snapshot jsonb not null,
  seller_snapshot jsonb not null,
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  debt_amount numeric(14,2) not null default 0,
  payment_status text not null,
  note text not null default '',
  source_quote_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists orders_org_type_created_idx
  on orders (organization_id, order_type, created_at desc);

create index if not exists orders_org_customer_idx
  on orders (organization_id, customer_id);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  quantity numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create index if not exists order_items_order_idx on order_items (order_id, sort_order);
```

- [x] **Step 2: Add finance tables**

Add idempotent table DDL:

```sql
create table if not exists payment_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  customer_id text,
  order_id uuid references orders(id) on delete set null,
  total_received_amount numeric(14,2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists payment_receipt_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  payment_receipt_id uuid not null references payment_receipts(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  method text not null check (method in ('cash', 'bank_transfer')),
  finance_account_id text not null,
  amount numeric(14,2) not null,
  bank_transaction_ref text,
  allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_debt_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id text not null,
  order_id uuid not null references orders(id) on delete cascade,
  original_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  remaining_debt numeric(14,2) not null,
  status text not null check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create index if not exists customer_debt_entries_customer_idx
  on customer_debt_entries (organization_id, customer_id, status, created_at desc);

create table if not exists cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  status text not null default 'posted',
  direction text not null check (direction in ('in', 'out')),
  amount_delta numeric(14,2) not null,
  finance_account jsonb not null,
  counterparty jsonb not null,
  note text not null default '',
  source_type text not null,
  source jsonb not null default '{}'::jsonb,
  allocations jsonb not null default '[]'::jsonb,
  is_business_accounted boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists cashbook_entries_org_created_idx
  on cashbook_entries (organization_id, created_at desc);
```

- [x] **Step 3: Run migration locally**

Run:

```powershell
npm run db:migrate
```

Expected: exit 0, no duplicate table/index errors.

---

### Task 3: Repository Interface And Mapping

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`

- [x] **Step 1: Extend `ServerRepository`**

Add methods:

```ts
listSalesDocuments(input): Promise<{ items: SalesDocument[]; total: number }>
getSalesDocument(id: string): Promise<SalesDocument | null>
createSalesDocument(input): Promise<SalesDocument>
updateSalesDocumentPayment(input): Promise<void>
listCustomerDebts(input): Promise<{ items: CustomerDebtSummary[]; total: number }>
getCustomerDebt(customerId: string): Promise<CustomerDebtDetail>
collectCustomerDebt(input): Promise<{ payment_receipt_id: string; allocated_amount: number }>
listCashbookEntries(input): Promise<{ items: CashbookEntry[]; total: number }>
```

- [x] **Step 2: Keep fallback fixture repository**

If a method is missing, `server/http.ts` keeps using current in-memory path for tests not yet migrated.

- [x] **Step 3: Implement PostgreSQL row mapping in `server/db.ts`**

Map `orders.customer_snapshot` back to current API shape:

```ts
{
  id: row.id,
  code: row.code,
  order_type: row.order_type,
  status: row.status,
  created_at: row.created_at.toISOString(),
  customer: row.customer_snapshot,
  seller: row.seller_snapshot,
  subtotal_amount: Number(row.subtotal_amount),
  discount_amount: Number(row.discount_amount),
  total_amount: Number(row.total_amount),
  paid_amount: Number(row.paid_amount),
  debt_amount: Number(row.debt_amount),
  payment_status: row.payment_status,
  note: row.note,
  items: row.items ?? [],
}
```

- [x] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit 0.

---

### Task 4: Checkout And Quote Writes

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [x] **Step 1: Route `POST /api/v1/orders/checkout` through repository**

Keep current response shape:

```ts
{
  order: {
    id,
    code,
    order_type: 'invoice',
    status: 'completed',
    total_amount,
    paid_amount,
    debt_amount,
    payment_status,
  },
  payment_receipt,
  inventory_warnings: [],
}
```

- [x] **Step 2: Repository transaction**

Within one PostgreSQL transaction:

1. Insert `orders`.
2. Insert `order_items`.
3. Insert `customer_debt_entries` when `debt_amount > 0`.
4. Insert `payment_receipts` and `payment_receipt_methods` when paid amount > 0.
5. Insert `cashbook_entries` per cash/bank method.
6. Commit.

- [x] **Step 3: Route `POST /api/v1/orders/quotes` through repository**

Insert order with `order_type = 'quote'`, no debt entry, no cashbook entry.

- [x] **Step 4: Run checkout tests**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: checkout, quote, debt, and cashbook tests pass.

---

### Task 5: Read APIs From PostgreSQL

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [x] **Step 1: Route sales document list/detail**

Use repository for:

```txt
GET /api/v1/sales-documents
GET /api/v1/sales-documents/:id
```

Filters must preserve current behavior:

```txt
search, type, status, customer_id, from, to, page, page_size
```

- [x] **Step 2: Route customer debts**

Use repository for:

```txt
GET /api/v1/finance/customer-debts
GET /api/v1/finance/customers/:id/debt
```

Only `customer_debt_entries.status = 'open'` and `remaining_debt > 0` count.

- [x] **Step 3: Route cashbook list/detail**

Use repository for:

```txt
GET /api/v1/finance/cashbook
GET /api/v1/finance/cashbook/:id
```

- [x] **Step 4: Run API tests**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: all server HTTP tests pass.

---

### Task 6: Debt Collection Writes

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [x] **Step 1: Route `/api/v1/finance/debt-collections` through repository**

Allocate payment oldest debt first by `customer_debt_entries.created_at`.

- [x] **Step 2: Transaction rules**

Within one PostgreSQL transaction:

1. Lock open debt rows for customer.
2. Allocate payment to rows oldest first.
3. Update `customer_debt_entries.paid_amount`, `remaining_debt`, `status`.
4. Update `orders.paid_amount`, `debt_amount`, `payment_status`.
5. Insert `payment_receipts`.
6. Insert `payment_receipt_methods`.
7. Insert `cashbook_entries`.
8. Commit.

- [x] **Step 3: Run partial bank collection test**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: customer 11 partial bank payment remains visible in customer detail debt after handler restart.

---

### Task 7: Demo Seed Migration

**Files:**
- Modify: `server/db.ts`
- Modify: `scripts/db-migrate.mjs`
- Modify: `server/http.test.ts`

- [x] **Step 1: Seed demo orders only when no orders exist**

On migration or server startup, insert current 20 demo sales documents into `orders` and `order_items` if organization has no orders.

- [x] **Step 2: Seed matching debt entries**

For each seeded invoice with `debt_amount > 0`, insert one open `customer_debt_entries`.

- [x] **Step 3: Seed matching cashbook entries**

Insert current demo cashbook rows, preserving current API list count and display values.

- [x] **Step 4: Run demo consistency test**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: demo customers total debt equals open debt entries; sales document list has at least 20 rows.

---

### Task 7B: Remove Hybrid RAM Fallback For Sales/Finance

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [x] **Step 1: Add DB-required test for production repository path**

Add a test proving that when a repository provides sales/finance methods, these routes do not use module-level arrays:

```ts
test('uses repository as sales finance source of truth when repository supports it', async () => {
  const repo = persistentRepository(await hashPassword('ChangeMe123!'))
  const handler = createHttpHandler({ repository: repo })
  const authorization = await login(handler)

  const documents = await handler(new Request('http://api.local/api/v1/sales-documents?page=1&page_size=100', { headers: { authorization } }))
  const debts = await handler(new Request('http://api.local/api/v1/finance/customer-debts?page=1&page_size=100', { headers: { authorization } }))
  const cashbook = await handler(new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=100', { headers: { authorization } }))

  expect((await documents.json()).data.items).toEqual([])
  expect((await debts.json()).data.items).toEqual([])
  expect((await cashbook.json()).data.items).toEqual([])
})
```

Expected before implementation: FAIL because routes merge repository data with RAM demo arrays.

- [x] **Step 2: Change sales/finance routes to repository-only when supported**

When repository implements the relevant method:

```ts
if (repository.listSalesDocuments) {
  return { found: true, data: paged(await repository.listSalesDocuments({ organizationId, url }), page, pageSize) }
}
```

Apply same rule to:

```txt
GET /api/v1/sales-documents
GET /api/v1/sales-documents/:id
GET /api/v1/finance/customer-debts
GET /api/v1/finance/customers/:id/debt
POST /api/v1/finance/debt-collections
GET /api/v1/finance/cashbook
GET /api/v1/finance/cashbook/:id
```

- [x] **Step 3: Keep RAM fallback only for test repositories without DB methods**

If repository does not expose sales/finance methods, keep current in-memory behavior so existing unit tests can still use light stubs.

- [x] **Step 4: Run tests**

Run:

```powershell
npm test -- server/http.test.ts
npm run typecheck
npm run lint
```

Expected: exit 0.

---

### Task 7C: Real PostgreSQL Verification Harness

**Files:**
- Create: `scripts/verify-sales-finance-persistence.mjs`
- Modify: `package.json`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [x] **Step 1: Add API-level persistence script**

The script must:

1. Log in with `QCVL_VERIFY_PASSWORD`.
2. Create checkout invoice for `DEV20-KH-011`.
3. Collect `100000` by bank.
4. Call `/api/v1/sales-documents`, `/api/v1/finance/customers/customer-011/debt`, `/api/v1/finance/cashbook`.
5. Print the order code, remaining debt, and cashbook code.
6. Exit non-zero if any item is missing.

- [x] **Step 2: Add npm script**

Add:

```json
"verify:sales-finance-persistence": "node scripts/verify-sales-finance-persistence.mjs"
```

- [x] **Step 3: Document restart check**

Docs must state:

```text
Run verify:sales-finance-persistence before restart.
Restart app.
Run verify:sales-finance-persistence in read-only check mode for the created order code.
```

---

### Task 8: Full Verification And NAS Deploy

**Files:**
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [x] **Step 1: Run full local verification**

Run:

```powershell
npm test -- server/http.test.ts
npm run typecheck
npm run lint
$env:VITE_API_BASE_URL='http://100.84.228.125:3200'
$env:VITE_APP_ENV='nas-dev'
npm run build:all
npm run verify:nas-bundle
Remove-Item Env:\VITE_API_BASE_URL
Remove-Item Env:\VITE_APP_ENV
```

Expected: all commands exit 0.

- [x] **Step 2: Test real DB restart flow**

On `http://100.84.228.125:3200`:

1. Create invoice for `DEV20-KH-011`.
2. Pay part by bank.
3. Open `KhÃ¡ch hÃ ng > DEV20-KH-011 > Ná»£ cáº§n thu`.
4. Verify invoice remains in debt detail.
5. Restart local API.
6. Verify same invoice remains.

- [x] **Step 3: Deploy to NAS only after user approval**

Copy bundle and run migration before restart:

```powershell
npm run db:migrate
robocopy dist "\\100.84.228.125\docker\QCVL\app\dist" /E
robocopy dist-server "\\100.84.228.125\docker\QCVL\app\dist-server" /E
ssh -tt -o StrictHostKeyChecking=no <nas-user>@100.84.228.125 "sudo -S /usr/local/bin/docker restart qcvl-app"
```

- [x] **Step 4: NAS smoke**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://100.84.228.125:3200/api/v1/health
$env:QCVL_SMOKE_PASSWORD='<admin-password>'
npm run smoke:nas
Remove-Item Env:\QCVL_SMOKE_PASSWORD
```

Expected: health ok, smoke status ok.

- [x] **Step 5: NAS persistence proof**

On NAS:

1. Create invoice for `DEV20-KH-011`.
2. Pay part by bank.
3. Restart `qcvl-app`.
4. Open `KhÃ¡ch hÃ ng > DEV20-KH-011 > Ná»£ cáº§n thu`.
5. Confirm invoice still exists.
6. Open `HÃ³a Ä‘Æ¡n`, confirm invoice exists.
7. Open `Sá»• quá»¹`, confirm bank collection exists.

---

## Completion Criteria

- Customer 11 invoice created on NAS remains after container restart.
- Partial bank payment appears in customer debt detail, sales document detail, and cashbook.
- No API response shape changes.
- No Supabase/Docker confusion added back into docs.
- Docs state PostgreSQL is the source of truth for sales/finance runtime data.

