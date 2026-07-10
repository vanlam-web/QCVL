# KiotViet Stocktake Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import KiotViet stocktake history into the Inventory/Kiem kho module as reviewable historical data, without overwriting QCVL operating stock.

**Architecture:** Product import and stocktake import stay separate. Product import owns current KiotViet catalog, prices, provisional stock, and draft BOM. Stocktake import owns historical KiotViet stocktake documents and lines. Official QCVL stock is created only by an explicit review/balance flow that writes `stocktakes`, `stocktake_items`, and `stock_movements`.

**Import reset rule:** Shared KiotViet import dialogs use a separate `Xóa dữ liệu cũ` action. Do not use a checkbox inside `Import` for cleanup. For stocktake import, the delete action removes only historical KiotViet stocktake documents/lines (`stocktakes.source_type = kiotviet_import` or `source_system = kiotviet`) and does not touch products, operating stock, or stock movements.

**Tech Stack:** React 19, TypeScript, Vite, Node HTTP server, PostgreSQL repository, Vitest, existing Inventory module, existing XLSX parser, existing management UI components.

---

## Current Facts From Owner Files

Files inspected:

- Product export: `C:/Users/Admin/Downloads/DanhSachSanPham_KV09072026-215404-812.xlsx`
- Stocktake detail export: `C:/Users/Admin/Downloads/DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx`

Product export:

- `657` rows total.
- `517` main products.
- `140` unit conversion rows.
- `Tồn kho` is the best current KiotViet stock snapshot available.
- QCVL imports this as `inventory_provisional_balances.source_type = kiotviet_import`.

Stocktake detail export:

- `333` stocktake detail rows.
- `129` distinct `Mã hàng`.
- `119` stocktake product codes match imported current product codes.
- `10` unmatched codes are `{DEL}` rows, meaning deleted/removed KiotViet products.
- Formula is stable: `SL lệch = Kiểm thực tế - Tồn kho`.
- `SL lệch tăng = max(SL lệch, 0)`.
- `SL lệch giảm = min(SL lệch, 0)`.

Important inference:

- Product export `Tồn kho` is current stock at export time after sales, purchases, stocktakes, and edits.
- Stocktake export is historical adjustment evidence, not current stock source.
- Latest stocktake `Kiểm thực tế` often differs from product export `Tồn kho`. Example: `HDA5` product stock is `60 Cuốn`, latest stocktake actual is `0 Cuốn`.
- Therefore QCVL must not use latest stocktake actual to overwrite current provisional stock.

---

## Scope Locked For This Plan

**Import now:**

| KV stocktake column | QCVL use |
|---|---|
| `Mã kiểm kho` | external stocktake code |
| `Thời gian` | source created time |
| `Ngày cân bằng` | source balanced time |
| `Trạng thái` | mapped status: `balanced`, `draft`, `cancelled`, or `unknown` |
| `Mã hàng` | link to `products.code` when present |
| `Tên hàng` | imported product name snapshot |
| `Đơn vị tính` | imported unit snapshot |
| `Tồn kho` | system quantity before KV balance |
| `Kiểm thực tế` | counted/actual quantity |
| `SL lệch` | difference quantity; must equal actual minus before |
| `SL lệch tăng` | positive difference column for audit |
| `SL lệch giảm` | negative difference column for audit |
| `Tổng thực tế` | value snapshot from KV |
| `Tổng chênh lệch` | summary value from KV |
| `Giá trị lệch` | line value difference when provided |
| `Ghi chú` | imported note |

**Do not do now:**

- Do not convert imported KiotViet stocktakes into official QCVL `stock_movements`.
- Do not replace `inventory_provisional_balances` with latest stocktake `Kiểm thực tế`.
- Do not create roll/sheet physical objects from historical stocktake rows.
- Do not calculate `Dự kiến hết hàng` until stock movements and usage history are reliable.

---

## UI Direction From KiotViet Reference

Apply only the parts that fit QCVL:

- Keep QCVL app shell/top navigation. Do not copy KiotViet blue topbar or hotline.
- In `Phiếu kiểm kho`, move `Theo mã phiếu kiểm` search into the top toolbar above the table, using shared compact search CSS.
- `/inventory` must open `Phiếu kiểm kho` directly. Do not show duplicate inner navigation buttons for `Hàng hóa`, `Phiếu kiểm kho`, `Tồn theo cuộn/tấm`, or `Khui vật tư`; those belong to other routes or later dedicated flows.
- Toolbar actions on the right: `+ Kiểm kho`, `Import KV`, `Xuất file`.
- Left filter sidebar keeps:
  - `Ngày tạo`: default `Tháng này` to match the sales document `Thời gian` filter. Users can open the same quick-time popover and choose `Toàn thời gian` when they need full imported KV history.
  - `Trạng thái`: checkbox controls for `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
  - `Người tạo`: defer until user data is real; do not show fake employee filtering.
- Table columns stay KiotViet-like: `Mã kiểm kho`, `Thời gian`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Trạng thái`.
- Clicking `Mã kiểm kho` opens inline detail. Detail rows are required before treating import as usable.
- Imported KV rows must show source label `Nguồn KiotViet`.
- Quick-time popovers in management filters must close when the user clicks outside the sidebar. This shared behavior currently applies to sales documents, finance cashbook, and stocktake filters through `ManagementFilterSidebar`.

---

## File Structure

**Create**

- `server/modules/inventory/kiotviet-stocktake-import.ts`
  - Server-side parser/mapper/orchestrator for KV stocktake rows.

- `server/modules/inventory/kiotviet-stocktake-import.test.ts`
  - Tests formula validation, code matching, preview summary, and apply behavior.

- `src/features/inventory/StocktakeImportDialog.tsx`
  - Dialog for selecting KV stocktake detail `.xlsx`, previewing summary, and importing history.

- `src/features/inventory/StocktakeImportDialog.test.tsx`
  - Tests preview/import dialog behavior.

**Modify**

- `server/http.ts`
  - Add inventory import handlers and repository methods.

- `server/db.ts`
  - Persist imported KV stocktake documents and items.

- `server/modules/inventory/inventory-routes.ts`
  - Add `POST /api/v1/inventory/stocktakes/import/kiotviet/preview`.
  - Add `POST /api/v1/inventory/stocktakes/import/kiotviet`.

- `src/features/inventory/inventory-service.ts`
  - Add preview/import service methods.

- `src/features/inventory/types.ts`
  - Add preview/result types and imported stocktake metadata.

- `src/features/inventory/InventoryPage.tsx`
  - Add `Import KV` button on `Phiếu kiểm kho` view.

- `src/features/inventory/InventoryPage.test.tsx`
  - Assert import button, preview flow, and imported history labels.

- `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`
  - Document KV stocktake import behavior and formulas.

- `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
  - Document import metadata and no-stock-movement rule.

---

### Task 0: Stocktake List UI Shell

**Files:**
- Modify: `src/features/inventory/InventoryPage.tsx`
- Modify: `src/features/inventory/InventoryPage.test.tsx`
- Modify: `src/features/inventory/inventory-service.ts`
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`

- [x] **Step 1: Write failing UI test**

Prove `Phiếu kiểm kho` view has:

- top toolbar search with placeholder `Theo mã phiếu kiểm`.
- toolbar buttons `+ Kiểm kho`, `Import KV`, `Xuất file`.
- left filter group `Ngày tạo` defaulting to `Tháng này`, with the same quick-time popover and custom date range pattern as sales documents.
- status checkbox filters for `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
- search submit calls `listStocktakes({ search, page: 1, page_size: 15 })`.

- [x] **Step 2: Run UI test and confirm RED**

Run:

```powershell
npx vitest run src/features/inventory/InventoryPage.test.tsx --testNamePattern "stocktake"
```

Expected: fail because search is still in sidebar and `Import KV` does not exist.

- [x] **Step 3: Implement UI shell**

Move search to `ManagementCompactToolbar` in the stocktake view. Keep `Ngày tạo` and status filters in the sidebar. Add `Import KV` button but only open a placeholder-disabled dialog or no-op until Task 5 wires the import dialog.

- [x] **Step 4: Run UI test and confirm GREEN**

Run:

```powershell
npx vitest run src/features/inventory/InventoryPage.test.tsx --testNamePattern "stocktake"
```

Expected: pass.

---

### Task 1: Stocktake Row Mapper

**Files:**
- Create: `server/modules/inventory/kiotviet-stocktake-import.ts`
- Create: `server/modules/inventory/kiotviet-stocktake-import.test.ts`

- [x] **Step 1: Write failing mapper tests**

Create tests for:

- valid row mapping.
- Excel serial date conversion.
- status mapping from `Đã cân bằng kho`, `Phiếu tạm`, `Đã hủy`.
- formula check: `SL lệch = Kiểm thực tế - Tồn kho`.
- invalid row when product code or stocktake code is missing.

- [x] **Step 2: Run mapper tests and confirm RED**

Run:

```powershell
npx vitest run server/modules/inventory/kiotviet-stocktake-import.test.ts
```

Expected: fail because module does not exist.

- [x] **Step 3: Implement mapper**

Implement:

- `mapKiotVietStocktakeRows(rows)`.
- `excelSerialToIso(serial)`.
- formula validation with tolerance `0.000001`.
- deleted-code detection for product codes ending with `{DEL}`.

- [x] **Step 4: Run mapper tests and confirm GREEN**

Run:

```powershell
npx vitest run server/modules/inventory/kiotviet-stocktake-import.test.ts
```

Expected: pass.

---

### Task 2: Preview Contract

**Files:**
- Modify: `server/http.ts`
- Modify: `server/modules/inventory/inventory-routes.ts`
- Modify: `src/features/inventory/types.ts`
- Modify: `src/features/inventory/inventory-service.ts`
- Test: `server/modules/inventory/kiotviet-stocktake-import.test.ts`

- [x] **Step 1: Add failing preview tests**

Preview summary must include:

- total rows.
- valid rows.
- invalid rows.
- distinct `Mã kiểm kho`.
- distinct `Mã hàng`.
- matched product codes.
- missing product codes.
- `{DEL}` deleted code count.
- formula error count.
- no database write.

- [x] **Step 2: Implement preview route**

Add:

```text
POST /api/v1/inventory/stocktakes/import/kiotviet/preview
```

Response:

```ts
{
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    stocktake_count: number
    product_code_count: number
    matched_product_count: number
    missing_product_count: number
    deleted_product_code_count: number
    formula_error_count: number
  }
  invalid_rows: Array<{ rowNumber: number; source_code: string | null; product_code: string | null; errors: string[] }>
  missing_product_codes: string[]
}
```

- [x] **Step 3: Run tests**

Run:

```powershell
npx vitest run server/modules/inventory/kiotviet-stocktake-import.test.ts server/http.test.ts
```

Expected: pass.

---

### Task 3: Persistence Without Stock Movement

**Files:**
- Modify: `server/db.ts`
- Modify: `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
- Test: `server/db.test.ts`

- [x] **Step 1: Add failing DB tests**

Prove:

- imported stocktakes upsert by `(organization_id, source_system, source_code)`.
- imported items upsert by source row or line number.
- linked product found by `products.code`.
- missing/deleted product remains import history with `product_id = null`.
- no `stock_movements` insert occurs.

- [x] **Step 2: Implement repository method**

Add:

```ts
upsertImportedKiotVietStocktakes(input: {
  organizationId: string
  rows: KiotVietStocktakeImportRow[]
}): Promise<{
  stocktakes_created: number
  stocktakes_updated: number
  items_created: number
  items_updated: number
  missing_product_rows: number
}>
```

Use existing `stocktakes` and `stocktake_items` if possible. If current columns cannot store source metadata cleanly, add import metadata columns:

- `stocktakes.source_system`
- `stocktakes.source_code`
- `stocktakes.source_created_at`
- `stocktakes.source_balanced_at`
- `stocktake_items.source_row_number`
- `stocktake_items.source_product_code`
- `stocktake_items.source_product_name`
- `stocktake_items.source_unit_name`

Do not write `stock_movements`.

- [x] **Step 3: Run DB tests**

Run:

```powershell
npx vitest run server/db.test.ts
```

Expected: pass.

---

### Task 4: Import Apply Contract

**Files:**
- Modify: `server/http.ts`
- Modify: `server/modules/inventory/inventory-routes.ts`
- Test: `server/http.test.ts`

- [x] **Step 1: Add failing HTTP apply test**

Test:

```text
POST /api/v1/inventory/stocktakes/import/kiotviet
```

Expected:

- imports valid rows.
- rejects formula errors unless explicitly allowed.
- returns created/updated counts.
- does not change product stock.
- does not create stock movements.

- [x] **Step 2: Implement handler**

Handler flow:

1. Parse `rows` or `file_base64`.
2. Map rows.
3. If invalid rows exist, return validation error unless `allow_partial = true`.
4. Upsert imported stocktakes.
5. Return summary.

- [x] **Step 3: Run HTTP tests**

Run:

```powershell
npx vitest run server/http.test.ts server/modules/inventory/kiotviet-stocktake-import.test.ts
```

Expected: pass.

---

### Task 5: Inventory UI Import

**Files:**
- Create: `src/features/inventory/StocktakeImportDialog.tsx`
- Create: `src/features/inventory/StocktakeImportDialog.test.tsx`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Modify: `src/features/inventory/inventory-service.ts`
- Modify: `src/features/inventory/types.ts`
- Test: `src/features/inventory/InventoryPage.test.tsx`

- [x] **Step 1: Add failing UI tests**

Prove:

- `Import KV` appears only in `Phiếu kiểm kho` view.
- Selecting file enables `Xem trước`.
- Preview shows `333 dòng`, `129 mã hàng`, `119 khớp hàng hóa`, `10 mã đã xóa/không khớp`.
- Import button remains disabled when formula errors exist.
- Successful import reloads stocktake list.

- [x] **Step 2: Implement dialog**

Dialog warning:

```text
File kiểm kho KiotViet chỉ nhập lịch sử đối soát. Không ghi tồn vận hành và không tạo thẻ kho QCVL.
```

- [x] **Step 3: Wire InventoryPage**

Add `Import KV` beside `+ Kiểm kho` in stocktake view.

- [x] **Step 4: Run UI tests**

Run:

```powershell
npx vitest run src/features/inventory/StocktakeImportDialog.test.tsx src/features/inventory/InventoryPage.test.tsx
```

Expected: pass.

---

### Task 6: Product Detail Cross-Link

**Files:**
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `server/http.ts`
- Modify: `server/db.ts`

- [x] **Step 1: Add failing product detail test**

In product detail, show latest imported KV stocktake evidence:

- latest KV stocktake code.
- latest actual quantity.
- latest difference.
- note that product export stock is still the provisional current snapshot.

- [x] **Step 2: Implement read-only metadata**

Add `latest_kiotviet_stocktake` to product detail/list only if cheap enough. If list query becomes heavy, load it when opening detail tab.

- [x] **Step 3: Run tests**

Run:

```powershell
npx vitest run src/features/catalog/CatalogPage.test.tsx server/http.test.ts
```

Expected: pass.

---

### Task 7: Docs And QA

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
- Modify: `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
- Modify: `docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md`

- [x] **Step 1: Update docs**

Document:

- Product import `Tồn kho` remains current provisional snapshot.
- Stocktake import is history/evidence.
- Formula: `SL lệch = Kiểm thực tế - Tồn kho`.
- Latest stocktake actual must not overwrite product provisional stock.
- Official stock requires explicit QCVL balance flow.

- [x] **Step 2: Full verification**

Run:

```powershell
npx vitest run server/modules/inventory/kiotviet-stocktake-import.test.ts server/http.test.ts server/db.test.ts src/features/inventory/StocktakeImportDialog.test.tsx src/features/inventory/InventoryPage.test.tsx src/features/catalog/CatalogPage.test.tsx
npm run typecheck
npm run lint
```

Expected: all pass.

- [x] **Step 3: Browser QA**

Open:

```text
http://127.0.0.1:3202/inventory
```

Verify:

- `Phiếu kiểm kho` view opens.
- `Import KV` opens dialog.
- Preview of `DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx` shows expected counts.
- Import reloads stocktake list.
- No product stock value changes just because history was imported.
- Console has no relevant app error.

2026-07-10 QA note: verified `/inventory` renders on `127.0.0.1:3202`, toolbar has `Theo mÃ£ phiáº¿u kiá»ƒm`, `+ Kiá»ƒm kho`, `Import KV`, `Xuáº¥t file`, dialog opens, and warning says KV import does not write operating stock. Console had no app error. File upload/preview QA still needs manual file selection or a browser tool that supports file input.

2026-07-10 filter QA/update:

- `Ngày tạo` on `/inventory` now follows the same shared time-filter UI as `/sales-documents`: default `Tháng này`, quick presets, and `Tùy chỉnh` date range.
- The stocktake custom date range uses the same `management-filter-date-range` markup as sales documents.
- Quick-time popovers close on outside click through shared `ManagementFilterSidebar.onPopoverClose`.
- Automated verification passed for the shared layout and the three affected pages: management layout, inventory, sales documents, and finance cashbook.

2026-07-10 Owner QA note: KV vs QCVL stocktake comparison is accepted as OK. Treat this plan's current import/stocktake comparison phase as done. Continue with the next deferred inventory work only when Owner asks for stock balancing or real operating-stock conversion.

---

## Execution Order

1. Stocktake list UI shell.
2. Mapper and preview.
3. Persistence.
4. UI import.
5. Product-detail cross-link.
6. Later: explicit `Duyệt tồn tạm` flow to turn `inventory_provisional_balances` into official stock movements.

---

## Self-Review

**Spec coverage:** Plan reflects discovered KV relationship: product export is current provisional stock; stocktake export is historical audit data; stock movement creation is explicit and deferred.

**Placeholder scan:** No step asks workers to guess whether history should update stock. The no-stock-movement rule is repeated in backend, DB, UI, and docs tasks.

**Type consistency:** Import fields use stocktake terms already present in QCVL docs: stocktake, stocktake item, actual quantity, difference quantity, balanced status, stock movement.
