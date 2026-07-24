# 03-DEBT-REPORT — Báo cáo công nợ khách hàng

> **Nguồn:** Quy tắc công nợ theo hóa đơn trong `POS-CUSTOMER-DEBT.md`

---

## 1. Mục tiêu

Báo cáo công nợ giúp theo dõi khách còn nợ, hóa đơn còn nợ, lịch sử thu nợ và rủi ro nợ kéo dài.

QCVL quản lý công nợ theo từng hóa đơn, không chỉ một số tổng.

---

## 2. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian phát sinh | Ngày hóa đơn hoặc ngày phát sinh công nợ |
| Khách hàng | Mã/tên/SĐT nếu có |
| Nhóm khách | Nhóm khách đang gán |
| Trạng thái nợ | Còn nợ, đã thu đủ |
| Khoảng tiền nợ | Từ/đến |
| Tuổi nợ | Tất cả, quá 7 ngày, quá 15 ngày, quá 30 ngày |

Tuổi nợ có thể để sau nếu chưa cần cảnh báo sâu; bảng vẫn phải hiển thị ngày phát sinh để lọc thủ công.

---

## 3. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Tổng nợ hiện tại | Tổng còn nợ của các hóa đơn chưa thu đủ |
| Số khách còn nợ | Số khách có dư nợ lớn hơn 0 |
| Số hóa đơn còn nợ | Số hóa đơn chưa thu đủ |
| Nợ mới trong kỳ | Công nợ phát sinh từ hóa đơn bán trong kỳ |
| Thu nợ trong kỳ | Tiền thu vào hóa đơn nợ cũ trong kỳ |
| Hóa đơn nợ lâu | Hóa đơn quá ngưỡng ngày đã chọn |
| Tỷ lệ nợ/doanh thu | Giá trị nợ hiện tại so với doanh thu thuần trong kỳ, chỉ để cảnh báo quản trị |

Không có số dư âm/trả trước trong MVP/current scope.

---

## 4. Bảng theo khách

| Cột | Mô tả |
|---|---|
| Mã khách | Link mở Customer Detail |
| Tên khách | Tên hiện tại |
| SĐT | Nếu có |
| Nhóm khách | Nếu có |
| Tổng nợ | Tổng còn nợ |
| Hóa đơn nợ cũ nhất | Mã hóa đơn và ngày phát sinh |
| Số hóa đơn nợ | Đếm hóa đơn còn nợ |
| Thu gần nhất | Ngày/phiếu thu gần nhất |
| Tuổi nợ lớn nhất | Số ngày của hóa đơn nợ cũ nhất |

Bảng này nên hỗ trợ sắp xếp theo:

- tổng nợ nhiều nhất
- tuổi nợ lâu nhất
- tỷ lệ nợ/doanh thu cao nhất nếu dữ liệu đủ

---

## 5. Bảng theo hóa đơn

| Cột | Mô tả |
|---|---|
| Mã hóa đơn | Link sang Sales Documents |
| Khách hàng | Snapshot khách hoặc khách hiện tại tùy màn |
| Ngày bán | Thời điểm checkout |
| Tổng cần trả | Tổng hóa đơn |
| Đã trả | Tổng đã phân bổ vào hóa đơn |
| Còn nợ | Số còn nợ |
| Tuổi nợ | Số ngày từ ngày bán đến hiện tại hoặc ngày lọc |
| Trạng thái | Còn nợ, đã thu đủ, hóa đơn đã hủy |

Nếu hóa đơn bị hủy do sửa chứng từ, công nợ phải khớp giao dịch đảo theo business rule.

---

## 6. Lịch sử thu nợ

Bảng lịch sử gồm:

- mã phiếu thu
- thời gian
- khách hàng
- số tiền thu
- phương thức: tiền mặt hoặc tài khoản ngân hàng
- hóa đơn được phân bổ
- người thu

Phân bổ mặc định vào hóa đơn cũ nhất trước.

---

## 7. Acceptance Criteria UX

1. Người dùng xem được tổng nợ theo khách và theo hóa đơn.
2. Bấm khách mở Customer Detail, bấm hóa đơn mở Sales Document.
3. Báo cáo không tạo hoặc hiển thị khách trả trước/số dư âm.
4. Thu nợ trong kỳ khớp với phiếu thu và Sổ quỹ.
5. Hóa đơn hủy/sửa không làm mất lịch sử công nợ.
6. Báo cáo xem được top khách nợ nhiều nhất và nợ lâu nhất.

---

← [Quay về Reports README](./README.md)
