# 01-SALES-DOCUMENT-LIST — Danh sách chứng từ bán hàng

> **Phase hiện tại:** Đã có readonly list/detail cho `HD...` và `BG...`; báo giá active mở lại được vào POS draft
> **Tham khảo:** KiotViet `Đơn hàng > Hóa đơn`; không dùng mô hình `Đặt hàng/Giao hàng`

---

## 0. Ghi nhận từ KiotViet

Quan sát ngày `01/07/2026`:

- Màn `Hóa đơn` mặc định lọc `Tháng này` có thể không hiện kết quả dù Dashboard có hoạt động bán gần đây.
- Tìm trực tiếp mã `HD010985` mở được hóa đơn ngày `30/06/2026 17:08`.
- Khi tìm theo mã, KiotViet tự đưa thời gian về `Toàn thời gian` và bỏ chọn các filter trạng thái/loại hóa đơn.
- Danh sách có dòng tổng phía trên và các cột chính: mã hóa đơn, thời gian, mã trả hàng, mã khách hàng, khách hàng, tổng tiền hàng, giảm giá, tổng sau giảm giá, khách đã trả.

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
- ô tìm `Mã chứng từ, khách hàng, ghi chú` có gợi ý xổ xuống khi nhập; search bỏ dấu tiếng Việt, tìm theo mã chứng từ, mã/tên khách và ghi chú chứng từ
- gợi ý tối đa 8 dòng, hiển thị mã chứng từ + tên khách, dòng phụ là mã khách/ghi chú, mép phải là tổng tiền; bấm gợi ý lọc danh sách theo đúng mã chứng từ
- bộ lọc thời gian dạng chọn nhanh/tùy chỉnh theo layout filter dùng chung
- bộ lọc trạng thái thanh toán, phương thức thanh toán, người bán/người tạo và bảng giá nếu dữ liệu/API hiện có hỗ trợ
- exact document-code lookup không bị che bởi filter mặc định
- bấm dòng chứng từ để mở chi tiết readonly inline
- mở lại báo giá active vào POS draft local
- giữ giá snapshot của báo giá khi mở lại; cảnh báo nếu giá hiện tại khác hoặc sản phẩm không còn khả dụng

Ngoài phạm vi hiện tại:

- in lại bill hóa đơn nếu Bill Preview/print flow chưa có
- sửa hóa đơn
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
| Thời gian | Mặc định tháng này; có bộ lọc hôm nay, hôm qua, tháng này, tùy chỉnh |
| Loại chứng từ | Tất cả, Báo giá, Hóa đơn |
| Trạng thái chứng từ | Báo giá, Hoàn thành, Đã hủy |
| Trạng thái thanh toán | Tất cả, Đã trả đủ, Còn nợ, Không thu tiền nếu có dữ liệu |
| Phương thức thanh toán | Tất cả, Tiền mặt, Chuyển khoản, Kết hợp nếu có dữ liệu |
| Khách hàng | Chọn khách hoặc nhập nhanh tên/mã/SĐT |
| Người bán/người tạo | Trong QC-OMS hiện tại hai khái niệm này dùng cùng tài khoản tạo/chốt chứng từ; UI chỉ cần một filter người bán/người tạo |
| Bảng giá | Bảng giá chung hoặc bảng giá theo nhóm khách |

Không có bộ lọc giao hàng, COD, đối tác giao hàng, kênh bán, HĐĐT, VAT, trạng thái giao hàng, trạng thái vận đơn hoặc trạng thái đồng bộ sàn.

Khi người dùng tìm đúng mã chứng từ, hệ thống phải tìm trên toàn bộ lịch sử hoặc tự bỏ các filter thời gian/trạng thái đang che kết quả.

Nếu filter tồn tại ở KiotViet nhưng QC-OMS chưa có schema/dữ liệu thật, không hiển thị filter đó ở UI. Không tạo filter rỗng chỉ để giống KiotViet.

---

## 4. Cột bảng

| Cột | Mô tả |
|---|---|
| Mã chứng từ | `BG...`, `HD...`, `HD....01`; bấm để mở chi tiết |
| Thời gian | Thời điểm lưu báo giá hoặc checkout hóa đơn |
| Loại | Báo giá hoặc Hóa đơn |
| Mã khách | Mã khách tại thời điểm lưu; khách lẻ mặc định là `KH000001` |
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

Nếu POS/báo giá/hóa đơn không chọn khách, backend phải gán chứng từ vào `KH000001 - Khách lẻ` của tổ chức. Danh sách chứng từ vẫn có thể hiển thị snapshot `Khách lẻ`, nhưng filter/lịch sử theo khách phải dựa trên `customer_id = KH000001`, không để chứng từ bán lẻ ở `customer_id = null`.

---

## 5. Thao tác nhanh

### 5.1. Hiện tại

| Trạng thái | Thao tác |
|---|---|
| Hóa đơn hoàn thành | Mở chi tiết readonly |
| Hóa đơn đã hủy | Mở chi tiết readonly nếu dữ liệu đã có |
| Báo giá active | Mở chi tiết readonly, mở lại vào POS draft local |
| Báo giá không còn mở được | Mở chi tiết readonly; xử lý theo cảnh báo nếu sản phẩm/khách/giá đã lệch |

### 5.2. Ngoài phạm vi hiện tại

Các thao tác sau nằm ngoài phạm vi hiện tại, không coi là đã có trong implementation:

| Trạng thái | Thao tác ngoài phạm vi hiện tại |
|---|---|
| Báo giá | Hủy báo giá nếu Owner chốt nghiệp vụ riêng |
| Hóa đơn hoàn thành | In lại bill, sửa hóa đơn, hủy hóa đơn |
| Hóa đơn đã hủy | In/xem lịch sử; không cho sửa tiếp |

Quy tắc sửa/hủy hóa đơn khi mở phạm vi:

- Không sửa đè hóa đơn đã chốt.
- Bấm **Sửa hóa đơn** mở chứng từ tại POS như một bản nháp sửa, tab hiển thị `Sửa HD000123`.
- Khi lưu lại, hệ thống tạo mã mới theo quy tắc `MaCu.01`, `MaCu.02`.
- Chứng từ cũ chuyển sang trạng thái **Đã hủy** với lý do sửa chứng từ.
- Hủy hóa đơn không tạo bản sửa cũng đưa chứng từ về trạng thái **Đã hủy**.
- Chứng từ đã hủy/sửa xem lại qua filter trạng thái **Đã hủy** hiện có; không tạo khu riêng nếu chưa cần.
- Sửa/hủy bắt buộc chọn lý do nhanh và có thể nhập ghi chú thêm.
- Nhân viên được sửa/hủy trong 10 ngày; sau 10 ngày chỉ quản lý/admin hoặc quyền mạnh tương ứng.
- Chỉ bật khi Backend có transaction an toàn để đồng bộ chứng từ, kho, sổ quỹ và công nợ.

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
