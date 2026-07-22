# Tham chiếu KiotViet — Quản lý mẫu in

Updated: 2026-07-22  
Nguồn (HDSD KV Retail/FNB):
- [KV Retail — Quản lý Mẫu in](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-mau-in/)
- [KV FNB](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-thiet-lap/quan-ly-mau-in/)  
SoT QCVL: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)

## Phân tách như KV

| Phần | KV | QCVL |
|---|---|---|
| **Thông tin cửa hàng** | Tên / địa chỉ / ĐT / logo | Panel **Thông tin cửa hàng** — gồm **logo** |
| **Quản lý mẫu in** | Tên + gợi ý A4/K80 + nội dung | Panel **Quản lý mẫu in** — structured |

## QCVL hiện tại

| KV | QCVL |
|---|---|
| Logo thuộc cửa hàng | **Có** |
| Danh sách mẫu / A/B/C | **Có** |
| Tùy biến khối + thông điệp | **Có** (structured) |
| Chọn mẫu lúc in lại | **Có** (toolbar màn in) |
| POS chọn mẫu A/B/C trước TT | **Có** (picker trên checkout) |
| Preference theo mẫu | **Có** (lưu **id mẫu**; vẫn nhận a4/k80 cũ) |
| Editor HTML + token | **Chưa** |
| Multi-bill tick / Zalo ảnh | **Chưa** |

## Hướng tiếp

1. Editor HTML + token (slice lớn).
2. Multi-bill theo SoT §4.
3. Gửi bill ảnh / gợi ý máy in.
