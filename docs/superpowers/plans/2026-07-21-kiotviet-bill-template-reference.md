# Tham chiếu KiotViet — Quản lý mẫu in

Updated: 2026-07-21  
Nguồn (HDSD KV Retail/FNB):
- [KV Retail — Quản lý Mẫu in](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-mau-in/)
- [KV FNB](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-thiet-lap/quan-ly-mau-in/)  
SoT QCVL: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)

## Phân tách như KV

| Phần | KV | QCVL |
|---|---|---|
| **Thông tin cửa hàng** | Tên / địa chỉ / ĐT / logo (thương hiệu dùng chung) | Panel **Thông tin cửa hàng** — gồm **logo** |
| **Quản lý mẫu in** | Tên mẫu + Mẫu in gợi ý + **nội dung** (HTML + token) | Panel **Quản lý mẫu in** — structured (chưa HTML) |

## Mô hình KV

| Bước | KV |
|---|---|
| Thêm mẫu | Tên + Mẫu in gợi ý A4/K80 + editor nội dung + token động |
| Thương hiệu trên bill | Logo + thông tin cửa hàng + thông điệp quảng cáo |
| POS | Icon máy in → chọn mẫu A/B/C |
| In lại | Popup Chọn mẫu in |

## QCVL hiện tại

| KV | QCVL |
|---|---|
| Logo thuộc cửa hàng | **Có** (không nằm trong form mẫu) |
| Danh sách mẫu / loại + A/B/C | **Có** |
| Tiêu đề, chân, cột mã/ĐVT/CK | **Có** |
| Thông điệp / khuyến mại | **Có** (`header_note`) |
| Bật/tắt khối: logo, địa chỉ, ĐT CH, ĐT KH, NV, bảng giá, ghi chú, thanh toán, chữ ký | **Có** (structured) |
| Editor HTML + token `{Ma_Hoa_Don}`… | **Chưa** |
| POS icon A/B/C trước TT | **Chưa** |

## Hướng tiếp

1. Editor HTML + danh sách token (slice lớn).
2. POS: chọn mẫu trước thanh toán.
3. Preference theo id mẫu + multi-bill SoT §4.
