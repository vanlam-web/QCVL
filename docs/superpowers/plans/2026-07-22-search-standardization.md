# Search Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize search code so quick-pick and management search use one shared contract instead of page-specific duplicated logic.

**Architecture:** Frontend owns interaction mode through shared hooks. Backend owns result filtering/ranking. Feature pages only declare entity, service call, page size, active-only status, and selection callback. No page should recreate debounce, stale-request guards, quick-pick loading text, or search URL parameter names.

**Tech Stack:** React hooks, Vitest, existing QCVL API services, PostgreSQL-backed ranking/index.

---

### Task 1: Shared Search Contract And Hooks

**Files:**
- Create: `src/lib/search-contract.ts`
- Create: `src/lib/use-quick-pick-search.ts`
- Create: `src/lib/use-management-search.ts`
- Create: `src/lib/use-quick-pick-search.test.tsx`
- Create: `src/lib/use-management-search.test.tsx`

- [ ] **Step 1: Write failing hook tests**

`useQuickPickSearch` must debounce, expose `loading`, ignore stale results, clear on empty query, and call `recordSelection` only through consumer selection.

`useManagementSearch` must keep `draftSearch` separate from `appliedSearch`, submit only on Enter/form submit, and reset immediately on clear.

Run:

```bash
npm exec -- vitest run src/lib/use-quick-pick-search.test.tsx src/lib/use-management-search.test.tsx
```

Expected: FAIL because hooks do not exist.

- [ ] **Step 2: Implement shared contract**

`src/lib/search-contract.ts` defines:

```ts
export type QuickPickEntityType = 'customer' | 'supplier' | 'product'
export type QuickPickSearchContext = 'quick_pick'
export const quickPickDefaultPage = 1
export const quickPickCustomerPageSize = 8
export const quickPickDefaultPageSize = 20
export const quickPickSearchContext: QuickPickSearchContext = 'quick_pick'
```

- [ ] **Step 3: Implement hooks**

`useQuickPickSearch<T>` owns:

- `query`
- `setQuery`
- `results`
- `loading`
- `error`
- `suggestionsOpen`
- `setSuggestionsOpen`
- `clear`
- stale request id
- debounce through existing `useDebouncedValue`

`useManagementSearch` owns:

- `draftSearch`
- `appliedSearch`
- `setDraftSearch`
- `submitSearch(event?)`
- `clearSearch()`

- [ ] **Step 4: Verify hook tests pass**

Run:

```bash
npm exec -- vitest run src/lib/use-quick-pick-search.test.tsx src/lib/use-management-search.test.tsx
```

Expected: PASS.

---

### Task 2: POS Customer Quick-Pick Uses Shared Hook

**Files:**
- Modify: `src/features/pos/CustomerPanel.tsx`
- Modify: `src/features/pos/CustomerPanel.test.tsx`

- [ ] **Step 1: Write failing regression**

Add/adjust tests so POS customer search proves:

- typing calls `listCustomers` once after debounce with `{ search, status: 'active', page: 1, page_size: 8, search_context: 'quick_pick' }`
- pending request shows `Đang tìm...`
- stale slower response does not overwrite latest result
- selected customer records search selection

Run:

```bash
npm exec -- vitest run src/features/pos/CustomerPanel.test.tsx
```

Expected: FAIL until component uses shared hook or stale behavior is covered.

- [ ] **Step 2: Replace page-local search state**

Remove page-local quick-pick request id/loading/results logic from `CustomerPanel.tsx`. Use `useQuickPickSearch<Customer>`.

- [ ] **Step 3: Verify**

Run:

```bash
npm exec -- vitest run src/features/pos/CustomerPanel.test.tsx
```

Expected: PASS.

---

### Task 3: Purchase Quick-Pick Uses Shared Hook

**Files:**
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
- Modify: `src/features/purchase/PurchaseReceiptsPage.test.tsx`

- [ ] **Step 1: Write failing regression**

Add/adjust tests so purchase receipt creation proves:

- supplier quick-pick uses active-only, `page: 1`, `page_size: 20`, `search_context: 'quick_pick'`
- product quick-pick uses active-only, `page: 1`, `page_size: 20`, `search_context: 'quick_pick'`
- stale request cannot overwrite latest suggestions
- selected supplier/product records search selection

Run:

```bash
npm exec -- vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx
```

Expected: FAIL until purchase page uses shared hook.

- [ ] **Step 2: Replace duplicate request effects**

Remove custom supplier/product debounce effects and active flags from purchase quick-pick. Keep purchase-only domain filters such as `isReceiptPurchaseSearchableProduct` after results return.

- [ ] **Step 3: Verify**

Run:

```bash
npm exec -- vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx
```

Expected: PASS.

---

### Task 4: Management Search Uses Shared Hook

**Files:**
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/purchase/SuppliersPage.tsx`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
- Modify: `src/features/sales-documents/SalesDocumentsPage.tsx`
- Modify: `src/features/finance/FinancePage.tsx`
- Modify: related page tests

- [ ] **Step 1: Preserve Enter-only tests**

Run existing tests that prove typing alone does not call APIs:

```bash
npm exec -- vitest run src/features/catalog/CustomersPage.test.tsx src/features/purchase/SuppliersPage.test.tsx src/features/catalog/CatalogPage.test.tsx src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/sales-documents/SalesDocumentsPage.test.tsx src/features/finance/FinancePage.test.tsx
```

Expected: PASS before refactor.

- [ ] **Step 2: Convert one page at a time**

For each page:

- replace `search`/`lastSearch` draft plumbing only where it duplicates the shared hook
- keep existing `load(...)` service call shape
- keep clear button behavior
- do not change filters/sorts/debt/detail behavior

- [ ] **Step 3: Verify page tests after each conversion**

Run same focused page test after each page.

---

### Task 5: Backend Search Contract Cleanup

**Files:**
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/purchase/purchase-receipt-service.ts`
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: service and backend tests

- [ ] **Step 1: Write contract tests**

Assert frontend services send `search`, not `q`, for customers, suppliers, and products.

Run:

```bash
npm exec -- vitest run src/features/catalog/catalog-service.test.ts src/features/purchase/purchase-receipt-service.test.ts server/http.test.ts server/db.test.ts
```

Expected: FAIL while supplier quick-pick still sends `q`.

- [ ] **Step 2: Standardize URL params**

Frontend sends `search` everywhere. Backend keeps reading `q` only as backward-compatible fallback.

- [ ] **Step 3: Verify**

Run:

```bash
npm exec -- vitest run src/features/catalog/catalog-service.test.ts src/features/purchase/purchase-receipt-service.test.ts server/http.test.ts server/db.test.ts
```

Expected: PASS.

---

### Task 6: Final Guardrails

**Files:**
- Modify: `docs/03-BUSINESS-NghiepVu/SEARCH-RANKING-PERFORMANCE.md`
- Modify: `Y:\TeamAI\WORKER-NOW.md`

- [ ] **Step 1: Add anti-rubbish rule to docs**

Record: new search boxes must use `useQuickPickSearch` or `useManagementSearch`. Page-local debounce/rank/request-id code is not allowed unless documented as an exception.

- [ ] **Step 2: Final verification**

Run:

```bash
npm run typecheck
npm test -- src/lib/use-quick-pick-search.test.tsx src/lib/use-management-search.test.tsx src/features/pos/CustomerPanel.test.tsx src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/catalog/CustomersPage.test.tsx src/features/purchase/SuppliersPage.test.tsx src/features/catalog/CatalogPage.test.tsx src/features/sales-documents/SalesDocumentsPage.test.tsx src/features/finance/FinancePage.test.tsx server/http.test.ts server/db.test.ts
npm run api:build
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add .
git commit -m "refactor: standardize search flows"
git push origin codex/data-load-performance
```

Expected: branch pushed; no NAS deploy from outside-LAN.

---

## Self-Review

Spec coverage:

- Quick-pick debounce/loading/stale request: Tasks 1-3.
- Management Enter-only search: Task 4.
- One API param contract: Task 5.
- Remove duplicate rank/filter ownership: Tasks 2-5.
- Future anti-rubbish rule: Task 6.

Placeholders: none. Each task has files, commands, and expected result.

Scope risk: Task 4 touches many pages; if too large in one run, stop after Tasks 1-3 and push that slice.
