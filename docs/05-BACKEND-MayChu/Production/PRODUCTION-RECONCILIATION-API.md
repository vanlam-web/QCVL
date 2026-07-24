# API hàng đợi sản xuất QCVL

Cập nhật: `2026-07-24`
Nguồn thực thi: [production-routes.ts](../../../server/modules/production/production-routes.ts), [production-handlers.ts](../../../server/modules/production/production-handlers.ts).

## Route hiện hành

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/production-queue` | Danh sách hàng đợi sản xuất, phân trang. |
| `GET` | `/api/v1/production-queue/history` | Lịch sử queue. Runtime hiện trả danh sách rỗng. |
| `POST` | `/api/v1/production-queue/{id}/add-to-draft` | Trả draft line từ queue item để POS tiếp tục xử lý. |
| `POST` | `/api/v1/production-queue/{id}/dismiss` | Ẩn queue item theo handler hiện hành. |
| `POST` | `/api/v1/production-queue/{id}/restore` | Hiện lại queue item theo handler hiện hành. |

## Contract hiện có

- Queue list dùng `page`/`page_size` từ handler chuẩn và sắp newest-first.
- `add-to-draft` trả `queue_item_id`, khách lẻ mặc định và draft line mang `source: production_queue`.
- Handler hiện là integration slice tối thiểu; không suy luận queue persistence, parser file, production machine, m² reconciliation hoặc stock mutation ngoài source code.
- Không có route `/v1/production/reconciliation`, không có `confirm-match`, tạo invoice, tạo stock movement hoặc đối soát máy-hóa đơn runtime.

## Quy tắc an toàn

- Chỉ dùng response API hiện hành; client không tự biến queue item thành chứng từ chốt.
- Workflow production reconciliation/machine import phải có plan, schema, route, source evidence và test riêng trước khi tạo contract docs.
- Thời gian/lịch sử dùng UTC instant và business date QCVL khi feature có dữ liệu runtime.

## Tham chiếu

- [Production routes](../../../server/modules/production/production-routes.ts)
- [Production handlers](../../../server/modules/production/production-handlers.ts)
- [Quy ước backend](../BACKEND_CONVENTIONS.md)
