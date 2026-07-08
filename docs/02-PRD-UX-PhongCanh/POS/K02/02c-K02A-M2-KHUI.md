# 02c-K02A-M2-KHUI.md — K02-A: Cầu nối m2 ↔ mét dài/tấm

> **Thuộc khối:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) — Phần V
>
> **Trở về:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

**Bài toán gốc:** POS có thể bán theo `m2`, nhưng kho vật lý cần trừ theo mét dài của cuộn hoặc kích thước tấm/tấm lỡ.

> **Source of Truth khui vật tư:** [K01/01d-K01-KHUI.md](../K01/01d-K01-KHUI.md). File này chỉ mô tả cách POS tính và gợi ý vật tư khi bán hàng.

---

## 1. Bản đồ quy đổi dữ liệu (Data Mapping)

| Loại hàng | Nhập kho (Đầu vào) | Bán ra tại POS (Đầu ra) | Cơ chế trừ kho thực tế (Ngầm) |
|---|---|---|---|
| **Khổ dài** (Bạt, Decal, PP) | Theo Mét dài (`m`) của từng khổ rộng cụ thể. VD: Cuộn khổ 3.2m dài 80m; Cuộn khổ 1.52m dài 50m. | Theo `m²` = `Rộng × Dài × SL` | Trừ theo **mét dài di động** của cuộn đang khui có khổ tương ứng. Không trừ `m²` tổng. |
| **Tấm** (Alu, Mica, Formex) | Theo tấm nguyên/tấm dở/tấm lỡ. Khổ thao tác MVP dùng dạng đơn giản như `1.2m x 2.4m`. | Theo `m2` hoặc kích thước tùy chọn. | Ưu tiên tấm lỡ/tấm dở phù hợp. Nếu không vừa, đề xuất dùng tấm nguyên và sinh phần thừa nếu còn dùng được. |

---

## 2. Thuật toán tự động chọn khổ & tính diện tích mặc định

Khi nhân viên nhập kích thước tại POS, hệ thống tự động thực hiện chuỗi toán ngầm để đưa ra Khổ cuộn hoặc Cách cắt tấm tối ưu (hao hụt ít nhất).

---

### 2a. Đối với hàng Khổ dài (Bạt, Decal, PP)

**Bước 1 — Cộng biên:**
Lấy kích thước khách đặt cộng biên vật liệu theo quy định:

```
W_phôi = W_khách + 0.10 m   (Bạt: +10cm)
W_phôi = W_khách + 0.05 m   (Decal: +5cm)
```

**Bước 2 — Quét khổ tối ưu:**
Hệ thống quét các khổ cuộn đang có hoặc tồn tạm đã biết của mã hàng đó. Ví dụ: `1.52m`, `2.2m`, `3.2m`.

**Bước 3 — Chọn mặc định:**
Lọc ra các khổ cuộn có `Khổ rộng cuộn ≥ W_phôi` (hoặc `L_phôi` nếu xoay chiều file). Trong các khổ đủ điều kiện, khổ nào có **phần thừa chiều rộng nhỏ nhất** sẽ được hệ thống tự động chọn làm mặc định.

**Bước 4 — Trừ kho mét dài:**
Khi đơn/lệnh được xác nhận trừ kho, hệ thống ưu tiên trừ vào cuộn vật lý đã chuẩn hóa. Nếu mặt hàng còn ở trạng thái tồn tạm KiotViet, hệ thống cảnh báo nhẹ và ghi log theo rule tồn tạm.

```
Chiều dài còn lại mới = chiều dài còn lại cũ - L_phôi
```

---

### 2b. Đối với hàng Tấm (Alu, Mica, Formex)

**Bước 1 — Ưu tiên Tấm lỡ:**
Hệ thống vào **Kho tấm lỡ khổ** để tìm các mẩu Alu/Mica thừa từ các lần cắt trước xem có tấm nào chứa vừa kích thước khách đặt không. Nếu có nhiều tấm vừa, chọn tấm có **diện tích nhỏ nhất** để tiêu thụ đồ thừa trước.

**Bước 2 — Sử dụng Tấm nguyên:**
Nếu kho tấm lỡ không có mẩu nào vừa, hệ thống đề xuất dùng tấm nguyên theo khổ thao tác đang cấu hình, ví dụ `1.2m x 2.4m`.

**Bước 3 — Bóc tách sinh mẩu thừa:**
Khi cắt, hệ thống tính phần còn lại và hiển thị kích thước đề xuất. Nếu phần còn lại quá nhỏ, hệ thống chỉ đề xuất bỏ bằng checkbox; nhân viên được giữ lại nếu thực tế còn dùng được.

---

## 3. Cảnh báo thiếu vật tư và gợi ý khui

Cảnh báo xuất hiện khi vật tư đang chọn không đủ hoặc tồn vật lý chưa chuẩn hóa.

POS không tự khui vật tư. Khi hệ thống tính toán thấy thiếu vật tư, UI chỉ hiện cảnh báo và nút `Khui vật tư` trên dòng hàng đang thao tác. Nhân viên có thể bấm để xử lý ngay hoặc bỏ qua, đặc biệt khi chỉ đang lập báo giá.

---

| Tình huống | Xử lý |
|---|---|
| Vật tư phụ cần khui mới | Hiện nút `Khui vật tư`; nếu bấm thì mở popup khui, phần dở/cũ về `0`, không tạo cuộn/tấm |
| Cuộn/tấm đang dùng không đủ | Hiển thị cảnh báo đỏ nhẹ trên dòng hàng hoặc lệnh sản xuất; hiện nút `Khui vật tư` nếu có vật tư phù hợp để khui |
| Có cuộn/tấm khác phù hợp | Đề xuất phương án tốt nhất, nhân viên được đổi |
| Không có object vật lý phù hợp nhưng còn tồn tạm | Cho tiếp tục theo rule tồn âm/tồn tạm, đồng thời gợi ý mở `Khui vật tư` |
| Cần ghi nhận cuộn/tấm mới | Mở luồng khui tại [K01/01d-K01-KHUI.md](../K01/01d-K01-KHUI.md) |
| Một dòng thiếu nhiều vật tư | Nút `Khui vật tư` mở danh sách vật tư thiếu; nhân viên chọn một hoặc nhiều vật tư để khui |

---

## 4. Vị trí nút Khui vật tư

**Vị trí thủ công:** Thanh công cụ đỉnh (Top Bar) — cố định, hiển thị cho mọi người dùng xưởng.

**Vị trí gợi ý nhanh:** Ngay trên dòng hàng POS đang thiếu vật tư, gần cảnh báo tồn. Nút chỉ xuất hiện khi hệ thống đã tính ra vật tư thiếu và có thể gợi ý khui.

Sau khi nhân viên xác nhận khui, POS quay lại đúng dòng hàng trước đó, cập nhật tồn/cảnh báo và giữ nguyên dữ liệu đang nhập.

Wireframe chuẩn nằm tại [K01/01-K01-TOPBAR.md](../K01/01-K01-TOPBAR.md). Popup khui chuẩn nằm tại [K01/01d-K01-KHUI.md](../K01/01d-K01-KHUI.md).

---

← [Quay về 02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)
