# Schema kho QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [migration 0003](../../../database/migrations/0003_catalog_inventory_import.sql), module [inventory](../../../server/modules/inventory/).

## Phạm vi runtime

Schema hiện hành lưu cấu hình tồn theo hàng, quy đổi đơn vị, tồn tạm KiotViet, kiểm kho import/manual, BOM và movement. Không dùng tài liệu này để khẳng định workflow cuộn/tấm, production machine hoặc multi-warehouse nếu chưa có schema/repository runtime tương ứng.

## Danh mục và cấu hình

| Bảng | Vai trò runtime |
|---|---|
| `inventory_units` | Đơn vị tồn: `code`, `name`, `unit_kind`, độ chính xác, active. Unique `(organization_id, code)`. |
| `product_inventory_settings` | Cấu hình tồn 1-1 hàng: track, shape, đơn vị tồn, allow negative, tham số roll/sheet. Unique `(organization_id, product_id)`. |
| `product_unit_conversions` | Quy đổi sale-unit sang stock-unit theo hàng, `stock_qty_per_sale_unit`, cờ default và active. |
| `inventory_provisional_balances` | Tồn tạm import KiotViet, một dòng `(organization_id, product_id, source_type)`; source type hiện chỉ `kiotviet_import`. |

`products` là catalog owner của `product_kind`, `inventory_shape`, `track_inventory`, giá mua gần nhất và nhóm hàng. Mọi FK/tìm kiếm phải scope `organization_id`.

`inventory_shape = roll|sheet` và tham số trong settings là metadata/catalog compatibility V1, không phải object tồn vật lý. V2 giữ hướng object cuộn/tấm nhưng phải bổ sung bảng object/source chain riêng; không suy diễn object từ các cột settings hoặc quantity tổng.

## Kiểm kho

### `stocktakes`

Đầu phiếu kiểm kho: `code`, `status`, `source_type`, source KiotViet, ghi chú, thời điểm cân bằng, người tạo và audit time.

- `source_type`: `manual`, `product_edit`, hoặc `kiotviet_import`.
- KiotViet uniqueness: `(organization_id, source_system, source_code)` khi source có giá trị.
- Source timestamp là UTC instant; filter/hiển thị theo `Asia/Ho_Chi_Minh`.

### `stocktake_items`

Dòng kiểm kho: stocktake, hàng/đơn vị, quantity hệ thống/thực tế/chênh lệch, snapshot source product/unit, giá trị thực tế/chênh và row source.

- Unique `(stocktake_id, line_no)`.
- Import KiotViet upsert theo `(stocktake_id, source_row_number)`.
- Product hoặc stock unit có thể null khi giữ evidence nguồn chưa map được; không tự gán hàng để làm sạch dữ liệu.

## Movement và BOM

- `stock_movements` là ledger query runtime cho biến động hàng: `movement_type`, `quantity_delta`, document code/type, giá, ending quantity, partner và `created_at`.
- Total-stock adjustment V1 tạo `stocktakes` status `balanced`, một `stocktake_items`, `stocktake_balance` movement và recompute balance trong một PostgreSQL transaction. Repository chỉ cần `track_inventory = true`; không chặn catalog metadata `roll`/`sheet`.
- `inventory_material_openings` V1 chỉ nhận `inventory_shape = normal`; records `manual_normal` và movement `material_opening` khi quantity delta khác `0`. Không dùng bảng này làm lifecycle cuộn/tấm.
- Repository chỉ merge purchase derived movement khi query theo một product; không coi derived row là chứng từ mutation độc lập.
- `product_boms`, `product_bom_items` lưu version BOM, component, quantity, calculation payload và sort order. BOM dùng route/catalog validation; không sửa trực tiếp production.

## Import KiotViet

- Stocktake import phải parse date qua shared `parseBusinessTimeToUtc`.
- Import group theo source code, upsert transaction; missing product được giữ/count để audit.
- Delete import chỉ áp dụng `source_type = kiotviet_import` hoặc `source_system = kiotviet`, scope organization. Không xóa stocktake manual/product edit.

## Roadmap V2 cuộn/tấm

V2 giữ lifecycle object cuộn/tấm: persisted object, nhập/khui/cắt/tấm lẻ/hủy, object movement, object stocktake và POS deduction. V2 cần migration/schema source chain, repository transaction/invariant, audit, permission, API/UI và test E2E; không bật từng phần lẻ hoặc tự tạo object từ import aggregate.

## Quy tắc an toàn

- Không tạo stock movement hoặc cân bằng tồn từ dữ liệu máy sản xuất khi chưa có source contract.
- Không mutation tồn/quy đổi/BOM/stocktake chỉ vì mismatch tổng; phải có source/evidence cụ thể.
- Timestamp lưu UTC; business date dùng `Asia/Ho_Chi_Minh`, UI `DD-MM-YYYY`.

## Tham chiếu

- [Inventory API](../../05-BACKEND-MayChu/Inventory/INVENTORY-API.md)
- [Stocktake import repository](../../../server/modules/inventory/stocktake-import-repository.ts)
- [Stock movement repository](../../../server/modules/inventory/stock-movement-repository.ts)
- [Migration 0003](../../../database/migrations/0003_catalog_inventory_import.sql)
