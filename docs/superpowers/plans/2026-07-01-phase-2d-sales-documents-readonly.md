# Phase 2D Sales Documents Readonly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a readonly Sales Documents module for finding and inspecting saved `HD...` invoices created by POS checkout.

**Architecture:** Backend exposes paged list/detail endpoints from existing order, item, payment, debt, and stock movement tables. Frontend adds a dashboard entry, route, service, list page, and detail view without implementing edit/cancel/print/returns/delivery/tax scope.

**Tech Stack:** React + React Router + Vitest Testing Library; Supabase Edge Functions; Supabase client repository queries.

---

### Task 1: Backend Sales Documents API

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Create: `supabase/functions/api/use-cases/sales-documents.ts`
- Create: `supabase/functions/api/routes/sales-documents.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Test: `supabase/tests/functions/sales_documents_test.ts`

- [x] **Step 1: Write failing API tests**

Cover permission denial, list response, exact document-code search ignoring default dates, and detail response with item/payment/debt/stock snapshots.

- [x] **Step 2: Run API tests red**

Run: `npx deno test supabase/tests/functions/sales_documents_test.ts --allow-env --allow-net`

Expected: FAIL because the route does not exist.

- [x] **Step 3: Implement minimal API**

Add `GET /api/v1/sales-documents` and `GET /api/v1/sales-documents/{id}`. Require `perm.create_order` or `perm.manage_finance`. Keep scope read-only.

- [x] **Step 4: Run API tests green**

Run: `npx deno test supabase/tests/functions/sales_documents_test.ts --allow-env --allow-net`

Expected: PASS.

### Task 2: Frontend Sales Documents Module

**Files:**
- Create: `src/features/sales-documents/types.ts`
- Create: `src/features/sales-documents/sales-document-service.ts`
- Create: `src/features/sales-documents/SalesDocumentsPage.tsx`
- Create: `src/features/sales-documents/SalesDocumentsPage.test.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/dashboard/DashboardPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/styles/index.css`

- [x] **Step 1: Write failing UI tests**

Cover dashboard navigation, list rendering, filtered empty state, exact-code search call, and opening invoice detail.

- [x] **Step 2: Run UI tests red**

Run: `npx vitest run src/features/dashboard/DashboardPage.test.tsx src/features/sales-documents/SalesDocumentsPage.test.tsx`

Expected: FAIL because the page and navigation are not implemented.

- [x] **Step 3: Implement minimal UI**

Enable the `sales-documents` dashboard module, add `/sales-documents`, render a compact searchable list and read-only detail sections.

- [x] **Step 4: Run UI tests green**

Run: `npx vitest run src/features/dashboard/DashboardPage.test.tsx src/features/sales-documents/SalesDocumentsPage.test.tsx`

Expected: PASS.

### Task 3: Verification And PR

- [x] **Step 1: Run verification**

Run `npm run lint`, `npm run typecheck`, `npm run test:functions`, `npm test`, `npm run build`, and `npx deno check supabase/functions/api/index.ts`.

- [x] **Step 2: Commit and open PR**

Commit with `feat: add readonly sales documents module`, push, create PR, and deploy Edge Function to staging after merge.

Completed: PR #8 was merged into `main` with merge commit `552db05`.
