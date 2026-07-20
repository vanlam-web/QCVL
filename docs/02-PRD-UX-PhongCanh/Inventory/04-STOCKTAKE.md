# STOCKTAKE — UX phiếu kiểm kho

> **Nguồn tham khảo UI:** KiotViet tính năng Kiểm kho; điều chỉnh theo object-level stocktake của QC-OMS.

---

## 0. Ghi nhận từ KiotViet

KiotViet có dữ liệu kiểm kho thực tế khi mở rộng thời gian `01/07/2016 - 01/07/2026`: `332 giao dịch`.

Các quan sát dùng cho QC-OMS:

- Màn mặc định lọc `Năm nay` để thấy dữ liệu kiểm kho gần đây hơn; khi cần xem toàn bộ lịch sử KV 2016-2026 thì chọn `Toàn thời gian`.
- Danh sách hiển thị các trạng thái `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
- Nhiều phiếu có ghi chú dạng `Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa:<Mã hàng>`.
- Đây là bằng chứng luồng sửa tồn trong Hàng hóa sinh phiếu kiểm kho tự động là nghiệp vụ đang dùng thực tế, nên giữ trong MVP.

---

## 1. Mục đích

Màn Kiểm kho dài hạn giúp người dùng:

- tạo phiếu kiểm kho
- nhập số lượng thực tế
- xem chênh lệch
- lưu tạm
- cân bằng kho
- hủy phiếu tạm

Trạng thái MVP hiện tại: ưu tiên xem/import lịch sử KiotViet, lọc danh sách, mở chi tiết, sửa ghi chú và hủy phiếu. `+ Kiểm kho`, `Xuất file`, `In` và `Sao chép` chưa là chức năng vận hành; nếu UI còn giữ nút placeholder thì phải để disabled hoặc không tính là đã làm.

QC-OMS phải hỗ trợ kiểm kho theo tổng cho hàng thường và theo từng cuộn/tấm cho hàng cuộn/tấm.

Kiểm kho khác với khui vật tư:

- `Kiểm kho` là nghiệp vụ cân bằng số lượng thực tế so với số hệ thống; tạo `stocktakes`, `stocktake_items` và stock movement điều chỉnh. **Runtime** sửa tồn thường dùng `movement_type = stocktake_balance` (doc cũ đôi khi viết `stocktake_adjustment`).
- `Khui vật tư` là nghiệp vụ mở vật tư mới hoặc kết thúc phần cũ; ghi `inventory_material_openings` và `stock_movements.material_opening`, không tạo phiếu kiểm kho.
- Cả hai đều hiện trong `Thẻ kho`, nhưng danh sách `Phiếu kiểm kho` chỉ chứa phiếu kiểm/cân bằng kho.

---

## 2. Danh sách phiếu kiểm kho

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Kiểm kho                                               [Import KV]                 │
├───────────────────────┬────────────────────────────────────────────────────────────┤
│ Tìm mã phiếu          │ Mã phiếu | Ngày kiểm | Mã hàng | Tên hàng | Tồn trước │
│ Thời gian tạo         │ KK000123 | ...       | F8      | Fomex... | 0.005     │
│ Trạng thái            │ KK000122 | ...       | F4      | Fomex... | 7.5       │
│ Người tạo             │                                                            │
└───────────────────────┴────────────────────────────────────────────────────────────┘
```

### Bộ lọc

| Bộ lọc | Giá trị |
|---|---|
| Mã phiếu, mã hàng, tên hàng | Search text trên toolbar; tìm cả mã phiếu và dòng hàng trong phiếu |
| Thời gian tạo | Chọn nhanh theo ngày/tuần/tháng/quý/năm/toàn thời gian; hai ô từ ngày/đến ngày luôn hiển thị với icon lịch; popup lịch mở bên phải cột filter và không chồng menu chọn nhanh; khi màn trống cần có cách mở rộng khoảng tìm kiếm |
| Trạng thái | Phiếu tạm, đã cân bằng kho, đã hủy |
| Người tạo | Nhân viên |

### Cột danh sách

| Cột | Ghi chú |
|---|---|
| Checkbox | Dùng pattern checkbox chung; hiện chọn dòng/chọn tất cả, thao tác hàng loạt để sau |
| Sao ưu tiên | Dùng pattern sao chung; bấm sao dòng để lưu ưu tiên cục bộ, bấm sao header để lọc phiếu ưu tiên trên trang hiện tại |
| Mã phiếu | Mã kiểm kho tự sinh, ví dụ `KK000333` |
| Ngày kiểm | Thời điểm tạo phiếu/kiểm kho |
| Mã hàng | Mã hàng đầu tiên trong phiếu, lấy từ dòng kiểm kho nguồn hoặc hàng hóa QCVL đã khớp |
| Tên hàng | Tên hàng đầu tiên trong phiếu, lấy từ dòng kiểm kho nguồn hoặc hàng hóa QCVL đã khớp |
| Tồn trước | Số lượng hệ thống trước khi kiểm của dòng hàng đầu tiên |
| Kiểm được | Số lượng thực tế kiểm được của dòng hàng đầu tiên |
| Lệch | `Kiểm được - Tồn trước` của dòng hàng đầu tiên |
| Trạng thái | Phiếu tạm, đã cân bằng kho, đã hủy |

### Trạng thái hiện tại trong app

- Màn `Phiếu kiểm kho` nằm trong module `Hàng hóa`.
- App đã có ô tìm `Mã phiếu, mã hàng, tên hàng` trên toolbar, nút tạo phiếu kiểm kho dạng placeholder trong ô tìm, nút `Import KV`, sidebar `Ngày tạo` + `Trạng thái` + `Người tạo`, bảng danh sách và phân trang.
- Bộ lọc gần hoàn thiện. `Người tạo` đã kiểm tra OK trên 3202: dropdown lấy từ `creator_options`, dùng tài khoản QCVL (`created_by`) làm nguồn chuẩn, không lấy option từ page hiện tại, không co lại khi đang lọc theo một người tạo.
- Danh sách đang hiển thị các cột gọn phục vụ hoàn thiện Hàng hóa: `Mã phiếu`, `Ngày kiểm`, `Mã hàng`, `Tên hàng`, `Tồn trước`, `Kiểm được`, `Lệch`, `Trạng thái`. Các cột tiền như `Tổng thực tế`, `Tổng chênh lệch` không hiện ở bảng chính vì dễ nhầm với số lượng; để trong ô chi tiết/API audit.
- `Tồn trước`, `Kiểm được`, `Lệch` lấy từ dòng kiểm kho đầu tiên của phiếu, cùng nguồn với `Mã hàng`/`Tên hàng`, để nhìn bảng chính là hiểu ngay số lượng trước và sau kiểm.
- Nếu thiếu giá vốn để tính giá trị, UI hiển thị `Chưa có` thay vì đoán số.
- API chi tiết phiếu `GET /api/v1/inventory/stocktakes/{id}` hiện trả đầu phiếu + các dòng `stocktake_items` đã import. UI click nguyên dòng phiếu mở inline detail dùng chung khung chi tiết, chỉ hiển thị phần thông tin cần quét nhanh; không có hàng lọc `Tìm mã hàng`/`Tìm tên hàng` trong bảng chi tiết.

### Chỉnh hướng UI theo KiotViet 2026-07-10

- Giữ app shell QCVL hiện tại, không copy topbar xanh hoặc hotline của KiotViet.
- Route `/inventory` mở thẳng danh sách `Phiếu kiểm kho`. Không đặt tab con `Hàng hóa`, `Phiếu kiểm kho`, `Tồn theo cuộn/tấm`, `Khui vật tư` trong header vì `Hàng hóa` đã có route riêng `/products`.
- Ô tìm `Mã phiếu, mã hàng, tên hàng` đặt trên toolbar chính phía trên bảng, không để trong sidebar. Gõ tới đâu danh sách lọc tới đó; Enter chỉ chạy lại lọc hiện tại. Backend tìm theo `stocktakes.code`, ghi chú phiếu, và dòng `stocktake_items` gồm mã hàng/tên hàng nguồn hoặc hàng hóa QCVL đã khớp.
- Nút tạo phiếu kiểm kho nằm trong dấu `+` của ô tìm kiếm. Khi ô tìm có nội dung, dấu `+` đổi thành nút `x` để xóa tìm kiếm giống các trang quản lý khác.
- Toolbar chỉ cần `Import KV` cho file `DanhSachChiTietKiemKho_KV...xlsx`. `Xuất file` không phải chức năng vận hành của Kiểm kho trong MVP.
- Sidebar gồm `Ngày tạo`, `Trạng thái`, và `Người tạo`. Mặc định `Ngày tạo = Năm nay` để trang kiểm kho không trống khi dữ liệu phát sinh rải theo nhiều tháng; khi cần xem lịch sử KV 2016-2026 thì mở menu chọn nhanh và chọn `Toàn thời gian`.
- Bộ lọc `Ngày tạo` dùng chung mẫu UI với Hóa đơn: nút nhanh hiện nhãn preset, menu `Chọn nhanh thời gian`, hai ô ngày luôn hiển thị với icon lịch, popup lịch mở bên phải cột filter như menu chọn nhanh, tự đóng khi bấm ra ngoài sidebar và không chồng popup khác. Không còn radio `Tùy chỉnh`. Với preset hiện tại như `Năm nay`, ô đến ngày hiển thị tối đa hôm nay thay vì ngày cuối năm.
- Trạng thái dùng checkbox: `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
- Bảng chính hiển thị mã hàng/tên hàng đầu tiên và 3 số lượng dễ hiểu: `Tồn trước`, `Kiểm được`, `Lệch`. Không hiện `Người tạo`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Tổng thực tế`, `Tổng chênh lệch` ở bảng chính để tránh rộng bảng và tránh nhầm giữa tiền/số lượng; các dữ liệu này vẫn giữ trong API/audit hoặc ô chi tiết khi cần.
- Click nguyên dòng phiếu phải mở chi tiết kiểm kho inline. Với dòng import từ KV, chi tiết gắn nhãn `Nguồn KiotViet`.
- Import lịch sử KV mặc định chỉ ghi dữ liệu đối soát; không tạo `stock_movements` và không thay đổi tồn vận hành.
- Riêng một phiếu kiểm kho KV ban đầu có thể được chọn sau này làm mốc mở tồn QCVL. Việc này phải là thao tác rõ ràng: chọn mã phiếu/ngày chốt, ghi lại checkpoint, và chỉ tính chứng từ sau mốc vào tồn hiện tại. **Runtime 2026-07-20: chưa có UI/API chọn mốc** — [Inventory README](../../03-BUSINESS-NghiepVu/Inventory/README.md) mục 2.
- File import KV dùng cho nút `Import KV` là `DanhSachChiTietKiemKho_KV...xlsx`. Preview phải kiểm tra công thức `SL lệch = Kiểm thực tế - Tồn kho`; nếu có dòng lỗi thì không cho import trừ khi API được gọi với chế độ partial rõ ràng.
- KiotViet có ít nhất 2 format xuất chi tiết kiểm kho:
  - Bản 18 cột không có `Người tạo`: `Mã kiểm kho`, `Thời gian`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Trạng thái`, `Mã hàng`, `Tên hàng`, `Thương hiệu`, `Đơn vị tính`, `Tồn kho`, `Kiểm thực tế`, `SL lệch`, `Giá trị lệch`.
  - Bản 22 cột có `Người tạo`: `Mã kiểm kho`, `Thời gian`, `Người tạo`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `Tổng giá trị lệch`, `SL lệch tăng`, `Tổng giá trị tăng`, `SL lệch giảm`, `Tổng giá trị giảm`, `Ghi chú`, `Trạng thái`, `Mã hàng`, `Tên hàng`, `Thương hiệu`, `Đơn vị tính`, `Tồn kho`, `Kiểm thực tế`, `SL lệch`, `Giá trị lệch`.
  - `Người tạo` là dữ liệu nguồn từ KiotViet để map về tài khoản QCVL bằng `Tên đăng nhập` (`users.username`) sau khi bỏ hậu tố `{DEL}`. Không map theo tên hiển thị, SĐT hoặc email. UI/filter chỉ dùng một nguồn chuẩn là tài khoản QCVL (`created_by`); raw `Người tạo` KV chỉ lưu để audit/mapping, không hiển thị thành nguồn người thứ hai. Sau khi đã map, UI luôn hiển thị thông tin hiện tại của tài khoản QCVL, nên đổi tên hiển thị/SĐT trong tài khoản sẽ phản ánh lại ở danh sách.
- UI chỉ dùng `Thời gian` làm ngày tạo/hiển thị chính. Không hiển thị `Ngày cân bằng` hoặc `Người cân bằng` ở danh sách, bộ lọc, ô chi tiết. Nếu backend còn giữ `source_balanced_at` thì chỉ là dữ liệu nguồn phục vụ audit/import nội bộ.
- Import lại nhiều lần upsert theo `(organization_id, source_system, source_code)` và dòng nguồn; không nhân đôi phiếu kiểm kho.
- Số `Kiểm thực tế` từ lịch sử KV không được tự động dùng làm tồn hiện tại. `Tồn kho` từ export hàng hóa KiotViet vẫn nằm ở `inventory_provisional_balances` chỉ để đối chiếu. **SoT:** Tồn QCVL = mốc mở đã chọn + `stock_movements` sau mốc. **Hiển thị V1:** cột list được phép fallback số KV khi chưa có `operating_stock` (không đồng nghĩa đã chốt mốc) — Inventory README mục 1.

Trạng thái ô chi tiết phiếu kiểm kho:

- Đã làm: click nguyên dòng phiếu mở inline detail bằng shell chung `management-detail-panel`.
- Header chi tiết chỉ hiển thị `Người tạo` và `Ngày tạo`; không hiển thị `Người cân bằng` hoặc `Ngày cân bằng`.
- Bảng dòng chi tiết chỉ hiển thị 5 cột gọn: `Mã hàng`, `Tên hàng` (kèm đơn vị trong ngoặc), `Tồn kho`, `Thực tế`, `SL lệch`.
- Không có hàng tìm/lọc trong bảng chi tiết. Phần `Tìm mã hàng` và `Tìm tên hàng` đã bỏ để giữ detail giống các bảng chi tiết cũ và tránh dư UI.
- Ghi chú phiếu nằm dưới bảng, bên phải là tổng `Số lượng thực tế`, `Số lượng lệch tăng`, `Số lượng lệch giảm`, `Số lượng chênh lệch`.
- Ghi chú phiếu là ô nhập trực tiếp, dùng class chung `management-detail-note`, kéo dài hơn phần tổng bên phải. Bấm `Lưu` trong footer lưu lại `stocktakes.note` và cập nhật dòng danh sách.
- Footer dùng action chung `Hủy`, `Sao chép`, `Xuất file`, `Lưu`, `In`; hiện tại `Hủy` đã hoạt động bằng popup xác nhận trong app và chuyển trạng thái phiếu sang `Đã hủy`, `Lưu` lưu ghi chú, còn `Sao chép`/`Xuất file`/`In` giữ nút nhưng disabled để bổ sung sau.
- Bộ lọc `Người tạo` không lấy option từ page đang hiển thị. API list trả `creator_options` dựa trên toàn bộ kết quả theo search/ngày/trạng thái hiện tại và bỏ qua `created_by` đang chọn, để dropdown luôn còn đủ người tạo có thể lọc.
- Quyết định 2026-07-11: `+ Kiểm kho` thủ công chưa cần cho bản chạy được. Nếu kiểm thực tế một hàng và cần sửa số lượng ngay, làm trong chức năng sửa Hàng hóa; hệ thống dùng luồng sửa tồn hàng thường để tạo phiếu kiểm kho tự động/truy vết. Màn Kiểm kho giai đoạn này tập trung xem lịch sử, import KV, lọc, mở chi tiết và lưu ghi chú.
- Còn nợ của trang Kiểm kho: các action chi tiết `Sao chép`/`Xuất file`/`In` thật; menu chọn cột hiển thị chỉ làm nếu sau này cần xem thêm dữ liệu import; flow `+ Kiểm kho` thủ công/lưu/cân bằng QCVL để sau.
- Cân bằng kho chính thức thuộc chi tiết phiếu kiểm kho/QCVL manual stocktake. Không đặt nghiệp vụ cân bằng trong danh sách Hàng hóa; Hàng hóa chỉ có link/sửa nhanh tạo phiếu kiểm kho tự động khi sửa tồn hàng thường.

---

## 3. Tạo/sửa phiếu kiểm kho

> Trạng thái 2026-07-11: chưa làm trong bản chạy được. Luồng này để sau khi tồn vận hành và nhu cầu kiểm kho thủ công rõ hơn. Trước mắt, kiểm số lượng một hàng rồi sửa nhanh thì đi qua chức năng sửa Hàng hóa; nếu sửa tồn hàng thường, hệ thống tạo phiếu kiểm kho tự động để truy vết.

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Kiểm kho KK000123                                           [Lưu tạm] [Cân bằng]  │
├────────────────────────────────────────────────────────────────────────────────────┤
│ [Tìm hàng hóa]                                                                         │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Mã hàng | Tên hàng | Loại tồn | Đối tượng | SL hệ thống | SL thực tế | Lệch | Ghi chú │
│ BAT32   | Bạt 3.2 | Cuộn     | ROLL-001  | 120.0       | 118.0     | -2   | ...     │
│ ALU01   | Alu 01  | Tấm      | SHEET-01  | 2.98        | 2.98      | 0    | ...     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Chọn dòng kiểm kho

| Loại tồn | Hành vi UI |
|---|---|
| Hàng thường | Chọn sản phẩm, nhập `SL thực tế` theo đơn vị tồn chính |
| Cuộn | Chọn sản phẩm rồi chọn cuộn cụ thể |
| Tấm | Chọn sản phẩm rồi chọn tấm/tấm lỡ cụ thể |

Nếu người dùng chọn hàng cuộn/tấm mà chưa chọn đối tượng vật lý, dòng hiển thị lỗi inline.

---

## 5. Lưu tạm, cân bằng, hủy

### Lưu tạm

- Nút `Lưu tạm` lưu phiếu ở trạng thái `Phiếu tạm`.
- Không đổi tồn kho.
- Người dùng có thể mở lại để sửa.
- Trạng thái triển khai hiện tại: route API đã tồn tại nhưng trả `VALIDATION_ERROR` rõ ràng, chưa lưu phiếu thủ công để tránh fake success.

### Cân bằng kho

- Nút `Cân bằng kho` mở confirm.
- Confirm hiển thị tổng số dòng lệch tăng/lệch giảm.
- Sau khi xác nhận, phiếu chuyển `Đã cân bằng kho`.
- Tồn kho cập nhật theo số thực tế.
- Trạng thái triển khai hiện tại: route API đã tồn tại nhưng chưa cân bằng phiếu thủ công; sửa tồn hàng thường vẫn dùng endpoint tự sinh phiếu đã cân bằng.

### Hủy phiếu

- Bản hiện tại cho phép hủy phiếu đang mở trong chi tiết bằng popup xác nhận trong app, đổi trạng thái sang `Đã hủy`.
- Hủy phiếu không xóa dòng kiểm kho và không ghi/đảo `stock_movements`; dữ liệu vẫn là lịch sử/audit.
- Phiếu hủy vẫn xem lại được trong danh sách.
- Trạng thái triển khai hiện tại: `PATCH /api/v1/inventory/stocktakes/{id}` với `status: cancelled` đã hoạt động.

---

## 6. Phiếu tự động khi sửa tồn hàng hóa

Khi người dùng sửa tồn hàng `normal` từ trang Hàng hóa:

- UI không mở đầy đủ màn kiểm kho.
- Sau khi xác nhận sửa tồn, hệ thống báo đã tạo phiếu kiểm kho tự động.
- Thông báo có link `Xem phiếu`.
- Phiếu có ghi chú theo mẫu nghiệp vụ.

Hàng cuộn/tấm không dùng luồng sửa tồn tổng này.

## 6.1. Quan hệ với khui vật tư

Khi khui vật tư phụ, cuộn hoặc tấm:

- Không tạo `stocktakes`.
- Nếu phần cũ về `0`, hệ thống ghi log/movement để truy vết phần cũ bị kết thúc hoặc bỏ.
- Nếu khui vật tư mới làm thay đổi tồn chính thức, hệ thống ghi `stock_movements.movement_type = material_opening`.
- Nếu nhân viên muốn kiểm lại một nhóm vật tư sau khi khui nhiều lần, dùng màn `+ Kiểm kho` thủ công riêng.

Lý do không tạo phiếu kiểm kho khi khui: nếu mỗi lần khui sinh phiếu kiểm, danh sách kiểm kho sẽ lẫn thao tác vận hành với thao tác kiểm kê, khó đối soát. `Thẻ kho` vẫn đủ vết vì movement có `document_type = material_opening`.

---

## 7. Acceptance Criteria UX

1. Danh sách phiếu lọc được theo trạng thái, thời gian và người tạo.
2. Phiếu tạm không làm thay đổi tồn kho.
3. Cân bằng kho có confirm trước khi ghi tồn.
4. Hàng cuộn/tấm bắt buộc chọn đối tượng vật lý.
5. Hủy phiếu có popup xác nhận trong app, chuyển trạng thái sang `Đã hủy`, không xóa dữ liệu và không tự điều chỉnh tồn kho.
6. Sửa tồn hàng thường từ Hàng hóa tạo phiếu kiểm kho tự động và có link xem phiếu.

---

← [Quay về Inventory README](./README.md)
