# Hàng đợi sản xuất QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [production-routes.ts](../../../server/modules/production/production-routes.ts), [production-handlers.ts](../../../server/modules/production/production-handlers.ts), [production-queue-service.ts](../../../src/features/production-queue/production-queue-service.ts).

## Phạm vi runtime

Production module hiện là hàng đợi hỗ trợ POS, không phải module đối soát máy sản xuất hay chứng từ kho.

| Route | Tác dụng |
|---|---|
| `GET /api/v1/production-queue` | Lấy queue page, newest first |
| `GET /api/v1/production-queue/history` | Lấy history page; handler hiện trả page rỗng |
| `POST /api/v1/production-queue/{id}/add-to-draft` | Trả customer mặc định và một draft line từ product đầu tiên |
| `POST /api/v1/production-queue/{id}/dismiss` | Dismiss item |
| `POST /api/v1/production-queue/{id}/restore` | Restore item |

`add-to-draft` trả payload để UI tạo draft local. Không tạo invoice, receipt, debt entry, cashbook entry hay stock movement.

## Giới hạn bắt buộc

Không có runtime source cho các claim sau:

- Import/parser file máy, machine schema hoặc `production_queue_items` persistence contract.
- Match file máy với invoice/order item.
- Báo cáo chênh lệch m², số lần chạy, hao hụt hay reconciliation dashboard.
- Tự tạo invoice, mutation stock hoặc workflow sản xuất.

Không dùng queue data làm evidence để sửa tồn, doanh thu, công nợ hoặc chứng từ. Các feature này cần schema, route, repository transaction, permission và test riêng.

## Quy tắc an toàn

- UI chỉ gọi service queue qua API; state draft còn local cho tới checkout POS thành công.
- Mọi mutation server phải scope organization/user authorization.
- Queue action không thay checkout; chỉ checkout runtime mới có transaction sales/payment/movement liên quan.

## Tham chiếu

- [Production queue API](../../05-BACKEND-MayChu/Production/PRODUCTION-RECONCILIATION-API.md)
- [Production routes](../../../server/modules/production/production-routes.ts)
