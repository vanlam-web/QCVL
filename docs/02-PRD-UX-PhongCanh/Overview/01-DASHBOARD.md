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

Không hiển thị `trả hàng` vì QCVL không làm trả hàng bán trong scope hiện tại. KPI chính chỉ giữ các số có trong nghiệp vụ đang dùng, ví dụ `Doanh thu` và `Doanh thu thuần`.

KPI `Kết quả bán hàng` dùng bộ lọc thời gian riêng, mặc định chọn `Tháng này`. Hàng KPI trên cùng có 3 ô ngang:

- `Hôm nay`: ô xem nhanh doanh thu và số hóa đơn trong ngày; bấm vào ô này tự chuyển bộ lọc `Kết quả bán hàng` về `Hôm nay`.
- `Doanh thu`: doanh thu và số hóa đơn theo bộ lọc đang chọn.
- `Doanh thu thuần`: phần trăm tăng/giảm so với kỳ trước tương ứng với bộ lọc đang chọn.

Bộ lọc KPI, biểu đồ doanh thu, top hàng bán chạy và top khách mua nhiều nhất không đồng bộ lẫn nhau; mỗi khối giữ thời gian riêng và khi đổi thời gian thì dữ liệu của đúng khối đó phải tải lại.

---

## 4. Khối Phân Tích Nhanh

Dashboard có thể có:

- doanh thu theo ngày/giờ/thứ trong khoảng lọc, ưu tiên biểu đồ cột có lưới ngang, nhãn tiền căn đúng với chiều cao cột và cột bo đầu giống thanh ngang xếp hạng
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

Trên desktop, chiều cao tổng của cột phải phải lấy cột nội dung bên trái làm chuẩn. Nội dung hoạt động bên phải không được làm giãn Dashboard hoặc kéo cao cột trái; phần dư phải cuộn bên trong danh sách hoạt động. Lần tải đầu của tab `Giao dịch` lấy khoảng `20` hoạt động gần nhất để vừa chiều cao thực tế của khung hiện tại, sau đó khi cuộn tới cuối danh sách mới tải thêm từng lô `20` hoạt động. Nếu hệ thống có nhiều dữ liệu hơn thì danh sách tiếp tục phân trang theo cơ chế này.

Khối hoạt động có 2 tab: `Giao dịch` và `Hệ thống`. `Giao dịch` lấy từ hóa đơn bán và phiếu nhập/mua đã ghi nhận. Mỗi dòng ghi rõ: `tên hiển thị tài khoản` + hành động bán/mua + `cho/từ` + `khách hàng/NCC` + `trị giá` + `số tiền` + `theo` + `mã chứng từ`. Tên khách hàng/NCC và mã chứng từ là link, luôn có dấu cách trước/sau link để không dính chữ. Số tiền hiển thị màu chữ trắng, đậm và không tách dòng. `Hệ thống` dùng cho nhật ký thêm/sửa/xóa sau này và có thể trống nếu dữ liệu hiện tại là dữ liệu import chưa có log thao tác.

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

KiotViet Dashboard có các phần không đưa vào QCVL hiện tại:

- trả hàng
- theo dõi chấm công
- thiết lập ca làm việc/chấm công
- vay vốn
- widget marketing/khuyến mại dịch vụ ngoài
- kênh bán online
- COD/giao hàng/vận đơn

QCVL chỉ giữ dashboard vận hành xưởng: bán hàng, tiền, công nợ, tồn kho, hoạt động gần đây và cảnh báo.

---

## 7. Acceptance Criteria UX

1. Người dùng xem được doanh thu, thực thu, công nợ mới và số hóa đơn hôm nay.
2. Dashboard có top hàng bán chạy và top khách mua nhiều khi có dữ liệu.
3. Dashboard có hoạt động gần đây và link mở chứng từ liên quan.
4. Dashboard không hiển thị chấm công, vay vốn, trả hàng, COD, vận đơn hoặc kênh bán online.
5. Các số trên Dashboard phải khớp với Reports/Finance/Sales Documents cùng khoảng thời gian.

---

← [Quay về Overview README](./README.md)
