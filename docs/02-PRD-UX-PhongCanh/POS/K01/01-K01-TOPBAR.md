# 01-K01-TOPBAR.md — K01: THANH ĐỈNH & ĐA NHIỆM (TOP BAR)

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. SƠ ĐỒ KHUNG GIAO DIỆN PHÂN KHU (UI WIREFRAME)

Top Bar được chia thành **4 khu vực**, mỗi khu vực có chức năng và hành vi riêng biệt:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Khu vực 1               │ Khu vực 2                          │ Khu vực 3          │ Khu vực 4          │
│ ────────────────        │ ───────────────────────            │ ────────────────   │ ───────────────    │
│ [ 🔍 Tìm hàng (F3) ]    │ [‹] [Hóa đơn 1 ✕] [Hóa đơn 2 ✕] [+] │ [🍾 KHUI VẬT TƯ] │  🕒🟢[🔄] [👤]   │
├─────────────────────────┼────────────────────────────────────┼────────────────────┼────────────────────┤
│ II.1 — Search           │ II.2 — Tab Đa HĐ                  │ II.3 — Khui VT     │ II.4 — Tiện ích   │
└─────────────────────────┴────────────────────────────────────┴────────────────────┴────────────────────┘
```

---

## II. THÀNH PHẦN VÀ LOGIC XỬ LÝ CHI TIẾT


| Mục  | Tên                                            | File con                                                       |
| ---- | ---------------------------------------------- | -------------------------------------------------------------- |
| II.1 | Khu vực 1 — Ô Tìm Kiếm F3 & Dropdown           | [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)             |
| II.2 | Khu vực 2 — Thanh Tab Đa Hóa Đơn & Cuộn Ngang  | [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)             |
| II.3 | Khu vực 3 — Nút Khui Vật Tư (Global Action)    | [01d-K01-KHUI.md](./01d-K01-KHUI.md)                           |
| II.4 | Khu vực 4 — Cụm Tiện Ích, Trạng thái & Profile | [01b-K01-PROFILE-SHORTCUTS.md](./01b-K01-PROFILE-SHORTCUTS.md) |


---

## III. CHI TIẾT TỪNG KHU VỰC (TỔNG QUAN)

### Khu vực 1 — Ô Tìm Kiếm F3

- Focus nhanh bằng phím `F3`
- Tìm: hàng hóa, combo, vật tư
- Chi tiết: → [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)

### Khu vực 2 — Thanh Tab Đa Hóa Đơn

- Chuyển đổi giữa nhiều hóa đơn cùng lúc
- Cuộn ngang khi số tab vượt viewport
- Chi tiết: → [01a-K01-SEARCH-TABS.md](./01a-K01-SEARCH-TABS.md)

### Khu vực 3 — Nút Khui Vật Tư

- **Vị trí:** Cố định trên Top Bar, giữa Khu vực 2 và Khu vực 4
- **Tầm với:** Hiển thị trên mọi màn hình POS
- **Mục đích:** Khui vật tư phụ về `0`, khui một cuộn/tấm mới hoặc ghi nhận phần cuộn/tấm cũ còn lại để chuẩn hóa kho dần.
- **Người dùng:** Thu ngân, thợ in, thợ CNC, quản lý kho
- Chi tiết đầy đủ: → [01d-K01-KHUI.md](./01d-K01-KHUI.md)

### Khu vực 4 — Cụm Tiện Ích, Trạng thái & Profile

- 🕒 Lịch sử 10 đơn gần nhất
- 🟢🔴🟡 Đèn trạng thái kết nối Supabase
- [🔄] Nút tải lại cứu hộ (không phải đồng bộ nghiệp vụ)
- [👤] Profile — dropdown: Xem báo cáo ca / Trang Quản lý / Đăng xuất
- Chi tiết: → [01b-K01-PROFILE-SHORTCUTS.md](./01b-K01-PROFILE-SHORTCUTS.md)

---

## IV. MA TRẬN PHÍM TẮT ĐIỀU KHIỂN

Bảng phím tắt được định nghĩa tại [01b-K01-PROFILE-SHORTCUTS.md](./01b-K01-PROFILE-SHORTCUTS.md) — file này là Source of Truth; §IV chỉ tham chiếu để tránh trùng lặp.

---

## V. KIẾN TRÚC DỮ LIỆU LIÊN KẾT (SUPABASE MAPPING REFERENCE)

→ Xem chi tiết: [01c-K01-ARCH-SAFETY.md](./01c-K01-ARCH-SAFETY.md)

---

## VI. QUY TẮC KHÓA LỖI VÀ AN TOÀN DỮ LIỆU (EDGE CASES & SAFETY)

→ Xem chi tiết: [01c-K01-ARCH-SAFETY.md](./01c-K01-ARCH-SAFETY.md)

---

← [Quay về Master Map](../01-POS-LAYOUT.md)
