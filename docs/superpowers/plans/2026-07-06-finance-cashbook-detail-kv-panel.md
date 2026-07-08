# Finance Cashbook Detail KV Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the cashbook expanded row detail panel with the KiotViet-style accounting review layout described by the user.

**Architecture:** Keep the existing inline detail row and current Finance API shape. Adjust only `FinancePage` markup, focused CSS, tests, and cashbook docs; do not invent missing backend fields.

**Tech Stack:** React, Vitest, Testing Library, CSS source assertions, existing management layout primitives.

---

### Task 1: Detail Panel Markup

**Files:**
- Modify: `src/features/finance/FinancePage.tsx`
- Test: `src/features/finance/FinancePage.test.tsx`

- [ ] **Step 1: Write failing test**

Add assertions to `opens cashbook entry detail with allocation rows` that require:
- title/chips/branch to be inside `.finance-cashbook-detail-header`
- log line inside `.finance-cashbook-detail-log`
- four core fields inside `.finance-cashbook-detail-core-grid`
- counterparty/account rows inside `.finance-cashbook-detail-extra-rows`
- linked documents inside `.finance-cashbook-linked-documents-inner`
- footer actions inside `.finance-cashbook-detail-actions`

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/features/finance/FinancePage.test.tsx --exclude '.worktrees/**' --reporter=verbose
```

Expected: FAIL because these KV-specific wrapper classes do not exist yet.

- [ ] **Step 3: Implement markup**

Restructure the selected cashbook detail render block:
- keep tab first
- wrap title, badges, and branch in `finance-cashbook-detail-header`
- put metadata in one compact log line with only `Người tạo` and `Thời gian`; do not render separate `Người thu`/`Người chi` because creator is the default collector/payer
- render the four core fields in `finance-cashbook-detail-core-grid`
- render counterparty/account in `finance-cashbook-detail-extra-rows`
- wrap linked document message/table in `finance-cashbook-linked-documents-inner`
- remove the separate `Đóng` button from the panel footer because it is not in the KiotViet target layout

- [ ] **Step 4: Verify targeted test passes**

Run:
```bash
npx vitest run src/features/finance/FinancePage.test.tsx --exclude '.worktrees/**' --reporter=verbose
```

Expected: PASS.

### Task 2: Expense Wording

**Files:**
- Modify: `src/features/finance/FinancePage.tsx`
- Test: `src/features/finance/FinancePage.test.tsx`

- [ ] **Step 1: Write failing test**

Add a focused expense detail test for a `direction: 'out'` entry with allocation. Assert:
- title is `Phiếu chi <code>`
- linked message says `Phiếu chi tự động được gắn với phiếu nhập hàng <code>.`
- table headers use `Đã trả trước` and `Giá trị chi`

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/features/finance/FinancePage.test.tsx --exclude '.worktrees/**' --reporter=verbose
```

Expected: FAIL because current expense linked message says `chứng từ` and table headers always say thu.

- [ ] **Step 3: Implement direction-aware wording**

Update helper/markup so receipt rows keep `Đã thu trước` / `Giá trị thu`, expense rows use `Đã trả trước` / `Giá trị chi`, and expense linked allocation message uses `phiếu nhập hàng` when only current source data is available.

- [ ] **Step 4: Verify targeted test passes**

Run:
```bash
npx vitest run src/features/finance/FinancePage.test.tsx --exclude '.worktrees/**' --reporter=verbose
```

Expected: PASS.

### Task 3: CSS Layout

**Files:**
- Modify: `src/styles/index.css`
- Test: `src/styles/index.test.ts`

- [ ] **Step 1: Write failing CSS source test**

Add assertions that:
- `.finance-cashbook-detail-header` uses flex and `justify-content: space-between`
- `.finance-cashbook-detail-title-line` is flex/wrap for inline badges
- `.finance-cashbook-detail-core-grid` uses four equal columns
- `.finance-cashbook-detail-extra-rows > div` spans full width rows with bottom border
- `.finance-cashbook-linked-documents-inner` has inset spacing
- `.finance-cashbook-detail-actions .button-primary` keeps the edit action as the strongest action

- [ ] **Step 2: Run CSS test to verify it fails**

Run:
```bash
npx vitest run src/styles/index.test.ts --exclude '.worktrees/**' --reporter=verbose
```

Expected: FAIL because new selectors do not exist yet.

- [ ] **Step 3: Implement CSS**

Add focused rules under the existing cashbook detail CSS. Keep project tokens and responsive behavior. Use media query to collapse the four-column grid on narrow screens.

- [ ] **Step 4: Verify CSS test passes**

Run:
```bash
npx vitest run src/styles/index.test.ts --exclude '.worktrees/**' --reporter=verbose
```

Expected: PASS.

### Task 4: Docs and Final Verification

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Finance/02-CASHBOOK.md`

- [ ] **Step 1: Update docs**

Document the implemented sub-panel layout and the constraint that missing backend fields remain absent instead of being faked.

- [ ] **Step 2: Run verification**

Run:
```bash
npm run typecheck
npm run lint
git diff --check
npx vitest run src/styles/index.test.ts src/features/finance/FinancePage.test.tsx --exclude '.worktrees/**' --reporter=verbose
npm run build
```

Expected: all commands pass; Vite chunk-size warning may remain existing.
