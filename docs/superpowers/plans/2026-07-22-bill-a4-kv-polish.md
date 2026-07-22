# Plan — Polish A4 bill khớp mẫu KiotViet xưởng

Updated: 2026-07-22  
Branch: `cursor/bill-a4-kv-polish-0482`  
SoT: [POS-BILL-PRINT-MESSAGING.md](../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md)  
Tham chiếu: [kiotviet-bill-template-reference.md](./2026-07-21-kiotviet-bill-template-reference.md)

## Mục tiêu

Chỉnh mặc định + vài trường cửa hàng để bản in A4 gần bill KV thật của shop (logo / kính gửi / bảng cột / QR·STK / nợ / bằng chữ / địa danh·ngày / Người bán), **không** mở editor HTML và **không** đổi công thức tiền/checkout/công nợ.

## Phạm vi slice

| Thay đổi | Chi tiết |
|---|---|
| Default tiêu đề báo giá | `BẢNG BÁO GIÁ` |
| Default cột A4 | Tắt mã hàng, tắt cột CK; bật chữ ký Người bán/Khách hàng |
| Meta khách A4 | Tắt NV + bảng giá trên khối kính gửi (ngày chỉ ở chân trang) |
| Footer hóa đơn A4 | `Giá trên chưa bao gồm thuế.` khi chưa cấu hình |
| `print_place` | Trường mới ở **Thông tin cửa hàng** → `TP. Hồ Chí Minh, ngày …` |
| Nhãn NH trên bill | `MBBank` → `MB Bank` (alias catalog VietQR) |

## Ngoài scope (ghi lại cho lát sau)

- Multi-bill tick theo khách (SoT §4)
- Gợi ý máy in (SoT §5)
- Gửi ảnh Zalo/Messenger (SoT §6–7)
- Editor HTML + token
- Snapshot địa chỉ khách vào chứng từ lúc lưu (hiện enrich từ master khi mở bill)
- Đổi công thức Nợ cũ / Tổng nợ trên sổ cái

## Nợ cũ trên bill (quy ước hiển thị)

Không phải số dư sổ cái mới:

- `total_debt_amount` = công nợ khách hiện tại (master)
- `remaining` = `max(0, total_amount − paid_amount)` của chứng từ đang in
- **Nợ cũ (hiển thị)** = `max(0, total_debt_amount − remaining)`
- **Tổng nợ (hiển thị)** = `total_debt_amount` (hoặc `remaining` nếu không có số master)

Có thể lệch khi khách có nhiều khoản nợ song song — chỉ dùng để in gần KV, không thay thế màn công nợ.

## Địa chỉ khách

Bill đọc `document.customer.address` do API enrich từ hồ sơ khách khi `getSalesDocument`. Nếu master trống → in `—`. Điền địa chỉ ở danh mục khách để bill có đủ.

## Acceptance

1. Seed mẫu A4 mới: không cột Mã hàng/CK; có khối chữ ký; báo giá title `BẢNG BÁO GIÁ`.
2. Lưu `print_place` qua API bill-settings; in ra đúng dòng địa danh + ngày.
3. Tài khoản NH khớp catalog in nhãn đọc được (`MB Bank`).
4. Tests print + bill-settings + vietqr pass.
5. Docs tham chiếu KV/Sapo/ERPNext/Odoo + trạng thái QCVL được cập nhật.
