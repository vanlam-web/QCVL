# Phase 2C POS Discount UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual line discount handling to POS checkout without adding promotion, loyalty, campaign, tax, or online-channel scope.

**Architecture:** Cart lines carry a `discountAmount` field gated by `perm.apply_discount`. The POS summary computes subtotal, discount, and payable total locally for operator feedback, while `checkout_order_tx` recalculates and persists all order and line totals from the submitted payload.

**Tech Stack:** React + Vitest Testing Library for POS UI; Deno edge-function validation; PostgreSQL pgTAP tests for checkout transaction behavior.

---

### Task 1: POS UI Discount State And Payload

**Files:**
- Modify: `src/features/orders/types.ts`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/CheckoutPanel.tsx`
- Test: `src/features/pos/PosShell.test.tsx`
- Test: `src/features/pos/CheckoutPanel.test.tsx`

- [x] **Step 1: Write failing UI tests**

Add tests that prove a user with `perm.apply_discount` can enter a line discount, the payable total updates, and checkout sends `items[].discount_amount`. Add a paired test proving a cashier without `perm.apply_discount` cannot edit the discount.

- [x] **Step 2: Run UI tests red**

Run: `npm test -- src/features/pos/PosShell.test.tsx src/features/pos/CheckoutPanel.test.tsx`

Expected: FAIL because the discount input and payload field do not exist yet.

- [x] **Step 3: Implement minimal UI behavior**

Add `discountAmount` to `CheckoutCartLine` and `CheckoutInput.items`. Initialize it to `0`, preserve it when prices refresh, clamp it between `0` and `quantity * unitPrice`, and pass `canApplyDiscount={currentUser.permissions.includes('perm.apply_discount')}` to checkout/cart UI.

- [x] **Step 4: Run UI tests green**

Run: `npm test -- src/features/pos/PosShell.test.tsx src/features/pos/CheckoutPanel.test.tsx`

Expected: PASS.

### Task 2: Checkout Transaction Discount Persistence

**Files:**
- Modify: `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
- Modify: `supabase/functions/api/use-cases/orders.ts`
- Test: `supabase/tests/database/007_checkout_transaction.test.sql`
- Test: `supabase/tests/functions/orders_test.ts`

- [x] **Step 1: Write failing backend tests**

Add tests where a checkout item submits `discount_amount`; assert the order subtotal is before discount, order discount is the sum of item discounts, total/debt/payment use the discounted amount, and line totals persist after discount.

- [x] **Step 2: Run backend tests red**

Run: `npm run test:db -- supabase/tests/database/007_checkout_transaction.test.sql` if supported, otherwise `npm run test:db`.

Expected: FAIL because `checkout_order_tx` currently persists discount as `0`.

- [x] **Step 3: Implement transaction support**

Parse `discount_amount` per item, validate non-negative and not greater than `round(quantity * unit_price)`, compute `subtotal_amount`, `discount_amount`, and `total_amount`, and persist line subtotal/discount/total.

- [x] **Step 4: Run backend tests green**

Run: `npm run test:db` and `npm run test:functions`.

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Review changed files only.

- [x] **Step 1: Static and app verification**

Run: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

- [x] **Step 2: Commit and prepare PR**

Commit with message `feat: add pos line discount handling`, then push branch and open PR.

Completed: PR #7 was merged into `main` with merge commit `1d7a6f5`.
