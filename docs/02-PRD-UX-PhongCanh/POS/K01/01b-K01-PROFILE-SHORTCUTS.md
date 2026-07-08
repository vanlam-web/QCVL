# 01b-K01-PROFILE-SHORTCUTS.md — K01: Cụm Tiện Ích, Profile & Phím Tắt

> **Thuộc khối:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) — Mục II.4 (Khu vực 4)
>
> **Trở về:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) | [Master Map](../01-POS-LAYOUT.md)

---

## I. PHẠM VI FILE

> **Source of Truth (SoT):** Cụm tiện ích góc phải Top Bar (Khu vực 4) + ma trận phím tắt điều khiển chung của POS.
> Mọi file khác (đặc biệt `01-K01-TOPBAR.md` §IV) **không định nghĩa lại** phím tắt; chỉ tham chiếu về file này.

Nút **[🍾 KHUI VẬT TƯ]** thuộc Khu vực 3 và có Source of Truth riêng tại [01d-K01-KHUI.md](./01d-K01-KHUI.md).

---

## II. CỤM TIỆN ÍCH HỒ SƠ & HỆ THỐNG

Không dùng nút đồng bộ thủ công. Dữ liệu máy sản xuất được cập nhật tự động; cụm góc phải chỉ hiển thị trạng thái và các thao tác hỗ trợ.

### Đèn báo trạng thái kết nối

| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| Disconnected | 🔴 Đỏ | Mất kết nối Internet hoặc mất tín hiệu realtime → cảnh báo nhân viên hạn chế thao tác lệnh máy sản xuất |
| Connecting / Retrying | 🟡 Vàng | Đang cố gắng kết nối lại |
| Connected | 🟢 Xanh | Kết nối thông suốt — dữ liệu lệnh in/cắt tự động nhảy lên POS |

### Nút Tải lại Cứu hộ [🔄]

- Kích thước nhỏ, nằm cạnh đèn báo.
- Chỉ dùng để tải lại giao diện khi trình duyệt bị đơ hoặc state hiển thị bất thường.
- Không phải nút đồng bộ nghiệp vụ.

### Icon Lịch sử [🕒]

- Click mở Drawer từ cạnh phải.
- Hiển thị **10 đơn hàng gần nhất** vừa thanh toán để tra cứu hoặc in lại nhanh.

### Nút [👤 Tên tài khoản / Mã máy trạm đăng nhập]

- Hiển thị nhãn theo format `👤 [Tên tài khoản / Mã máy trạm đăng nhập]`.
- Gắn người dùng hiện tại vào các thao tác tạo đơn, chỉnh đơn, thanh toán.

### Dropdown Profile

| Icon | Tác vụ | Mô tả | Quyền yêu cầu |
|---|---|---|---|
| 📈 | **Xem báo cáo ca** | Xem nhanh tổng tiền mặt/chuyển khoản đã thu trong ca | `perm.view_shift_report` |
| ⚙️ | **Đến trang Quản lý** | Chuyển sang trang back-office quản trị | `perm.access_admin_panel` |
| 🚪 | **Đăng xuất** | Thoát phiên làm việc, xóa session | Mọi tài khoản active |

> Ràng buộc UI: Dropdown đóng khi click ra ngoài hoặc nhấn `Esc`. Mục không có quyền tương ứng không hiển thị.

---

## III. MA TRẬN PHÍM TẮT ĐIỀU KHIỂN

| Phím tắt             | Tác vụ kích hoạt                          | Hành vi |
| -------------------- | ----------------------------------------- | ------- |
| `F3`                 | Focus ô tìm kiếm                          | Tự động bôi đen toàn bộ text đang có |
| `F4`                 | Focus ô Tìm/Thêm khách hàng               | Focus ô input tại K03-A — xem chi tiết: [K03-A Đối tác](../K03/01-K03A-DOI-TAC.md) |
| `F8`                 | Mở bảng giá/chiết khấu theo đối tác       | Focus hoặc mở dropdown `Bảng giá` tại K03-A cho đối tác đang chọn — xem chi tiết: [K03-A Đối tác](../K03/01-K03A-DOI-TAC.md) |
| `F9`                 | Kích hoạt THANH TOÁN                      | Tương đương click nút `[THANH TOÁN]` tại K03-D — xem chi tiết: [K03-D Thanh toán](../K03/04-K03D-THANH-TOAN.md) |
| `Ctrl + Alt + N`     | Mở thêm hóa đơn mới                      | Tương đương click nút `[+]` |
| `Ctrl + Tab`         | Chuyển sang tab bên phải                  | Duyệt qua các tab theo thứ tự vòng lặp |
| `Ctrl + Shift + Tab` | Chuyển sang tab bên trái                  | Duyệt ngược danh sách tab |

---

← [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
