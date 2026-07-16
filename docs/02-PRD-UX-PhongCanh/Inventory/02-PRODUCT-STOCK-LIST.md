# PRODUCT-STOCK-LIST — Danh sách hàng hóa & tồn kho

> **Nguồn tham khảo UI:** KiotViet trang Hàng hóa; điều chỉnh theo nghiệp vụ QC-OMS.

---

## 0. Ghi nhận từ KiotViet

Quan sát ngày `01/07/2026` trên trang `Hàng hóa`:

- Bộ lọc trạng thái mặc định là `Hàng đang kinh doanh`.
- Danh sách có `381 hàng hóa (495 mã hàng)`.
- Có dòng tổng phía trên danh sách để tổng hợp tồn kho. KiotViet có thêm chỉ số `khách đặt`, nhưng QC-OMS không dùng đặt hàng trong MVP.
- Các bộ lọc KiotViet gồm: nhóm hàng, tồn kho, dự kiến hết hàng, thời gian tạo, nhà cung cấp, thương hiệu, vị trí, loại hàng, bán trực tiếp, liên kết kênh bán, trạng thái hàng hóa.
- Cột mặc định gồm: mã hàng, tên hàng, giá bán, giá vốn, tồn kho, khách đặt, thời gian tạo, dự kiến hết hàng.

Export KiotViet file `DanhSachSanPham_KV07072026-121648-951.xlsx` dry-run ngày `2026-07-07` có `657` dòng:

- `646` dòng hợp lệ để import bước đầu.
- `11` dòng thiếu `ĐVT`, cần Owner review trước khi import thật.
- `455` hàng hóa thường.
- `181` combo/đóng gói theo cột `Loại hàng`.
- `10` dịch vụ.
- `35` nhóm hàng từ cột `Nhóm hàng(3 Cấp)`.
- `140` cấu hình đơn vị quy đổi từ `ĐVT`, `Mã ĐVT Cơ bản`, `Quy đổi`.
- `646` dòng có tồn kho import được ghi nhận ở dry-run để phục vụ tồn tạm/soát dữ liệu.
- Cột `Hàng thành phần` trong file này không có nội dung BOM đọc được, nên BOM import phải bổ sung nguồn định mức khác hoặc nhập/sửa trong UI `Vật tư cấu thành`.

Export KiotViet file thật `DanhSachSanPham_KV09072026-215404-812.xlsx` được Owner cung cấp ngày `2026-07-09` có `657` dòng. Quyết định phạm vi sau khi đối chiếu file:

- File có `517` sản phẩm chính và `140` dòng đơn vị quy đổi. Dòng có `Quy đổi` là đơn vị phụ của mã ở `Mã ĐVT Cơ bản`, không tạo sản phẩm riêng. Footer danh sách đi theo kiểu KV: `517 hàng hóa (657 mã hàng)`.
- Cột `Đang kinh doanh` trong file thật có đủ giá trị: `1` là đang kinh doanh, `0` là ngừng kinh doanh. Parser phải giữ đúng cột khi gặp ô Excel tự đóng như `<c ... />`; nếu đọc lệch cột sẽ nhìn nhầm thành ô trống.
- Không quản lý `Thương hiệu` trong QC-OMS. File có 49 dòng thương hiệu nhưng không đưa vào DB/filter/UI.
- Cần quản lý `Tồn kho`; không quản lý `Tồn nhỏ nhất` và `Tồn lớn nhất`.
- `Dự kiến hết hàng` làm sau khi import đủ dữ liệu thật. Logic phải dùng tồn kho và lịch sử sử dụng/bán hàng cũ để tính tốc độ tiêu thụ, không dùng cứng chuỗi KV như `15 ngày`.
- Không thêm filter `Được bán trực tiếp` vì mô hình hiện tại chỉ bán trực tiếp; hàng `active` được xem là bán được.
- Không quản lý `Vị trí`; cột này trong file đang trống.
- `Nhà cung cấp` không lấy từ file hàng hóa này vì file không có cột NCC. Quan hệ hàng hóa - nhà cung cấp sẽ suy ra từ nhập hàng/phiếu nhập; một hàng có thể có nhiều nhà cung cấp.

Áp dụng cho QC-OMS:

- Giữ bộ lọc trạng thái để xem được hàng ngưng bán trong module Hàng hóa.
- Giữ `dự kiến hết hàng` ở mức cột cảnh báo tồn thấp nếu công thức đơn giản; có thể để sau nếu chưa có tốc độ bán ổn định.
- Giữ đơn vị tính và nhóm hàng là dữ liệu nền.
- Nhóm hàng cần làm thật cho import/lọc danh mục. Nếu chưa kịp triển khai ngay, hàng import/tạo mới dùng nhóm mặc định và giá bán fallback về giá chung.
- Nhiều đơn vị/quy đổi cần làm thật. File KV có `ĐVT`, `Mã ĐVT Cơ bản`, `Quy đổi`; đây là nền để mua một đơn vị nhưng bán/trừ kho theo đơn vị khác.
- Không tạo field/module riêng cho thương hiệu hoặc kênh bán trong MVP.
- Không đưa barcode/QR scan, tự động gợi ý thông tin hàng hóa, thuộc tính retail hoặc bảo hành/bảo trì vào MVP.
- Nhà cung cấp chỉ đưa vào sau khi Purchase/phiếu nhập có dữ liệu thật. Quan hệ đúng là nhiều-nhiều giữa hàng hóa và nhà cung cấp, không dùng một `primary_supplier_id` duy nhất làm nguồn sự thật. Không làm vị trí kho trong scope hiện tại.
- Tồn âm là dữ liệu thực tế nên danh sách/báo cáo cần hiển thị rõ để xử lý, không ẩn.
- Cột `Vật tư cấu thành` xác nhận BOM/định mức là nghiệp vụ thật. QC-OMS hiện hỗ trợ nhập/sửa BOM cấp 1 khi tạo combo và trong chi tiết hàng hóa. Import script hiện import nhóm/hàng/đơn vị quy đổi qua public API và report BOM/tồn tạm trong dry-run; bulk import BOM/tồn tạm cần API riêng trước khi bật import thật cho phần này.

---

## 1. Mục đích

Màn danh sách hàng hóa là nơi nhân viên quản lý hàng hóa và xem tồn kho tổng quan.

Màn này không thay thế POS bán hàng. Sản phẩm ngưng bán vẫn xem và xử lý kho được tại đây, nhưng không xuất hiện trong POS.

---

## 2. Bố cục

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Hàng hóa        [Search mã/tên hàng +]                                           │
├───────────────────────┬────────────────────────────────────────────────────────────┤
│ Loại hàng             │ □ | ☆ | Mã hàng | Tên hàng | Giá vốn | Giá bán         │
│ [Tất cả v]            │ ---------------------------------------------------------- │
│                       │ DECAL   | Decal PP | 0              | m²     | Chưa có     │
│                       │ Mở dòng: Thông tin | Đơn vị & quy đổi | BOM | Tồn kho     │
│ Trạng thái hàng hóa   │                                                            │
│ [Đang kinh doanh v]   │                                                            │
└───────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 3. Bộ lọc MVP

| Bộ lọc | Hành vi |
|---|---|
| Tìm kiếm | Ô search dùng shared compact search, tìm bỏ dấu theo mã hàng/tên hàng, nhóm/loại tồn và tồn hiện tại nếu API/list có dữ liệu. Khi nhập từ khóa, lọc trực tiếp danh sách chính; không hiển thị dropdown/listbox gợi ý dưới ô tìm. Nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung. |
| Nhóm hàng | Tất cả hoặc một nhóm hàng cụ thể. UI gửi `product_group_id`; nếu hàng chưa chọn nhóm thì backend gán nhóm mặc định `Giá chung`. |
| Tồn kho | Tất cả, hàng thường, cuộn, tấm. UI gửi `inventory_shape`; backend lọc theo `products.inventory_shape`. Đây là filter kiểu tồn, không phải filter tồn nhỏ nhất/lớn nhất. |
| Thời gian tạo | Mặc định `Toàn thời gian`. UI dùng control thời gian chung giống Hóa đơn/Kiểm kho: nút chọn nhanh theo ngày/tuần/tháng/quý/năm, hai ô từ ngày/đến ngày luôn hiển thị, không còn radio `Tùy chỉnh`. Ô hiển thị `dd/MM/yyyy` như KV; icon lịch mở popup bên phải cột filter như menu chọn nhanh và không chồng popup khác. Frontend/service vẫn gửi `created_from` và `created_to` dạng `YYYY-MM-DD`; backend lọc theo `products.created_at`. Khi đang ở preset hiện tại, ô đến ngày chỉ hiển thị tối đa hôm nay; `Toàn thời gian` hiển thị khoảng ngày có dữ liệu nếu xác định được. |
| Loại hàng | Tất cả, hàng thường, dịch vụ, vật tư phụ, cuộn, tấm, combo. UI gửi `product_kind`; backend lưu ở `products.product_kind`. |
| Trạng thái hàng hóa | Đang kinh doanh, ngưng bán, tất cả, đã xoá KV |

Sau import dữ liệu thật có thể bổ sung `Dự kiến hết hàng` bằng thuật toán tiêu thụ theo lịch sử. Sau khi Purchase đủ dữ liệu có thể bổ sung filter `Nhà cung cấp` lấy từ phiếu nhập. Không tạo bộ lọc thương hiệu/vị trí/kênh bán/bán trực tiếp riêng; nếu cần nhận diện thương hiệu thì ghi trong tên/mã/nhóm hàng.

Không có bộ lọc barcode/thuộc tính retail/bảo hành trong MVP.

---

## 4. Cột bảng MVP

| Cột | Ghi chú UX |
|---|---|
| Checkbox | Dùng pattern checkbox nhỏ giống Sổ quỹ; hiện chọn dòng/chọn tất cả, thao tác hàng loạt để sau |
| Sao ưu tiên | Dùng pattern sao giống Sổ quỹ; bấm sao dòng để lưu ưu tiên cục bộ, bấm sao header để lọc hàng ưu tiên trên trang hiện tại |
| Mã hàng | Link mở chi tiết |
| Tên hàng | Hiển thị tên hàng |
| Giá vốn | Giá vốn gần nhất để tham khảo; giá bán nằm ở Bảng giá |
| Giá bán | Đọc từ `price_list_items` của bảng giá mặc định; hiện `Chưa có` nếu sản phẩm chưa có dòng giá |
| Tồn kho | Ưu tiên `Tồn QCVL` từ `stock_movements`; nếu chưa có movement nhưng có `Tồn KV tạm nhập` thì hiển thị số KV để V1 không trống, còn chi tiết phải ghi rõ đây là dữ liệu đối chiếu |
| Đơn vị | Đơn vị bán/lưu chính |
| Dự kiến hết hàng | Hiện `Chưa có`; cần logic tốc độ bán/tồn kho nên làm sau |
Không có cột trạng thái bán hoặc thao tác nhanh trên danh sách. Trạng thái bán và các thao tác sửa/ngưng bán/mở bán sẽ nằm trong vùng chi tiết hàng hóa để tránh nhầm ý nghĩa của trạng thái bán.

Mã hàng lịch sử KiotViet có hậu tố `{DEL}` được xem qua trạng thái `Đã xoá KV`. Dữ liệu này giữ để mở chứng từ/kiểm kho/công nợ cũ còn tham chiếu mã đã xoá bên KiotViet; không đưa vào POS, khui vật tư, tạo BOM mới hoặc các luồng bán hàng hiện tại.

Shared management layout:

- danh sách Hàng hóa dùng `ManagementDataTable`, không render table riêng;
- cột checkbox dùng helper chung `ManagementTableCheckboxControl`;
- cột sao ưu tiên dùng helper chung `ManagementTableFavoriteButton`;
- từng field bộ lọc vẫn khai báo theo nghiệp vụ Hàng hóa trong `ManagementFilterSidebar`; bước kế tiếp của shared UI là gom metadata field filter chung cho select/date/range.

Không có cột/filter `Cách tính bán` ở danh sách chính. Rule này vẫn lưu trong sản phẩm để POS/bảng giá/kho tính đúng, nhưng chỉ hiện trong modal tạo/sửa và tab `Đơn vị & quy đổi`.

Với `roll` và `sheet`, cột Tồn kho không cho sửa trực tiếp. Người dùng phải mở chi tiết đối tượng.

---

## 5. Tạo mới và chi tiết

Nút `+` trong ô tìm kiếm mở modal `Tạo hàng hóa` dùng chung cho:

- hàng thường
- dịch vụ
- hàng cuộn
- hàng tấm
- combo - đóng gói

Modal không có ảnh hàng hóa, không có tab mô tả disabled và không có checkbox `Bán trực tiếp`; hàng `active` mặc định được bán trực tiếp. Với combo, người dùng nhập `Vật tư cấu thành` ngay trong modal gồm vật tư và định mức. Khi lưu, frontend tạo sản phẩm trước rồi lưu BOM cấp 1 cho sản phẩm vừa tạo. Khi bán combo, tồn được trừ vào vật tư cấu thành theo BOM, không trừ theo chính mã combo.

`Vật tư cấu thành` tách khỏi khái niệm hàng thành phẩm/sản phẩm con. Bảng BOM không có cột chính/phụ; `Vật tư phụ` là loại hàng riêng, còn mọi vật tư khác được xem là vật tư chính. Vật tư chính dùng định mức BOM ban đầu. Vật tư phụ có thể giữ định mức cũ khi import KiotViet để tham khảo, nhưng phase sau sẽ tự tính lại sau các lần khui vật tư phụ. Vật tư chính cũng có thể được tự hiệu chỉnh định mức sau kiểm kho, sửa tồn, khui vật tư và lịch sử sản xuất, nhưng công thức nghiệp vụ chưa chốt nên chưa làm ở MVP.

Khi click mã hàng hoặc dòng hàng, chi tiết mở inline dưới dòng bằng tab:

| Tab | Nội dung MVP |
|---|---|
| Thông tin | Mã, tên, loại hàng, đơn vị, cách tính bán, giá vốn, giá bán, loại tồn, trạng thái |
| Đơn vị & quy đổi | Đơn vị hiện tại, cách tính bán, loại tồn, danh sách đơn vị quy đổi nếu API có dữ liệu |
| BOM/Vật tư cấu thành | Nhập/sửa BOM cấp 1, tạo version BOM hiện hành; bảng hiển thị mã vật tư, tên vật tư, định mức, đơn vị, giá vốn tạm và trạng thái dòng suy ra từ `product_kind` |
| Tồn kho | Hàng thường có form nhập `Tồn thực tế` + `Lý do điều chỉnh`; lưu xong tự sinh phiếu kiểm kho và hiện link `Xem phiếu`. Cuộn/tấm hiển thị bảng object-level theo từng cuộn/tấm, không sửa tổng tồn. Combo/dịch vụ không sửa tồn tại đây. |
| Thẻ kho | Bảng lịch sử biến động kho theo sản phẩm |
| Ghi chú | Ghi chú nội bộ đơn giản, không ảnh hưởng POS/tồn/giá/BOM |

Chi tiết không dùng ảnh đại diện, không hiện tag `Bán trực tiếp`, không làm mô tả dài trong scope hiện tại và không có nút `In tem mã`. Tab `Ghi chú` được giữ vì đơn giản và không ảnh hưởng luồng chính.

Tab `Thẻ kho` hiển thị table riêng, phân trang 15 dòng/lần, với cột: `Chứng từ`, `Thời gian`, `Loại giao dịch`, `Giá GD`, `Giá vốn`, `Số lượng`, `Tồn cuối`, `Đối tác`. `Chứng từ` là mã hóa đơn bán, phiếu nhập hoặc phiếu kiểm kho làm thay đổi vật tư này. `Đối tác` map từ chứng từ: khách hàng với hóa đơn bán, nhà cung cấp với phiếu nhập. `Giá GD` là giá trên dòng giao dịch; `Giá vốn` dùng giá nhập cuối/giá nhập hiện có theo dữ liệu backend. `Tồn cuối` vẫn hiện `Chưa có` cho tới khi stock movement có `balance_after`.

---

## 6. Search

Search hỗ trợ:

- mã hàng
- tên hàng
- tìm không dấu nếu backend hỗ trợ

Search trong module này có thể tìm cả hàng ngưng bán nếu bộ lọc trạng thái cho phép.

---

## 7. Thao tác chính

Preset `Nhân viên nội bộ` trong MVP mặc định có đủ quyền cho các thao tác hàng hóa/kho thường ngày. Cột điều kiện dưới đây là guard kỹ thuật cho tài khoản hạn chế đặc biệt, không phải yêu cầu admin phải chia quyền nhỏ khi vận hành xưởng.

| Thao tác | Điều kiện |
|---|---|
| Tạo mới hàng hóa | Nhân viên nội bộ/Quản trị; tài khoản hạn chế cần quyền quản lý danh mục/sản phẩm |
| Import file | Nhân viên nội bộ/Quản trị; tài khoản hạn chế cần quyền quản lý danh mục/sản phẩm |
| Xuất file | Nhân viên nội bộ/Quản trị; có thể yêu cầu xác thực lại nếu bật bảo vệ xuất file |
| Sửa hàng hóa | Nhân viên nội bộ/Quản trị; tài khoản hạn chế cần quyền quản lý danh mục/sản phẩm |
| Sửa tồn hàng thường | Nhân viên nội bộ/Quản trị; tự sinh phiếu kiểm kho |
| Mở tồn cuộn/tấm | Hàng thuộc loại tồn Cuộn hoặc Tấm |
| Tạo phiếu kiểm kho | Nhân viên nội bộ/Quản trị; tài khoản hạn chế cần quyền quản lý kho |

Nếu permission danh mục chưa rõ, tạo quyền riêng `perm.manage_products` cho tạo/sửa hàng hóa/nhóm hàng/đơn vị quy đổi và chỉ cấp admin trước. Các thao tác sửa tồn/kiểm kho vẫn dùng `perm.manage_inventory`.

---

## 8. Hành vi sửa tồn từ danh sách

- Hàng `normal`: cho phép sửa tồn trong tab inline `Tồn kho`.
- Form yêu cầu `Tồn thực tế` và `Lý do điều chỉnh`.
- Khi lưu thành công, UI hiển thị `Đã tạo phiếu kiểm kho <mã phiếu>` và link `Xem phiếu`.
- Backend gọi `POST /api/v1/inventory/products/{product_id}/adjust-stock`, tự sinh phiếu kiểm kho `source_type = product_edit`, `status = balanced`.
- Hàng `roll`: nút sửa tổng tồn bị ẩn hoặc disabled, tooltip: `Hàng cuộn sửa theo từng cuộn`.
- Hàng `sheet`: nút sửa tổng tồn bị ẩn hoặc disabled, tooltip: `Hàng tấm sửa theo từng tấm/tấm lỡ`.
- Tab `Tồn kho` của hàng `roll`/`sheet` hiển thị bảng `Tồn theo cuộn tấm` gồm loại đối tượng, mã đối tượng, khổ rộng, chiều dài, diện tích và trạng thái.
- Hàng `combo` không sửa tồn mã combo; bán combo trừ vật tư cấu thành theo BOM.
- Hàng `service` không quản lý tồn.

---

## Import KiotViet nhiều lần

Trang Hàng hóa có nút `Import` ở cụm thao tác phía phải của toolbar. Luồng chuẩn:

1. Chọn file `.xlsx` xuất từ KiotViet.
2. Bấm `Xem trước`.
3. Kiểm tra tổng dòng, dòng hợp lệ, dòng lỗi, số tạo mới và số cập nhật.
4. Nếu cần kiểm tra lại từ đầu, bấm nút riêng `Xóa dữ liệu cũ` trong dialog import. Nút này xóa dữ liệu import cũ của trang hiện tại trước, không nằm trong luồng `Xem trước`/`Import`.
5. Chỉ bấm `Import` sau khi preview không còn dòng lỗi.

Import dùng `Mã hàng` của dòng sản phẩm chính làm khóa upsert trong cùng organization. Dòng có `Quy đổi` và `Mã ĐVT Cơ bản` trỏ về mã cha là đơn vị quy đổi, không tạo sản phẩm riêng. Import lại nhiều lần cập nhật sản phẩm cũ theo mã, tạo sản phẩm mới khi mã chưa có, và không tự xóa sản phẩm vắng trong file mới.

`Thời gian tạo` trong file KiotViet là ngày tạo sản phẩm gốc, không phải ngày import vào QCVL. File KV có thể trả ô này dạng số Excel serial như `46204.42164644676`; server import phải normalize thành ISO date và ghi vào `products.created_at`. Khi import lại cùng `Mã hàng`, nếu file có thời gian gốc hợp lệ thì QCVL cập nhật lại `products.created_at` để sửa các dòng cũ từng bị ghi theo thời điểm import. Bộ lọc `Thời gian tạo` chỉ đúng sau khi dữ liệu đã được import lại bằng rule này.

Nếu trình duyệt không hỗ trợ giải nén `.xlsx` bằng `DecompressionStream`, frontend không tự parse file mà gửi `file_base64` lên API để server parse. Vì vậy lỗi không xem trước trong Codex/browser cũ không được xử lý bằng cách đổi server dev/prod; phải giữ fallback server-side parse.

Phase hiện tại ghi: nhóm hàng, mã hàng, tên hàng, loại hàng, kiểu tồn kho, cách bán, đơn vị, giá vốn gần nhất, trạng thái kinh doanh, `Giá bán` vào bảng giá mặc định, và `Tồn kho` vào `Tồn KV tạm nhập`.

Nếu dòng thiếu `ĐVT`, import không chặn dòng đó. Hệ thống gán tạm `unit_name = Cần cập nhật`, preview báo số dòng cần sửa lại, và người dùng có thể vào chi tiết hàng hóa sửa đơn vị sau. Không dùng `NULL` cho đơn vị vì DB/POS cần giá trị hiển thị ổn định.

Phase hiện tại chưa ghi: `Dự kiến hết hàng`. Phần này phải làm bằng luồng riêng có truy vết: dự báo theo lịch sử dùng hàng.

`Hàng thành phần` dạng `Mã:Định mức|Mã:Định mức` được parse thành BOM nháp trong `product_boms`/`product_bom_items`. BOM import từ KiotViet luôn để `status = draft` và ghi chú `Review before activating`; không tự kích hoạt để tránh POS trừ kho theo định mức cũ chưa rà soát.

`Tồn kho` từ file KiotViet được lưu vào `inventory_provisional_balances` với `source_type = kiotviet_import`. UI gọi rõ là `Tồn KV tạm nhập`. Đây là dữ liệu đối chiếu, không phải mốc khởi tạo tồn, không tự dựng cuộn/tấm vật lý và không thay thế `stock_movements`. Import lại cùng mã cập nhật số đối chiếu của mã đó theo file mới nhất.

Danh sách hàng hóa phải trả kèm metadata rà soát import. Bảng chính dùng cột `Tồn QCVL`: nếu `operating_stock` có dữ liệu thì hiển thị tồn vận hành QCVL; nếu chưa có `operating_stock` nhưng có `kiotviet_provisional_stock` thì fallback hiển thị số tồn KV tạm nhập để nhân viên thấy dữ liệu đã import. Tab `Tồn kho` vẫn phải tách nhãn rõ `Tồn QCVL` và `Tồn KV tạm nhập`, số lượng và đơn vị từ `inventory_provisional_balances`, kèm trạng thái `Dữ liệu đối chiếu`. Tab `BOM/Vật tư cấu thành` hiển thị `BOM nháp KiotViet`, số vật tư và trạng thái `Cần rà soát trước khi kích hoạt`. Hai phần này chỉ là dữ liệu thật để kiểm tra sau import, không được dùng thay cho tồn kho/BOM active trong POS.

Tồn vận hành đúng phải tính từ một mốc mở đã xác nhận cộng/trừ lịch sử sau mốc. Mốc mở có thể là một phiếu kiểm kho ban đầu từ KiotViet nếu Owner chọn rõ mã phiếu/ngày chốt. Sau mốc đó, phiếu nhập làm tăng tồn, hóa đơn bán làm giảm tồn, trả hàng đảo chiều tồn, kiểm kho/cân bằng kho điều chỉnh chênh lệch, và thao tác cuộn/tấm/object ghi movement riêng. Cân bằng kho thuộc màn `Phiếu kiểm kho`, không nằm trong danh sách Hàng hóa. Khi chưa đủ mốc mở và luồng chứng từ sau mốc, `/products` không được gọi `inventory_provisional_balances` là tồn kho chính thức hoặc mốc ban đầu.

Thứ tự phụ thuộc để hoàn thiện tồn vận hành:

1. Khách hàng phải ổn trước hóa đơn/POS ở mức chọn đúng khách, import đúng mã, map `khachle` và giữ dữ liệu khách nền. `Lịch sử bán/trả hàng` và `Nợ cần thu` chi tiết của khách làm sau, không chặn mục tiêu tồn Hàng hóa.
2. Nhà cung cấp phải ổn trước nhập hàng, vì phiếu nhập cần NCC và lịch sử nhập là nguồn đúng để suy ra NCC của từng hàng.
3. Chọn phiếu kiểm kho KV ban đầu làm mốc mở nếu Owner xác nhận đó là lần kiểm tin cậy đầu tiên.
4. Nhập hàng sau mốc ghi movement tăng tồn.
5. Hóa đơn/POS sau mốc ghi movement giảm tồn.
6. Trả hàng sau mốc ghi movement đảo chiều phù hợp.
7. Kiểm kho/cân bằng kho sau mốc ghi movement điều chỉnh.
8. Hàng hóa chỉ hiển thị tồn QCVL tính được và so sánh với `Tồn KV tạm nhập`; không tự sinh tồn vận hành.

### Lộ trình tồn vận hành hiện tại 2026-07-12

Mục tiêu hoàn thiện `Hàng hóa` là hiển thị tồn vận hành đúng. Không lấy `Tồn kho` từ export Hàng hóa KiotViet làm mốc. Riêng phiếu kiểm kho KV ban đầu có thể được dùng làm mốc mở nếu Owner chọn rõ và xác nhận bỏ qua chứng từ trước mốc khi tính tồn hiện tại.

Công thức nguồn:

`Tồn QCVL = tồn mở từ phiếu kiểm kho KV đã chọn + nhập hàng sau mốc - hóa đơn/POS sau mốc +/- trả hàng, kiểm kho và thao tác vật lý sau mốc`

Quy tắc hiển thị:

- Bảng và chi tiết hàng hóa được phép hiển thị `Tồn KV tạm nhập`, nhưng phải gọi là dữ liệu đối chiếu.
- V1 cho phép cột `Tồn QCVL` fallback hiển thị `Tồn KV tạm nhập` khi chưa có `stock_movements`, để 3200/3202 không hiện trống sau import. Đây chỉ là hiển thị tạm; logic POS/kho vẫn không được dùng số này làm tồn vận hành.
- Khi chưa đủ movement, không đổi nhãn `Tồn KV tạm nhập` thành `Tồn kho`, `Tồn hiện tại`, hoặc tồn chính thức.
- Nếu chưa chọn mốc mở, tồn QCVL phải thể hiện là chưa chốt thay vì lấy `Tồn KV tạm nhập` lấp vào.
- Khi đã chọn mốc mở, chỉ chứng từ sau ngày mốc được cộng/trừ vào tồn hiện tại. Chứng từ trước mốc chỉ lưu lịch sử/đối chiếu để tránh tính hai lần.
- `Nhà cung cấp` của hàng lấy từ lịch sử phiếu nhập, không lấy từ file hàng hóa KiotViet.
- `Dự kiến hết hàng` chỉ làm sau khi có lịch sử nhập/bán/stock movement đáng tin.

Thứ tự làm tiếp:

1. Rà `Khách hàng` đủ dùng cho hóa đơn/POS và `Khách lẻ`: mã khách, tên, SĐT, loại khách, người tạo, import/cleanup và chọn khách. Không làm sâu `Lịch sử bán/trả hàng` hoặc `Nợ cần thu` ở bước này.
2. Rà `Nhà cung cấp` đủ dùng cho phiếu nhập và công nợ NCC.
3. Chọn/ghi nhận phiếu kiểm kho KV ban đầu làm mốc mở khi bắt đầu xây công thức tồn.
4. Phiếu nhập posted sau mốc ghi `stock_movements` tăng tồn. Dev-memory import KiotViet posted đã đọc được movement tăng tồn; cần nối tiếp DB thật khi làm migration/persistence.
5. Cho hóa đơn/POS posted sau mốc ghi `stock_movements` giảm tồn. Đây là bước tiếp theo để tồn không chỉ có chiều cộng.
6. Cho trả hàng sau mốc ghi movement đảo chiều.
7. Cho kiểm kho/cân bằng kho sau mốc ghi adjustment rõ ràng.
8. Quay lại `/products` để hiển thị tồn QCVL tính được và cột so sánh KV.

Tab `Tồn kho` cũng hiển thị `Kiểm kho KiotViet gần nhất` nếu đã import file kiểm kho. Trường API là `latest_kiotviet_stocktake`, hydrate từ `stocktakes`/`stocktake_items` có `source_type = kiotviet_import` và `source_system = kiotviet`. Phần này chỉ là bằng chứng đối soát: hiển thị mã phiếu, ngày, số lượng thực tế, số lệch. Tuyệt đối không lấy `actual_qty` của phiếu kiểm kho để ghi đè `inventory_provisional_balances` hoặc tồn vận hành.

`Giá bán` không lưu trong `products`. Import Hàng hóa chỉ là điểm nhập dữ liệu nhanh; backend phải ghi vào `price_list_items` của bảng giá mặc định và API danh sách hàng hóa trả `default_sale_price` để UI hiển thị.

Các cột đã thống nhất bỏ qua: `Thương hiệu`, `Vị trí`, `Tồn nhỏ nhất`, `Tồn lớn nhất`, `Được bán trực tiếp`, ảnh, trọng lượng, mô tả dài và mẫu ghi chú.

`Nhà cung cấp` không lấy từ file hàng hóa KiotViet. Sau này lấy từ phiếu nhập, vì một hàng có thể có nhiều nhà cung cấp.

`Xóa dữ liệu cũ` thay thế checkbox xóa dữ liệu mẫu. Trên Hàng hóa, backend xóa dữ liệu phụ KiotViet (`inventory_provisional_balances.source_type = kiotviet_import`, BOM nháp KiotViet, giá import) và chỉ xóa sản phẩm nếu không còn tham chiếu nghiệp vụ thật. Nếu sản phẩm đang được hóa đơn/phiếu nhập/sổ kho/BOM thật dùng, backend phải trả `blocked_rows` để người dùng biết còn dữ liệu chưa thể xóa.

---

## Ghi chú triển khai 2026-07-10

- Import KiotViet không chỉ hiển thị quy đổi ở UI. Backend phải ghi đơn vị tồn chính vào `inventory_units`, cấu hình tồn vào `product_inventory_settings`, đơn vị phụ vào `product_unit_conversions`, tồn tạm vào `inventory_provisional_balances`, và BOM nháp vào `product_boms`/`product_bom_items`.
- `GET /api/v1/products` phải đọc `unit_conversions` từ `product_unit_conversions`; không được trả `[]` giả khi DB đã có dữ liệu.
- `GET /api/v1/products` phải trả `kiotviet_provisional_stock`, `latest_kiotviet_stocktake` và `draft_bom` nếu có dữ liệu import cần rà soát. UI chỉ hiển thị ở tab chi tiết, không kích hoạt nghiệp vụ kho/POS.
- Bộ lọc `Thời gian tạo` của Hàng hóa đã làm thật trên dev ngày `2026-07-10`: vỏ dùng class chung `management-filter-time-options`, `management-filter-quick-time-menu`, `management-filter-date-range`; ruột đi qua `CatalogPage.load` -> `catalog-service.ts` -> API `GET /products?created_from=&created_to=` -> repository lọc `products.created_at`.
- Khi import lại cùng file, quy đổi hiện có được upsert theo `(organization_id, product_id, sale_unit_id)`. Quy đổi không còn trong file hiện tại của sản phẩm được chuyển `is_active = false`, không xóa cứng.
- Footer danh sách giữ chuẩn KV theo filter hiện tại: `hàng hóa` là số sản phẩm chính, `(mã hàng)` là sản phẩm chính cộng đơn vị quy đổi active.

---

## 9. Acceptance Criteria UX

1. Người dùng lọc được hàng ngưng bán tại module Hàng hóa.
2. Search module Hàng hóa không bị giới hạn như POS.
3. Hàng cuộn/tấm có nhãn loại tồn dễ thấy.
4. Người dùng không thể sửa tổng tồn trực tiếp cho cuộn/tấm.
5. Sửa tồn hàng thường hiển thị rõ việc sẽ sinh phiếu kiểm kho tự động.
6. Bảng vẫn đọc được ở desktop 1366px, không lấy layout hẹp làm chuẩn.
7. Danh sách chính không có cột/filter `Cách tính bán`, nhưng chi tiết/form vẫn giữ rule này.
8. Các field chưa có API phải hiện `Chưa có` hoặc bị ẩn theo scope; không hiển thị dữ liệu giả.

---

← [Quay về Inventory README](./README.md)
