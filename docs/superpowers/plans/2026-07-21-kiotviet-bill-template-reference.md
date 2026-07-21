# Tham chiếu KiotViet — Quản lý mẫu in

Updated: 2026-07-21  
Nguồn:
- [KV Retail](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-mau-in/)
- [KV FNB](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-thiet-lap/quan-ly-mau-in/)
- [KV Salon](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/salon-thiet-lap/quan-ly-mau-in/)  
SoT QCVL: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)

## Mô hình KV (chuẩn cần học)

| Bước | KV làm gì |
|---|---|
| Vào màn | Thiết lập → Quản lý mẫu in |
| Theo loại GD | Chọn giao dịch (Hóa đơn, Đặt hàng, Trả hàng…) → danh sách mẫu của loại đó |
| Thêm mẫu | `+` → **Tên mẫu** + **Mẫu in gợi ý (A4\|K80)** + **editor HTML + token** |
| Giới hạn | Retail: tối đa ~5 mẫu/loại quan trọng; FNB/Salon/Hotel: thường 3 |
| Sửa / xóa | Sửa trong form; xóa mẫu không còn dùng |
| POS | Icon máy in → chọn mẫu **A/B/C** (ký hiệu hiện trên icon) |
| In lại | Popup **Chọn mẫu in** rồi mới In |
| Thương hiệu | Logo + thông tin cửa hàng + thông điệp trên mẫu |

## QCVL sau #25 + lát cắt align

| KV | QCVL |
|---|---|
| Danh sách mẫu theo loại HD/BG | **Có** (tab Hóa đơn / Báo giá) |
| Tên mẫu + A4/K80 | **Có** |
| Sửa tiêu đề / chân / cột / logo | **Có** (structured, chưa HTML) |
| Badge A/B/C trên danh sách & lúc in | **Có** (lát cắt align) |
| Chọn **mẫu đặt tên** lúc in (không chỉ khổ giấy) | **Có** (lát cắt align) |
| Preference theo khách | **Có** (lưu khổ A4/K80; map sang mẫu khớp khổ) |
| Editor HTML + token `{{...}}` | **Chưa** |
| Icon máy in trên POS + ký hiệu A/B/C | **Chưa** |
| Popup chọn mẫu khi in lại từ list chứng từ | **Một phần** (toolbar trên màn in) |
| Gợi ý máy in / Zalo ảnh | **Chưa** |

## Hướng tiếp (Owner mở khi cần)

1. Editor HTML + danh sách token động (slice lớn).
2. POS: chọn mẫu A/B/C trước thanh toán (icon máy in).
3. Preference theo **id mẫu** (không chỉ khổ giấy) + multi-bill tick theo SoT §4.
4. Zalo/ảnh bill.

Không copy pixel-perfect UI KV; giữ shell QCVL, bám **mô hình nghiệp vụ**.
