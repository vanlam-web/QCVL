# 01c-K01-ARCH-SAFETY.md — K01: Kiến Trúc & An Toàn Dữ Liệu

> **Thuộc khối:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) — Mục IV và V
>
> **Trở về:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) | [Master Map](../01-POS-LAYOUT.md)

---

## IV. KIẾN TRÚC DỮ LIỆU LIÊN KẾT

| Nội dung liên kết | Mục đích | Chi tiết |
|---|---|---|
| Hồ sơ người dùng | Lấy thông tin nhân viên session | [→ POS-TABLES.md §3](../../../04-DATABASE/Sales/POS-TABLES.md#3-bảng-authusers--người-dùng-supabase-auth) |
| Danh mục sản phẩm | Gọi danh sách sản phẩm F3 | [→ POS-TABLES.md §4](../../../04-DATABASE/Sales/POS-TABLES.md#4-bảng-publicproducts--sản-phẩm) |
| Hàng đợi máy sản xuất | Lắng nghe sự kiện máy sản xuất → K02-D | [→ POS-TABLES.md §11](../../../04-DATABASE/Sales/POS-TABLES.md#11-ranh-giới-production-queue) |

---

## V. QUY TẮC KHÓA LỖI VÀ AN TOÀN DỮ LIỆU (EDGE CASES & SAFETY)

| Nội dung | Chi tiết |
|---|---|
| LocalStorage persistence, debounce 300ms, key `pos.session.v1` | [→ ARCHITECTURE.md §2](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#2-persistence--lưu-trữ-local-chống-sập-nguồn) |
| Khóa tranh chấp khi nhiều người cùng sửa đơn | [→ ARCHITECTURE.md §3](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#3-concurrency-lock--khóa-đơn-tranh-chấp) |
| Tab scroll, quy tắc không lưu scroll position | [→ ARCHITECTURE.md §4](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#4-tab-overflow--xử-lý-tràn-dải-tab) |

> Logic thực thi chi tiết thuộc tầng Backend / code triển khai.

---

← [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
