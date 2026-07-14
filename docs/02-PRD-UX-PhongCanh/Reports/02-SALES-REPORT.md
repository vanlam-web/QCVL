# 02-SALES-REPORT — Báo cáo bán hàng

> **Tham khảo:** KiotViet `Báo cáo > Bán hàng`, `Báo cáo > Nhân viên`, đã lược bỏ kênh bán/VAT/trả hàng/HR

---

## 1. Mục tiêu

Báo cáo bán hàng giúp xem doanh thu, hóa đơn, khách hàng và hiệu suất bán theo thời gian.

QC-OMS chỉ dùng luồng bán đứt qua POS/checkout, nên báo cáo không có kênh bán, vận đơn, COD, trả hàng hoặc HĐĐT.

---

## 2. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian | Hôm nay, hôm qua, tuần này, tháng này và khoảng ngày từ/đến. Không dùng radio `Tùy chỉnh`; khi chuẩn hóa UI thì dùng `ManagementDateRangeInputs`, hai ô ngày luôn hiển thị và icon lịch mở popup bên phải cột filter. |
| Khách hàng | Tìm theo mã/tên/SĐT nếu có |
| Nhân viên bán | Người chốt hóa đơn |
| Người tạo | Người tạo chứng từ |
| Bảng giá | Bảng giá chung hoặc bảng giá nhóm |
| Trạng thái | Hoàn thành, Đã hủy, Sửa từ chứng từ cũ |

Không có bộ lọc kênh bán, giao hàng, COD, VAT/HĐĐT hoặc trả hàng.

---

## 3. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Doanh thu | Tổng giá trị hóa đơn hoàn thành theo thời điểm checkout |
| Số hóa đơn | Số hóa đơn hoàn thành |
| Giá trị trung bình | Doanh thu / số hóa đơn |
| Khách đã trả | Tổng tiền đã thu theo hóa đơn trong kỳ |
| Công nợ mới | Phần hóa đơn còn nợ phát sinh trong kỳ |
| Hóa đơn sửa/hủy | Số chứng từ bị hủy do sửa hoặc hủy thủ công |
| Doanh thu theo nhóm hàng | Tổng doanh thu theo nhóm hàng trong kỳ |
| Lợi nhuận gộp tham khảo | Chỉ hiển thị khi dữ liệu giá vốn đủ tin cậy |

Doanh thu không chờ khách trả đủ tiền. Phần chưa thu được theo dõi ở công nợ.

Lợi nhuận gộp nếu hiển thị chỉ là tham khảo quản trị, không phải lợi nhuận kế toán chuẩn cho tới khi Purchase, phương pháp giá vốn và chi phí sản xuất được chốt.

---

## 4. Biểu đồ

MVP nên có:

- doanh thu theo ngày trong khoảng lọc
- số hóa đơn theo ngày
- tỷ lệ đã thu ngay và còn nợ

Sau MVP có thể bổ sung:

- doanh thu theo giờ
- doanh thu theo nhân viên bán
- doanh thu theo nhóm khách/bảng giá
- top nhóm hàng theo doanh thu
- top hàng hóa theo doanh thu/số lượng

Doanh thu theo nhân viên chỉ là góc nhìn báo cáo bán hàng theo người chốt hóa đơn. Không dùng báo cáo này để mở module hoa hồng, bảng lương hoặc KPI nhân sự trong MVP.

KiotViet có `Báo cáo nhân viên` riêng với mối quan tâm bán hàng và bộ lọc người bán/kênh bán. QC-OMS không tách màn này trong scope hiện tại; nếu cần xem theo người bán thì dùng bộ lọc/biểu đồ tại Báo cáo bán hàng.

---

## 5. Bảng chi tiết hóa đơn

| Cột | Mô tả |
|---|---|
| Mã hóa đơn | Link sang Sales Documents |
| Thời gian | Thời điểm checkout |
| Khách hàng | Snapshot khách tại thời điểm bán |
| Người bán | Nhân viên chốt |
| Bảng giá | Bảng giá đã áp dụng |
| Tổng tiền hàng | Trước giảm/điều chỉnh |
| Giảm giá | Nếu có |
| Khách cần trả | Tổng phải thu |
| Khách đã trả | Tiền đã thu cho hóa đơn |
| Còn nợ | Phần còn lại |
| Trạng thái | Hoàn thành, Đã hủy |

Hóa đơn đã sửa theo `MaCu.01` phải truy vết được mã gốc và mã sửa.

---

## 6. Top Danh Sách

Nên có các bảng tóm tắt:

- top khách hàng theo doanh thu
- top khách hàng còn nợ mới trong kỳ
- top sản phẩm/dịch vụ theo doanh thu
- top sản phẩm/dịch vụ theo số lượng
- top nhóm hàng theo doanh thu
- danh sách hóa đơn lớn
- danh sách hóa đơn còn nợ

Không có top theo kênh bán hoặc thương hiệu.

---

## 7. Acceptance Criteria UX

1. Người dùng lọc được báo cáo bán hàng theo khoảng ngày dài.
2. Doanh thu tính theo hóa đơn hoàn thành, không phụ thuộc đã thu đủ tiền.
3. Báo cáo hiển thị rõ khách đã trả và còn nợ.
4. Hóa đơn sửa/hủy trong kỳ không bị mất khỏi audit.
5. Bấm mã hóa đơn mở chi tiết chứng từ.
6. Không có bộ lọc/cột kênh bán, COD, HĐĐT hoặc trả hàng.
7. Nếu hiển thị lợi nhuận gộp, UI phải ghi rõ là tham khảo khi giá vốn chưa chốt đầy đủ.
8. Không có báo cáo nhân viên riêng phục vụ lương, hoa hồng hoặc KPI.

---

← [Quay về Reports README](./README.md)
