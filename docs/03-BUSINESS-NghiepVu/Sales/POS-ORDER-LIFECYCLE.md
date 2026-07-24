# Vòng đời chứng từ POS QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [sales-routes.ts](../../../server/modules/sales/sales-routes.ts), [sales-core-handlers.ts](../../../server/modules/sales/sales-core-handlers.ts), [sales-save-repository.ts](../../../server/modules/sales/sales-save-repository.ts).

## Chứng từ runtime

| Loại | Route tạo | `order_type` | Trạng thái trả về |
|---|---|---|---|
| Hóa đơn | `POST /api/v1/orders/checkout` | `invoice` | `completed` |
| Báo giá | `POST /api/v1/orders/quotes` | `quote` | `active` |
| Bản sửa hóa đơn | `POST /api/v1/orders/{id}/revise` | `invoice` | `completed` |

Cả invoice/quote dùng `orders` và `order_items`; snapshot customer/seller/product được lưu theo document. POS draft là trạng thái UI/client, không phải chứng từ database trong contract này.

## Checkout invoice

- Server resolve customer, sinh code invoice, tạo document từ request và scope organization/session user.
- Khi repository PostgreSQL active, save trong transaction: document, payment receipt/method (nếu có payment), cashbook entry và stock movement.
- Nếu có old-debt payment, handler gọi `collectCustomerDebt` với allocation client gửi; không tự FIFO/suy đoán allocation.
- Response trả invoice completed, receipt nếu tạo và inventory warnings. Checkout fail phải rollback transaction, không coi response UI là chứng từ đã lưu.

## Báo giá

- Quote tạo qua route riêng, lưu document type `quote`, status `active`.
- Save quote không tạo cashbook entry trong handler.
- `GET /api/v1/orders/quotes/{id}/reopen-payload` trả payload để UI mở lại; chi tiết payload do handler owner.
- Không có route runtime khẳng định “lưu đè quote cũ”, shipping/production order hoặc giữ tồn.

## Revision invoice

- Chỉ invoice `completed` được revise.
- Caller cần `perm.edit_order_locked` và reason code hợp lệ.
- Repository bắt đầu transaction, lock original order `FOR UPDATE`, sinh revision code/base code, insert document mới, đánh dấu invoice cũ `cancelled` với `cancel_reason_type = revised`, liên kết `replaced_by_order_id`/`revised_from_order_id`.
- Debt entry open của invoice cũ được close với remaining debt `0`; document mới có payment/cashbook/movement theo request revision.
- Transaction hiện tạo stock movement/receipt/cashbook mới cho revision. Không dùng tài liệu này để khẳng định mọi receipt/allocation/movement bản cũ đã được đảo tự động; phải audit source transaction/invariant trước repair/mutation.

## Ngoài contract runtime đã xác minh

Không có route/contract source hiện hành cho:

- Hủy invoice độc lập ngoài revision.
- Thời hạn 10 ngày, soft lock UI hoặc optimistic version protocol.
- Auto reopen/lưu đè quote, workflow delivery/production order.
- Rule draft giữa máy/quầy hoặc local persistence.
- Tự hoàn tiền, customer credit/advance hay phân bổ FIFO khi revise.

Feature cần schema, route, repository transaction, permission và test riêng trước khi thành rule active.

## Quy tắc an toàn

- Không sửa trực tiếp `orders`, debt, receipt, cashbook hoặc movement trong production.
- Mọi route/mutation scope `organization_id`; timestamps lưu UTC, UI date `DD-MM-YYYY` theo business timezone.
- Revision/checkout thay đổi tiền, debt, cashbook, stock phải có preview/evidence và post-invariant audit khi dùng repair data.

## Tham chiếu

- [Order API](../../05-BACKEND-MayChu/POS/ORDER-API.md)
- [Schema POS](../../04-DATABASE/Sales/POS-TABLES.md)
- [Sales routes](../../../server/modules/sales/sales-routes.ts)
