# API đơn hàng và POS QCVL

Cập nhật: `2026-07-24`

Nguồn thực thi: [sales-routes.ts](../../../server/modules/sales/sales-routes.ts).

| Method | Route | Mục đích |
|---|---|---|
| `POST` | `/api/v1/pos/cart/validate` | Kiểm tra giỏ hàng trước checkout. |
| `POST` | `/api/v1/orders/checkout` | Chốt hóa đơn theo transaction server. |
| `POST` | `/api/v1/orders/quotes` | Tạo/lưu báo giá. |
| `GET` | `/api/v1/orders/quotes/{id}/reopen-payload` | Lấy payload mở lại báo giá. |
| `POST` | `/api/v1/orders/{id}/revise` | Tạo bản sửa hóa đơn theo lifecycle. |
| `GET` | `/api/v1/sales-documents` | Danh sách chứng từ bán hàng. |
| `GET` | `/api/v1/sales-documents/{id}` | Chi tiết chứng từ. |
| `PATCH` | `/api/v1/sales-documents/{id}` | Cập nhật phần server cho phép. |
| `POST` | `/api/v1/sales-documents/import/kiotviet/preview` | Xem trước import hóa đơn KiotViet. |
| `POST` | `/api/v1/sales-documents/import/kiotviet` | Import hóa đơn KiotViet. |
| `DELETE` | `/api/v1/sales-documents/import/kiotviet` | Xóa phạm vi import KiotViet theo server. |

## Quy tắc

- Cart validation không thay checkout transaction; checkout server là quyết định cuối.
- Hóa đơn đã chốt không sửa đè; revise/cancel theo lifecycle và audit server.
- Không để POS state/local storage là nguồn sự thật cho giá, tồn, tiền hoặc chứng từ.
- Import qua preview, không xóa dữ liệu POS/manual ngoài source/scope import.
- Ngày nghiệp vụ dùng `Asia/Ho_Chi_Minh`, UI hiển thị `DD-MM-YYYY`.

## Tham chiếu

- [Lifecycle chứng từ bán](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md)
- [Quy tắc tính đơn](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md)
- [Schema POS](../../04-DATABASE/Sales/POS-TABLES.md)
