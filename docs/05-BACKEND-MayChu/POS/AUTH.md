# AUTH — Phân quyền Permission-based Access Control

> **Mốc chốt:** mô hình nền tảng Giai đoạn 0; bổ sung permission theo từng module.
> **Nguồn:** Di chuyển từ `02-PRD-UX-PhongCanh/POS/01-POS-LAYOUT.md` (Section VI)

---

## 1. MÔ HÌNH

| Mô hình | Trạng thái |
|---|---|
| **Role cứng** (Admin / Staff / Manager cố định) | ❌ **KHÔNG dùng** |
| **Permission-based** (tick chọn tính năng cho từng tài khoản) | ✅ **Đang dùng** |

## 1.1. NGUYÊN TẮC MVP 2026-07-01

Permission-based access control vẫn là nền tảng kỹ thuật của Backend, nhưng MVP ưu tiên vận hành đơn giản cho xưởng nhỏ/nội bộ.

Quy tắc:

- User nội bộ mặc định nên có đủ quyền thao tác chính của MVP.
- Các permission nhỏ vẫn tồn tại để backend bảo vệ endpoint và mở rộng sau này.
- Không tạo rule nghiệp vụ phức tạp chỉ vì một permission nhỏ, ví dụ `perm.apply_discount`, nếu Owner chưa chốt kiểm soát riêng.
- UI không nên chia cắt trải nghiệm của nhân viên nội bộ bằng quá nhiều trạng thái thiếu quyền.
- Không dùng thiếu quyền như trạng thái vận hành bình thường cho các thao tác hằng ngày trong MVP.
- Chỉ tách quyền mạnh trong MVP cho:
  - quản lý user/quyền;
  - cấu hình hệ thống;
  - hủy/sửa chứng từ đã chốt hoặc thao tác phá hủy nếu cần kiểm soát riêng;
  - tài chính nhạy cảm nếu Owner chốt riêng.

Nói cách khác: hệ thống vẫn kiểm tra permission, nhưng seed/preset tài khoản nội bộ phải cấp đủ quyền vận hành để người dùng không bị kẹt trong luồng POS/kho/tài chính thường ngày.

---

## 2. QUY TRÌNH TẠO VÀ CẤP QUYỀN

```
Trang Quản lý tài khoản (back-office, ngoài POS)
    ↓
Admin click [Tạo tài khoản mới] hoặc [Sửa tài khoản]
    ↓
Hiển thị form: Email / Tên hiển thị / Mật khẩu ban đầu / ...
    ↓
Chọn preset hoặc tick thủ công:
    ☑ Nhân viên nội bộ - đủ quyền vận hành MVP
    ☐ Chủ xưởng/Quản trị - thêm quản lý user/quyền/cấu hình
    ☐ Hạn chế đặc biệt - admin tự bỏ/tick quyền
    ↓
    Lưu → Backend cập nhật quan hệ user_permissions
```

---

## 3. ĐẶC ĐIỂM KỸ THUẬT

| Đặc điểm | Mô tả |
|---|---|
| **Lưu trữ** | Quan hệ `user_permissions`; schema tại `04-DATABASE/System/AUTH-PERMISSIONS.md` |
| **Số lượng quyền/tài khoản** | Không giới hạn — 1 tài khoản có thể được tick nhiều quyền |
| **Thay đổi quyền** | Áp dụng **realtime** — tài khoản bị bỏ quyền sẽ mất truy cập trong vòng 1 chu kỳ Realtime push |
| **Mặc định khi tạo mới** | MVP nên mặc định preset `Nhân viên nội bộ` có đủ quyền thao tác chính; admin chỉ tinh chỉnh khi cần tài khoản hạn chế |
| **Audit** | Mỗi lần đổi quyền ghi `actor_user_id`, `target_user_id`, before/after, `trace_id`, `created_at` |

> Database Source of Truth: [AUTH-PERMISSIONS.md](../../04-DATABASE/System/AUTH-PERMISSIONS.md). Không ghi dữ liệu ứng dụng trực tiếp vào `auth.users`.

---

## 4. SEED PERMISSIONS — DANH SÁCH QUYỀN KHỞI ĐIỂM

| Mã quyền | Tính năng tương ứng | Khối UI |
|---|---|---|
| `perm.view_shift_report` | Xem báo cáo ca (tiền mặt/CK) | K01 Profile |
| `perm.access_admin_panel` | Truy cập trang Quản lý (back-office) | K01 Profile |
| `perm.create_order` | Tạo đơn hàng mới | K02-A |
| `perm.edit_order_locked` | Sửa đơn đang có khóa tranh chấp | K02-A |
| `perm.apply_discount` | Áp dụng chiết khấu / đổi bảng giá | K03-A |
| `perm.refund_order` | Hoàn tiền / hủy đơn đã thanh toán | K03-D |
| `perm.manage_inventory` | CRUD kho (nhập / xuất / kiểm kê) | Module Kho |
| `perm.manage_finance` | Quản lý sổ quỹ, thu nợ, phiếu thu/chi và đối soát | Module Tài chính |
| `perm.edit_price_book` | Sửa bảng giá sản phẩm | Back-office |
| `perm.manage_users` | Tạo / sửa / xóa tài khoản | Trang Quản lý tài khoản |

> Danh sách trên là **khởi điểm kỹ thuật**. Trong MVP, seed/default user nội bộ nên có hầu hết quyền vận hành chính. Khi phát triển thêm khối chức năng mới, có thể bổ sung mã quyền tương ứng vào bảng seed, nhưng không mặc định biến mỗi mã quyền thành một rào cản vận hành riêng nếu chưa có nhu cầu thực tế.

Preset khuyến nghị:

| Preset | Quyền vận hành |
|---|---|
| Chủ xưởng/Quản trị | Toàn bộ quyền active, gồm quản lý user/quyền và cấu hình hệ thống |
| Nhân viên nội bộ | POS/bán hàng, giảm giá thủ công, xem chứng từ, xem khách hàng/bảng giá/kho/công nợ cơ bản, thao tác kho/tài chính thường ngày trong MVP |
| Hạn chế đặc biệt | Chỉ dùng khi thật sự cần giới hạn tài khoản thuê ngoài/thử việc; admin tự bỏ tick thủ công |

Nếu sau này cần tách `Kế toán/Kho`, preset này chỉ nên dùng để gom nhanh quyền finance/inventory, không biến thành ma trận role phức tạp.

---

## 5. RÀNG BUỘC TRIỂN KHAI UI

- Với tài khoản nội bộ mặc định đủ quyền, UI hiển thị liền mạch các thao tác MVP chính.
- Khi tài khoản hạn chế đặc biệt không có quyền tương ứng → **không render DOM** (không dùng `display:none`) cho nút/tính năng đó, để tránh lộ đường dẫn hoặc logic qua DevTools.
- Phím tắt kích hoạt tính năng không có quyền → chặn sự kiện + Toast cảnh báo `Không có quyền truy cập`.
- Kiểm tra quyền nên đặt trong **Store** (centralized) chứ không rải rác trong component UI.

Backend vẫn phải kiểm tra permission trên mọi endpoint được bảo vệ. Chi tiết API xem [FOUNDATION-API.md](../FOUNDATION-API.md).

Máy trạm được quản lý độc lập với user. Sau khi đăng nhập, user chọn máy trạm active trên thiết bị đang sử dụng; không gán cứng mã máy trạm vào tài khoản.

---

← [Quay về POS README](./README.md)
