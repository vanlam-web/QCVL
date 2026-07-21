# Partner Debt Ledger Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current overlapping debt calculations with one backend-owned ledger for customer debt, supplier payable, and linked customer-supplier views.

**Execution status 2026-07-21 20:14:** Runtime slice implemented and verified locally on outside-LAN machine. Customer, supplier, and linked KH-NCC debt now use canonical backend ledger rows; Finance detail no longer synthesizes allocation rows from sales documents. No commit/push/deploy from this checkpoint.

**Architecture:** Finance owns one canonical partner-debt engine. Existing customer, supplier, POS, and finance screens read totals, open documents, and ledger rows from that engine; frontend no longer recomputes running debt. KiotViet import is normalized into QCVL debt documents/ledger rows, not used as a balance anchor.

**Tech Stack:** TypeScript, Node.js API, PostgreSQL, Vitest, React.

---

## Current Problems To Remove

- `server/modules/finance/customer-debt.ts` still treats `customer_debt_adjustments.balance_after` as a KiotViet anchor. SoT says this is wrong.
- `server/db.ts#getCustomerDebt` reads totals, invoices, adjustments, cashbook rows, and linked supplier receipts separately. Detail rows can fail to explain the headline total.
- `src/features/catalog/customer-debt-ledger.ts` builds running debt in the browser. Customers and POS can diverge from backend behavior.
- Supplier debt has no canonical ledger. `recomputeSupplierPurchaseTotals()` writes `supplier_snapshots.current_payable_amount` from `purchase_receipt_snapshots.remaining_amount`, so `PC/PCPN`, `CB`, and linked KH-NCC view history are incomplete.
- Linked KH-NCC support is half-disabled: backend returns `linked_supplier_receipts`, but frontend ignores them.
- Finance detail has UI hydration for missing allocation rows; this masks missing backend ledger data.

## Target Files

- Create: `server/modules/finance/partner-debt-ledger.ts`
- Create: `server/modules/finance/partner-debt-ledger.test.ts`
- Modify: `server/modules/finance/customer-debt.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`
- Modify: `server/db.test.ts`
- Modify: `src/features/finance/types.ts`
- Modify: `src/features/finance/finance-service.ts`
- Modify: `src/features/catalog/customer-debt-ledger.ts`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/customer-debt-ledger.test.ts`
- Modify: `src/features/catalog/CustomersPage.test.tsx`
- Modify: `src/features/pos/CustomerPanel.tsx`
- Modify: `src/features/pos/CheckoutPanel.tsx`
- Modify: `src/features/pos/CustomerPanel.test.tsx`
- Modify: `src/features/pos/CheckoutPanel.test.tsx`
- Modify: `src/features/purchase/SuppliersPage.tsx`
- Modify: `src/features/purchase/SuppliersPage.test.tsx`
- Modify: `docs/03-BUSINESS-NghiepVu/Finance/CUSTOMER-DEBT.md`
- Modify: `docs/03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md`
- Modify: `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
- Modify: `docs/05-BACKEND-MayChu/Finance/FINANCE-API.md`

---

### Task 1: Pure Ledger Sign Rules

**Files:**
- Create: `server/modules/finance/partner-debt-ledger.test.ts`
- Create: `server/modules/finance/partner-debt-ledger.ts`

- [ ] **Step 1: Write failing sign-rule tests**

Add tests:

```ts
import { describe, expect, it } from 'vitest'
import { debtDeltaForVoucher } from './partner-debt-ledger.js'

describe('partner debt sign rules', () => {
  it.each([
    ['HD011293', 'customer', false, 107352],
    ['HDO000001', 'customer', false, 107352],
    ['TT001869', 'customer', false, -3000000],
    ['TTHD011293', 'customer', false, -107352],
    ['TTHDO000001', 'customer', false, -107352],
    ['TTM000001', 'customer', false, -500000],
    ['TTMHD011293', 'customer', false, -107352],
    ['TNH000001', 'customer', false, -500000],
    ['TNHHD011293', 'customer', false, -107352],
    ['CKKH000228', 'customer', false, -15100],
    ['CB000033', 'customer', false, 179396],
    ['PN000566', 'customer', false, 0],
    ['PCPN000566', 'customer', false, 0],
    ['PN000566', 'supplier', false, 3206581],
    ['PCPN000566', 'supplier', false, -3206581],
  ])('maps %s for pure %s', (code, view, linked, expected) => {
    expect(debtDeltaForVoucher({ code, view: view as 'customer' | 'supplier', linked, sourceAmount: Math.abs(expected), normalizedAmountDelta: expected })).toBe(expected)
  })

  it('inverts linked customer-supplier signs per view', () => {
    expect(debtDeltaForVoucher({ code: 'HD011293', view: 'customer', linked: true, sourceAmount: 107352 })).toBe(107352)
    expect(debtDeltaForVoucher({ code: 'HD011293', view: 'supplier', linked: true, sourceAmount: 107352 })).toBe(-107352)
    expect(debtDeltaForVoucher({ code: 'PN000566', view: 'customer', linked: true, sourceAmount: 3206581 })).toBe(-3206581)
    expect(debtDeltaForVoucher({ code: 'PN000566', view: 'supplier', linked: true, sourceAmount: 3206581 })).toBe(3206581)
    expect(debtDeltaForVoucher({ code: 'CB000033', view: 'customer', linked: true, normalizedAmountDelta: 179396 })).toBe(179396)
    expect(debtDeltaForVoucher({ code: 'CB000033', view: 'supplier', linked: true, normalizedAmountDelta: 179396 })).toBe(-179396)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts`

Expected: fail because `partner-debt-ledger.ts` or `debtDeltaForVoucher` does not exist.

- [ ] **Step 3: Implement sign rules**

Create `partner-debt-ledger.ts`:

```ts
export type PartnerDebtView = 'customer' | 'supplier'

export function debtDeltaForVoucher(input: {
  code: string
  view: PartnerDebtView
  linked: boolean
  sourceAmount?: number
  normalizedAmountDelta?: number
}) {
  const code = input.code.trim().toUpperCase()
  const amount = Math.abs(Number(input.sourceAmount ?? input.normalizedAmountDelta ?? 0))
  const signed = Number(input.normalizedAmountDelta ?? amount)
  const customerDelta = customerViewDelta(code, amount, signed, input.linked)
  if (input.view === 'customer') return customerDelta
  return input.linked ? -customerDelta : supplierViewDelta(code, amount, signed)
}

function customerViewDelta(code: string, amount: number, signed: number, linked: boolean) {
  if (/^HDO?\d/.test(code)) return amount
  if (/^(TT|TTHD|TTHDO|TTM|TTMHD|TNH|TNHHD)\d/.test(code)) return -amount
  if (/^CKKH\d/.test(code)) return -amount
  if (/^CB\d/.test(code)) return signed
  if (/^PN\d/.test(code)) return linked ? -amount : 0
  if (/^PC(PN)?\d/.test(code)) return linked ? amount : 0
  return 0
}

function supplierViewDelta(code: string, amount: number, signed: number) {
  if (/^PN\d/.test(code)) return amount
  if (/^PC(PN)?\d/.test(code)) return -amount
  if (/^CB\d/.test(code)) return signed
  return 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts`

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/modules/finance/partner-debt-ledger.ts server/modules/finance/partner-debt-ledger.test.ts
git commit -m "test: define partner debt sign rules"
```

---

### Task 2: Canonical Ledger Builder

**Files:**
- Modify: `server/modules/finance/partner-debt-ledger.ts`
- Modify: `server/modules/finance/partner-debt-ledger.test.ts`

- [ ] **Step 1: Add failing ledger-builder tests**

Add tests:

```ts
import { buildPartnerDebtLedger } from './partner-debt-ledger.js'

it('builds pure customer total and running rows from documents', () => {
  const ledger = buildPartnerDebtLedger({
    view: 'customer',
    linked: false,
    documents: [
      { id: 'hd1', code: 'HD000001', time: '2026-07-01T01:00:00.000Z', amount: 100000, status: 'posted' },
      { id: 'tt1', code: 'TT000001', time: '2026-07-02T01:00:00.000Z', amount: 40000, status: 'posted' },
      { id: 'ck1', code: 'CKKH000001', time: '2026-07-03T01:00:00.000Z', amount: 10000, status: 'posted' },
      { id: 'cb1', code: 'CB000001', time: '2026-07-04T01:00:00.000Z', amount: 5000, normalizedAmountDelta: 5000, status: 'posted' },
    ],
  })
  expect(ledger.totalDebt).toBe(55000)
  expect(ledger.rows.map((row) => [row.code, row.amountDelta, row.balanceAfter])).toEqual([
    ['HD000001', 100000, 100000],
    ['TT000001', -40000, 60000],
    ['CKKH000001', -10000, 50000],
    ['CB000001', 5000, 55000],
  ])
})

it('skips cancelled and replaced documents', () => {
  const ledger = buildPartnerDebtLedger({
    view: 'customer',
    linked: false,
    documents: [
      { id: 'hd1', code: 'HD000001', time: '2026-07-01T01:00:00.000Z', amount: 100000, status: 'cancelled' },
      { id: 'hd2', code: 'HD000002', time: '2026-07-02T01:00:00.000Z', amount: 70000, status: 'posted' },
    ],
  })
  expect(ledger.totalDebt).toBe(70000)
  expect(ledger.rows).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts`

Expected: fail because `buildPartnerDebtLedger` does not exist.

- [ ] **Step 3: Implement ledger builder**

Add:

```ts
export interface PartnerDebtDocumentInput {
  id: string
  code: string
  time: string
  amount: number
  normalizedAmountDelta?: number
  status: 'posted' | 'cancelled' | 'replaced' | string
  sourceType?: string
  sourceId?: string | null
}

export interface PartnerDebtLedgerRow {
  id: string
  code: string
  time: string
  amountDelta: number
  balanceAfter: number
  sourceType?: string
  sourceId?: string | null
}

export function buildPartnerDebtLedger(input: {
  view: PartnerDebtView
  linked: boolean
  documents: PartnerDebtDocumentInput[]
}) {
  let balance = 0
  const rows: PartnerDebtLedgerRow[] = []
  for (const document of [...input.documents].sort((left, right) => Date.parse(left.time) - Date.parse(right.time) || left.code.localeCompare(right.code))) {
    if (document.status !== 'posted') continue
    const amountDelta = debtDeltaForVoucher({
      code: document.code,
      view: input.view,
      linked: input.linked,
      sourceAmount: document.amount,
      normalizedAmountDelta: document.normalizedAmountDelta,
    })
    if (amountDelta === 0) continue
    balance += amountDelta
    rows.push({ id: document.id, code: document.code, time: document.time, amountDelta, balanceAfter: balance, sourceType: document.sourceType, sourceId: document.sourceId })
  }
  return { totalDebt: balance, rows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts`

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/modules/finance/partner-debt-ledger.ts server/modules/finance/partner-debt-ledger.test.ts
git commit -m "feat: add canonical partner debt ledger builder"
```

---

### Task 3: Backend Customer Debt Uses Ledger, Not KV Anchor

**Files:**
- Modify: `server/db.test.ts`
- Modify: `server/db.ts`
- Modify: `server/modules/finance/customer-debt.ts`

- [ ] **Step 1: Add failing regression**

Add a Postgres repository test that imports one customer with `total_debt_amount`, one old `CB` row with `balance_after`, one `HD`, one `TT`, one `CKKH`, then asserts total is sum of documents, not `balance_after`.

Expected assertion:

```ts
expect(customerDebt.total_debt).toBe(100000 - 40000 - 10000 + 5000)
expect(customerDebt.adjustments.map((row) => row.source_code)).toContain('CKKH000001')
expect(customerDebt.ledger_rows.map((row) => row.code)).toEqual(['HD000001', 'TT000001', 'CKKH000001', 'CB000001'])
```

- [ ] **Step 2: Run failing test**

Run: `npm exec vitest run server/db.test.ts -t "customer debt"`

Expected: fail because total still uses `balance_after` and API has no `ledger_rows`.

- [ ] **Step 3: Replace anchor calculation**

Change `customerDebtTotalsSql()` usage so it no longer reads `balance_after` as total. In `server/db.ts`, gather all customer debt documents into `PartnerDebtDocumentInput[]`:

```ts
const documents = [
  ...invoiceRows.map(row => ({ id: row.id, code: row.code, time: row.created_at.toISOString(), amount: Number(row.debt_source_amount), status: row.status, sourceType: 'invoice', sourceId: row.id })),
  ...paymentRows.map(row => ({ id: row.id, code: row.code, time: row.created_at.toISOString(), amount: Math.abs(Number(row.amount_delta)), status: row.status, sourceType: 'payment', sourceId: row.id })),
  ...adjustmentRows.map(row => ({ id: row.id, code: row.source_code, time: row.created_at.toISOString(), amount: Math.abs(Number(row.amount_delta)), normalizedAmountDelta: Number(row.amount_delta), status: row.status === 'open' ? 'posted' : row.status, sourceType: 'adjustment', sourceId: row.id })),
]
const ledger = buildPartnerDebtLedger({ view: 'customer', linked: Boolean(linkedSupplier), documents })
```

Keep `customerDebtTotalsSql()` only as a temporary helper if needed for comparison tests. New runtime totals must come from `buildPartnerDebtLedger()`.

- [ ] **Step 4: Return `ledger_rows` from `GET /finance/customers/{id}/debt`**

Extend response:

```ts
ledger_rows: ledger.rows.map((row) => ({
  id: row.id,
  code: row.code,
  created_at: row.time,
  amount_delta: row.amountDelta,
  balance_after: row.balanceAfter,
  source_type: row.sourceType,
  source_id: row.sourceId,
}))
```

- [ ] **Step 5: Run customer debt tests**

Run: `npm exec vitest run server/db.test.ts server/http.test.ts -t "customer debt"`

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add server/db.ts server/db.test.ts server/http.test.ts server/modules/finance/customer-debt.ts
git commit -m "fix: calculate customer debt from canonical ledger"
```

---

### Task 4: Supplier Debt Uses Same Ledger

**Files:**
- Modify: `server/db.test.ts`
- Modify: `server/db.ts`
- Modify: `src/features/purchase/types.ts`
- Modify: `src/features/purchase/supplier-service.ts`

- [ ] **Step 1: Add failing supplier tests**

Add test cases:

```ts
expect(pureSupplier.current_payable_amount).toBe(3206581 - 1000000 + 179396)
expect(linkedSupplier.current_payable_amount).toBe(-(107352 - 3000000))
```

Also assert supplier detail returns ledger rows:

```ts
expect(detail.debt.ledger_rows.map((row) => row.code)).toEqual(['PN000566', 'PCPN000566', 'CB000033'])
```

- [ ] **Step 2: Run failing tests**

Run: `npm exec vitest run server/db.test.ts -t "supplier"`

Expected: fail because supplier total still comes from `purchase_receipt_snapshots.remaining_amount`.

- [ ] **Step 3: Implement supplier ledger gathering**

For pure supplier, feed:

```ts
PN... -> amount = payable/remaining source amount, view supplier, linked false
PCPN.../PC... -> amount = payment amount, view supplier, linked false
CB... -> normalizedAmountDelta, view supplier, linked false
```

For linked supplier, include customer-side documents for linked customer and call:

```ts
buildPartnerDebtLedger({ view: 'supplier', linked: true, documents })
```

- [ ] **Step 4: Stop snapshot total from being source of truth**

Keep `supplier_snapshots.current_payable_amount` as cached/display data only after recompute. Its recompute source must be canonical supplier ledger.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm exec vitest run server/db.test.ts src/features/purchase/SuppliersPage.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add server/db.ts server/db.test.ts src/features/purchase/types.ts src/features/purchase/supplier-service.ts src/features/purchase/SuppliersPage.test.tsx
git commit -m "fix: calculate supplier payable from partner ledger"
```

---

### Task 5: Frontend Stops Recomputing Running Debt

**Files:**
- Modify: `src/features/finance/types.ts`
- Modify: `src/features/catalog/customer-debt-ledger.ts`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/pos/CustomerPanel.tsx`
- Modify: `src/features/pos/CheckoutPanel.tsx`
- Modify: `src/features/purchase/SuppliersPage.tsx`
- Modify: related tests

- [ ] **Step 1: Add failing frontend tests**

Assert Customers and POS render backend rows without rebuilding totals:

```ts
expect(screen.getByRole('cell', { name: 'CB000033' })).toBeInTheDocument()
expect(screen.getByRole('row', { name: /CB000033/ })).toHaveTextContent('179 396')
expect(screen.getByRole('row', { name: /CB000033/ })).toHaveTextContent('16 021 746')
```

Assert supplier debt tab renders `PCPN` and linked inverted rows:

```ts
expect(screen.getByRole('row', { name: /PCPN000566/ })).toHaveTextContent('-1 000 000')
expect(screen.getByRole('row', { name: /HD011293/ })).toHaveTextContent('-107 352')
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm exec vitest run src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx src/features/pos/CheckoutPanel.test.tsx src/features/purchase/SuppliersPage.test.tsx
```

Expected: fail because UI still builds ledger from invoice/cashbook/history.

- [ ] **Step 3: Update API types**

Add to `CustomerDebtDetail` and supplier detail types:

```ts
ledger_rows: Array<{
  id: string
  code: string
  created_at: string
  amount_delta: number
  balance_after: number
  source_type: string
  source_id: string | null
}>
```

- [ ] **Step 4: Make frontend render backend rows**

Replace `buildCustomerDebtLedgerRows(invoiceHistory, cashbookHistory, adjustments, linkedSupplierReceipts)` calls with backend `debt.ledger_rows`.

Keep `buildCustomerDebtLedgerRows` only for legacy fallback tests or delete it after all callers move.

- [ ] **Step 5: Run frontend tests**

Run same command as Step 2.

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/features/finance/types.ts src/features/catalog/customer-debt-ledger.ts src/features/catalog/CustomersPage.tsx src/features/pos/CustomerPanel.tsx src/features/pos/CheckoutPanel.tsx src/features/purchase/SuppliersPage.tsx src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx src/features/pos/CheckoutPanel.test.tsx src/features/purchase/SuppliersPage.test.tsx
git commit -m "fix: render partner debt from backend ledger rows"
```

---

### Task 6: Oldest-First Allocation Shared For Customer And Supplier

**Files:**
- Modify: `server/modules/finance/partner-debt-ledger.ts`
- Modify: `server/modules/finance/partner-debt-ledger.test.ts`
- Modify: `server/db.ts`
- Modify: `server/db.test.ts`

- [ ] **Step 1: Add allocation tests**

```ts
import { allocateOldestFirst } from './partner-debt-ledger.js'

it('allocates payment to oldest open documents first', () => {
  expect(allocateOldestFirst({
    amount: 120000,
    documents: [
      { id: 'old', code: 'HD000001', time: '2026-07-01T00:00:00.000Z', remainingAmount: 100000 },
      { id: 'new', code: 'HD000002', time: '2026-07-02T00:00:00.000Z', remainingAmount: 50000 },
    ],
  })).toEqual([
    { documentId: 'old', documentCode: 'HD000001', allocatedAmount: 100000, remainingAfter: 0 },
    { documentId: 'new', documentCode: 'HD000002', allocatedAmount: 20000, remainingAfter: 30000 },
  ])
})
```

- [ ] **Step 2: Run failing test**

Run: `npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts`

Expected: fail because `allocateOldestFirst` does not exist.

- [ ] **Step 3: Implement helper and wire both flows**

Implement helper:

```ts
export function allocateOldestFirst(input: {
  amount: number
  documents: Array<{ id: string; code: string; time: string; remainingAmount: number }>
}) {
  let remaining = Math.max(input.amount, 0)
  const allocations = []
  for (const document of [...input.documents].sort((left, right) => Date.parse(left.time) - Date.parse(right.time) || left.code.localeCompare(right.code))) {
    if (remaining <= 0) break
    const allocatedAmount = Math.min(Math.max(document.remainingAmount, 0), remaining)
    if (allocatedAmount <= 0) continue
    allocations.push({ documentId: document.id, documentCode: document.code, allocatedAmount, remainingAfter: Math.max(document.remainingAmount - allocatedAmount, 0) })
    remaining -= allocatedAmount
  }
  return allocations
}
```

Use it in:

- `collectCustomerDebt`
- `paySupplier`
- KiotViet cashbook fallback allocation rebuild

- [ ] **Step 4: Run allocation tests**

Run:

```powershell
npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts server/db.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/modules/finance/partner-debt-ledger.ts server/modules/finance/partner-debt-ledger.test.ts server/db.ts server/db.test.ts
git commit -m "fix: share oldest-first debt allocation"
```

---

### Task 7: Remove Masking And Dead Paths

**Files:**
- Modify: `src/features/finance/FinancePage.tsx`
- Modify: `src/features/finance/FinancePage.test.tsx`
- Modify: `server/modules/finance/customer-debt.ts`
- Modify: `src/features/catalog/customer-debt-ledger.ts`

- [ ] **Step 1: Add tests that fail on frontend hydration**

Assert Finance detail uses backend `allocations` only and does not fabricate invoice allocation when backend returns none:

```ts
expect(service.getSalesDocumentByCode).not.toHaveBeenCalled()
expect(screen.queryByRole('table', { name: 'Phân bổ vào hóa đơn' })).not.toBeInTheDocument()
```

- [ ] **Step 2: Remove UI allocation hydration**

Delete `hydrateCashbookDetail()` logic that calls `getSalesDocumentByCode()` to synthesize allocations. Keep only counterparty display hydration if still required.

- [ ] **Step 3: Remove dead linked supplier argument**

Delete `linkedSupplierReceipts` from `buildCustomerDebtLedgerRows()` or delete the whole frontend builder if Task 5 moved all callers.

- [ ] **Step 4: Run tests**

Run:

```powershell
npm exec vitest run src/features/finance/FinancePage.test.tsx src/features/catalog/customer-debt-ledger.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/features/finance/FinancePage.tsx src/features/finance/FinancePage.test.tsx src/features/catalog/customer-debt-ledger.ts src/features/catalog/customer-debt-ledger.test.ts server/modules/finance/customer-debt.ts
git commit -m "refactor: remove frontend debt reconstruction"
```

---

### Task 8: Documentation And Final Verification

**Files:**
- Modify: `docs/03-BUSINESS-NghiepVu/Finance/CUSTOMER-DEBT.md`
- Modify: `docs/03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md`
- Modify: `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
- Modify: `docs/05-BACKEND-MayChu/Finance/FINANCE-API.md`
- Modify: `Y:\TeamAI\WORKER-NOW.md`

- [ ] **Step 1: Update docs with runtime status**

Add a runtime status note:

```markdown
Runtime status: code đã chuyển sang canonical partner debt ledger. `balance_after` KV chỉ còn là metadata đối soát, không tham gia công thức tổng.
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm exec vitest run server/modules/finance/partner-debt-ledger.test.ts server/db.test.ts server/http.test.ts
npm exec vitest run src/features/catalog/customer-debt-ledger.test.ts src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx src/features/pos/CheckoutPanel.test.tsx src/features/purchase/SuppliersPage.test.tsx src/features/finance/FinancePage.test.tsx
npm run typecheck
npm run build
npm run preflight
```

Expected: all commands exit `0`.

- [ ] **Step 3: Update TeamAI**

Add:

```markdown
- Partner debt ledger rebuild YYYY-MM-DD HH:mm: implemented canonical debt ledger for pure KH, pure NCC, and linked KH-NCC. KV import no longer acts as debt anchor. Verified focused backend/frontend tests, typecheck, build, preflight. Not deployed to NAS unless Owner explicitly asks.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/03-BUSINESS-NghiepVu/Finance/CUSTOMER-DEBT.md docs/03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md docs/05-BACKEND-MayChu/Finance/FINANCE-API.md
git commit -m "docs: record partner debt ledger runtime"
```

---

## Acceptance Checklist

- [ ] Customer list, customer detail, Finance debt list, POS customer panel, and checkout debt badge show the same customer debt number.
- [ ] Customer detail `Tóm tắt` and `Chi tiết` can explain headline total from ledger rows.
- [ ] Supplier list and supplier detail show current payable from same ledger.
- [ ] Supplier debt tab shows `PN`, `PC/PCPN`, `CB`, and linked inverted rows when relevant.
- [ ] Linked KH-NCC shows opposite signs between customer view and supplier view.
- [ ] `CB` and `CKKH` are included in totals and history.
- [ ] KiotViet `balance_after` is metadata only, not a runtime anchor.
- [ ] Oldest-first allocation is shared by customer and supplier flows.
- [ ] Frontend does not synthesize debt totals or allocation rows.
- [ ] NAS is not deployed from outside-LAN machine.

## Execution Notes

- Before execution: run `git pull --ff-only`, read `Y:\TeamAI\WORKER-NOW.md`, and claim scope there.
- Use small commits per task.
- If another machine is touching debt code, stop and coordinate before editing `server/db.ts`.
- Do not copy/deploy/restart NAS from outside-LAN machine.
