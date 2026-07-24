# 04-INVENTORY-REPORT — Báo cáo hàng hóa và tồn kho

> **Nguồn:** Inventory cuộn/tấm/tấm lỡ của QCVL, không copy tồn tổng m2 của KiotViet

---

## 1. Mục tiêu

Báo cáo hàng hóa/tồn kho giúp kiểm tra tồn, hàng bán nhiều, hàng sắp hết, tồn âm và tình trạng cuộn/tấm vật lý.

Điểm quan trọng của QCVL: báo cáo tồn không chỉ là tổng m2, mà phải xem được cuộn/tấm/tấm lỡ khi cần.

---

## 2. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Thời gian | Khoảng ngày cho doanh thu/bán ra/biến động |
| Nhóm hàng | Nhóm sản phẩm/vật tư |
| Hàng hóa | Mã/tên hàng |
| Loại tồn | normal, roll, sheet |
| Trạng thái hàng | Đang kinh doanh, ngưng bán, tất cả |
| Tồn kho | Còn tồn, hết tồn, tồn âm |

Không có bộ lọc thương hiệu hoặc kênh bán.

---

## 3. Chỉ số tổng quan

| Chỉ số | Mô tả |
|---|---|
| Số mã hàng đang bán | Sản phẩm active |
| Số mã hàng ngưng bán còn tồn | Cần xử lý tồn |
| Sản phẩm tồn âm | Cảnh báo bán vượt tồn |
| Cuộn còn dùng | Số cuộn vật lý còn tồn |
| Tấm/tấm lỡ còn dùng | Số tấm/tấm lỡ trạng thái available |
| Giá trị tồn tham khảo | Chỉ hiển thị nếu giá vốn đủ tin cậy |
| Doanh thu thuần theo hàng | Doanh thu từ hóa đơn hoàn thành trong kỳ |
| Lợi nhuận gộp tham khảo | Chỉ hiển thị nếu giá vốn đủ tin cậy |

Không gọi là lợi nhuận hoặc giá trị tồn kế toán nếu giá vốn/nhập hàng chưa chốt.

---

## 4. Bảng tồn theo sản phẩm

| Cột | Mô tả |
|---|---|
| Mã hàng | Link mở hàng hóa |
| Tên hàng | Tên hiện tại |
| Nhóm hàng | Nếu có |
| Loại tồn | normal, roll, sheet |
| Tồn hiện tại | Tổng tồn |
| Đơn vị tồn | m2, m tới, tấm, cái... |
| Đang bán/Ngưng bán | Trạng thái |
| Bán ra trong kỳ | Số lượng hoặc diện tích đã bán |
| Doanh thu trong kỳ | Theo hóa đơn hoàn thành |
| Cảnh báo | Tồn âm, sắp hết, ngưng bán còn tồn |

---

## 5. Báo cáo cuộn/tấm vật lý

### Cuộn

| Cột | Mô tả |
|---|---|
| Mã cuộn | Link chi tiết |
| Sản phẩm | Vật tư |
| Khổ | Mét |
| Dài còn lại | Mét |
| Diện tích còn lại | m2 |
| Trạng thái | còn dùng, hết, hủy |
| Ghi chú | Nếu có |

### Tấm/tấm lỡ

| Cột | Mô tả |
|---|---|
| Mã tấm | Link chi tiết |
| Loại | tấm nguyên, tấm dở, tấm lỡ |
| Kích thước | rộng x dài |
| Diện tích | m2 |
| Trạng thái | available, used, discarded |
| Nguồn | Đơn/dòng hàng hoặc tạo thủ công |

Tấm lỡ dưới `0.3m2` mặc định bỏ nên không tạo dữ liệu rác trong báo cáo.

---

## 6. Top Hàng Hóa

Nên có:

- top sản phẩm theo doanh thu
- top sản phẩm theo số lượng/diện tích bán
- top nhóm hàng theo doanh thu/số lượng/diện tích bán
- top theo lợi nhuận gộp tham khảo nếu có giá vốn đủ tin cậy
- sản phẩm tồn âm
- sản phẩm ngưng bán còn tồn
- cuộn/tấm tồn lâu không dùng
- tấm lỡ còn tồn cần xử lý

---

## 7. Đối Soát Với Máy Sản Xuất

Trong scope hiện tại, dữ liệu máy sản xuất không tự trừ kho.

Báo cáo chỉ dùng để so sánh:

- OMS/bill đã bán gì
- máy sản xuất có dữ liệu gì nếu đã import/đối soát được
- chênh lệch để nhân viên xem, không tự sửa tồn

Nếu sau này có quy trình match file máy sản xuất với bill đủ chắc, cần spec riêng.

---

## 8. Acceptance Criteria UX

1. Báo cáo xem được tồn theo sản phẩm và theo đối tượng cuộn/tấm.
2. Hàng ngưng bán còn tồn vẫn hiển thị được.
3. Tồn âm được cảnh báo rõ.
4. Không có báo cáo theo thương hiệu/kênh bán.
5. Không gọi là lợi nhuận hoặc giá trị tồn kế toán nếu dữ liệu giá vốn chưa đủ.
6. Top nhóm hàng/hàng hóa theo lợi nhuận gộp chỉ hiển thị như tham khảo khi giá vốn đủ.

---

← [Quay về Reports README](./README.md)
