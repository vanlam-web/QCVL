# Data Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce heavy list/detail data loading without changing debt, search, invoice, supplier, or stock business rules.

**Architecture:** Keep current route/page structure, but move oversized reads behind small purpose-built API calls or paged detail calls. Dashboard must stop loading the entire product catalog, customer/POS debt detail must stop fetching 1000 invoices by default, and checkout old-debt allocation must ask backend for only the open debts needed for allocation.

**Tech Stack:** TypeScript, React, Vitest, existing browser services under `src/features/*`, server HTTP router in `server/http.ts`, route modules under `server/modules/*`, PostgreSQL repository in `server/db.ts`, dev-memory repository in `server/dev-memory-repository.ts`.

---

## Scope Check

This plan follows `docs/superpowers/specs/2026-07-22-data-load-performance-design.md`.

Implement in this order:

1. Dashboard product catalog optimization.
2. Customer/POS debt detail paging.
3. Checkout old-debt allocation API.
4. Product detail lazy-load cleanup.
5. Reports summary API only if browser/API timing still shows reports as slow.

Do not deploy NAS from outside-LAN.

## File Map

- `src/features/dashboard/dashboard-service.ts`: remove `page_size=10000` product catalog fallback and use product snapshots or summary API.
- `src/features/dashboard/dashboard-service.test.ts`: regression for no full product catalog load.
- `server/modules/finance/finance-routes.ts`: add customer debt ledger/open-debts route dispatch.
- `server/http.ts`: add handlers and repository interface methods for paged ledger/open-debts.
- `server/db.ts`: implement paged customer debt ledger/open debt query from canonical debt sources.
- `server/dev-memory-repository.ts`: implement same behavior for local tests.
- `server/modules/finance/customer-debt.ts`: add pure helper for oldest-first open debt slicing if needed.
- `server/http.test.ts`, `server/db.test.ts`, `server/dev-memory-repository.test.ts`: backend regressions.
- `src/features/orders/order-service.ts`: add customer debt ledger/open-debts API client methods.
- `src/features/catalog/CustomersPage.tsx`: use paged ledger/history instead of loading 1000 invoices.
- `src/features/catalog/CustomersPage.test.tsx`: customer detail no `page_size=1000`, still shows totals.
- `src/features/pos/CustomerPanel.tsx`: use paged ledger/history same as customers.
- `src/features/pos/CustomerPanel.test.tsx`: POS detail no `page_size=1000`.
- `src/features/pos/CheckoutPanel.tsx`: use open-debts/allocation preview for old debt payment.
- `src/features/pos/CheckoutPanel.test.tsx`: old debt allocation oldest-first without 1000 invoice fetch.
- `src/features/catalog/CatalogPage.tsx`: verify or refine lazy loading for product detail tabs.
- `src/features/catalog/CatalogPage.test.tsx`: product detail tab requests only when opened.
- `docs/superpowers/specs/2026-07-22-data-load-performance-design.md`: update only if implementation must deviate.
- `Y:\TeamAI\WORKER-NOW.md`: update after each push.

---

### Task 1: Dashboard Must Not Load Product Catalog `10000`

**Files:**
- Modify: `src/features/dashboard/dashboard-service.ts`
- Test: `src/features/dashboard/dashboard-service.test.ts`

- [ ] **Step 1: Write failing test for no full product catalog load**

Add a test near existing dashboard service tests:

```ts
it('builds product rank from sales document snapshots without loading the full product catalog', async () => {
  const productService = {
    listProducts: vi.fn(async () => ({ items: [], page: 1, page_size: 10000, total: 0 })),
  }
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({
      items: [documentItem({
        id: 'order-1',
        code: 'HD000001',
        items: [{
          product_id: 'product-1',
          product_snapshot: { code: 'SP0001', name: 'Mica 3mm' },
          quantity: 2,
          line_total: 200000,
        }],
      })],
      page: 1,
      page_size: 100,
      total: 1,
    })),
  })
  const service = createDashboardService(salesDocumentService, undefined, productService, fixedClock)

  const result = await service.loadDashboardData({ productRankPeriod: 'month' })

  expect(productService.listProducts).not.toHaveBeenCalledWith(expect.objectContaining({ page_size: 10000 }))
  expect(result.topProducts[0]?.label).toBe('Mica 3mm')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm exec -- vitest run src/features/dashboard/dashboard-service.test.ts -t "without loading the full product catalog"
```

Expected: FAIL because `loadDashboardProductCatalog()` calls `listProducts({ status: 'all', page: 1, page_size: 10000 })`.

- [ ] **Step 3: Remove full catalog fallback**

Change `loadDashboardProductCatalog()` to return empty catalog unless a future compact lookup service exists. Product rank already prefers line snapshots.

```ts
async function loadDashboardProductCatalog(
  service: DashboardProductCatalogService | undefined,
  documents: DashboardProductRankDocument[],
) {
  void service
  void documents
  return []
}
```

If TypeScript flags unused types, keep the function signature but remove `DashboardProductCatalogService` from runtime needs only after all call sites compile.

- [ ] **Step 4: Run dashboard tests**

Run:

```bash
npm exec -- vitest run src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
```

Expected: PASS. No test should assert `page_size=10000`.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/dashboard-service.ts src/features/dashboard/dashboard-service.test.ts
git commit -m "fix: avoid full product catalog load on dashboard"
```

---

### Task 2: Add Backend Open Debt Slice For Oldest-First Customer Debts

**Files:**
- Modify: `server/modules/finance/finance-routes.ts`
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/dev-memory-repository.ts`
- Test: `server/http.test.ts`
- Test: `server/db.test.ts`
- Test: `server/dev-memory-repository.test.ts`

- [ ] **Step 1: Write HTTP failing test**

Add test in `server/http.test.ts` near customer debt tests:

```ts
test('returns customer open debts oldest first with limit and amount cap', async () => {
  const app = createTestServer()
  const response = await app.fetch(new Request('http://api.local/api/v1/finance/customers/customer-1/open-debts?amount=70000&limit=2', {
    headers: authHeaders(),
  }))

  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.items.map((item: { order_code: string }) => item.order_code)).toEqual(['HD000001', 'HD000002'])
  expect(body.items.reduce((sum: number, item: { allocated_amount: number }) => sum + item.allocated_amount, 0)).toBeLessThanOrEqual(70000)
})
```

- [ ] **Step 2: Run failing HTTP test**

Run:

```bash
npm exec -- vitest run server/http.test.ts -t "returns customer open debts oldest first"
```

Expected: FAIL with 404 route missing.

- [ ] **Step 3: Add route dispatch**

In `server/modules/finance/finance-routes.ts`, extend handler type:

```ts
getCustomerOpenDebts(): RouteResult
```

Add dispatch before generic customer debt route if needed:

```ts
if (method === 'GET' && /^\/api\/v1\/finance\/customers\/[^/]+\/open-debts$/.test(pathname)) {
  return handlers.getCustomerOpenDebts()
}
```

- [ ] **Step 4: Add repository method type and handler**

In `server/http.ts`, extend `ServerRepository`:

```ts
getCustomerOpenDebts?(input: {
  organizationId: string
  customerId: string
  amount?: number
  limit?: number
}): Promise<{
  items: Array<{
    order_id: string
    order_code: string
    created_at: string
    total_amount: number
    paid_amount: number
    remaining_debt: number
    allocated_amount: number
  }>
  has_more: boolean
}>
```

Add handler:

```ts
getCustomerOpenDebts: async () => {
  const currentUser = await requireCurrentUser(request, repository)
  const customerId = decodeURIComponent(url.pathname.match(/\/customers\/([^/]+)\/open-debts$/)?.[1] ?? '')
  const amount = Number(url.searchParams.get('amount') ?? '0')
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? '50'), 100))
  const data = await repository.getCustomerOpenDebts?.({
    organizationId: currentUser.organization.id,
    customerId,
    amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    limit,
  }) ?? { items: [], has_more: false }
  return { found: true, data }
}
```

- [ ] **Step 5: Implement DB/dev-memory oldest-first logic**

In both repositories, derive open rows from canonical customer debt detail:

```ts
const openRows = debt.invoices
  .filter((invoice) => invoice.remaining_debt > 0)
  .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.order_code.localeCompare(right.order_code))

let remaining = amount ?? Number.POSITIVE_INFINITY
const items = []
for (const row of openRows) {
  if (items.length >= limit || remaining <= 0) break
  const allocated = Math.min(row.remaining_debt, remaining)
  items.push({
    order_id: row.order_id,
    order_code: row.order_code,
    created_at: row.created_at,
    total_amount: row.total_amount,
    paid_amount: row.paid_amount,
    remaining_debt: row.remaining_debt,
    allocated_amount: allocated,
  })
  remaining -= allocated
}
return { items, has_more: openRows.length > items.length && remaining > 0 }
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
npm exec -- vitest run server/http.test.ts server/db.test.ts server/dev-memory-repository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/modules/finance/finance-routes.ts server/http.ts server/db.ts server/dev-memory-repository.ts server/http.test.ts server/db.test.ts server/dev-memory-repository.test.ts
git commit -m "feat: add customer open debt slices"
```

---

### Task 3: POS Checkout Uses Open Debt Slice Instead Of 1000 Invoice History

**Files:**
- Modify: `src/features/orders/order-service.ts`
- Modify: `src/features/pos/CheckoutPanel.tsx`
- Test: `src/features/pos/CheckoutPanel.test.tsx`

- [ ] **Step 1: Add failing test**

Add test near old-debt payment tests:

```ts
it('uses customer open debts for oldest-first old debt allocation without loading 1000 invoices', async () => {
  const orderService = makeOrderService({
    getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-1', total_debt: 70000, invoices: [] })),
    getCustomerOpenDebts: vi.fn(async () => ({
      items: [
        { order_id: 'old-1', order_code: 'HD000001', created_at: '2026-07-01T08:00:00.000Z', total_amount: 50000, paid_amount: 0, remaining_debt: 50000, allocated_amount: 50000 },
        { order_id: 'old-2', order_code: 'HD000002', created_at: '2026-07-02T08:00:00.000Z', total_amount: 30000, paid_amount: 0, remaining_debt: 30000, allocated_amount: 20000 },
      ],
      has_more: false,
    })),
  })
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({ items: [], page: 1, page_size: 10, total: 0 })),
  })

  render(<CheckoutPanel orderService={orderService} salesDocumentService={salesDocumentService} selectedCustomer={debtCustomer} />)

  await userEvent.click(screen.getByLabelText('Cấn vào nợ cũ'))

  expect(orderService.getCustomerOpenDebts).toHaveBeenCalledWith('customer-1', expect.objectContaining({ amount: expect.any(Number), limit: 50 }))
  expect(salesDocumentService.listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ page_size: 1000 }))
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm exec -- vitest run src/features/pos/CheckoutPanel.test.tsx -t "uses customer open debts"
```

Expected: FAIL because service method does not exist or CheckoutPanel still loads history.

- [ ] **Step 3: Extend order service**

In `src/features/orders/order-service.ts`, add:

```ts
getCustomerOpenDebts: (customerId: string, input: { amount?: number; limit?: number } = {}) => {
  const params = new URLSearchParams()
  if (input.amount !== undefined) params.set('amount', String(input.amount))
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  const query = params.toString()
  return api.request<CustomerOpenDebtResponse>(`/api/v1/finance/customers/${customerId}/open-debts${query ? `?${query}` : ''}`)
}
```

Define `CustomerOpenDebtResponse` near customer debt types.

- [ ] **Step 4: Update CheckoutPanel**

Replace old 1000-invoice fetch path for old-debt allocation with:

```ts
const openDebtResult = await orderService.getCustomerOpenDebts(selectedCustomer.id, {
  amount: oldDebtPaymentAmount,
  limit: 50,
})
setOldDebtAllocations(openDebtResult.items)
```

Keep existing UI labels and allocation submission shape.

- [ ] **Step 5: Run POS checkout tests**

Run:

```bash
npm exec -- vitest run src/features/pos/CheckoutPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/orders/order-service.ts src/features/pos/CheckoutPanel.tsx src/features/pos/CheckoutPanel.test.tsx
git commit -m "fix: load only open debts in POS checkout"
```

---

### Task 4: Customers And POS Customer Detail Stop Loading 1000 Invoices

**Files:**
- Modify: `src/features/orders/order-service.ts`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/pos/CustomerPanel.tsx`
- Test: `src/features/catalog/CustomersPage.test.tsx`
- Test: `src/features/pos/CustomerPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Customers page test:

```ts
it('opens customer debt detail without loading 1000 sales documents', async () => {
  render(<CustomersPage service={service} orderService={orderService} salesDocumentService={salesDocumentService} />)

  await userEvent.click(await screen.findByRole('button', { name: /Mở công nợ/ }))

  expect(orderService.getCustomerDebt).toHaveBeenCalledWith('customer-1')
  expect(salesDocumentService.listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ page_size: 1000 }))
})
```

POS customer panel test:

```ts
it('opens POS customer detail without loading 1000 sales documents', async () => {
  render(<CustomerPanel service={service} orderService={orderService} salesDocumentService={salesDocumentService} selectedCustomer={customer} onSelectCustomer={vi.fn()} />)

  await userEvent.click(screen.getByRole('button', { name: /Mở chi tiết khách/ }))

  expect(orderService.getCustomerDebt).toHaveBeenCalledWith('customer-1')
  expect(salesDocumentService.listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ page_size: 1000 }))
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm exec -- vitest run src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx -t "without loading 1000"
```

Expected: FAIL because current code loads `page_size=1000`.

- [ ] **Step 3: Change default history page size**

Use existing `getCustomerDebt` ledger rows for debt summary. Change sales document history fetch to page `10` or `20`.

```ts
salesDocumentService?.listSalesDocuments({
  customer_id: customer.id,
  type: 'invoice',
  page: 1,
  page_size: customerHistoryPageSize,
})
```

Do not pass `customerDebtLedgerFetchPageSize` to sales document history.

- [ ] **Step 4: Add visible "xem thêm" only if needed**

If UI already has pagination for history, wire it to call:

```ts
salesDocumentService.listSalesDocuments({
  customer_id: customer.id,
  type: 'invoice',
  page: nextPage,
  page_size: customerHistoryPageSize,
})
```

If there is no pagination, keep page one and show total count; add pagination in a separate owner-approved task only after owner asks for full history paging.

- [ ] **Step 5: Run customer/POS tests**

Run:

```bash
npm exec -- vitest run src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx
```

Expected: PASS. Debt totals must still come from `getCustomerDebt`.

- [ ] **Step 6: Commit**

```bash
git add src/features/catalog/CustomersPage.tsx src/features/pos/CustomerPanel.tsx src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx
git commit -m "fix: page customer detail history loads"
```

---

### Task 5: Product Detail Lazy Load Guard

**Files:**
- Modify: `src/features/catalog/CatalogPage.tsx`
- Test: `src/features/catalog/CatalogPage.test.tsx`

- [ ] **Step 1: Write failing test for tab-only load**

Add:

```ts
it('does not load BOM or stock detail data until the matching product detail tab is opened', async () => {
  const service = makeService()
  render(<CatalogPage service={service} />)

  await userEvent.click(await screen.findByRole('button', { name: /MICA-3MM/ }))

  expect(service.getProductBom).not.toHaveBeenCalled()
  expect(service.listStockMovements).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('tab', { name: 'Tồn kho' }))
  expect(service.listStockMovements).toHaveBeenCalledWith(expect.objectContaining({ page_size: 15 }))

  await userEvent.click(screen.getByRole('tab', { name: 'BOM' }))
  expect(service.getProductBom).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm exec -- vitest run src/features/catalog/CatalogPage.test.tsx -t "does not load BOM or stock detail"
```

Expected: FAIL if current code preloads tab data.

- [ ] **Step 3: Move data loads behind active tab checks**

Use guards like:

```ts
if (detailTab !== 'stock') return
void loadStockMovements(product)
```

and:

```ts
if (detailTab !== 'bom') return
void loadProductBom(product)
```

Keep existing `requestId`/selected product guards so stale requests do not overwrite newer detail.

- [ ] **Step 4: Run product tests**

Run:

```bash
npm exec -- vitest run src/features/catalog/CatalogPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/catalog/CatalogPage.tsx src/features/catalog/CatalogPage.test.tsx
git commit -m "fix: lazy load product detail tab data"
```

---

### Task 6: Final Verification And Push

**Files:**
- Modify: `Y:\TeamAI\WORKER-NOW.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run api:build
git diff --check
```

Expected:

- `npm test`: all tests pass.
- `npm run typecheck`: exit 0.
- `npm run api:build`: exit 0.
- `git diff --check`: no whitespace errors.

- [ ] **Step 2: Browser smoke checks**

Check locally on `http://127.0.0.1:3202`:

```text
/dashboard opens without product page_size=10000 request.
/pos customer search still debounce-searches.
/pos checkout cấn vào nợ cũ still fills old debt payment.
/customers opens debt/history without visible regression.
/products detail tabs still load correct data when clicked.
```

- [ ] **Step 3: Update TeamAI**

Add top entry:

```md
Updated: 2026-07-22 HH:mm

- outside-LAN data-load optimization code pushed YYYY-MM-DD HH:mm: Implemented Dashboard no full product catalog load, customer/POS detail no 1000 invoice fetch, checkout open-debt slice API, and product detail lazy-load guards. Verified `npm test`, `npm run typecheck`, `npm run api:build`, `git diff --check`. No NAS deploy/copy/restart from outside-LAN; inside-LAN should pull COMMIT and deploy/restart NAS when Owner wants.
```

- [ ] **Step 4: Push**

Run:

```bash
git push origin main
git status --short --branch
```

Expected: branch clean and `main...origin/main`.

---

## Self-Review

Spec coverage:

- Dashboard `page_size=10000`: Task 1.
- Customer/POS `page_size=1000`: Task 4.
- Checkout old-debt allocation API: Tasks 2 and 3.
- Product detail lazy tabs: Task 5.
- Reports summary API: documented as out of first implementation pass because spec marks it as giai đoạn 2.
- Search Enter-only/debounce preservation: Task 6 verification.
- No NAS deploy from outside-LAN: Task 6 TeamAI note.

Placeholder scan:

- No unresolved placeholder phrases remain.
- Every code task includes exact files, code shape, command, expected result, and commit command.

Type consistency:

- Backend method name: `getCustomerOpenDebts`.
- Frontend service method name: `getCustomerOpenDebts`.
- Response type fields: `items`, `has_more`, `allocated_amount`, `remaining_debt`.
