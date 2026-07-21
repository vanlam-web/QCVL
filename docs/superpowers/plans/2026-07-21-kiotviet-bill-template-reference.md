# Tham chiếu KiotViet — Quản lý mẫu in

Updated: 2026-07-21  
Nguồn chính: [KV Retail — Quản lý Mẫu in](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-mau-in/)  
SoT QCVL: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)

## KV làm gì (học được)

1. **Theo loại giao dịch** — Hóa đơn / Đặt hàng / Trả hàng… mỗi loại có danh sách mẫu riêng (HD tối đa ~5).
2. **Thêm mẫu** — Tên mẫu + **Mẫu in gợi ý (A4 | K80)** + **editor HTML** kèm token động (`{{...}}`).
3. **POS** — Icon máy in → chọn mẫu A/B/C; icon hiện ký hiệu mẫu đang chọn.
4. **In lại** — Popup **Chọn mẫu in** trước khi in (không cứng một mẫu).
5. **Thương hiệu** — Logo, thông tin cửa hàng, thông điệp chân bill trên mẫu.

## QCVL đã có (lát cắt hiện tại)

| KV | QCVL |
|---|---|
| A4 / K80 | Có (org default + đổi trên màn in) |
| Logo / shop header | Có (Thiết lập → Thông tin cửa hàng + mẫu in) |
| Tiêu đề / chân / cột | Có (không HTML) |
| Preference theo khách | Có (A4/K80; không multi-tab) |
| Nhiều mẫu đặt tên + HTML editor | **Chưa** |
| Chọn mẫu A/B/C trên POS | **Chưa** (toolbar A4/K80 trên print) |
| Gợi ý máy in / Zalo ảnh | **Chưa** |

## Hướng học tiếp (không làm ngay trừ khi Owner mở)

1. Danh sách mẫu đặt tên theo loại (HD / BG) — trước khi làm HTML editor.
2. Popup chọn mẫu khi in lại (giống KV).
3. Editor HTML + token — slice lớn, sau khi ổn danh sách mẫu.
4. Gửi ảnh Zalo — theo SoT §6–7.

Không copy nguyên UI KV; giữ shell QCVL, chỉ học **mô hình nghiệp vụ** (nhiều mẫu / khổ / chọn lúc in).
