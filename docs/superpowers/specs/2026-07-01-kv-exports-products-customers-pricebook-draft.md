# KiotViet Exports — Products, Customers, PriceBook Draft

> Ngày rà: 2026-07-01
> Trạng thái: Draft phân tích export KiotViet, không phải Source of Truth DB/API
> Nguồn:
> - `/Users/vanlam/Downloads/DanhSachSanPham_KV01072026-104741-899.xlsx`
> - `/Users/vanlam/Downloads/DanhSachKhachHang_KV01072026-104807-412.xlsx`
> - `/Users/vanlam/Downloads/BangGia_KV01072026-104841-574.xlsx`

---

## 1. Mục tiêu

Ghi lại dữ liệu thật từ KiotViet để kiểm tra các quyết định đã chốt cho QC-OMS.

Nguyên tắc:

- Dữ liệu export dùng để tham khảo và phát hiện mâu thuẫn.
- Không copy 100% KiotViet.
- Chỉ cập nhật Source of Truth khi quyết định đã rõ.
- Những phần phức tạp như BOM/version, tồn vật lý cuộn/tấm và Purchase/giá vốn vẫn cần phase riêng.

---

## 2. Sản phẩm

Export `DanhSachSanPham` có `657` dòng dữ liệu.

### 2.1. Loại hàng

| Loại hàng KiotViet | Số dòng |
|---|---:|
| Hàng hóa | 461 |
| Combo - đóng gói | 184 |
| Dịch vụ | 12 |

Quyết định/nhận xét:

- QC-OMS cần phân biệt hàng hóa/vật tư, combo/thành phẩm và dịch vụ.
- Không mặc định mọi `Combo - đóng gói` là workflow sản xuất phức tạp; trước hết xem là dòng bán có thể có BOM/định mức.
- Dịch vụ vẫn có thể xuất hiện trong POS nhưng không trừ tồn vật lý như vật tư.

### 2.2. Trạng thái và POS

| Trường | Thống kê |
|---|---:|
| `Đang kinh doanh = 1` | 496 |
| `Đang kinh doanh` trống/inactive | 161 |
| `Được bán trực tiếp = 1` | 657 |

Quyết định/nhận xét:

- `Đang kinh doanh` map sang active/inactive.
- `Được bán trực tiếp` không giúp lọc POS vì toàn bộ export đều là `1`.
- Sản phẩm inactive không tìm thấy ở POS, chỉ xem trong danh sách Hàng hóa qua bộ lọc trạng thái.

### 2.3. Đơn vị tính

Đơn vị phổ biến:

| Đơn vị | Số dòng |
|---|---:|
| Cái | 82 |
| m2 | 65 |
| Tấm | 62 |
| m | 61 |
| Tấc | 56 |
| Tờ | 38 |
| cái | 37 |
| trống | 31 |
| cây | 17 |
| m tới | 14 |
| Ram | 11 |
| Cuộn/cuộn | 14 |

Quyết định/nhận xét:

- Không giữ nguyên danh sách đơn vị KiotViet vì có trùng nghĩa do viết hoa/thường và có đơn vị mang tính quy cách.
- Cần chuẩn hóa đơn vị hiển thị và loại đơn vị nghiệp vụ.
- Các giá trị như `Khổ 91`, `Khổ 127`, `Tấm CNC`, `Tấc CNC` nên xem là quy cách/cách bán hoặc loại xử lý, không tự động trở thành đơn vị chuẩn.

### 2.4. Tồn kho

| Nhóm tồn | Số dòng |
|---|---:|
| Tồn dương | 351 |
| Tồn bằng 0 | 249 |
| Tồn âm | 57 |

Quyết định/nhận xét:

- Dữ liệu thật có tồn âm, phù hợp quyết định QC-OMS cho phép bán tiếp sau cảnh báo.
- Báo cáo tồn kho cần nhìn rõ tồn âm để xử lý sau.
- Với hàng cuộn/tấm, export chỉ là tổng tham khảo; QC-OMS vẫn quản lý vật lý theo cuộn/tấm.
- Owner chốt ngày `2026-07-01`: import tạm toàn bộ tồn KiotViet để có dữ liệu chạy trước, sau đó chuẩn hóa dần số cuộn/tấm thật, cuộn nào còn bao nhiêu mét tới, tấm/tấm lỡ nào còn trong kho.
- Luồng `khui vật tư`/kiểm kho sau này sẽ giúp trừ hoặc sửa từng cuộn/tấm về đúng thực tế, có thể về 0 hoặc còn số mét/tấm ước lượng chính xác hơn.

### 2.5. BOM/Combo

Có `189` dòng có cột `Hàng thành phần`.

Định dạng KiotViet:

```text
MaThanhPhan:SoLuong|MaThanhPhan:SoLuong
```

Ví dụ:

```text
HH = DCS:0.6|F5:0.3
IDC = DCS:0.1
SP000525 = DCS:1.2|A5T:0.42|SP000124:4.5
SP000497 = BT:1.2|S20:0.5|SP000166:1|T120:1
```

Quyết định/nhận xét:

- KiotViet export xác nhận xưởng đang có nhiều định mức vật tư thật.
- QC-OMS nên giữ hướng BOM/định mức, nhưng không copy định dạng text `code:qty|...` làm schema chính.
- Khi import/chuyển đổi dữ liệu sau này, cột này có thể dùng để tạo draft BOM để Owner rà lại.
- BOM vẫn cần version, snapshot chứng từ và validation chống vòng lặp ở phase riêng.

---

## 3. Khách hàng

Export `DanhSachKhachHang` có `528` dòng dữ liệu.

### 3.1. Loại/trạng thái

| Trường | Thống kê |
|---|---:|
| Cá nhân | 525 |
| Công ty | 3 |
| Trạng thái active `1` | 515 |
| Trạng thái trống/inactive | 13 |

Quyết định/nhận xét:

- MVP không cần tách UI phức tạp theo cá nhân/công ty.
- Công ty/MST nếu có chỉ là thông tin hồ sơ, không mở VAT/HĐĐT.

### 3.2. Số điện thoại

| Nhóm | Số dòng |
|---|---:|
| Có SĐT | 25 |
| Không SĐT | 503 |
| SĐT trùng trong export | 0 |

Quyết định/nhận xét:

- Dữ liệu thật xác nhận phải cho phép khách không có SĐT.
- Nếu có SĐT thì unique.
- Tạo/tìm khách không được phụ thuộc SĐT; mã khách và tên khách là chính.

### 3.3. Nhóm khách và bảng giá

Nhóm khách trong export:

| Nhóm khách | Số khách |
|---|---:|
| trống | 367 |
| 40 | 71 |
| 35 | 52 |
| 25 | 23 |
| 30 | 12 |
| 26 | 3 |

Quyết định/nhận xét:

- Nhóm khách thật đang dùng là các nhóm `25`, `26`, `30`, `35`, `40`, khớp cột bảng giá export.
- Khách không nhóm là phổ biến nhất, nên fallback `Bảng giá chung` là bắt buộc.
- UI nên hiển thị tên nhóm/bảng giá dễ hiểu hơn nếu sau này Owner muốn đổi tên, nhưng mã/nhãn hiện tại có thể dùng để import ban đầu.

### 3.4. Công nợ

| Chỉ số | Giá trị |
|---|---:|
| Khách có nợ hiện tại > 0 | 78 |
| Tổng nợ cần thu hiện tại | 225,781,565 |

Quyết định/nhận xét:

- Customer/Debt là nghiệp vụ thật, không phải tính năng trang trí.
- Danh sách khách cần lọc được còn nợ/không nợ và chi tiết nợ theo hóa đơn.

---

## 4. Bảng Giá

Export `BangGia` có `496` dòng.

Header:

```text
Mã hàng, Tên hàng, Đơn vị tính, Nhóm hàng, Tồn kho, Giá vốn, Giá nhập cuối,
Bảng giá chung, 25, 26, 30, 35, 40
```

### 4.1. Cột bảng giá

| Bảng giá | Dòng có giá | Dòng khác 0 | Dòng bằng 0 |
|---|---:|---:|---:|
| Bảng giá chung | 496 | 285 | 211 |
| 25 | 103 | 103 | 0 |
| 26 | 102 | 101 | 1 |
| 30 | 101 | 101 | 0 |
| 35 | 102 | 102 | 0 |
| 40 | 102 | 102 | 0 |

Quyết định/nhận xét:

- Các bảng giá nhóm thật đang có tên/nhãn `25`, `26`, `30`, `35`, `40`.
- Không trải nhiều bảng giá ngang trong UI QC-OMS MVP; mỗi bảng giá mở chi tiết riêng.
- Dòng giá `0` phải được hiểu cẩn thận:
  - `0` có thể là giá được khai báo thật.
  - Fallback chỉ xảy ra khi dòng giá không tồn tại/để trống theo schema QC-OMS, không phải vì giá bằng `0`.
- `Giá vốn` và `Giá nhập cuối` là dữ liệu tham khảo cho PriceBook/công thức giá sau Purchase, không sửa trực tiếp ở bảng giá.
- Owner chốt ngày `2026-07-01`: cách làm giá của KiotViet chưa đúng mong muốn, nên QC-OMS chỉ import dữ liệu bảng giá hiện có, còn luồng giá/công thức giá phải thiết kế riêng theo cách vận hành xưởng.

---

## 5. Quyết định SoT đã/nên cập nhật

Đã đủ chắc để cập nhật SoT:

- Customer: SĐT optional, unique nếu có; nhóm khách thật khớp bảng giá; khách không nhóm rất nhiều nên fallback bảng giá chung là lõi.
- PriceBook: bảng giá nhóm hiện tại là `25/26/30/35/40`; không dùng layout trải ngang; giá `0` không đồng nghĩa với thiếu giá.
- Product/Inventory: giữ đơn vị/nhóm hàng, nhưng phải chuẩn hóa; không copy thương hiệu/thuộc tính retail; tồn âm phải hiển thị.
- BOM draft: có dữ liệu BOM thật, nhưng schema cần phase riêng.

Chưa đưa vào SoT DB/API ngay:

- Import tự động BOM từ cột `Hàng thành phần`.
- Chuẩn hóa toàn bộ đơn vị.
- Phương pháp giá vốn chuẩn.
- Mapping vật lý cuộn/tấm từ tổng tồn KiotViet sang object vật lý QC-OMS, dù đã chốt hướng import tạm rồi chuẩn hóa dần.
- Thiết kế PriceBook nâng cao/công thức giá đúng mong muốn của xưởng.
