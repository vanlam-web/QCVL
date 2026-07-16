# 02-CUSTOMER-DETAIL — Chi tiết khách hàng

> **Mốc chốt:** V1 đủ test theo chốt Owner ngày `2026-07-03`; chức năng nâng cao nằm ngoài phạm vi hiện tại.

---

## 1. Mục tiêu

Trang chi tiết khách hàng gom toàn bộ thông tin cần để bán hàng, áp giá, gửi bill và kiểm tra công nợ.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ KH000123 - Công ty A                    Dư nợ: ...    Tổng bán: ...         │
│ [Lưu] [Ngừng hoạt động]                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Thông tin] [Lịch sử bán] [Nợ cần thu]                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Gợi ý từ KiotViet: chi tiết khách nên mở được trực tiếp từ danh sách hoặc bằng mã khách. Header luôn cho thấy mã, tên, trạng thái, tổng nợ và tổng bán để nhân viên biết nhanh khách đang ở tình trạng nào.

Quan sát KiotViet ngày `2026-07-03`:

- Chi tiết khách xổ ngay dưới dòng khách trong danh sách.
- Các tab chính gồm `Thông tin`, `Địa chỉ nhận hàng`, `Lịch sử bán/trả hàng`, `Nợ cần thu từ khách`.
- Tab `Thông tin` có nhiều trường phụ như sinh nhật, giới tính, email, Facebook, địa chỉ, thông tin xuất hóa đơn, CCCD/CMND, hộ chiếu, ngân hàng.
- Tab `Lịch sử bán/trả hàng` hiển thị bảng gọn: mã hóa đơn, thời gian, người bán, tổng cộng, trạng thái.
- Tab `Nợ cần thu từ khách` hiển thị bảng gọn: mã phiếu, thời gian, loại, giá trị, dư nợ khách hàng.

QC-OMS MVP chỉ lấy cấu trúc vận hành này, không bê toàn bộ trường phụ của KiotViet. Detail mở trong danh sách không dùng avatar/chữ cái đầu tên khách; dòng đầu phải giống KV: tên khách + mã khách, dưới đó là `Người tạo`, `Ngày tạo`, `Nhóm khách`.

---

## 3. Tab Thông tin

Trường bắt buộc:

- Mã khách hàng.
- Tên khách hàng.

Trường tùy chọn:

- SĐT.
- MST.
- Địa chỉ một dòng.
- Nhóm khách.
- Ghi chú.

Quy tắc:

- Mã khách hàng có thể tự sinh khi tạo mới nếu người dùng để trống.
- Mã khách hàng được phép sửa, nhưng phải unique và đúng định dạng.
- Tên khách hàng được phép trùng trong cùng tổ chức giống KiotViet; mã khách hàng là khóa nhận diện/import/update.
- SĐT được phép trống.
- Nếu có SĐT, phải chuẩn hóa để tìm kiếm/phân biệt khách. Không dùng SĐT làm khóa import chính và không chặn import chỉ vì nguồn KV có hồ sơ cần giữ.
- MST được phép trống; nếu nhập thì lưu theo hồ sơ khách để dùng khi xuất/chốt thông tin doanh nghiệp sau này.
- Địa chỉ được phép trống; MVP chỉ hiển thị một dòng địa chỉ hồ sơ. Import KiotViet có thể lưu riêng `Phường/Xã` và `Khu vực giao hàng` để bổ sung địa chỉ hồ sơ, nhưng không tạo luồng địa chỉ giao hàng.
- Khi đổi nhóm khách, lần bán sau chỉ dùng bảng giá của nhóm nếu nhóm đó đã được cấu hình map bảng giá riêng.
- Nếu khách không có nhóm khách hoặc nhóm chưa map bảng giá riêng, lần bán sau dùng giá chung.
- Nếu khách đang mở ở POS, POS sẽ cập nhật giá tự động cho các dòng chưa sửa giá thủ công sau khi hồ sơ được lưu và đồng bộ.

Chi tiết khách MVP phải hiển thị readonly:

| Thông tin | Nguồn dữ liệu |
|---|---|
| Mã khách hàng, tên khách hàng, SĐT, MST, địa chỉ | `customers` |
| Loại khách, công ty, ghi chú, phường/xã, khu vực | `customers` dữ liệu import/hồ sơ, chưa mở nghiệp vụ giao hàng |
| Người tạo | `customers.created_by` -> `profiles.display_name`; khách cũ thiếu dữ liệu hiển thị `Chưa có dữ liệu` |
| Ngày tạo | `customers.created_at` |
| Tổng nợ hiện tại, hóa đơn còn nợ | Finance Customer Debt API |
| Lịch sử | Sales Documents API lọc theo `customer_id` |

Trên màn hình danh sách, summary ô chi tiết hiển thị tên + mã khách, ví dụ `Lanh Hồ KH000522`, và dòng phụ `Người tạo: Văn Viết Phương Lâm | Ngày tạo: 08/07/2026 | Nhóm khách: Chưa có`. Summary phải dùng shared `ManagementDetailSummary`, bên trong dùng `ManagementDetailMetaText`: nhãn dùng `management-detail-meta-label` nhạt/nhỏ hơn, dữ liệu DB dùng `management-detail-meta-value` đậm hơn; không viết CSS riêng cho trang khách hàng. Các trường đã có ở dòng ngoài như mã khách hàng, tên khách hàng, SĐT, nhóm khách, công nợ và trạng thái không lặp lại trong tab `Thông tin`. `Bảng giá áp dụng` không hiển thị trong ô chi tiết vì dễ dư, nhất là khi nhóm/bảng giá chỉ là số như `35`. Khi mở một khách, dòng ngoài và ô chi tiết phải được tô thành một cụm trực quan để nhân viên biết rõ chi tiết đang thuộc dòng nào.

Các trường như email, Facebook, sinh nhật, giới tính, địa chỉ nhận hàng nhiều dòng/nhiều cấp, CCCD/CMND, hộ chiếu và ngân hàng không nằm trong MVP chi tiết khách.

UI và lõi nghiệp vụ phải tách riêng:

- Component chi tiết khách chỉ render dữ liệu từ contract/service, không nhúng truy vấn DB hoặc tự tính nghiệp vụ.
- Các nguồn như người tạo, ngày tạo, lịch sử chứng từ, công nợ và phân tích phải đi qua DB/API/service.
- Người tạo từ import KiotViet map vào tài khoản QCVL theo thứ tự: `users.username` sau khi bỏ `{DEL}`, tên hiển thị khớp chính xác, rồi tên hiển thị rút gọn khớp duy nhất. API danh sách phải resolve lại từ `source_creator_name` để dữ liệu import cũ và tài khoản đổi tên hiển thị vẫn hiện đúng.
- Sau này đổi layout/tab/skin UI không được làm đổi quy tắc lưu `created_by`, `created_at`, lịch sử chứng từ hoặc công nợ.
- `Xem phân tích` là nút icon biểu đồ nằm cùng hàng với tab `Thông tin` / `Nợ cần thu` / `Lịch sử`, nhưng đẩy sang bên phải để tách khỏi tab nội dung.
- Khi bấm icon phân tích, mở popup riêng có bộ lọc như khoảng thời gian và các chỉ số thống kê. MVP chỉ hiển thị nhãn và `-` khi chưa có API phân tích; không đưa ghi chú/hướng dẫn lên UI và không dựng số giả.
- Tab `Thông tin` phải hiển thị dòng ghi chú kiểu gọn giống KiotViet; nếu chưa có dữ liệu thì ghi `Chưa có ghi chú`.
- Cuối ô chi tiết giữ cụm nút `Xóa`, `Chỉnh sửa`, `Ngừng hoạt động` giống KiotViet để người dùng thấy hướng thao tác. Giai đoạn hiện tại các nút này chỉ là UI khóa, chưa nối API; khi làm tiếp phải nối đúng route sửa/xóa/ngừng khách trước khi bật.

---

## 4. Ngoài phạm vi hiện tại: Cấu hình gửi bill

Cho phép bật/tắt hỗ trợ gửi bill và chọn kênh:

- Zalo cá nhân.
- Nhóm Zalo.
- Facebook/Messenger.

Quy tắc:

- Nếu chưa bật hoặc cấu hình thiếu dữ liệu, POS không hiện popup gửi bill.
- Hệ thống chỉ hỗ trợ mở đúng nơi gửi và chuẩn bị ảnh bill; nhân viên vẫn kiểm tra và bấm gửi.
- Không lưu lịch sử gửi bill trong MVP.

---

## 5. Tab Lịch sử bán

Hiển thị lịch sử chứng từ bán hàng của khách, có lựa chọn `Hóa đơn` / `Báo giá` trong tab. Mỗi lựa chọn tải tối đa `10` chứng từ gần đây trước; nếu cần xem thêm thì dùng phân trang/lazy-load ở phạm vi mở rộng, không trộn toàn bộ lịch sử vào công nợ.

- Mã hóa đơn hoặc mã báo giá theo lựa chọn đang xem.
- Thời gian.
- Người bán.
- Tổng cộng.
- Trạng thái:
  - Với `Hóa đơn`: thể hiện tình trạng thanh toán/công nợ gồm `Hoàn tất`, `Nợ`, `Nợ 1 phần`; nếu hóa đơn bị hủy thì hiển thị `Đã hủy`.
  - Với `Báo giá`: thể hiện trạng thái báo giá gồm `Đang hiệu lực`, `Đã chuyển`, `Đã hủy`.

Bấm mã chứng từ mở chi tiết tại module SalesDocuments.

Không hiển thị dòng tổng kiểu `13 chứng từ gần đây` trong UI chi tiết để tránh rối; nếu cần tổng/phân trang lịch sử sẽ thiết kế riêng sau. Bảng lịch sử dùng layout 5 cột cố định, chia đều chiều ngang để cột thời gian không giãn quá mức.

KiotViet hiển thị lịch sử bán/trả hàng chung. QC-OMS MVP trong tab này giữ hai lát rõ ràng là `Hóa đơn` và `Báo giá`; trả hàng bán nằm ngoài phạm vi MVP hiện tại.

Nguồn dữ liệu chuẩn là Sales Documents lọc theo `customer_id` và `type = invoice | quote`. Nếu API danh sách chứng từ chưa hỗ trợ filter này, không được dựng dữ liệu giả; UI có thể ẩn tab lịch sử bán trong lát đó và phải ghi rõ ngoài phạm vi.

`khachle - Khách lẻ` là hồ sơ khách mặc định của tổ chức. Báo giá/hóa đơn được tạo ở POS khi nhân viên chưa chọn khách vẫn phải có `customer_id` trỏ về khách có mã `khachle`, vì vậy tab lịch sử của `khachle` phải thấy các chứng từ khách lẻ này thay vì phụ thuộc snapshot tên khách.

Trong mục tiêu hiện tại là hoàn thiện `Hàng hóa` để tồn vận hành đúng, tab `Lịch sử` của khách chỉ cần giữ mức đọc cơ bản khi đã có hóa đơn/báo giá thật. Không mở thêm bảng giao dịch giống KiotViet, không làm trả hàng bán và không dựng lịch sử giả trước khi hóa đơn/POS/nhập hàng phục vụ stock movement đã ổn.

---

## 6. Tab Nợ cần thu

Tab này chỉ hiển thị các hóa đơn còn đang nợ, không lặp toàn bộ lịch sử chứng từ. Bảng V1 gồm:

- Mã.
- Thời gian.
- Tổng tiền.
- Đã trả.
- Còn nợ.

Thao tác:

- Thu nợ mở form thu nợ theo quy tắc Finance.
- Tiền thu nợ mặc định phân bổ vào hóa đơn cũ nhất trước.
- Không tạo công nợ âm/khách trả trước trong MVP.

Tab này là lối xem nhanh công nợ theo khách. Nguồn dữ liệu vẫn phải khớp với module Finance/Customer Debt và phiếu thu trong Sổ quỹ.

Lát MVP hiện tại chỉ cần readonly công nợ theo hóa đơn còn nợ:

- tổng nợ hiện tại
- số hóa đơn còn nợ
- danh sách hóa đơn còn nợ gồm mã, thời gian, tổng tiền, đã trả, còn nợ

Trên danh sách khách, cột `Công nợ` tải tự động cho các khách đang hiển thị trên trang hiện tại bằng Finance Customer Debt API. Nếu chưa tải xong hoặc tải lỗi, hiển thị `-` thay vì đoán số.

Nếu hóa đơn phát sinh nợ khi POS chưa chọn khách, khoản nợ thuộc khách mã `khachle`. Ghi chú khách lẻ nếu có chỉ là thông tin nhận diện phụ của hóa đơn/khoản nợ, không tạo bucket công nợ `customer_id = null`.

Thu nợ độc lập, điều chỉnh công nợ, chiết khấu thanh toán và QR thanh toán là scope Finance/POS sau, không tự mở trong lát khách hàng này.

Trong mục tiêu hiện tại là hoàn thiện `Hàng hóa` để tồn vận hành đúng, `Nợ cần thu` không nằm trên đường găng. Chỉ giữ readonly cơ bản nếu Finance API đã có dữ liệu thật; các dòng thanh toán, chiết khấu thanh toán, QR, điều chỉnh công nợ và xuất file công nợ làm sau.

---

## 7. Các tab ngoài phạm vi MVP

KiotViet có thêm nhiều tab như lịch sử đặt hàng, công nợ, lịch sử mua dịch vụ, lịch sử tích điểm. QC-OMS MVP không làm riêng nếu không có nghiệp vụ tương ứng:

- xuất hóa đơn/HĐĐT/VAT: bỏ khỏi scope hiện tại; không tạo tab hoặc luồng phát hành hóa đơn điện tử
- địa chỉ nhận hàng/giao hàng nhiều cấp: bỏ khỏi MVP vì QC-OMS không làm vận đơn, COD hoặc bán giao hàng; chỉ giữ địa chỉ hồ sơ một dòng ở tab thông tin
- lịch sử đặt hàng: bỏ theo mô hình KiotViet; nếu cần gửi giá trước thì dùng Báo giá, không phải đơn đặt hàng
- lịch sử mua dịch vụ: bỏ
- lịch sử tích điểm: bỏ
- công nợ tổng: đã được bao phủ bởi `Nợ cần thu` và module Finance

---

## 8. Ngoài phạm vi V1: Trạng thái khách hàng

| Trạng thái | Hành vi |
|---|---|
| Đang hoạt động | Tìm được trong POS và danh sách khách |
| Ngừng hoạt động | Không hiện trong tìm kiếm POS mặc định; vẫn xem được trong danh sách khách bằng bộ lọc |

Ngừng hoạt động không xóa lịch sử bán hàng, công nợ hoặc chứng từ cũ.

---

## 9. Shared Management Detail Rule

Ô chi tiết Khách hàng đi theo cùng chuẩn `management-*` với Hàng hóa và Kiểm kho:

- Bấm nguyên dòng khách hàng để mở/đóng chi tiết ngay dưới dòng đó.
- Khung chi tiết dùng shared shell: `ManagementDetailPanel` bọc toàn bộ tabbar, summary, nội dung tab và footer action.
- Header/summary chi tiết dùng `ManagementDetailSummary`: tên + mã khách và dòng phụ `Người tạo`, `Ngày tạo`, `Nhóm khách`.
- Tab `Thông tin` chỉ hiển thị các field cần kiểm tra nhanh: loại khách, điện thoại, MST, địa chỉ và ghi chú.
- Không lặp lại mã khách, tên khách, SĐT, nhóm khách hoặc bảng giá trong phần thông tin nếu ngoài bảng/header đã có.
- `Người tạo` hiển thị tên tài khoản QCVL khi `source_creator_name` map được với username hoặc tên hiển thị duy nhất.
- Nếu file import có `Người tạo` nhưng không khớp tài khoản QCVL nào, hiển thị `Chưa khớp tài khoản`.
- Nếu file import không có `Người tạo`, hiển thị `Chưa có dữ liệu`.
- Cụm action cuối chi tiết dùng `ManagementDetailActionFooter`; các nút chưa làm API được giữ disabled để thấy hướng chức năng sau.
- Tabbar chi tiết dùng `ManagementInlineDetailTabs`; nội dung tab dùng `ManagementDetailSection`; danh sách field dùng `ManagementDetailInfoList`; dòng ghi chú dùng `ManagementDetailInlineNote`.
- Không thêm CSS riêng cho detail nếu class `management-*` hiện có đủ dùng; không dùng lại class kiểu `customer-inline-detail`, `customer-detail-summary`, `customer-detail-tab-panel`.
