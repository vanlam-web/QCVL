# API nhập hàng và nhà cung cấp QCVL

Cập nhật: `2026-07-24`

Nguồn thực thi: [purchase-routes.ts](../../../server/modules/purchase/purchase-routes.ts).

## Nhà cung cấp

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/suppliers` | Danh sách nhà cung cấp. |
| `GET` | `/api/v1/suppliers/{id}` | Chi tiết nhà cung cấp. |
| `POST` | `/api/v1/suppliers` | Tạo nhà cung cấp. |
| `PATCH` | `/api/v1/suppliers/{id}` | Cập nhật nhà cung cấp. |
| `GET` | `/api/v1/suppliers/{id}/payable-receipts` | Phiếu nhập còn phải trả. |
| `POST` | `/api/v1/suppliers/{id}/payments` | Thanh toán nhà cung cấp. |
| `POST` | `/api/v1/suppliers/import/kiotviet/preview` | Xem trước import NCC KiotViet. |
| `POST` | `/api/v1/suppliers/import/kiotviet` | Import NCC KiotViet. |
| `DELETE` | `/api/v1/suppliers/import/kiotviet` | Xóa phạm vi import NCC. |

## Phiếu nhập

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/purchase/receipts` | Danh sách phiếu nhập. |
| `GET` | `/api/v1/purchase/receipts/{id}` | Chi tiết phiếu nhập. |
| `POST` | `/api/v1/purchase/receipts` | Tạo phiếu nhập. |
| `PATCH` | `/api/v1/purchase/receipts/{id}` | Cập nhật phiếu đang cho phép sửa. |
| `POST` | `/api/v1/purchase/receipts/{id}/post` | Ghi sổ phiếu nhập. |
| `POST` | `/api/v1/purchase/receipts/{id}/cancel` | Hủy theo transaction/audit server. |
| `POST` | `/api/v1/purchase/receipts/import/kiotviet/preview` | Xem trước import phiếu nhập. |
| `POST` | `/api/v1/purchase/receipts/import/kiotviet` | Import phiếu nhập KiotViet. |
| `DELETE` | `/api/v1/purchase/receipts/import/kiotviet` | Xóa phạm vi import phiếu nhập. |

## Quy tắc

- Server kiểm tra quyền, organization scope, status transition và dữ liệu dòng hàng.
- Không sửa đè chứng từ đã ghi sổ; dùng hành vi cancel/revise mà server hỗ trợ.
- Thanh toán phải có evidence chứng từ/công nợ; không suy diễn link bằng tổng tiền.
- Import dùng preview, chỉ dọn dữ liệu thuộc đúng source/scope import.

## Tham chiếu

- [Nghiệp vụ nhập hàng](../../03-BUSINESS-NghiepVu/Purchase/README.md)
- [Schema nhập hàng](../../04-DATABASE/Purchase/PURCHASE-TABLES.md)
