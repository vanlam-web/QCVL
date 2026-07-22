# Tham chiếu mẫu in — KiotViet · Sapo · ERPNext · Odoo vs QCVL

Updated: 2026-07-22  
SoT QCVL: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)  
Slice polish A4: [2026-07-22-bill-a4-kv-polish.md](./2026-07-22-bill-a4-kv-polish.md)  
**Đóng tạm:** [2026-07-22-bill-area-freeze.md](./2026-07-22-bill-area-freeze.md) — Owner 2026-07-22 không mở code bill mới.

## 1. KiotViet (mẫu shop đang dùng)

Nguồn HDSD:
- [KV Retail — Quản lý Mẫu in](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-mau-in/)
- [KV FNB](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-thiet-lap/quan-ly-mau-in/)

| Khả năng | KV | QCVL |
|---|---|---|
| Tách **Thông tin cửa hàng** / **Quản lý mẫu in** | Có | Có |
| Logo thuộc cửa hàng | Có | Có |
| Editor HTML + token `{...}` | Có | **Chưa** |
| Tối đa ~3–5 mẫu / loại | Có | Có (≤5 / invoice\|quote) |
| POS chọn mẫu A/B/C | Có | Có |
| Preference theo khách | Có | Có (multi-tick + primary) |
| Multi-bill tick | Có | **Có** (SoT §4, 2026-07-22) |
| Layout A4 kiểu KV (kính gửi, QR, nợ, bằng chữ) | Có | Có (+ polish 2026-07-22) |

### Mẫu A4 thật của xưởng (đối chiếu)

- Logo trái + tên / địa chỉ / ĐT
- Tiêu đề giữa **BẢNG BÁO GIÁ** + Số hóa đơn/báo giá
- Kính gửi · Địa chỉ · SĐT
- Cột: STT · Tên hàng · Nội dung · ĐVT · SL · Đơn giá · Thành tiền
- Trái: VietQR + `MB Bank: STK` + chủ TK
- Phải: Tổng toa · Nợ cũ · Tổng nợ · Giảm giá · Khách thanh toán · Còn lại
- Tổng bằng chữ · ghi chú thuế · địa danh + ngày · Người bán

## 2. Sapo

Nguồn:
- [Cấu hình mẫu in](https://help.sapo.vn/cai-dat-va-su-dung-ung-dung-au-hinh-mau-in)
- [Chỉnh sửa cơ bản](https://help.sapo.vn/chinh-sua-co-ban-mau-in-hoa-don-ban-hang-tren-sapo-omniai)
- [Từ khóa / biến](https://help.sapo.vn/danh-sach-tu-khoa-mau-in-hoa-don-ban-hang-tren-sapo-omniai)
- [QR thanh toán](https://help.sapo.vn/thiet-lap-mau-in-hoa-don-kem-qr-thanh-toan)

| Tầng | Sapo | QCVL |
|---|---|---|
| Cơ bản | Bật/tắt field cố định theo mẫu | **≈ đây** — toggle trên `BillTemplateManager` |
| Nâng cao | HTML + ~80 biến | **Chưa** |
| Khổ | A4, A5, K57, K80 | A4, K80 |
| QR | VietQR / ví | VietQR (`img.vietqr.io`) |

## 3. ERPNext (Frappe)

- Print Format Builder (kéo thả) + Jinja/HTML tùy chỉnh
- PDF qua wkhtmltopdf / Chrome
- Letter head riêng công ty

QCVL chưa cần PDF server nếu browser print đủ; Jinja ≈ hướng “HTML + token” nếu Owner mở slice lớn.

## 4. Odoo

- Báo cáo QWeb XML + paperformat (A4 / nhiệt)
- POS receipt render client-side; VietQR thường qua module VN

Nặng hơn mức xưởng cần; chỉ tham chiếu kiến trúc.

## 5. Trạng thái QCVL hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Logo / tên / ĐT / địa chỉ cửa hàng | Có |
| `print_place` (địa danh cuối bill) | Có (2026-07-22) |
| Layout A4 KV + QR/STK + nợ + bằng chữ | Có |
| Default A4: không mã hàng/CK cột, có chữ ký, footer thuế | Có (seed mới) |
| Tiêu đề báo giá mặc định `BẢNG BÁO GIÁ` | Có |
| Nhãn NH đọc được (`MB Bank`) | Có |
| Danh sách mẫu / A/B/C + POS pick | Có |
| Preference theo id mẫu / multi-tick | Có |
| Địa chỉ khách trên bill | Enrich từ master khi mở bill (chưa snapshot lúc lưu) |
| Nợ cũ hiển thị | Công thức xem plan polish — không đụng sổ cái |
| Editor HTML + token | Chưa |
| Zalo ảnh / gợi ý máy in | Chưa |

## 6. Hướng tiếp — **đóng tạm (Owner 2026-07-22)**

V1 bill đủ dùng. Các mục dưới **không** mở code đến khi Owner bảo:

1. Gửi bill ảnh Zalo/Messenger (SoT §6–7).
2. Gợi ý máy in gần nhất (SoT §5).
3. Snapshot địa chỉ khách vào chứng từ lúc lưu.
4. Editor HTML + token.

Xem [2026-07-22-bill-area-freeze.md](./2026-07-22-bill-area-freeze.md).

## 7. Quy tắc giữ cho agent

- Không đổi công thức tiền / checkout / tồn kho / sổ nợ.
- Ưu tiên structured toggles trước HTML editor.
- Mẫu đã lưu trong Postgres giữ nguyên toggle cũ; seed mặc định mới chỉ áp khi chưa có `bill_templates` hoặc tạo mẫu mới.
