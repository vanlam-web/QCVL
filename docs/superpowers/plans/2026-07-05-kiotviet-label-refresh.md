# KiotViet Label Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QC-OMS labels feel familiar to a KiotViet user without changing business logic.

**Architecture:** Keep current routes, services, API contracts, and permissions. Change navigation labels, page titles, table labels, button text, empty states, and documentation only.

**Tech Stack:** React, TypeScript, Vitest, existing management layout components.

---

### Task 1: Navigation Labels

**Files:**
- Modify: `src/components/ui-shell/AppShell.tsx`
- Test: `src/components/ui-shell/AppShell.test.tsx`

- [x] Change `/finance` navigation label from `Tài chính` to `Sổ quỹ`.
- [x] Keep route `/finance` unchanged.
- [x] Keep permission `perm.manage_finance` unchanged.
- [x] Run `npm test -- src/components/ui-shell/AppShell.test.tsx`.

### Task 2: Page Copy

**Files:**
- Modify: `src/features/finance/FinancePage.tsx`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Modify: `src/features/reports/ReportsPage.tsx`
- Test: existing page tests for these files.

- [x] Finance page: use KiotViet-style words: `Sổ quỹ`, `Phiếu thu`, `Phiếu chi`, `Tổng thu`, `Tổng chi`, `Tồn quỹ`, `Người nộp/nhận`.
- [x] Inventory page: use KiotViet-style words: `Hàng hóa`, `Tồn kho`, `Kiểm kho`, `Cân bằng kho`.
- [x] Reports page: keep report names close to KiotViet: `Cuối ngày`, `Bán hàng`, `Công nợ`, `Hàng hóa`.
- [x] Do not add `Khách đặt`.
- [x] Do not change data flow or API calls.

### Task 3: Documentation

**Files:**
- Modify: `docs/KIOTVIET-REFERENCE-NOTES.md`
- Modify: `docs/IMPLEMENTATION-CHECKLIST.md`

- [x] Record owner decision: sell direct only, no reserved/customer ordered quantity for now.
- [x] Remove reserved/customer ordered quantity from suggested backlog.
- [x] Add checklist entry for KiotViet label refresh.

Note: after the Owner reorganized docs, Source of Truth already records that QC-OMS does not use `Khách đặt` in MVP. No extra Source of Truth edit was needed for this slice; this plan file is the saved execution checklist.

### Task 4: Verification

**Commands:**
- `npm test -- src/components/ui-shell/AppShell.test.tsx src/features/finance/FinancePage.test.tsx src/features/inventory/InventoryPage.test.tsx src/features/reports/ReportsPage.test.tsx`
- `npm run lint`
- `npm run typecheck`

- [x] All targeted tests pass.
- [x] Lint passes.
- [x] Typecheck passes.
