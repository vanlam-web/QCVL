# 01b-K01-PROFILE-SHORTCUTS.md - K01: Tiện ích, profile và phím tắt

> Thuộc: [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
> Cập nhật: 2026-07-08.

## 1. Phạm vi

File này là Source of Truth cho cụm tiện ích góc phải POS và phím tắt chung.

`Khui vật tư` nằm trong cụm này. Nghiệp vụ khui chi tiết nằm ở [01d-K01-KHUI.md](./01d-K01-KHUI.md).

## 2. Cụm tiện ích

| Nút | Tác vụ | Ghi chú |
| --- | --- | --- |
| `Khui vật tư` | Mở modal khui thủ công | Icon-only trong POS |
| `Lịch sử` | Mở đơn gần đây | Phục vụ tra cứu/in lại nhanh |
| `Trạng thái kết nối` | Báo trạng thái backend/realtime | Không phải nút đồng bộ nghiệp vụ |
| `Theme` | Đổi giao diện | Nếu bật trong UI |
| `Profile` | Mở menu tài khoản | Dùng chung style AppShell |

Không tách `Khui vật tư` thành khu vực K01 riêng.

## 3. Menu tài khoản POS

Menu tài khoản POS dùng `.account-menu-popover`, cùng visual với menu tài khoản ở dashboard/AppShell.

Thứ tự:

```text
Admin hoặc tên hiển thị
Báo cáo ca
Quản trị
Đăng xuất
```

Quy định:

- Dòng đầu là identity row, mở trang tài khoản hoặc dashboard tùy route hiện có.
- `Báo cáo ca` tạm thời có thể no-op cho tới khi module báo cáo ca hoàn chỉnh.
- `Quản trị` mở `/admin` khi có quyền.
- `Đăng xuất` thoát phiên.
- Menu đóng khi click ra ngoài hoặc nhấn `Esc`.
- Menu phải nổi trên drawer thanh toán/panel POS.

## 4. Trạng thái kết nối

| Trạng thái | Ý nghĩa |
| --- | --- |
| Disconnected | Mất kết nối backend/realtime |
| Connecting / Retrying | Đang kết nối lại |
| Connected | Kết nối thông suốt |

Màu trạng thái dùng token semantic, không hardcode màu theo trang.

## 5. Phím tắt

| Phím | Tác vụ |
| --- | --- |
| `F3` | Focus tìm hàng |
| `F4` | Focus tìm khách |
| `F8` | Focus/mở bảng giá nếu có |
| `F9` | Mở thanh toán |
| `Ctrl + Alt + N` | Mở hóa đơn mới |
| `Ctrl + Tab` | Chuyển tab phải |
| `Ctrl + Shift + Tab` | Chuyển tab trái |
