# Customer, Product và Pricing Phase 1 — Draft Business Spec

> Ngày lập: 2026-06-30
> Trạng thái: Draft đã gom quyết định Owner, chưa phải Source of Truth chính thức
> Phạm vi: Business rule cho Customer, Product và Pricing phục vụ POS Phase 1

---

## 1. Mục tiêu

Spec này gom các quyết định nghiệp vụ đã chốt cho Phase 1:

- tạo và nhận diện khách hàng
- nhóm khách và bảng giá
- giá mặc định, giá sửa tay và lịch sử giá
- sản phẩm được phép bán trên POS
- đơn vị bán hàng cơ bản liên quan đến bảng giá

Khi Owner duyệt bản draft này, nội dung nên được tách vào Source of Truth chính thức:

- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-PRICING.md`

---

## 2. Nguồn tham chiếu hiện có

Các hành vi PRD đã có và không định nghĩa lại trong file này:

- F3 tìm theo mã hàng hoặc tên hàng hóa/dịch vụ.
- F3 hỗ trợ tìm không dấu.
- F3 không tìm theo viết tắt tự chế, trừ khi viết tắt đó là mã hàng chính thức.
- F3 không hỗ trợ QR/barcode scan và không có nút quét mã cạnh ô tìm kiếm.
- POS không cho tạo nhanh hàng hóa từ dropdown tìm kiếm.
- K03-C chỉ hiển thị sản phẩm/dịch vụ đang bật bán trên POS.

Nguồn tham chiếu:

- `docs/02-PRD-UX-PhongCanh/POS/K01/01a-K01-SEARCH-TABS.md`
- `docs/02-PRD-UX-PhongCanh/POS/K03/03-K03C-LUOI-SP.md`
- `docs/superpowers/specs/2026-06-30-qc-oms-spec-gap-backlog.md`

---

## 3. Customer Rules

### BR-CUS-01: SĐT khách hàng

Khách hàng được phép không có SĐT.

Nếu có nhập SĐT, SĐT không được trùng trong cùng xưởng/organization.

Mục tiêu:

- cho phép bán cho khách chưa có hoặc chưa muốn cung cấp SĐT
- tránh tạo trùng hồ sơ và trùng công nợ khi đã có SĐT

### BR-CUS-02: Mã khách và tên khách

Mỗi khách hàng bắt buộc có:

- mã khách
- tên khách

Nếu nhân viên không nhập mã khách khi tạo khách, hệ thống tự sinh mã khách theo dạng:

```text
KH000001
KH000002
KH000003
```

Mã khách tăng dần trong phạm vi xưởng/organization.

Mã khách không được trùng trong cùng xưởng/organization, dù là nhập tay hay tự sinh.

### BR-CUS-03: Nhóm khách

Khách hàng có thể thuộc một nhóm khách.

Nếu khách có nhóm, nhóm khách quyết định bảng giá mặc định áp dụng cho khách đó.

Nếu khách không gán nhóm, POS áp dụng bảng giá chung.

Không bắt buộc mọi khách hàng phải thuộc nhóm.

---

## 4. Pricing Rules

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
- Nếu khách hàng đó đã có lịch sử giá riêng với sản phẩm, POS hiển thị một nút nhỏ để xem giá gần đây.
- POS không trải danh sách giá cũ ra màn hình chính.
- Khi bấm nút xem giá gần đây, POS hiển thị 5 giá gần nhất để nhân viên chọn lại.

---

## 5. Product Rules

### BR-PROD-01: Sản phẩm đang bán và ngưng bán

POS bán hàng chỉ tìm và chọn được sản phẩm đang bán.

Sản phẩm ngưng bán:

- không xuất hiện trong tìm kiếm POS bán hàng
- không xuất hiện trong lưới sản phẩm nhanh POS
- chỉ tìm thấy ở trang Hàng hóa thông qua bộ lọc trạng thái
- vẫn được giữ trong dữ liệu và lịch sử chứng từ cũ

### BR-PROD-02: Tạo mới và sửa sản phẩm

POS không tạo nhanh hàng hóa từ màn hình bán hàng.

Tạo mới, sửa thông tin, đổi trạng thái và quản lý danh mục sản phẩm thuộc trang Hàng hóa.

---

## 6. Unit And Selling Rules

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

## 7. Không thuộc phạm vi Phase 1

Các nội dung sau không chốt trong spec này:

- chiết khấu riêng ngoài bảng giá
- khuyến mãi theo chương trình
- barcode/QR scan sản phẩm
- quản lý tồn theo cuộn, tấm, lot hoặc vật tư dở
- chính sách tồn âm
- BOM và deep-scan vật tư
- schema Database chi tiết cho bảng giá và lịch sử giá
- API contract chi tiết cho Product, Customer và Pricing

Những phần này sẽ được đặc tả ở các tầng hoặc phase tương ứng.

---

## 8. Acceptance Criteria nghiệp vụ

1. Tạo khách không có SĐT thành công nếu có tên khách và mã khách hợp lệ; nếu không nhập mã khách thì hệ thống tự sinh.
2. Tạo khách có SĐT trùng trong cùng organization bị từ chối.
3. Tạo khách không nhập mã sẽ tự sinh mã dạng `KH000001`.
4. Mã khách nhập tay trùng trong cùng organization bị từ chối.
5. Khách không gán nhóm dùng bảng giá chung.
6. Khách có nhóm dùng bảng giá của nhóm.
7. Đổi khách trên đơn làm cập nhật giá dòng hàng theo bảng giá của khách mới.
8. Giá sửa tay không thay đổi bảng giá chung hoặc bảng giá nhóm.
9. Giá sửa tay được lưu vào lịch sử theo khách hàng và sản phẩm.
10. POS chỉ hiện nút xem giá gần đây khi khách hàng có lịch sử giá với sản phẩm đó.
11. Nút xem giá gần đây hiển thị tối đa 5 giá gần nhất.
12. Sản phẩm ngưng bán không xuất hiện trong tìm kiếm POS.
13. Sản phẩm ngưng bán vẫn tìm được ở trang Hàng hóa bằng bộ lọc trạng thái.
14. Sản phẩm bán theo `m tới` dùng giá theo `1 m tới`.
