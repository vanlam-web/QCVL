# POS-ORDER-CALC — Quy tắc tính toán giỏ hàng

> **Nguồn:** Di chuyển từ `02-PRD-UX-PhongCanh/POS/K02/01-K02-GIO-HANG.md` (Section II–III) và `02-PRD-UX-PhongCanh/POS/K02/02-K02A-DONG-SP.md` (Loại 1/2/3)

---

## 1. PHÂN LOẠI SẢN PHẨM THEO ĐƠN VỊ TÍNH

### 1.1. Khi chọn sản phẩm

Khi nhân viên ấn `Enter` tại ô tìm kiếm `K01` hoặc click vào sản phẩm ở lưới `K03`, hệ thống chèn một dòng mới (Row) vào vùng `K02-A`, phân loại tự động theo Đơn vị tính (ĐVT) của sản phẩm đó.

---

### BR-CALC-01: Phân loại sản phẩm theo ĐVT

| Điều kiện | Loại | ĐVT |
|---|---|---|
| ĐVT thuộc nhóm: `m²`, `mét vuông` | **Loại 1** | `m²` |
| ĐVT thuộc nhóm: `Cái`, `Bộ`, `Cuộn`, `Mét dài`, `Kg`, `Lít` | **Loại 2** | `Cái` |
| Sản phẩm là **Combo / BOM** (biển bảng quảng cáo nhiều thành phần) | **Loại 3** | `Combo` |

---

## 2. LOẠI 1 — SẢN PHẨM TÍNH THEO m²

### 2.1. Điều kiện áp dụng

Sản phẩm có Đơn vị tính thuộc nhóm: `m²`, `mét vuông`.

**Ví dụ:** In bạt, Decal, PP, Canvas, laminate, backdrop.

### 2.2. Công thức tính

| Trường | Công thức |
|---|---|
| Tổng m² | `Rộng (m) × Dài (m) × SL (Tấm)` |
| Thành tiền | `Tổng m² × Đơn giá` |

### 2.3. Giá trị mặc định

Khi dòng nhảy ra:

| Ô nhập | Mặc định |
|---|---|
| Rộng (m) | `1` |
| Dài (m) | `1` |
| SL (Tấm) | `1` |

Con trỏ chuột tự động focus vào ô `[Rộng (m)]`.

### 2.4. Quy tắc cộng dồn dòng trùng

### BR-CALC-02: Không cộng dồn cho sản phẩm m²

> Hệ thống **luôn luôn sinh dòng mới độc lập**.

**Lý do nghiệp vụ:** Mỗi bức bạt / tấm in có kích thước khác nhau. Nếu cộng dồn vào một dòng, sẽ mất thông tin kích thước riêng biệt của từng bức. Mỗi kích thước phải là một dòng độc lập.

---

## 3. LOẠI 2 — SẢN PHẨM TÍNH THEO Cái / Bộ / Cuộn / Mét dài

### 3.1. Điều kiện áp dụng

Sản phẩm có Đơn vị tính thuộc nhóm: `Cái`, `Bộ`, `Cuộn`, `Mét dài`, `Kg`, `Lít`.

**Ví dụ:** Standee, khuyến mãi, keo, thanh nhôm, bạt cuộn.

### 3.2. Công thức tính

| Trường | Công thức |
|---|---|
| Thành tiền | `SL × Đơn giá` |

### 3.3. Giá trị mặc định

Khi dòng nhảy ra:

| Ô nhập | Mặc định |
|---|---|
| SL | `1` |

Con trỏ chuột tự động focus vào ô `[SL]`.

### 3.4. Quy tắc cộng dồn dòng trùng

### BR-CALC-03: Cộng dồn +1 SL khi chọn trùng

> Nếu sản phẩm **đã có** trong giỏ hàng, chọn lại sẽ **tự cộng +1** vào SL dòng cũ, **không sinh dòng mới**.

**Lý do nghiệp vụ:** Các sản phẩm tính theo Cái/Bộ thường có quy cách đồng nhất (cùng size, cùng mẫu). Khách hàng mua nhiều cái cùng loại → chỉ cần tăng SL, không cần tách dòng.

---

## 4. LOẠI 3 — COMBO / BOM

### 4.1. Điều kiện áp dụng

Sản phẩm là **Combo / Biển bảng quảng cáo** — có nhiều thành phần (vật tư chính + vật tư phụ).

**Ví dụ:** Biển hiệu Alu, bảng quảng cáo LED, standee nhiều thành phần.

### 4.2. Cấu trúc Combo

| Thành phần | Mô tả |
|---|---|
| **Tên định danh Combo** | Ô nhập tùy biến (VD: "Biển hiệu Alu PNJ") |
| **Vật tư chính (BOM Core)** | Chọn BOM có sẵn / thêm BOM mới |
| **Vật tư phụ (Accessories)** | Keo, Vít, Led, khung nhôm... |
| **Cơ chế lưu** | `[ ] Không lưu — Chỉ trừ kho` / `[ ] Lưu Combo mới` |

Trong MVP, Combo trước hết là dòng bán hàng có snapshot. Khi nhân viên thêm/sửa BOM ngay trong POS, BOM đó trở thành định mức của riêng dòng hàng để trừ kho khi chốt hóa đơn.

- **Không lưu — Chỉ trừ kho:** lưu BOM trong snapshot chứng từ và dùng để trừ kho cho hóa đơn đó, không tạo combo mới.
- **Lưu Combo mới:** lưu cấu trúc BOM thành một combo mới trong danh mục để lần sau chọn lại.

Combo phẳng cấp 1: **SoT** BOM active trừ thành phần (Owner 2026-07-20). Deep-scan nhiều cấp = hướng dài. **Runtime chưa khớp** — [BOM README](../BOM/README.md) mục 2.

---

## 5. BỘ ĐẾM TỔNG (K02-C)

### 5.1. Tổng m² in

> Cộng dồn tất cả diện tích (m²) từ các dòng **Loại 1** trong K02-A.

`Tổng m² = Σ (R × D × SL) của mọi dòng Loại 1`

### 5.2. Tổng tiền hàng

> Cộng dồn tất cả Thành tiền từ **mọi dòng** (Loại 1 + Loại 2 + Loại 3).

`Tổng tiền = Σ Thành tiền của mọi dòng`

### 5.3. Cập nhật

Bộ đếm cập nhật **tự động** mỗi khi thêm / sửa / xóa dòng trong K02-A.

---

← [Quay về Sales README](./README.md)
