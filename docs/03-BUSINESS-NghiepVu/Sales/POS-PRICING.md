# POS-PRICING — Nghiệp vụ giá bán POS

> **Nguồn:** Chốt từ draft `docs/superpowers/specs/2026-06-30-customer-product-pricing-design.md`

---

## 1. Mục đích

Tài liệu này là Source of Truth cho cách POS xác định giá mặc định, giá sửa tay, lịch sử giá và phạm vi sản phẩm được phép bán.

---

## 2. Quy tắc bảng giá

### BR-PRICE-01: Giá mặc định

Giá mặc định trên POS được xác định theo thứ tự:

1. Khách hàng có nhóm khách: dùng bảng giá của nhóm khách.
2. Khách hàng không có nhóm: dùng bảng giá chung.
3. Chưa chọn khách hàng: dùng bảng giá chung.

Nếu bảng giá của nhóm không có giá cho sản phẩm, POS dùng giá trong bảng giá chung cho sản phẩm đó.

### BR-PRICE-02: Đổi khách trên đơn

Khi đổi khách trên đơn, POS cập nhật giá các dòng hàng theo bảng giá áp dụng của khách mới.

Nếu khách mới có nhóm, dùng bảng giá của nhóm khách mới.

Nếu khách mới không có nhóm, dùng bảng giá chung.

### BR-PRICE-03: Không có chiết khấu riêng trong Phase 1

Phase 1 không có chiết khấu riêng theo khách hoặc theo nhóm khách.

Mức ưu đãi được thể hiện bằng bảng giá của nhóm khách.

Luồng giá Phase 1:

```text
Khách hàng
-> Nhóm khách hoặc không nhóm
-> Bảng giá nhóm hoặc bảng giá chung
-> Giá mặc định trên POS
```

### BR-PRICE-04: Giá sửa tay

Nhân viên có thể sửa giá bán khác với giá mặc định.

Giá sửa tay:

- chỉ áp dụng cho lần bán hiện tại
- không cập nhật ngược vào bảng giá nhóm
- không cập nhật ngược vào bảng giá chung
- được lưu vào lịch sử giá của khách hàng với sản phẩm đó

### BR-PRICE-05: Lịch sử giá theo khách và sản phẩm

Lịch sử giá lưu theo cặp:

```text
khách hàng + sản phẩm
```

Lịch sử giá không tách theo kích thước, quy cách hoặc ghi chú gia công trong Phase 1.

Khi bán lại cùng khách hàng và cùng sản phẩm:

- POS vẫn hiển thị giá mặc định theo bảng giá trước.
- Nếu khách hàng đó đã có lịch sử giá riêng với sản phẩm, hệ thống cung cấp tối đa 5 giá gần nhất để nhân viên có thể chọn lại.
- Lịch sử giá là nguồn gợi ý, không thay thế giá mặc định theo bảng giá.

---

## 3. Quy tắc sản phẩm được bán

### BR-PROD-01: Sản phẩm đang bán và ngưng bán

POS bán hàng chỉ tìm và chọn được sản phẩm đang bán.

Sản phẩm ngưng bán:

- không xuất hiện trong tìm kiếm POS bán hàng
- không được chọn để thêm vào đơn bán mới từ POS
- chỉ tìm thấy ở trang Hàng hóa thông qua bộ lọc trạng thái
- vẫn được giữ trong dữ liệu và lịch sử chứng từ cũ

### BR-PROD-02: Tạo mới và sửa sản phẩm

POS không tạo nhanh hàng hóa từ màn hình bán hàng.

Tạo mới, sửa thông tin, đổi trạng thái và quản lý danh mục sản phẩm thuộc trang Hàng hóa.

---

## 4. Quy tắc đơn vị bán hàng

### BR-UNIT-01: Cuộn

Không bán trực tiếp theo đơn vị `Cuộn` trên POS.

Vật tư dạng cuộn được quy đổi ra đơn vị bán phù hợp, chủ yếu là `m²`.

Quy tắc quản lý tồn theo cuộn thuộc Inventory Phase 4-5, không chốt trong Phase 1.

### BR-UNIT-02: Tấm và mét tới

Tấm chủ yếu bán theo đơn vị `m`, hiểu là mét tới.

Ví dụ tấm khổ:

```text
2.44 m x 1.22 m
```

Nếu bán `1 m tới`, phần bán ra được hiểu là:

```text
1 m x 1.22 m
```

Với sản phẩm bán theo `m tới`, bảng giá lưu giá theo `1 m tới`, không phải giá theo `m²`.

Tấm vẫn có thể bán nguyên tấm hoặc quy đổi/bán theo `m²` khi nghiệp vụ cần.

### BR-UNIT-03: Nhóm đơn vị bán theo số lượng

`Cái` trong tài liệu hiện tại là cách nói chung cho nhóm hàng bán theo số lượng.

Về sau hệ thống có thể có nhiều tên đơn vị cụ thể khác như cái, bộ, hộp hoặc đơn vị tương tự.

Các đơn vị cụ thể này vẫn thuộc nhóm hành vi bán theo số lượng nếu cách tính tiền là:

```text
đơn giá x số lượng
```

---

## 5. Không thuộc phạm vi Phase 1

Các nội dung sau không chốt trong tài liệu này:

- chiết khấu riêng ngoài bảng giá
- khuyến mãi theo chương trình
- barcode/QR scan sản phẩm
- quản lý tồn theo cuộn, tấm, lot hoặc vật tư dở
- chính sách tồn âm
- BOM và deep-scan vật tư
- schema Database chi tiết cho bảng giá và lịch sử giá
- API contract chi tiết cho Product, Customer và Pricing

---

## 6. Acceptance Criteria nghiệp vụ

1. Khách không gán nhóm dùng bảng giá chung.
2. Khách có nhóm dùng bảng giá của nhóm.
3. Đổi khách trên đơn làm cập nhật giá dòng hàng theo bảng giá của khách mới.
4. Giá sửa tay không thay đổi bảng giá chung hoặc bảng giá nhóm.
5. Giá sửa tay được lưu vào lịch sử theo khách hàng và sản phẩm.
6. Hệ thống chỉ cung cấp lịch sử giá gần đây khi khách hàng có lịch sử giá với sản phẩm đó.
7. Lịch sử giá gần đây trả tối đa 5 giá gần nhất.
8. Sản phẩm ngưng bán không xuất hiện trong tìm kiếm POS.
9. Sản phẩm ngưng bán vẫn tìm được ở trang Hàng hóa bằng bộ lọc trạng thái.
10. Sản phẩm bán theo `m tới` dùng giá theo `1 m tới`.

---

← [Quay về Sales README](./README.md)
