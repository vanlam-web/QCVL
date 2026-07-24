# API khách hàng, hàng hóa và giá QCVL

Cập nhật: `2026-07-24`

Nguồn thực thi: [catalog-routes.ts](../../../server/modules/catalog/catalog-routes.ts).
Quy tắc giá: [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md).

## Route khách hàng

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/customers` | Danh sách/tìm khách. |
| `POST` | `/api/v1/customers` | Tạo khách. |
| `PATCH` | `/api/v1/customers/{id}` | Cập nhật khách. |
| `GET` | `/api/v1/customer-groups` | Danh sách nhóm khách. |
| `POST` | `/api/v1/customers/import/kiotviet/preview` | Xem trước import khách KiotViet. |
| `POST` | `/api/v1/customers/import/kiotviet` | Import khách KiotViet. |
| `DELETE` | `/api/v1/customers/import/kiotviet` | Xóa phạm vi import khách. |
| `GET` | `/api/v1/customers/{id}/products/{productId}/recent-prices` | Giá gần đây của khách/sản phẩm. |

## Route hàng hóa và BOM

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/product-groups` | Danh sách nhóm hàng. |
| `POST` | `/api/v1/product-groups` | Tạo nhóm hàng. |
| `PATCH` | `/api/v1/product-groups/{id}` | Cập nhật nhóm hàng. |
| `GET` | `/api/v1/products` | Danh sách/tìm hàng. |
| `POST` | `/api/v1/products` | Tạo hàng. |
| `PATCH` | `/api/v1/products/{id}` | Cập nhật hàng. |
| `GET` | `/api/v1/products/{id}/bom` | Đọc BOM hàng. |
| `POST`/`PUT` | `/api/v1/products/{id}/bom` | Ghi BOM khi server cho phép. |
| `POST` | `/api/v1/products/import/kiotviet/preview` | Xem trước import hàng. |
| `POST` | `/api/v1/products/import/kiotviet` | Import hàng. |
| `DELETE` | `/api/v1/products/import/kiotviet` | Xóa phạm vi import hàng. |

## Route giá

| Method | Route | Mục đích |
|---|---|---|
| `POST` | `/api/v1/pricing/resolve` | Tính giá áp dụng tại server. |
| `GET` | `/api/v1/price-lists` | Danh sách bảng giá. |
| `POST` | `/api/v1/price-lists/formulas/preview` | Xem trước áp dụng công thức giá. |
| `POST` | `/api/v1/price-lists/formulas/apply` | Áp dụng công thức giá theo validation server. |

## Quy tắc

- Backend quyết giá cuối cùng, scope organization, quyền, validation và trạng thái active.
- Không lấy giá/nhóm khách/giá gần đây từ POS local state làm nguồn sự thật.
- `customer_group_id = null` dùng giá chung theo business rule; không tự gán seed group.
- Import phải qua preview, chỉ xóa dữ liệu thuộc source/scope import; không xóa customer/product tạo tay hoặc POS data.
- Giá, đơn vị và conversion của dòng bán phải snapshot khi chứng từ chốt; catalog thay đổi không được sửa lịch sử.
- Route cần xác thực/permission dùng middleware hiện hành; UI ẩn nút không thay server authorization.

## Tham chiếu

- [Nghiệp vụ khách POS](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md)
- [Nghiệp vụ giá POS](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md)
- [Schema Sales/POS](../../04-DATABASE/Sales/POS-TABLES.md)
- [Quy ước backend](../BACKEND_CONVENTIONS.md)
