# 01-END-OF-DAY — Báo cáo cuối ngày

> **Tham khảo:** KiotViet `Báo cáo > Cuối ngày`

---

## 1. Mục tiêu

Báo cáo cuối ngày giúp đối chiếu nhanh bán hàng, tiền thu và biến động quỹ trong một ngày hoặc một khoảng thời gian ngắn.

Màn này phục vụ thao tác cuối ngày:

```text
Tiền mặt hệ thống = tiền mặt trong két
Từng tài khoản ngân hàng = số thực tế trên app ngân hàng
```

Báo cáo cuối ngày là báo cáo động theo dữ liệu hiện tại. Nếu hóa đơn, phiếu thu/chi, công nợ hoặc chứng từ sửa/hủy được cập nhật hợp lệ, số liệu báo cáo thay đổi theo. QCVL hiện tại không có thao tác khóa ngày/chốt báo cáo thành bản bất biến.

---

## 2. Bố cục

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Báo cáo cuối ngày                                      [Xuất file] [In]      │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc               │ Tổng quan                                             │
│ - Thời gian          │ Doanh thu | Thực thu | Công nợ mới | Thu nợ | Chi     │
│ - Khách hàng         │                                                       │
│ - Nhân viên bán      │ Bảng chi tiết theo ngày/chứng từ/phương thức          │
│ - Người tạo          │                                                       │
│ - Phương thức TT     │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian | Hôm nay, hôm qua, tuần này, tháng này và khoảng ngày từ/đến. Không dùng radio `Tùy chỉnh`; khi chuẩn hóa UI thì dùng `ManagementDateRangeInputs`, hai ô ngày luôn hiển thị và icon lịch mở popup bên phải cột filter. |
| Khách hàng | Tìm theo mã, tên, SĐT nếu có |
| Nhân viên bán | Lọc người bán trên hóa đơn |
| Người tạo | Lọc người tạo chứng từ |
| Phương thức TT | Tiền mặt, từng tài khoản ngân hàng |

Không có bộ lọc kênh bán, VAT/HĐĐT hoặc phương thức bán hàng retail.

---

## 4. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Doanh thu | Tổng hóa đơn hoàn thành theo thời điểm bán, không tính chứng từ đã hủy |
| Thực thu | Tổng tiền thực nhận trong kỳ từ POS và phiếu thu |
| Tiền mặt | Tổng tiền mặt thu/chi trong kỳ |
| Chuyển khoản | Tách theo từng tài khoản ngân hàng |
| Công nợ mới | Phần hóa đơn phát sinh còn nợ trong kỳ |
| Thu nợ cũ | Tiền thu cho các hóa đơn nợ trước kỳ |
| Tổng chi | Phiếu chi có hạch toán và không hạch toán, tùy bộ lọc |
| Sửa/hủy chứng từ | Số chứng từ sửa theo `MaCu.01` hoặc bị hủy trong kỳ |

---

## 5. Bảng chi tiết

Tối thiểu có các nhóm dòng:

- bán hàng theo hóa đơn
- thu tiền hóa đơn
- thu nợ
- phiếu thu thủ công
- phiếu chi thủ công
- chứng từ sửa/hủy

Cột tối thiểu:

| Cột | Mô tả |
|---|---|
| Thời gian | Ngày giờ phát sinh |
| Mã chứng từ | Hóa đơn, phiếu thu/chi, hoặc mã sửa/hủy |
| Loại | Bán hàng, thu nợ, thu khác, chi, sửa/hủy |
| Khách/đối tượng | Khách hàng, người nộp/nhận, hoặc ghi chú |
| Phương thức | Tiền mặt hoặc tài khoản ngân hàng |
| Thu | Số tiền vào quỹ |
| Chi | Số tiền ra quỹ |
| Công nợ | Số nợ phát sinh hoặc giảm |
| Người tạo | Nhân viên tạo chứng từ |

---

## 6. Liên Kết Đối Soát

Từ báo cáo cuối ngày, người dùng có thể mở/tạo phiên đối soát cho cùng khoảng thời gian.

Báo cáo chỉ hiển thị số hệ thống. Màn `Đối soát` là nơi nhập số thực tế trong két và từng tài khoản ngân hàng.

Nếu có lệch, nhân viên xử lý bằng phiếu thu/chi thủ công có lý do; báo cáo không tự tạo phiếu điều chỉnh.

Đối soát không khóa số báo cáo cuối ngày. Sau khi sửa dữ liệu liên quan, người dùng xem lại báo cáo sẽ thấy số mới và lịch sử chứng từ sửa/hủy để truy vết.

---

## 7. Khác KiotViet

KiotViet có các cột như thu khác, làm tròn, phí trả hàng, VAT và phương thức bán hàng.

QCVL MVP:

- giữ `thu khác` nếu đi qua phiếu thu thủ công
- giữ làm tròn nếu POS có làm tròn tiền
- bỏ phí trả hàng vì không làm trả hàng bán trong MVP
- bỏ VAT/HĐĐT/thuế kế toán
- bỏ kênh bán/phương thức bán hàng retail

---

## 8. Acceptance Criteria UX

1. Người dùng xem được báo cáo hôm nay và chọn được khoảng ngày từ/đến.
2. Báo cáo tách tiền mặt và từng tài khoản ngân hàng.
3. Số thực thu khớp được với Sổ quỹ trong cùng kỳ.
4. Công nợ mới và thu nợ cũ khớp với công nợ theo hóa đơn.
5. Chứng từ sửa/hủy trong ngày được hiển thị để kiểm tra.
6. Người dùng mở được hóa đơn hoặc phiếu thu/chi từ dòng báo cáo.
7. Báo cáo là dữ liệu động; sửa/hủy/chỉnh chứng từ hợp lệ làm số báo cáo cập nhật theo.
8. Không có nút khóa ngày/chốt báo cáo trong QCVL hiện tại.
