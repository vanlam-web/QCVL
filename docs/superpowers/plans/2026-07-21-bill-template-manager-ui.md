# Plan — Bill template manager UI (KV-style)

Updated: 2026-07-21  
Branch: `cursor/bill-template-manager-ui-0482`

## Goal

UI **Quản lý mẫu in** chuẩn hơn (học KV): danh sách mẫu theo Hóa đơn/Báo giá → sửa sâu từng mẫu → xem trước.

## Slice này

- `bill_templates` JSON trên `organizations` (migration `0011`)
- Seed 4 mẫu: Hóa đơn/Báo giá × A4/K80
- Thêm/xóa mẫu (tối đa 5/loại), đặt mặc định, sửa tên/khổ/tiêu đề/chân/cột/logo
- Print HD/BG lấy content theo mẫu khớp khổ giấy
- **Chưa** HTML editor / token

## Sau

Editor HTML + token; popup chọn mẫu A/B/C trên POS; Zalo ảnh.
