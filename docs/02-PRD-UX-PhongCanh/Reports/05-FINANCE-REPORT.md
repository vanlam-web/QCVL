# 05-FINANCE-REPORT — Báo cáo tài chính quản trị

> **Nguồn:** Sổ quỹ, công nợ khách hàng, đối soát cuối ngày

---

## 1. Mục tiêu

Báo cáo tài chính giúp xem dòng tiền và tình hình phải thu ở mức quản trị xưởng.

Đây không phải báo cáo kế toán/thuế. QCVL không làm VAT/HĐĐT/thuế kế toán trong scope hiện tại.

---

## 2. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian | Tháng này, quý này, năm nay và khoảng ngày từ/đến. Không dùng radio `Tùy chỉnh`; khi chuẩn hóa UI thì dùng `ManagementDateRangeInputs`, hai ô ngày luôn hiển thị và icon lịch mở popup bên phải cột filter. |
| Quỹ/tài khoản | Tiền mặt hoặc từng tài khoản ngân hàng |
| Loại thu/chi | Thu bán hàng, thu nợ, thu khác, chi, điều chỉnh |
| Người tạo | Nhân viên tạo phiếu |
| Có hạch toán | Có hạch toán, không hạch toán, tất cả |

Chuyển khoản phải tách theo từng tài khoản ngân hàng.

---

## 3. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Tổng thu | Tiền vào quỹ trong kỳ |
| Tổng chi | Tiền ra quỹ trong kỳ |
| Dòng tiền ròng | Tổng thu - tổng chi |
| Tồn quỹ cuối kỳ | Tiền mặt và từng tài khoản ngân hàng |
| Doanh thu đã thu | Tiền thu từ hóa đơn trong kỳ |
| Thu nợ cũ | Tiền thu vào hóa đơn phát sinh trước kỳ |
| Công nợ khách còn phải thu | Tổng nợ hiện tại |
| Chi phí theo loại | Tổng phiếu chi theo loại chi |

Không gọi là lợi nhuận đầy đủ nếu chưa có giá vốn/chi phí sản xuất đầy đủ.

---

## 4. Bảng Dòng Tiền

| Cột | Mô tả |
|---|---|
| Thời gian | Ngày giờ phát sinh |
| Mã phiếu | Phiếu thu/chi hoặc chứng từ nguồn |
| Loại | Thu bán hàng, thu nợ, thu khác, chi |
| Quỹ/tài khoản | Tiền mặt hoặc ngân hàng |
| Đối tượng | Khách hàng/người nộp/người nhận |
| Thu | Số tiền vào |
| Chi | Số tiền ra |
| Có hạch toán | Có/không |
| Người tạo | Nhân viên |
| Ghi chú | Nếu có |

Bấm mã phiếu mở chi tiết Sổ quỹ.

---

## 5. Biểu đồ

Nên có:

- tổng thu/chi theo ngày hoặc tháng
- dòng tiền ròng theo thời gian
- cơ cấu thu theo tiền mặt/tài khoản ngân hàng
- cơ cấu chi theo loại chi
- công nợ khách còn phải thu theo thời gian

---

## 6. Liên Kết Đối Soát

Báo cáo tài chính lấy số hệ thống từ Sổ quỹ.

Đối soát cuối ngày là nơi nhập số thực tế:

- tiền mặt trong két
- từng tài khoản ngân hàng

Nếu lệch, nhân viên tạo phiếu thu/chi thủ công có lý do; báo cáo không tự điều chỉnh tiền.

---

## 7. Không Làm Trong Scope Hiện Tại

- Báo cáo thuế/VAT/HĐĐT.
- Báo cáo lợi nhuận kế toán đầy đủ.
- Báo cáo công nợ nhà cung cấp nâng cao.
- Khách trả trước/số dư âm.
- Tự động phân loại chi phí kế toán phức tạp.

---

## 8. Acceptance Criteria UX

1. Báo cáo tách tiền mặt và từng tài khoản ngân hàng.
2. Tổng thu/chi khớp với Sổ quỹ trong cùng kỳ.
3. Thu nợ cũ khớp với phân bổ công nợ theo hóa đơn.
4. Bấm mã phiếu mở chi tiết Sổ quỹ.
5. Không hiển thị VAT/HĐĐT/thuế kế toán như tính năng QCVL.

---

← [Quay về Reports README](./README.md)
