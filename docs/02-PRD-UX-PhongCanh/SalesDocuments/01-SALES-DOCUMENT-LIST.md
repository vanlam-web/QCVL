# 01-SALES-DOCUMENT-LIST — Danh sách chứng từ bán hàng

> **Phase hiện tại:** Đã có readonly list/detail cho `HD...` và `BG...`; báo giá active mở lại được vào POS draft; hóa đơn hoàn thành có nút Sửa mở POS revision draft riêng
> **Tham khảo:** KiotViet `Đơn hàng > Hóa đơn`; không dùng mô hình `Đặt hàng/Giao hàng`

---

## 0. Ghi nhận từ KiotViet

Quan sát ngày `01/07/2026`:

- Màn `Hóa đơn` mặc định lọc `Tháng này` có thể không hiện kết quả dù Dashboard có hoạt động bán gần đây.
- Tìm trực tiếp mã `HD010985` mở được hóa đơn ngày `30/06/2026 17:08`.
- Khi tìm theo mã, KiotViet tự đưa thời gian về `Toàn thời gian` và bỏ chọn các filter trạng thái/loại hóa đơn.
- Danh sách có dòng tổng phía trên và các cột chính: mã hóa đơn, thời gian, mã trả hàng, mã khách hàng, khách hàng, tổng tiền hàng, giảm giá, tổng sau giảm giá, khách đã trả.
- POS QCVL phải sinh mã chứng từ giống KiotViet: hóa đơn `HD` + 6 số, báo giá `BG` + 6 số, lấy số kế tiếp theo mã đang có. Dạng `HD-POS...`/`BG-POS...` chỉ là mã lịch sử/test cũ, không dùng cho chứng từ mới. Sau cleanup ngày `2026-07-14`, 7 hóa đơn POS/test `HD-POS-021...` đã được xóa khỏi `3202`; backup nằm tại `backups/dev-memory-state-before-delete-approved-fake-data-2026-07-14T15-44-30-303Z.json`.

Áp dụng cho QC-OMS:

- Tìm theo mã chứng từ phải ưu tiên trả đúng chứng từ, không bị filter thời gian/trạng thái mặc định che mất.
- Empty state cần phân biệt `không có dữ liệu` với `đang bị lọc`.
- Giữ cột `khách đã trả` và `còn nợ` vì liên quan công nợ theo hóa đơn.

---

## 1. Mục tiêu

Trang danh sách giúp nhân viên tìm lại chứng từ bán hàng nhanh, gồm:

- Báo giá `BG...`.
- Hóa đơn bán hàng `HD...`.
- Hóa đơn sửa từ hóa đơn cũ, ví dụ `HD000123.01`.
- Chứng từ đã hủy để kiểm tra lịch sử.

Trang này không phải màn hình bán hàng. Nếu cần tạo đơn mới, người dùng đi về POS.

Hiện tại đã triển khai:

- danh sách hóa đơn `HD...` và báo giá `BG...`
- tìm kiếm/lọc cơ bản
- ô tìm `Mã chứng từ, khách hàng, ghi chú` lọc trực tiếp danh sách; search bỏ dấu tiếng Việt, tìm theo mã chứng từ, mã/tên khách và ghi chú chứng từ
- không hiển thị dropdown/listbox gợi ý dưới ô tìm; nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung
- bộ lọc thời gian dùng control chung: nút chọn nhanh, hai ô từ ngày/đến ngày luôn hiển thị và icon lịch mở popup bên phải cột filter
- bộ lọc trạng thái thanh toán, phương thức thanh toán, người bán/người tạo và bảng giá nếu dữ liệu/API hiện có hỗ trợ
- bộ lọc nhiều chọn `Loại hóa đơn`, `Trạng thái hóa đơn`, `Thanh toán` đã chạy trên NAS ngày 2026-07-09; frontend và backend phải cùng hỗ trợ query comma, không được đổi UI sang nhiều chọn khi backend còn chỉ nhận một giá trị
- exact document-code lookup không bị che bởi filter mặc định
- bấm dòng chứng từ để mở chi tiết readonly inline
- mở lại báo giá active vào POS draft local
- hóa đơn hoàn thành mở readonly; bấm **Sửa** mở POS theo flow `invoice-revision` riêng, tab hiển thị `Sửa HD...`
- giữ giá snapshot của báo giá khi mở lại; cảnh báo nếu giá hiện tại khác hoặc sản phẩm không còn khả dụng

Shared management layout:

- dùng `ManagementPage`, `ManagementCompactToolbar`, `ManagementCompactSearch`, `ManagementFilterSidebar`, `ManagementTableViewport`, `ManagementDataTable`;
- table chính không tự render `<table>` riêng trong page;
- dữ liệu riêng của SalesDocuments chỉ nằm ở cấu hình cột/cell, sort header, detail inline và API load;
- row click/Enter/Space mở chi tiết; click trong detail không làm đóng detail;
- không đưa lại dropdown/listbox gợi ý dưới ô tìm;
- POS không áp dụng rule này.

Ngoài phạm vi hiện tại:

- in lại bill hóa đơn nếu Bill Preview/print flow chưa có
- hủy hóa đơn
- thao tác đảo kho/tiền/công nợ từ danh sách

Đã có ở lát quote print:

- in/xem báo giá mẫu mặc định cho `BG...`

QC-OMS chỉ làm luồng **bán đứt**:

- không có `Đặt hàng` kiểu KiotViet
- không có đơn giao hàng/vận đơn/COD
- không có bán hàng online hoặc kênh bán
- báo giá chỉ là bản giá gửi khách, không giữ hàng, không trừ kho, không phát sinh sản xuất, tiền hoặc công nợ

---

## 2. Bố cục tổng thể

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Chứng từ bán hàng                                      [Tạo tại POS] [Xuất]  │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc               │ [Theo mã chứng từ / khách hàng / SĐT / ghi chú...]    │
│ - Thời gian          │                                                       │
│ - Loại chứng từ      │ Bảng chứng từ                                         │
│ - Trạng thái         │                                                       │
│ - Khách hàng         │                                                       │
│ - Người bán          │                                                       │
│ - Thanh toán         │                                                       │
│ - Bảng giá           │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Tìm kiếm nhanh | Tìm theo mã chứng từ, mã khách, tên khách, SĐT nếu có, ghi chú đơn |
| Thời gian | Mặc định tháng này; chọn nhanh theo ngày/tuần/tháng/quý/năm/toàn thời gian. Không còn radio `Tùy chỉnh`; hai ô từ ngày/đến ngày luôn hiển thị dạng `dd/MM/yyyy`, có icon lịch. Popup lịch mở bên phải cột filter như menu chọn nhanh, chỉ một popup/menu được mở tại một thời điểm. Preset hiện tại không hiển thị ngày kết thúc vượt quá hôm nay; `Toàn thời gian` hiển thị khoảng ngày có dữ liệu khi xác định được. |
| Loại hóa đơn | Checkbox nhiều chọn: Hóa đơn, Báo giá. Mặc định chọn cả hai. API nhận `type=invoice,quote`; nếu bỏ hết thì gửi `__none__` và trả rỗng. |
| Trạng thái hóa đơn | Checkbox nhiều chọn: Đang hiệu lực, Hoàn tất, Đã hủy. Mặc định chọn `active,completed`; `cancelled` chỉ hiện khi người dùng chọn. API nhận `status=active,completed,cancelled`. |
| Thanh toán | Checkbox nhiều chọn: Chưa thanh toán, Thanh toán một phần, Đã thanh toán. Mặc định chọn cả ba. API nhận `payment_status=unpaid,partial,paid`. |
| Phương thức TT | Tất cả, Tiền mặt, Chuyển khoản, Kết hợp nếu có dữ liệu |
| Khách hàng | Chọn khách hoặc nhập nhanh tên/mã/SĐT |
| Người bán/người tạo | Trong QC-OMS hiện tại hai khái niệm này dùng cùng tài khoản tạo/chốt chứng từ; UI chỉ cần một filter người bán/người tạo |
| Bảng giá | Giá chung hoặc bảng giá theo nhóm khách |

Không có bộ lọc giao hàng, COD, đối tác giao hàng, kênh bán, HĐĐT, VAT, trạng thái giao hàng, trạng thái vận đơn hoặc trạng thái đồng bộ sàn.

Các nhóm checkbox trong sidebar tự áp dụng ngay khi đổi lựa chọn, không có nút `Lọc` hoặc `Đặt lại`. Filter nhiều chọn phải dùng CSS chung `ManagementFilterSidebar`, `ManagementFilterGroup`, `management-filter-choice`, `management-filter-select`; không tạo CSS riêng nếu control hiện có đáp ứng.

Khi người dùng tìm đúng mã chứng từ, hệ thống phải tìm trên toàn bộ lịch sử hoặc tự bỏ các filter thời gian/trạng thái đang che kết quả.

Nếu filter tồn tại ở KiotViet nhưng QC-OMS chưa có schema/dữ liệu thật, không hiển thị filter đó ở UI. Không tạo filter rỗng chỉ để giống KiotViet.

---

## 4. Cột bảng

| Cột | Mô tả |
|---|---|
| Mã chứng từ | `BG...`, `HD...`, `HD....01`; bấm để mở chi tiết |
| Thời gian | Thời điểm lưu báo giá hoặc checkout hóa đơn |
| Loại | Báo giá hoặc Hóa đơn |
| Mã khách | Mã khách tại thời điểm lưu; khách lẻ mặc định là `khachle` |
| Khách hàng | Tên khách snapshot tại thời điểm lưu |
| Tổng tiền hàng | Tổng trước giảm/điều chỉnh |
| Giảm giá | Nếu có |
| Khách cần trả | Số tiền phải thu của chứng từ |
| Khách đã trả | Tiền đã thu cho hóa đơn này |
| Còn nợ | Chỉ hiển thị với hóa đơn còn nợ |
| Người bán | Tài khoản tạo/chốt chứng từ; không tách riêng người tạo/người bán trong QC-OMS hiện tại |
| Trạng thái | Báo giá, Hoàn thành, Đã hủy |
| Ghi chú | Ghi chú đơn |

Các cột có thể ẩn/hiện, nhưng bộ cột mặc định phải gọn để nhìn nhanh trên màn hình bán hàng. Cột tiền canh phải. Tiêu đề cột tiền cũng canh phải theo giá trị.

Nếu POS/báo giá/hóa đơn không chọn khách, backend phải gán chứng từ vào `khachle - Khách lẻ` của tổ chức. Danh sách chứng từ vẫn có thể hiển thị snapshot `Khách lẻ`, nhưng filter/lịch sử theo khách phải dựa trên customer record có mã `khachle`, không để chứng từ bán lẻ ở `customer_id = null`.

---

## 5. Thao tác nhanh

### 5.1. Hiện tại

| Trạng thái | Thao tác |
|---|---|
| Hóa đơn hoàn thành | Mở chi tiết readonly; bấm **Sửa** mở POS revision draft riêng, tab hiển thị `Sửa HD...` |
| Hóa đơn đã hủy | Mở chi tiết readonly nếu dữ liệu đã có |
| Báo giá active | Mở chi tiết readonly, mở lại vào POS draft local |
| Báo giá không còn mở được | Mở chi tiết readonly; xử lý theo cảnh báo nếu sản phẩm/khách/giá đã lệch |

### 5.2. Chưa làm trong V1

Các thao tác sau không hiển thị trong footer chi tiết V1:

| Trạng thái | Thao tác chưa làm |
|---|---|
| Hóa đơn hoàn thành | Trả hàng, Tạo QR |
| Hóa đơn đã hủy | Trả hàng, Tạo QR |

Lưu ý: luồng sửa hóa đơn hoàn thành đã có ở V1, nhưng không nằm trong nhóm thao tác footer ở bảng trên. Flow này mở POS bằng handoff riêng `invoice-revision`, giữ tab `Sửa HD...`, và khi lưu sẽ gọi `POST /orders/{id}/revise`.

---

## 6. Empty state

Khi không có kết quả:

- Hiển thị `Không tìm thấy chứng từ phù hợp`.
- Có nút bỏ lọc nhanh.
- Nếu người dùng đang lọc theo thời gian/trạng thái, gợi ý mở rộng thời gian hoặc bỏ lọc.
- Không tự tạo dữ liệu mẫu.

---

## 7. Quy tắc giữ khác KiotViet

- Không có trả hàng trong MVP.
- Không có giao hàng/vận đơn/COD trong MVP.
- Không có `Đặt hàng` kiểu KiotViet trong MVP.
- Không có bán hàng online/kênh bán trong MVP.
- Không có HĐĐT/thuế kế toán.
- Không có gộp đơn.
- Không import hóa đơn từ file trong MVP.
