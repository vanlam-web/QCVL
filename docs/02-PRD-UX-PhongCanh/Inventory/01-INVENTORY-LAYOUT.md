# Bố cục Hàng hóa và kiểm kho QCVL

Cập nhật: `2026-07-24`

Nguồn runtime: [CatalogPage.tsx](../../../src/features/catalog/CatalogPage.tsx), [InventoryPage.tsx](../../../src/features/inventory/InventoryPage.tsx), [product-query-repository.ts](../../../server/modules/catalog/product-query-repository.ts), [inventory-adjustment-repository.ts](../../../server/modules/inventory/inventory-adjustment-repository.ts).

## Mục đích

Module quản lý danh mục, nhóm hàng, đơn vị quy đổi, BOM, tồn tổng, thẻ kho và phiếu kiểm kho. Bố cục desktop dùng search/toolbar phía trên, bộ lọc bên trái, bảng dữ liệu và chi tiết inline bên phải.

`roll` và `sheet` là metadata catalog hợp lệ để tạo, tìm, lọc và hiển thị đơn vị/cách bán. V1 không có đối tượng tồn vật lý theo từng cuộn hoặc tấm, không có tab tồn object-level, không khui/cắt/tấm lẻ và không trừ tồn theo object.

Hướng này không bị hủy. Xem backlog có điều kiện tại [V2 — lifecycle cuộn/tấm](#v2--lifecycle-cuộntấm).

## View V1

| View | Nghiệp vụ runtime |
|---|---|
| Danh sách hàng hóa | Tìm, lọc, sort, export và mở chi tiết catalog |
| Chi tiết inline | Thông tin, đơn vị & quy đổi, BOM, tồn kho, thẻ kho, ghi chú |
| Phiếu kiểm kho | Danh sách, filter, mở chi tiết, sửa ghi chú, hủy và import KiotViet |

Tồn tổng và movement là contract dùng chung cho hàng có theo dõi tồn. Không có navigation hay API riêng cho danh sách cuộn/tấm.

## Danh mục

Modal tạo dùng một form chung. Product kind runtime gồm `goods`, `service`, `auxiliary_material`, `roll`, `sheet`, `combo`.

| Kind | Default catalog metadata |
|---|---|
| Hàng thường | `normal`, bán số lượng, theo dõi tồn |
| Dịch vụ | `normal`, không theo dõi tồn |
| Vật tư phụ | `normal`, theo dõi tồn |
| Cuộn | `roll`, bán mét tới, đơn vị mặc định `m` |
| Tấm | `sheet`, bán theo tấm, đơn vị mặc định `tấm` |
| Combo | `normal`, không theo dõi tồn trực tiếp; có BOM |

Nhóm hàng, trạng thái, product kind, inventory shape, ngày tạo và text search là filter catalog. Catalog không tự tính giá, tồn hay BOM: backend query/repository là owner.

## Chi tiết hàng hóa

| Tab | Dữ liệu |
|---|---|
| Thông tin | Mã, tên, nhóm, trạng thái, unit, sell method, giá runtime |
| Đơn vị & quy đổi | Unit hiện tại và `product_unit_conversions` active |
| BOM/Vật tư cấu thành | BOM query/mutation qua catalog API owner |
| Tồn kho | `operating_stock`, provisional KiotViet evidence, latest stocktake evidence và điều chỉnh tồn tổng |
| Thẻ kho | `stock_movements` theo product |
| Ghi chú | Ghi chú UI nhẹ, không đổi nghiệp vụ tồn |

`operating_stock` lấy từ movement persisted. `kiotviet_provisional_stock` và latest KiotViet stocktake chỉ là evidence đối soát, không ghi đè tồn vận hành.

Điều chỉnh tồn tổng tạo stocktake/movement qua repository transaction. Áp dụng cho catalog hàng theo dõi tồn, gồm product metadata `roll`/`sheet`; không có thao tác trên đối tượng cuộn/tấm.

## Kiểm kho và import

Phiếu kiểm kho có trạng thái runtime `draft`, `balanced`, `cancelled`. Trang hỗ trợ lọc ngày/trạng thái/người tạo/search, xem chi tiết, sửa ghi chú, hủy và import KiotViet.

Import phải giữ source metadata và row evidence. Không bulk delete theo mã chung, không dùng aggregate import để suy diễn tồn vật lý.

## V2 — lifecycle cuộn/tấm

V2 sẽ mở quản lý vật lý theo từng cuộn/tấm. Đây là hướng đã giữ lại, không phải behavior V1.

| Hạng mục V2 | Điều kiện trước khi mở |
|---|---|
| Persisted object cuộn/tấm | Schema có ID, product, kích thước, trạng thái, source document và organization scope |
| Nhập, khui, cắt, tạo tấm lẻ, hủy | Transaction owner, invariant quantity/diện tích, audit và rollback |
| Movement theo object | Liên kết movement tổng với object source/target; không được suy diễn từ aggregate import |
| Kiểm kho theo object | Phiếu, dòng, chênh lệch, cân bằng và trace object rõ ràng |
| POS deduction theo object | Rule chọn object, snapshot chứng từ, concurrency guard, negative-stock policy và test E2E |
| UI quản lý cuộn/tấm | Route/API chỉ mở sau persistence và nghiệp vụ trên đã có test |

V2 phải có migration, repository transaction, API schema, UI, permission, import manifest/mapping và test. Không bật từng phần độc lập hoặc dùng fixture thay persistence.

## Quy tắc an toàn

- Scope query/mutation theo `organization_id`.
- Timestamp lưu UTC; UI ngày dùng business timezone Việt Nam.
- Sales, purchase, stocktake và adjustment repository là owner movement; không sửa trực tiếp `stock_movements`.
- Physical lifecycle cuộn/tấm chỉ được mở lại khi có schema, transaction owner, API contract, UI và test đầy đủ.

## Tham chiếu

- [Danh sách hàng hóa và tồn kho](./02-PRODUCT-STOCK-LIST.md)
- [Quy tắc tồn kho](../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md)
- [Plan V2 lifecycle cuộn/tấm](file:///C:/Users/Admin/.gemini/antigravity/brain/a9a24066-d9df-4a60-bee5-204128fdc011/inventory_roll_sheet_completion_plan.md)
- [Schema inventory](../../04-DATABASE/Inventory/INVENTORY-TABLES.md)
