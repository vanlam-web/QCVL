# UNIT-CONVERSION — Đơn vị tồn, đơn vị bán và quy đổi

> **Phạm vi:** Quy tắc nghiệp vụ cho đơn vị tồn chính, đơn vị bán phụ, quy đổi đơn giản, cuộn và tấm

---

## 1. Mục tiêu

Tài liệu này chốt cách QC-OMS hiểu đơn vị tính trong kho và bán hàng.

Nguyên tắc chính:

- mỗi sản phẩm có một đơn vị tồn chính
- đơn vị bán phụ chỉ dùng để nhập bán/tính giá
- khi ghi kho, hệ thống quy đổi về đơn vị tồn chính hoặc đối tượng vật lý tương ứng
- không copy nguyên cách KiotViet tạo nhiều dòng sản phẩm chỉ vì khác đơn vị

---

## 2. Đơn vị tồn chính

### BR-UNIT-INV-01: Một đơn vị tồn chính

Mỗi sản phẩm có một đơn vị tồn chính.

Ví dụ:

| Sản phẩm | Đơn vị tồn chính | Đơn vị bán phụ |
|---|---|---|
| Giấy | Ram | Tờ |
| Sắt cây | Cây | Mét |
| Alu/Fomex/Mica | Tấm | Mét tới, m2 |
| Bạt/Decal/PP | Cuộn vật lý hoặc mét dài theo cuộn | m2 |

---

## 3. Đơn vị bán phụ

### BR-UNIT-INV-02: Đơn vị bán phụ phải quy đổi được

POS có thể bán bằng đơn vị khác đơn vị tồn chính nếu có cấu hình quy đổi.

Quy tắc này áp dụng cho cả dòng hàng thường lẫn dòng hàng m² trong POS. Nếu sản phẩm có nhiều đơn vị bán hợp lệ, UI phải cho chọn đơn vị ngay trên dòng bán.

Khi bán bằng đơn vị phụ, stock movement lưu cả:

- số lượng bán theo đơn vị hiển thị
- số lượng đã quy đổi theo đơn vị tồn chính hoặc đối tượng vật lý

Ví dụ:

```text
1 ram = 500 tờ
```

Bán 50 tờ sẽ quy đổi thành `0.1 ram` nếu tồn chính là ram.

---

## 4. Quy cách không phải đơn vị chuẩn

### BR-UNIT-INV-03: Khổ/quy cách nên tách khỏi đơn vị

Các giá trị như `Khổ 91`, `Khổ 127`, `500 Tờ`, `1000 Tờ`, `5 kg`, `10 kg`, `Tấm CNC`, `Tấc CNC` không nên mặc định là đơn vị chuẩn.

QC-OMS tách 4 lớp dữ liệu, không gộp vào một trường:

- loại hàng: hàng thường, dịch vụ, vật tư phụ, combo/BOM
- loại tồn: tổng thường, cuộn vật lý, tấm/tấm lỡ
- đơn vị và quy đổi: `m`, `m2`, `tờ`, `ram`, `kg`, `cuộn`, `tấm`
- cách tính bán: bán theo số lượng, m2, mét tới, nguyên tấm, combo/BOM

Mục tiêu là tránh danh sách đơn vị bị phình to và trùng nghĩa.

Nói ngắn:

```text
Loại hàng = bản chất quản trị của mã hàng.
Loại tồn = cách hệ thống giữ tồn.
Đơn vị = thứ dùng để nhập số lượng và tính kho/giá.
Cách tính bán = cách POS hiểu số lượng khách mua.
```

Ví dụ:

| Dữ liệu KiotViet | QC-OMS nên hiểu |
|---|---|
| `Khổ 91` | quy cách khổ rộng, không phải đơn vị |
| `Tấm CNC` | tấm + loại xử lý/gia công CNC |
| `500 Tờ` | quy cách đóng gói; đơn vị có thể là `ram` hoặc `tờ` |
| `m tới` | cách tính bán theo chiều dài, thường dùng cho tấm |
| `m2` | đơn vị bán/tính giá theo diện tích |

---

## 5. Cuộn

### BR-UNIT-INV-04: Cuộn không bán trực tiếp trên POS

POS không bán trực tiếp theo đơn vị `Cuộn`.

Vật tư dạng cuộn được bán theo đơn vị phù hợp, chủ yếu là `m2`.

Khi bán/xuất theo `m2`, hệ thống quy đổi ra chiều dài tiêu hao theo khổ rộng của cuộn cụ thể.

Ví dụ:

```text
diện tích tiêu hao = rộng x dài
chiều dài trừ cuộn = diện tích tiêu hao / khổ rộng cuộn
```

### BR-UNIT-INV-05: Biên chừa cho cuộn

Hàng dạng cuộn có cấu hình biên chừa mặc định.

Gợi ý mặc định ban đầu:

- in bạt thường: `0.1m` mỗi chiều
- decal/PP in dán: `0.05m` mỗi chiều
- in cần gia công/nẹp/căng khung: `0.1m` đến `0.2m` tùy loại việc

Các giá trị này là default để đề xuất, không khóa cứng. Nhân viên được sửa trên từng dòng hàng/đơn hàng.

---

## 6. Tấm

### BR-UNIT-INV-06: Tấm bán theo tấm, mét tới hoặc m2

Tấm chủ yếu bán theo `m tới`.

Ví dụ tấm khổ:

```text
2.44m x 1.22m
```

Bán `1 m tới` nghĩa là bán phần:

```text
1m x 1.22m
```

Để thao tác xưởng đơn giản, QC-OMS có thể dùng khổ thao tác/làm tròn khi bán và trừ tồn, ví dụ `1.2m x 2.4m` thay vì bắt nhân viên thao tác theo khổ thật `1.22m x 2.44m`.

Nguyên tắc:

- khổ thao tác là khổ dùng để nhập bán, tính tiền, tính phần còn lại và gợi ý vật tư
- khổ thật nếu có chỉ là thông tin tham khảo/ẩn hoặc phục vụ nhập hàng sau này
- không bắt nhân viên nhập cả hai khổ trong thao tác bán/khui thường ngày

Với sản phẩm bán theo `m tới`, bảng giá lưu giá theo `1 m tới`, không phải giá theo `m2`.

Tấm vẫn có thể bán nguyên tấm hoặc quy đổi/bán theo `m2` khi nghiệp vụ cần.

Khi bán theo kích thước, ví dụ `0.5m x 0.7m x 1 tấm`, hệ thống tính phần tiêu hao và phần còn lại từ khổ thao tác. Phần còn lại có thể gồm:

- phần lớn theo m tới, ví dụ `1.2m x 1.9m`
- rẻo lớn còn dùng được
- rẻo nhỏ được đề xuất bỏ nhưng nhân viên có thể giữ lại nếu cần

### BR-UNIT-INV-07: Biên cắt hao cho tấm

Hàng dạng tấm có cấu hình biên chừa/cắt hao mặc định.

Gợi ý mặc định ban đầu:

- cắt tấm đơn giản: `0.01m` đến `0.02m`
- CNC/cắt cần chính xác: `0.02m` đến `0.05m`

Các giá trị này là default để đề xuất, không khóa cứng. Nhân viên được sửa trên từng dòng hàng/đơn hàng.

---

## 7. Acceptance Criteria

- Mỗi sản phẩm có một đơn vị tồn chính.
- Bán bằng đơn vị phụ phải có quy đổi.
- Quy cách như khổ rộng không làm phình danh mục đơn vị chuẩn.
- Dữ liệu import từ KiotViet phải được chuẩn hóa thành `loại hàng`, `loại tồn`, `đơn vị`, `quy cách`, `cách tính bán` thay vì copy nguyên chuỗi đơn vị lẫn lộn.
- Cuộn không bán trực tiếp trên POS.
- Tấm bán được theo nguyên tấm, m tới hoặc m2 theo cấu hình sản phẩm.
