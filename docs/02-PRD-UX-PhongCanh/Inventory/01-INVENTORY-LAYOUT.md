# INVENTORY-LAYOUT — Bố cục tổng thể Hàng hóa và kiểm kho

> **Nguồn tham khảo UI:** KiotViet trang Hàng hóa ở viewport desktop rộng.

---

## 1. Mục đích

Module Hàng hóa giúp nhân viên:

- tìm và xem danh sách hàng hóa
- xem tồn kho theo trạng thái
- xử lý hàng đang kinh doanh/ngưng bán
- mở chi tiết tồn theo hàng thường/cuộn/tấm
- tạo và cân bằng phiếu kiểm kho

QC-OMS giữ tinh thần thao tác nhanh của KiotViet: menu module ở trên, bộ lọc bên trái, bảng dữ liệu lớn bên phải, toolbar thao tác phía trên bảng.

Điểm khác chính: QC-OMS phải hỗ trợ tồn kho theo **cuộn vật lý** và **tấm/tấm lỡ**, nên không chỉ có một cột tổng tồn.

---

## 2. Bố cục desktop

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top navigation: Tổng quan | Hàng hóa | Mua hàng | Đơn hàng | Khách hàng | Sổ quỹ | ...     │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hàng hóa                                         [Tìm mã/tên hàng] [Tạo mới] [Import] ...  │
├───────────────────────┬────────────────────────────────────────────────────────────────────┤
│ FILTER SIDEBAR        │ DATA WORKSPACE                                                     │
│                       │                                                                    │
│ Loại hàng             │ Tabs/Segment: Tất cả | Hàng thường | Cuộn | Tấm | Tồn âm          │
│ Tồn kho               │                                                                    │
│ Trạng thái hàng hóa   │ Table: checkbox | mã | tên | loại tồn | giá | tồn | đặt | ...      │
│ Loại hàng             │                                                                    │
│ Thời gian tạo         │ Row actions: xem chi tiết | sửa | mở tồn đối tượng | kiểm kho      │
│ Nhà cung cấp          │                                                                    │
│ ...                   │ Pagination / export / column settings                               │
└───────────────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 3. Nguyên tắc layout

- Desktop ưu tiên bảng rộng, dễ quét nhiều dòng.
- Sidebar lọc nằm bên trái, không mở thành modal trên desktop.
- Toolbar chính nằm cùng hàng với search để thao tác nhanh.
- Nút `+ Tạo hàng hóa` mở modal chung thay vì nhúng form ngay trong danh sách.
- Cột bảng phải giữ ổn định, không nhảy layout khi dữ liệu dài. Checkbox chọn dòng và sao ưu tiên dùng chung pattern nhỏ từ Sổ quỹ.
- Danh sách chính chỉ hiện trường dễ quét: mã, tên, giá vốn, giá bán, tồn kho, đơn vị và dự kiến hết hàng. Không đưa `Cách tính bán` thành cột hoặc filter nổi bên ngoài; rule này chỉ hiện trong modal tạo/sửa và tab chi tiết `Đơn vị & quy đổi`.
- Không hiện tag/checkbox `Bán trực tiếp` ở danh sách, chi tiết hoặc modal. Toàn bộ hàng/dịch vụ đang `active` mặc định được bán trực tiếp; hàng `inactive` không xuất hiện ở POS.
- Không dùng ảnh hàng hóa, vị trí kho, mô tả dài, thương hiệu, trọng lượng và tồn nhỏ nhất/lớn nhất trong scope hiện tại. Tab `Ghi chú` được giữ nếu đơn giản và không ảnh hưởng luồng chính.
- `Kích thước` vẫn cần cho hàng cuộn/tấm và các nghiệp vụ quy đổi, nhưng phải gắn với mô hình cuộn/tấm/đơn vị quy đổi, không đưa thành field trang trí chung cho mọi hàng.
- Nhóm hàng phải làm thật để phục vụ import KiotViet và lọc danh mục. Nếu chưa kịp triển khai cùng đợt sửa UI, sản phẩm tạm thuộc nhóm mặc định; giá bán fallback về bảng giá chung.
- Với màn hẹp, sidebar có thể thu gọn thành nút lọc; không dùng viewport hẹp của browser làm chuẩn desktop.
- Không đưa hướng dẫn dài trong màn hình; trạng thái và hành động phải rõ qua nhãn nút, icon và tooltip.

---

## 4. Navigation chính

Không tạo top-level tab `Kho`. Trong module `Hàng hóa`, các view MVP:

| View | Mục đích |
|---|---|
| Danh sách hàng hóa | Xem, tìm, lọc và mở chi tiết tồn |
| Tồn theo cuộn/tấm | Quản lý đối tượng vật lý của hàng cuộn/tấm |
| Kiểm kho | Tạo, lưu tạm, cân bằng và hủy phiếu kiểm kho |
| Stock movement | Xem lịch sử biến động tồn kho |

MVP giữ các view này dưới cùng module Hàng hóa, dùng tab hoặc navigation phụ. `Kiểm kho` giữ luồng cũ, chỉ đổi vị trí điều hướng vào dưới Hàng hóa.

### 4.1. Thứ tự hoàn tất nghiệp vụ

QC-OMS không cần hoàn tất toàn bộ cuộn/tấm trước khi làm danh sách Hàng hóa và Phiếu kiểm kho cơ bản, nhưng cuộn/tấm phải xong trước khi POS bán thật các mặt hàng cần trừ theo cuộn/tấm.

| Giai đoạn | Phạm vi | Lý do |
|---|---|---|
| Phase 1 | Danh sách hàng hóa, tạo/sửa hàng thường/dịch vụ/combo, nhóm hàng, đơn vị quy đổi, thẻ kho, kiểm kho hàng thường | Cho nhập/import dữ liệu và vận hành danh mục trước |
| Phase 2 | Cuộn/tấm object-level, tồn tạm KiotViet, khui vật tư, kiểm kho theo object | Bắt buộc trước khi bán thật vật tư cuộn/tấm để không sai tồn |
| Phase 3 | POS trừ kho theo BOM, đơn vị quy đổi, combo, cuộn/tấm và khui nhanh khi thiếu vật tư | POS chỉ chốt chứng từ khi dữ liệu tồn có đủ nền truy vết |
| Phase 4 | Tối ưu hao hụt, tự hiệu chỉnh định mức từ kiểm kho/khui/sản xuất, báo cáo nâng cao | Cần dữ liệu lịch sử đủ sạch trước khi tính tự động |

Nếu cần mở POS sớm cho báo giá, POS được phép cảnh báo tồn và không bắt khui. Nếu chốt hóa đơn bán hàng thật cho cuộn/tấm, hệ thống phải có luồng trừ kho object-level hoặc rule fallback được Owner chấp nhận bằng văn bản.

---

## 5. Tạo hàng hóa

`+ Tạo hàng hóa` mở modal tạo chung để người dùng không phải chọn nhiều màn riêng lẻ trước khi nhập dữ liệu. Modal có trường `Loại hàng` ở đầu form:

| Loại hàng | Cách nhận diện | UI trong modal |
|---|---|---|
| Hàng thường | `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = true` mặc định | Hiện phần tồn kho cơ bản |
| Dịch vụ | `product_kind = service`, `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = false` | Ẩn phần tồn kho; đơn vị mặc định `lần` |
| Vật tư phụ | `product_kind = auxiliary_material`, `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = true` | Hiện phần tồn kho cơ bản; dùng để đánh dấu vật tư phụ khi sửa/import dữ liệu |
| Hàng cuộn | `inventory_shape = roll`, `sell_method = linear_m`, `track_inventory = true` | Hiện nhãn tồn kho `Cuộn`; đơn vị mặc định `m` |
| Hàng tấm | `inventory_shape = sheet`, `sell_method = sheet`, `track_inventory = true` | Hiện nhãn tồn kho `Tấm`; đơn vị mặc định `tấm` |
| Combo - đóng gói | `inventory_shape = normal`, `sell_method = combo`, `track_inventory = false` | Ẩn phần tồn kho; hiện khu vực `Vật tư cấu thành` để nhập vật tư và định mức |

Form tạo mới ghi được `mã hàng`, `tên hàng`, `loại hàng`, `đơn vị`, `cách tính bán`, `trạng thái` và `giá vốn`. Nếu nhập trực tiếp một hàng mới mà không chọn loại đặc thù, mặc định là `Hàng thường`. `Giá bán` vẫn thuộc module Bảng giá: giá nhập ở đây chỉ được hiểu là giá bán chung/default khi backend đã nối Bảng giá; nếu không có giá theo nhóm khách thì POS lấy giá ở bảng giá chung. QC-OMS không dùng ảnh hàng hóa trong modal này.

Với `Combo - đóng gói`, người dùng nhập BOM cấp 1 ngay trong modal tạo hàng. Khi lưu, frontend tạo sản phẩm combo trước rồi gọi API lưu BOM cho sản phẩm vừa tạo. Khi bán combo, hệ thống không trừ tồn theo mã combo; tồn được trừ vào vật tư thành phần theo BOM active tại thời điểm chốt chứng từ. Sau khi combo đã tồn tại, người dùng vẫn có thể mở chi tiết dòng hàng trong danh sách để sửa BOM/version hiện hành.

Thuật ngữ combo dùng `Vật tư cấu thành`, không dùng `Hàng thành phần` để tránh nhầm với hàng thành phẩm/sản phẩm con. BOM không lưu cột chính/phụ trên từng dòng; vai trò vật tư được suy ra từ `product_kind` của vật tư. Chỉ có loại riêng `Vật tư phụ`; các vật tư còn lại được xem là vật tư chính.

Định mức vật tư chính hiện dùng theo BOM thiết lập/import ban đầu. Vật tư phụ có thể giữ định mức cũ từ KiotViet để tham khảo nhưng không bắt buộc nhập mới. Logic tự hiệu chỉnh định mức từ kiểm kho, sửa tồn, khui vật tư và lịch sử sản xuất sẽ làm ở phase sau sau khi chốt công thức nghiệp vụ.

Footer modal có `Bỏ qua`, `Lưu & tạo thêm` và `Lưu`. `Lưu` tạo xong đóng modal; `Lưu & tạo thêm` tạo xong reset form về loại `Hàng thường` và giữ modal mở để nhập tiếp. Không có checkbox `Bán trực tiếp` vì toàn bộ hàng tạo từ module này mặc định được bán trực tiếp nếu đang hoạt động.

## 5.1. Đơn vị và quy đổi

Nhiều đơn vị là nghiệp vụ thật, không phải phần phụ. File KiotViet `DanhSachSanPham_KV07072026-121648-951.xlsx` có các cột `ĐVT`, `Mã ĐVT Cơ bản`, `Quy đổi`; trong mẫu đã kiểm có 140 dòng có mã đơn vị cơ bản và 129 dòng có hệ số quy đổi khác `1`. Ví dụ:

- `Tấc` quy đổi về mã hàng/tấm cơ bản với hệ số `0.042`.
- `m tới` quy đổi về mã cơ bản với hệ số `0.5`.
- `Ram` giấy quy đổi `100` về đơn vị cơ bản.

Vì vậy tab/modal `Đơn vị & quy đổi` cần làm thật ở phase gần: lưu đơn vị cơ bản, đơn vị bán/mua phụ, hệ số quy đổi, đơn vị mặc định khi nhập mua và đơn vị mặc định khi bán. Trường `Cách tính bán` chỉ là rule tính tiền/trừ kho đi kèm đơn vị, không thay thế bảng quy đổi nhiều đơn vị.

---

## 6. Chi tiết hàng hóa

Khi click một dòng hàng hóa, chi tiết mở inline ngay dưới dòng đó bằng shell chung `management-detail-panel`, không mở trang riêng.

Tab chi tiết gồm:

| Tab | Mục đích |
|---|---|
| Thông tin | Thông tin chính của hàng hóa: mã, tên, loại hàng, đơn vị, cách tính bán, giá vốn, giá bán, loại tồn, trạng thái |
| Đơn vị & quy đổi | Đơn vị hiện tại, cách tính bán, loại tồn, danh sách đơn vị quy đổi, đơn vị mặc định khi mua và đơn vị mặc định khi bán. Nếu chưa có dữ liệu quy đổi thì hiển thị `Chưa có` |
| BOM/Vật tư cấu thành | Nhập/sửa định mức vật tư cho combo hoặc sản phẩm có BOM; combo có thể hiển thị tóm tắt vật tư ở tab `Thông tin`, nhưng nguồn sửa chính vẫn là tab này để tránh làm tab Thông tin quá nặng. Nếu có BOM nháp import từ KiotViet, tab này hiện `BOM nháp KiotViet`, số vật tư và cảnh báo cần rà soát trước khi kích hoạt |
| Tồn kho | Hiển thị dữ liệu tồn theo loại hàng. Nếu có tồn tạm import từ KiotViet, tab này hiện `Tồn tạm KiotViet` để đối soát, không xem là tồn kho vận hành và không thay thế stock movement |
| Thẻ kho | Bảng lịch sử biến động kho theo sản phẩm, dùng API stock movements hiện có |
| Ghi chú | Ghi chú nội bộ đơn giản; không ảnh hưởng POS, tồn kho, giá hoặc BOM |

QC-OMS không dùng ảnh đại diện trong chi tiết hàng hóa và không hiển thị tag `Bán trực tiếp`. Sản phẩm/dịch vụ `active` mặc định bán trực tiếp theo rule chung.

Tab `Thẻ kho` dùng layout bảng gần KiotViet để giữ quen tay: `Chứng từ`, `Thời gian`, `Loại giao dịch`, `Giá GD`, `Giá vốn`, `Số lượng`, `Tồn cuối`, `Đối tác`. `Chứng từ` là mã chứng từ làm thay đổi vật liệu/sản phẩm: hóa đơn bán (`HD...`), phiếu nhập (`PN...`) hoặc phiếu kiểm kho (`KK...`). `Đối tác` lấy theo chứng từ: bán thì là khách hàng, mua thì là nhà cung cấp. `Giá GD` lấy từ giá trên dòng giao dịch; `Giá vốn` MVP lấy từ giá nhập cuối hiện có của hàng hóa hoặc giá nhập của phiếu mua nếu có. `Tồn cuối` chưa hiển thị thật vì API chưa lưu/trả `balance_after`, nên vẫn hiện `Chưa có`.

Footer chi tiết dùng nhóm hành động chung. MVP chỉ giữ `Sửa` làm lối vào sau này khi UI sửa hàng hóa được chốt. QC-OMS không dùng `In tem mã` trong module Hàng hóa.

## 6.1. Chỉnh sửa hàng hóa

UI sửa dùng modal chung theo loại hàng, nhưng chỉ bật các khối phù hợp:

| Khối | Hàng thường | Dịch vụ | Cuộn/Tấm | Combo |
|---|---|---|---|---|
| Thông tin cơ bản: mã, tên, nhóm hàng, loại hàng, đơn vị | Có | Có | Có | Có |
| Giá vốn / giá bán chung | Có | Có | Có | Có |
| Đơn vị & quy đổi | Có | Có | Có | Có |
| Vật tư cấu thành | Ẩn, trừ khi sản phẩm có BOM được bật riêng | Ẩn | Ẩn, trừ khi được cấu hình BOM riêng | Có |
| Tồn kho nhanh | Có, khi sửa sẽ sinh phiếu kiểm kho tự động | Ẩn | Ẩn, sửa theo từng cuộn/tấm | Ẩn, tồn tính theo vật tư cấu thành |
| Kích thước/quy cách | Chỉ hiện khi có dữ liệu cần cho quy đổi | Ẩn | Có | Có nếu là quy cách gói |
| Vị trí kho, ảnh, mô tả dài, bán trực tiếp, in tem mã | Ẩn | Ẩn | Ẩn | Ẩn |
| Ghi chú đơn giản | Có thể hiện | Có thể hiện | Có thể hiện | Có thể hiện |

Nếu backend/API chưa có field, UI được phép hiện `Chưa có`, nhưng phải có lý do trong doc và không ghi dữ liệu giả.

## 6.2. Ảnh hưởng POS khi sửa hàng hóa

Sửa hàng hóa có thể ảnh hưởng POS ở các điểm sau:

- Đổi `status` sang ngưng bán: hàng biến mất khỏi tìm kiếm/chọn hàng trong POS, nhưng chứng từ cũ giữ snapshot cũ.
- Đổi tên/mã/đơn vị/cách tính bán: POS phải dùng dữ liệu mới cho đơn mới; chứng từ đã chốt vẫn dùng snapshot tại thời điểm bán.
- Đổi giá bán chung hoặc bảng giá nhóm khách: POS lấy giá theo nhóm khách trước, nếu không có thì fallback bảng giá chung. Nếu KiotViet import không có giá hoặc giá trống thì bỏ qua, không tạo giá rỗng.
- Đổi quy đổi đơn vị: ảnh hưởng tính tiền và trừ kho cho đơn mới. Cần giữ snapshot đơn vị/quy đổi trên dòng chứng từ để không làm sai hóa đơn cũ.
- Sửa BOM combo: chỉ ảnh hưởng đơn mới hoặc dòng POS chưa chốt. Đơn/chứng từ đã chốt phải giữ BOM snapshot cũ.
- Sửa tồn hàng thường: phải tạo phiếu kiểm kho tự động, ghi stock movement và thẻ kho. POS sau đó đọc tồn mới.
- Sửa cuộn/tấm: không sửa tổng tồn trong modal hàng hóa; phải qua luồng đối tượng cuộn/tấm để tránh sai khui/cắt/tấm lỡ.

Quyền sửa hàng hóa nên tách riêng nếu chưa có permission phù hợp. Tên đề xuất: `perm.manage_products` cho tạo/sửa danh mục hàng hóa và `perm.manage_inventory` cho sửa tồn/kiểm kho. Nếu vai trò nghiệp vụ chưa rõ, chỉ cấp quyền mới cho admin cho tới khi phân quyền được chốt.

---

## 7. Trạng thái chung

| Trạng thái | UI |
|---|---|
| Loading | Skeleton cho sidebar và table, không dùng spinner che toàn màn hình |
| Empty | Hiển thị trạng thái trống trong vùng bảng; nhân viên nội bộ MVP thấy nút tạo mới/thao tác chính |
| Filter empty | Báo không có kết quả với bộ lọc hiện tại, cho phép xóa lọc |
| Error | Banner lỗi ở vùng workspace, có nút thử lại |
| Permission denied | Chỉ dành cho tài khoản hạn chế đặc biệt hoặc truy cập nhầm vùng quản trị; nhân viên nội bộ MVP mặc định thấy đầy đủ thao tác kho chính |

---

## 8. Acceptance Criteria UX

1. Người dùng nhìn vào module biết đang ở Hàng hóa, có lối vào tồn kho/kiểm kho rõ ràng, không lẫn với POS bán hàng.
2. Desktop hiển thị sidebar lọc và bảng cùng lúc.
3. Người dùng lọc được hàng đang kinh doanh/ngưng bán.
4. Hàng ngưng bán không xuất hiện ở POS, nhưng vẫn thấy được ở module này qua bộ lọc.
5. Hàng cuộn/tấm có lối mở nhanh tới đối tượng vật lý bên dưới.
6. Kiểm kho có lối vào rõ từ module Hàng hóa.
7. Tạo hàng hóa dùng một modal chung, đổi trường và khu vực theo loại hàng đã chọn.
8. Chi tiết hàng hóa mở inline. Tab thật tách `Thông tin`, `Đơn vị & quy đổi`, `BOM/Vật tư cấu thành`, `Tồn kho`, `Thẻ kho`, `Ghi chú`; mỗi tab chỉ tải dữ liệu cần dùng. `Ghi chú` là tab nhẹ, không ảnh hưởng nghiệp vụ lõi.

---

← [Quay về Inventory README](./README.md)
