# 01-K01-TOPBAR.md - K01: Thanh đỉnh POS

> Thuộc: [../01-POS-LAYOUT.md](../01-POS-LAYOUT.md)
> Cập nhật: 2026-07-08.

## 1. Sơ đồ phân khu

K01 chia 3 khu:

```text
+----------------------+-----------------------------+------------------------------+
| Tìm hàng (F3)        | Tab hóa đơn                 | Tiện ích và tài khoản        |
| Search shared style  | Hóa đơn 1, Hóa đơn 2, +     | Khui VT, lịch sử, theme, user|
+----------------------+-----------------------------+------------------------------+
```

`Khui vật tư` nằm trong cụm `K01 tiện ích`. Không tạo `K01 khui vật tư` riêng.

## 2. Khu 1 - Tìm hàng F3

- Focus nhanh bằng `F3`.
- Tìm theo mã hàng hoặc tên hàng/dịch vụ.
- Dùng visual chung `.management-compact-search`.
- Có icon tìm kiếm đầu ô.
- Nút tạo/hành động phụ cuối ô nếu có phải là icon-only có `aria-label`.

Chi tiết: [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)

## 3. Khu 2 - Tab hóa đơn

- Mỗi tab là một hóa đơn nháp độc lập.
- Có nút `+` tạo tab mới.
- Dải tab co giãn theo chiều ngang còn lại giữa search và tiện ích.
- Khi tràn ngang, dùng nút/scroll để chuyển tab.

Chi tiết: [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)

## 4. Khu 3 - Tiện ích và tài khoản

Nút trong cụm:

- `Khui vật tư`: mở modal khui thủ công.
- `Lịch sử`: mở đơn gần đây.
- `Trạng thái kết nối`: báo backend/realtime.
- `Theme`: đổi giao diện nếu bật.
- `Profile`: mở menu tài khoản dùng chung.

Menu tài khoản POS dùng cùng CSS/logic với AppShell:

```text
Admin hoặc tên hiển thị
Báo cáo ca
Quản trị
Đăng xuất
```

Chi tiết:

- [01b-K01-PROFILE-SHORTCUTS.md](./01b-K01-PROFILE-SHORTCUTS.md)
- [01d-K01-KHUI.md](./01d-K01-KHUI.md)

## 5. Kiểm thử UI cần có

- DOM có `[aria-label="K01 tiện ích"] button[aria-label="Khui vật tư"]`.
- DOM không có `[aria-label="K01 khui vật tư"]`.
- POS search có class `.management-compact-search`.
- POS profile menu có `.account-menu-popover`.
- Menu nổi không bị drawer thanh toán hoặc panel khác che.
