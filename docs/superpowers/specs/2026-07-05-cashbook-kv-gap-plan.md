# Cashbook KiotViet Gap Plan

> Ngày lập: 2026-07-05
> Nguồn: KiotViet `Sổ quỹ`, file xuất `SoQuy_KV05072026-185646-888.xlsx`, docs/code QC-OMS tại `origin/main` sau PR #71.
> Cập nhật: 2026-07-06 theo `origin/main` sau PR #85 và slice `finance-cashbook-main-layout`.
> Loại tài liệu: gap/roadmap, không thay Source of Truth. Source of Truth nằm ở `Finance/CASHBOOK.md`, `Finance/02-CASHBOOK.md`, `CASHBOOK-TABLES.md`, `FINANCE-API.md`.

## 1. Kết luận nhanh

Sổ quỹ QC-OMS đã có layout chính gần KiotViet hơn sau các slice PR #83-#85 và `finance-cashbook-main-layout`, nhưng chưa đủ hoàn chỉnh như KiotViet.

Đã có nền chính:

- bảng `cashbook_entries`
- bảng `cashbook_vouchers`
- số dư quỹ/tài khoản
- list sổ quỹ
- detail cashbook/payment receipt backend
- thu nợ khách tạo cashbook entry
- UI `/finance` lấy sổ quỹ làm bảng chính, filter sidebar bên trái
- summary `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ` nằm trong khu vực chính bên phải ngay trên bảng sổ quỹ và đổi theo filter
- `Tồn quỹ` dùng `summary.ending_balance`, không còn dùng tổng số dư tài khoản tĩnh
- bộ lọc đang có tự áp dụng khi đổi giá trị: thời gian, quỹ tiền, loại chứng từ, trạng thái, hạch toán KQKD
- quick time menu: hôm nay/hôm qua/tuần/tháng/quý/năm/toàn thời gian/tùy chỉnh
- bảng sổ quỹ có inline detail và pagination footer
- tạo phiếu thu/chi thủ công từ header
- xuất file từ header
- các panel phụ `Tài khoản quỹ`, `Công nợ khách hàng`, `Phiếu thu/chi` đã ẩn khỏi thân trang sổ quỹ

Thiếu lớn:

- filter đầy đủ như KV: loại thu chi, người tạo, nhân viên, người nộp/nhận, công nợ đối tác
- search sổ quỹ theo mã phiếu/ghi chú/nội dung chuyển khoản ngay trên UI
- detail inline còn cần hoàn thiện thêm các trường KV như người thu/chi, mã đối tượng, trạng thái chứng từ gốc
- sửa/hủy phiếu thu/chi thủ công cần surface rõ trên UI chính hoặc detail
- danh mục loại thu/chi thực tế
- chọn cột
- luồng chuyển/rút tạo cặp phiếu

## 2. KiotViet quan sát được

### 2.1 Màn chính

- Title theo quỹ: `Sổ quỹ tiền mặt`.
- Search theo `Mã phiếu`; menu nâng cao có `Theo mã phiếu`, `Theo ghi chú`, `Theo nội dung chuyển khoản`.
- Action:
  - `+ Phiếu thu`: Tiền mặt, Ngân hàng, Ví điện tử.
  - `+ Phiếu chi`: Tiền mặt, Ngân hàng, Ví điện tử.
  - Xuất file.
  - Chọn cột.
  - Thiết lập/hướng dẫn.
- Summary: `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ`.
- Table mặc định: `Mã phiếu`, `Thời gian`, `Loại thu chi`, `Người nộp/nhận`, `Giá trị`.

### 2.2 Filter

- Quỹ tiền: Tiền mặt, Ngân hàng, Ví điện tử, Tổng quỹ.
- Thời gian: Tháng này, Tùy chỉnh.
- Loại chứng từ: Phiếu thu, Phiếu chi.
- Loại thu chi.
- Trạng thái: Đã thanh toán, Đã hủy.
- Hạch toán kết quả kinh doanh: Tất cả, Có, Không.
- Người tạo.
- Nhân viên.
- Người nộp/nhận: loại đối tượng, tên/mã, số điện thoại.
- Công nợ đối tác: Tính vào công nợ, Không tính vào công nợ, Không có công nợ.

### 2.3 Detail phiếu thu tự động

Ví dụ `TTHD011029`:

- Phiếu thu, trạng thái `Đã thanh toán`.
- `Không hạch toán`.
- Người tạo, người thu, thời gian, chi nhánh.
- Số tiền, loại thu, đối tượng nộp, phương thức thanh toán.
- Người nộp có tên và mã khách.
- Khối gắn hóa đơn: `Phiếu thu tự động được gắn với hóa đơn HD...`.
- Bảng phân bổ: mã hóa đơn, thời gian, giá trị phiếu, đã thu trước, giá trị thu, trạng thái.

### 2.4 Detail phiếu chi thủ công

Ví dụ `CTM001180`:

- Phiếu chi, trạng thái `Đã thanh toán`.
- `Có hạch toán`.
- Người tạo, người chi, thời gian, chi nhánh.
- Số tiền âm, loại chi, đối tượng nhận, phương thức thanh toán.
- Người nhận có tên, mã NCC, số điện thoại.
- Ghi chú.

### 2.5 Form phiếu thu/chi

Form tiền mặt quan sát được:

- mã phiếu tự động
- thời gian
- loại thu/chi
- người thu/chi
- đối tượng nộp/nhận
- tên người nộp/nhận, có `Tạo mới`
- số tiền
- ghi chú
- hạch toán kết quả kinh doanh
- `Bỏ qua`, `Lưu & In`, `Lưu`

### 2.6 File xuất mẫu

File tháng 06/2026:

- 241 dòng.
- Cột xuất: `Mã phiếu`, `Thời gian`, `Loại thu chi`, `Người nộp/nhận`, `Giá trị`.
- Tổng giá trị: `910,931,529`.
- Tổng thu: `1,235,587,769`.
- Tổng chi: `-324,656,240`.

Nhóm loại thu/chi nổi bật:

| Loại thu/chi | Số dòng | Tổng |
|---|---:|---:|
| Phiếu thu Tiền khách trả | 143 | 130,859,203 |
| Phiếu chi Lương NV | 21 | -32,699,000 |
| Phiếu chi Vận chuyển | 17 | -1,632,000 |
| Phiếu chi Vật tư | 15 | -3,967,000 |
| Phiếu chi Tiền trả NCC | 13 | -39,957,714 |
| Phiếu thu Chuyển/Rút | 6 | 46,593,000 |
| Phiếu chi Chuyển/Rút | 6 | -46,593,000 |
| Chi phí khác | 5 | -664,000 |

## 3. QC-OMS hiện có

### 3.1 Database

Đã có:

- `payment_receipts`
- `payment_receipt_methods`
- `cashbook_vouchers`
- `cashbook_entries`
- `cash_reconciliations`
- `cash_reconciliation_items`

Đã có một phần:

- `cashbook_vouchers.is_business_accounted`
- counterparty tự do: `counterparty_type`, `counterparty_name`, `counterparty_phone`
- revision fields `base_code`, `revision_no`, `revised_from_voucher_id`, `replaced_by_voucher_id`

Thiếu/gap:

- enum `voucher_type` còn hẹp, chưa chứa lương, vận chuyển, trả NCC, chuyển/rút, thuế/VAT, hoa hồng.
- chưa có liên kết cặp phiếu chuyển/rút.
- partner-debt mode đã có trong payload/UI phiếu thủ công ở mức MVP; cần rà schema/API để bảo đảm lưu và filter thống nhất theo SoT.
- chưa có danh mục loại thu/chi cấu hình riêng.

### 3.2 Backend

Đã có route:

- `GET /finance/accounts`
- `GET /finance/customer-debts`
- `GET /finance/retail-debts`
- `GET /finance/customers/{id}/debt`
- `POST /finance/debt-collections`
- `GET /finance/cashbook`
- `GET /finance/cashbook/balances`
- `GET /finance/cashbook/vouchers`
- `GET /finance/cashbook/{id}`
- `GET /finance/payment-receipts/{id}`
- `GET /finance/reconciliations`

Thiếu/gap:

- `GET /finance/payment-receipts` list.
- API phiếu thủ công đã có theo các slice trước, nhưng docs/API cần giữ contract rõ cho create/revise/cancel và kiểm lại endpoint thực tế trước slice UI tiếp theo.
- `POST /finance/cashbook-transfers`.
- filter còn thiếu hoặc chưa nối UI đầy đủ: `voucher_type`, `counterparty`, `partner_debt_filter`, `search_scope`.
- export phía frontend đã có CSV theo dòng đang thấy; backend export theo filter và định dạng giống KV vẫn là future.
- reconciliation create/update/balance/cancel routes dù docs đã mô tả.

### 3.3 Frontend

Hiện tại `/finance` là màn sổ quỹ chính:

- header: tìm công nợ nhanh, nút `+ Phiếu thu`, `+ Phiếu chi`, `Xuất file`
- filter sidebar: thời gian, quỹ tiền, loại chứng từ, trạng thái, hạch toán KQKD
- filter đã dùng KV shape cho phần đủ API: quỹ tiền là radio list, loại chứng từ/trạng thái là checkbox group, hạch toán KQKD là segmented tabs
- main: summary sổ quỹ, bảng sổ quỹ, inline detail dòng sổ, pagination footer
- inline detail đã có panel KV-like: tab thông tin, tiêu đề phiếu thu/chi, chip trạng thái/hạch toán, nhật ký, grid thông tin, bảng chứng từ liên kết khi có allocations, footer ghi chú và action disabled khi chưa có hành vi an toàn
- form tạo/sửa phiếu thu/chi mở inline khi thao tác
- các khối phụ tài khoản quỹ/công nợ/phiếu thu chi không hiển thị trong thân trang

Thiếu/gap so với KV:

- chưa có search sổ quỹ riêng theo mã phiếu/ghi chú/nội dung chuyển khoản.
- chưa lọc theo loại thu chi, người tạo, nhân viên, người nộp/nhận, công nợ đối tác.
- detail inline cần backend bổ sung chi nhánh thật theo phiếu, người thu/người chi riêng, tài khoản ngân hàng nguồn/đích, loại thu/chi chi tiết theo `voucher_type`, mã/tên/số điện thoại đối tượng đầy đủ.
- sửa/hủy phiếu thủ công chưa có điểm thao tác nổi bật trong bảng chính.
- chưa có chọn cột.
- xuất file hiện ở frontend; cần chốt format/cột giống KV nếu dùng vận hành thật.

## 4. Kế hoạch làm hoàn chỉnh

### Slice 1 — Sổ quỹ list/filter/detail parity — Đã làm một phần qua PR #83

Mục tiêu: nhìn và tra cứu sổ quỹ giống KV trước.

Đã làm:

- `/finance` ưu tiên sổ quỹ, ẩn panel phụ khỏi thân trang.
- sidebar filter: quỹ/tài khoản, thời gian, thu/chi, trạng thái, hạch toán.
- quỹ/tài khoản đã đổi từ select sang radio list; mặc định chọn quỹ tiền mặt nếu có.
- thu/chi và trạng thái đã đổi từ select sang checkbox group.
- hạch toán KQKD đã đổi từ select sang segmented tabs.
- summary: quỹ đầu kỳ, tổng thu, tổng chi, tồn quỹ nằm ngay trên bảng dữ liệu.
- table default cột giống KV: checkbox, đánh dấu sao, mã phiếu, thời gian, loại thu chi, người nộp/nhận, loại sổ quỹ, giá trị.
- click dòng mở detail inline.
- detail phiếu thu tự động hiển thị panel KV-like và phân bổ nếu API trả allocations.
- export file ở header.

Còn lại:

- search sổ quỹ theo mã/ghi chú/nội dung chuyển khoản.
- filter loại thu chi, người tạo, nhân viên, người nộp/nhận, công nợ đối tác.
- detail bổ sung đủ trường KV.
- chọn cột.

Không làm:

- chuyển/rút tự động.
- ví điện tử.

### Slice 2 — Manual phiếu thu/chi MVP — Đã làm một phần

Mục tiêu: tạo phiếu thu/chi thủ công tiền mặt/ngân hàng.

Đã có:

- API `POST /finance/cashbook-vouchers`.
- form tạo phiếu thu/chi.
- người nộp/nhận: khách hàng, nhà cung cấp, nhân viên, khác, không có.
- số điện thoại/ghi chú.
- cờ hạch toán KQKD.
- công nợ đối tác mode.
- tạo dòng `cashbook_entries` trong cùng transaction.

Còn lại:

- loại thu/chi theo danh mục nội bộ mở rộng đầy đủ thực tế KV.
- tạo mới đối tượng ngay trong form nếu Owner cần.
- `Lưu & In` nếu có mẫu in.

Không làm:

- ví điện tử.
- duyệt nhiều bước.

### Slice 3 — Sửa/hủy phiếu thủ công — Backend/logic đã có, UI chính cần surface rõ

Mục tiêu: sửa sai không mất lịch sử.

Làm:

- API revise tạo `MaCu.01`.
- API cancel.
- UI action chỉ cho phiếu thủ công, cần đặt ở nơi người dùng dễ thấy trong bảng/detail chính.
- phiếu cũ `cancelled`, dòng cũ `cancelled`, bản mới `posted`.
- detail vẫn xem được bản hủy.

Quy tắc:

- phiếu tự động từ POS/thu nợ không sửa rời.
- muốn sửa phiếu tự động phải đi qua nghiệp vụ gốc.

### Slice 4 — Chuyển/Rút giữa quỹ

Mục tiêu: không nhập tay hai phiếu dễ lệch.

Làm:

- API `POST /finance/cashbook-transfers`.
- tạo cặp phiếu chi nguồn và phiếu thu đích.
- cùng mã nhóm điều chuyển.
- tổng quỹ không đổi.
- filter/chi tiết hiển thị được cặp liên quan.

### Slice 5 — Xuất file + chọn cột

Mục tiêu: phục vụ đối soát và gửi file.

Đã có:

- xuất file từ frontend theo dòng đang thấy.

Còn lại:

- chọn cột hiển thị.
- export theo filter hiện tại.
- export tối thiểu giống file KV mẫu.
- thêm cột QC-OMS: quỹ/tài khoản, trạng thái, hạch toán, ghi chú, người tạo.

### Slice 6 — Đối soát sau khi sổ quỹ ổn

Mục tiêu: kiểm tiền cuối ngày/tùy lúc, không bắt buộc chốt ca cứng.

Làm:

- tạo phiên đối soát nháp.
- nhập số thực tế theo tiền mặt/từng ngân hàng.
- chênh lệch hiển thị ngay.
- chốt phiên.
- không tự sinh phiếu điều chỉnh; nếu lệch thì tạo phiếu thu/chi thủ công có lý do.

## 5. Câu chưa cần hỏi Owner

Đã rõ, không hỏi thêm:

- MVP không làm ví điện tử nếu chưa có nghiệp vụ riêng.
- Không duyệt nhiều bước.
- Phiếu sửa/hủy giữ lịch sử, không xóa.
- Phiếu tự động không sửa rời.
- Báo cáo/chốt ca/chốt ngày không phải màn bắt buộc trước; sổ quỹ là dòng tiền động.

## 6. Câu chỉ hỏi nếu tới slice tương ứng

Chỉ hỏi khi bắt đầu slice có rủi ro dữ liệu:

1. Danh mục loại thu/chi mặc định cần tạo sẵn những mục nào ngoài danh sách thấy trong file KV.
2. `Chuyển/Rút` có cần luồng riêng ngay hay chấp nhận nhập thủ công cặp phiếu trong giai đoạn đầu.
3. `Lưu & In` phiếu thu/chi có cần mẫu in ngay không.
4. Công nợ nhà cung cấp có làm cùng sổ quỹ hay để sau khi Purchase/NCC ổn.

## 7. Đề xuất tiếp theo

Làm Slice 1 trước.

Lý do:

- Không tạo/sửa tiền nên rủi ro thấp.
- Cho người dùng thấy sổ quỹ đúng nghiệp vụ ngay.
- Là nền bắt buộc cho tạo phiếu, sửa/hủy, xuất file, đối soát.

Tên branch đề xuất:

```text
codex/cashbook-list-filter-detail-parity
```
