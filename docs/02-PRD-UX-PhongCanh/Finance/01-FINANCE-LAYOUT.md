# FINANCE-LAYOUT — Bố cục tổng thể Tài chính

> **Nguồn tham khảo UI:** KiotViet Sổ quỹ ở viewport desktop.

---

## 1. Mục đích

Module Tài chính giúp nhân viên:

- xem sổ quỹ theo tiền mặt và từng tài khoản ngân hàng
- tạo phiếu thu/chi thủ công
- xem và thu công nợ khách hàng
- đối soát cuối ngày

QC-OMS giữ bố cục quen thuộc từ KiotViet: filter bên trái, vùng dữ liệu chính bên phải, bảng sổ quỹ là bề mặt chính. Điểm khác là QC-OMS dùng màu/spacing chung của dự án và đưa summary sổ quỹ vào cột filter để giữ vùng bảng gọn.

---

## 2. Navigation trong module

| View | Mục đích |
|---|---|
| Sổ quỹ | Xem dòng tiền, tạo phiếu thu/chi thủ công |
| Công nợ | Xem nợ theo khách/hóa đơn, thu nợ; hiện chỉ còn lối tìm nhanh ở header finance, không còn panel riêng trong thân trang |
| Đối soát | Chốt tiền mặt/từng tài khoản cuối ngày |
| Tài khoản quỹ | Quản lý quỹ tiền mặt và tài khoản ngân hàng; hiện không hiển thị panel riêng trong thân trang sổ quỹ |

---

## 3. Bố cục desktop

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top navigation: ... | Sổ quỹ | ...                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sổ quỹ                         [Tìm sổ quỹ +]                  [Phiếu thu] [Phiếu chi] [Xuất] │
├───────────────────────┬────────────────────────────────────────────────────────────────────┤
│ FILTER SIDEBAR        │ TABLE                                                              │
│ Tổng quan             │ Mã phiếu | Thời gian | Loại thu chi | Người nộp/nhận | Quỹ | Giá trị │
│ Quỹ đầu kỳ            │                                                                    │
│ Tổng thu              │                                                                    │
│ Tổng chi              │                                                                    │
│ Tồn quỹ               │                                                                    │
│                       │ Pagination                                                         │
│ Thời gian             │                                                                    │
│ Quỹ tiền              │                                                                    │
│ Loại chứng từ         │                                                                    │
│ Trạng thái            │                                                                    │
│ Hạch toán KQKD        │                                                                    │
└───────────────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 4. Nguyên tắc UX

- Desktop ưu tiên bảng rộng, dễ quét dòng tiền.
- Số tiền thu hiển thị màu dương, số tiền chi hiển thị màu âm.
- Tiền mặt và từng tài khoản ngân hàng phải tách rõ.
- Không gộp toàn bộ chuyển khoản thành một số chung khi đối soát.
- Các bộ lọc hiện tại tự áp dụng khi đổi giá trị, không cần nút `Lọc` hoặc `Đặt lại`.
- Cột filter bên trái chứa summary `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ`; các giá trị này thay đổi theo filter sổ quỹ.
- Vùng thân trang `/finance` chỉ hiển thị bảng sổ quỹ và inline detail/form liên quan. Các panel phụ `Tài khoản quỹ`, `Công nợ khách hàng`, `Phiếu thu/chi` không hiển thị trong thân trang ở UI hiện tại.
- `Tìm sổ quỹ` ở header là ô search nhanh của bảng sổ quỹ, dùng kiểu search chung của các trang quản trị; hỗ trợ bỏ dấu theo mã phiếu, người nộp/nhận, SĐT, ghi chú và tài khoản quỹ. Nút `+` trong ô chỉ hiện khi chưa nhập search; khi có nội dung thì xoay thành `x` để xóa tìm kiếm.
- Phiếu sinh từ POS/thu nợ chỉ xem, không sửa rời.
- Phiếu thu/chi thủ công có thể sửa bằng phiên bản mới, không sửa đè.

---

## 5. Trạng thái chung

| Trạng thái | UI |
|---|---|
| Loading | Skeleton cho summary và bảng |
| Empty | Trạng thái trống trong bảng; nhân viên nội bộ MVP thấy nút tạo phiếu/thao tác finance thường ngày |
| Filter empty | Empty state trong bảng; hiện không có nút xóa bộ lọc chung |
| Permission denied | Chỉ dành cho tài khoản hạn chế đặc biệt hoặc truy cập nhầm vùng quản trị; nhân viên nội bộ MVP mặc định có quyền xem/thao tác finance thường ngày đã mở |
| Error | Banner lỗi, có nút thử lại |

---

## 6. Acceptance Criteria UX

1. Người dùng thấy rõ đang xem `Tổng quỹ` hay từng tài khoản trong filter `Quỹ tiền`.
2. Summary `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ` thay đổi theo bộ lọc tài khoản và thời gian.
3. Phiếu thu/chi thủ công có nút tạo rõ ràng ở header.
4. Phiếu từ POS/thu nợ không có nút sửa rời.
5. Bảng sổ quỹ là bề mặt chính của trang `/finance`; các khối phụ không chen vào thân trang.

---

← [Quay về Finance README](./README.md)
