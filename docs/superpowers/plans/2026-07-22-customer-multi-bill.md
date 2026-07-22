# Plan — Multi-bill preference theo khách (SoT §4)

Updated: 2026-07-22  
Branch: `cursor/customer-multi-bill-0482`  
SoT: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md) §4

## Mục tiêu

Một khách có thể tick **một hoặc nhiều** mẫu bill; lần sau mở bill thì hệ thống tự tick lại các mẫu đã chọn. Không đụng công thức tiền / gửi Zalo / máy in.

## Thiết kế

| Phần | Chi tiết |
|---|---|
| Lưu trữ | `customer_snapshots.data.preferred_bill_templates: string[]` + giữ `preferred_bill_template` = mẫu đang xem gần nhất |
| Legacy | Chỉ có `preferred_bill_template` → coi như mảng 1 phần tử |
| Khách lẻ | Không lưu preference |
| API | `PATCH /customers/:id` nhận `preferred_bill_templates` và/hoặc `preferred_bill_template` |
| Màn in | Picker `mode=multi`: checkbox nhớ mẫu + nút xem/in |
| POS checkout | Vẫn `mode=single` (chọn 1 mẫu mở sau tạo HD) |

## Luồng

1. Mở in HD/BG → enrich preference từ master khách.
2. Tick lại các id trong `preferred_bill_templates`; active = `preferred_bill_template` (nếu còn trong list).
3. Staff tick/bỏ tick hoặc bấm xem mẫu khác → PATCH lưu list + primary.
4. Lần sau mở lại → restore ticks.

## Ngoài scope

- In lần lượt tất cả mẫu đã tick (vẫn in mẫu đang xem)
- Gửi Zalo ảnh, gợi ý máy in
- Editor HTML

## Acceptance

1. Khách có 2 mẫu đã nhớ → mở bill thấy 2 checkbox tick; đang xem đúng primary.
2. Tick thêm mẫu → lưu list; mở lại vẫn tick.
3. Khách lẻ không gọi PATCH preference.
4. Docs SoT §10 + tham chiếu KV cập nhật trạng thái multi-bill.
