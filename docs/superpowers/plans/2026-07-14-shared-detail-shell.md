# Shared Detail Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tach vo UI chi tiet quan tri thanh component/CSS dung chung, de cac trang chi truyen ruot du lieu va hanh vi rieng.

**Architecture:** `src/components/ui-shell/management-layout.tsx` giu vo dung chung: panel, header, summary, section, meta grid, note, action footer. Feature page chi giu state UI, service call, presenter/helper va truyen title/meta/items/actions vao shell. CSS chung nam trong `src/styles/shared.css`; CSS page-specific chi con khi bo cuc nghiep vu that su khac.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS `management-*`.

---

## Files

- Modify: `src/components/ui-shell/management-layout.tsx`
  - Add `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, `ManagementDetailSection`.
  - Keep existing `ManagementInlineDetailTabs`, `ManagementDetailInfoList`, `ManagementDetailMetaText`, `ManagementDetailInlineNote`, `ManagementDetailActionFooter`.
- Modify: `src/components/ui-shell/management-layout.test.tsx`
  - Cover shared shell class names, aria labels, meta label/value typography, and tabpanel wrapper.
- Modify: `src/features/catalog/CustomersPage.tsx`
  - Replace `customer-inline-detail`, `customer-detail-summary`, and `customer-detail-tab-panel` markup with shared shell.
  - Keep customer fields, tabs, debt/history loading, actions unchanged.
- Modify: `src/features/catalog/CustomersPage.test.tsx`
  - Assert customer detail uses shared panel/summary/section classes, not customer-only layout classes.
- Modify: `src/features/finance/FinanceDetailPanel.tsx`
  - Replace manual panel/header/meta/note wrappers with shared shell.
  - Keep finance presenter helpers, linked table, buttons, and cashbook data unchanged.
- Modify: `src/features/finance/FinancePage.test.tsx`
  - Assert cashbook detail uses shared panel/header/info list/note.
- Modify: `src/features/purchase/SuppliersPage.tsx`
  - Use shared shell for supplier detail and payment form; keep tab shell shared and do not fake missing history data.
- Modify: `src/features/purchase/PurchaseReceiptsPage.tsx`
  - Use shared shell for receipt detail; split `Thông tin` and `Lịch sử thanh toán` tabs, with history driven by real `supplier_payments`.
- Modify: `src/styles/shared.css`
  - Add shared summary/meta-line/section styles.
  - Remove finance detail-only grid override when shared meta grid covers it.
- Modify: `src/styles/pages.css`
  - Remove customer detail-only wrapper/summary styles after replacement.
- Modify: `src/styles/pos.css`
  - Update mobile selectors from customer-only classes to shared detail classes.
- Modify: `src/styles/index.test.ts`
  - Guard absence of customer-only detail shell CSS and presence of shared shell CSS.
- Modify: `docs/CODE_ARCHITECTURE_RULES.md`
  - Record rule: detail shell vỏ dùng chung, page chỉ truyền ruột.
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
  - Record customer detail uses shared shell.
- Modify: `docs/02-PRD-UX-PhongCanh/Finance/02-CASHBOOK.md`
  - Record finance detail uses shared shell.

## Scope

- Do first on 3202/local code path.
- Refactor Customers and Finance fully in this slice.
- Do not change API, DB, import, debt, cashbook, product, POS checkout, or stock rules.
- Do not delete data.
- Do not convert SalesDocuments/Inventory/Purchase in this slice; only ensure new shared shell can be reused there later.

Addendum 2026-07-15:

- Scope was expanded on local `3202` after Owner QA to cover Purchase/Suppliers, Purchase Receipts, SalesDocuments note editing, shared detail note helper, and responsive meta grid behavior.
- These 2026-07-15 UI changes were copied to NAS `3200` after local checks by `QCVL_NAS_DEPLOY_CONFIRM=true` + `QCVL_NAS_RESTART=false`. Code/build share compare is clean; full NAS UI smoke after login is still pending because no admin smoke password/session is available, and backend runtime needs `qcvl-app` restart before server-side changes are considered loaded.
- Purchase receipt detail hardening on `3200`/`3202`: posted receipts render read-only lines table, shared readonly note box, footer actions (`Thanh toán NCC` when outstanding, `In` on the right), and no read-only form. `Lịch sử thanh toán` appears only when there are payment rows; unpaid receipts stay on `Thông tin` only. Imported KV paid amount can synthesize a read-only `PCPN...` row for reconciliation when `supplier_payments` has no explicit row.

Addendum 2026-07-16:

- Customers/Suppliers list now shows a shared orange linked-partner icon immediately before the customer/supplier code when a KH-NCC link exists (`linked_supplier` on customer rows, `linked_customer` on supplier rows). The linked-customer/supplier detail cards remain in the detail panel; no separate list column is added.
- Verified `npx vitest run src/features/purchase/SuppliersPage.test.tsx src/features/catalog/CustomersPage.test.tsx` and `npx tsc -b --pretty false`.
- Deployed to NAS `3200` with `QCVL_NAS_RESTART=false`; health trace `f9632a6c-0bd2-49b3-b170-b1a9eb9dafa6`.

### Task 1: Shared Detail Shell Components

- [x] Step 1: Add failing tests in `management-layout.test.tsx` for `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, and `ManagementDetailSection`.
- [x] Step 2: Run `npx vitest run src/components/ui-shell/management-layout.test.tsx -t "shared detail shell"` and confirm missing component failures.
- [x] Step 3: Add shared components in `management-layout.tsx`.
- [x] Step 4: Add shared CSS in `shared.css`.
- [x] Step 5: Run `npx vitest run src/components/ui-shell/management-layout.test.tsx src/styles/index.test.ts`.

### Task 2: Customers Use Shared Shell

- [x] Step 1: Update customer tests to expect shared classes and no customer-only detail wrapper.
- [x] Step 2: Run `npx vitest run src/features/catalog/CustomersPage.test.tsx -t "expands customer details"` and confirm expected failure.
- [x] Step 3: Replace customer detail markup with shared shell components.
- [x] Step 4: Remove obsolete customer detail CSS and update mobile selector.
- [x] Step 5: Run `npx vitest run src/features/catalog/CustomersPage.test.tsx src/styles/index.test.ts`.

### Task 3: Finance Uses Shared Shell

- [x] Step 1: Update finance tests to expect shared shell components while keeping cashbook labels/data.
- [x] Step 2: Run `npx vitest run src/features/finance/FinancePage.test.tsx -t "opens cashbook entry detail"` and confirm expected failure.
- [x] Step 3: Replace finance manual wrappers with shared shell components.
- [x] Step 4: Remove obsolete finance detail CSS override if shared style covers it.
- [x] Step 5: Run `npx vitest run src/features/finance/FinancePage.test.tsx src/styles/index.test.ts`.

### Task 4: Docs And Audit

- [x] Step 1: Update code architecture rule with vỏ/ruột detail shell convention.
- [x] Step 2: Update customer and finance PRD docs.
- [x] Step 3: Run `rg -n "customer-inline-detail|customer-detail-summary|customer-detail-tab-panel|finance-cashbook-detail dl > div" src docs` and remove or justify leftovers.
- [x] Step 4: Run `npx vitest run src/components/ui-shell/management-layout.test.tsx src/features/catalog/CustomersPage.test.tsx src/features/finance/FinancePage.test.tsx src/styles/index.test.ts`.
- [x] Step 5: Browser-check `/customers` and `/finance` on `http://127.0.0.1:3202`.

### Task 5: Purchase/Suppliers Use Shared Shell

- [x] Step 1: Update supplier and purchase receipt tests to assert the outer expanded row is only a detail region, while shared `ManagementDetailPanel` sits inside.
- [x] Step 2: Refactor `SuppliersPage` detail/payment form to use `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, `ManagementDetailSection`, `ManagementDetailInfoList`, `ManagementDetailInlineNote`, `ManagementDetailActionFooter`.
- [x] Step 2.1: Split supplier view/edit state: row click opens view-only detail, `Chỉnh sửa` opens the form, and supplier tabs render with shared shell while tab content avoids fake data.
- [x] Step 3: Refactor `PurchaseReceiptsPage` detail to use the same shell and split `Thông tin` vs `Lịch sử thanh toán` tab content.
- [x] Step 4: Run `npx vitest run src/features/purchase/SuppliersPage.test.tsx src/features/purchase/PurchaseReceiptsPage.test.tsx`.
- [x] Step 5: Run `npm run typecheck`.
- [x] Step 6: Browser-check `/purchase/receipts` and `/suppliers` on `http://127.0.0.1:3202`; no console errors/warnings found.

### Task 6: 2026-07-15 Detail Shell Hardening

- [x] Step 1: Add shared `ManagementDetailCard` for secondary detail blocks such as KH-NCC link cards.
- [x] Step 2: Add shared `ManagementDetailNote` for read-only notes with icon and fallback `Chưa có ghi chú`.
- [x] Step 3: Extend `ManagementDetailInfoList` with 3-column/4-column modes, span support, label/value typography classes, and auto-stacking when one cell cannot fit in one line.
- [x] Step 4: Update Supplier detail on `3202`: remove linked-customer column from main list, show KH-NCC card inside detail, use 3-column info grid plus full-width address, keep supplier group in summary.
- [x] Step 5: Update docs: `PHASE-CHECKLIST`, `PROJECT-COORDINATION`, `CURRENT-DATA-SOURCE`, UI shell spec, and Purchase/Supplier PRD.
- [x] Step 6: Verify `npx vitest run src/components/ui-shell/management-layout.test.tsx src/features/purchase/SuppliersPage.test.tsx`.
- [x] Step 7: Verify `npm run typecheck`.
- [x] Step 8: Browser-check `/suppliers` on `http://127.0.0.1:3202`: no Vite overlay, console clean, note fallback has shared icon.
- [x] Step 9: Deploy-copy to NAS `3200` with `QCVL_NAS_RESTART=false`; `build:nas`, `verify:nas-bundle`, `db:migrate`, and `health:nas` pass.
- [x] Step 10: Compare NAS share against local for `dist`, `dist-server`, `src`, `server`, `public`, `database`, and copied config files; no copied file drift found.
- [x] Step 11: Smoke `/suppliers` after login on NAS via active Codex browser session; list/detail THN match local `3202`.
- [ ] Step 12: Restart `qcvl-app` if backend/runtime changes from this batch must load on NAS.

### Task 7: 2026-07-15 Purchase Receipt Detail QA

- [x] Step 1: Refactor posted purchase receipt detail away from disabled form into shared read-only detail: summary, info grid, line table, note box, totals, footer actions.
- [x] Step 2: Move receipt actions to footer; remove `In tem nhãn`/`Trả hàng nhập` from posted receipt detail and keep only `In` plus `Thanh toán NCC` when outstanding.
- [x] Step 3: Format supplier payment history status with shared `StatusChip`; `posted` displays `Đã thanh toán`, not `Đã ghi`.
- [x] Step 4: Hide `Lịch sử thanh toán` tab when no payment rows exist; keep `Thanh toán NCC` in tab `Thông tin` for outstanding receipts.
- [x] Step 5: For imported posted receipts with `paid_amount` but no explicit `supplier_payments`, synthesize read-only history row `PC` + receipt code, e.g. `PCPN000684`, so KV paid receipts can be reconciled.
- [x] Step 6: Verify `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx` and `npm run build`.
- [x] Step 7: Deploy-copy to NAS `3200` with `QCVL_NAS_RESTART=false`; `build:nas`, `verify:nas-bundle`, `db:migrate`, and `health:nas` pass.
- [x] Step 8: Browser-check NAS `3200` `/purchase/receipts`: `PN000684` shows `PCPN000684` + chip `Đã thanh toán`; `PN000677` has only `Thông tin`, no empty history tab, and footer action `Thanh toán NCC`.
