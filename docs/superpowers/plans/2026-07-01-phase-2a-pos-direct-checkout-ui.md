# Phase 2A POS Direct Checkout UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the POS operator flow for direct checkout only, using the Phase 1C checkout, customer debt, finance account, and recent-price APIs already merged into `main`.

**Architecture:** Keep checkout writes in the existing Phase 1C backend transaction. This phase changes frontend POS state and UI only: editable cart lines, customer debt display, payment split controls, surplus handling, and receipt feedback. Do not add KiotViet-style Orders, delivery, COD, sales channels, VAT/e-invoice, or standalone inventory adjustment workflows.

**Tech Stack:** React/Vite/TypeScript, Vitest Testing Library, Playwright E2E, existing Supabase Edge API services.

---

## Source Of Truth

Read these files before implementing:

- `docs/03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md`
- `docs/02-PRD-UX-PhongCanh/POS/K03/01-K03A-DOI-TAC.md`
- `docs/02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md`
- `docs/02-PRD-UX-PhongCanh/SalesDocuments/README.md`
- `docs/02-PRD-UX-PhongCanh/SalesDocuments/01-SALES-DOCUMENT-LIST.md`
- `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/01-PRICE-LIST.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/02-PRICE-LIST-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/Reports/01-END-OF-DAY.md`

Recent decisions that must shape this phase:

- QC-OMS Sales MVP is direct checkout / `bán đứt`.
- No KiotViet-style `Đặt hàng`, delivery notes, shipping partners, COD, delivery status, delivery address tab, sales channel, online sales, VAT, e-invoice, or tax/accounting flow.
- `BG...` is a quote snapshot only. It does not reserve stock, create production, create delivery, create cashbook/debt, or create revenue.
- A declared price of `0` is valid. Pricing fallback only happens when a price row is absent/blank, not when value is zero.
- POS customer modal must not include a separate e-invoice/VAT tab. Legal company info, if any, is internal customer information only.
- Inventory `Khách đặt` is out of current scope because direct checkout removed KiotViet-style ordering.
- Future inventory adjustments are minimal and context-launched; do not add them in this POS UI slice.

---

## Phase 2A Scope

Included:

- Sync recent Source of Truth docs into this implementation branch.
- Update `docs/PHASE-CHECKLIST.md` to mark Phase 1C merged and start Phase 2A.
- Make POS cart lines editable for quantity and manual unit price.
- Mark manual price rows and preserve them when customer/price list changes.
- Re-resolve automatic line prices when customer changes; do not treat unit price `0` as missing.
- Show selected customer debt summary in POS checkout.
- Separate current invoice payment from old-debt collection in UI labels and payload.
- Keep one bank account maximum per checkout.
- Show surplus choice only when a selected customer pays more than current invoice amount.
- Keep retail debt note requirement when no customer is selected and invoice remains unpaid.
- Improve receipt summary with invoice code, paid/debt, receipt code, and inventory warnings.
- Extend unit and E2E tests around direct checkout UI.

Deferred:

- Quote `BG...` creation/reopen UI.
- Sales Documents list/detail/reprint/revise screens.
- Full Customer Management page.
- Full PriceBook admin.
- End Of Day report UI.
- Inventory roll/sheet adjustment UI.
- Bill image rendering/sending flow.
- Any Orders/delivery/COD/HĐĐT/VAT workflow.

---

## File Structure

Modify:

- `docs/PHASE-CHECKLIST.md` - phase status and verification tracking.
- `src/features/pos/PosShell.tsx` - cart line state, customer-change price refresh, direct checkout layout.
- `src/features/pos/PosShell.test.tsx` - cart editing and customer-change price behavior.
- `src/features/pos/CheckoutPanel.tsx` - payment/debt/surplus/receipt UI.
- `src/features/pos/CheckoutPanel.test.tsx` - checkout validation and payload behavior.
- `src/features/orders/types.ts` - frontend-only cart line helpers if needed.
- `src/styles/index.css` - compact operator-facing POS layout polish.
- `tests/e2e/auth-pos.spec.ts` - direct checkout smoke with editable quantity/payment.

Create only if the file stays small and focused:

- `src/features/pos/CartLineTable.tsx` - editable cart table if `PosShell.tsx` becomes hard to scan.
- `src/features/pos/CartLineTable.test.tsx` - focused cart table behavior.

---

## Task 1: Sync Specs And Checklist

**Files:**

- Modify: `docs/PHASE-CHECKLIST.md`
- Modify: Source of Truth docs listed above when syncing from the spec branch.

- [ ] **Step 1: Verify branch baseline**

Run:

```bash
git status --short --branch
npm test
```

Expected: current branch is `codex/phase-2a-pos-direct-checkout-ui`; Vitest passes.

- [ ] **Step 2: Confirm direct-checkout scope markers**

Run:

```bash
rg -n "Đặt hàng|COD|HĐĐT|VAT|Khách đặt|Thông tin xuất hóa đơn" \
  docs/02-PRD-UX-PhongCanh/POS \
  docs/02-PRD-UX-PhongCanh/Customers \
  docs/02-PRD-UX-PhongCanh/SalesDocuments \
  docs/02-PRD-UX-PhongCanh/Reports \
  docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md
```

Expected: matches are only negative/out-of-scope statements, not implementation requirements.

- [ ] **Step 3: Update Phase checklist**

In `docs/PHASE-CHECKLIST.md`:

- mark Phase 1C as merged into `main` via PR #4 and merge commit `2b83df7`
- add Phase 2A section with status `🔨 Đang làm`
- link this plan file
- list local verification commands and server verification as pending

- [ ] **Step 4: Verify docs**

Run:

```bash
git diff --check
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: plan phase 2a pos direct checkout ui"
```

---

## Task 2: Editable Cart Lines

**Files:**

- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Optional create: `src/features/pos/CartLineTable.tsx`
- Optional create: `src/features/pos/CartLineTable.test.tsx`

- [ ] **Step 1: Write failing tests for quantity and manual price**

Add tests proving:

- clicking a product adds one cart line
- changing quantity updates the visible line total
- changing unit price marks the line as manual
- selecting a different customer re-resolves only non-manual line prices

Run:

```bash
npm test -- src/features/pos/PosShell.test.tsx
```

Expected before implementation: tests fail because cart quantity/unit price inputs do not exist.

- [ ] **Step 2: Implement editable cart rows**

For each cart line, expose:

- product name/code
- quantity numeric input
- unit price numeric input
- line total
- price source badge: automatic/manual
- remove line button

When unit price changes by operator input:

- set `isManualPrice: true`
- keep `priceSource` as `manual`
- do not update price list

- [ ] **Step 3: Preserve manual prices on customer change**

When `selectedCustomer` changes and prices are reloaded:

- update product grid prices
- update cart line price only if `isManualPrice === false`
- preserve quantity, note, dimensions, and manual prices
- treat `0` as a valid resolved price

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- src/features/pos/PosShell.test.tsx
```

Expected: POS shell tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/pos src/features/orders/types.ts
git commit -m "feat: add editable pos cart lines"
```

---

## Task 3: Customer Debt And Direct Payment UI

**Files:**

- Modify: `src/features/pos/CheckoutPanel.tsx`
- Modify: `src/features/pos/CheckoutPanel.test.tsx`

- [ ] **Step 1: Write failing tests for debt loading**

Add tests proving:

- when a customer is selected, `orderService.getCustomerDebt(customer.id)` is called
- total old debt is displayed
- old-debt payment remains separate from current invoice payment
- if no customer is selected, old-debt UI is hidden

Run:

```bash
npm test -- src/features/pos/CheckoutPanel.test.tsx
```

Expected before implementation: tests fail because customer debt is not loaded/displayed.

- [ ] **Step 2: Load customer debt**

In `CheckoutPanel`, load debt when `selectedCustomer?.id` changes:

- set loading state
- show `Tổng nợ hiện tại`
- show the first few unpaid invoice codes if available
- tolerate API failure by showing a non-blocking message and keeping checkout available

- [ ] **Step 3: Clarify payment fields**

Rename operator-facing labels:

- `Tiền mặt` -> `Tiền mặt trả hóa đơn`
- `Chuyển khoản` -> `Chuyển khoản trả hóa đơn`
- `Thanh toán nợ cũ` as a separate numeric field shown only for selected customers

Payload rule:

- current invoice paid amount comes from cash + bank fields
- old debt collection comes from `old_debt_payment_amount`
- if surplus mode is `old-debt`, fill old-debt payment from surplus
- if surplus mode is `return`, fill `change_returned_amount`

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- src/features/pos/CheckoutPanel.test.tsx
```

Expected: checkout panel tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/pos/CheckoutPanel.tsx src/features/pos/CheckoutPanel.test.tsx
git commit -m "feat: show customer debt in pos checkout"
```

---

## Task 4: Receipt Summary And E2E

**Files:**

- Modify: `src/features/pos/CheckoutPanel.tsx`
- Modify: `src/features/pos/CheckoutPanel.test.tsx`
- Modify: `tests/e2e/auth-pos.spec.ts`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write receipt summary tests**

Add tests proving receipt summary shows:

- invoice code
- paid amount
- debt amount
- receipt code when present
- inventory warnings as warnings, not blocking errors

- [ ] **Step 2: Polish receipt UI**

Keep it compact and operator-facing. Do not add bill image rendering in this phase.

- [ ] **Step 3: Update E2E**

Update checkout e2e to:

- select customer
- add product
- change quantity
- verify total/payment
- checkout cash
- verify `HD...` receipt summary

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- src/features/pos/CheckoutPanel.test.tsx src/features/pos/PosShell.test.tsx
npm run test:e2e
```

Expected: targeted unit tests and E2E pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/pos tests/e2e src/styles/index.css
git commit -m "test: cover direct checkout pos flow"
```

---

## Task 5: Final Verification And Handoff

**Files:**

- Modify: `docs/PHASE-CHECKLIST.md`

- [ ] **Step 1: Run full local verification**

```bash
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npx deno check supabase/functions/api/index.ts
npm run test:e2e
```

Expected: all pass locally.

- [ ] **Step 2: Update checklist**

Record local verification results in `docs/PHASE-CHECKLIST.md`.

- [ ] **Step 3: Commit checklist**

```bash
git add docs/PHASE-CHECKLIST.md
git commit -m "docs: record phase 2a verification"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin codex/phase-2a-pos-direct-checkout-ui
```

Open PR to `main` and include:

- Summary of POS direct checkout UI changes.
- Verification commands.
- Note that server DB reset/test remains batched on Windows server if Docker is unavailable locally.
