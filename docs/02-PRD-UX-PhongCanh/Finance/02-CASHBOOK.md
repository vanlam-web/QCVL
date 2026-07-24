# CASHBOOK — UX sổ quỹ và phiếu thu/chi

> **Nguồn tham khảo UI:** KiotViet Sổ quỹ tiền mặt.

---

## Cập nhật hiện tại

Cập nhật: `2026-07-24`

- Contract form phiếu thu/chi thủ công hiện hành: chỉ chọn `Phiếu thu` hoặc `Phiếu chi`; `Phương thức TT` quyết định tiền mặt/chuyển khoản; `Loại thu/chi` quyết định nhóm đối tượng nộp/nhận; chỉ `Khác` được nhập tự do, các nhóm còn lại phải chọn hoặc tạo nhanh bản ghi master data.
- Nhóm đối tượng dự kiến: `Khách hàng`, `Nhà cung cấp`, `Nhân viên`, `Đối tác giao hàng`, `Khác`.
- Thêm/lưu đối tượng dự kiến: khách hàng/NCC tạo nhanh vào master data riêng; nhân viên chỉ chọn từ danh sách có sẵn; đối tác giao hàng lưu ở `delivery_partners`; `Khác` là nhóm duy nhất lưu text tự do trên phiếu.
- Thao tác phiếu thu/chi theo KiotViet: tạo phiếu, lưu, lưu & in, xem, cập nhật/sửa, hủy mềm, in, tìm kiếm/lọc/sắp xếp/xuất file. `Xóa` trong QCVL là hủy mềm, không xóa vật lý.

---

## 0. Ghi nhận từ KiotViet

Quan sát bổ sung ngày `05/07/2026` từ KiotViet đang mở và file xuất `SoQuy_KV05072026-185646-888.xlsx`:

- Màn chính có title theo quỹ đang chọn, ví dụ `Sổ quỹ tiền mặt`.
- Top search mặc định `Theo mã phiếu`, có chế độ tìm nâng cao:
  - theo mã phiếu
  - theo ghi chú
  - theo nội dung chuyển khoản
- Action đầu trang:
  - `+ Phiếu thu`: Tiền mặt, Ngân hàng, Ví điện tử
  - `+ Phiếu chi`: Tiền mặt, Ngân hàng, Ví điện tử
  - xuất file
  - chọn cột hiển thị
  - thiết lập/hướng dẫn
- Bộ lọc trái có:
  - Quỹ tiền: Tiền mặt, Ngân hàng, Ví điện tử, Tổng quỹ; khi chọn Ngân hàng mới chọn tài khoản cụ thể ở ô riêng
  - Thời gian: nút chọn nhanh (mặc định Tháng này) và 2 ô ngày luôn hiển thị
  - Loại chứng từ: Phiếu thu, Phiếu chi
  - Loại thu chi
  - Trạng thái: Đã thanh toán, Đã hủy
  - Hạch toán kết quả kinh doanh: Tất cả, Có, Không
  - Người tạo
  - Nhân viên
  - Người nộp/nhận: loại đối tượng, tên/mã, số điện thoại
  - Công nợ đối tác: Tính vào công nợ, Không tính vào công nợ, Không có công nợ
- Summary gồm `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ`.
- Bảng mặc định gồm `Mã phiếu`, `Thời gian`, `Loại thu chi`, `Người nộp/nhận`, `Giá trị`.
- Chọn cột có thêm: `Thời gian tạo`, `Người tạo`, `Nhân viên`, `Chi nhánh`, `Tên tài khoản`, `Số tài khoản`, `Mã người nộp/nhận`, `Số điện thoại`, `Địa chỉ`, `Nội dung chuyển khoản`, `Ghi chú`, `Loại sổ quỹ`, `Trạng thái`.
- File xuất 1 tháng có 241 dòng, cột xuất tối thiểu: `Mã phiếu`, `Thời gian`, `Loại thu chi`, `Người nộp/nhận`, `Giá trị`.
- File xuất CSV của QCVL phải có UTF-8 BOM để Excel mở trực tiếp không lỗi dấu tiếng Việt.
- File xuất tháng 06/2026 có các nhóm thực tế:
  - `Phiếu thu Tiền khách trả`: 143 dòng
  - `Phiếu chi Lương NV`: 21 dòng
  - `Phiếu chi Vận chuyển`: 17 dòng
  - `Phiếu chi Vật tư`: 15 dòng
  - `Phiếu chi Tiền trả NCC`: 13 dòng
  - `Phiếu thu/chi Chuyển/Rút`
  - `Chi phí khác`
  - các chi phí lẻ: điện, nước, nhà, rác, thuế, hoa hồng, VAT cho khách

Quan sát trước đó ngày `01/07/2026`:

- Bộ lọc mặc định `Tháng này` trống vì đầu tháng mới, không dùng làm căn cứ đánh giá dữ liệu.
- Chọn `Toàn thời gian` trên quỹ `Tiền mặt` có `4,161 phiếu thu chi`.
- Summary toàn thời gian tiền mặt hiển thị `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ`.
- Ví dụ phiếu thu tự động `TTHD010973`:
  - trạng thái `Đã thanh toán`
  - `Không hạch toán`
  - người tạo/người thu
  - chi nhánh nếu sau này có nhiều chi nhánh; MVP một chi nhánh ngầm nên không hiển thị bộ lọc này
  - phương thức thanh toán `Tiền mặt`
  - người nộp là khách hàng
  - ghi rõ phiếu thu tự động gắn với hóa đơn `HD010973`
  - có bảng phân bổ: mã hóa đơn, tổng sau giảm, chưa TT, giá trị thu
- Ví dụ phiếu chi thủ công `CTM001170`:
  - trạng thái `Đã thanh toán`
  - `Có hạch toán`
  - người tạo/người chi
  - phương thức thanh toán `Tiền mặt`
  - đối tượng nhận `Khác`
  - người nhận có tên và SĐT
  - có ghi chú chi, ví dụ `Xăng xe`
- Ví dụ phiếu chi thủ công `CTM001180` ngày `04/07/2026`:
  - tiêu đề `Phiếu chi CTM001180`
  - trạng thái `Đã thanh toán`
  - chip `Có hạch toán`
  - người tạo, người chi, thời gian, chi nhánh
  - số tiền âm
  - loại chi `Chi Vận chuyển`
  - đối tượng nhận `Nhà cung cấp`
  - phương thức thanh toán `Tiền mặt`
  - người nhận hiển thị tên, mã NCC và số điện thoại
  - ghi chú
- Ví dụ phiếu thu tự động `TTHD011029` ngày `04/07/2026`:
  - tiêu đề `Phiếu thu TTHD011029`
  - trạng thái `Đã thanh toán`
  - chip `Không hạch toán`
  - người tạo, người thu, thời gian, chi nhánh
  - loại thu `Thu Tiền khách trả`
  - đối tượng nộp `Khách hàng`
  - phương thức thanh toán `Tiền mặt`
  - người nộp hiển thị tên và mã khách
  - có khối `Phiếu thu tự động được gắn với hóa đơn HD...`
  - bảng gắn hóa đơn gồm mã phiếu/hóa đơn, thời gian, tổng sau giảm, chưa TT, giá trị thu
- Form tạo phiếu thu tiền mặt có:
  - mã phiếu tự động
  - thời gian
  - loại thu
  - người thu
  - đối tượng nộp
  - tên người nộp và `Tạo mới`
  - số tiền
  - ghi chú
  - checkbox `Hạch toán kết quả kinh doanh`
  - nút `Bỏ qua`, `Lưu & In`, `Lưu`
- Loại thu KV thấy được: `Thu nhập khác`, `Chuyển/Rút`, `Chi phí cố định`, `Góp vốn`, `Khách trả nợ`, `Tạo mới`.
- Form tạo phiếu chi tiền mặt có cấu trúc tương tự, đổi thành loại chi/người chi/đối tượng nhận/người nhận.
- Loại chi KV thấy được gồm nhóm hệ thống và các mục: `Chi phí khác`, `Chuyển/Rút`, `Chi phí điện`, `Chi phí hội nghị, sự kiện, công tác phí`, `Chi phí nhân công`, `Chi phí nước`, `Chi phí phần mềm, dịch vụ quản trị, tư vấn`, `Chi phí quảng cáo`, cùng các loại thực tế từ file xuất như lương, vận chuyển, vật tư, tiền trả NCC, tiền nhà, rác, thuế, hoa hồng, VAT cho khách.

Áp dụng cho QCVL:

- Tìm theo mã phiếu phải mở rộng/bỏ filter thời gian nếu filter hiện tại che kết quả.
- Phiếu thu từ hóa đơn/thu nợ phải hiển thị liên kết chứng từ gốc và phân bổ vào hóa đơn.
- Phiếu chi thủ công cần lưu cờ có tính vào báo cáo kinh doanh hay không.
- Người nộp/nhận có thể là khách hàng, nhà cung cấp, nhân viên hoặc đối tượng tự do.
- `Ví điện tử` có trong KiotViet nhưng QCVL MVP vẫn chưa đưa vào nếu Owner chưa chốt nghiệp vụ riêng; cần thiết kế mở để thêm sau.

Tham khảo tài liệu KiotViet online rà lại ngày `21/07/2026`:

- Retail Sổ quỹ: `https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-so-quy/so-quy/` có các nhóm thao tác: tạo phiếu thu/chi, quản lý phiếu gồm xem/cập nhật/hủy/chia sẻ/in, tìm kiếm/lọc/sắp xếp/xuất file.
- FNB mobile Sổ quỹ: `https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-so-quy/so-quy/` tạo phiếu từ nút `+`, chọn lập phiếu thu/chi, nhập thông tin và bấm `Lưu`; detail có hủy/in.
- Salon Sổ quỹ: `https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/salon-so-quy/so-quy/` cho sửa phiếu thủ công trên sổ quỹ, giới hạn trường sửa theo loại phiếu; với chuyển/rút nội bộ, hủy một phiếu thì phiếu đối ứng cũng bị hủy theo.
- FNB web Sổ quỹ cũ: `https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/so-quy-web-fnb/so-quy/` ghi rõ tạo phiếu thu/chi, lưu, cập nhật và hủy bỏ phiếu.
- QCVL áp dụng cùng nhóm chức năng nhưng khác điểm cốt lõi: sửa phiếu không ghi đè, mà tạo bản sửa mới `MaCu.01`; xóa trong UI là hủy mềm.

Hiện trạng detail inline sau ngày `06/07/2026`:

- Click bất kỳ vùng dữ liệu nào trên dòng sổ quỹ sẽ mở sub-panel ngay dưới dòng, cùng pattern với trang chứng từ bán hàng. Click lại chính dòng đang mở sẽ đóng sub-panel. Mã phiếu và người nộp/nhận vẫn hiển thị dạng link, nhưng hành vi mở/đóng detail là của cả dòng.
- Dòng đang mở detail dùng trạng thái selected chung của bảng quản trị; checkbox chọn dòng và sao ưu tiên không làm bung detail.
- Panel có tab `Thông tin`, tiêu đề `Phiếu thu/chi <mã>`, chip `Đã thanh toán/Đã hủy`, chip `Có hạch toán/Không hạch toán`. QCVL không hiển thị `Chi nhánh trung tâm` vì MVP không quản lý theo chi nhánh.
- Detail dùng shared shell của các trang quản trị: `ManagementDetailPanel`, `ManagementInlineDetailTabs`, `ManagementDetailHeader`, `ManagementDetailInfoList`, `ManagementDetailInlineNote`, `ManagementDetailActionFooter`. Tiêu đề nằm trong header detail, `Người tạo` và `Thời gian` nằm trong grid meta, không dùng dòng log riêng. Với dữ liệu import KV, `Người tạo` ưu tiên người tạo gốc trong file sổ quỹ; trong QCVL người tạo phiếu cũng chính là người thu/chi nên không hiển thị `Người thu`/`Người chi` riêng.
- Grid thong tin chinh trong detail dung shared `management-detail-meta-grid-three`, hien thi 2 hang x 3 cot khi du cho; neu mot o bi chat thi ca grid trong detail do chuyen sang 2 hang label tren, value duoi. Tat ca label/value luon canh trai. Cac truong giu nguyen: nguoi tao, thoi gian, so tien, loai thu/chi, phuong thuc thanh toan, nguoi nop/nhan. Khong hien thi rieng `Doi tuong nop/nhan` vi KV So Quy khong co loai doi tuong du tin cay; chi hien thi ten/SDT nguoi nop/nhan dang text thuong, khong link/button. Khong hien thi rieng dong `Tu quy` trong detail vi trung voi phuong thuc/tai khoan thanh toan. `Phuong thuc thanh toan` phai hien du lieu cu the: `Tien mat` cho quy tien mat, hoac ten ngan hang viet tat + so tai khoan nhu `MBBank: 0947900909` cho tai khoan ngan hang.
- Ghi chú hiển thị phía trên khối chứng từ liên kết. Ghi chú hệ thống dạng `Checkout HD...` không hiển thị như ghi chú thủ công; mã hóa đơn trong chuỗi này chỉ dùng để suy luận chứng từ liên kết khi API chưa trả `allocations`.
- Nếu API trả `allocations`, panel hiển thị câu liên kết chứng từ và bảng con dùng shared class `management-detail-linked-table`: mã chứng từ, thời gian, `Tổng sau giảm` với phiếu thu bán hàng HD hoặc `Giá trị phiếu` với chứng từ chi/mua hàng, `Chưa TT` với phiếu thu bán hàng hoặc `Đã trả trước` với chứng từ chi/mua hàng, giá trị thu/chi. Bảng này dùng `table-layout: auto`, mã/thời gian canh trái, các cột tiền canh phải, tiêu đề canh theo cột và không tạo scroll ngang trên desktop bình thường. `Đã thu trước` là số tiền hóa đơn đã thu ở các phiếu trước đó khi thanh toán nhiều lần; UI không dùng làm cột chính vì `Chưa TT` giúp nhìn rõ còn thiếu bao nhiêu sau phiếu hiện tại.
- Với phiếu thu gắn hóa đơn, trạng thái thanh toán hiển thị trên chip đầu detail, không lặp lại trong bảng con: `Hoàn tất` khi trả đủ dùng màu `success`, `Thanh toán 1 phần` khi vẫn còn nợ dùng màu `warning`, `Chưa thanh toán` dùng màu `neutral` nhưng chỉ xuất hiện ở màn hóa đơn vì chưa thanh toán nghĩa là chưa có phiếu thu.
- Nếu không có `allocations` nhưng ghi chú/source chứa mã `HD...` hoặc `PN...`, panel vẫn hiển thị dòng chứng từ liên kết suy luận để người dùng thấy phiếu thu/chi gắn với hóa đơn/phiếu nhập nào. Với dữ liệu legacy dạng `Checkout HD...`, backend phải ưu tiên suy ra hóa đơn và trả allocation từ tổng tiền/đã thu/còn nợ của hóa đơn; frontend được phép đọc hóa đơn theo mã để bù `Tổng sau giảm`, `Chưa TT` và chip trạng thái, chỉ dùng fallback theo số tiền phiếu khi cả finance API và sales API đều chưa đủ dữ liệu. Nếu không có dữ liệu liên kết, ẩn toàn bộ khối `Chứng từ liên kết`, không hiển thị tiêu đề, bảng con hoặc trạng thái rỗng.
- Không hiển thị dòng `Tiền chưa phân bổ: 0` trong detail.
- Footer detail dùng shared component `ManagementDetailActionFooter`, tương ứng CSS chung `management-detail-footer-actions` và `button button-danger/button-secondary/button-primary`. Sổ quỹ có `Xóa` canh trái, `Sửa` và `In` canh phải. `Xóa` mở `ManagementConfirmDialog`; chỉ phiếu thu/chi thủ công trạng thái `posted` được hủy mềm qua `POST /finance/cashbook-vouchers/{id}/cancel`, không xóa vật lý khỏi sổ quỹ. Phiếu KiotViet, POS/thu nợ hoặc phiếu tự động không hủy tại đây; dialog hiển thị lý do và yêu cầu xử lý qua luồng import/chứng từ gốc.

Field còn thiếu để giống KV tuyệt đối: loại thu/chi chi tiết theo `voucher_type`, mã/tên/số điện thoại đối tượng đầy đủ trong detail, lịch sử sửa/hủy phiếu nếu KV có. Tài khoản ngân hàng hiện chỉ cần hiển thị mức vận hành là tên ngân hàng viết tắt + số tài khoản trong `Phương thức TT`; không hiển thị thêm dòng tài khoản nguồn/đích nếu làm trùng thông tin. Không hiển thị `Chi nhánh`, `Người thu` hoặc `Người chi` riêng trong MVP.

---

## 1. Mục đích

Màn Sổ quỹ cho phép xem dòng tiền vào/ra và tạo phiếu thu/chi thủ công.

Hiện trạng sau các slice sổ quỹ ngày `06/07/2026`:

- `/finance` là màn sổ quỹ chính; thân trang chỉ còn bảng sổ quỹ, inline detail dòng sổ và form phiếu thu/chi khi mở.
- Các khối `Tài khoản quỹ`, `Công nợ khách hàng`, `Phiếu thu/chi` đã ẩn khỏi thân trang để tránh rối layout.
- Header có ô `Tìm sổ quỹ` theo kiểu search chung; tìm bỏ dấu theo mã phiếu, người nộp/nhận, SĐT, ghi chú và mã/tên tài khoản quỹ. Nút `+` trong ô tìm mở popup tạo phiếu thu/chi khi ô rỗng; khi có nội dung thì chuyển thành `x` để xóa tìm kiếm. Nút `Xuất file` nằm cùng hàng và canh phải trước cụm tài khoản/giao diện của shell.
- Summary `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ` nằm trong khu vực chính bên phải, ngay trên bảng sổ quỹ, và lấy từ `summary` của API sổ quỹ theo filter.
- `Tồn quỹ` dùng `summary.ending_balance`, không dùng tổng số dư hiện tại của tất cả tài khoản.
- Bộ lọc sổ quỹ tự áp dụng khi chọn giá trị; không có nút `Lọc sổ` hoặc `Đặt lại bộ lọc`.
- Bảng dùng layout KiotViet-like nhưng màu sắc/border/spacing theo design system QCVL, không copy màu KiotViet: có checkbox chọn dòng, cột đánh dấu sao, mã phiếu dạng link, thời gian, người tạo, loại thu chi, số tài khoản, người nộp/nhận, giá trị và ghi chú. `Người tạo` lấy từ `source.source_creator_name` của file So Quy KV trước, fallback `created_by.name`; `Số tài khoản` chỉ hiện mã/số tài khoản ngân hàng, tiền mặt hiện `-`. Header sổ quỹ giữ đúng chữ thường/chữ hoa theo label nghiệp vụ như `Người nộp/nhận`, không ép uppercase toàn bộ. Cột người nộp/nhận lấy `counterparty` từ API list sổ quỹ; nếu có tên thì hiển thị dạng button mở inline detail cùng dòng, nếu chưa có thì hiển thị `-`; riêng khách mặc định `Khách lẻ` hiển thị trong bảng là `khách lẻ`, dùng typography thân bảng thay vì link xanh đậm để nhẹ nhãn, dữ liệu lưu và detail không đổi. Với dòng phiếu thu từ `payment_receipt_method` hoặc KV `kiotviet_cashbook` dạng `TTHD...` mà list chưa trả `counterparty` hoặc trả tên rỗng, frontend được phép hydrate nền từ detail hoặc hóa đơn liên kết `HD...` để điền người nộp trước khi người dùng click mở detail. Các ô text dài trong bảng, đặc biệt `Ghi chú`, phải dùng helper ellipsis chung để hiển thị một dòng kèm `...`, không làm cao dòng hoặc đẩy cột; detail/title vẫn giữ đủ nội dung từ DB. Click cả hàng mở detail; sao từng dòng lưu ưu tiên cục bộ và không làm bung detail; sao ở header lọc các dòng ưu tiên trong trang hiện tại.
- Tất cả button trong màn sổ quỹ phải ưu tiên CSS/component chung: `button button-primary`, `button button-secondary`, `management-compact-create-action`, `ManagementRowActionButton`, `ManagementDetailActionFooter`. Không tạo style riêng cho từng trang nếu chỉ khác text/icon; chỉ thêm class riêng tại nơi dùng khi nút có hành vi hoặc trạng thái thật sự đặc biệt.
- Surface bảng dùng viền/padding ngoài mỏng để bảng sát khung hơn; vẫn giữ border và hover theo design system.

MVP của QCVL hỗ trợ:

- tiền mặt
- tài khoản ngân hàng

Không dùng ví điện tử trong MVP nếu chưa có nghiệp vụ riêng.

---

## 2. Bố cục

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Sổ quỹ                                      [Tìm sổ quỹ +]                   [Xuất]│
├───────────────────────┬────────────────────────────────────────────────────────────┤
│ Thời gian             │ Quỹ đầu kỳ | Tổng thu | Tổng chi | Tồn quỹ                 │
│ Quỹ tiền              │ [ ] | ☆ | Mã phiếu | Thời gian | Loại thu chi | Người      │
│ Loại chứng từ         │     |   | Loại sổ quỹ | Giá trị                             │
│ Trạng thái            │ CTM001170 | ... | Chi phí khác | Tý | Tiền mặt | -50,000    │
│ Hạch toán KQKD        │ TTHD010973| ... | Thu tiền khách trả | KL2 | Ngân hàng      │
│                       │ Pagination                                                 │
└───────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 3. Bộ lọc MVP

| Bộ lọc | Giá trị |
|---|---|
| Quỹ tiền | Radio list chọn một theo thứ tự: `Tổng quỹ`, `Tiền mặt`, `Ngân hàng`. Mặc định chọn `Tổng quỹ`. `Ngân hàng` lọc tất cả dòng có loại sổ quỹ ngân hàng; khối `Tài khoản` bên dưới chỉ dùng để thu hẹp về một tài khoản cụ thể |
| Thời gian | Hôm nay, hôm qua, tuần này, tuần trước, 7 ngày qua, tháng này, tháng trước, 30 ngày qua, quý này, quý trước, năm nay, năm trước, toàn thời gian. Không còn radio `Tùy chỉnh`; hai ô từ ngày/đến ngày luôn hiển thị, có icon lịch. Popup lịch mở bên phải cột filter như menu chọn nhanh và không chồng popup khác. Preset đang chạy không hiển thị ngày kết thúc vượt quá hôm nay; `Toàn thời gian` hiển thị khoảng ngày có dữ liệu khi xác định được. |
| Loại chứng từ | Checkbox group: `Phiếu thu`, `Phiếu chi`; mặc định không tick nghĩa là xem cả hai |
| Loại thu chi | Chưa có trong UI hiện tại; thuộc slice sau |
| Trạng thái | Checkbox group: `Đã thanh toán` tick mặc định, `Đã hủy` không tick; tick cả hai hoặc không tick gì tương đương xem tất cả |
| Hạch toán KQKD | Segmented radio tabs: `Tất cả`, `Có`, `Không` |
| Người tạo | Chưa có trong UI hiện tại; thuộc slice sau |
| Người nộp/nhận | Chưa có trong filter UI hiện tại; detail hiển thị tên/SĐT dạng text thường, không hiển thị loại đối tượng |
| Công nợ đối tác | Có trong form phiếu thu/chi thủ công; filter list thuộc slice sau |

Ghi chú:

- Filter hiện tại tự gọi lại danh sách sổ quỹ khi đổi thời gian, quỹ tiền, loại chứng từ, trạng thái, hạch toán KQKD.
- `Trạng thái` trong bộ lọc là trạng thái phiếu thu/chi (`posted/cancelled`), khác với trạng thái thanh toán hóa đơn trong bảng chứng từ liên kết của detail.
- UI filter dùng hình thái giống KiotViet cho những phần đã đủ API: quỹ tiền là radio list, loại chứng từ/trạng thái là checkbox group, hạch toán KQKD là segmented tabs. Màu sắc vẫn theo design system QCVL.
- Khi chọn `Ngân hàng`, bảng lọc ngay theo `finance_account_type = bank` để thấy tất cả tài khoản ngân hàng. Frontend vẫn giữ guard theo `finance_account.account_type = bank` trước khi render/export để tránh API cũ hoặc response stale làm lẫn dòng `Tiền mặt`. Khối `Tài khoản` hiện nút `Thêm` ở góc phải tiêu đề và ô `Chọn tài khoản`; click ô này xổ dropdown danh sách tài khoản dạng 3 dòng: số tài khoản, ngân hàng/tên tài khoản, chủ tài khoản. Tài khoản import có mã `{DEL}` được đánh `inactive` và không hiện trong picker active. Mỗi dòng tài khoản có action hover `Sửa` và `Ghim`; khi đã ghim thì icon ghim luôn hiển thị cả khi không rê chuột. Tài khoản ghim được lưu cục bộ, đưa lên đầu danh sách và dùng làm mặc định cho mọi nơi cần chọn tài khoản ngân hàng như lọc sổ quỹ, tạo phiếu thu/chi chuyển khoản, thu nợ chuyển khoản. Chọn dòng mới lọc sổ quỹ theo `finance_account_id`.
- Import sổ quỹ KV dùng `Mã phiếu` làm khóa, nhưng nếu cùng một file có trùng mã gồm một dòng `Đã thanh toán` và một dòng `Đã hủy`, QCVL giữ dòng `Đã thanh toán` để tránh dòng audit hủy ghi đè phiếu thật. Với filter `Ngân hàng` chung không chọn tài khoản cụ thể, các dòng thuộc tài khoản `{DEL}` đã có tài khoản active thay thế được loại khỏi tổng thu/chi để không cộng lặp chuyển quỹ nội bộ; khi chọn đúng tài khoản `{DEL}` thì vẫn xem được lịch sử cũ.
- Quản lý đa tài khoản giai đoạn hiện tại là bản nhẹ ngay trong picker tài khoản: thêm, sửa local, ghim mặc định. Khi backend có endpoint quản lý tài khoản quỹ, nâng cấp thành màn quản lý riêng trong `Quản trị` hoặc tab con `Sổ quỹ > Tài khoản` để bật/tắt, xóa/ngừng dùng, đối soát và phân quyền.
- Popup `Thêm tài khoản ngân hàng` hiện là UI local trong frontend vì backend chưa có endpoint tạo tài khoản quỹ. Popup dùng shared modal compact, gồm số tài khoản, ngân hàng, chủ tài khoản, số dư ban đầu, ghi chú, checkbox bật thông báo và footer `Bỏ qua`/`Lưu`. Danh sách ngân hàng dùng snapshot local từ VietQR Banks API (`https://api.vietqr.io/v2/banks`), hiển thị dạng `Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam`; số tài khoản và chủ tài khoản vẫn lấy từ KV/import hoặc người dùng nhập.
- `Công nợ đối tác` cần dùng cho phiếu liên quan khách hàng/nhà cung cấp; hiện đã có trường khi tạo phiếu thủ công, chưa có filter list.
- `Người nộp/nhận` có thể vẫn hiển thị trong bảng/list khi API list trả `counterparty`; detail cũng hiển thị tên/SĐT nhưng không hiển thị `Đối tượng nộp/nhận`. Slice sau nếu cần filter/search theo tên, mã và số điện thoại thì xử lý ở bảng/filter.
- Ô `Tìm sổ quỹ` ở header là ô tìm mã phiếu/người nộp/nhận/ghi chú chính. Nếu backend cũ hoặc response stale trả rộng hơn query, frontend vẫn lọc lại danh sách đang hiển thị theo cùng quy tắc bỏ dấu để tránh thấy kết quả sai trong bảng/list chính.

---

## 4. Summary

| Card | Ý nghĩa |
|---|---|
| Quỹ đầu kỳ | Số dư đầu kỳ theo filter hiện tại |
| Tổng thu | Tổng dòng thu theo tài khoản/thời gian đang lọc |
| Tổng chi | Tổng dòng chi theo tài khoản/thời gian đang lọc |
| Tồn quỹ | `ending_balance` từ API theo filter hiện tại |

Nếu chọn `Tổng quỹ`, UI vẫn cần tách chi tiết theo từng tài khoản trong drilldown hoặc report phụ, không chỉ hiển thị một con số chung khi đối soát.

---

## 5. Bảng sổ quỹ

| Cột | Ghi chú |
|---|---|
| Mã phiếu | Link mở chi tiết phiếu |
| Thời gian | Ngày giờ ghi sổ |
| Loại thu chi | Tên loại thu/chi |
| Người nộp/nhận | Khách, nhân viên hoặc ghi chú |
| Loại sổ quỹ | Hiển thị loại quỹ như `Tiền mặt` hoặc `Ngân hàng` |
| Giá trị | Thu dương, chi âm |
| Hạch toán | Có/không tính vào báo cáo kinh doanh nếu cần |
| Trạng thái | Đã ghi sổ/đã hủy |

### Chọn cột

MVP nên cho cấu hình cột tương tự KV, nhưng có thể làm theo mức ưu tiên:

1. Cột mặc định hiện tại: checkbox chọn dòng, đánh dấu sao, mã phiếu, thời gian, người tạo, loại thu chi, số tài khoản, người nộp/nhận dạng link detail khi có dữ liệu, giá trị, ghi chú.
2. Cột mở rộng: thời gian tạo, người tạo, nhân viên, mã người nộp/nhận, số điện thoại, địa chỉ, nội dung chuyển khoản, ghi chú, loại sổ quỹ, hạch toán KQKD.
3. Không hiển thị cột chi nhánh trong MVP.

Hiện trạng UI: chưa có nút `Cột`; cột mặc định cố định để tránh làm rối giai đoạn layout.

### Xuất file

Xuất file tối thiểu phải có các cột giống file KV mẫu:

- mã phiếu
- thời gian
- loại thu chi
- người nộp/nhận
- giá trị

Sau đó thêm các cột QCVL cần đối soát: quỹ/tài khoản, trạng thái, ghi chú, người tạo, hạch toán KQKD.

Hiện trạng UI: nút `Xuất file` nằm ở cụm tác vụ sổ quỹ bên phải; nút `+` trong ô `Tìm sổ quỹ` mở popup tạo phiếu thu/chi khi ô rỗng, còn khi đang nhập thì nút xoay thành `x` để xóa tìm kiếm.

---

## 6. Phiếu thu/chi thủ công

Hiện trạng UI sau ngày `06/07/2026`, cộng quyết định chuẩn hóa planned ngày `21/07/2026`:

- Nút `+` trong ô `Tìm sổ quỹ` mở popup modal ở giữa màn hình, có backdrop mờ, không chuyển trang và không đẩy layout sổ quỹ. Popup mở mặc định tab `Phiếu thu`; người dùng chuyển tab `Phiếu chi` ngay trong popup để đổi loại phiếu.
- Modal dùng CSS chung `management-modal-*`, không tạo layout riêng cho từng trang. Kích thước khoảng 800-900px, thân form dùng grid 2 cột.
- Header planned chỉ hiển thị `Tạo phiếu thu` hoặc `Tạo phiếu chi`; không đưa `tiền mặt`/`ngân hàng` vào tiêu đề. `Tiền mặt`/`Chuyển khoản` nằm ở trường `Phương thức TT`; chọn `Chuyển khoản` mới hiện tài khoản ngân hàng. Bên dưới header có tab `Phiếu thu`/`Phiếu chi`; bên phải có nút đóng `X`. Tab dùng CSS chung `inline-detail-tabbar`/`inline-detail-tabs` cho trạng thái chọn và không chọn, không tạo style riêng cho finance.
- Footer modal có 3 nút cùng hàng, canh phải: `Bỏ qua`, `Lưu & In`, `Lưu`. Hiện `Lưu & In` dùng chung luồng lưu; in thật là slice sau.
- Các field mã phiếu, thời gian, người thu/chi, phương thức thanh toán hiện mới phục vụ UI/đối soát nhanh; backend tạo mã và thời gian ghi thật khi lưu. Planned: `Người thu`/`Người chi` lấy từ tài khoản đăng nhập, không nhập tay.

### Tạo phiếu thu

Form tối thiểu:

- mã phiếu tự động từ backend
- thời gian hiển thị theo giờ hiện tại
- loại thu
- người thu là tài khoản đăng nhập
- phương thức TT: tiền mặt hoặc chuyển khoản
- tài khoản nhận tiền: chỉ hiện/bắt buộc khi chọn chuyển khoản
- đối tượng nộp: khách hàng, nhà cung cấp, nhân viên, đối tác giao hàng, khác; danh sách khả dụng phụ thuộc loại thu
- tên/mã người nộp: với `Khác` là ô nhập tự do; với nhóm còn lại là combobox chọn/tạo nhanh bản ghi
- số điện thoại nếu có
- số tiền
- lý do/ghi chú
- hạch toán kết quả kinh doanh
- công nợ đối tác tạm dùng default backend hiện tại, chưa đưa ra UI modal

### Tạo phiếu chi

Form tối thiểu:

- mã phiếu tự động từ backend
- thời gian hiển thị theo giờ hiện tại
- loại chi
- người chi là tài khoản đăng nhập
- phương thức TT: tiền mặt hoặc chuyển khoản
- tài khoản chi tiền: chỉ hiện/bắt buộc khi chọn chuyển khoản
- đối tượng nhận: khách hàng, nhà cung cấp, nhân viên, đối tác giao hàng, khác; danh sách khả dụng phụ thuộc loại chi
- tên/mã người nhận: với `Khác` là ô nhập tự do; với nhóm còn lại là combobox chọn/tạo nhanh bản ghi
- số điện thoại nếu có
- số tiền
- lý do/ghi chú
- hạch toán kết quả kinh doanh
- công nợ đối tác tạm dùng default backend hiện tại, chưa đưa ra UI modal

### Mapping đối tượng planned

Theo tham chiếu KiotViet, QCVL chọn loại thu/chi trước, rồi mới chọn nhóm người nộp/nhận phù hợp. Bảng dưới là mapping contract hiện hành.

| Loại thu/chi | Nhóm đối tượng chính |
|---|---|
| Thu tiền khách, hoàn tiền khách | Khách hàng, khác |
| Tiền trả NCC, vật tư | Nhà cung cấp, khác |
| Lương NV, hoa hồng | Nhân viên, khác |
| Vận chuyển | Đối tác giao hàng, khác |
| Thu khác, chi khác | Khách hàng, nhà cung cấp, nhân viên, đối tác giao hàng, khác |
| Chuyển/Rút, thuế/VAT | Khác |

### Thêm và quản lý đối tượng planned

- `Khách hàng`: chọn từ danh sách khách hàng; nếu cần thêm mới thì mở tạo nhanh khách hàng và lưu về master khách hàng.
- `Nhà cung cấp`: chọn từ danh sách NCC; nếu cần thêm mới thì mở tạo nhanh NCC và lưu về master NCC.
- `Nhân viên`: chọn từ danh sách nhân viên riêng (`employees`) hoặc bấm `Tạo mới`; không trộn với tài khoản đăng nhập.
- `Đối tác giao hàng`: chọn từ gợi ý đã lưu hoặc bấm `Tạo mới`; tên mới được lưu vào `delivery_partners` trước khi lưu phiếu.
- `Khác`: nhập text trực tiếp, không hiện nút tạo mới và không đưa vào danh sách gợi ý.

Phiếu luôn snapshot tên/số điện thoại người nộp/nhận để lịch sử phiếu không đổi khi master data đổi sau này.

### Sửa phiếu

- Chỉ phiếu thủ công có nút sửa.
- Sửa phiếu tạo phiên bản mới `MaCu.01`.
- Phiếu cũ chuyển trạng thái đã hủy nhưng vẫn xem được.
- Hiện trạng UI chính không hiển thị bảng phiếu thu/chi phụ; sửa/hủy phiếu thủ công giữ ở luồng voucher và detail/future surface, không nằm trên bảng phụ trong thân trang.

### Thao tác phiếu planned

| Thao tác | QCVL planned | Ghi chú theo KiotViet |
|---|---|---|
| Tạo phiếu thu/chi | Từ nút `+` hoặc action `Phiếu thu`/`Phiếu chi`; mở modal tạo phiếu. | KiotViet có tạo phiếu thu/chi từ Sổ quỹ và mobile. |
| Bỏ qua | Đóng modal nếu chưa có thay đổi; nếu có thay đổi thì hỏi xác nhận. | Tránh mất dữ liệu đang nhập. |
| Lưu | Validate, tạo phiếu `posted`, tạo dòng sổ quỹ, đóng modal, cập nhật list/detail. | Dùng toast nhỏ góc phải. |
| Lưu & In | Lưu thành công rồi mở/in phiếu vừa tạo. | Nếu in lỗi, phiếu vẫn đã lưu; báo lỗi in riêng. |
| Xem | Click dòng mở inline detail. | Detail dùng shell chung. |
| Sửa/Cập nhật | Chỉ phiếu thủ công còn hiệu lực; mở form prefill dữ liệu cũ; lưu tạo bản mới `MaCu.01`. | QCVL không sửa đè như KV để giữ audit. |
| Xóa/Hủy | Nút UI ghi `Xóa` hoặc `Hủy`; thực chất gọi hủy mềm, chuyển `cancelled`, không xóa vật lý. | Với chuyển/rút đủ luồng, hủy một bên phải hủy cả cặp đối ứng. |
| In | In phiếu từ detail hoặc sau `Lưu & In`. | Dùng dữ liệu detail/voucher hiện hành. |
| Chia sẻ | Chưa làm MVP; để slice sau nếu Owner cần gửi phiếu qua Zalo/email/file. | KiotViet có chia sẻ trên mobile. |
| Tìm/lọc/sắp xếp/xuất file | Áp dụng trên toàn bộ kết quả theo filter, không chỉ page hiện tại. | KiotViet hỗ trợ tìm/lọc/sắp xếp/xuất file. |

### Quyền sửa theo nguồn phiếu planned

| Nguồn phiếu | Được sửa | Được hủy/xóa |
|---|---|---|
| Phiếu thủ công thường | Thời gian, loại thu/chi, phương thức TT/tài khoản, đối tượng, số tiền, ghi chú, hạch toán. | Có, hủy mềm nếu còn `posted`. |
| Phiếu chuyển/rút | Thời gian, số tiền, ghi chú, hạch toán; nếu đổi tài khoản nguồn/đích phải dùng luồng chuyển quỹ riêng. | Có, hủy cả cặp đối ứng trong cùng transaction khi đã có luồng chuyển quỹ đủ. |
| Phiếu tự động từ POS/thu nợ/hóa đơn/nhập hàng | Không sửa rời giá trị hoặc đối tượng để tránh lệch chứng từ gốc; chỉ xem ở sổ quỹ. | Không hủy rời; xử lý qua nghiệp vụ gốc. |
| Phiếu import KiotViet | Chỉ xem/đối soát; không sửa như phiếu QCVL. | Chỉ xóa qua luồng delete import có scope rõ, không dùng nút xóa phiếu thường. |

---

## 7. Phiếu sinh từ POS/thu nợ

Các phiếu sinh từ checkout POS hoặc thu nợ khách:

- hiển thị trong sổ quỹ
- mở xem chi tiết được
- không có nút sửa rời
- nếu cần sửa phải đi qua nghiệp vụ gốc
- chi tiết phiếu phải hiển thị chứng từ gốc và các hóa đơn được phân bổ nếu có

---

## 8. Acceptance Criteria UX

1. Người dùng lọc được sổ quỹ theo tiền mặt hoặc từng tài khoản ngân hàng.
2. Thu/chi hiển thị khác màu và dễ phân biệt.
3. Tạo phiếu thu/chi thủ công không đi qua duyệt nhiều bước trong MVP.
4. Phiếu thủ công sửa theo bản mới, không sửa đè.
5. Phiếu từ POS/thu nợ không có nút sửa rời.
6. `Tồn quỹ` trong summary phải đổi theo filter sổ quỹ, không cố định theo tổng số dư tài khoản hiện tại.
7. Bộ lọc đang có phải tự áp dụng khi đổi giá trị, không cần nút áp dụng/reset.
8. `Lưu` tạo phiếu và cập nhật bảng/detail ngay; `Lưu & In` lưu trước rồi in.
9. `Xóa` phiếu thủ công là hủy mềm, không xóa vật lý.
10. Sắp xếp/xuất file dùng toàn bộ kết quả theo filter, không chỉ page hiện tại.

---

← [Quay về Finance README](./README.md)
