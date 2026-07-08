# STOCKTAKE — Nghiệp vụ kiểm kho

> **Phạm vi:** Phiếu kiểm kho, cân bằng kho, phiếu tự động khi sửa tồn trong Hàng hóa

---

## 0. Căn cứ KiotViet

KiotViet được dùng làm tham khảo nghiệp vụ, nhưng QC-OMS không sao chép 100%.

Quan sát ngày `01/07/2026`:

- Màn `Kiểm kho` mặc định `Tháng này` có thể báo không có giao dịch.
- Khi mở rộng khoảng `01/07/2016 - 01/07/2026`, có `332 giao dịch`.
- Nhiều phiếu có ghi chú `Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa:<Mã hàng>`.

Kết luận nghiệp vụ cho QC-OMS:

- Kiểm kho là nghiệp vụ lõi, không xếp vào nhóm bỏ/lược như các màn trả hàng/xuất nội bộ ít dữ liệu.
- Luồng sửa tồn trực tiếp trong Hàng hóa phải tạo phiếu kiểm kho tự động để truy vết.
- Màn danh sách cần hỗ trợ tìm lại lịch sử dài hạn, không chỉ tháng hiện tại.

---

## 1. Mục tiêu

Kiểm kho giúp đối soát số lượng thực tế trong kho với số tồn trên hệ thống.

Khi người dùng cân bằng kho, hệ thống tạo bút toán điều chỉnh tồn để số tồn hệ thống khớp số thực tế đã nhập.

---

## 2. Trạng thái phiếu kiểm kho

### BR-STK-01: Stocktake status

Phiếu kiểm kho có 3 trạng thái chính:

| Trạng thái | Ý nghĩa | Ảnh hưởng tồn kho |
|---|---|---|
| `draft` | Phiếu tạm | Chưa đổi tồn kho |
| `balanced` | Đã cân bằng kho | Đã tạo stock movement điều chỉnh |
| `cancelled` | Đã hủy | Không ảnh hưởng tồn kho |

Phiếu kiểm kho không bị xóa vật lý.

---

## 3. Tạo phiếu kiểm kho thủ công

### BR-STK-02: Luồng kiểm kho thủ công

Người dùng tạo phiếu kiểm kho thủ công theo luồng:

1. Tạo phiếu kiểm kho.
2. Chọn sản phẩm/vật tư cần kiểm.
3. Nhập số lượng thực tế.
4. Hệ thống tính chênh lệch:

```text
chênh lệch = số lượng thực tế - số lượng hệ thống
```

Người dùng có thể:

- lưu tạm
- cân bằng kho
- hủy phiếu

### BR-STK-03: Lưu tạm

Lưu tạm chỉ lưu phiếu ở trạng thái `draft`.

Lưu tạm không tạo stock movement và không đổi tồn kho.

### BR-STK-04: Cân bằng kho

Khi cân bằng kho:

- phiếu chuyển sang `balanced`
- hệ thống tạo stock movement loại `stocktake_adjustment` cho từng dòng có chênh lệch
- tồn kho hệ thống cập nhật theo số lượng thực tế

### BR-STK-05: Hủy phiếu

Hủy phiếu chuyển phiếu sang `cancelled`.

Phiếu đã hủy không ảnh hưởng tồn kho.

---

## 4. Phiếu tự động khi sửa tồn ở Hàng hóa

### BR-STK-06: Sửa tồn trực tiếp sinh phiếu kiểm kho

Cho phép sửa tồn ngay khi sửa một hàng hóa trong trang Hàng hóa.

Nếu người dùng sửa số tồn trực tiếp, hệ thống tự động sinh một phiếu kiểm kho để truy vết thay đổi.

Phiếu tự động:

- có trạng thái `balanced` ngay
- tạo stock movement loại `stocktake_adjustment`
- có ghi chú theo mẫu:

```text
Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa: <Tên hàng> (<Mã hàng>)
```

Nếu người dùng sửa thông tin hàng hóa nhưng không sửa tồn, không sinh phiếu kiểm kho.

---

## 5. Hàng thường, cuộn và tấm trong kiểm kho

### BR-STK-07: Hàng thường sửa tổng tồn

Hàng `normal` được phép kiểm kho/sửa theo tổng tồn chính.

Khi sửa tồn hàng `normal` trong trang Hàng hóa, hệ thống tự sinh phiếu kiểm kho `balanced`.

### BR-STK-08: Cuộn kiểm theo từng cuộn

Hàng `roll` không được sửa tổng tồn trực tiếp.

Khi kiểm kho hoặc sửa tồn hàng `roll`, người dùng phải sửa theo từng cuộn vật lý.

Tổng tồn của sản phẩm dạng cuộn chỉ là tổng hợp từ các cuộn bên dưới.

### BR-STK-09: Tấm kiểm theo từng tấm/tấm lỡ

Hàng `sheet` không được sửa tổng tồn trực tiếp.

Khi kiểm kho hoặc sửa tồn hàng `sheet`, người dùng phải sửa theo:

- tấm nguyên
- tấm dở nếu có
- tấm lỡ/tấm thừa

Tổng tồn của sản phẩm dạng tấm chỉ là tổng hợp từ các đối tượng vật lý bên dưới.

---

## 6. Thông tin phiếu kiểm kho

### BR-STK-10: Thông tin nghiệp vụ cần theo dõi

Phiếu kiểm kho cần theo dõi tối thiểu:

- mã kiểm kho tự sinh dạng `KK000001`
- thời gian tạo
- ngày cân bằng nếu có
- tổng số lượng thực tế
- tổng giá trị thực tế
- tổng chênh lệch
- số lượng lệch tăng
- số lượng lệch giảm
- ghi chú
- trạng thái
- người tạo

Danh sách phiếu cần tìm/lọc được theo:

- mã phiếu
- khoảng thời gian tạo
- trạng thái
- người tạo

Nếu bộ lọc thời gian mặc định không có kết quả, UI cần cho người dùng mở rộng khoảng tìm kiếm thay vì kết luận không có lịch sử.

MVP hỗ trợ xuất Excel danh sách phiếu kiểm kho để phục vụ báo cáo.

Tùy chỉnh cột hiển thị để sau MVP.

---

## 7. Acceptance Criteria

- Lưu tạm phiếu kiểm kho không đổi tồn.
- Cân bằng kho tạo stock movement điều chỉnh.
- Hủy phiếu không xóa vật lý.
- Sửa tồn hàng thường trong Hàng hóa tự tạo phiếu kiểm kho `balanced`.
- Sửa thông tin hàng hóa nhưng không sửa tồn không tạo phiếu kiểm kho.
- Cuộn/tấm không cho sửa tổng tồn trực tiếp.
