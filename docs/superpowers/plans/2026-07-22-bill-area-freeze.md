# Đóng phân bill tạm (V1 usable)

Updated: 2026-07-22  
Owner: đóng phạm vi bill — bản hiện tại dùng được tạm.  
SoT: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)

## Quyết định

**Phân bill / mẫu in = đã xong / đóng tạm.** Không mở code bill mới đến khi Owner bảo.

Giống kiểu đóng P4 / import KV: runtime đủ dùng quầy; phần còn lại SoT = nâng cấp sau.

## Đã ship (V1)

| Hạng mục | Ghi chú |
|---|---|
| In HD / BG (browser print) | A4 + K80 |
| Thông tin cửa hàng + logo + `print_place` | Thiết lập |
| Quản lý mẫu (≤5 / loại), toggle cấu trúc | Không HTML editor |
| Layout A4 gần mẫu KV xưởng | QR VietQR, STK, nợ cũ/tổng nợ (hiển thị), bằng chữ, chữ ký |
| Preference theo khách | Multi-tick + mẫu đang xem — [multi-bill](./2026-07-22-customer-multi-bill.md) |
| POS chọn mẫu trước khi tạo HD | Single-select mở print |

## Đóng / nâng cấp sau (không làm trong đợt này)

| Mục | SoT |
|---|---|
| Gửi ảnh Zalo / Messenger | §6–7 |
| Gợi ý máy in gần nhất | §5 |
| Editor HTML + token kiểu KV/Sapo | — |
| Snapshot địa chỉ khách vào chứng từ lúc lưu | §2 chặt hơn |
| Active/ngưng mẫu (status) | §3 mở rộng |
| Đổi công thức nợ trên sổ cái | Ngoài bill — không đụng |

## Quy tắc agent

- Không mở PR/slice bill mới trừ Owner yêu cầu rõ.
- Không “cải thiện thêm” layout/toggle bill khi đang làm việc khác.
- Bug blocking in được phép sửa hẹp; không nhân tiện thêm feature.
- Công thức tiền / checkout / tồn / sổ nợ vẫn cấm đụng từ bill.

## Tài liệu liên quan

- [kiotviet-bill-template-reference.md](./2026-07-21-kiotviet-bill-template-reference.md)
- [2026-07-22-bill-a4-kv-polish.md](./2026-07-22-bill-a4-kv-polish.md)
- [2026-07-22-customer-multi-bill.md](./2026-07-22-customer-multi-bill.md)
- Sales README · mục vận hành đơn mới
