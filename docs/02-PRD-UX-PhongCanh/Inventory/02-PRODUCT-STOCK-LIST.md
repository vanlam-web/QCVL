# Danh sách hàng hóa và tồn kho QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [CatalogPage.tsx](../../../src/features/catalog/CatalogPage.tsx), [product-query-repository.ts](../../../server/modules/catalog/product-query-repository.ts), [inventory-routes.ts](../../../server/modules/inventory/inventory-routes.ts), [inventory-core-handlers.ts](../../../server/modules/inventory/inventory-core-handlers.ts).

## Mục đích

Màn Hàng hóa quản lý catalog, đơn vị quy đổi, BOM metadata, giá bán default, tồn movement và evidence import. Không dùng provisional KiotViet làm tồn chính thức hay tự tạo physical object.

## Dữ liệu list runtime

Repository product trả theo `organization_id`:

- code, name, status, product kind, unit, sell method, group.
- `latest_purchase_cost`, default-sale-price từ price list default active.
- unit conversions active.
- `kiotviet_provisional_stock`, `operating_stock`, latest KiotViet stocktake evidence.
- BOM active hoặc draft mới nhất.

`operating_stock` lấy latest `ending_qty`, fallback sum movement. `kiotviet_provisional_stock` là import evidence riêng. UI phải ghi nhãn rõ, không rename dữ liệu KV thành tồn vận hành.

## Filter/search/sort

Catalog UI có management search, filter group/kind/status/inventory-shape/date và sort. Backend là owner filter/query/ranking; UI không tự suy luận stock, giá hay BOM.

POS quick-pick và management search có contract riêng tại [Search/ranking](../../03-BUSINESS-NghiepVu/SEARCH-RANKING-PERFORMANCE.md). Sản phẩm inactive chỉ xuất hiện nếu route/filter runtime cho phép; không dựa vào câu chữ PRD cũ.

## Product kind, unit và BOM

UI hỗ trợ `goods`, `service`, `auxiliary_material`, `roll`, `sheet`, `combo`; default sell method/inventory shape nằm ở `CatalogPage`.

- Unit conversion đọc `product_unit_conversions` active.
- Giá bán là price-list item, không coi `products` là source đơn giá.
- Product query chỉ trả BOM summary (`draft_bom`); mutation BOM phải qua catalog API/repository owner.
- Không claim combo auto-deduct, BOM import trusted, tự hiệu chỉnh định mức hoặc PriceBook side effect nếu chưa có transaction/test source riêng.

## Tồn kho và stock card

Tab inventory/stock-card có UI và route:

- `POST /api/v1/inventory/products/{id}/adjust-stock` nhận `actual_qty` không âm và `reason`; repository tạo stocktake, item, `stocktake_balance` movement và recompute balance trong transaction.
- `GET /api/v1/inventory/stock-movements` đọc persisted movement khi repository có.
- Material opening V1 chỉ nhận `inventory_shape: normal`; repository transaction tạo `material_opening` movement khi có quantity delta. UI chỉ chọn hàng normal.
- Không có route/UI object-level `/rolls` hoặc `/sheets` trong V1. `roll`/`sheet` vẫn là metadata catalog và dùng tồn tổng/movement chung.

Chỉ transaction sales/purchase và repository inventory đã xác minh là owner movement. Xem [Stock rules](../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md).

## Import và kiểm kho

Product/stocktake import có preview/import/delete route. Import source, provisional balance, unmapped rows và stocktake evidence phải giữ source metadata; không bulk delete/repair theo code chung.

Latest imported KiotViet stocktake trong product query chỉ để đối soát. Không dùng `actual_qty` để ghi đè operating stock/provisional balance.

## V2 cuộn/tấm

Hướng V2 được giữ: persisted object cuộn/tấm, nhập/khui/cắt/tấm lẻ/hủy, movement và kiểm kho theo object, POS deduction theo object. Chỉ mở sau khi có schema, transaction owner, audit, permission, API/UI và test E2E; không suy diễn object từ aggregate import.

Xem [layout inventory](./01-INVENTORY-LAYOUT.md#v2--lifecycle-cuộntấm).

## Quy tắc an toàn

- Mọi request scope `organization_id`.
- Không sửa trực tiếp `products`, provisional balance, stock movement, stocktake hoặc BOM trong production.
- Không suy diễn physical roll/sheet từ imported aggregate.
- Ngày UI `DD-MM-YYYY`; server parse/filter theo business timezone Việt Nam.
- Sau import/adjust/post/cancel: audit source evidence, movement persisted, operating stock và display-derived row.

## Tham chiếu

- [Inventory schema](../../04-DATABASE/Inventory/INVENTORY-TABLES.md)
- [Stock rules](../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md)
- [Product query repository](../../../server/modules/catalog/product-query-repository.ts)
