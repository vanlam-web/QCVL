# KiotViet Product Price Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend KiotViet Hàng hóa import so `Giá bán` is written to the default price list and shown on the Hàng hóa list/detail.

**Architecture:** Keep product identity in `products`; keep selling price in `price_list_items`. The Hàng hóa import reads `sale_price`, upserts products first, then upserts default price-list items for rows where `sale_price > 0`. The product list API returns `default_sale_price` from the default price list so UI shows real data instead of `Chưa có`.

**Tech Stack:** TypeScript, Node HTTP API, PostgreSQL repository, React Catalog page, Vitest.

---

## Current Status 2026-07-10

The price-import implementation is part of the accepted KiotViet product import flow. Keep price ownership in `price_list_items`; do not move sale price into `products`.

Verification refreshed on 2026-07-10:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npx vitest run src/lib/config/runtime.test.ts src/features/catalog/catalog-service.test.ts src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx server/http.test.ts server/modules/catalog/product-import.test.ts` passed: 6 files, 83 tests.
- `npm run build:nas` passed.

Remaining manual check only if this plan is reopened: open `http://127.0.0.1:3202/products`, import a KV product file, search a product with nonzero `Gia ban`, and confirm the list/detail show the formatted price from API `default_sale_price`.

---

## Scope

- Write KV `Giá bán` into the default active price list only.
- Skip `Giá bán` when value is `null`, empty, or `<= 0`.
- Preview reports `price_rows`, `price_skipped_rows`, and target price-list label.
- Import result reports `price_created_rows`, `price_updated_rows`, and `price_skipped_rows`.
- Hàng hóa list/detail shows `default_sale_price` from API.
- Do not build separate Bảng giá import yet.
- Superseded after this plan: stock is now written as KiotViet provisional stock, BOM is now written as draft BOM. Supplier relationship and expected-out-of-stock remain deferred.

## Files

- Modify `server/modules/catalog/product-import.ts`: summary counts, repository contract, apply flow.
- Modify `server/db.ts`: find default price list, upsert price list items, include default price in product list.
- Modify `server/http.ts`: repository interface, dev memory repository support, fake API summary shape.
- Modify `server/dev-memory-repository.ts`: store price list items and return `default_sale_price`.
- Modify `src/features/catalog/types.ts`: add `default_sale_price` to `Product`; add import summary fields.
- Modify `src/features/catalog/ProductImportDialog.tsx`: show price counts.
- Modify `src/features/catalog/CatalogPage.tsx`: show real default sale price.
- Modify docs in `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`.
- Tests: `server/modules/catalog/product-import.test.ts`, `server/http.test.ts`, `src/features/catalog/ProductImportDialog.test.tsx`, `src/features/catalog/CatalogPage.test.tsx`.

## Tasks

### Task 1: Server Import Contract

- [x] Add failing tests in `server/modules/catalog/product-import.test.ts`:
  - preview counts rows with `sale_price > 0`.
  - apply calls `upsertDefaultPriceListItems` after products.
  - rows with `sale_price = 0/null` are skipped.
- [x] Update `ProductImportRepository` with:
  - `findDefaultPriceList(input: { organizationId: string }): Promise<{ id: string; name: string } | null>`
  - `upsertDefaultPriceListItems(input: { organizationId: string; priceListId: string; rows: Array<{ product_code: string; unit_price: number }> }): Promise<{ created: number; updated: number; skipped: number }>`
- [x] Implement summary fields and apply flow.
- [x] Run `npx vitest run server/modules/catalog/product-import.test.ts`.

### Task 2: Repository Persistence

- [x] Add failing API test in `server/http.test.ts`: import `Giá bán`, then list/search product and assert `default_sale_price`.
- [x] Implement PostgreSQL `findDefaultPriceList` and `upsertDefaultPriceListItems`.
- [x] Implement dev memory price storage.
- [x] Update `listProducts` result to include default price from default price list.
- [x] Run `npx vitest run server/http.test.ts --testNamePattern "KiotViet|price|products imported"`.

### Task 3: UI Display

- [x] Add failing UI tests:
  - import preview dialog shows price row count.
  - Catalog table displays formatted `default_sale_price`.
- [x] Add `default_sale_price?: number | null` to `Product`.
- [x] Replace Hàng hóa table/detail `Chưa có` giá bán with `formatMoney(product.default_sale_price)` when present; keep `Chưa có` if null.
- [x] Run `npx vitest run src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx`.

### Task 4: Docs And Verification

- [x] Update inventory doc: Phase 2 now writes `Giá bán` into default price list through Hàng hóa import.
- [x] Run:
  - `npm run typecheck`
  - `npm run lint`
  - `npx vitest run src/lib/config/runtime.test.ts src/features/catalog/catalog-service.test.ts src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx server/http.test.ts server/modules/catalog/product-import.test.ts`
  - `npm run build:nas`
- [ ] Live dev check on `http://127.0.0.1:3202/products`: import file, search product with nonzero price, confirm list shows price.

## Self-Review

- Scope matches Phase 2 only: price import and display. Later work has added provisional stock and draft BOM in the main product import plan; supplier and expected-out-of-stock remain deferred.
- No fake UI: Hàng hóa price display must come from API `default_sale_price`.
- Price ownership remains Bảng giá: import button lives in Hàng hóa, write target is `price_list_items`.
