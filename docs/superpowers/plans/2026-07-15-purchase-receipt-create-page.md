# Purchase Receipt Create Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make purchase receipt KPIs clearer and turn the create flow into a full purchase-entry workspace opened from the existing `+` action.

**Status 2026-07-16:** Implemented on local `3202`. Final create workspace uses `Tìm hàng (F3)` beside `Nhập hàng`, product selection creates POS-like line cards, no default empty row is rendered, empty receipts cannot be saved, the right panel uses shared management sidebar styling, and the create footer no longer includes `In`.

**Architecture:** Keep the list route `/purchase/receipts`. The `+` button switches the page into a create workspace instead of rendering the draft form above the list. The workspace reuses current form state, line calculations, product/supplier lookups, and save/post service calls.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, shared management CSS.

---

### Task 1: Rename Purchase Receipt KPIs

**Files:**
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
- Modify: `src/features/purchase/PurchaseReceiptsPage.test.tsx`

- [ ] **Step 1: Write failing test**

Change the KPI test to expect `Tổng tiền hàng` and `Tổng nợ`, and to reject old labels `Cần trả` and `Còn phải trả`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/purchase/PurchaseReceiptsPage.test.tsx -t "summarizes purchase receipt validation state"`

- [ ] **Step 3: Update KPI labels**

In `receiptKpis`, set first card label to `Tổng tiền hàng`, hint to `Theo bộ lọc hiện tại`; set second card label to `Tổng nợ`, hint to `Theo bộ lọc hiện tại`.

- [ ] **Step 4: Run test to verify it passes**

Run same test.

### Task 2: Full Create Workspace

**Files:**
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
- Modify: `src/features/purchase/PurchaseReceiptsPage.test.tsx`
- Modify: `src/styles/pages.css`

- [ ] **Step 1: Write failing test**

Add a test that clicks `Tạo phiếu nhập` and expects a full create workspace with:
- back button `Quay lại danh sách phiếu nhập`
- title `Nhập hàng`
- product search `Tìm hàng (F3)` beside title
- empty state before product selection
- POS-like line cards after product selection, not a table/dropdown row
- side panel labels `Nhà cung cấp`, `Mã phiếu nhập`, `Số hóa đơn đầu vào`, `Tổng tiền hàng`, `Tổng nợ`
- footer buttons `Lưu tạm`, `Hoàn thành`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/purchase/PurchaseReceiptsPage.test.tsx -t "opens purchase receipt create workspace"`

- [ ] **Step 3: Implement create workspace**

Extract create render path from `receiptDetailContent` into a create-only layout used when `isCreatingReceipt` is true. Keep existing edit/detail behavior for list rows.

- [ ] **Step 4: Add scoped CSS**

Add `purchase-receipt-workspace` classes in `src/styles/pages.css` for full-height two-column layout, dense table, right panel, and sticky action footer.

- [ ] **Step 5: Run focused tests**

Run:
- `npm test -- src/features/purchase/PurchaseReceiptsPage.test.tsx -t "opens purchase receipt create workspace"`
- `npm test -- src/features/purchase/PurchaseReceiptsPage.test.tsx -t "creates a draft receipt"`

### Task 3: Verify Build And Browser

**Files:**
- No source edits expected.

- [ ] **Step 1: Run purchase tests**

Run: `npm test -- src/features/purchase/PurchaseReceiptsPage.test.tsx`

- [ ] **Step 2: Run build**

Run: `npm run build`

- [ ] **Step 3: Browser verify 3202**

Open `http://127.0.0.1:3202/purchase/receipts`, click `+`, confirm workspace renders and no overlay error appears.
