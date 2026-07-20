# BOM-RULES — Định mức vật tư, combo và trừ kho

> **Vai trò:** Source of Truth nghiệp vụ.
> **Trạng thái docs ↔ code:** xem [README.md](./README.md) mục 2 (rà soát 2026-07-20). File này mô tả **nghiệp vụ phải đạt**, không khẳng định runtime đã xong.
> **Tham khảo:** PRD POS K02-A, export KiotViet `Hàng thành phần`
> **Owner 2026-07-01:** BOM nhiều cấp / snapshot / chỉnh BOM trên POS (hướng dài).
> **Owner 2026-07-20 (chốt lại, hiện hành):** BOM KV dùng ngay; không nháp/duyệt; không sản xuất sẵn; bán combo chỉ trừ thành phần.

---

## 0. Phạm vi slice vs hướng dài

| Nhóm | Nội dung | Trạng thái chốt |
|---|---|---|
| Slice KV + bán combo phẳng | Import `active`, trừ thành phần cấp 1, không trừ mã combo, không sản xuất sẵn, không UI “nháp chờ duyệt” | SoT bắt buộc; **runtime chưa khớp** (README mục 2) |
| Hướng dài | Deep-scan nhiều cấp, snapshot đầy đủ, POS `Không lưu` / `Lưu Combo mới`, validate/preview API | Giữ hướng; **chưa làm** — không block chốt slice KV |

---

## 1. Mục tiêu

BOM giúp QC-OMS biết một sản phẩm/combo cần tiêu hao những vật tư nào khi bán hàng.

Ví dụ:

```text
In bạt = bạt + mực in + keo dán + khuy bạt
Khung sắt bắn bạt = In bạt + khung sắt
```

BOM **có thể** lồng nhiều cấp (hướng dài). Slice hiện tại đủ khi bán combo phẳng cấp 1 trừ đúng thành phần.

---

## 2. BOM không phải công thức giá bán

### BR-BOM-01: Giá bán độc lập với BOM

Giá bán theo bảng giá / nhóm khách / giá sửa trên dòng. BOM không ép giá bán bằng tổng giá vật tư.

### BR-BOM-02: Tổng chi phí BOM chỉ là tham khảo nếu hiển thị

Nếu UI hiện tổng chi phí vật tư, đó là số tham khảo — không phải lợi nhuận kế toán chuẩn khi Purchase/giá vốn chưa đủ.

---

## 3. Loại BOM

### BR-BOM-03: BOM chuẩn trên sản phẩm/combo

Sản phẩm/combo có BOM hiện hành (`active`) để dùng lại. Sửa BOM chuẩn → version mới. Chứng từ cũ giữ snapshot/version đã dùng.

### BR-BOM-04: BOM phát sinh trên dòng POS *(hướng dài — chưa runtime đầy đủ)*

| Chế độ | Quy tắc |
|---|---|
| Không lưu - Chỉ trừ kho | Mặc định. BOM chỉ trong snapshot chứng từ |
| Lưu Combo mới | Tạo combo mới kèm BOM chuẩn |

Không tự tạo combo mới nếu người dùng không chọn `Lưu Combo mới`.

---

## 4. BOM nhiều cấp *(hướng dài — chưa runtime)*

### BR-BOM-05 / BR-BOM-06 / BR-BOM-07

- Thành phần có thể là vật tư lá hoặc combo/sản phẩm có BOM con.
- Checkout deep-scan về vật tư lá; chống vòng lặp; mặc định tối đa 5 cấp; lỗi cấu hình thì không âm thầm bỏ nhánh.
- POS chỉ mở sửa cấp đang mở; combo con hiển thị phẳng.

**Slice hiện tại:** trừ theo BOM phẳng cấp 1 (danh sách `product_bom_items` của BOM đang dùng). Không yêu cầu deep-scan để nghiệm thu slice KV 2026-07-20.

---

## 5. Trừ kho theo BOM

### BR-BOM-08: Có BOM thì trừ theo BOM *(bắt buộc slice hiện tại)*

Khi hóa đơn được chốt:

```text
Dòng combo/sản phẩm có BOM đang dùng
  -> lấy thành phần (cấp 1 trong slice hiện tại; deep-scan khi phase nhiều cấp)
  -> tạo stock movement theo từng vật tư thành phần
  -> KHÔNG tạo stock-out theo mã combo
```

**Owner 2026-07-20:**

- Combo không quản lý tồn riêng.
- Chỉ trừ hàng thành phần.
- Không sản xuất sẵn trong phạm vi này.

Vật tư `roll`/`sheet` vẫn trừ theo Inventory (không trừ tổng `m2` gộp nếu đã quản lý vật lý).

Thiếu vật tư thành phần: cảnh báo theo rule tồn âm; có thể gợi ý `Khui vật tư`; không bắt buộc khui.

### BR-BOM-09: Thiếu BOM không chặn bán trong MVP

Cho checkout + cảnh báo/flag để bổ sung BOM sau.

### BR-BOM-10: Tồn âm vật tư theo Inventory

Giống hàng thường: cảnh báo, vẫn cho tiếp nếu rule MVP cho phép tồn âm.

---

## 6. Snapshot chứng từ *(hướng dài — bắt buộc khi làm đủ BOM trên POS/checkout)*

### BR-BOM-11

Mỗi dòng hóa đơn có BOM nên lưu nguồn BOM, version (nếu chuẩn), danh sách thành phần và định mức đã nhân. Mục tiêu: sửa BOM sau không đổi hóa đơn cũ.

Slice KV tối thiểu: trừ đúng theo BOM đang dùng tại thời điểm bán; snapshot đầy đủ là hướng dài nếu chưa có bảng/payload.

---

## 7. Import từ KiotViet *(bắt buộc slice hiện tại)*

Parse cột `Hàng thành phần` (ví dụ `DCS:0.6|F5:0.3`) thành `product_bom_items`. Không dùng text gốc làm schema chính.

### Quyết định Owner 2026-07-20

- Import xong → `product_boms.status = active`.
- Không duyệt/kích hoạt lại trước khi trừ kho.
- Thiếu mã thành phần → skip BOM đó (`bom_skipped_rows`), không tạo nửa vời.
- Import lại cùng mã → archive BOM KV cũ của mã đó, tạo version mới `active`.
- UI/API không copy “BOM nháp / cần rà soát” cho BOM KV.
- Field API có thể vẫn tên `draft_bom` (tương thích); nghĩa = metadata BOM đang dùng.

> Lịch sử: trước 2026-07-20 doc yêu cầu `draft` rồi duyệt. **Đã superseded.** Runtime rà soát 2026-07-20 vẫn còn ghi `draft` — xem README mục 2; phải sửa khi triển khai.

---

## 8. Acceptance Criteria

### Slice KV + bán combo phẳng (nghiệm thu khi Owner bảo làm code)

- [ ] Import KV → BOM `active`.
- [ ] Migrate/promote BOM KV `draft` cũ → `active` (hoặc archive + import lại).
- [ ] Bán combo: chỉ trừ thành phần; không trừ mã combo / tôn trọng `track_inventory = false`.
- [ ] UI không còn “BOM nháp / cần rà soát” cho BOM KV; `draft_bom` nghĩa = BOM đang dùng.
- [ ] Không yêu cầu activate sau import KV; không sản xuất sẵn.
- [ ] BOM thiếu không chặn checkout MVP (có cảnh báo).
- [ ] Giá bán không bị ép bởi tổng BOM.

### Hướng dài (không block slice trên)

- [ ] Version BOM chuẩn; sửa tạo version mới.
- [ ] Snapshot BOM trên chứng từ.
- [ ] POS `Không lưu` / `Lưu Combo mới`.
- [ ] Deep-scan, chống vòng lặp, max 5 cấp.
- [ ] Cuộn/tấm trong BOM trừ theo tồn vật lý khi model kho đã sẵn.

---

← [README BOM](./README.md)
