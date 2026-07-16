# Project Health Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dua QCVL ve trang thai "green by default": lint sach, typecheck/test/build on dinh, test phu du cac luong rui ro, va CI lam canh cua dang tin cho duong dai.

**Architecture:** Lam theo batch nho, moi batch sua mot nhom loi va co lenh xac minh rieng. Khong rewrite kien truc lon, khong doi business flow, khong deploy NAS trong plan nay. Uu tien giam no ky thuat dang lam CI do truoc, sau do them regression tests cho nhung luong vua cham.

**Tech Stack:** React 19, Vite 8, TypeScript 6, ESLint 10, react-hooks compiler lint, Vitest, Playwright, GitHub Actions, Node 22.

**Execution Status - 2026-07-16:** Implemented and committed as `ca05a84`. `npm run verify:local` passed with 79 test files and 551 tests. `npm run verify:nas-build` passed and only built/verified NAS bundle. Follow-up deploy-copy to NAS happened after plan completion with `QCVL_NAS_RESTART=false`; health trace `03587c69-ef05-450d-b74f-46a1553d45c2`.

---

## Current Baseline

Known passing:

```powershell
npm run typecheck
npx vitest run src/features/finance/FinancePage.test.tsx src/features/purchase/SuppliersPage.test.tsx src/features/pos/ProductGrid.test.tsx
npm test
```

Known failing:

```powershell
npm run lint
```

Current lint failure classes:

- Unused vars: `scripts/import-dev-memory-state-to-postgres.ts`, `server/db.test.ts`, `server/http.test.ts`, `src/features/finance/FinancePage.tsx`, `src/features/purchase/SuppliersPage.tsx`.
- Explicit `any`: `server/db.test.ts`, `server/dev-memory-repository.test.ts`, `src/features/finance/finance-service.test.ts`.
- React hooks/compiler: `src/components/ui-shell/use-chip-selection.ts`, `src/features/admin/FoundationAdminPage.tsx`, `src/features/finance/FinancePage.tsx`, `src/features/inventory/InventoryPage.tsx`, `src/features/pos/ProductGrid.tsx`, `src/features/purchase/PurchaseReceiptsPage.tsx`, `src/features/sales-documents/SalesDocumentsPage.tsx`.
- Warnings: hook dependency warnings in POS, finance, sales documents, purchase receipts.

## File Structure Target

Modify:

- `scripts/import-dev-memory-state-to-postgres.ts`
  - Remove unused local helper `upsertSalesDocument`; current lint shows it is defined but never used.
- `server/db.test.ts`
  - Remove unused callback params and replace `any` with narrow helper types.
- `server/dev-memory-repository.test.ts`
  - Replace `as any` with local fixture types or `unknown` plus typed casts.
- `server/http.test.ts`
  - Remove unused `input` param.
- `src/components/ui-shell/use-chip-selection.ts`
  - Remove sync `setState` effect; initialize from derived inputs and keep selection reconciliation event-driven.
- `src/components/ui-shell/use-chip-selection.test.ts`
  - Create.
  - Add tests for option shrink, locked ids, and initial ids.
- `src/features/admin/FoundationAdminPage.tsx`
  - Fix memoization issue by deriving `roleRows` without `useMemo`.
- `src/features/finance/FinancePage.tsx`
  - Convert `hydrateCashbookDetail` to `useCallback` before `hydrateCashbookCounterparties`.
  - Replace unused destructured `id` names with helper `financeAccountPayload`.
- `src/features/finance/FinancePage.test.tsx`
  - Add negative delete confirmation tests for POS/KiotViet/auto entries.
- `src/features/finance/finance-service.test.ts`
  - Replace `any` request payload assertions with typed capture.
- `src/features/inventory/InventoryPage.tsx`
  - Replace note sync effect with keyed child component that owns draft note and save state.
- `src/features/pos/ProductGrid.tsx`
  - Remove sync `setPage` effect and include product code in accessible name.
- `src/features/pos/ProductGrid.test.tsx`
  - Update pagination/accessibility tests for code in `aria-label`.
- `src/features/purchase/PurchaseReceiptsPage.tsx`
  - Replace search-result reset effect with derived empty result.
- `src/features/purchase/SuppliersPage.tsx`
  - Remove unused `_supplier` param in `supplierDetailLoading`.
- `src/features/sales-documents/SalesDocumentsPage.tsx`
  - Replace note sync effect with keyed draft component.
- `.github/workflows/ci.yml`
  - Keep `lint`, `typecheck`, `test`, `build:all`; add NAS bundle build verification through `verify:nas-build`. This builds and checks files only; it does not deploy.
- `docs/CURRENT-DATA-SOURCE.md`
  - Add one dated note after all checks pass.
- `docs/REVIEW-ISSUES.md`
  - Record closed lint/test debt items.

---

### Task 1: Lock Baseline Before Edits

**Files:**
- Read: `package.json`
- Read: `.github/workflows/ci.yml`
- Read: `docs/REVIEW-ISSUES.md`

- [ ] **Step 1: Inspect dirty tree**

Run:

```powershell
git status --short --branch
```

Expected: existing user changes remain visible. Do not revert them.

- [ ] **Step 2: Capture failing lint output**

Run:

```powershell
npm run lint
```

Expected: FAIL with current lint classes listed in this plan. Copy the failing file/line list into the worker notes before editing.

- [ ] **Step 3: Confirm behavior tests still green**

Run:

```powershell
npm run typecheck
npm test
```

Expected:

```text
Test Files  78 passed (78)
Tests  547 passed (547)
```

- [ ] **Step 4: Commit only if user wants checkpoint**

If current tree has unrelated user edits, do not stage. If user explicitly asks checkpoint, stage only plan file:

```powershell
git add docs/superpowers/plans/2026-07-16-project-health-hardening.md
git commit -m "docs: plan project health hardening"
```

Expected: commit succeeds without staging app changes.

---

### Task 2: Fix Low-Risk ESLint Errors

**Files:**
- Modify: `src/features/purchase/SuppliersPage.tsx:861`
- Modify: `server/http.test.ts:383`
- Modify: `server/db.test.ts:454`
- Modify: `server/db.test.ts:545`
- Modify: `scripts/import-dev-memory-state-to-postgres.ts:280`

- [ ] **Step 1: Write no-op verification target**

Run:

```powershell
npx vitest run server/http.test.ts server/db.test.ts scripts/test-script-scope.test.mjs
```

Expected: PASS before code edits. If this fails, stop and fix that test failure first because this task should only change lint-only code.

- [ ] **Step 2: Remove unused supplier param**

Change:

```ts
function supplierDetailLoading(_supplier: Supplier) {
```

To:

```ts
function supplierDetailLoading() {
```

Change call:

```tsx
? supplierDetailLoading(supplier)
```

To:

```tsx
? supplierDetailLoading()
```

- [ ] **Step 3: Remove unused callback params in tests**

For callbacks where `values` or `input` are not used, change:

```ts
async (_sql, values) => result
```

To:

```ts
async () => result
```

Use this replacement when the callback type requires parameters:

```ts
async (..._args: unknown[]) => result
```

- [ ] **Step 4: Remove unused import helper**

In `scripts/import-dev-memory-state-to-postgres.ts`, confirm `upsertSalesDocument` has no references:

```powershell
rg -n "upsertSalesDocument" scripts/import-dev-memory-state-to-postgres.ts
```

Expected:

```text
scripts/import-dev-memory-state-to-postgres.ts:280:async function upsertSalesDocument...
```

Delete the function. If output has more than one line, stop and update this plan before editing because the baseline changed.

- [ ] **Step 5: Verify low-risk lint slice**

Run:

```powershell
npx eslint src/features/purchase/SuppliersPage.tsx server/http.test.ts server/db.test.ts scripts/import-dev-memory-state-to-postgres.ts
```

Expected: no errors for unused vars in those files. Remaining explicit `any` in `server/db.test.ts` may still fail until Task 3.

---

### Task 3: Replace `any` Debt With Narrow Test Types

**Files:**
- Modify: `server/db.test.ts:754`
- Modify: `server/db.test.ts:804`
- Modify: `server/dev-memory-repository.test.ts`
- Modify: `src/features/finance/finance-service.test.ts:149`
- Modify: `src/features/finance/finance-service.test.ts:160`

- [ ] **Step 1: Inspect each `any`**

Run:

```powershell
npx eslint server/db.test.ts server/dev-memory-repository.test.ts src/features/finance/finance-service.test.ts
```

Expected: FAIL only on `@typescript-eslint/no-explicit-any` plus already-known remaining errors.

- [ ] **Step 2: Use local JSON value type in tests**

Add near top of affected test files:

```ts
type JsonRecord = Record<string, unknown>
```

Replace:

```ts
const row = value as any
```

With:

```ts
const row = value as JsonRecord
```

When nested arrays are required, use:

```ts
const rows = value as JsonRecord[]
```

- [ ] **Step 3: Use typed API request captures**

In `src/features/finance/finance-service.test.ts`, replace request capture casts:

```ts
const init = requester.request.mock.calls[0][1] as any
```

With:

```ts
const init = requester.request.mock.calls[0][1] as RequestInit
```

For JSON body:

```ts
const body = JSON.parse(String(init.body)) as Record<string, unknown>
expect(body.amount).toBe(45000)
```

- [ ] **Step 4: Verify explicit-any cleanup**

Run:

```powershell
npx eslint server/db.test.ts server/dev-memory-repository.test.ts src/features/finance/finance-service.test.ts
```

Expected: no `no-explicit-any` errors remain in these files.

- [ ] **Step 5: Run related tests**

Run:

```powershell
npx vitest run server/db.test.ts server/dev-memory-repository.test.ts src/features/finance/finance-service.test.ts
```

Expected: PASS.

---

### Task 4: Fix React Hooks And Compiler Lints Without Behavior Drift

**Files:**
- Modify: `src/components/ui-shell/use-chip-selection.ts`
- Create: `src/components/ui-shell/use-chip-selection.test.ts`
- Modify: `src/features/admin/FoundationAdminPage.tsx`
- Modify: `src/features/finance/FinancePage.tsx`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Modify: `src/features/pos/ProductGrid.tsx`
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
- Modify: `src/features/sales-documents/SalesDocumentsPage.tsx`

- [ ] **Step 1: Write regression tests for `useChipSelection`**

Create `src/components/ui-shell/use-chip-selection.test.ts` with:

```tsx
import { act, renderHook } from '@testing-library/react'
import { useChipSelection } from './use-chip-selection'

it('keeps locked selected ids when options change', async () => {
  const { result, rerender } = renderHook(
    ({ options }) => useChipSelection({
      options,
      initialSelectedIds: ['a'],
      lockedSelectedIds: ['b'],
    }),
    { initialProps: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] } },
  )

  expect(result.current.selectedIds).toEqual(['b', 'a'])

  rerender({ options: [{ id: 'b', label: 'B' }, { id: 'c', label: 'C' }] })

  expect(result.current.selectedIds).toEqual(['b'])
})

it('adds and removes unlocked chips without duplicating ids', () => {
  const { result } = renderHook(() => useChipSelection({
    options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    initialSelectedIds: ['a'],
  }))

  act(() => {
    result.current.addChip('b')
    result.current.addChip('b')
  })
  expect(result.current.selectedIds).toEqual(['a', 'b'])

  act(() => {
    result.current.removeChip('a')
  })
  expect(result.current.selectedIds).toEqual(['b'])
})
```

Run:

```powershell
npx vitest run src/components/ui-shell/use-chip-selection.test.ts
```

Expected: PASS. This task protects behavior before changing implementation to satisfy lint.

- [ ] **Step 2: Refactor `useChipSelection` to derive initial state safely**

Use pure helper:

```ts
function reconcileSelectedIds(current: string[], options: ManagementChipOption[], initialSelectedIds: string[], lockedSelectedIds: string[]) {
  const optionIds = new Set(options.map((option) => option.id))
  const initialIds = initialSelectedIds.filter((id) => optionIds.has(id))
  const lockedIds = lockedSelectedIds.filter((id) => optionIds.has(id))
  const kept = current.filter((id) => optionIds.has(id))
  const base = kept.length > 0 ? kept : initialIds
  return uniqueIds([...lockedIds, ...base])
}
```

Replace hook body with derived selected ids and no sync state effect:

```ts
export function useChipSelection({
  options,
  initialSelectedIds,
  lockedSelectedIds = [],
}: {
  options: ManagementChipOption[]
  initialSelectedIds: string[]
  lockedSelectedIds?: string[]
}) {
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(initialSelectedIds)
  const selectedIds = useMemo(
    () => reconcileSelectedIds(draftSelectedIds, options, initialSelectedIds, lockedSelectedIds),
    [draftSelectedIds, initialSelectedIds, lockedSelectedIds, options],
  )
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options])
  const selectedOptions = selectedIds.flatMap((id) => {
    const option = optionById.get(id)
    return option ? [option] : []
  })
  const selectedSet = new Set(selectedIds)
  const unselectedOptions = options.filter((option) => !selectedSet.has(option.id))
  const lockedSet = new Set(lockedSelectedIds)

  return {
    selectedIds,
    selectedOptions,
    unselectedOptions,
    addChip(id: string) {
      if (!optionById.has(id)) return
      setDraftSelectedIds((current) => uniqueIds([...current, id]))
    },
    removeChip(id: string) {
      if (lockedSet.has(id)) return
      setDraftSelectedIds((current) => current.filter((selectedId) => selectedId !== id))
    },
    isLocked(id: string) {
      return lockedSet.has(id)
    },
  }
}
```

No ESLint disable comment in this hook.

- [ ] **Step 3: Convert `hydrateCashbookDetail` before first use**

In `src/features/finance/FinancePage.tsx`, move and convert `hydrateCashbookDetail` to `useCallback` above `hydrateCashbookCounterparties`:

```ts
const hydrateCashbookDetail = useCallback(async (detail: CashbookEntryDetail): Promise<CashbookEntryDetail> => {
  if (detail.direction !== 'in') return detail
  const documentCode = cashbookLinkedDocumentCode(detail)
  if (documentCode === null || !documentCode.startsWith('HD')) return detail
  const needsAllocationHydration = detail.allocations.length === 0
  const needsCounterpartyHydration = !cashbookCounterpartyHasName(detail.counterparty)
  if (!needsAllocationHydration && !needsCounterpartyHydration) return detail
  const salesDocument = await service.getSalesDocumentByCode(documentCode)
  if (salesDocument === null) return detail
  const allocatedAmount = Math.abs(detail.amount_delta)
  const salesDocumentCustomer = salesDocument.customer?.name.trim()
    ? {
        type: 'customer' as const,
        name: salesDocument.customer.name,
        phone: salesDocument.customer.phone,
      }
    : null
  return {
    ...detail,
    counterparty: needsCounterpartyHydration && salesDocumentCustomer !== null
      ? salesDocumentCustomer
      : detail.counterparty,
    source: { ...detail.source, order_code: salesDocument.code },
    allocations: needsAllocationHydration
      ? [{
          order_id: salesDocument.id,
          order_code: salesDocument.code,
          order_total_amount: salesDocument.total_amount,
          collected_before: Math.max(salesDocument.paid_amount - allocatedAmount, 0),
          allocated_amount: allocatedAmount,
          remaining_after: Math.max(salesDocument.debt_amount, 0),
        }]
      : detail.allocations,
  }
}, [service])
```

Then make `hydrateCashbookCounterparties` dependency explicit:

```ts
const hydrateCashbookCounterparties = useCallback(async (entries: CashbookEntry[]) => {
  const targets = entries.filter(cashbookEntryNeedsCounterpartyHydration)
  if (targets.length === 0) return
  const details = await Promise.all(targets.map(async (entry) => {
    try {
      return await hydrateCashbookDetail(await service.getCashbookEntry(entry.id))
    } catch {
      return null
    }
  }))
  const detailById = new Map(details
    .filter((detail): detail is CashbookEntryDetail => detail != null && cashbookCounterpartyHasName(detail.counterparty))
    .map((detail) => [detail.id, detail]))
  if (detailById.size === 0) return
  setCashbookEntries((current) => current?.map((item) => {
    const detail = detailById.get(item.id)
    if (detail === undefined || cashbookCounterpartyHasName(item.counterparty)) return item
    return { ...item, counterparty: detail.counterparty }
  }) ?? current)
}, [hydrateCashbookDetail, service])
```

- [ ] **Step 4: Replace unused `id` destructuring in Finance**

Add helper:

```ts
function financeAccountPayload(account: FinanceAccount): Omit<FinanceAccount, 'id'> {
  return {
    code: account.code,
    name: account.name,
    account_type: account.account_type,
    is_default_cash: account.is_default_cash,
    is_active: account.is_active,
    account_number: account.account_number,
    account_holder: account.account_holder,
    opening_balance: account.opening_balance,
    note: account.note,
    notify_on_transaction: account.notify_on_transaction,
  }
}
```

Replace:

```ts
const { id: _unusedId, ...patch } = nextAccount
```

With:

```ts
const patch = financeAccountPayload(nextAccount)
```

- [ ] **Step 5: Fix note draft sync by keyed remount**

In `src/features/inventory/InventoryPage.tsx`, remove this block from `StocktakeInlineDetail`:

```tsx
useEffect(() => {
  setNote(detail.note ?? '')
}, [detail.id, detail.note])
```

Then key the detail component at the call site:

```tsx
<StocktakeInlineDetail
  key={stocktakeDetail.id}
  detail={stocktakeDetail}
  onCancel={() => setStocktakeCancelOpen(true)}
  onSaveNote={saveStocktakeDetailNote}
/>
```

In `src/features/sales-documents/SalesDocumentsPage.tsx`, remove this block from `SalesDocumentDetailView`:

```tsx
useEffect(() => {
  setNote(document?.note ?? '')
}, [document?.id, document?.note])
```

Then key the detail component at the call site:

```tsx
<SalesDocumentDetailView
  key={selected?.id ?? detailErrorDocumentId ?? loadingDocumentId ?? document.id}
  document={selected}
  editDisabled={openingQuoteId === document.id}
  error={detailError}
  loading={loadingDocumentId === document.id}
  onEdit={
    document.order_type === 'quote' && document.status === 'active' && orderService && onOpenQuoteInPos
      ? () => void openQuoteInPos(document)
      : undefined
  }
  onCancel={() => setCancelOpen(true)}
  onOpenQuotePrint={onOpenQuotePrint}
  onSaveNote={saveSelectedDocumentNote}
/>
```

Keyed remount replaces draft-note synchronization. Do not add a new effect that calls `setNote`.

- [ ] **Step 6: Fix `ProductGrid` page clamp without sync effect**

Replace:

```ts
useEffect(() => {
  setPage((current) => Math.min(current, totalPages))
}, [totalPages])
```

With event-time clamp:

```ts
const safePage = Math.min(page, totalPages)
```

Keep `safePage` for rendering and navigation. Do not set state in effect.

- [ ] **Step 7: Verify hook/compiler lint slice**

Run:

```powershell
npx eslint src/components/ui-shell/use-chip-selection.ts src/features/admin/FoundationAdminPage.tsx src/features/finance/FinancePage.tsx src/features/inventory/InventoryPage.tsx src/features/pos/ProductGrid.tsx src/features/purchase/PurchaseReceiptsPage.tsx src/features/sales-documents/SalesDocumentsPage.tsx
```

Expected: no errors and no warnings for these files.

- [ ] **Step 8: Run affected tests**

Run:

```powershell
npx vitest run src/components/ui-shell/use-chip-selection.test.ts src/features/finance/FinancePage.test.tsx src/features/inventory/InventoryPage.test.tsx src/features/pos/ProductGrid.test.tsx src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/sales-documents/SalesDocumentsPage.test.tsx src/features/admin/FoundationAdminPage.test.tsx
```

Expected: PASS.

---

### Task 5: Add Regression Tests For Recent UX/Finance Changes

**Files:**
- Modify: `src/features/finance/FinancePage.test.tsx`
- Modify: `src/features/pos/ProductGrid.test.tsx`
- Modify: `src/features/purchase/SuppliersPage.test.tsx`

- [ ] **Step 1: Add Finance negative delete test**

Add:

```tsx
it('does not cancel imported or automatic cashbook entries from detail delete dialog', async () => {
  const service = makeService({
    getCashbookEntry: vi.fn(async () => ({
      ...receiptCashbookDetail,
      source: { type: 'payment_receipt', id: 'receipt-1', code: 'PT0001', order_code: 'HD0001' },
    })),
  })
  render(<FinancePage service={service} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT0001' }))
  const detail = await screen.findByRole('region', { name: /PT0001/ })
  await userEvent.click(within(detail).getByRole('button', { name: /Xóa phiếu PT0001/ }))
  const dialog = await screen.findByRole('dialog', { name: /Xóa phiếu PT0001/ })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Đã hiểu' }))

  expect(service.cancelCashbookVoucher).not.toHaveBeenCalled()
  expect(await screen.findByText(/Chỉ xóa\/hủy được phiếu thu\/chi thủ công/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Add POS accessible name test**

Update existing assertion in `src/features/pos/ProductGrid.test.tsx`:

```tsx
expect(screen.getByRole('button', { name: 'MICA-3MM Mica 3mm 120 000/m' })).toBeInTheDocument()
```

Update implementation `aria-label`:

```tsx
aria-label={`${product.code} ${product.name} ${formatMoney(price)}/${product.unit_name}`}
```

- [ ] **Step 3: Add supplier close-state test for payment/edit drafts**

Add:

```tsx
it('clears supplier payment draft when closing the selected row', async () => {
  const service = makeService()
  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierDetail()
  await userEvent.click(screen.getByRole('tab', { name: /Công nợ/ }))
  await userEvent.click(screen.getByRole('button', { name: /Thanh toán NCC/ }))
  await userEvent.click(screen.getByRole('button', { name: 'NCC000031' }))

  expect(screen.queryByRole('button', { name: /Lưu thanh toán NCC/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Run targeted regression tests**

Run:

```powershell
npx vitest run src/features/finance/FinancePage.test.tsx src/features/pos/ProductGrid.test.tsx src/features/purchase/SuppliersPage.test.tsx
```

Expected: PASS.

---

### Task 6: Make Local And CI Gates Match

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: Add `verify:local` script**

In `package.json`, add:

```json
"verify:local": "npm run lint && npm run typecheck && npm test && npm run build:all"
```

- [ ] **Step 2: Add NAS build verification script**

Add:

```json
"verify:nas-build": "npm run build:nas && npm run verify:nas-bundle"
```

This script must not call `deploy:nas`, must not SSH, and must not require `QCVL_NAS_DEPLOY_CONFIRM`.

- [ ] **Step 3: Update CI after local lint is green**

In `.github/workflows/ci.yml`, keep:

```yaml
- run: npm run lint
- run: npm run typecheck
- run: npm test
- run: npm run test:e2e:list
- run: npm run build:all
```

Add after `build:all`:

```yaml
- run: npm run verify:nas-build
```

- [ ] **Step 4: Run full local gate**

Run:

```powershell
npm run verify:local
npm run verify:nas-build
```

Expected: both PASS.

---

### Task 7: Document Health Contract

**Files:**
- Modify: `docs/CURRENT-DATA-SOURCE.md`
- Modify: `docs/REVIEW-ISSUES.md`

- [ ] **Step 1: Add current health note**

Append to `docs/CURRENT-DATA-SOURCE.md`:

```md
- Ngay `2026-07-16`: da don lint debt va them local gate `verify:local`/`verify:nas-build`. Trang thai mong doi truoc khi deploy NAS: `npm run verify:local` pass, `npm run verify:nas-build` pass, va khong deploy khi chua co `QCVL_NAS_DEPLOY_CONFIRM=true`.
```

- [ ] **Step 2: Close review issues**

In `docs/REVIEW-ISSUES.md`, add section:

```md
## Closed - 2026-07-16 Project Health Hardening

- Lint debt da duoc xu ly de `npm run lint` pass.
- Finance cashbook delete co regression test cho manual voucher va blocked automatic/imported entries.
- POS product quick card accessible name da gom ma hang.
- Local/CI gate da thong nhat qua `verify:local` va `verify:nas-build`.
```

- [ ] **Step 3: Final verification**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build:all
npm run verify:nas-build
```

Expected:

```text
npm run lint: exit 0
npm run typecheck: exit 0
npm test: all test files pass
npm run build:all: exit 0
npm run verify:nas-build: exit 0
```

- [ ] **Step 4: Optional commit health hardening**

Only run if user explicitly asks for a checkpoint commit. The implementation can remain uncommitted for review.

Run:

```powershell
git status --short
git add scripts/import-dev-memory-state-to-postgres.ts server/db.test.ts server/dev-memory-repository.test.ts server/http.test.ts src/components/ui-shell/use-chip-selection.ts src/components/ui-shell/use-chip-selection.test.ts src/features/admin/FoundationAdminPage.tsx src/features/finance/FinancePage.tsx src/features/finance/FinancePage.test.tsx src/features/finance/finance-service.test.ts src/features/inventory/InventoryPage.tsx src/features/pos/ProductGrid.tsx src/features/pos/ProductGrid.test.tsx src/features/purchase/PurchaseReceiptsPage.tsx src/features/purchase/SuppliersPage.tsx src/features/purchase/SuppliersPage.test.tsx src/features/sales-documents/SalesDocumentsPage.tsx package.json .github/workflows/ci.yml docs/CURRENT-DATA-SOURCE.md docs/REVIEW-ISSUES.md docs/superpowers/plans/2026-07-16-project-health-hardening.md
git commit -m "chore: harden project health checks"
```

Expected: commit succeeds. If unrelated user changes exist in listed files, review hunks with:

```powershell
git diff --cached
```

Unstage unrelated hunks before commit.

---

## Execution Order

1. Task 1: baseline.
2. Task 2: easy lint.
3. Task 3: test type debt.
4. Task 4: React hook/compiler debt.
5. Task 5: regression tests for recent behavior.
6. Task 6: CI/local gate.
7. Task 7: docs and final commit.

## Stop Conditions

- Stop and ask before changing NAS deploy behavior beyond verification scripts.
- Stop if a lint fix changes visible business behavior.
- Stop if tests reveal data-loss risk in finance, purchase, inventory, or POS.
- Stop if Git tree contains user edits in same hunk that cannot be separated safely.

## Success Definition

Project is healthy when all commands pass locally:

```powershell
npm run lint
npm run typecheck
npm test
npm run build:all
npm run verify:nas-build
```

No NAS deploy is part of this plan.
