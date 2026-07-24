# Tồn kho và movement QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [INVENTORY-TABLES.md](../../04-DATABASE/Inventory/INVENTORY-TABLES.md), [stock-movement-repository.ts](../../../server/modules/inventory/stock-movement-repository.ts), [stocktake-import-repository.ts](../../../server/modules/inventory/stocktake-import-repository.ts).

## Nguồn tồn hiện hành

Tồn runtime theo product/unit/conversion và stock movement; không có inventory shape `roll`/`sheet`, object cuộn/tấm/rẻo, machine-consumption hoặc multi-warehouse contract trong schema/repository hiện hành.

Các nguồn dữ liệu:

- Catalog product, inventory setting và `product_unit_conversions`.
- Provisional balance import ban đầu, có source/evidence riêng.
- `stock_movements` persisted từ transaction sales/purchase.
- Stocktake và stocktake items import theo source row.
- BOM product nếu module gọi contract này.

Không bịa physical inventory từ tổng quantity import.

## Movement

`GET` stock movement đọc record persisted theo `organization_id`, optional `product_id`, newest first. Mỗi row có product, type, quantity delta, document, transaction/cost price, ending quantity và partner khi có.

Khi query một product, repository có thể merge purchase movement **derived để trình bày** nếu persist thiếu document code. Derived row không là chứng từ độc lập; không mutate/xóa/reverse dựa vào row đó.

Sales checkout/revision và purchase post/cancel là owner transaction của movement. V1 total-stock adjustment cũng là transaction owner: tạo stocktake balanced, stocktake item, `stocktake_balance` movement rồi recompute balance. Adjustment áp dụng product `track_inventory = true`, gồm metadata catalog `roll`/`sheet`; không phải điều chỉnh object vật lý.

Material opening V1 chỉ nhận `inventory_shape = normal`; ghi `manual_normal` và `material_opening` movement. Không dùng nó để khui cuộn/tấm.

## Đơn vị và conversion

- Product có unit chính và conversion active theo catalog.
- Flow bán/nhập phải dùng product ID/unit conversion runtime; không tự đổi unit label thành stock quantity.
- Không có source runtime cho quy tắc cắt theo kích thước, m², cuộn/tấm, tấm lẻ hoặc chọn vật tư tối ưu trong V1.

## Roadmap V2 cuộn/tấm

Hướng physical lifecycle vẫn giữ cho V2: persisted object, nhập/khui/cắt/tấm lẻ/hủy, movement và kiểm kho theo object, POS deduction theo object. V2 chỉ bắt đầu khi đủ schema, transaction owner, audit, permission, API/UI và test; import tổng không được dùng để tự tạo object.

## Provisional balance và kiểm kho

Import KiotViet có thể lưu provisional/import evidence. Đây không chứng minh physical unit/lô và không tự chuyển thành roll/sheet objects.

Stocktake import:

- Nhóm theo source code, upsert scoped organization/source system.
- Upsert item theo source row number.
- Giữ row product chưa map làm evidence, không tự tạo mapping.
- Chỉ delete stocktake imported thuộc đúng source type/source system.

Mọi repair/import phải giữ source code, source row và audit trước/sau; không bulk delete theo mã chung.

## Tồn âm và policy bán

Runtime source hiện hành không xác minh policy “cho bán tồn âm”, UI warning hay block checkout. Không đặt business rule này ở đây. Nếu mở policy, cần validation owner, POS behavior, permission và test.

## Quy tắc an toàn

- Scope mọi query/mutation `organization_id`.
- Timestamp lưu UTC; UI ngày `DD-MM-YYYY` theo `Asia/Ho_Chi_Minh`.
- Sau repair purchase/sales/stocktake: audit document status, movement persisted, derived display và product balance.
- Production queue không phải source stock movement; xem [Hàng đợi sản xuất](./PRODUCTION-RECONCILIATION.md).

## Tham chiếu

- [Schema inventory](../../04-DATABASE/Inventory/INVENTORY-TABLES.md)
- [Movement repository](../../../server/modules/inventory/stock-movement-repository.ts)
- [Stocktake importer](../../../server/modules/inventory/stocktake-import-repository.ts)
