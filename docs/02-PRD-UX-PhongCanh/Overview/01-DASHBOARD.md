# 01-DASHBOARD — Tổng quan vận hành

> **Tham khảo:** KiotViet `Tổng quan`

---

## 1. Mục tiêu

Dashboard giúp quản lý nhìn nhanh:

- hôm nay bán được bao nhiêu
- tiền đã thu và còn nợ ra sao
- hàng nào bán chạy
- khách nào mua nhiều
- nhân viên nào đang có doanh thu
- hoạt động bán hàng gần đây
- cảnh báo tồn kho/công nợ quan trọng

Dashboard chỉ hiển thị tóm tắt và lối tắt. Số chi tiết nằm ở Reports, Sales Documents, Finance, Inventory và Customers.

---

## 2. Bố Cục

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Dashboard không có nav con; module đi qua top navigation chung              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Doanh thu hôm nay | Doanh thu thuần | Cảnh báo bảo mật                         │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Doanh thu thuần dạng sóng     │ Hoạt động gần đây sticky                     │
│ Top hàng bán chạy             │ Dòng thời gian vận hành                      │
│ Top khách mua nhiều           │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 3. Chỉ Số Tổng Quan

| Chỉ số | Quy tắc |
|---|---|
| Doanh thu hôm nay | Tổng hóa đơn hoàn thành trong ngày |
| Thực thu hôm nay | Tiền thực thu trong ngày từ POS/thu nợ |
| Công nợ mới | Phần hóa đơn hôm nay chưa thu đủ |
| Số hóa đơn | Hóa đơn hoàn thành trong ngày |
| Tồn âm | Số mặt hàng/object tồn đang âm cần kiểm tra |
| Hóa đơn sửa/hủy | Số chứng từ sửa/hủy gần đây cần rà |

Không hiển thị `trả hàng` vì QC-OMS không làm trả hàng bán trong scope hiện tại. KPI chính chỉ giữ các số có trong nghiệp vụ đang dùng, ví dụ `Doanh thu` và `Doanh thu thuần`.

---

## 4. Khối Phân Tích Nhanh

Dashboard có thể có:

- doanh thu theo ngày/giờ trong khoảng lọc, ưu tiên chart dạng sóng/line hiện đại kèm gridline, điểm dữ liệu và cột tóm tắt theo thứ
- top hàng bán chạy theo doanh thu hoặc số lượng/diện tích
- top khách mua nhiều
- doanh thu theo người bán
- danh sách hóa đơn/phiếu thu gần đây
- cảnh báo công nợ lâu ngày
- cảnh báo sản phẩm tồn âm hoặc sắp hết

Các khối này phải có link mở sang báo cáo hoặc danh sách chi tiết tương ứng.

---

## 5. Hoạt Động Gần Đây

Hoạt động gần đây hiển thị các sự kiện vận hành quan trọng và nằm ở cột phải dạng sticky trên desktop. Cột phải phải căn đỉnh ngang với thẻ KPI bên trái; vì Dashboard nằm trong `app-content` scroll container nên sticky `top` chỉ dùng khoảng cách nội dung, không cộng lại chiều cao topbar. Khi cuộn dashboard, khối này giữ vị trí để người quản lý luôn thấy dòng thời gian mới nhất.

- bán hóa đơn
- thu tiền/thu nợ
- phiếu chi thủ công
- sửa/hủy chứng từ
- kiểm kho/cân bằng kho
- cảnh báo máy sản xuất nếu phase production queue đã có

Mỗi dòng hoạt động cần có:

- thời gian
- người thao tác
- loại hoạt động
- mã chứng từ hoặc đối tượng liên quan
- số tiền/số lượng nếu có

Bấm mã chứng từ mở đúng màn chi tiết.

---

## 6. Không Làm Theo KiotViet

KiotViet Dashboard có các phần không đưa vào QC-OMS hiện tại:

- trả hàng
- theo dõi chấm công
- thiết lập ca làm việc/chấm công
- vay vốn
- widget marketing/khuyến mại dịch vụ ngoài
- kênh bán online
- COD/giao hàng/vận đơn

QC-OMS chỉ giữ dashboard vận hành xưởng: bán hàng, tiền, công nợ, tồn kho, hoạt động gần đây và cảnh báo.

---

## 7. Acceptance Criteria UX

1. Người dùng xem được doanh thu, thực thu, công nợ mới và số hóa đơn hôm nay.
2. Dashboard có top hàng bán chạy và top khách mua nhiều khi có dữ liệu.
3. Dashboard có hoạt động gần đây và link mở chứng từ liên quan.
4. Dashboard không hiển thị chấm công, vay vốn, trả hàng, COD, vận đơn hoặc kênh bán online.
5. Các số trên Dashboard phải khớp với Reports/Finance/Sales Documents cùng khoảng thời gian.

---

← [Quay về Overview README](./README.md)
