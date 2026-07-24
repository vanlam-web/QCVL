# API kho QCVL

Cập nhật: `2026-07-24`

## Nguồn thực thi

Nguồn chính xác là [inventory-routes.ts](../../../server/modules/inventory/inventory-routes.ts),
handler và repository liên quan. Tài liệu này không khẳng định workflow roll/sheet hoặc material opening
đã hoàn chỉnh nếu route/handler hiện hành chỉ là compatibility hoặc chưa có UI workflow.

## Route hiện hành

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/inventory/products` | Danh sách tồn theo sản phẩm. |
| `GET` | `/api/v1/inventory/products/{id}` | Chi tiết tồn sản phẩm. |
| `POST`/`PATCH` | `/api/v1/inventory/products/{id}/adjust-stock` | Điều chỉnh tồn có chứng từ/movement. |
| `GET` | `/api/v1/inventory/stock-movements` | Chứng cứ biến động kho. |
| `GET` | `/api/v1/inventory/stocktakes` | Danh sách kiểm kho. |
| `GET` | `/api/v1/inventory/stocktakes/{id}` | Chi tiết kiểm kho. |
| `PATCH` | `/api/v1/inventory/stocktakes/{id}` | Cập nhật kiểm kho theo validation server. |
| `POST` | `/api/v1/inventory/pos-shortage-preview` | Xem trước thiếu kho từ POS. |
| `POST` | `/api/v1/inventory/stocktakes/import/kiotviet/preview` | Xem trước import kiểm kho KiotViet. |
| `POST` | `/api/v1/inventory/stocktakes/import/kiotviet` | Import kiểm kho KiotViet. |
| `DELETE` | `/api/v1/inventory/stocktakes/import/kiotviet` | Xóa đợt import theo contract server. |
| `GET` | `/api/v1/inventory/material-openings/options` | Tùy chọn mở vật tư. |
| `POST` | `/api/v1/inventory/material-openings` | Tạo mở vật tư khi server cho phép. |

`GET /inventory/rolls` và `GET /inventory/sheets` tồn tại route compatibility. Không dùng chúng làm bằng
chứng rằng quản lý roll/sheet vật lý đã hoàn chỉnh.

## Quy tắc

- Backend xác thực, kiểm tra quyền, organization scope và trạng thái chứng từ.
- Tồn vận hành phải truy về `stock_movements`; không cập nhật số tồn bằng UI state hoặc fallback im lặng.
- Số tồn KiotViet/provisional chỉ là bằng chứng đối chiếu khi contract business nói rõ; không tự biến thành movement.
- Điều chỉnh tồn và kiểm kho phải tạo lịch sử/audit theo handler/repository hiện hành.

## Tham chiếu

- [Nghiệp vụ kho](../../03-BUSINESS-NghiepVu/Inventory/README.md)
- [Schema kho](../../04-DATABASE/Inventory/README.md)
- [Quy ước backend](../BACKEND_CONVENTIONS.md)
