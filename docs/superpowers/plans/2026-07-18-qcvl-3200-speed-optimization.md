# QCVL 3200 Speed Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `http://100.84.228.125:3200` feel fast on `dashboard`, `finance`, and `sales-documents` by removing expensive read-path work and paging heavy collections in SQL.

**Architecture:** Keep schema changes in migrations, not in hot read paths. Push list paging, summary aggregation, and filter predicates into PostgreSQL, then hydrate only the current page in Node. Validate with direct browser timing on `3200`, not just unit tests.

**Tech Stack:** React, Vite, TypeScript, Node API, PostgreSQL, Vitest, Browser plugin.

**Acceptance Budget:** `dashboard` first meaningful screen under 2s, `finance` under 2.5s, `sales-documents` under 2.5s, cashbook first page under 1s on NAS LAN after deploy.

**Execution Order:** Run Task 3 first, then Task 2, then Task 4. Task 3 removes schema work from read paths so Task 2 numbers are real.

---

### Task 1: Lock Baseline And Hot Path Budget

**Files:**
- Modify: `docs/PERFORMANCE-FIX-LOG.md`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`
- Test: `server/http.test.ts`

- [ ] **Step 1: Record browser baseline and request budget**

Record in `docs/PERFORMANCE-FIX-LOG.md`:

```text
- dashboard visible time
- finance visible time
- sales-documents visible time
- first page time for /api/v1/finance/cashbook?page=1&page_size=20
- top slow API call per page
```

- [ ] **Step 2: Run the baseline check**

Run:

```powershell
npx vitest run server/http.test.ts
```

Expected: current state documented, with budget numbers for later comparison.

- [ ] **Step 3: Record actual hotspot data**

Use Browser on `http://100.84.228.125:3200/dashboard`, `http://100.84.228.125:3200/finance`, and `http://100.84.228.125:3200/sales-documents`, then record:

```text
- page visible time
- console errors/warnings
- top slow API calls
- whether page waits for full collections
```

- [ ] **Step 4: Update perf log**

Write the measured baseline and suspected hot path to `docs/PERFORMANCE-FIX-LOG.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/PERFORMANCE-FIX-LOG.md docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md server/http.test.ts
git commit -m "docs: record 3200 speed baseline"
```

### Task 2: Move Cashbook List To SQL Paging

**Files:**
- Modify: `server/db.ts`
- Modify: `server/http.ts`
- Test: `server/db.test.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Write failing paging test**

```ts
test('lists cashbook entries with SQL paging and summary', async () => {
  const response = await handler(new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=20', { headers: { authorization } }))
  const body = await response.json()
  expect(body.data.page_size).toBe(20)
  expect(body.data.items.length).toBeLessThanOrEqual(20)
  expect(body.data.summary).toEqual(expect.objectContaining({
    opening_balance: expect.any(Number),
    total_in: expect.any(Number),
    total_out: expect.any(Number),
    ending_balance: expect.any(Number),
  }))
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts
```

Expected: fail until SQL paging exists.

- [ ] **Step 3: Implement `listCashbookEntriesPage`**

Add SQL in `server/db.ts` that:

```ts
select
  ...
from cashbook_entries
where organization_id = $1
  and filter predicates
order by created_at desc
limit $pageSize offset $offset
```

Also compute summary in SQL with the same filtered set, not by loading all rows into JS.

- [ ] **Step 4: Wire HTTP route**

Make `server/http.ts` add the `ServerRepository` method and return type for the cashbook page response, then use the paging method for `/api/v1/finance/cashbook` when repository supports it.

- [ ] **Step 5: Run tests until green**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add server/db.ts server/http.ts server/db.test.ts server/http.test.ts
git commit -m "perf: page cashbook list in sql"
```

### Task 3: Remove Read-Path Schema Work

> Run this before Task 2. It removes one-time schema work from the benchmark path so the paging fix can be measured cleanly.

**Files:**
- Modify: `server/db.ts`
- Test: `server/db.test.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Write regression for repeated read calls**

```ts
test('read endpoints do not repeat schema migration work per call', async () => {
  const first = await handler(new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=20', { headers: { authorization } }))
  const second = await handler(new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=20', { headers: { authorization } }))
  expect(first.status).toBe(200)
  expect(second.status).toBe(200)
})
```

- [ ] **Step 2: Run the test and observe current slowness**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts
```

- [ ] **Step 3: Keep schema guards one-time per `pg.Pool`**

Add `WeakMap<pg.Pool, Promise<void>>` caching around:

```ts
ensureFinanceAccountsTable(pool)
ensureSalesFinanceTables(pool)
```

and keep any `update ... set base_code ...` style migration work off hot read paths.

- [ ] **Step 4: Verify no DDL/DML in list reads**

Ensure read methods only select/hydrate.

- [ ] **Step 5: Run tests**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add server/db.ts server/http.ts server/db.test.ts server/http.test.ts
git commit -m "perf: cache schema guards on read path"
```

### Task 4: Trim Dashboard Bootstrap

**Files:**
- Modify: `src/features/dashboard/dashboard-service.ts`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Test: `src/features/dashboard/dashboard-service.test.ts`
- Test: `src/features/dashboard/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing timing/shape test**

```ts
test('dashboard loads only initial activity page and no detail waterfall', async () => {
  const data = await service.loadDashboardData()
  expect(data.activities.length).toBeLessThanOrEqual(20)
  expect(data.hasMoreActivities).toBeTypeOf('boolean')
})
```

- [ ] **Step 2: Run dashboard tests**

Run:

```powershell
npx vitest run src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
```

- [ ] **Step 3: Keep dashboard list lean**

Ensure `loadDashboardData` does not fetch full detail trees, and dashboard top cards only use the data they visibly need.

- [ ] **Step 4: Keep activity tab lazy**

Only load more when scroll reaches bottom; keep initial page size at 20 unless layout proves another number is needed.

- [ ] **Step 5: Run tests and browser check**

Run:

```powershell
npx vitest run src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
```

Then Browser check `3200/dashboard` for first paint and visible KPI state.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/dashboard-service.ts src/features/dashboard/DashboardPage.tsx src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
git commit -m "perf: trim dashboard bootstrap"
```

### Task 5: Verify On NAS And Update Docs

**Files:**
- Modify: `docs/PERFORMANCE-FIX-LOG.md`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [ ] **Step 1: Build and verify**

Run:

```powershell
npm run typecheck
npx vitest run server/http.test.ts server/db.test.ts src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
npm run build:nas
npm run verify:nas-bundle
```

- [ ] **Step 2: Deploy to NAS**

Run:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_SSH_TARGET='<nas-user>@100.84.228.125'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_SSH_TARGET
```

- [ ] **Step 3: Smoke the public pages**

Open:

```text
http://100.84.228.125:3200/dashboard
http://100.84.228.125:3200/finance
http://100.84.228.125:3200/sales-documents
```

Check:

```text
- page shows real content
- no console error spam
- finance list paints fast
- cashbook scroll/page responds fast
- no full-page freeze on load
- each page stays inside acceptance budget
```

- [ ] **Step 4: Update perf log with before/after**

Record measured timings and what changed in `docs/PERFORMANCE-FIX-LOG.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/PERFORMANCE-FIX-LOG.md docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md
git commit -m "docs: record 3200 speed verification"
```

### Task 6: Remove Sales Documents Detail Waterfall

**Files:**
- Modify: `server/db.ts`
- Modify: `src/features/sales-documents/SalesDocumentsPage.tsx`
- Test: `server/http.test.ts`
- Test: `server/db.test.ts`
- Test: `src/features/sales-documents/SalesDocumentsPage.test.tsx`

- [ ] **Step 1: Write failing direct-open test**

```ts
it('loads route-open invoice detail by code without waiting for the list id lookup', async () => {
  window.history.pushState({}, '', '/sales-documents?open=HD010985&type=invoice')
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [listItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => detail),
  })

  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await waitFor(() => expect(service.getSalesDocument).toHaveBeenCalledWith('HD010985'))
  expect(await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm current code still waits for list id lookup**

Run:

```powershell
npx vitest run src/features/sales-documents/SalesDocumentsPage.test.tsx
```

Expected: fail until initial open path can fetch detail directly by code.

- [ ] **Step 3: Allow sales document lookup by id or code**

Change PostgreSQL `getSalesDocument` in `server/db.ts` to:

```sql
where o.organization_id = $1 and (o.id = $2 or o.code = $2)
```

Keep response shape unchanged so existing callers still work.

- [ ] **Step 4: Start detail fetch from `open=` immediately**

In `SalesDocumentsPage`, start:

```ts
const openDetailPromise = routeFilters.open ? service.getSalesDocument(routeFilters.open) : null
```

Use it alongside the initial list request so `open=HD...` does not wait for list-to-id lookup before the detail request starts.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts src/features/sales-documents/SalesDocumentsPage.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add server/db.ts src/features/sales-documents/SalesDocumentsPage.tsx server/http.test.ts server/db.test.ts src/features/sales-documents/SalesDocumentsPage.test.tsx
git commit -m "perf: remove sales documents detail waterfall"
```

### Risk Ledger

- `cashbook` still risks slow first paint until SQL paging lands.
- Dashboard can look fast while inner read paths stay slow; verify with API timing, not screenshot only.
- NAS restart can hide local fixes if `qcvl-app` does not reload current build.
