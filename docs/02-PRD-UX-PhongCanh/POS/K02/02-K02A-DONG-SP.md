# 02-K02A-DONG-SP.md — K02-A: DÒNG SẢN PHẨM ĐỘNG + BOM (GIỎ HÀNG)

> **Phần:** 2.1
> **Trở về:** [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

## I. THÀNH PHẦN FILE CON


| File | Nội dung |
| ---- | -------- |
| [02a-K02A-SP-THUONG.md](./02a-K02A-SP-THUONG.md) | 3 Trường hợp hiển thị: Hàng thường, Hàng m², Hàng Combo/BOM |
| [02b-K02A-BOM-NESTED.md](./02b-K02A-BOM-NESTED.md) | Logic đệ quy rút gọn: Combo Cấp 1 vs Combo Cấp 2, Deep-Scan khi thanh toán |
| [02c-K02A-M2-KHUI.md](./02c-K02A-M2-KHUI.md) | Cầu nối m² ↔ mét dài/tấm, Khui động, Khui tự do ngoài POS |

---

## II. CHI TIẾT NHANH


### TRƯỜNG HỢP 1: Hàng thường (ĐVT khác m²)

- Ẩn hoàn toàn `[Dài]`, `[Rộng]`, ô diện tích.
- Chỉ hiển thị 1 ô nhập: `[ Số lượng ]`.
- Cộng dồn: cùng mã → `SL + 1`.

→ [Chi tiết](./02a-K02A-SP-THUONG.md#trường-hợp-1-hàng-thường-không-tính-diện-tích-ĐVT-khác-m²)

---

### TRƯỜNG HỢP 2: Hàng m² (ĐVT = m²)

- Hiển thị bộ 3 ô: `[ Rộng ] × [ Dài ] × [ SL ]` + `= X.XX m²` (chỉ đọc).
- Không cộng dồn: mỗi lần chọn sản phẩm m² luôn sinh một dòng mới độc lập.
- Ô `Tổng m²` là chỉ đọc — không cho gõ đè.

→ [Chi tiết](./02a-K02A-SP-THUONG.md#trường-hợp-2-hàng-có-đơn-vị-tính-là-mét-vuông-m²)

---

### TRƯỜNG HỢP 3: Hàng Combo / BOM

- Combo Cấp 1: Bung rộng `[🛠️ Sửa BOM]` — chỉnh vật tư chính/phụ.
- Combo Cấp 2: Hiển thị phẳng, **khoá tuyệt đối** — chỉ sửa SL.
- Cơ chế lưu: `(•) Không lưu — Chỉ trừ kho` | `( ) Lưu Combo mới`

> Ranh giới: **SoT Owner 2026-07-20** — BOM KV `active` dùng ngay; bán combo trừ thành phần, không trừ mã combo. POS chỉnh BOM dòng (`Không lưu` / `Lưu Combo mới`) và deep-scan nhiều cấp = **hướng dài / chưa runtime đầy đủ**. **Runtime chưa khớp SoT** — [BOM README mục 2](../../../03-BUSINESS-NghiepVu/BOM/README.md).

→ [Chi tiết](./02a-K02A-SP-THUONG.md#trường-hợp-3-hàng-combo-/-định-mức-vật-tư-bom)

---

## III. QUY TẮC CHUNG K02-A

1. **Luôn sinh dòng độc lập:** Mỗi bức bạt / in có kích thước khác nhau → không gộp chung dòng.
2. **Cộng dồn thông minh:**
   - Hàng m² (Loại 1): luôn sinh dòng mới độc lập.
   - Hàng thường (Loại 2): cùng mã → cộng SL dòng cũ.
3. **Khoá chết ô diện tích:** Ô `Tổng m²` là chỉ đọc, không cho gõ đè.
4. **Trừ kho khi chốt đơn:** Hàng thường/m²/tấm trừ kho theo Business Inventory. Combo trừ kho theo BOM của dòng hàng (thành phần thôi, không trừ mã combo), gồm BOM active có sẵn hoặc BOM nhân viên vừa thêm/sửa trong POS. *(Backend xử lý — chi tiết thuộc tầng Business / BOM-RULES)*
5. **Tổng giá vật tư kho:** Nếu có hiển thị thì chỉ là tham khảo theo cấu hình BOM hiện có, không phải lợi nhuận kế toán/chốt.
6. **Đệ quy rút gọn — Combo Cấp 1 vs Cấp 2:**
   - **Combo Cấp 1:** Được mở khoang `[🛠️ Sửa BOM]`, chỉnh sửa đầy đủ vật tư chính/phụ.
   - **Combo Cấp 2:** Khoá tuyệt đối — hiển thị phẳng như hàng thường, chỉ cho sửa SL. Không hiện cấu trúc cây, không hiện nút Sửa BOM.
7. **Deep-Scan khi thanh toán:** Combo phẳng cấp 1 trừ thành phần ngay. Deep-scan combo lồng nhau chỉ bật khi BOM nhiều cấp đã có cấu hình, version và chống vòng lặp.
8. **Quy đổi đơn vị:** POS vẫn hiển thị và thu tiền theo `m²`; quy đổi tồn kho thực tế do Backend xử lý.
9. **Tấm lỡ khổ:** PRD chỉ hiển thị cảnh báo / lựa chọn thao tác nếu Backend xác định cần dùng tấm lỡ hoặc tấm nguyên.
10. **Khui vật tư:** Luôn có nút khui thủ công trên Top Bar. Ngoài ra, khi dòng hàng đang nhập kích thước/số lượng bị thiếu vật tư, POS hiện nút `Khui vật tư` ngay trên dòng đó. Nút này chỉ là gợi ý xử lý nhanh, không bắt buộc; nhân viên có thể bỏ qua để lưu báo giá hoặc tiếp tục theo rule cảnh báo tồn âm.
11. **Khui nhanh trên dòng:** Nếu thiếu một vật tư, popup khui mở sẵn vật tư đó. Nếu thiếu nhiều vật tư trong cùng dòng hoặc trong BOM của dòng, popup hiển thị danh sách vật tư thiếu để nhân viên chọn một hoặc nhiều vật tư cần khui. Sau khi khui xong, POS quay lại đúng dòng đang thao tác và kiểm tra tồn lại.

---

← [Quay về K02 Tổng quan](./01-K02-GIO-HANG.md)
