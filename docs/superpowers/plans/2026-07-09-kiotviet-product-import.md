# KiotViet Product Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable KiotViet Excel import flow for the Hàng hóa page that can preview and safely import the same KV product export many times without creating duplicates or silently deleting real data.


> **Historical plan (2026-07 docs cleanup):** File này là lịch sử triển khai. SoT hiện hành + runtime: `docs/DOC-CLEANUP-CHECKLIST.md`, `docs/03-BUSINESS-NghiepVu/Inventory/README.md`, `docs/03-BUSINESS-NghiepVu/Sales/README.md`, `docs/03-BUSINESS-NghiepVu/BOM/`. Owner 2026-07-20: **không mở đợt import KiotViet mới**. **Reality 2026-07-21 trên `main`:** BOM KV `active` + migrate `0008` + POS skip parent — **đã khớp**; bỏ qua mọi dòng “draft / never auto-active / trừ mã combo” còn sót trong thân plan.

**Architecture:** Extract the existing CLI mapper into a shared parser so CLI, server tests, and UI import use one mapping contract. Add a server preview/import endpoint that validates rows, optionally clears only demo products, and upserts product groups/products by organization + product code. Add a shared top-right import action to the Catalog toolbar and a modal that uploads `.xlsx`, shows a preview summary, and only writes after confirmation.

**Tech Stack:** React 19, TypeScript, Vite, Node HTTP server, PostgreSQL repository, Vitest, existing QCVL API envelope/error handling, existing `ManagementCompactToolbar` and shared CSS.

---

## Current Product Completion Roadmap 2026-07-12

Final objective: finish the `Hang hoa` module as usable real data, not only finish the Excel import button. Work that appears outside `/products` still belongs to this objective when it is required for product correctness.

Active product-completion rule:

- This plan is the parent plan.
- `Kiem kho`, `Nguoi tao`, and `/admin` user management are dependency work, not separate product goals.
- When work moves to another page, record why that page blocks `Hang hoa`, finish only the needed slice, then return to the product completion path.
- Do not add broad admin/settings/inventory features unless they directly unblock product data, stock, creator attribution, or product filters.

Current path:

1. Product import and product list foundation: done.
   - Re-import KiotViet product files safely.
   - Store product master data, price, source created time, unit conversion, provisional stock, and draft BOM.
   - Default `/products` list and filters use real imported fields.

2. Stocktake import: done as a supporting dependency.
   - Reason: product stock could not be trusted without KV stocktake evidence.
   - Current rule: KV stocktake import is history/evidence by default. A specific early KV stocktake may become the QCVL opening balance only when Owner explicitly selects it as the starting checkpoint.
   - Linked plan: `docs/superpowers/plans/2026-07-10-kiotviet-stocktake-import.md`.

3. User management / creator data: foundation done as a supporting dependency.
   - Reason: KV inventory and stocktake screens use `Nguoi tao`; QCVL must have real users before creator filters and imports can be accurate.
   - Current rule: create QCVL users first where possible, then import/map creator fields by account identity only.
   - If a KV creator does not match a QCVL user, store a source snapshot instead of forcing a wrong `users.id`.
   - Recent foundation: `/admin` user creation now persists real users in both Postgres and 3202 dev-memory API; required-field validation was added before saving.
   - Account direction recorded: login should support `Ten dang nhap` or `So dien thoai`; email is required for password recovery/security contact in real operations, not the primary login identity.
   - 2026-07-11 update: KiotViet stocktake detail has at least 2 formats. Older 18-column export has no `Nguoi tao`; newer 22-column export has `Nguoi tao`.
   - 2026-07-11 update: stocktake import stores raw KV creator in `stocktakes.source_creator_name`, then maps to QCVL `created_by` only by `users.username` after stripping `{DEL}`. Do not map by display name, phone, or email.
   - 2026-07-11 update: stocktake APIs and `/inventory` expose `created_by` as `{id, name}` only when the source maps to a real QCVL account. Lists hydrate the current account display name, so account edits show in old imported stocktakes without re-import.
   - 2026-07-11 update: purchase receipt creator filter now follows the same rule: `created_by.id` is the API/filter value and `created_by.name` is the visible label.
   - QCVL importer must not be displayed as KV `Nguoi tao`. Raw KV creator is audit/mapping data only; UI/filter use one people source: QCVL `created_by`.
   - Keep QCVL users complete enough for future KV creator matching; do not show `username` as the visible creator label when a display name exists.

4. Next product-module work after user foundation:
   - Creator snapshot/mapping for KiotViet stocktake import is done.
   - `Nguoi tao` filter can use imported/mapped QCVL account data where present.
   - Return to `/products` stock display: show provisional KV stock clearly, and prepare a separate operating-stock path.
   - Do not start `Du kien het hang` until stock movement history is reliable.

5. Product stock completion target:
   - `/products` must show imported KV stock as comparison-only data, clearly labeled `Ton KV tam nhap` so it is not confused with official QCVL operating stock.
   - KV product export stock remains audit/comparison only. It must not become an opening balance, baseline movement, or automatic correction.
   - KV stocktake history remains audit/comparison by default. Exception: one explicit initial KV stocktake can become an opening-balance checkpoint after Owner chooses the stocktake code/date and confirms that earlier documents should not be counted for current stock.
   - Official operating stock must be calculated from an opening checkpoint plus QCVL movement sources before it can drive POS, stock cards, or expected-out-of-stock calculations: the selected initial stocktake sets opening quantity, purchase/import receipts after the checkpoint increase stock, sales invoices/POS after the checkpoint decrease stock, returns reverse the related direction, later stocktake balance adjusts differences, and roll/sheet/object operations write their own movements.
   - Movement sources have upstream dependencies: purchase/import receipts need supplier data; sales invoices/POS need customer data. Do not treat product stock as complete until Customer, Supplier, Purchase, Sales/POS, and Stocktake all write/read the same stock movement story.
   - Stocktake balance belongs in `/inventory` `Phiếu kiểm kho`; `/products` only displays stock, source labels, evidence, and links into stocktake flows.

6. Dependency order for real operating stock:
   - Pick one initial KV stocktake checkpoint as opening balance if Owner confirms it is the first trusted count.
   - Customer foundation first: invoice/POS stock-out and customer debt/history depend on stable customer records, including `Khach le`.
   - Supplier foundation next: purchase/import stock-in and product supplier history depend on stable supplier records.
   - Purchase/import receipts after the opening checkpoint then write stock-in movements.
   - Sales invoices/POS after the opening checkpoint then write stock-out movements.
   - Returns after the checkpoint write opposite-direction movements.
   - Later stocktake/can bang kho then writes adjustment movements from counted differences.
   - `/products` reads the result and compares QCVL-calculated stock with `Ton KV tam nhap`; it does not create stock by itself.

7. Deferred until product stock is reliable:
   - `Nha cung cap`: derive from purchase/import receipt history, because one product can have multiple suppliers.
   - `Du kien het hang`: compute from reliable sales/purchase/stock movement history, not from copied KV text.
   - BOM activation: use imported BOM as draft only until reviewed.

Scope guard:

- The goal is still `Hoan thien Hang hoa`.
- `Kiem kho`, `Nguoi tao`, and user management are side dependencies because product stock, product history, and product filters need them.
- Do not expand into unrelated admin/settings work unless it blocks product completion.

Current next-step order:

1. Stop broad `/admin` work unless it directly blocks creator mapping or product correctness.
2. Treat KV stocktake creator mapping as done: raw `source_creator_name`, username-only account mapping, current display-name hydration.
3. Do not block the runnable version on manual `+ Kiem kho`. If a product is physically checked and needs a correction, use Product edit/direct stock correction for now; manual stocktake creation is deferred.
4. Stocktake detail now has working `Luu` note and `Huy` status change. `Huy` uses an in-app confirmation dialog, calls `PATCH /api/v1/inventory/stocktakes/{id}` with `status: cancelled`, and does not write/delete stock movements. `Sao chep`, `Xuat file`, and `In` remain visible but disabled placeholders for later; do not block the runnable version on them.
5. Customer foundation is the active dependency before invoices/POS. Review real imported customer fields, `Khach le`, search, detail tabs, creator mapping, and safe cleanup before leaving Customers.
6. Supplier foundation is now good enough for the stock plan: imported real KV suppliers, safe delete/re-import flow, shared search/table/detail shell, and no need to deepen supplier debt/history/report before stock-in.
7. Purchase receipt list UI is done with `ManagementDataTable`. Current visible columns are checkbox, favorite star, `Ma nhap hang`, `Nha cung cap`, `Tong so luong`, `Tong tien hang`, `Can tra NCC`, and `Tien da tra NCC`; do not bring back `Thoi gian`, `Ma NCC`, `Con phai tra`, or `Trang thai` on the main list unless Owner reopens that decision. Posted imported purchase receipts now expose stock-in movement data in dev-memory, including unit-conversion alias quantity conversion.
8. Sales documents stock-out is now started: KiotViet invoice import exists on `/sales-documents`, groups rows by `Ma hoa don`, maps blank/`Khach le` customers to `khachle`, auto-creates inactive placeholders for KV-deleted customer/product codes ending `{DEL...}`, maps seller/creator into one QCVL account, ignores sales channel/wallet/card fields, and writes completed invoices as `sale_deduction` stock-out movements in dev-memory. POS stock-out remains the later live-sales source.
9. Stocktake adjustment comes after the movement story is stable. KiotViet stocktake stays evidence only unless one initial KV stocktake is explicitly selected as the opening checkpoint.
10. Product stock display must read formula-based QCVL stock from opening balance + `stock_movements` and compare it with `Tồn KV tạm nhập`; it must not turn KV product export stock into an opening balance.
11. Later, build `Du kien het hang` only when reliable stock movement history exists.

### Reality Update 2026-07-12: Operating Stock Direction

This plan remains the parent path for finishing `Hang hoa`. The current work is dependency work for correct stock, not random module hopping.

Official QCVL stock formula:

`QCVL ton hien tai = selected opening stocktake balance + stock-in purchase movements after checkpoint - stock-out sales movements after checkpoint +/- returns and later adjustment movements`

Rules:

- KiotViet product `Ton kho` is comparison/audit data only.
- KiotViet stocktake counts are comparison/audit data by default.
- One initial KiotViet stocktake may be promoted to opening balance only by an explicit Owner-selected checkpoint. This is not automatic import behavior.
- When an opening checkpoint is selected, documents before that date do not affect current stock. They may be kept as history only.
- `/products` shows two concepts separately: QCVL calculated stock and `Ton KV tam nhap`.
- If movement sources are incomplete, Product must say stock is not finalized instead of showing KV data as official stock.

Locked dependency path:

1. Confirm the initial KV stocktake checkpoint when ready to build stock calculation.
2. Customers stable enough for invoices/POS and `Khach le`.
3. Suppliers stable enough for purchase receipts. Defer deep supplier payable/history/report work until after product stock path is runnable.
4. Purchase receipts after checkpoint write trusted stock-in movements. Dev-memory import path is done for posted KiotViet receipts.
5. Sales invoices/POS after checkpoint write trusted stock-out movements. This is the next stock-correctness dependency.
6. Returns after checkpoint reverse stock as needed.
7. Later stocktake writes explicit adjustment movements.
8. Products displays calculated QCVL stock and compares with KV evidence.

Current status:

- Customers: current active page to review. It must be stable for invoice/POS import and `Khach le` before moving deeper into stock-out.
- Suppliers: checkpoint reached for current goal. Import KV NCC works, old import cleanup works, real supplier list is back after re-import, and deep supplier debt/history/report is deferred.
- Purchase receipts: imported for the current data slice. List/table/detail shell is done. Import KV uses `DanhSachChiTietNhapHang_KV...xlsx`, groups rows by `Ma nhap hang`, maps supplier by `Ma nha cung cap`, maps product by `Ma hang`, and has a separate `Xoa du lieu cu` action. Current file `DanhSachChiTietNhapHang_KV12072026-135400-901.xlsx` imported 1,737 detail rows / 684 posted receipts. Blank supplier codes map to `NCC le` / `Nha cung cap le`; import upserts that supplier before writing receipts. Unit-conversion item codes such as `B260` resolve through `product_unit_conversions.source_code`. Historical KV-deleted product codes that still appear in receipts are created as inactive, non-inventory-tracked products so receipt history can match without making those products count as current operating stock. Posted imported receipts now read as `stock_movements.purchase_receipt` stock-in in dev-memory; conversion-code quantities are converted to the parent product stock unit.
- Sales/POS: KiotViet invoice import is now the historical stock-out source for current local data. POS remains the live checkout source and is excluded from shared management UI cleanup.
- Stocktake: KV import/detail/cancel/note foundation done; manual `+ Kiem kho` deferred for runnable version.
- Products: product import and KV comparison data done. Stock-in from purchase receipts is available; stock-out from imported sales invoices is available in dev-memory. Imported balanced stocktakes now act as stock checkpoints: the movement story resets to `actual_qty` at the balanced time, then later purchase/sales movements continue from that checkpoint. Imported sales invoice rows for combo products now deduct draft BOM component stock, matching KV `Ban hang [Combo - Dong goi]` stock-card behavior. `/products` main table shows `Ton QCVL` from current `stock_movements`, while `Ton KV tam nhap` stays in the inventory detail as comparison evidence. This slice still does not include returns, live POS gaps, or the Postgres aggregate path.

### Reality Update 2026-07-12: Operating Stock Formula vs KiotViet

Investigation on KV product `BT` showed the root causes of the earlier large stock mismatch:

- KV stock card for `BT` has many `Ban hang [Combo - Dong goi]` rows. QCVL was only deducting direct invoice lines where `product_code = BT`, not combo BOM component usage.
- QCVL direct `BT` sales deduction was about `3,353.641`; combo BOM sales should deduct about `55,874.836` more.
- KV stocktake `KK000328` on `2026-05-28` reset `BT` actual stock to `2,500`. After applying later document movements, QCVL calculates `1,910.2492`, matching KV `1,910.249` within rounding.
- Current API comparison after the fix: active products `383`, tracked comparable rows `214`, matched `193`, mismatched `21`. Remaining large mismatches start with `SP000184`, `SP000166`, and `DCS`; inspect missing stocktake rows, unit conversions, BOM definitions, or return/adjustment sources per code before claiming full stock parity.
- Follow-up import hardening: repeated KiotViet invoice import must replace the item set for each `Ma hoa don` in the current batch, not append by `rowNumber`. KiotViet row numbers differ across exported files, so keeping old row numbers creates duplicated invoice lines. Regression test added in dev-memory repository. Current dev-memory invoices were deleted/re-imported from all `DanhSachChiTietHoaDon_KV12072026*.xlsx` files after this fix.
- After re-import with the replace-by-invoice rule, meaningful stock mismatches are down to 6 rows with `abs(diff) > 0.001`: `SP000184`, `SP000166`, `DCS`, `PP`, `MD`, `A6XD2008`. Only 4 are above `1` unit: `SP000184`, `SP000166`, `DCS`, `PP`.
- `SP000184` evidence: product export says current KV stock `309.8 ml`, QCVL formula says `2154.8 ml`; imported stocktake files contain no row for `SP000184`/`Muc in epsion`. QCVL sees one purchase `2500 ml` and only `345.2 ml` BOM consumption. This cannot be made exact from current imported files without KV stock card/adjustment history or historical BOM versions.
- Remaining mismatch direction likely comes from one of these missing sources: stock card adjustments not present in the stocktake export, return/adjustment files not imported yet, or historical combo BOM changes. Current QCVL applies the latest imported BOM to all historical combo invoices, while KV stock card deducts the BOM version effective at sale time.
- Owner exported `BaoCaoXuatNhapTonChiTiet_KV12072026-232213-326.xlsx` from KiotViet Product Report (`Xuat nhap ton chi tiet`, range `2020-12-29` to `2026-07-12`). This report is now the strongest aggregate evidence for remaining stock mismatches.
- Report finding for 6 meaningful mismatches:
  - `SP000184`: KV `Nhap NCC 2500`, `Xuat ban 2190.2`, `Ton cuoi 309.8`; QCVL only sees `Xuat ban 345.2`. Missing source is sale/BOM history, not stocktake, Xuat huy, or Xuat dung noi bo.
  - `SP000166`: KV `Nhap NCC 363`, `Nhap kiem 12.1`, `Xuat ban 239.312`, `Ton cuoi 135.788`; QCVL currently derives `Nhap kiem 189.162` and `Xuat ban 606.571`, so both stocktake handling and BOM sale history are wrong for this code.
  - `DCS`: KV `Xuat ban 11551.16673`, QCVL sees `11376.68001`; missing about `174.487` sales/BOM deduction.
  - `PP`: KV `Xuat ban 4942.6352`, QCVL sees `4944.0752`; QCVL over-deducts about `1.44`.
  - `MD`: KV `Nhap kiem 21.125666`, `Xuat ban 83.537499`, QCVL sees `Nhap kiem 16.296922`, `Xuat ban 78.089055`; mismatch comes from both stocktake and sales/BOM.
  - `A6XD2008`: KV `Xuat ban 1.4465`, `Xuat kiem 0.25`, QCVL sees `Xuat ban 1.00178`, `Xuat kiem 0.43768`; mismatch comes from sales/BOM and stocktake delta handling.
- Important correction: KiotViet XNT report treats stocktake as `Nhap kiem` / `Xuat kiem` using the exported difference quantities. QCVL should not blindly reset every balanced stocktake to `actual_qty` for all history if the goal is matching KV movement columns. The earlier BT match was partly compensating errors: QCVL over-counted `Xuat ban` from latest BOM and under-counted `Xuat kiem` from reset logic, ending stock happened to match.
- 2026-07-12 update: Added `server/modules/inventory/kiotviet-xnt-report.ts` and `scripts/compare-kiotviet-xnt.ts` to parse the KiotViet XNT workbook and compare QCVL movement buckets against KV buckets. Latest run with `BaoCaoXuatNhapTonChiTiet_KV12072026-232213-326.xlsx` wrote evidence to `logs/kiotviet-xnt-comparison-latest.json`.
- Latest XNT comparison: KV rows `328`, QCVL movements `29637`, raw mismatches `17`, active/tracked/non-combo mismatches `8`, KV-only deleted/history rows `7`.
- Active/tracked mismatches to inspect next:
  - `SP000184`: QCVL `2154.8`, KV `309.8`, diff `+1845`; QCVL missing `1845` sale/BOM out.
  - `SP000166`: QCVL `-54.409`, KV `135.788`, diff `-190.197`; QCVL stocktake-in and sale/BOM buckets are both off.
  - `DCS`: QCVL `1620.61999`, KV `1446.13327`, diff `+174.48672`; QCVL missing sale/BOM out.
  - `GB160A4`: QCVL `-724.1`, KV `-721.1`, diff `-3`; small stocktake/sale bucket compensation.
  - `PP`: QCVL `1631.2248`, KV `1632.6648`, diff `-1.44`; QCVL over-counts sale out by `1.44`.
  - `F10`: QCVL `0.4182`, KV `-0.2292`, diff `+0.6474`; QCVL missing sale/BOM out.
  - `MD`: QCVL `29.207867`, KV `28.588167`, diff `+0.6197`; stocktake and sale/BOM buckets differ.
  - `A6XD2008`: QCVL `2.81054`, KV `2.5535`, diff `+0.25704`; sale/BOM and stocktake-out buckets differ.
- Next stock-parity decision should not guess from the UI. Use the XNT comparison evidence first, then choose: (a) import XNT as trusted reconciliation snapshot for imported history, or (b) rebuild exact historical stock movements by adding historical BOM versions and KiotViet stocktake difference movements.
- Owner approved option (a): use the XNT report as the trusted reconciliation checkpoint for imported history. Do not rebuild old BOM versions now.
- Implementation update: `scripts/apply-kiotviet-xnt-checkpoint.ts` applies the XNT ending stock through the existing KiotViet stocktake import endpoint as a balanced checkpoint. Applied source code: `XNT-KV-2026-07-12-232213`, rows `328`, missing product rows `7` (deleted/history codes).
- Bug fixed during checkpoint: deleted KiotViet codes such as `SP000111{DEL}` must not strip to `SP000111` when the exact placeholder product is missing. Otherwise a deleted/history row can reset the active product incorrectly.
- Latest result after checkpoint + `{DEL}` resolver fix: raw mismatches `3`, active/tracked/non-combo mismatches `0`, KV-only deleted/history rows `7`. Product stock parity for active tracked goods is now reached for the imported history snapshot.
- POS/live update: new QCVL checkout invoices now persist line `quantity`, `unit_price`, and `discount_amount` into dev-memory `salesDocumentItems` through `saveSalesDocument`. These saved invoices feed the same `sale_deduction` stock movement path as imported KiotViet invoices, so stock decreases from the XNT checkpoint forward.
- BOM decision: Owner confirmed BOM imported from KiotViet is trusted. Do not require a separate BOM approval gate for the runnable version. POS/live invoices selling combo/BOM products deduct trusted KV BOM components, not the combo product itself.
- POS cancel rule: hủy hóa đơn POS must update the sales document status to `cancelled`, not delete the document/items. Operating stock restores automatically because only `completed` sales documents create `sale_deduction` movements.

### Reality Update 2026-07-12: KiotViet Invoice Import

Implemented for the current stock-correctness path:

- `/sales-documents` has an `Import KV` dialog using the shared KiotViet import shell and separate `Xoa du lieu cu` cleanup action.
- Backend endpoints:
  - `POST /api/v1/sales-documents/import/kiotviet/preview`
  - `POST /api/v1/sales-documents/import/kiotviet`
  - `DELETE /api/v1/sales-documents/import/kiotviet`
- Import groups rows by `Ma hoa don`; repeated import updates by invoice code.
- Blank customer code or `Khach le` maps to customer code `khachle`.
- If `khachle` is missing, import auto-creates that default customer.
- Customer/product codes ending `{DEL}`, `{DEL1}`, `{DEL2}`, ... are treated as KiotViet-deleted history. Import auto-creates inactive placeholders; deleted product placeholders have `track_inventory = false`, so they keep invoice history without creating current stock deduction.
- `Nguoi ban` and `Nguoi tao` are treated as one QCVL seller/account source for now.
- Dropped from import scope by Owner decision: `Kenh ban`, wallet, card. Keep only cash and bank transfer totals.
- Invoice time uses KiotViet `Thoi gian` as QCVL `created_at`, matching the KiotViet invoice list. `Thoi gian tao` is fallback only when `Thoi gian` is missing. Example: `HD011050.01` shows `06/07/2026 11:03` from `Thoi gian`, not `07/07/2026 10:15` from `Thoi gian tao`.
- Sales-document date filters compare the stored/displayed source date part (`YYYY-MM-DD`) directly. Do not convert imported KV timestamps through local timezone for filtering; otherwise `2026-06-30T17:08Z` appears as July locally and leaks into `Thang nay` while the UI displays `30/06/2026`.
- Product codes can match the product code or a unit-conversion source code such as `B260`; quantity converts to the parent product stock unit before creating stock movements.
- Completed imported invoices produce `stock_movements.sale_deduction` in dev-memory. Cancelled invoices do not deduct stock.
- POS invoices use the same stock-out rule after checkout persistence. Cancelling a POS invoice through `PATCH /api/v1/sales-documents/{id}` with `status: cancelled` removes its stock-out effect from calculated operating stock while keeping audit history.
- KiotViet invoice import is historical stock-out evidence/source, not a replacement for live POS checkout behavior.

---

## Current Status 2026-07-10

This plan is no longer the active task checklist. The implementation was completed, deployed to NAS, and merged through commit `38b8c9d`, with the later read-performance fix merged through commit `5efc3a6`.

Use this file as the product import design record only. Do not treat the older unchecked task boxes below as active work unless Owner explicitly reopens product import implementation.

Accepted current behavior:

- KiotViet product import can be run repeatedly by `Ma hang` upsert.
- Product import writes real catalog fields, source `created_at`, default sale price, provisional stock, and draft BOM.
- Product import does not create official stock movements.
- Product import delete/reset is a separate explicit action, not an import checkbox.
- `3202` and `3200` promotion must go through migrations and `npm run deploy:nas`.

Still deferred:

- `Nha cung cap`: derive from purchase/import receipt history, because one product can have many suppliers.
- `Du kien het hang`: compute after enough sales/purchase/stock history exists; do not copy KiotViet text.
- Official operating stock: requires reliable QCVL movement sources and formula-based calculation. Do not convert provisional KV stock/history directly into stock movements.
- Cross-module dependencies for official stock: Customer must be stable before invoice/POS stock-out; Supplier must be stable before purchase/import stock-in; Product stock display comes after those movement sources, not before them.
- Draft BOM activation: requires human review before POS uses BOM.

---

## Scope Locked For Current Import Phase

Import from `DanhSachSanPham_KV09072026-215404-812.xlsx` and later KV files with the same columns.

**Columns written now:**

| KV column | QCVL field/action |
|---|---|
| `Loại hàng` | `product_kind`, with combo override when `Hàng thành phần` exists |
| `Nhóm hàng(3 Cấp)` | `product_groups.name`; keep full path text such as `Alu>>Vật tư` |
| `Mã hàng` | product unique key within organization |
| `Tên hàng` | `products.name` |
| `Giá vốn` | `products.latest_purchase_cost` |
| `ĐVT` | `products.unit_name` |
| `Mã ĐVT Cơ bản` + `Quy đổi` | `unit_conversions` payload when different from `ĐVT` and factor > 0; `Mã hàng` on this conversion row is stored as `source_code` alias for the base product |
| `Đang kinh doanh` | `status = active` when `1`, otherwise `inactive` |
| `Giá bán` | `price_list_items` of default active price list; not written to `products` |
| `Tồn kho` | `inventory_provisional_balances` with `source_type = kiotviet_import`; not written to `stock_movements` |
| `Hàng thành phần` | BOM in `product_boms`/`product_bom_items` — **SoT+runtime 2026-07-21:** `active` (migrate `0008` cho data đã import; không re-import) |
| `Thời gian tạo` | `products.created_at`; accepts KiotViet Excel serial date or `dd/MM/yyyy HH:mm`; repeated import updates old wrong import-time timestamps to the KiotViet source time |

**Columns deferred by decision:**

| KV column | Reason |
|---|---|
| `Dự kiến hết hàng` | Must be computed from real stock + purchase/sales usage history, not copied from KV text |

**Columns ignored by decision:**

`Thương hiệu`, `KH đặt`, `Tồn nhỏ nhất`, `Tồn lớn nhất`, `Hình ảnh (url1,url2...)`, `Trọng lượng`, `Được bán trực tiếp`, `Mô tả`, `Mẫu ghi chú`, `Vị trí`.

**Deletion rule:** The UI may offer `Xóa dữ liệu mẫu trước khi import`, but the server only deletes known demo products that have no real linked documents. Phase 1 demo patterns are `DEV20-SP-%`, `MICA-3MM`, `DECAL-PP`, and `CUT-CNC`. The server must refuse deletion for any matched product that appears in sales documents, purchase receipts, stock movements, BOM, price list items, or other real linked tables.

**Out of scope for this plan:** NAS deploy, Git push, supplier relationship import, expected-out-of-stock calculation, activating BOM, and using KiotViet total stock as a direct source for real roll/sheet stock movements.

---

## Open Gaps After Current Phase

1. `Dự kiến hết hàng`: chưa làm. Phải có lịch sử bán/tiêu thụ thật và tồn kho chuẩn hóa trước, sau đó mới tính tốc độ dùng hàng. Không copy chuỗi dự kiến từ KiotViet.
2. `Nhà cung cấp`: chưa làm ở import Hàng hóa. Nguồn đúng là phiếu nhập, vì một mã hàng có thể có nhiều nhà cung cấp.
3. `Tồn KV tạm nhập`: đã lưu vào `inventory_provisional_balances`, nhưng chỉ dùng để đối chiếu. Không chuyển trực tiếp thành tồn kho thật/stock movements. Bước sau cần dữ liệu vận hành thật: phiếu nhập, bán hàng, kiểm kho/cân bằng kho và quy trình cuộn/tấm.
4. BOM từ KiotViet: **SoT** Owner 2026-07-20 — import `active`, bán chỉ trừ thành phần. **Runtime chưa khớp** (`draft` + UI nháp; POS live có thể trừ mã combo). Xem `docs/03-BUSINESS-NghiepVu/Sales/README.md` và `docs/DOC-CLEANUP-CHECKLIST.md`. Quyết định draft→duyệt cũ đã superseded.
5. Import nhiều file KV mới: upsert theo `Mã hàng` đã sẵn sàng. Khi KV đổi dữ liệu, import lại file mới để cập nhật; hệ thống không tự xóa mã vắng trong file mới.

## Reality Update 2026-07-10: Product Source Created Time

KiotViet product exports can store `Thời gian tạo` as an Excel serial number, for example `46204.42164644676`, not as visible text. QCVL must normalize this value on the server before writing products.

Rules:

- `Thời gian tạo` is the source product creation time from KiotViet and is stored in `products.created_at`.
- `GET /api/v1/products?created_from=...&created_to=...` filters against this normalized `products.created_at`.
- Importing again by the same `Mã hàng` may update `products.created_at` when the file contains a valid source time. This is intentional so old rows imported with `now()` can be corrected without deleting all data first.
- If the source time is missing or invalid, keep existing `products.created_at`; for a brand-new product fallback to import time.
- Do not create a separate UI-only date field for this. The filter, service, backend repository, and import mapper all use the same `created_at` contract.

---

## Reality Update 2026-07-10: Stocktake Import Moved To Inventory Plan

Owner provided KiotViet stocktake detail export `DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx`.

Observed relationship:

- Product export `Tồn kho` is the KiotViet stock snapshot for comparison only and remains the source for `inventory_provisional_balances`; QCVL UI labels this as `Tồn KV tạm nhập`.
- Stocktake detail export is historical audit data. It explains past adjustments but does not equal current stock after later sales/purchases/stocktakes.
- Formula is stable: `SL lệch = Kiểm thực tế - Tồn kho`.
- Latest stocktake actual quantity must not overwrite product provisional stock. Example: `HDA5` product export stock is `60 Cuốn`, but latest stocktake actual is `0 Cuốn`.
- Official QCVL stock correctness depends on enough QCVL movement sources: purchase/import receipt entries, sales deductions, stocktake balance, and roll/sheet/object operations. KV stock is only a comparison value to find differences.

Decision:

- Do not add stocktake history into the Product Import plan.
- Implement KiotViet stocktake import under Inventory/Kiểm kho.
- New implementation plan: `docs/superpowers/plans/2026-07-10-kiotviet-stocktake-import.md`.
- Official QCVL stock still requires QCVL movement sources and formula-based calculation after imported history is available for comparison.

---
## File Structure

**Create**

- `src/features/catalog/kiotviet-product-import.ts`
  - Shared TypeScript parser/mapper for KV headers and rows.
  - Exports `parseKiotVietProductWorkbook`, `mapKiotVietProductRows`, `buildKiotVietProductImportSummary`.
  - Browser-safe: accepts `ArrayBuffer`, does not use Node `unzip`.

- `src/features/catalog/kiotviet-product-import.test.ts`
  - Unit tests for header normalization, row mapping, invalid rows, repeated import keys, ignored columns.

- `server/modules/catalog/product-import.ts`
  - Server-side import validation and repository orchestration.
  - Exports `previewKiotVietProductImport` and `applyKiotVietProductImport`.

- `server/modules/catalog/product-import.test.ts`
  - Tests import preview/apply behavior with fake repository.

- `src/features/catalog/ProductImportDialog.tsx`
  - Dialog UI for selecting a file, previewing summary, optional demo cleanup, and importing.

- `src/features/catalog/ProductImportDialog.test.tsx`
  - Tests modal behavior, preview summary, import confirmation, and error states.

**Modify**

- `src/features/catalog/CatalogPage.tsx`
  - Add right-side `Import` action in the highlighted toolbar area.
  - Open `ProductImportDialog`.
  - Reload product list after successful import.

- `src/features/catalog/CatalogPage.test.tsx`
  - Assert import action location/behavior and that list reloads after import success.

- `src/features/catalog/catalog-service.ts`
  - Add `previewKiotVietProductImport(file)` and `importKiotVietProducts(input)`.

- `src/features/catalog/types.ts`
  - Add import request/response types.

- `src/components/ui-shell/management-layout.tsx`
  - Add a shared toolbar trailing slot if current toolbar cannot place fixed right actions cleanly.

- `src/styles/shared.css`
  - Add minimal shared toolbar action CSS only if existing classes cannot align the import button.

- `server/modules/catalog/catalog-routes.ts`
  - Add `POST /api/v1/products/import/kiotviet/preview`.
  - Add `POST /api/v1/products/import/kiotviet`.

- `server/http.ts`
  - Wire handlers and fake in-memory behavior for tests/dev without DB repository support.

- `server/db.ts`
  - Add repository methods for upserting product groups/products and safe demo cleanup.

- `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
  - Add import UX and multi-import rules.

- `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`
  - Document import endpoints and response schema.

- `docs/04-DATABASE/Sales/POS-TABLES.md`
  - Document upsert key and demo cleanup guard.

---

### Task 1: Shared KiotViet Product Parser

**Files:**
- Create: `src/features/catalog/kiotviet-product-import.ts`
- Create: `src/features/catalog/kiotviet-product-import.test.ts`

- [ ] **Step 1: Write failing tests for row mapping**

Create `src/features/catalog/kiotviet-product-import.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapKiotVietProductRows } from './kiotviet-product-import'

describe('mapKiotVietProductRows', () => {
  it('maps KV product columns into QCVL import rows and ignores removed fields', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 2,
        'Loại hàng': 'Hàng hóa',
        'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
        'Mã hàng': 'A10T',
        'Tên hàng': 'Alu 3li 0.1 Trắng',
        'Thương hiệu': 'Acores',
        'Giá bán': 0,
        'Giá vốn': 200000,
        'Tồn kho': 4,
        'Tồn nhỏ nhất': 0,
        'Tồn lớn nhất': 999999999,
        'ĐVT': 'Tấm',
        'Mã ĐVT Cơ bản': null,
        'Quy đổi': 1,
        'Đang kinh doanh': 1,
        'Được bán trực tiếp': 1,
        'Vị trí': null,
      },
    ])

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(0)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      code: 'A10T',
      name: 'Alu 3li 0.1 Trắng',
      product_group_name: 'Alu>>Vật tư',
      product_kind: 'goods',
      inventory_shape: 'normal',
      sell_method: 'quantity',
      unit_name: 'Tấm',
      latest_purchase_cost: 200000,
      status: 'active',
      ignored: {
        brand: 'Acores',
        min_stock: 0,
        max_stock: 999999999,
        direct_sale: 1,
        location: null,
      },
    })
  })

  it('marks missing code, name, or unit as invalid', () => {
    const result = mapKiotVietProductRows([
      { rowNumber: 3, 'Mã hàng': '', 'Tên hàng': 'Thiếu mã', 'ĐVT': 'Cái' },
      { rowNumber: 4, 'Mã hàng': 'NO-NAME', 'Tên hàng': '', 'ĐVT': 'Cái' },
      { rowNumber: 5, 'Mã hàng': 'NO-UNIT', 'Tên hàng': 'Thiếu đơn vị', 'ĐVT': '' },
    ])

    expect(result.valid).toHaveLength(0)
    expect(result.invalid.map((item) => item.rowNumber)).toEqual([3, 4, 5])
    expect(result.invalid[0].errors).toContain('missing_code')
    expect(result.invalid[1].errors).toContain('missing_name')
    expect(result.invalid[2].errors).toContain('missing_unit')
  })

  it('maps combo rows from Hàng thành phần and keeps BOM for later phases', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 8,
        'Loại hàng': 'Combo - đóng gói',
        'Nhóm hàng(3 Cấp)': 'Thành phẩm',
        'Mã hàng': 'HH',
        'Tên hàng': 'Hộp hoa',
        'ĐVT': 'Cái',
        'Hàng thành phần': 'DCS:0.6|F5:0.3',
        'Đang kinh doanh': 1,
      },
    ])

    expect(result.valid[0]).toMatchObject({
      product_kind: 'combo',
      inventory_shape: 'normal',
      sell_method: 'combo',
      track_inventory: false,
      bom_text: 'DCS:0.6|F5:0.3',
    })
  })
})
```

- [ ] **Step 2: Run parser tests and confirm RED**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts
```

Expected: fail because `src/features/catalog/kiotviet-product-import.ts` does not exist.

- [ ] **Step 3: Implement mapper**

Create `src/features/catalog/kiotviet-product-import.ts` with:

```ts
import type { Product, ProductKind, ProductStatus, SellMethod } from './types'

export interface KiotVietRawProductRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietImportProductRow {
  rowNumber: number
  code: string
  name: string
  product_group_name: string
  product_kind: ProductKind
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
  unit_name: string
  latest_purchase_cost: number | null
  status: ProductStatus
  unit_conversions: Array<{
    unit_name: string
    stock_qty_per_unit: number
    is_default_purchase_unit: boolean
    is_default_sale_unit: boolean
  }>
  sale_price: number | null
  provisional_stock: number | null
  bom_text: string | null
  source_created_at: string | null
  ignored: {
    brand: unknown
    min_stock: unknown
    max_stock: unknown
    direct_sale: unknown
    location: unknown
  }
}

export interface KiotVietInvalidProductRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: Array<'missing_code' | 'missing_name' | 'missing_unit'>
}

export function mapKiotVietProductRows(rows: KiotVietRawProductRow[]) {
  const valid: KiotVietImportProductRow[] = []
  const invalid: KiotVietInvalidProductRow[] = []

  for (const row of rows) {
    const code = text(valueByHeader(row, 'Mã hàng', 'Mã sản phẩm', 'SKU'))
    const name = text(valueByHeader(row, 'Tên hàng', 'Tên sản phẩm'))
    const unitName = text(valueByHeader(row, 'ĐVT', 'Đơn vị tính', 'Mã ĐVT Cơ bản'))
    const errors: KiotVietInvalidProductRow['errors'] = []
    if (!code) errors.push('missing_code')
    if (!name) errors.push('missing_name')
    if (!unitName) errors.push('missing_unit')
    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, code, name, errors })
      continue
    }

    const bomText = text(valueByHeader(row, 'Hàng thành phần', 'Vật tư cấu thành'))
    const productKind = mapProductKind(text(valueByHeader(row, 'Loại hàng')), bomText)
    const shapeAndMethod = shapeAndMethodForKind(productKind)
    const conversionUnitName = text(valueByHeader(row, 'Mã ĐVT Cơ bản', 'Đơn vị quy đổi'))
    const conversionFactor = number(valueByHeader(row, 'Quy đổi'))

    valid.push({
      rowNumber: row.rowNumber,
      code,
      name,
      product_group_name: text(valueByPrefix(row, 'Nhóm hàng')) ?? 'Giá chung',
      product_kind: productKind,
      inventory_shape: shapeAndMethod.inventory_shape,
      sell_method: shapeAndMethod.sell_method,
      track_inventory: shapeAndMethod.track_inventory,
      unit_name: unitName,
      latest_purchase_cost: number(valueByHeader(row, 'Giá vốn')),
      status: number(valueByHeader(row, 'Đang kinh doanh')) === 0 ? 'inactive' : 'active',
      unit_conversions:
        conversionUnitName && conversionUnitName !== unitName && conversionFactor !== null && conversionFactor > 0
          ? [{ unit_name: conversionUnitName, stock_qty_per_unit: conversionFactor, is_default_purchase_unit: true, is_default_sale_unit: false }]
          : [],
      sale_price: number(valueByHeader(row, 'Giá bán')),
      provisional_stock: number(valueByHeader(row, 'Tồn kho')),
      bom_text: bomText,
      source_created_at: text(valueByHeader(row, 'Thời gian tạo')),
      ignored: {
        brand: valueByHeader(row, 'Thương hiệu'),
        min_stock: valueByHeader(row, 'Tồn nhỏ nhất'),
        max_stock: valueByHeader(row, 'Tồn lớn nhất'),
        direct_sale: valueByHeader(row, 'Được bán trực tiếp'),
        location: valueByHeader(row, 'Vị trí'),
      },
    })
  }

  return { valid, invalid }
}

function mapProductKind(value: string | null, bomText: string | null): ProductKind {
  const normalized = normalizeHeader(value)
  if (bomText) return 'combo'
  if (normalized.includes('dich vu')) return 'service'
  if (normalized.includes('combo')) return 'combo'
  if (normalized.includes('vat tu phu')) return 'auxiliary_material'
  if (normalized.includes('cuon')) return 'roll'
  if (normalized.includes('tam')) return 'sheet'
  return 'goods'
}

function shapeAndMethodForKind(productKind: ProductKind): {
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
} {
  if (productKind === 'service') return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: false }
  if (productKind === 'roll') return { inventory_shape: 'roll', sell_method: 'linear_m', track_inventory: true }
  if (productKind === 'sheet') return { inventory_shape: 'sheet', sell_method: 'sheet', track_inventory: true }
  if (productKind === 'combo') return { inventory_shape: 'normal', sell_method: 'combo', track_inventory: false }
  return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true }
}

function valueByHeader(row: KiotVietRawProductRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  return undefined
}

function valueByPrefix(row: KiotVietRawProductRow, prefix: string) {
  const key = Object.keys(row).find((candidate) => candidate === prefix || candidate.startsWith(`${prefix}(`))
  return key ? row[key] : undefined
}

export function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

function text(value: unknown) {
  const result = String(value ?? '').trim()
  return result.length > 0 ? result : null
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(result) ? result : null
}
```

- [ ] **Step 4: Run parser tests and confirm GREEN**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit parser**

```powershell
git add src/features/catalog/kiotviet-product-import.ts src/features/catalog/kiotviet-product-import.test.ts
git commit -m "feat: map kiotviet product import rows"
```

---

### Task 2: Server Preview And Import Contracts

**Files:**
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `server/modules/catalog/catalog-routes.ts`
- Create: `server/modules/catalog/product-import.ts`
- Create: `server/modules/catalog/product-import.test.ts`
- Modify: `server/http.ts`

- [ ] **Step 1: Add failing server tests for preview and import**

Create `server/modules/catalog/product-import.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { applyKiotVietProductImport, previewKiotVietProductImport } from './product-import'

const rows = [
  {
    rowNumber: 2,
    code: 'A10T',
    name: 'Alu 3li 0.1 Trắng',
    product_group_name: 'Alu>>Vật tư',
    product_kind: 'goods' as const,
    inventory_shape: 'normal' as const,
    sell_method: 'quantity' as const,
    track_inventory: true,
    unit_name: 'Tấm',
    latest_purchase_cost: 200000,
    status: 'active' as const,
    unit_conversions: [],
    sale_price: 0,
    provisional_stock: 4,
    bom_text: null,
    source_created_at: null,
    ignored: { brand: null, min_stock: 0, max_stock: 999999999, direct_sale: 1, location: null },
  },
]

describe('product import server flow', () => {
  it('previews create/update counts without writing', async () => {
    const repository = {
      findProductsByCodes: vi.fn(async () => new Set(['A10T'])),
    }

    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(repository.findProductsByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['A10T'] })
    expect(result.summary).toMatchObject({ total_rows: 1, valid_rows: 1, invalid_rows: 0, create_rows: 0, update_rows: 1 })
  })

  it('applies import by upserting groups and products by code', async () => {
    const repository = {
      deleteDemoProductsForImport: vi.fn(),
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: true,
    })

    expect(repository.deleteDemoProductsForImport).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(repository.upsertProductGroupsByName).toHaveBeenCalledWith({ organizationId: 'org-1', names: ['Alu>>Vật tư'] })
    expect(repository.upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({
          code: 'A10T',
          product_group_id: 'group-1',
          latest_purchase_cost: 200000,
        }),
      ],
    })
    expect(result.summary).toMatchObject({ created_rows: 1, updated_rows: 0 })
  })
})
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
npm test -- server/modules/catalog/product-import.test.ts
```

Expected: fail because `product-import.ts` does not exist.

- [ ] **Step 3: Implement server import orchestration**

Create `server/modules/catalog/product-import.ts`:

```ts
import type { ProductStatus } from '../../../src/features/catalog/types'
import type { KiotVietImportProductRow, KiotVietInvalidProductRow } from '../../../src/features/catalog/kiotviet-product-import'

export interface ProductImportRepository {
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
}

export interface ProductImportUpsertRow {
  code: string
  name: string
  status: ProductStatus
  product_kind: KiotVietImportProductRow['product_kind']
  inventory_shape: KiotVietImportProductRow['inventory_shape']
  sell_method: KiotVietImportProductRow['sell_method']
  track_inventory: boolean
  unit_name: string
  product_group_id: string
  latest_purchase_cost: number | null
  unit_conversions: KiotVietImportProductRow['unit_conversions']
}

export async function previewKiotVietProductImport(input: {
  organizationId: string
  repository: ProductImportRepository
  rows: KiotVietImportProductRow[]
  invalidRows: KiotVietInvalidProductRow[]
  cleanupDemo: boolean
}) {
  const codes = input.rows.map((row) => row.code)
  const existingCodes = await input.repository.findProductsByCodes?.({ organizationId: input.organizationId, codes }) ?? new Set<string>()
  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      create_rows: input.rows.filter((row) => !existingCodes.has(row.code)).length,
      update_rows: input.rows.filter((row) => existingCodes.has(row.code)).length,
      cleanup_demo_requested: input.cleanupDemo,
      ignored_columns: ['Thương hiệu', 'KH đặt', 'Tồn nhỏ nhất', 'Tồn lớn nhất', 'Hình ảnh', 'Trọng lượng', 'Được bán trực tiếp', 'Mô tả', 'Mẫu ghi chú', 'Vị trí'],
      deferred_columns: ['Dự kiến hết hàng'],
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietProductImport(input: {
  organizationId: string
  repository: ProductImportRepository
  rows: KiotVietImportProductRow[]
  invalidRows: KiotVietInvalidProductRow[]
  cleanupDemo: boolean
}) {
  if (input.invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
        invalid_rows: input.invalidRows.length,
        created_rows: 0,
        updated_rows: 0,
        skipped_rows: input.rows.length,
        cleanup_deleted_rows: 0,
        cleanup_blocked_rows: 0,
      },
      invalid_rows: input.invalidRows,
    }
  }

  const cleanup = input.cleanupDemo
    ? await input.repository.deleteDemoProductsForImport?.({ organizationId: input.organizationId }) ?? { deleted: 0, blocked: 0 }
    : { deleted: 0, blocked: 0 }
  const groupNames = [...new Set(input.rows.map((row) => row.product_group_name))]
  const groups = await input.repository.upsertProductGroupsByName?.({ organizationId: input.organizationId, names: groupNames }) ?? new Map<string, string>()
  const rows = input.rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    product_kind: row.product_kind,
    inventory_shape: row.inventory_shape,
    sell_method: row.sell_method,
    track_inventory: row.track_inventory,
    unit_name: row.unit_name,
    latest_purchase_cost: row.latest_purchase_cost,
    product_group_id: groups.get(row.product_group_name) ?? groups.get('Giá chung') ?? '',
    unit_conversions: row.unit_conversions,
  }))
  const upsert = await input.repository.upsertProductsByCode?.({ organizationId: input.organizationId, rows }) ?? {
    created: 0,
    updated: 0,
    skipped: rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.created,
      updated_rows: upsert.updated,
      skipped_rows: upsert.skipped,
      cleanup_deleted_rows: cleanup.deleted,
      cleanup_blocked_rows: cleanup.blocked,
    },
    invalid_rows: [],
  }
}
```

- [ ] **Step 4: Wire routes**

Modify `server/modules/catalog/catalog-routes.ts`:

```ts
export interface CatalogRouteHandlers {
  productGroups(): RouteResult
  listProducts(): RouteResult
  previewKiotVietProductImport(): RouteResult
  importKiotVietProducts(): RouteResult
  getProductBom(): RouteResult
  createProduct(): RouteResult
  updateProduct(): RouteResult
  upsertProductBom(): RouteResult
  customerGroups(): RouteResult
  listCustomers(): RouteResult
  createCustomer(): RouteResult
  customerRecentPrices(): RouteResult
  resolvePricing(): RouteResult
  priceLists(): RouteResult
  previewPriceFormula(): RouteResult
  applyPriceFormula(): RouteResult
}
```

Add before product detail routes:

```ts
if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet/preview') return handlers.previewKiotVietProductImport()
if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet') return handlers.importKiotVietProducts()
```

- [ ] **Step 5: Run server tests**

Run:

```powershell
npm test -- server/modules/catalog/product-import.test.ts server/http.test.ts
```

Expected: pass after handlers are wired in `server/http.ts`.

- [ ] **Step 6: Commit server import contract**

```powershell
git add server/modules/catalog/catalog-routes.ts server/modules/catalog/product-import.ts server/modules/catalog/product-import.test.ts server/http.ts src/features/catalog/types.ts src/features/catalog/catalog-service.ts
git commit -m "feat: add kiotviet product import API contract"
```

---

### Task 3: PostgreSQL Upsert And Safe Demo Cleanup

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [ ] **Step 1: Add failing HTTP tests**

Add to `server/http.test.ts`:

```ts
test('previews KiotViet product import without writing products', async () => {
  const repository = makeRepository()
  const handler = createHttpHandler({ repository })
  const response = await handler(
    new Request('http://api.local/api/v1/products/import/kiotviet/preview', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        cleanup_demo: false,
        rows: [
          {
            rowNumber: 2,
            'Loại hàng': 'Hàng hóa',
            'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
            'Mã hàng': 'A10T',
            'Tên hàng': 'Alu 3li 0.1 Trắng',
            'Giá vốn': 200000,
            'ĐVT': 'Tấm',
            'Đang kinh doanh': 1,
          },
        ],
      }),
    }),
  )
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.data.summary).toMatchObject({ valid_rows: 1, invalid_rows: 0 })
})

test('imports KiotViet products by upserting product codes', async () => {
  const upsertProductsByCode = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
  const repository = makeRepository({
    upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'pg-alu']])),
    upsertProductsByCode,
  })
  const handler = createHttpHandler({ repository })
  const response = await handler(
    new Request('http://api.local/api/v1/products/import/kiotviet', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        cleanup_demo: true,
        rows: [
          {
            rowNumber: 2,
            'Loại hàng': 'Hàng hóa',
            'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
            'Mã hàng': 'A10T',
            'Tên hàng': 'Alu 3li 0.1 Trắng',
            'Giá vốn': 200000,
            'ĐVT': 'Tấm',
            'Đang kinh doanh': 1,
          },
        ],
      }),
    }),
  )
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.data.summary).toMatchObject({ created_rows: 1, updated_rows: 0 })
  expect(upsertProductsByCode).toHaveBeenCalledWith({
    organizationId: 'org-1',
    rows: [expect.objectContaining({ code: 'A10T', product_group_id: 'pg-alu' })],
  })
})
```

- [ ] **Step 2: Run HTTP tests and confirm RED**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: fail because handlers/repository methods are not wired yet.

- [ ] **Step 3: Implement fake handler and repository interface**

Modify `ServerRepository` in `server/http.ts`:

```ts
findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
```

Wire catalog handlers in `server/http.ts` by reading JSON:

```ts
previewKiotVietProductImport: async () => {
  const body = await readJson(request)
  const mapped = mapKiotVietProductRows(body.rows ?? [])
  return {
    found: true,
    data: await previewKiotVietProductImport({
      organizationId: currentUser.organization.id,
      repository,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      cleanupDemo: Boolean(body.cleanup_demo),
    }),
  }
},
importKiotVietProducts: async () => {
  const body = await readJson(request)
  const mapped = mapKiotVietProductRows(body.rows ?? [])
  return {
    found: true,
    data: await applyKiotVietProductImport({
      organizationId: currentUser.organization.id,
      repository,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      cleanupDemo: Boolean(body.cleanup_demo),
    }),
  }
},
```

- [ ] **Step 4: Implement PostgreSQL methods**

In `server/db.ts`, add methods:

```ts
async findProductsByCodes(input) {
  const result = await pool.query(
    `
      select code
      from products
      where organization_id = $1
        and code = any($2::text[])
    `,
    [input.organizationId, input.codes],
  )
  return new Set(result.rows.map((row) => row.code))
},
```

Add `upsertProductGroupsByName`, `upsertProductsByCode`, and `deleteDemoProductsForImport` with a transaction. `upsertProductsByCode` must use:

```sql
insert into products (
  id, organization_id, code, name, status, product_group_id, unit_name,
  sell_method, product_kind, inventory_shape, track_inventory,
  latest_purchase_cost, latest_purchase_cost_at, updated_at
)
values (...)
on conflict (organization_id, code)
do update set
  name = excluded.name,
  status = excluded.status,
  product_group_id = excluded.product_group_id,
  unit_name = excluded.unit_name,
  sell_method = excluded.sell_method,
  product_kind = excluded.product_kind,
  inventory_shape = excluded.inventory_shape,
  track_inventory = excluded.track_inventory,
  latest_purchase_cost = excluded.latest_purchase_cost,
  latest_purchase_cost_at = case
    when excluded.latest_purchase_cost is distinct from products.latest_purchase_cost then now()
    else products.latest_purchase_cost_at
  end,
  updated_at = now()
```

`deleteDemoProductsForImport` must delete only product rows matching known demo codes and not referenced by `order_items`, `price_list_items`, `stock_movements`, product BOM tables, or purchase receipt items. If a reference table does not exist in the current DB, catch the missing-table error only for that guard query and continue with other guards.

- [ ] **Step 5: Run tests and typecheck**

Run:

```powershell
npm test -- server/http.test.ts server/modules/catalog/product-import.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit repository upsert**

```powershell
git add server/http.ts server/db.ts server/http.test.ts
git commit -m "feat: upsert products from kiotviet import"
```

---

### Task 4: Product Import Dialog UI

**Files:**
- Create: `src/features/catalog/ProductImportDialog.tsx`
- Create: `src/features/catalog/ProductImportDialog.test.tsx`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `src/components/ui-shell/management-layout.tsx`
- Modify: `src/styles/shared.css`

- [ ] **Step 1: Add failing dialog tests**

Create `src/features/catalog/ProductImportDialog.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductImportDialog } from './ProductImportDialog'

it('previews a KiotViet product file before importing', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 657,
        valid_rows: 657,
        invalid_rows: 0,
        create_rows: 640,
        update_rows: 17,
        cleanup_demo_requested: false,
        ignored_columns: ['Thương hiệu', 'Vị trí'],
        deferred_columns: ['Dự kiến hết hàng'],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(),
  }

  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={vi.fn()} />)
  const file = new File(['fake-xlsx'], 'DanhSachSanPham_KV09072026-215404-812.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(service.previewKiotVietProductImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(await screen.findByText('657 dòng hợp lệ')).toBeInTheDocument()
  expect(screen.getByText('640 tạo mới')).toBeInTheDocument()
  expect(screen.getByText('17 cập nhật')).toBeInTheDocument()
  expect(screen.getByText('Bỏ qua: Thương hiệu, Vị trí')).toBeInTheDocument()
})

it('requires preview before import and supports demo cleanup option', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: { total_rows: 1, valid_rows: 1, invalid_rows: 0, create_rows: 1, update_rows: 0, cleanup_demo_requested: true, ignored_columns: [], deferred_columns: [] },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, cleanup_deleted_rows: 3, cleanup_blocked_rows: 0 },
      invalid_rows: [],
    })),
  }
  const onImported = vi.fn()
  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)
  const file = new File(['fake-xlsx'], 'products.xlsx')

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByLabelText('Xóa dữ liệu mẫu trước khi import lần đầu'))
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Import' }))

  expect(service.importKiotVietProducts).toHaveBeenCalledWith({ file, cleanup_demo: true })
  expect(onImported).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run dialog tests and confirm RED**

Run:

```powershell
npm test -- src/features/catalog/ProductImportDialog.test.tsx
```

Expected: fail because component does not exist.

- [ ] **Step 3: Add service methods**

Modify `src/features/catalog/catalog-service.ts`:

```ts
previewKiotVietProductImport: (input: { file: File; cleanup_demo: boolean }) =>
  api.request<KiotVietProductImportPreview>('/api/v1/products/import/kiotviet/preview', {
    method: 'POST',
    body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows: [] }),
  }),
importKiotVietProducts: (input: { file: File; cleanup_demo: boolean }) =>
  api.request<KiotVietProductImportResult>('/api/v1/products/import/kiotviet', {
    method: 'POST',
    body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows: [] }),
  }),
```

Replace `rows: []` after Step 4 adds browser workbook parsing. Keep the method shape now so tests can mock it.

- [ ] **Step 4: Implement dialog**

Create `ProductImportDialog.tsx` with file input, preview button, checkbox, summary, import button, and errors. Use existing `.dialog-*`, `.button`, `.management-detail-summary-box`, and `.management-filter-choice` classes where possible.

The dialog must not auto-import on file select. It must require:

1. Select `.xlsx`.
2. Click `Xem trước`.
3. Review summary.
4. Click `Import`.

- [ ] **Step 5: Wire CatalogPage action**

In `CatalogPage.tsx`:

```tsx
const [productImportOpen, setProductImportOpen] = useState(false)
```

Add action in toolbar right area:

```tsx
<button className="button button-secondary" type="button" onClick={() => setProductImportOpen(true)}>
  Import
</button>
```

Render:

```tsx
<ProductImportDialog
  open={productImportOpen}
  service={service}
  onClose={() => setProductImportOpen(false)}
  onImported={() => {
    setProductImportOpen(false)
    void load({ page: 1 })
  }}
/>
```

- [ ] **Step 6: Run UI tests**

Run:

```powershell
npm test -- src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit UI dialog**

```powershell
git add src/features/catalog/ProductImportDialog.tsx src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.tsx src/features/catalog/CatalogPage.test.tsx src/features/catalog/catalog-service.ts src/features/catalog/types.ts src/components/ui-shell/management-layout.tsx src/styles/shared.css
git commit -m "feat: add product import dialog"
```

---

### Task 5: Browser-Safe Workbook Parsing

**Files:**
- Modify: `src/features/catalog/kiotviet-product-import.ts`
- Modify: `src/features/catalog/kiotviet-product-import.test.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/ProductImportDialog.tsx`

- [ ] **Step 1: Add failing test for workbook parsing**

Add to `kiotviet-product-import.test.ts`:

```ts
it('parses an xlsx ArrayBuffer into raw rows with row numbers', async () => {
  const workbook = await buildMinimalWorkbook([
    ['Mã hàng', 'Tên hàng', 'ĐVT'],
    ['A10T', 'Alu 3li 0.1 Trắng', 'Tấm'],
  ])

  const rows = await parseKiotVietProductWorkbook(workbook)

  expect(rows).toEqual([
    { rowNumber: 2, 'Mã hàng': 'A10T', 'Tên hàng': 'Alu 3li 0.1 Trắng', 'ĐVT': 'Tấm' },
  ])
})
```

Use a tiny zipped XLSX fixture builder in the test through `CompressionStream` if available in jsdom; if not available, store a minimal base64 xlsx fixture string inside the test file and decode it to `ArrayBuffer`.

- [ ] **Step 2: Implement browser parser**

Implement `parseKiotVietProductWorkbook(fileBuffer: ArrayBuffer)` using browser `DecompressionStream` when available or use a small internal ZIP reader for stored/deflated entries. If this becomes too large, use the existing CLI parser only as a reference and add a very small dependency only after explicit review. Preferred path: write a tiny ZIP XML reader focused on KV `.xlsx`.

- [ ] **Step 3: Replace service row payload**

In `catalog-service.ts`, parse file before sending:

```ts
const rows = await parseKiotVietProductWorkbook(await input.file.arrayBuffer())
return api.request<KiotVietProductImportPreview>('/api/v1/products/import/kiotviet/preview', {
  method: 'POST',
  body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows }),
})
```

Do the same for import.

- [ ] **Step 4: Run parser/service tests**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/ProductImportDialog.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit workbook parser**

```powershell
git add src/features/catalog/kiotviet-product-import.ts src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/catalog-service.ts src/features/catalog/ProductImportDialog.tsx
git commit -m "feat: parse kiotviet workbook in browser"
```

---

### Task 6: Documentation And QA

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
- Modify: `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`
- Modify: `docs/04-DATABASE/Sales/POS-TABLES.md`

- [ ] **Step 1: Update docs**

Add a section to product UX docs:

```md
## Import KiotViet nhiều lần

Import Hàng hóa dùng file Excel export từ KiotViet. Luồng chuẩn:

1. Chọn file `.xlsx`.
2. Xem trước.
3. Nếu là lần import thật đầu tiên, có thể chọn `Xóa dữ liệu mẫu trước khi import`.
4. Bấm `Import`.

Import dùng `Mã hàng` làm khóa upsert trong cùng organization. Lần import sau cập nhật lại tên, nhóm, loại, đơn vị, trạng thái và giá vốn. Không tự xóa hàng không còn trong file.

Phase hiện tại đã ghi `Giá bán`, `Tồn kho` tạm và `Hàng thành phần` (parse BOM vào DB). **SoT** BOM `active` (Owner 2026-07-20); **runtime còn `draft`**. Chỉ còn `Dự kiến hết hàng` làm sau bằng luồng có truy vết riêng.
```

- [ ] **Step 2: Full verification**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx server/modules/catalog/product-import.test.ts server/http.test.ts
npm run typecheck
npm run lint
npm run build:nas
```

Expected: all pass.

- [ ] **Step 3: Browser QA on dev**

Open:

```text
http://127.0.0.1:3202/products
```

Verify:

- Import button is on the right side of the toolbar area marked by the user.
- Clicking Import opens dialog.
- Selecting `DanhSachSanPham_KV09072026-215404-812.xlsx` enables `Xem trước`.
- Preview shows total rows, valid/invalid rows, create/update counts, ignored columns, deferred columns.
- Import button is disabled when invalid rows exist.
- After import success, product list reloads.
- Console has no relevant app error.

- [ ] **Step 4: Commit docs and QA fixes**

```powershell
git add docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md docs/04-DATABASE/Sales/POS-TABLES.md
git commit -m "docs: document kiotviet product import"
```

---

## Self-Review

**Spec coverage:** This plan covers fixed toolbar position, repeat import by upsert, selected KV columns, ignored columns, demo cleanup guard, preview before write, docs, tests, and browser QA. It explicitly excludes NAS deploy, price import, stock import, BOM import, supplier import, and expected-out-of-stock until later phases.

**Placeholder scan:** No step relies on "TBD" or "handle later" for Phase 1. Deferred phases are listed as out of scope with explicit non-writing behavior.

**Type consistency:** The import row fields match the existing `ProductKind`, `SellMethod`, `ProductStatus`, and `inventory_shape` type names. Server orchestration uses the same import row names as the frontend mapper.

---

## Execution Choice

Plan complete. Recommended execution is subagent-driven because parser, server upsert, and UI dialog can be reviewed task by task. Inline execution is also possible if the user wants fewer context switches.

