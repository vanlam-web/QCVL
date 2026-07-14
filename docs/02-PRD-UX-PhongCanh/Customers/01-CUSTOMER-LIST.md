# 01-CUSTOMER-LIST — Danh sách khách hàng

> **Mốc chốt:** V1 đủ test theo chốt Owner ngày `2026-07-03`; chức năng nâng cao nằm ngoài phạm vi hiện tại.
> **Tham khảo:** KiotViet `Khách hàng > Khách hàng`

---

## 1. Mục tiêu

Trang danh sách khách hàng giúp tìm, tạo, sửa nhanh và kiểm tra các chỉ số chính của từng khách.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Khách hàng                                [Tìm mã, tên, SĐT... +]           │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc <             │ Bảng khách hàng                                       │
│ - Nhóm khách         │                                                       │
│ - Ngày tạo           │ Bảng khách hàng                                       │
│ - Trạng thái         │                                                       │
│ - Công nợ            │                                                       │
│ - Tổng bán           │                                                       │
│                      │ Footer: tổng khách / phân trang                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

Trang khách hàng dùng cùng management layout với Chứng từ:

- search/action nằm trên bảng qua `ManagementCompactToolbar` / `ManagementCompactSearch`
- bộ lọc nằm ở cột trái `ManagementFilterSidebar`
- cột lọc có nút `<` để ẩn và rail `>` để mở lại
- thân bảng nằm trong `ManagementTableViewport`
- tổng số khách/phân trang nằm ở footer `ManagementPagination`, không đặt tổng ở đầu bảng
- mặc định hiển thị `15` kết quả mỗi trang
- footer phải hiển thị tổng số kết quả, tổng số trang, `Trang Z / Y`, và nút `Trước` / `Sau` theo layout chung; nếu chỉ có một trang thì nút vẫn hiện nhưng disabled
- wording footer chuẩn: `Tổng X kết quả • Y trang`, kèm `Trang Z / Y`; không lặp thêm câu `Đang ở trang Z`
- không viết layout/filter/footer riêng cho khách hàng nếu primitive `management-*` đã đáp ứng

---

## 3. Bộ lọc

V1 hiện tại:

| Bộ lọc | Quy tắc |
|---|---|
| Tìm kiếm nhanh | Tìm theo mã khách, tên khách, SĐT nếu có |
| Trạng thái | V1 chỉ hiển thị `Đang hoạt động` |

Ô tìm khách hàng dùng shared compact search và lọc trực tiếp danh sách:

- dùng chung `ManagementCompactSearch`
- gọi API `/api/v1/customers` với `search` theo mã khách, tên khách, SĐT và các bộ lọc đang chọn
- nội dung tìm kiếm bỏ dấu tiếng Việt: gõ `khach le` vẫn tìm ra `Khách lẻ`
- không hiển thị dropdown/listbox gợi ý dưới ô tìm
- nhập tới đâu lọc danh sách chính tới đó; nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung
- bấm Enter chạy lại bộ lọc hiện tại theo nội dung đang nhập
- không có kết quả thì hiện `Không có kết quả phù hợp`

Ngoài phạm vi V1:

| Bộ lọc | Quy tắc |
|---|---|
| Nhóm khách | Tất cả hoặc một nhóm khách cụ thể |
| Ngày tạo | Toàn thời gian, tháng này, hôm nay, tùy chỉnh |
| Công nợ | Tất cả, còn nợ, không nợ; có thể lọc khoảng tiền |
| Tổng bán | Lọc khoảng tổng doanh thu |

Tham khảo KiotViet có thêm loại khách, giới tính, sinh nhật, người tạo, giao dịch cuối, khu vực giao hàng và loại đối tác.

Export KiotViet ngày `2026-07-01` có `528` khách hàng:

- `503` khách không có SĐT
- `25` khách có SĐT và không thấy SĐT trùng trong export
- `367` khách không gán nhóm khách
- các nhóm khách đang dùng là `25`, `26`, `30`, `35`, `40`
- `78` khách có nợ hiện tại, tổng nợ khoảng `225,781,565`

Các số này củng cố quyết định: SĐT không bắt buộc; nếu có thì dùng để tìm/phân biệt nhưng không làm khóa import chính. Nhóm khách chỉ quyết định bảng giá khi đã có cấu hình map bảng giá riêng; khách không nhóm hoặc nhóm chưa map dùng bảng giá chung.

Export KiotViet ngày `2026-07-11` file `DanhSachKhachHang_KV11072026-234256-524.xlsx` có `531` khách hàng:

- `506` khách không có SĐT, `25` khách có SĐT.
- `10` tên khách bị trùng, nên QCVL cho phép trùng tên và dùng `Mã khách hàng` làm khóa import/update.
- `370` khách không gán nhóm; các nhóm có dữ liệu là `25`, `26`, `30`, `35`, `40`.
- `83` khách có `Nợ cần thu hiện tại`; số nợ/tổng bán trong file chỉ là tham chiếu KiotViet, không phải công nợ chính của QCVL.
- `Loại khách` và `Công ty` được giữ để sau này phân biệt khách cá nhân/công ty và hỗ trợ in/xuất thông tin theo công ty nếu cần.

Import khách hàng KiotViet:

| Cột KiotViet | Cách dùng trong QCVL |
|---|---|
| `Mã khách hàng` | Bắt buộc, khóa upsert |
| `Tên khách hàng` | Bắt buộc, được trùng |
| `Loại khách` | Lưu cá nhân/công ty |
| `Công ty` | Lưu riêng để nhiều khách có thể cùng công ty |
| `Điện thoại` | Tùy chọn, dùng tìm kiếm/phân biệt |
| `Mã số thuế` | Tùy chọn, dùng hồ sơ/in thông tin sau này |
| `Địa chỉ` | Địa chỉ hồ sơ một dòng |
| `Phường/Xã`, `Khu vực giao hàng` | Chỉ bổ sung địa chỉ hồ sơ và lưu raw; không mở nghiệp vụ giao hàng |
| `Nhóm khách` | Tạo/map nhóm khách |
| `Ghi chú` | Lưu ghi chú hồ sơ |
| `Người tạo` | Lưu raw; map tài khoản QCVL theo `username` trước, nếu file KV là tên người thì map theo tên hiển thị QCVL khi khớp duy nhất |
| `Ngày tạo` | Lưu ngày tạo nguồn |
| `Ngày giao dịch cuối` | Lưu tham chiếu |
| `Trạng thái` | Map active/inactive |
| `Nợ cần thu hiện tại`, `Tổng bán`, `Tổng bán trừ trả hàng` | Lưu tham chiếu KV, không tính công nợ chính |

Cột bỏ qua trong lát hiện tại: `Chi nhánh tạo`, `Số CMND/CCCD`, `Ngày sinh`, `Giới tính`, `Email`, `Facebook`.

Quyết định Owner ngày `2026-07-03`:

- `khachle - Khách lẻ` là khách mặc định của tổ chức. Khi POS/báo giá/hóa đơn không chọn khách, backend vẫn gán chứng từ vào khách có mã `khachle` để lịch sử, công nợ và báo cáo không bị rơi vào bucket `customer_id = null`.
- Cho phép trùng tên khách giống KiotViet. `Mã khách hàng` là khóa duy nhất để nhận diện/import/update; khi cần phân biệt khách trùng tên, dùng mã khách, SĐT, công ty, MST và lịch sử giao dịch.
- SĐT không bắt buộc. Nếu có, dùng để tìm và phân biệt khách; import không chặn dữ liệu vì KiotViet có thể có nhiều hồ sơ cần giữ nguyên.
- Hồ sơ khách MVP có trường `MST` để phục vụ khách công ty/tổ chức.
- Các trường bổ sung khác của KiotViet nằm ngoài MVP nếu chưa phục vụ bán hàng, áp giá hoặc công nợ.
- Nếu khách không có nhóm khách, hệ thống áp dụng `Bảng giá chung`.
- Chi tiết khách tham khảo KiotViet nhưng chỉ giữ phần cần vận hành: thông tin chính, bảng giá áp dụng, lịch sử bán nếu có API đúng, và nợ cần thu.

QC-OMS MVP lược bỏ:

- giới tính, sinh nhật
- điểm thưởng/thẻ thành viên
- địa chỉ giao hàng vì MVP chưa có module giao hàng
- Facebook/email trên danh sách chính
- CCCD/CMND, hộ chiếu, tài khoản ngân hàng
- địa chỉ nhận hàng nhiều trường vì MVP chưa có module giao hàng

`MST`, `Công ty` và `Địa chỉ` không cần là cột mặc định trên danh sách chính nếu làm chật bảng, nhưng phải có trong dữ liệu hồ sơ/chi tiết khách. `Địa chỉ` trong MVP là một dòng text để lưu hồ sơ khách. Import KiotViet được phép dùng `Phường/Xã` và `Khu vực giao hàng` để bổ sung địa chỉ khi địa chỉ trống hoặc thiếu phần rõ ràng, nhưng không mở nghiệp vụ địa chỉ giao hàng.

---

## 4. Cột bảng

V1 hiện tại hiển thị các cột phục vụ bán hàng, áp giá và thu nợ nhanh:

| Cột | Mô tả |
|---|---|
| Checkbox | Dùng pattern checkbox chung; hiện chọn dòng/chọn tất cả, thao tác hàng loạt để sau |
| Mã khách hàng | Bắt buộc, unique; bấm để mở chi tiết |
| Tên khách hàng | Bắt buộc |
| SĐT | Có thể trống; chuẩn hóa để tìm/phân biệt khách, import không chặn trùng nếu nguồn KV cần giữ |
| Nhóm khách | Dùng phân nhóm khách; chỉ quyết định bảng giá khi có cấu hình map bảng giá riêng |
| Công nợ | Tổng còn nợ hiện tại theo hóa đơn; tải tự động cho khách đang hiển thị trên trang hiện tại |
| Tổng bán | Tổng tiền hóa đơn hoàn tất của khách; không tính báo giá hoặc chứng từ đã hủy |

Ngoài phạm vi V1:

| Cột | Mô tả |
|---|---|
| Bảng giá áp dụng | Bảng giá nhóm hoặc Bảng giá chung |
| Ngày giao dịch cuối | Lần bán gần nhất |
| Trạng thái | Không hiển thị ở bảng ngoài trong lát hiện tại; giữ cho bộ lọc/chi tiết khi cần nghiệp vụ trạng thái |
| Ghi chú | Ghi chú nội bộ |

Phần tổng phía trên danh sách hiển thị:

- tổng số khách theo bộ lọc
- tổng nợ hiện tại
- tổng bán
- tổng bán trừ trả hàng

Trong MVP chưa có nghiệp vụ trả hàng bán, nên `Tổng bán trừ trả hàng` có thể bằng `Tổng bán` hoặc ẩn nhãn này để tránh gây hiểu nhầm.

Lát hiện tại hiển thị `Công nợ` và `Tổng bán` ở bảng ngoài để Owner kiểm tra nhanh công nợ/doanh số. `Tổng bán trừ trả hàng` nằm ngoài phạm vi hiện tại cho tới khi có nghiệp vụ trả hàng bán; không dựng số giả.

---

## 5. Thao tác

| Thao tác | Hành vi |
|---|---|
| Thêm khách hàng | Bấm dấu `+` trong ô tìm kiếm để mở modal tạo khách hàng |
| Mở chi tiết | Bấm nguyên dòng khách để mở ô chi tiết |
| Đổi trạng thái | Ngừng hoạt động khách không còn xuất hiện trong tìm kiếm POS mặc định |
| Xuất file | Xuất danh sách đang lọc để đối chiếu |

Khi tạo khách:

- Tên khách hàng bắt buộc.
- Mã khách hàng là ô nhập được; nếu người dùng để trống thì hệ thống tự sinh theo quy tắc `KH000001`, `KH000002`, ...
- SĐT không bắt buộc.
- MST không bắt buộc.
- Địa chỉ không bắt buộc, chỉ nhập một dòng text.
- Tên khách được phép trùng khách khác trong cùng tổ chức; `Mã khách hàng` mới là khóa chuẩn.
- Nếu có SĐT, hệ thống chuẩn hóa để tìm kiếm và phân biệt khách; không dùng SĐT làm khóa import chính.
- Nếu có nhóm khách và nhóm đó đã được cấu hình bảng giá riêng thì lần bán sau dùng bảng giá của nhóm; nếu chưa có cấu hình thì dùng bảng giá chung. Không tự sinh bảng giá mới chỉ vì tên nhóm là `35`, `40`, ...
- Modal tạo khách chỉ giữ các trường cần nhập nhanh: tên khách, mã khách, SĐT, MST, địa chỉ một dòng. Import KiotViet lưu thêm `Loại khách`, `Công ty`, `Nhóm khách`, `Ghi chú`, `Phường/Xã`, `Khu vực giao hàng`, ngày tạo, giao dịch cuối và số liệu tham chiếu KV; không đưa các trường phụ như giới tính, sinh nhật, Facebook, email, CCCD/CMND, hộ chiếu, ngân hàng vào UI tạo nhanh.

Tìm theo mã khách chính xác phải mở được khách dù bộ lọc ngày tạo/trạng thái hiện tại đang che kết quả. Nếu khách bị ngừng hoạt động, UI hiển thị rõ trạng thái thay vì báo không tìm thấy.

---

## 6. Empty state

Khi không tìm thấy khách:

- Hiển thị `Không tìm thấy khách hàng phù hợp`.
- Có nút bỏ lọc nhanh.
- Có nút tạo khách hàng mới.

---

## 7. Import Cleanup

Import khách hàng KiotViet dùng chung quy tắc cleanup với Hàng hóa và Kiểm kho:

- Trong dialog `Import KV` phải có nút riêng `Xóa dữ liệu cũ`.
- Nút này gọi `DELETE /api/v1/customers/import/kiotviet`.
- Không đặt cleanup thành checkbox trong luồng `Xem trước` hoặc `Import`.
- Chỉ xóa dữ liệu khách hàng được tạo từ import KiotViet của trang Khách hàng; không xóa khách tạo tay.
- Nếu khách đã có tham chiếu nghiệp vụ thật như hóa đơn, công nợ hoặc lịch sử bán hàng, backend phải trả `blocked_rows` và không xóa dòng đó.
- Import lại cùng `Mã khách hàng` vẫn là upsert; nút cleanup chỉ dùng khi muốn xóa dữ liệu import cũ trước khi nạp lại file KV từ đầu.

---

## 8. Shared Page Template

Trang Khách hàng là template để áp dụng tiếp cho các trang quản trị khác, trừ POS:

- Dùng `ManagementPage` cho khung trang.
- Dùng `ManagementCompactToolbar` và `ManagementCompactSearch` cho ô tìm kiếm trên header.
- Dấu `+` nằm trong ô tìm kiếm; khi ô có nội dung thì chuyển thành nút `Xóa tìm kiếm`.
- Không dùng lại dropdown/listbox gợi ý bên dưới ô tìm.
- Dùng `ManagementFilterSidebar` cho bộ lọc trái.
- Dùng `ManagementTableViewport` cho bảng.
- Dùng `ManagementDataTable` cho header, row, selected row và detail row. Từng trang chỉ truyền cấu hình cột/cell/detail riêng.
- Bấm nguyên dòng để mở ô chi tiết; không chỉ bấm riêng mã.
- Dùng `ManagementDetailActionFooter` cho cụm nút chức năng trong chi tiết.
- Mỗi trang chỉ đổi: API load, cột bảng, field bộ lọc, field ô chi tiết, action bật/tắt.
- Field bộ lọc Khách hàng dùng helper chung: `ManagementFilterSelectField`, `ManagementDateRangeInputs`, `ManagementFilterNumberRange`.
- Không tạo CSS riêng từng trang nếu class `management-*` hiện có đã xử lý được.
