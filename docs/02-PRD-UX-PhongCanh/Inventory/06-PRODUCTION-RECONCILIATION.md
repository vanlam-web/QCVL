# 06-PRODUCTION-RECONCILIATION.md — Đối soát máy sản xuất

> **Vai trò:** Source of Truth UI cho lát cắt read-only đầu tiên.
> **Business:** [PRODUCTION-RECONCILIATION.md](../../03-BUSINESS-NghiepVu/Inventory/PRODUCTION-RECONCILIATION.md)

---

## 1. Mục tiêu

Màn đối soát máy sản xuất giúp quản lý xem nhanh:

```text
Máy sản xuất thực tế có thông báo/file gì
vs
QCVL đã có hóa đơn/bill gì
```

MVP chỉ hiển thị chênh lệch để kiểm tra. Màn này không tự tạo hóa đơn, không tự trừ kho, không tự match file với bill và không tự sửa tồn kho.

---

## 2. Vị trí UI

Đề xuất đặt trong module Kho/Hàng hóa hoặc Báo cáo nội bộ:

```text
Kho -> Đối soát máy sản xuất
```

Không đặt trong POS K02-D để POS vẫn nhẹ. K02-D chỉ là hàng đợi thao tác nhanh, còn màn này dành cho quản lý rà soát theo ngày.

---

## 3. Bộ lọc

| Bộ lọc | Mô tả |
|---|---|
| Thời gian | Mặc định hôm nay; cho chọn khoảng dài hạn |
| Máy sản xuất | Tất cả, In bạt, In decal, CNC, hoặc máy cấu hình trong hệ thống |
| Khách hàng | Tìm theo mã/tên nếu dữ liệu parse được hoặc bill có khách |
| Hàng hóa | Tìm theo mã/tên nếu dữ liệu parse được hoặc bill có hàng |
| Trạng thái đối soát | Tất cả, lệch tăng, lệch giảm, thiếu bill, thiếu máy, lỗi parse |

Nếu tháng/ngày hiện tại không có dữ liệu, empty state phải nói rõ `Không có dữ liệu trong khoảng lọc`, không kết luận là hệ thống lỗi.

---

## 4. Bảng đối soát tổng hợp

Lát cắt đầu tiên dùng bảng tổng hợp, không làm match từng file với từng dòng bill.

Nhóm dữ liệu mặc định:

```text
ngày + máy sản xuất + mã khách + mã hàng + kích thước
```

Cột đề xuất:

| Cột | Mô tả |
|---|---|
| Ngày | Ngày nhận thông báo máy hoặc ngày hóa đơn |
| Máy | Tên máy sản xuất |
| Khách | Mã/tên khách nếu có |
| Hàng hóa | Mã/tên hàng nếu có |
| Kích thước | Dài x rộng nếu có |
| SL máy | Tổng số lượng từ thông báo máy |
| m2 máy | Tổng m2 từ thông báo máy |
| SL bill | Tổng số lượng từ hóa đơn |
| m2 bill | Tổng m2 từ hóa đơn |
| Lệch m2 | `m2 máy - m2 bill` |
| File lỗi | Số thông báo parse lỗi hoặc thiếu kích thước |
| Gợi ý | Text ngắn: `Có máy chưa có bill`, `Có bill chưa thấy máy`, `Lệch m2` |

Quy tắc hiển thị:

- dòng lệch chỉ đổi màu nhẹ, không nhấp nháy
- số âm/dương phải có dấu rõ ràng
- không dùng màu làm tín hiệu duy nhất; luôn có text gợi ý
- click dòng mở drawer chi tiết

---

## 5. Drawer chi tiết

Drawer chi tiết hiển thị hai cột song song:

```text
Thông báo máy sản xuất | Hóa đơn QCVL
```

Thông báo máy sản xuất:

- thời gian nhận
- máy
- tên file gốc
- trạng thái queue: `queued`, `added_to_draft`, `dismissed`
- parse status: `ok`, `error`, `pending`
- payload parse nếu có: khách, hàng, dài/rộng, số lượng, m2

Hóa đơn QCVL:

- mã hóa đơn `HD...`
- thời gian checkout
- khách hàng
- dòng hàng liên quan
- kích thước/số lượng/m2 theo snapshot hóa đơn

Drawer chỉ để xem. Không có nút `Gắn với bill`, `Tạo hóa đơn`, `Trừ kho`, `Sửa tồn` trong lát cắt này.

---

## 6. Empty và cảnh báo

| Tình huống | UI |
|---|---|
| Không có dữ liệu | `Không có dữ liệu trong khoảng lọc` |
| Có thông báo máy nhưng không parse được | Hiển thị dòng lỗi parse, vẫn xem được tên file gốc |
| Có bill nhưng không thấy máy | Hiển thị trong nhóm `thiếu máy`, không tự tạo queue |
| Có máy nhưng không thấy bill | Hiển thị trong nhóm `thiếu bill`, không tự tạo hóa đơn |

---

## 7. Không làm trong lát cắt đầu

- không auto-match file với bill
- không nút xác nhận match thủ công
- không tạo/sửa/hủy hóa đơn từ màn đối soát
- không tạo stock movement
- không sửa tồn kho
- không tính thưởng/phạt nhân viên sản xuất
- không dashboard sản xuất thay thế phần mềm máy sản xuất

---

## 8. Acceptance Criteria

- Xem được tổng m2 máy và m2 bill theo khoảng ngày.
- Lọc được theo máy sản xuất và trạng thái lệch.
- Dòng lỗi parse vẫn hiện tên file gốc để kiểm tra.
- Chi tiết hiển thị được danh sách thông báo máy và hóa đơn liên quan theo nhóm tổng hợp.
- Không có thao tác nào làm thay đổi hóa đơn, queue item, tồn kho, tiền hoặc công nợ.
