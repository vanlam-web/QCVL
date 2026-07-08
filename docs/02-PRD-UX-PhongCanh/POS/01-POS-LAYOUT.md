# 01-POS-LAYOUT.md — BẢN ĐỒ TỔNG THỂ MÀN HÌNH BÁN HÀNG (POS MASTER BLUEPRINT)

> **Phần:** 2.1

---

## I. MẶT BẰNG TỔNG THỂ (GLOBAL GRID — CỐ ĐỊNH 1 LUỒNG BÁN)

Loại bỏ hoàn toàn dải nút đáy cũ của KiotViet (Bán thường, Bán nhanh, Bán giao hàng). Toàn bộ màn hình POS khóa cứng cho một luồng bán duy nhất, chia làm 3 dải ngang cố định:

```
================================================================================================
[ K01: THANH ĐIỀU HƯỚNG ĐỈNH & ĐA NHIỆM TABS (Top Bar) — Trải dài 100% chiều ngang]
================================================================================================
|| K02: KHỐI GIỎ HÀNG & ĐIỀU PHỐI MÁY TRẠM (~65%)| K03: KHỐI ĐỐI TÁC & CHỌN SẢN PHẨM (~35%)     |
||-----------------------------------------------|----------------------------------------------|
|| [K02-A] Giỏ hàng động — Tính m² & Bung Combo  | [K03-A] Hồ sơ đối tác & Bộ lọc bảng giá      |
|| [K02-B] Ghi chú tổng toàn đơn hàng            | [K03-B] Nhắc bổ sung SĐT KH (Tự ẩn 8s)       |
|| [K02-C] Bộ đếm tổng m² & Tiền (Realtime)      | [K03-C] Lưới chọn nhanh sản phẩm (3 cột)     |
||-----------------------------------------------|----------------------------------------------|
|| [K02-D] Hàng đợi máy sản xuất (IN BẠT/DECAL/CNC)   [K03-D] [BÁO GIÁ] / [THANH TOÁN] (F9)  |
================================================================================================
```

**Nguyên tắc cốt lõi:** Đây là "bộ khung xương" cố định. Khi triển khai, chỉ cần dựng Layout (CSS Grid/Flexbox) chuẩn chỉnh trước, sau đó đổ ruột tính năng vào từng khối bên trong.

---

## II. VAI TRÒ VÀ THÀNH PHẦN CHI TIẾT TỪNG KHỐI

---

### K01 — THANH ĐIỀU HƯỚNG ĐỈNH & ĐA NHIỆM TABS (Top Bar)

- **Vị trí:** Trải dài 100% chiều ngang, cố định sát mép trên cùng của giao diện.
- **Vai trò:** Trung tâm điều phối đa nhiệm, quản lý luồng làm việc tổng quan của nhân viên thu ngân tại quầy.
- **Cấu tạo:** **Trái** — Ô tìm kiếm nhanh (`F3`); **Giữa** — Dải Tab đa hóa đơn; **Phải** — Lịch sử, Đèn Realtime, Hồ sơ nhân viên.

> 📄 **Tài liệu chi tiết logic:** [01-K01-TOPBAR.md](./K01/01-K01-TOPBAR.md)

---

### K02 — KHỐI GIỎ HÀNG & ĐIỀU PHỐI MÁY TRẠM (Bên Trái ~65%)

> **Vai trò:** Khu vực làm việc nặng nhất — tập trung toàn bộ logic tính toán quy cách ngành in và điều phối sản xuất dưới xưởng.

📄 **[Tổng quan K02 — Logic tiếp nhận sản phẩm](./K02/01-K02-GIO-HANG.md)**

| Khối con | File |
|---|---|
| K02-A + K02-C: Giỏ hàng động & Bộ đếm tổng | [02-K02A-DONG-SP.md](./K02/02-K02A-DONG-SP.md) |
| K02-B: Ghi chú đơn hàng tổng | [03-K02B-GHI-CHU.md](./K02/03-K02B-GHI-CHU.md) |
| K02-D: Hàng đợi máy sản xuất | [04-K02D-HANG-DOI.md](./K02/04-K02D-HANG-DOI.md) |

---

### K03 — KHỐI ĐỐI TÁC & CHỌN SẢN PHẨM NHANH (Bên Phải ~35%)

> **Vai trò:** Quản lý thông tin khách hàng, chọn nhanh dịch vụ phổ biến và kích hoạt chốt dòng tiền.

| Khối con | File |
|---|---|
| K03-A: Hồ sơ đối tác & Bộ lọc giá | [01-K03A-DOI-TAC.md](./K03/01-K03A-DOI-TAC.md) |
| K03-B: Nhắc bổ sung SĐT KH (Toast) | [02-K03B-TOAST.md](./K03/02-K03B-TOAST.md) |
| K03-C: Lưới chọn nhanh sản phẩm (3 cột) | [03-K03C-LUOI-SP.md](./K03/03-K03C-LUOI-SP.md) |
| K03-D: Báo giá / Thanh toán | [04-K03D-THANH-TOAN.md](./K03/04-K03D-THANH-TOAN.md) |

---

## III. LUỒNG ĐI CỦA ĐƠN HÀNG (Đọc để hiểu hệ thống chạy thế nào)

> *Để hiểu cách các khối phối hợp với nhau, hãy xem quy trình xử lý một đơn hàng thực tế tại xưởng Văn Lâm.*

**Bước 1 — Tiếp nhận từ xưởng:**
Máy in/cắt dưới xưởng gửi thông báo file mới, `K02-D` nhấp nháy báo có file chờ. Thu ngân mở danh sách tên file, chọn icon `+` để đưa vào hóa đơn nháp hoặc icon thùng rác để hủy; hệ thống chỉ parse dữ liệu khi đưa vào hóa đơn nháp.

**Bước 2 — Định danh khách hàng:**
Thu ngân gõ tìm khách hàng ở `K03-A` (`F4`). Nếu khách thiếu SĐT, `K03-B` hiện nhắc bổ sung; nhấp vào cảnh báo để nhập nhanh. Cấu hình gửi tin nhắn/bill nằm trong hồ sơ khách hàng, không dùng Toast.

**Bước 3 — Gia công cấu trúc Combo:**
Đơn phức tạp cần biển bảng nhiều thành phần — thu ngân click dòng sản phẩm tại `K02-A` để bung form Combo, bóc nhanh mã Keo, Vít, Led từ bộ lọc Vật tư phụ.

**Bước 4 — Chốt đơn & Gửi bill:**
Thu ngân bấm `BÁO GIÁ` để lưu mã `BG...` và gửi giá cho khách, hoặc bấm `THANH TOÁN` (`F9`) tại `K03-D` để chốt bán. Khi thanh toán, hệ thống trừ kho, lưu quỹ nếu có tiền thực thu, sinh bill theo các mẫu đã chọn và mở nơi gửi nếu khách đã bật cấu hình gửi tin nhắn hợp lệ.

---

## IV. DANH MỤC THAM CHIẾU FILE CHI TIẾT

| Khối | Tên gọi nghiệp vụ | File |
|---|---|---|
| K01 | Thanh đỉnh — Tạo tab đơn mới, phím tắt tìm kiếm (`F3`), tiện ích hệ thống | [01-K01-TOPBAR.md](./K01/01-K01-TOPBAR.md) |
| K02-A | Giỏ hàng động — Công thức tính m², form nhập ĐVT, giao diện Combo/BOM | [02-K02A-DONG-SP.md](./K02/02-K02A-DONG-SP.md) |
| K02-B | Ghi chú tổng toàn đơn hàng | [03-K02B-GHI-CHU.md](./K02/03-K02B-GHI-CHU.md) |
| K02-C | Bộ đếm tổng m² & tiền realtime | [02-K02A-DONG-SP.md](./K02/02-K02A-DONG-SP.md) |
| K02-D | Hàng đợi máy sản xuất — Danh sách tên file, nhập vào hóa đơn nháp / hủy thông báo | [04-K02D-HANG-DOI.md](./K02/04-K02D-HANG-DOI.md) |
| K03-A | Hồ sơ đối tác — Tìm/thêm KH (`F4`), áp bảng giá và chiết khấu | [01-K03A-DOI-TAC.md](./K03/01-K03A-DOI-TAC.md) |
| K03-B | Bong bóng Toast — Pop-over nhập nhanh SĐT khách hàng | [02-K03B-TOAST.md](./K03/02-K03B-TOAST.md) |
| K03-C | Lưới chọn nhanh sản phẩm (3 cột + phân trang) | [03-K03C-LUOI-SP.md](./K03/03-K03C-LUOI-SP.md) |
| K03-D | Báo giá / Thanh toán — Lưu `BG...`, trừ kho, sổ quỹ, bill và cấu hình gửi tin | [04-K03D-THANH-TOAN.md](./K03/04-K03D-THANH-TOAN.md) |

---

## V. Tham chiếu kỹ thuật liên quan

*   **Quy tắc cấu trúc code (Architecture Code Rules):** [→ ARCHITECTURE.md](../../05-BACKEND-MayChu/POS/ARCHITECTURE.md)
*   **Cơ chế phân quyền (Permission-based Access Control):** [→ AUTH.md](../../05-BACKEND-MayChu/POS/AUTH.md)

---

← [Quay về POS README](./README.md)

← [Quay về 02-PRD-UX-PhongCanh README](../README.md)
