# Purchase UI — Nhà cung cấp và nhập hàng

> **Vai trò:** PRD/UX Source of Truth mức khung.
> **Business:** [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md)

---

## 1. Nguyên tắc UX

QC-OMS tham khảo KiotViet nhưng đơn giản hơn:

- một màn danh sách nhà cung cấp
- một màn danh sách phiếu nhập
- một form tạo/sửa phiếu nhập trực tiếp
- không hiển thị đặt hàng nhập, trả hàng nhập, HĐĐT/VAT trong lát cắt đầu tiên

Mục tiêu thao tác là nhập đúng hàng thật mua vào, đặc biệt là cuộn/tấm vật lý.

Ghi nhận từ KiotViet:

- `Nhà cung cấp` có tìm theo mã/tên/số điện thoại, cột mã NCC, tên, điện thoại, email, nợ hiện tại, tổng mua.
- `Nhập hàng` có danh sách phiếu theo mã phiếu, thời gian, mã NCC, nhà cung cấp, cần trả NCC, trạng thái.
- Form nhập hàng có tìm hàng theo mã/tên, chọn/tạo nhanh NCC, mã phiếu tự động, số hóa đơn/chứng từ đầu vào dạng text, dòng hàng gồm số lượng, đơn giá, giảm giá, thành tiền.
- QC-OMS giữ các phần này, nhưng bỏ đặt hàng nhập, trả hàng nhập, VAT/HĐĐT và hiệu lực phức tạp trong lát cắt đầu.

Các danh sách quản trị trong module Purchase phải dùng chung layout `management-*` giống Customers:

- `ManagementPage` cho khung trang.
- `ManagementCompactToolbar` và `ManagementCompactSearch` cho tìm kiếm.
- `ManagementFilterSidebar` cho bộ lọc.
- `ManagementTableViewport` và `ManagementDataTable` cho bảng, row chọn, detail row.
- Trang chỉ truyền cấu hình cột/cell/detail/action riêng.
- Không tạo CSS table riêng nếu `management-table` đã đủ.

Vai trò trong tồn vận hành:

- `Nhà cung cấp` phải ổn trước khi hoàn thiện phiếu nhập, vì phiếu nhập cần NCC để ghi lịch sử mua và công nợ NCC.
- Phiếu nhập `posted` là nguồn `stock-in` chính thức cho `stock_movements`.
- Trạng thái 2026-07-12: import KiotViet phiếu nhập `posted` đã sinh/read `stock_movements.purchase_receipt` trong dev-memory. Dòng dùng mã đơn vị quy đổi như `B260` phải map về sản phẩm gốc như `BT` và quy đổi `quantity * stock_qty_per_unit` về đơn vị tồn chính.
- Phiếu nhập `draft` không làm tăng tồn, không ghi công nợ thật, không ghi sổ quỹ.
- Lịch sử phiếu nhập là nguồn đúng để suy ra nhà cung cấp của từng hàng; không lấy NCC từ file hàng hóa KiotViet.
- Sau khi stock-in ổn, `/products` mới dùng dữ liệu này để tính tồn QCVL và so sánh với `Tồn KV tạm nhập`.
- Lưu ý mục tiêu Hàng hóa: chỉ có phiếu nhập thì mới đúng chiều `+ tồn`. Tồn vận hành vẫn chưa đủ đúng cho đến khi hóa đơn/POS posted ghi stock-out chính thức.

---

## 2. Danh sách nhà cung cấp

### Bộ lọc

- tìm theo mã, tên, số điện thoại
- ô tìm NCC dùng shared compact search, hỗ trợ nhập không dấu và lọc trực tiếp danh sách theo mã, tên, SĐT/email và nợ cần trả hiện tại nếu API trả về
- không hiển thị dropdown/listbox gợi ý; nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung
- trạng thái: tất cả/đang hoạt động/ngừng hoạt động
- nợ hiện tại: khoảng từ/tới
- tổng mua: khoảng từ/tới và khoảng thời gian nếu cần

### Cột mặc định

| Cột | Ghi chú |
|---|---|
| Mã NCC | Click mở chi tiết. Nếu NCC có khách hàng liên kết, hiển thị icon liên kết màu cam ngay trước mã NCC; không thêm cột riêng. |
| Tên NCC | Bắt buộc |
| Điện thoại | Có thể trống |
| Nợ cần trả hiện tại | Tổng hợp từ công nợ NCC |
| Tổng mua | Tổng phiếu nhập posted |
| Nhóm NCC | Không hiện ở bảng chính; giữ field chuẩn bị cho chi tiết sau này nếu cần |
| Trạng thái | Active/inactive |

Email không hiện ở bảng chính; chỉ hiển thị trong form/chi tiết khi cần xem hồ sơ.

Nhóm NCC không hiện ở bảng chính. Nếu sau này cần hiển thị ở detail, dùng field chuẩn bị dữ liệu; còn hiện tại import/file chưa có nhóm thật thì để trống, không dựng nhóm giả.

Nếu `Nợ cần trả hiện tại < 0`, UI không mặc định hiểu là trả trước NCC. Trong nghiệp vụ QC-OMS, NCC có thể đồng thời là khách hàng; số âm là tín hiệu cần đối soát với hồ sơ khách hàng liên kết.

---

## 3. Chi tiết nhà cung cấp

Tab tối thiểu:

| Tab | Nội dung |
|---|---|
| Thông tin | Mã, tên, điện thoại, email, địa chỉ, MST text, ghi chú, trạng thái |
| Phiếu nhập | Lịch sử phiếu nhập của NCC |
| Công nợ | Các phiếu nhập còn nợ và lịch sử trả NCC |

Không có tab hóa đơn điện tử/thuế.

Chi tiết NCC và chi tiết phiếu nhập dùng shared shell `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, `ManagementDetailSection`, `ManagementInlineDetailTabs`, `ManagementDetailInfoList`, `ManagementDetailCard`, `ManagementDetailNote`, `ManagementDetailInlineNote`. Chi tiết NCC giữ tab shell `Thông tin`, `Lịch sử nhập/trả hàng`, `Nợ cần trả nhà cung cấp`; nội dung tab chỉ dùng dữ liệu QCVL thật. Nếu tab chưa có API chi tiết thì hiển thị empty note rõ, không dựng bảng giả. Chi tiết phiếu nhập luôn có tab `Thông tin`; tab `Lịch sử thanh toán` chỉ hiện khi có dòng thanh toán NCC thật hoặc dòng đối chiếu read-only từ phiếu KV đã trả.

Chi tiết NCC trên `3202` dùng summary tên + mã NCC, dòng phụ `Người tạo`, `Ngày tạo`; field `Nhóm nhà cung cấp` chỉ giữ ở data model chuẩn bị, không hiện ở bảng chính. Tab `Thông tin` dùng `ManagementDetailInfoList` 3 cột cho `Điện thoại`, `Email`, `MST`; `Địa chỉ` là một dòng full width. Ghi chú NCC dùng `ManagementDetailNote` với icon và fallback `Chưa có ghi chú`.

Nếu NCC cũng là khách hàng, bảng chính không hiển thị cột `Khách hàng liên kết`; cột `Mã NCC` hiển thị icon liên kết trước mã để nhận biết nhanh, còn tab `Thông tin` hiển thị card `Khách hàng đồng thời là Nhà cung cấp` với mã/tên khách hàng tương ứng. MVP chỉ cần liên kết thủ công/chọn khách hàng có sẵn; không bắt buộc tự động gộp theo số điện thoại.

---

## 4. Danh sách phiếu nhập

### Bộ lọc

- tìm theo mã phiếu nhập, tên/mã NCC, số chứng từ NCC
- thời gian nhập dùng control thời gian chung: nút chọn nhanh, hai ô từ ngày/đến ngày luôn hiển thị dạng `dd/MM/yyyy`, icon lịch mở popup bên phải cột filter và không chồng menu chọn nhanh
- trạng thái: phiếu tạm, đã nhập, đã hủy
- người nhập/người tạo

Nếu người dùng nhập đúng mã phiếu như `PN000673`, kết quả tìm kiếm phải ưu tiên tìm chính xác và không bị mất do bộ lọc tháng hiện tại.

Ô tìm `Tìm phiếu/NCC` dùng shared compact search và lọc trực tiếp danh sách:

- gọi API tìm theo mã phiếu nhập, tên/mã NCC, số chứng từ NCC với bộ lọc trạng thái/ngày/người tạo đang chọn
- không hiển thị dropdown/listbox gợi ý dưới ô tìm
- nhập tới đâu lọc danh sách chính tới đó; nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung
- bấm Enter lọc lại theo nội dung đang nhập
- không có kết quả thì hiện `Không có kết quả phù hợp`
- ô `Tìm phiếu/NCC` ở danh sách dùng vị trí header/layout chung như các trang quản trị khác; không kéo sát tiêu đề. Chỉ ô tìm hàng trong màn tạo phiếu mới nằm sát chữ `Nhập hàng`.

### Cột mặc định

| Cột | Ghi chú |
|---|---|
| Chọn dòng | Checkbox chọn phiếu, không mở chi tiết khi bấm |
| Đánh dấu | Sao ưu tiên, dùng UI chung của bảng quản trị |
| Mã nhập hàng | Dạng `PN...`, click mở chi tiết |
| Nhà cung cấp | Tên NCC; không ghép mã NCC trong danh sách chính |
| Tổng số lượng | Tổng `quantity` các dòng, hiển thị 2 số lẻ |
| Tổng tiền hàng | Trước thanh toán |
| Cần trả NCC | Sau giảm giá/chi phí liên quan nếu có |
| Tiền đã trả NCC | Tiền đã chi |

---

## 5. Form phiếu nhập

### Header

- Danh sách nhập hàng dùng route `/receipts`.
- Khi bấm `Tạo phiếu nhập`, trang chuyển sang `/receipts/new` để mở màn `Nhập hàng`, có nút mũi tên trái quay lại danh sách phiếu nhập ở `/receipts`.
- Header màn tạo phiếu có thanh `Tìm hàng (F3)` nằm ngay bên phải chữ `Nhập hàng`, dùng visual/cơ chế giống thanh tìm hàng POS nhưng chỉ tìm theo mã hàng và tên hàng, không tìm combo.
- Thanh tìm hàng phải gọi search từ catalog khi gõ để bắt được mã ngoài cache nạp sẵn; gợi ý merge cache + remote, ưu tiên khớp mã hàng/tên hàng giống POS.
- Gõ mã/tên hàng rồi Enter hoặc bấm một gợi ý sẽ thêm hàng đó vào phiếu ở vùng dòng hàng bên dưới.
- Khi ô tìm hàng rỗng, nút `+` trong ô là `Tạo hàng hóa`; khi có nội dung, nút này đổi thành `Xóa tìm kiếm`.
- Nếu chưa chọn hàng nào, vùng dòng hàng không hiện row `1` rỗng; chỉ hiện empty state yêu cầu chọn hàng từ thanh tìm kiếm.
- Không cho lưu phiếu nhập rỗng; phải có ít nhất một dòng hàng.
- Khối thông tin phiếu nằm bên phải, dùng phong cách `ManagementFilterSidebar`: chọn nhà cung cấp, mã phiếu, thời gian nhập, số hóa đơn đầu vào, giảm giá phiếu, đã trả tạm, tổng tiền hàng, tổng nợ, ghi chú.
- Kho mặc định trong MVP; chưa cần chọn nhiều kho.

### Dòng hàng thường

- Dòng hàng sau khi chọn từ search hiển thị dạng card/list giống dòng hàng POS, không dùng bảng/dropdown chọn sản phẩm trong màn tạo mới.
- Card có header: `STT`, `Tên hàng`, `SL`, `ĐV`, `Đơn giá`, `Giảm`, `Thành tiền`.
- Tên hàng hiển thị tên + mã hàng.
- Cho sửa số lượng, đơn giá, giảm giá; đơn vị mua readonly theo hàng đã chọn.
- Nút `×` trên card xóa dòng hàng.
- Thành tiền tính realtime từ số lượng, đơn giá, giảm giá dòng.

### Dòng hàng cuộn

Với sản phẩm `inventory_shape = roll`, UI phải yêu cầu nhập vật lý:

- khổ rộng
- số cuộn
- chiều dài mỗi cuộn hoặc danh sách chiều dài từng cuộn
- đơn giá/tổng giá

Nếu nhiều cuộn cùng thông số, cho nhập nhanh `số cuộn x chiều dài`. Nếu khác chiều dài, cho bung danh sách từng cuộn.

Trên màn tạo phiếu hiện tại, phần nhập vật lý của cuộn nằm ngay trong card dòng hàng sau khi chọn sản phẩm cuộn, không mở bảng phụ riêng.

### Dòng hàng tấm

Với sản phẩm `inventory_shape = sheet`, UI phải yêu cầu:

- kích thước dài/rộng
- số tấm
- đơn giá/tổng giá

Nếu cùng kích thước, cho nhập theo lô. Nếu khác kích thước, tách dòng hoặc bung danh sách.

Trên màn tạo phiếu hiện tại, phần nhập nhiều nhóm kích thước của tấm nằm ngay trong card dòng hàng sau khi chọn sản phẩm tấm.

---

## 6. Thanh toán trên phiếu nhập

Form hiển thị:

- tổng tiền hàng
- giảm giá phiếu nếu dùng
- đã trả ngay
- tổng nợ/còn phải trả
- phương thức trả: tiền mặt hoặc chuyển khoản/tài khoản

MVP ưu tiên một phương thức thanh toán cho một lần trả để thao tác gọn.

P2/P3 theo quyết định Owner 2026-07-02:

- P2 draft có thể nhập `đã trả` để xem còn phải trả, nhưng không tạo sổ quỹ khi còn draft.
- P3 post phiếu nhập có trả ngay thì phải ghi phiếu chi/sổ quỹ.
- Nếu chuyển khoản, UI ưu tiên tài khoản ngân hàng/STK dùng gần nhất, cho chọn tài khoản mặc định hoặc mở danh sách chọn tài khoản khác.
- Nếu `đã trả > cần trả`, UI/API cho phép số còn phải trả âm để thể hiện NCC đang nợ lại mình/trả thừa, chưa tự cấn trừ với khách hàng liên kết.

Nếu thao tác trả NCC làm số dư âm, hệ thống không mở workflow trả trước riêng trong MVP. UI hiển thị số âm để đối soát, và nếu NCC có liên kết khách hàng thì nhân viên có thể kiểm tra khoản khách còn nợ ở hồ sơ khách hàng.

---

## 7. Hành động

| Hành động | Quy tắc |
|---|---|
| Lưu tạm | Tạo draft, chưa tăng tồn/công nợ/sổ quỹ |
| Hoàn thành/Nhập hàng | Posted, tăng tồn, cập nhật `giá nhập cuối`, ghi công nợ/sổ quỹ |
| Hủy | Với phiếu posted phải dùng bút toán đảo/an toàn, không xóa vật lý |
| Sửa phiếu posted | Ngoài phạm vi hiện tại; sau này dùng quy tắc sửa chứng từ an toàn, không sửa phá dữ liệu |

---

## 8. Empty state và lược bỏ

Nếu chưa có dữ liệu trong tháng, empty state phải cho đổi khoảng thời gian dài hơn, giống kinh nghiệm rà KiotViet.

Không hiển thị menu/chức năng trong lát cắt đầu tiên:

- đặt hàng nhập
- trả hàng nhập
- hóa đơn đầu vào điện tử
- báo cáo NCC nâng cao

---

## 9. Trạng thái màn theo lát cắt

Để implement không phải làm toàn bộ Purchase một lần, UI chia theo lát cắt:

| Slice | UI bật | UI chưa bật |
|---|---|---|
| P1 Supplier foundation | Danh sách NCC, tạo/sửa NCC, liên kết khách hàng | Đã merge |
| P2 Purchase draft/list/detail | Danh sách phiếu nhập, tạo/sửa draft hàng thường | **SoT đã chốt; runtime live create/post còn HTTP stub** — [Purchase README](../../03-BUSINESS-NghiepVu/Purchase/README.md) |
| P3 Post normal receipt | Nút Hoàn thành cho hàng thường, cập nhật giá nhập cuối | **SoT đã chốt; runtime live post còn stub** — Purchase README |
| P4 Roll/sheet purchase | Form tạo draft đã nhập được cuộn/tấm vật lý trong card dòng hàng | Post object vật lý/sửa posted nâng cao |
| P5 Supplier payments | Trả tiền NCC sau phiếu nhập, lịch sử thanh toán NCC | **SoT đã chốt; runtime live pay còn stub một phần** — Purchase README; trả nhiều tài khoản trong một lần để sau |

Lưu ý UI: tab NCC được giữ để đúng bố cục KiotViet/QCVL, nhưng khi backend chưa có lịch sử nhập/trả hàng hoặc danh sách công nợ chi tiết đầy đủ, frontend chỉ hiển thị empty note rõ và không dựng dữ liệu giả.

Quy tắc chung: UI không hiển thị nút chức năng chưa chạy được như thể đã chạy được. Nếu cần giữ vị trí, dùng disabled state kèm tooltip ngắn.

### 9.1. Supplier foundation P1

P1 đã merge. Phạm vi nền:

- route/list NCC
- form thêm/sửa NCC
- field `linked_customer_id` chọn từ khách hàng hiện có
- search theo mã/tên/sĐT
- filter trạng thái
- cột tổng mua/nợ hiện tại trả `0` nếu chưa có Purchase

Acceptance UI:

- tạo NCC với tên, mã tự sinh nếu bỏ trống
- SĐT trống vẫn lưu được
- gắn khách hàng liên kết và mở link qua hồ sơ khách
- NCC inactive không xuất hiện trong chọn NCC mặc định khi tạo phiếu nhập sau này

### 9.1.1. Import nhà cung cấp KiotViet

Import NCC dùng lại flow `KiotVietImportDialog` chung, giống Khách hàng/Hàng hóa; không tạo CSS hoặc bảng import riêng.

File `DanhSachNhaCungCap_KV12072026-131429-622.xlsx` có 44 dòng. Các cột import vào QCVL:

- Mã nhà cung cấp: khóa upsert chính.
- Tên nhà cung cấp.
- Email.
- Điện thoại.
- Địa chỉ, Phường/Xã, Khu vực: gom thành một dòng địa chỉ nếu thiếu/chưa đủ.
- Tổng mua: lưu làm số tham chiếu KV cho tới khi phiếu nhập QCVL đủ dữ liệu.
- Nợ cần trả hiện tại: lưu làm số tham chiếu KV cho tới khi công nợ NCC QCVL đủ dữ liệu.
- Mã số thuế.
- Ghi chú.
- Trạng thái.
- Tổng mua trừ trả hàng.
- Công ty.
- Người tạo, Ngày tạo.

Cột chưa nhập dữ liệu thật trong lát cắt hiện tại:

- Số CMND/CCCD.
- Nhóm nhà cung cấp: giữ field chuẩn bị cho sau này trong data model; file import hiện tại chưa có nhóm thật nên để trống/`Chưa có`, không dựng nhóm giả.

Quy tắc:

- Import dùng mã NCC làm khóa; trùng mã thì cập nhật.
- Xóa dữ liệu import cũ dùng confirm inline trong dialog, không dùng `window.confirm`.
- Dev-memory phải lưu supplier import vào `logs/dev-memory-state.json`, không chỉ giữ trong mảng demo, để API restart không mất dữ liệu.
- Các số KV trên NCC chỉ là tham chiếu ban đầu; mục tiêu đúng tồn vẫn là nhập hàng/phiếu nhập posted tạo `stock-in`.

### 9.1.2. Supplier checkpoint for product-stock goal

Current decision 2026-07-12:

- Supplier/NCC is deep enough for the current Hang hoa completion goal.
- Required now: imported real KV suppliers, shared list/search/filter/sort/detail shell, safe `Xoa du lieu cu`, and re-import without losing the working dataset.
- Do not block the runnable stock path on deep supplier payable, supplier purchase history tab, supplier payment review, supplier reports, or supplier grouping.
- KV `Tong mua` and `No can tra hien tai` on supplier remain reference numbers only until QCVL purchase receipts and payable entries are complete.
- Continue next in `Nhap hang`: import/review/post purchase receipts so posted receipts create trusted `stock-in` movements for product stock.

### 9.1.3. Nhap hang import checkpoint

Current decision 2026-07-12:

- Trang `Nhap hang` dung chung shell da co: toolbar search, nut `Import` mo luong import KiotViet, shared list/detail/table, inline confirm `Xoa du lieu cu`.
- File import dung cho slice nay la `DanhSachChiTietNhapHang_KV...xlsx`, khong phai file `DanhSachNhaCungCap_KV...xlsx`.
- Import gom dong theo `Ma nhap hang`; moi dong chi tiet map `Ma nha cung cap` sang NCC va `Ma hang` sang Hang hoa.
- Ma co hau to `{DEL}`, `{DEL1}`, `{DEL2}` la hau to KV trong chung tu lich su, khong mac dinh la phieu cu da xoa; QCVL doi chieu bang ma goc neu ma goc dang co trong QCVL.
- Neu file KV khong co `Ma nha cung cap`, backend map ve `NCC le` / `Nha cung cap le`; preview khong coi day la loi thieu NCC va import tu upsert NCC le neu chua co.
- Hang da xoa trong KV nhung van xuat hien o chung tu lich su duoc tao lai trong QCVL voi `status = inactive` va `track_inventory = false`. Muc dich la giu lich su phieu nhap khop ma, khong dua cac ma da xoa vao ton van hanh hien tai.
- `Da nhap hang` tu KV se duoc luu la receipt `posted` de lam nguon stock-in QCVL sau khi du du lieu tham chieu.
- Backend khong import partial khi thieu NCC/Hang hoa. Preview phai bao danh sach ma thieu; import tra skipped de khong tao ton sai.
- UI import phai hien canh bao tong hop khi con thieu NCC/Hang hoa, vi luc do nut `Import` bi khoa co chu dich.
- `Xoa du lieu cu` chi xoa purchase receipts import tu KiotViet, khong xoa phieu nhap tao tay.
- Kiem tra file `DanhSachChiTietNhapHang_KV12072026-135400-901.xlsx`: da import duoc 1,737 dong chi tiet / 684 phieu. Cac ma don vi quy doi nhu `B260` khop qua `product_unit_conversions.source_code`. `NCC le` da duoc tao lam NCC fallback. 13 ma hang lich su da xoa duoc tao inactive/khong track ton de phieu nhap khop tham chieu.

### 9.2. Purchase draft P2

P2 SoT đã chốt; **runtime create/post live vẫn stub** (xem Purchase README). Phạm vi:

- form tạo phiếu nhập draft
- chọn NCC
- tìm hàng theo mã/tên bằng thanh `Tìm hàng (F3)` giống POS
- chọn hàng từ search để tạo card dòng hàng; không có row rỗng mặc định và không dùng dropdown chọn sản phẩm trong màn tạo mới
- dòng hàng thường: số lượng, đơn giá, giảm giá, thành tiền
- dòng hàng cuộn/tấm: nhập payload vật lý trong card dòng hàng để lưu draft
- tổng tiền hàng, giảm giá phiếu, đã trả tạm, tổng nợ/còn phải trả
- lưu draft, sửa draft

Draft chỉ là dữ liệu nháp server; không post tồn/kế toán cho tới khi người dùng hoàn thành phiếu.

P2 dùng kho mặc định. Quy tắc có cho sửa mã `PN...` khi draft hay không cần tham khảo KiotViet trước khi chốt.

### 9.3. Supplier payment P5

P5 SoT đã chốt; **runtime live pay còn stub một phần**. KiotViet audit 2026-07-02 đã xác nhận mã thanh toán NCC dạng `PCPN...`, lịch sử thanh toán nằm trong chi tiết phiếu nhập, và action thanh toán nằm trong tab công nợ NCC.

Quyết định Owner đã chốt:

- trả tiền NCC sau phiếu nhập bằng cách chọn phiếu nhập cụ thể
- cho trả một phần
- không cho trả thừa trong P5
- một lần trả dùng tiền mặt hoặc chuyển khoản
- nếu chuyển khoản, chọn một tài khoản ngân hàng từ danh sách tài khoản đang có
- mã chứng từ trả NCC dùng prefix `PCPN...`
- UI có đường trả từ chi tiết NCC và từ chi tiết phiếu nhập posted còn nợ
- chi tiết phiếu nhập posted có lịch sử thanh toán NCC tối thiểu

Ngoài phạm vi P5 hiện tại:

- trả nhiều tài khoản trong một lần
- tự phân bổ cứng vào phiếu nợ cũ nhất
- tự cấn trừ với khách hàng liên kết
- workflow trả trước NCC

### 9.4. Roll/sheet purchase P4 chốt nền

P4 đã được Spec audit code 2026-07-02 và là candidate tiếp theo sau khi khớp lại code hiện tại. UI không bắt người dùng nhập/quản lý mã từng cuộn/tấm; mã vật lý nếu DB cần sẽ do backend tự sinh.

- cuộn hỗ trợ cả nhiều cuộn cùng thông số và từng cuộn khác chiều dài
- không cần mã từng cuộn rườm rà trong MVP
- tấm chủ yếu nhập cùng kích thước nhiều tấm; sau này có thể phát sinh vật tư khác kích thước
- không cần mã từng tấm
- giá mua tấm thường theo tấm

UX P4:

- Với sản phẩm `roll`, dòng nhập có mode nhanh:
  - cùng thông số: `số cuộn`, `khổ rộng`, `chiều dài mỗi cuộn`
  - khác chiều dài: `khổ rộng`, danh sách `chiều dài từng cuộn`
- Với sản phẩm `sheet`, dòng nhập có `dài`, `rộng`, `số tấm`; nếu cần nhiều nhóm kích thước, cho thêm nhóm kích thước trong cùng dòng sản phẩm.
- UI hiển thị diện tích quy đổi để người dùng kiểm tra tiền/giá vốn, nhưng không cho nhập mua bằng tổng `m2` thay cho object vật lý.
- Chi tiết phiếu posted hiển thị tóm tắt object đã tạo: số cuộn/tấm, kích thước, tổng diện tích; không cần lộ danh sách mã kỹ thuật nếu không cần đối soát.
