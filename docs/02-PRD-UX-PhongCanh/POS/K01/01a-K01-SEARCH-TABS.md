# 01a-K01-SEARCH-TABS.md - K01: Tìm hàng F3 và tab hóa đơn

> Thuộc: [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
> Cập nhật: 2026-07-08.

## 1. Tìm hàng F3

Ô tìm hàng là control chính ở góc trái POS.

Hành vi:

- `F3` focus vào ô và bôi đen text hiện có.
- Tìm theo mã hàng hoặc tên hàng/dịch vụ.
- Hỗ trợ tìm không dấu.
- Không hỗ trợ QR/barcode trong phạm vi POS hiện tại.
- Không tạo nhanh hàng hóa từ dropdown POS.
- Thêm hàng vào tab hóa đơn đang active khi nhân viên chọn kết quả.

Visual:

- Dùng `.management-compact-search` để cùng ngôn ngữ với ô tìm kiếm ở các trang quản lý.
- Có icon tìm kiếm đầu ô.
- Có thể có nút `+` cuối ô nếu sau này mở luồng tạo ở module hàng hóa; nút phải có `aria-label`.
- Không tạo CSS riêng cho border/radius/shadow nếu shared rule đã có.

## 2. Dropdown kết quả

Dropdown xuất hiện ngay dưới ô F3.

Nội dung mỗi dòng:

| Cột | Nội dung |
| --- | --- |
| 1 | Mã hàng + tên hàng |
| 2 | Đơn vị tính |
| 3 | Tồn hiện tại hoặc `-` |
| 4 | Giá bán |

Quy định:

- Không có ảnh sản phẩm.
- Không có footer `+ Thêm mới hàng hóa`.
- Không tự tạo sản phẩm mới khi không có kết quả.
- Empty state: `Không tìm thấy hàng hóa phù hợp`.
- Dòng active/hover phải thấy rõ trên light/dark.

## 3. Tab hóa đơn

Mỗi tab là một hóa đơn nháp độc lập:

- Giỏ hàng.
- Khách hàng.
- Bảng giá/chiết khấu.
- Ghi chú.
- Trạng thái thanh toán nháp nếu đã mở drawer nhưng chưa chốt.

Mở POS:

- Nếu có nháp của máy hiện tại thì khôi phục.
- Nếu không có nháp thì mở `Hóa đơn 1`.

Tạo tab:

- Bấm `+`.
- Dùng số nhỏ nhất còn trống.
- Tối đa 10 tab bán mới đang mở.

Đóng tab:

- Tab trống đóng ngay.
- Tab có dữ liệu phải xác nhận.
- Thanh toán thành công thì đóng tab vừa thanh toán; nếu không còn tab thì tạo lại `Hóa đơn 1`.

## 4. Tràn tab

Khi tab nhiều hoặc tên dài:

- Vùng tab co giãn giữa search và tiện ích.
- Có điều hướng/scroll ngang.
- Active tab tự cuộn vào vùng nhìn thấy.
- Nút `+` cần còn dễ thấy trên desktop.

## 5. Phạm vi lưu trữ

File này chỉ quy định UX. Cơ chế lưu nháp bằng localStorage/IndexedDB/API/DB thuộc tài liệu kiến trúc và backend.
