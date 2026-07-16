# 01-PRICE-LIST — Danh sách bảng giá

> **Tham khảo:** KiotViet `Hàng hóa > Thiết lập giá`

---

## 1. Mục tiêu

Trang danh sách bảng giá giúp quản lý các bảng giá đang dùng cho khách hàng và nhóm khách.

Trong PriceBook MVP, công thức giá chỉ dùng `giá nhập cuối` từ `products.latest_purchase_cost`. Trước khi Purchase/Supplier hoàn chỉnh, giá này có thể được nhập/import hoặc sửa có kiểm soát trong Product admin/API. Giá bán chính thức vẫn là giá đã lưu trong bảng giá; công thức chỉ đổi giá khi người dùng preview và áp dụng.

KiotViet chỉ là nguồn import/tham khảo ban đầu. Luồng giá của QC-OMS phải được thiết kế theo cách xưởng muốn vận hành, không copy nguyên cách KiotViet nếu cách đó không đúng mong muốn.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bảng giá                                           [+ Bảng giá]              │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc               │ [Theo mã/tên bảng giá...]                             │
│ - Trạng thái         │                                                       │
│ - Loại bảng giá      │ Bảng danh sách bảng giá                               │
│ - Nhóm khách dùng    │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Loại bảng giá

Ô tìm trong header dùng shared compact search:

- tìm bỏ dấu theo mã hàng/tên hàng trong lưới bảng giá;
- khi nhập từ khóa, lọc trực tiếp lưới bảng giá theo mã hàng/tên hàng, phương thức bán và đơn vị;
- không hiển thị dropdown/listbox gợi ý dưới ô tìm;
- nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung.

## Shared Management Layout Rule

PriceBook dùng chung khung quản trị với Customers/Suppliers:

- dùng `ManagementPage`, `ManagementCompactToolbar`, `ManagementCompactSearch`, `ManagementFilterSidebar`, `ManagementTableViewport`, `ManagementDataTable`;
- bộ lọc bảng giá dùng `ManagementChipPicker` + `useChipSelection`, không viết picker riêng trong `PriceBookPage`;
- bảng giá không tự render `<table>` riêng trong page;
- dữ liệu riêng của PriceBook chỉ nằm ở cấu hình cột, cell giá động theo `priceLists`, công thức preview/apply và API load;
- không đưa lại dropdown/listbox gợi ý dưới ô tìm;
- POS không áp dụng rule này.

Bộ lọc bảng giá hiện tại:

- `Giá chung` được chọn mặc định lúc đầu nhưng vẫn là một thẻ bình thường, có thể tắt.
- Mỗi bảng giá được chọn hiển thị thành một thẻ riêng; chọn thêm bảng giá thì thêm thẻ mới và thêm cột giá tương ứng trong lưới.
- Bấm/focus vào ô thẻ để xổ dropdown; gõ chữ trong ô để lọc nhanh danh sách bảng giá.
- Không có nút `Áp dụng bộ lọc`, không có nút mũi tên dropdown riêng, không có nút `+N khác` để chọn thêm.
- Bộ lọc trạng thái hàng có thêm `Đã xoá KV` để xem các mã lịch sử có hậu tố `{DEL}`. Các mã này chỉ phục vụ đối soát/lịch sử bảng giá và chứng từ cũ, không được POS hoặc luồng vận hành mới dùng làm hàng bán.
- Cột lưới PriceBook MVP gồm `Mã hàng`, `Tên hàng`, `Giá nhập cuối`, các cột bảng giá đang chọn và `Cách bán`; không hiển thị cột `Trạng thái` hoặc `Thao tác`.
- Pattern thẻ chọn nhiều này là UI shared cho các bộ lọc khác sau này, không gắn chặt riêng với PriceBook.

| Loại | Quy tắc |
|---|---|
| Giá chung | Luôn có đúng một giá chung đang active trong mỗi xưởng |
| Bảng giá nhóm khách | Dùng để gán cho một hoặc nhiều nhóm khách |

Khách không gán nhóm dùng giá chung.

---

## 4. Cột bảng

| Cột | Mô tả |
|---|---|
| Mã bảng giá | Unique trong xưởng; bấm để mở chi tiết |
| Tên bảng giá | Tên dễ hiểu cho nhân viên |
| Loại | Giá chung hoặc bảng giá nhóm |
| Nhóm khách đang dùng | Danh sách nhóm khách gán bảng giá này |
| Số sản phẩm có giá | Số dòng giá đã khai báo |
| Trạng thái | Đang dùng hoặc Ngừng dùng |
| Cập nhật gần nhất | Thời gian sửa gần nhất |

---

## 5. Thao tác

| Thao tác | Hành vi |
|---|---|
| Tạo bảng giá | Tạo bảng giá mới, mặc định chưa gán nhóm khách |
| Mở chi tiết | Quản lý giá sản phẩm trong bảng |
| Đổi trạng thái | Bảng giá ngừng dùng không được gán mới cho nhóm khách |
| Gán nhóm khách | Chọn nhóm khách dùng bảng giá này |
| Cấu hình công thức | Tạo/sửa công thức gợi ý giá theo nhóm hàng khi module giá vốn đã sẵn sàng |

Quy tắc:

- Không cho tắt giá chung nếu đó là giá chung duy nhất.
- Nếu ngừng dùng một bảng giá đang được nhóm khách sử dụng, phải yêu cầu chọn bảng giá thay thế hoặc hủy thao tác.
- Không có chiết khấu riêng ở màn này trong Phase 1.

---

## 6. Khác KiotViet

KiotViet `Hàng hóa > Thiết lập giá` hiển thị bảng giá theo dạng lưới hàng hóa:

- chọn bảng giá ở bộ lọc bên trái, ví dụ `Giá chung`
- lọc theo nhóm hàng, tồn kho, điều kiện giá bán
- bảng gồm mã hàng, tên hàng, giá vốn, giá nhập cuối, cột giá của bảng đang chọn
- ô giá có thể nhập trực tiếp trên lưới
- có import/export và ẩn hiện cột
- màn đang thấy `496 hàng hóa`

KiotViet có thể hiển thị nhiều bảng giá ngang như `BG1`, `BG2`, `BG3`. QC-OMS dùng lưới bảng giá có cột bảng giá động để nhân viên xem các bảng giá đang active trên cùng một mặt bằng, nhưng không hard-code riêng `25/26/30/35/40`.

Export KiotViet ngày `2026-07-01` có các cột bảng giá thật:

- `Bảng giá chung` trong file KV, hiển thị trong QCVL là `Giá chung`
- `25`
- `26`
- `30`
- `35`
- `40`

Quy tắc hiển thị tên bảng giá:

- Import/backend vẫn được nhận tên nguồn từ KiotViet như `Bảng giá chung` hoặc tên không dấu cũ.
- UI QCVL phải hiển thị bảng giá mặc định là `Giá chung` thông qua helper dùng chung, không so chuỗi riêng trong từng page.
- POS, hóa đơn, báo giá in, import preview và PriceBook phải dùng cùng mapping này để không lệch nhãn.

Các nhóm khách trong export Khách hàng cũng dùng đúng các nhãn `25`, `26`, `30`, `35`, `40`, nên QC-OMS có thể import/migrate ban đầu theo các bảng giá này. UI vẫn nên cho đặt tên dễ hiểu hơn nếu Owner đổi tên sau.

QC-OMS ưu tiên:

- danh sách bảng giá riêng
- mở một bảng giá để sửa chi tiết
- POS tự resolve giá theo khách/nhóm khách
- lịch sử 5 giá gần đây theo khách + sản phẩm là nút gợi ý trong POS, không phải 5 cột trong bảng giá

KiotViet `Khuyến mại` có dữ liệu thật dạng `Hàng hóa - Giá bán theo số lượng mua` cho một số vật tư PVC/CPVC. QC-OMS MVP không làm module khuyến mại/campaign riêng. Nếu sau này cần bán theo bậc số lượng, đặc tả lại như quy tắc giá trong PriceBook, không kéo nguyên module marketing/khuyến mại retail vào POS.

Giá vốn trong KiotViet hiển thị để tham khảo trên lưới thiết lập giá. QC-OMS MVP hiển thị `Giá nhập cuối` trên lưới và không cho sửa giá này trực tiếp trong ô bảng giá.

Export bảng giá có nhiều dòng `Bảng giá chung = 0` và một dòng giá nhóm `26 = 0`. Theo quyết định hiện tại, giá `0` là giá hợp lệ nếu được khai báo; fallback về giá chung chỉ xảy ra khi dòng giá không tồn tại/để trống trong schema QC-OMS, không phải vì giá bằng `0`.

Công thức giá theo nhóm hàng là hướng cần giữ cho phase PriceBook nâng cao, nhưng slice MVP đầu chưa thêm schema/filter nhóm hàng:

- mỗi nhóm hàng có thể có công thức riêng
- nguồn tính giá trong MVP là `giá nhập cuối`; `giá vốn bình quân` chỉ xem lại sau khi Purchase/Inventory đủ dữ liệu và Owner chốt
- công thức phải lưu được làm mặc định lâu dài cho nhóm hàng
- khi giá nhập cuối thay đổi, hệ thống tính lại giá theo công thức để tạo giá mới/giá đề xuất
- giá POS chỉ đổi khi công thức được áp dụng theo chính sách đã cấu hình; mặc định nên có bước xem/xác nhận áp dụng trước khi cập nhật hàng loạt

## 7. Hướng thiết kế riêng cho QC-OMS

Phần giá cần tách thành 3 lớp để đúng nghiệp vụ quảng cáo:

| Lớp | Ý nghĩa | Ví dụ |
|---|---|---|
| Giá đã lưu | Giá chính thức POS dùng khi bán | Giá chung, bảng giá nhóm `25/30/35/40` |
| Công thức gợi ý | Công thức tạo giá đề xuất theo bộ lọc sản phẩm | Giá nhập cuối + chi phí + lợi nhuận |
| Lịch sử giá khách | Giá sửa tay từng bán cho khách + sản phẩm | 5 giá gần nhất để chọn lại trong POS |

Nguyên tắc đề xuất:

- POS luôn dùng giá đã lưu trong bảng giá làm mặc định.
- Công thức không tự chạy ngầm làm đổi giá bán; người dùng phải bấm áp dụng/cập nhật.
- Công thức có thể chạy theo nhóm hàng, không bắt buộc mọi sản phẩm dùng cùng một cách tính.
- Một sản phẩm có thể cần giá theo `m2`, `m tới`, `tấm`, `cái` hoặc combo; công thức phải hiểu đúng cách bán của sản phẩm.
- Giá vốn từ nhập hàng là dữ liệu tham khảo cho công thức, không phải giá bán.
- Nếu nhân viên sửa giá trên POS, lịch sử giá theo khách + sản phẩm được lưu để gợi ý lần sau, không cập nhật ngược bảng giá.

## 8. Công thức giá 2 tầng

QC-OMS chốt hướng công thức giá rộng hơn KiotViet. KiotViet chỉ cho kiểu:

```text
Giá mới = Giá hiện tại +/- số tiền hoặc %
```

QC-OMS cần công thức nhiều bước, lưu mặc định theo nhóm hàng/sản phẩm để dùng lâu dài.

### Tầng 1: Giá nền trước lợi nhuận

Giá nền là giá đã cộng các chi phí cần thiết trước khi tính lợi nhuận bán hàng.

Ví dụ nhóm hàng `Fomex`:

```text
Giá nền = Giá nhập cuối
        + 10% vận chuyển
        + 8% thuế/phí
        + 10% hao hụt
```

Có thể viết gọn:

```text
Giá nền = Giá nhập cuối * (1 + 10% + 8% + 10%)
```

Nguồn giá đầu vào MVP:

- `giá nhập cuối` từ `products.latest_purchase_cost`

Ngoài phạm vi MVP đầu:

- chọn nguồn `giá vốn bình quân`
- chọn nguồn giá khác khi Purchase/Inventory đủ dữ liệu

### Tầng 2: Giá bán theo bảng giá

Từ giá nền, mỗi bảng giá/nhóm khách có thể cộng lợi nhuận riêng.

Ví dụ:

```text
Giá 40 = Giá nền + 40,000/tấm
Giá 35 = Giá nền + 35,000/tấm
Giá 30 = Giá nền + 30,000/tấm
```

Hoặc:

```text
Giá 40 = Giá nền * 1.25
Giá 35 = Giá nền * 1.20
Giá 30 = Giá nền * 1.15
```

Một công thức có thể áp dụng cho:

- cả nhóm hàng, ví dụ `Fomex 5mm`
- một nhóm hàng cha, ví dụ `Fomex`
- một số sản phẩm được chọn thủ công
- một bảng giá cụ thể hoặc tất cả bảng giá nhóm

### Tự cập nhật khi giá nhập thay đổi

Khi phiếu nhập hoặc thao tác admin được phép làm thay đổi `giá nhập cuối`, hệ thống phải tính lại được giá theo công thức đang lưu.

Mặc định an toàn:

- hệ thống tạo danh sách giá mới/giá đề xuất
- Owner hoặc người có quyền xem chênh lệch và bấm áp dụng
- POS chỉ dùng giá mới sau khi bảng giá đã được cập nhật

Sau này có thể cho phép một số nhóm hàng tự áp dụng nếu Owner bật rõ chính sách đó.

### Làm tròn

Công thức MVP làm tròn giá sau cùng lên `1,000đ`.

Các kiểu làm tròn khác như `5,000đ`, `10,000đ` hoặc không làm tròn nằm ngoài phạm vi hiện tại, chỉ mở khi Owner cần.

### Trạng thái chốt

Đã chốt:

- PriceBook QC-OMS phải hỗ trợ công thức giá nhiều bước, không chỉ cộng/trừ như KiotViet.
- Công thức lưu mặc định theo nhóm hàng/sản phẩm để dùng lâu dài.
- Công thức có tầng giá nền trước lợi nhuận và tầng giá bán theo bảng giá.
- Giá nhập cuối thay đổi thì hệ thống tính lại được giá theo công thức.
- Mặc định không đổi POS âm thầm; phải có giá đề xuất/chênh lệch và thao tác áp dụng, trừ khi sau này Owner bật tự áp dụng cho nhóm hàng cụ thể.
- Lưới bảng giá hiện tại đã có cột `Mã hàng`, `Tên hàng`, `Giá nhập cuối`, `Chi phí`, `Lợi nhuận` và các cột bảng giá active.
- Trước preview, ô bảng giá hiển thị `Chưa xem`; sau preview hiển thị `Hiện tại ... -> ...`, `Mới ...` hoặc `Không khớp`.
- Không hiển thị nhãn `Giá tay`/`Theo công thức` theo từng ô nếu API chưa trả `current_mode` theo từng `computed_prices[]`.

Ngoài phạm vi hiện tại, cần chốt trước khi làm PriceBook nâng cao:

- nhóm hàng nào cần công thức riêng
- công thức tối thiểu cho từng nhóm hàng chính
- từng bảng giá `25/26/30/35/40` dùng cộng tiền cố định, cộng %, hay kết hợp cả hai
