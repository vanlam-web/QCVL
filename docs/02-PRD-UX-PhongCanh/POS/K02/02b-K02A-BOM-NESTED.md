# 02b-K02A-BOM-NESTED.md — K02-A: LOGIC ĐỆ QUY RÚT GỌN BOM

> **Thuộc khối:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) — Phần IV
>
> **Trở về:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

**Mục tiêu:** Tối giản hóa giao diện POS và tăng tốc độ xử lý đơn hàng bằng cách phân tầng quyền chỉnh sửa:

- **Combo Cấp 1** → được phép mở khoang sửa đổi đầy đủ.
- **Combo Cấp 2** → **Khóa chết** toàn bộ cấu trúc bên trong, chỉ hiển thị phẳng như hàng thường.

---

## Kịch bản 1: Vật tư m² bên trong BOM Cấp 1

Khi một mã vật tư trong BOM Cấp 1 có Đơn vị tính là **m²** (Bạt in, Decal, Tấm Alu cắt lẻ...), dòng đó bắt buộc hiển thị bộ 3 ô nhập kích thước mini để tính tiêu hao thực tế.

**Wireframe vật tư m² trong BOM:**

```
│ ├─┬ 📦 VẬT TƯ CHÍNH (BOM Core) ──────────────────────────────────────────────────────────────────────┤
│ │ ├── [X] Bạt Hiflex 3M xuyên sáng   │ [1.50] × [3.00] × [ 1 ] Tấm  │ = 4.50 m² │ Đơn giá: 120,000/m² │
│ │ └── [X] Khung sắt gia cố hộp 25×25 │ Số lượng: [  4  ] Cây        │           │ Đơn giá: 75,000/Cây │
```

**Quy tắc hiển thị trong BOM:**


| Loại vật tư                  | Giao diện trong BOM                                                 |
| ---------------------------- | ------------------------------------------------------------------- |
| Vật tư có ĐVT là **m²**      | Hiển thị bộ 3 ô `[Rộng] × [Dài] × [SL Tấm]` + `= X.XX m²` (chỉ đọc) |
| Vật tư thường (cây/cái/cuộn) | Hiển thị duy nhất ô `[Số lượng]`                                    |


**Diện tích tiêu hao:** Ô `= X.XX m²` trong BOM tự cập nhật realtime theo `R × D × SL`. Đây là ô chỉ đọc — hiển thị để thu ngân đối chiếu trước khi chốt đơn.

> Công thức trừ kho chi tiết thuộc tầng Business/Backend; file này chỉ mô tả UI tại POS.

---

## Kịch bản 2: Combo Cấp 2 lồng bên trong Combo Cấp 1

**Quy tắc tối giản UI/UX:** Khi một Combo có sẵn được nạp vào làm thành phần con của Combo lớn hơn (VD: Thêm Combo "Hộp Đèn Hút Nổi Tròn" vào Combo "Cụm Biển Mặt Tiền PNJ"), hệ thống coi Combo con là **Hàng hóa thường (Loại 1)** tại màn hình POS:

- Loại bỏ hoàn toàn nút `[🛠️ Sửa BOM]` trên dòng con.
- Không hiển thị cấu trúc cây bên trong.
- Dòng nằm **phẳng hoàn toàn** trong danh sách vật tư.

**Wireframe — Combo Cấp 2 hiển thị phẳng như hàng thường:**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▼ [X] | 01 | COMBO LỚN: Cụm Biển Mặt Tiền PNJ    │ [ 1 ] Cụm   │ 8,500,000 │ 8,500,000 │ [🔒 Đóng BOM]  │
│         • Ghi chú: [ Công trình chi nhánh Trần Hưng Đạo                                               ] │
│ ├─┬ 📦 DANH SÁCH VẬT TƯ GIA CÔNG (BOM) ────────────────────────────────────────────────────────────────│
│ │ ├── [X] Sắt hộp mạ kẽm 20×20         │ Số lượng: [  6  ] Cây       │ Đơn giá: 65,000/Cây              │
│ │ ├── [X] Bạt Hiflex 3M xuyên sáng     │ [1.50] × [3.00] × [ 1 ] Tấm │ = 4.50 m²  │ Đơn giá: 120,000/m² │
│ │ ├── [X] Combo: Hộp Đèn Hút Nổi Tròn │ Số lượng: [  2  ] Cái       │ Đơn giá: 450,000/Cái (🔒 KHOÁ SỬA)│
│ │ └── [➕ Thêm vật tư / Combo phụ] ────────────────────────────────────────────────────────────────────│
│ └─┬ 💾 CƠ CHẾ LƯU ĐỊNH MỨC KHI ĐÓNG ĐƠN  ──────────────────────────────────────────────────────────────│
│   └── Chế độ lưu: (•) Không lưu cụm lớn - Chỉ đơn phát sinh   ( ) Lưu thành một Combo đại biến thể mới  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Quyền chỉnh sửa tại POS (BR-NESTED-REDUCED):**


| Hành vi               | Chi tiết                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Được phép**         | Thay đổi ô `[Số lượng]` của dòng Combo con (VD: Đổi 2 → 3 Cái)                                                       |
| **Bị khóa tuyệt đối** | Không hiển thị nút xem chi tiết. Không cho phép can thiệp vào cấu trúc bên trong của Combo con tại màn hình bán hàng |


**Hành vi khi thanh toán:**

Combo Cấp 2 hiển thị phẳng tại POS — thu ngân thấy 1 dòng. Khi chốt đơn, UI chỉ hiển thị trạng thái xử lý / lỗi trả về từ Backend.

Quy ước lưu và trừ kho:

- Chứng từ lưu combo con như một dòng thành phần và lưu BOM version/snapshot của combo con tại thời điểm bán.
- Với chế độ `Không lưu - Chỉ trừ kho`, combo con dùng BOM chuẩn đang active tại thời điểm chốt đơn.
- Với chế độ `Lưu Combo mới`, combo mới vẫn giữ combo con là thành phần tham chiếu; backend deep-scan combo con khi cần trừ kho.
- Chứng từ cũ không đổi khi BOM của combo con bị sửa sau này.
- Combo không tính tồn riêng. Nếu combo con thiếu vật tư, hệ thống xử lý như thiếu vật tư ở hàng thường: cảnh báo, hiện thiếu theo vật tư thành phần và có thể hiện nút `Khui vật tư` nếu vật tư đó hỗ trợ khui.
- Nếu deep-scan gặp vòng lặp hoặc quá 5 cấp, hệ thống chặn phần trừ kho BOM và báo lỗi cấu hình để sửa, không tự đoán.

> Chi tiết công thức trừ kho thuộc tầng Business/Backend; file này chỉ mô tả UI tại POS.

---

← [Quay về 02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)
