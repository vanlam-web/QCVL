# 06-CUSTOMER-REPORT — Báo cáo khách hàng

> **Tham khảo:** KiotViet `Phân tích > Khách hàng`, đã lược bỏ kênh bán và nhân khẩu học retail

---

## 1. Mục tiêu

Báo cáo khách hàng giúp chủ xưởng nhìn được khách nào mua nhiều, khách nào quay lại, khách mới/cũ đóng góp ra sao và khách nào cần chăm sóc vì còn nợ hoặc lâu chưa mua.

Đây là báo cáo quản trị bán hàng, không phải CRM marketing/loyalty.

---

## 2. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian | Hôm nay, tuần này, tháng này, tùy chỉnh |
| Nhóm khách | Nếu có |
| Khách hàng | Tìm theo mã, tên, SĐT nếu có |
| Nhân viên bán | Người chốt hóa đơn nếu cần |
| Bảng giá | Bảng giá chung hoặc bảng giá nhóm |

Không có bộ lọc kênh bán, giới tính, độ tuổi, tỉnh thành hoặc chiến dịch marketing trong scope hiện tại.

---

## 3. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Tổng khách mua trong kỳ | Số khách có hóa đơn hoàn thành trong kỳ |
| Khách cũ | Khách đã từng mua trước kỳ và mua lại trong kỳ |
| Khách mới | Khách mua lần đầu trong kỳ |
| Khách lẻ | Hóa đơn gán vào khách mặc định `khachle - Khách lẻ` |
| Doanh thu khách cũ | Doanh thu từ khách cũ |
| Doanh thu khách mới | Doanh thu từ khách mới |
| Doanh thu khách lẻ | Doanh thu từ khách lẻ |
| Khách quay lại | Khách có từ 2 lần mua trở lên trong khoảng phân tích |

---

## 4. Bảng khách hàng

| Cột | Mô tả |
|---|---|
| Mã khách | Link mở Customer Detail |
| Tên khách | Tên khách hiện tại |
| Nhóm khách | Nếu có |
| SĐT | Nếu có |
| Số hóa đơn | Số hóa đơn hoàn thành trong kỳ |
| Doanh thu | Tổng doanh thu trong kỳ |
| Giá trị trung bình | Doanh thu / số hóa đơn |
| Lần mua gần nhất | Ngày hóa đơn gần nhất |
| Công nợ hiện tại | Tổng còn nợ hiện tại |

---

## 5. Top Danh Sách

Nên có:

- top khách theo doanh thu
- top khách theo số hóa đơn
- khách mới trong kỳ
- khách quay lại trong kỳ
- khách lâu chưa mua
- khách có công nợ cao

Không có top theo kênh bán, giới tính, tuổi, tỉnh thành hoặc điểm thưởng.

Quy tắc dữ liệu: báo cáo không dùng nhóm `customer_id = null` cho bán lẻ. Nếu nhân viên không chọn khách khi lưu báo giá/hóa đơn, backend gán chứng từ vào khách mã `khachle`, nên doanh thu, lịch sử và công nợ khách lẻ được cộng về hồ sơ này.

---

## 6. Acceptance Criteria UX

1. Người dùng xem được khách cũ/khách mới/khách lẻ trong một khoảng thời gian.
2. Báo cáo hiển thị doanh thu theo khách và nhóm khách.
3. Bấm mã khách mở Customer Detail.
4. Công nợ hiện tại khớp với báo cáo công nợ.
5. Không có báo cáo tuổi, giới tính, tỉnh thành, kênh bán hoặc loyalty trong scope hiện tại.

---

← [Quay về Reports README](./README.md)
