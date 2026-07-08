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
│ - Nợ hiện tại        │                                                       │
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

Ngoài phạm vi V1:

| Bộ lọc | Quy tắc |
|---|---|
| Nhóm khách | Tất cả hoặc một nhóm khách cụ thể |
| Ngày tạo | Toàn thời gian, tháng này, hôm nay, tùy chỉnh |
| Nợ hiện tại | Tất cả, còn nợ, không nợ; có thể lọc khoảng tiền |
| Tổng bán | Lọc khoảng tổng doanh thu |

Tham khảo KiotViet có thêm loại khách, giới tính, sinh nhật, người tạo, giao dịch cuối, khu vực giao hàng và loại đối tác.

Export KiotViet ngày `2026-07-01` có `528` khách hàng:

- `503` khách không có SĐT
- `25` khách có SĐT và không thấy SĐT trùng trong export
- `367` khách không gán nhóm khách
- các nhóm khách đang dùng là `25`, `26`, `30`, `35`, `40`
- `78` khách có nợ hiện tại, tổng nợ khoảng `225,781,565`

Các số này củng cố quyết định: SĐT không bắt buộc, nếu có thì unique; nhóm khách quyết định bảng giá; khách không nhóm dùng bảng giá chung.

Quyết định Owner ngày `2026-07-03`:

- `KH000001 - Khách lẻ` là khách mặc định của tổ chức. Khi POS/báo giá/hóa đơn không chọn khách, backend vẫn gán chứng từ vào `KH000001` để lịch sử, công nợ và báo cáo không bị rơi vào bucket `customer_id = null`.
- Không cho trùng tên khách trong cùng tổ chức sau khi chuẩn hóa: trim, gộp khoảng trắng lặp, so sánh không phân biệt hoa/thường.
- Không cho trùng SĐT đã chuẩn hóa trong cùng tổ chức. SĐT trống vẫn được phép cho nhiều khách nếu tên khác nhau.
- Hồ sơ khách MVP có trường `MST` để phục vụ khách công ty/tổ chức.
- Các trường bổ sung khác của KiotViet nằm ngoài MVP nếu chưa phục vụ bán hàng, áp giá hoặc công nợ.
- Nếu khách không có nhóm khách, hệ thống áp dụng `Bảng giá chung`.
- Chi tiết khách tham khảo KiotViet nhưng chỉ giữ phần cần vận hành: thông tin chính, bảng giá áp dụng, lịch sử bán nếu có API đúng, và nợ cần thu.

QC-OMS MVP lược bỏ:

- giới tính, sinh nhật
- điểm thưởng/thẻ thành viên
- khu vực giao hàng vì MVP chưa có module giao hàng
- Facebook/email/company trên danh sách chính
- CCCD/CMND, hộ chiếu, tài khoản ngân hàng
- địa chỉ nhận hàng nhiều trường vì MVP chưa có module giao hàng

`MST` và `Địa chỉ` không cần là cột mặc định trên danh sách chính nếu làm chật bảng, nhưng phải có trong form tạo/sửa và chi tiết khách. `Địa chỉ` trong MVP là một dòng text tự nhập để lưu hồ sơ khách, không tách khu vực/phường/xã và chưa phải luồng giao hàng.

---

## 4. Cột bảng

V1 hiện tại hiển thị các cột phục vụ bán hàng, áp giá và thu nợ nhanh:

| Cột | Mô tả |
|---|---|
| Mã khách hàng | Bắt buộc, unique; bấm để mở chi tiết |
| Tên khách hàng | Bắt buộc |
| SĐT | Có thể trống; nếu có thì unique |
| Nhóm khách hàng | Quyết định bảng giá mặc định |
| Nợ hiện tại | Tổng còn nợ hiện tại theo hóa đơn; tải tự động cho khách đang hiển thị trên trang hiện tại |
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

Lát hiện tại hiển thị `Nợ hiện tại` và `Tổng bán` ở bảng ngoài để Owner kiểm tra nhanh công nợ/doanh số. `Tổng bán trừ trả hàng` nằm ngoài phạm vi hiện tại cho tới khi có nghiệp vụ trả hàng bán; không dựng số giả.

---

## 5. Thao tác

| Thao tác | Hành vi |
|---|---|
| Thêm khách hàng | Bấm dấu `+` trong ô tìm kiếm để mở modal tạo khách hàng |
| Mở chi tiết | Bấm mã/tên khách để mở trang chi tiết |
| Đổi trạng thái | Ngừng hoạt động khách không còn xuất hiện trong tìm kiếm POS mặc định |
| Xuất file | Xuất danh sách đang lọc để đối chiếu |

Khi tạo khách:

- Tên khách hàng bắt buộc.
- Mã khách hàng là ô nhập được; nếu người dùng để trống thì hệ thống tự sinh theo quy tắc `KH000001`, `KH000002`, ...
- SĐT không bắt buộc.
- MST không bắt buộc.
- Địa chỉ không bắt buộc, chỉ nhập một dòng text.
- Tên khách không được trùng khách khác trong cùng tổ chức sau chuẩn hóa khoảng trắng/hoa thường; `Khách lẻ` cũng được bảo vệ bởi rule này.
- Nếu có SĐT, hệ thống chuẩn hóa và kiểm tra không trùng.
- Nếu có nhóm khách, lần bán sau dùng bảng giá của nhóm khách; nếu không có nhóm thì dùng bảng giá chung.
- Modal tạo khách chỉ giữ các trường cần nhập nhanh: tên khách, mã khách, SĐT, MST, địa chỉ một dòng. Không đưa các trường KiotViet phụ như giới tính, sinh nhật, Facebook, email, CCCD/CMND, hộ chiếu, ngân hàng, khu vực/phường/xã.

Tìm theo mã khách chính xác phải mở được khách dù bộ lọc ngày tạo/trạng thái hiện tại đang che kết quả. Nếu khách bị ngừng hoạt động, UI hiển thị rõ trạng thái thay vì báo không tìm thấy.

---

## 6. Empty state

Khi không tìm thấy khách:

- Hiển thị `Không tìm thấy khách hàng phù hợp`.
- Có nút bỏ lọc nhanh.
- Có nút tạo khách hàng mới.
