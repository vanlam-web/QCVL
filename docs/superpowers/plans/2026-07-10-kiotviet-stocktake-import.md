# KiotViet Stocktake Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import KiotViet stocktake history into the Inventory/Kiem kho module as reviewable historical data, with a later explicit option to choose one initial KV stocktake as QCVL opening balance.

**Architecture:** Product import and stocktake import stay separate. Product import owns KiotViet catalog, prices, comparison-only provisional stock, and BOM from `Hàng thành phần` (active/usable immediately per Owner 2026-07-20). Stocktake import owns historical KiotViet stocktake documents and lines. Official QCVL stock is calculated from one Owner-selected opening checkpoint plus later QCVL movement sources: purchase/import receipts, sales deductions, returns, stocktake balance, and roll/sheet/object operations that write `stock_movements`.

**Import reset rule:** Shared KiotViet import dialogs use a separate `Xóa dữ liệu cũ` action. Do not use a checkbox inside `Import` for cleanup. For stocktake import, the delete action removes only historical KiotViet stocktake documents/lines (`stocktakes.source_type = kiotviet_import` or `source_system = kiotviet`) and does not touch products, operating stock, or stock movements.

**Tech Stack:** React 19, TypeScript, Vite, Node HTTP server, PostgreSQL repository, Vitest, existing Inventory module, existing XLSX parser, existing management UI components.

---

## Current Role In Product Completion 2026-07-11

This plan supports the larger `Hoan thien Hang hoa` objective. It exists because product stock cannot be completed using only the product export:

- Product export gives comparison-only provisional stock.
- Stocktake export gives audit evidence for past adjustments by default.
- QCVL must keep product export stock separate from operating stock. KV product `Ton kho` is not an opening balance or automatic conversion source.
- Exception approved 2026-07-12: one initial KV stocktake can be selected later as opening balance. Only that selected stocktake becomes the starting checkpoint; other KV stocktakes remain history/evidence unless later promoted through a clear adjustment flow.

Current status:

- KV stocktake import and KV/QCVL comparison are accepted as OK.
- Imported stocktake data remains history/evidence by default. Opening-balance use requires a separate explicit selection of stocktake code/date.
- 2026-07-11 creator correction:
  - KiotViet has at least 2 stocktake detail export variants. `DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx` has 18 columns and no `Nguoi tao`; `DanhSachChiTietKiemKho_KV11072026-191227-228.xlsx` has 22 columns and includes `Nguoi tao`.
  - Imported KiotViet stocktakes must not display the QCVL importer as creator.
  - If the source file has no `Nguoi tao`, `stocktakes.created_by` is `null` and `/inventory` shows `Chua co du lieu`.
  - If the source file has reliable `Nguoi tao`, keep it as raw source/audit data in `stocktakes.source_creator_name` and map to QCVL `users.id` only when it matches QCVL `users.username` after stripping `{DEL}`. Do not map by display name, phone, or email. UI/filter still use one normalized people source: QCVL account `created_by`. Lists hydrate the current account display name from `users`, so later account edits are reflected without re-import.
  - Time sources are normalized too: KV `Thoi gian` becomes `source_created_at`; KV `Ngay can bang` may remain `source_balanced_at` for audit/import only. UI does not show `Ngay can bang` or balance person anywhere.
  - Local 3202 dev-memory state may contain legacy imported rows that once stored `Admin`; repository load/save must sanitize/remap KV rows from source creator data instead of preserving fake importer attribution.

Do not restart stock balancing from this plan unless Owner explicitly asks for QCVL operating-stock movement design. KV import data remains comparison-only except the selected initial stocktake checkpoint.

Boundary with product plan:

- Parent plan: `docs/superpowers/plans/2026-07-09-kiotviet-product-import.md`.
- This stocktake plan is not the final goal. It supplies audit history, creator data, and comparison evidence for `Hang hoa`.
- If a new stocktake task does not improve product stock correctness, product history, or product filters, defer it.
- After creator import/filter is done, return to product stock display and official stock formula/movement design.

Current next stocktake slice:

1. Done: keep stocktake creator labels truthful. No fake `Admin` for KV imports that lack source creator data.
2. Done: parse optional KV `Nguoi tao`, store `source_creator_name`, and map only by QCVL `users.username` after stripping `{DEL}`.
3. Done: `/inventory` creator filter uses QCVL `created_by` only; unmatched KV source creator shows `Chua khop tai khoan`, missing source creator shows `Chua co du lieu`.
4. Done: return to `/products` stock display label. Imported KV snapshot is shown as `Ton KV tam nhap`, not official operating stock.
5. Done: clicking stocktake code opens a shared inline detail. Detail loads `GET /api/v1/inventory/stocktakes/{id}`, shows header with only `Nguoi tao` and `Ngay tao`, shows compact imported line columns (`Ma hang`, `Ten hang`, `Ton kho`, `Thuc te`, `SL lech`), note, and summary totals. The in-detail search row (`Tim ma hang` / `Tim ten hang`) was removed to keep the detail layout aligned with older shared detail tables. UI still must not show separate balance person/date anywhere.
6. Done: stocktake toolbar search placeholder is `Ma phieu, ma hang, ten hang`; backend search includes stocktake code/note plus item product code/name from imported source rows or matched QCVL products. Search now reloads the list while typing, Enter reruns the same filter, and the `+ Kiem kho` action stays inside the compact search input and becomes `Xoa tim kiem` (`x`) when the search input has text.
7. Done: stocktake detail note is editable inline with shared `management-detail-note`; `Luu` calls `PATCH /api/v1/inventory/stocktakes/{id}` and updates the list row. The note area is wider than before by adjusting the shared lower-detail grid, not adding per-page CSS.
8. Done: creator filter options come from `creator_options` on the list response, computed from all records matching current search/date/status and ignoring the selected `created_by`, so dropdown options do not collapse to the current page or current selected creator.
9. Done: stocktake list columns are now product-focused for the Hang hoa finish path: `Ma phieu`, `Ngay kiem`, `Ma hang`, `Ten hang`, `Ton truoc`, `Kiem duoc`, `Lech`, `Trang thai`. Hide `Nguoi tao`, `SL lech tang`, `SL lech giam`, `Ghi chu`, `Tong thuc te`, and `Tong chenh lech` from the main table. Backend list hydrates representative `product_code/product_name/product_system_qty/product_actual_qty/product_difference_qty` from the first stocktake item, using source KV data first and matched QCVL product data as fallback.
10. 2026-07-11 Owner QA: creator filter looks correct on 3202. Treat the current filter slice as nearly done; only fix small UI/data issues if Owner points them out.
11. 2026-07-11 decision: do not implement `+ Kiem kho` manual stocktake for the runnable version. If a user checks a product and needs to correct its quantity, use Product edit/direct stock correction for now; that path creates traceable automatic stocktake records for normal products where supported.
12. Done: detail `Huy` is active. It opens an in-app confirmation dialog, calls `PATCH /api/v1/inventory/stocktakes/{id}` with `status: cancelled` only after `Dong y`, updates the detail/list status, and does not delete rows or write stock movements.
13. Deferred stocktake work: `+ Kiem kho` manual creation, manual save/balance QCVL flow, real `Sao chep` / `Xuat file` / `In` detail actions, and column chooser if Owner needs extra imported columns. The placeholder buttons remain visible but disabled so the UI can be extended later.
14. Next product dependency: official stock cannot be correct until the opening checkpoint is selected and purchase/import receipts, sales deductions, returns, stocktake balance, and roll/sheet/object operations after that checkpoint all write reliable `stock_movements`.
15. Done: management search was standardized outside POS. Hàng hóa, Khách hàng, Nhà cung cấp, Bảng giá, Hóa đơn, Nhập hàng, Sổ quỹ, Quản trị, and Kiểm kho use the shared compact search behavior: type-to-filter, Enter reruns the current filter only, `+` becomes `Xóa tìm kiếm`, old sidebar `Tìm: ...` summaries are removed, no back-office search dropdown/listbox is shown, and search matching is accent-insensitive through shared client helper plus API/DB normalization.
16. Current stop point for stocktake: the runnable version can leave `/inventory` here unless Owner finds a small UI/data issue. Return to the larger `Hang hoa` path: verify product stock labels, then start the Customer/Supplier/Purchase/Sales dependency chain for real operating stock.

---

## Current Facts From Owner Files

Files inspected:

- Product export: `C:/Users/Admin/Downloads/DanhSachSanPham_KV09072026-215404-812.xlsx`
- Stocktake detail export: `C:/Users/Admin/Downloads/DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx`
- Stocktake detail shown/export with creator: `C:/Users/Admin/Downloads/DanhSachChiTietKiemKho_KV11072026-191227-228.xlsx`

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

Known KiotViet stocktake detail export columns:

- `DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx` has 18 columns: `Mã kiểm kho`, `Thời gian`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Trạng thái`, `Mã hàng`, `Tên hàng`, `Thương hiệu`, `Đơn vị tính`, `Tồn kho`, `Kiểm thực tế`, `SL lệch`, `Giá trị lệch`. No `Người tạo`.
- `DanhSachChiTietKiemKho_KV11072026-191227-228.xlsx` has 22 columns: `Mã kiểm kho`, `Thời gian`, `Người tạo`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `Tổng giá trị lệch`, `SL lệch tăng`, `Tổng giá trị tăng`, `SL lệch giảm`, `Tổng giá trị giảm`, `Ghi chú`, `Trạng thái`, `Mã hàng`, `Tên hàng`, `Thương hiệu`, `Đơn vị tính`, `Tồn kho`, `Kiểm thực tế`, `SL lệch`, `Giá trị lệch`.
- Parser/import must support both variants. `Người tạo` is optional source data, not the QCVL importer; it must map into QCVL account `created_by` by username when possible, not become a second people field in UI.

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
| `Ngày cân bằng` | source audit time only; do not show in UI |
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

- Do not automatically convert imported KiotViet stocktakes into official QCVL `stock_movements`.
- Later opening-balance work may choose one initial KiotViet stocktake as the starting checkpoint. That must be an explicit action, must record the chosen stocktake code/date, and must exclude documents before the checkpoint from current-stock calculation.
- Do not replace `inventory_provisional_balances` with latest stocktake `Kiểm thực tế`.
- Do not create roll/sheet physical objects from historical stocktake rows.
- Do not calculate `Dự kiến hết hàng` until stock movements and usage history are reliable.

---

## UI Direction From KiotViet Reference

Apply only the parts that fit QCVL:

- Keep QCVL app shell/top navigation. Do not copy KiotViet blue topbar or hotline.
- In `Phiếu kiểm kho`, keep the shared compact search in the top toolbar with placeholder `Mã phiếu, mã hàng, tên hàng`; search matches stocktake code/note plus item product code/name.
- `/inventory` must open `Phiếu kiểm kho` directly. Do not show duplicate inner navigation buttons for `Hàng hóa`, `Phiếu kiểm kho`, `Tồn theo cuộn/tấm`, or `Khui vật tư`; those belong to other routes or later dedicated flows.
- Toolbar actions: shared compact-search `+` placeholder inside the search box, then `Import KV`. `Xuất file` is not an MVP operating function for Stocktake.
- Left filter sidebar keeps:
  - `Ngày tạo`: default `Năm nay` so the stocktake list does not appear empty when recent stocktake history spans several months. Users can open the same quick-time popover and choose `Toàn thời gian` when they need full imported KV history.
  - `Trạng thái`: checkbox controls for `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
  - `Người tạo`: for QCVL-created/manual records, use real QCVL users and show the current `display_name`; for KiotViet imports with `Người tạo`, map only by QCVL `users.username` after stripping `{DEL}`. If mapped, show the current QCVL display name. If source creator exists but no account matches, show `Chưa khớp tài khoản`. If the file has no creator column, show `Chưa có dữ liệu`.
- Table columns stay compact and quantity-focused: checkbox, favorite star, `Mã phiếu`, `Ngày kiểm`, `Mã hàng`, `Tên hàng`, `Tồn trước`, `Kiểm được`, `Lệch`, `Trạng thái`. Do not show `Người tạo`, balance date/person, increase/decrease totals, note, or money totals in the main table.
- Clicking the whole row opens inline detail. Detail rows are required before treating import as usable.
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

- top toolbar search with placeholder `Mã phiếu, mã hàng, tên hàng`.
- toolbar has shared compact-search `+` placeholder inside the search box plus `Import KV`; when search has text, the same shared component changes `+` to `Xóa tìm kiếm`. `Xuất file` is deferred.
- left filter group `Ngày tạo` defaulting to `Năm nay`, with the same quick-time popover and custom date range pattern as sales documents.
- status checkbox filters for `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
- search submit calls `listStocktakes({ search, page: 1, page_size: 15 })`; backend search includes stocktake item product code/name.

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

Add `Import KV` beside the shared compact-search create action in stocktake view.

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

2026-07-10 QA note: verified `/inventory` renders on `127.0.0.1:3202`, toolbar search uses shared compact-search behavior, `Import KV` dialog opens, and warning says KV import does not write operating stock. Console had no app error. File upload/preview QA still needs manual file selection or a browser tool that supports file input.

2026-07-10 filter QA/update:

- `Ngày tạo` on `/inventory` now follows the same shared time-filter UI as `/sales-documents`: default `Năm nay`, quick presets, always-visible from/to date inputs, and calendar icon popovers.
- The stocktake custom date range uses the same `management-filter-date-range` markup as sales documents.
- Quick-time popovers close on outside click through shared `ManagementFilterSidebar.onPopoverClose`.
- Automated verification passed for the shared layout and the three affected pages: management layout, inventory, sales documents, and finance cashbook.

2026-07-10 Owner QA note: KV vs QCVL stocktake comparison is accepted as OK. Treat this plan's current import/stocktake comparison phase as done. Continue with the next deferred inventory work only when Owner asks for stock balancing or real operating-stock formula/movement design.

---

## Execution Order

1. Stocktake list UI shell.
2. Mapper and preview.
3. Persistence.
4. UI import.
5. Product-detail cross-link.
6. Later: official stock formula/movement design. Do not create a `Duyệt tồn tạm` flow that turns KV provisional stock directly into official stock movements; use KV stock only to compare against QCVL-calculated stock.

---

## Self-Review

**Spec coverage:** Plan reflects discovered KV relationship: product export is comparison-only provisional stock; stocktake export is historical audit data by default; official stock is calculated from one explicit opening checkpoint plus later QCVL movement sources, not from automatic KV import conversion.

**Placeholder scan:** No step asks workers to guess whether history should update stock. The no-stock-movement rule is repeated in backend, DB, UI, and docs tasks.

**Type consistency:** Import fields use stocktake terms already present in QCVL docs: stocktake, stocktake item, actual quantity, difference quantity, balanced status, stock movement.
