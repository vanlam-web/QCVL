# Thiết kế đối tượng nộp/nhận cho phiếu thu/chi

Purpose: chuẩn hóa cách tạo phiếu thu/chi thủ công trong QCVL theo mô hình KiotViet, nhưng điều chỉnh cho đúng dữ liệu và nghiệp vụ QCVL.

Updated: 2026-07-21

Status: planned. Tài liệu này ghi quyết định thiết kế; code chưa được xem là đã hỗ trợ đầy đủ cho đến khi có issue/commit triển khai riêng.

Related docs:

- `docs/02-PRD-UX-PhongCanh/Finance/02-CASHBOOK.md`
- `docs/03-BUSINESS-NghiepVu/Finance/CASHBOOK.md`
- `docs/04-DATABASE/Finance/CASHBOOK-TABLES.md`
- `docs/05-BACKEND-MayChu/Finance/FINANCE-API.md`

## Quyết Định Hiện Tại

QCVL chỉ tạo phiếu thu/chi thủ công bằng 2 hướng chính:

- `Phiếu thu`
- `Phiếu chi`

`Tiền mặt` và `Chuyển khoản` không phải loại phiếu riêng. Hai giá trị này thuộc trường `Phương thức TT`. Nếu chọn `Chuyển khoản`, form mới hiện trường tài khoản ngân hàng.

`Người thu`, `Người chi`, `Người tạo`, `Người bán` là tài khoản đăng nhập. Không nhập tay các trường này trong form tạo/sửa phiếu.

`Loại thu/chi` quyết định nhóm đối tượng nộp/nhận. Chỉ nhóm `Khác` được nhập tự do và lưu text trực tiếp trên phiếu. Các nhóm còn lại phải chọn bản ghi có sẵn hoặc tạo nhanh bản ghi master data trước khi lưu phiếu.

## Tham Chiếu KiotViet

Mô hình thao tác cần giữ:

1. Chọn `Phiếu thu` hoặc `Phiếu chi`.
2. Chọn `Loại thu` hoặc `Loại chi`.
3. Chọn nhóm đối tượng nộp/nhận theo loại thu/chi.
4. Chọn tên từ danh sách đã lưu hoặc tạo nhanh đối tượng mới nếu nhóm đó cho phép.

QCVL không sao chép 100% KiotViet. QCVL chuẩn hóa theo dữ liệu nội bộ:

- Khách hàng lấy từ danh sách khách hàng.
- Nhà cung cấp lấy từ danh sách nhà cung cấp.
- Nhân viên lấy từ tài khoản/nhân viên.
- Đối tác giao hàng lấy từ danh sách đã lưu; nếu chưa có thì tạo nhanh trước khi lưu phiếu.
- Khác là nhóm duy nhất nhập tự do, không quản lý danh sách riêng ở giai đoạn này.

## Cấu Trúc Form

Tiêu đề form:

- `Tạo phiếu thu`
- `Tạo phiếu chi`

Không đưa `tiền mặt` hoặc `ngân hàng` vào tiêu đề.

Trường chính:

| Trường | Quy tắc |
| --- | --- |
| `Thời gian` | Bắt buộc; khi sửa phiếu phải lấy giá trị cũ của phiếu. |
| `Loại thu/chi` | Phụ thuộc hướng phiếu thu hoặc chi. |
| `Phương thức TT` | `Tiền mặt` hoặc `Chuyển khoản`. |
| `Tài khoản` | Chỉ hiện và bắt buộc khi `Phương thức TT = Chuyển khoản`. |
| `Đối tượng nộp/nhận` | Danh sách phụ thuộc `Loại thu/chi`. |
| `Tên người nộp/nhận` | Với `Khác`, nhập text tự do. Với nhóm còn lại, bắt buộc chọn bản ghi hoặc tạo nhanh bản ghi trước khi lưu phiếu. |
| `Số điện thoại` | Tự điền nếu chọn từ danh sách có số điện thoại; vẫn cho sửa tay nếu nghiệp vụ cần. |
| `Số tiền` | Bắt buộc; lớn hơn 0; hiển thị theo định dạng tiền chung. |
| `Ghi chú` | Khi sửa phiếu phải lấy giá trị cũ của phiếu. |
| `Hạch toán kết quả kinh doanh` | Giữ theo quy tắc cashbook hiện có. |

## Mapping Loại Thu/Chi

`Loại thu/chi` quyết định nhóm đối tượng nộp/nhận được chọn. Nếu category code hiện tại khác tên hiển thị bên dưới, giữ code hiện có và map theo ý nghĩa nghiệp vụ.

Loại chi:

| Loại chi | Đối tượng nhận |
| --- | --- |
| `Vận chuyển` | `Đối tác giao hàng`, `Khác` |
| `Tiền trả NCC` | `Nhà cung cấp`, `Khác` |
| `Vật tư` | `Nhà cung cấp`, `Khác` |
| `Lương NV` | `Nhân viên` |
| `Hoàn tiền khách` | `Khách hàng`, `Khác` |
| `Chi phí vận hành` | `Nhân viên`, `Nhà cung cấp`, `Khác` |
| `Thuế/VAT` | `Khác` |
| `Hoa hồng` | `Nhân viên`, `Khác` |
| `Chuyển/Rút` | `Khác` |
| `Chi khác` | `Khách hàng`, `Nhà cung cấp`, `Nhân viên`, `Đối tác giao hàng`, `Khác` |

Loại thu:

| Loại thu | Đối tượng nộp |
| --- | --- |
| `Thu tiền khách` | `Khách hàng`, `Khác` |
| `Thu khác` | `Khách hàng`, `Nhà cung cấp`, `Nhân viên`, `Đối tác giao hàng`, `Khác` |
| `Chuyển/Rút` | `Khác` |
| `Góp vốn` | `Nhân viên`, `Khác` |

## Danh Sách Gợi Ý

| Nhóm đối tượng | Nguồn gợi ý | Nhập tự do |
| --- | --- | --- |
| `Khách hàng` | Customers API | Không; phải chọn khách cũ hoặc bấm `Tạo mới`. |
| `Nhà cung cấp` | Suppliers API | Không; phải chọn NCC cũ hoặc bấm `Tạo mới`. |
| `Nhân viên` | Profiles/users API (`public.profiles.id`) | Không; phải chọn nhân viên/tài khoản có sẵn. |
| `Đối tác giao hàng` | Delivery partners API | Không; phải chọn đối tác cũ hoặc bấm `Tạo mới`. |
| `Khác` | Không có nguồn gợi ý | Có. |

Ô tên người nộp/nhận dùng chung một kiểu combobox: gõ để tìm, hiện danh sách phù hợp, Enter chọn gợi ý đang focus, Escape đóng gợi ý. Với nhóm khác `Khác`, text đang gõ chỉ là query tìm kiếm; blur hoặc submit khi chưa chọn/tạo bản ghi phải báo lỗi.

## Thêm, Lưu Và Quản Lý Đối Tượng

QCVL không tạo một kho đối tượng chung lẫn lộn cho mọi loại. Mỗi nhóm đối tượng có nơi lưu rõ ràng:

| Nhóm đối tượng | Nơi lưu chính | Khi nhập tên mới trong phiếu | Màn quản lý |
| --- | --- | --- | --- |
| `Khách hàng` | Bảng khách hàng hiện có | Chọn khách cũ hoặc tạo nhanh khách mới; không lưu text tạm. | Màn khách hàng. |
| `Nhà cung cấp` | Bảng nhà cung cấp hiện có | Chọn NCC cũ hoặc tạo nhanh NCC mới; không lưu text tạm. | Màn nhà cung cấp. |
| `Nhân viên` | Tài khoản/nhân viên hiện có | Không tự tạo nhân viên mới trong phiếu thu/chi; nếu cần nhân viên mới phải tạo ở quản lý nhân viên/tài khoản. | Màn nhân viên/tài khoản. |
| `Đối tác giao hàng` | Bảng `delivery_partners` planned | Chọn đối tác cũ hoặc tạo nhanh đối tác mới; không lưu text tạm. | Giai đoạn đầu quản lý nhẹ trong combobox/tạo nhanh; sau đó có màn quản lý riêng nếu phát sinh nhu cầu. |
| `Khác` | Không có master data | Chỉ lưu text trên voucher, không đưa vào danh sách gợi ý chung. | Không có màn quản lý riêng. |

Quy tắc thêm nhanh:

- Nút `Tạo mới` chỉ hiện khi nhóm đối tượng có master data thật: khách hàng, nhà cung cấp, đối tác giao hàng.
- Với khách hàng/NCC, `Tạo mới` mở form tạo nhanh đúng module và sau khi lưu quay lại phiếu với id đã chọn.
- Với đối tác giao hàng, form tạo nhanh tối thiểu có tên, số điện thoại, ghi chú.
- Với `Khác`, không hiện `Tạo mới`; người dùng nhập text trực tiếp.

Quy tắc lưu voucher:

- Luôn lưu `counterparty_type`.
- Nếu chọn bản ghi có sẵn, lưu thêm `counterparty_id`.
- Luôn snapshot `counterparty_name` và `counterparty_phone` nếu có để xem lại phiếu cũ không bị đổi khi master data đổi tên/số điện thoại sau này.
- Với `customer`, `supplier`, `employee`, `delivery_partner`, `counterparty_id` bắt buộc.
- Chỉ `other` được lưu `counterparty_name` không kèm `counterparty_id`.
- Không tự sinh khách/NCC/đối tác giao hàng từ text người dùng gõ nếu người dùng chưa xác nhận `Tạo mới`.

## Đối Tác Giao Hàng

`Đối tác giao hàng` là nhóm đối tượng riêng, không trộn vào `Khác` nếu người dùng đã chọn loại này.

Hành vi:

- Ô tên người nhận là combobox tìm/chọn đối tác giao hàng.
- Khi gõ, hiện gợi ý đối tác giao hàng đã lưu.
- Chọn đối tác cũ thì điền tên và số điện thoại nếu có.
- Nếu chưa có đối tác, bấm `Tạo mới` để tạo nhanh rồi chọn bản ghi mới.
- Không lưu phiếu `Đối tượng nhận = Đối tác giao hàng` bằng text tự do chưa có bản ghi.

Dữ liệu đề xuất:

| Trường | Ghi chú |
| --- | --- |
| `id` | Khóa chính. |
| `name` | Tên đối tác. |
| `phone` | Tùy chọn. |
| `note` | Tùy chọn. |
| `is_active` | Ẩn/hiện gợi ý. |
| `created_at`, `updated_at` | Audit. |

Nếu chưa làm schema riêng, có thể tạm lưu vào voucher metadata, nhưng UI không được làm mất việc người dùng đã chọn `Đối tác giao hàng`.

## Luồng Dữ Liệu

1. Hướng phiếu tạo `in` hoặc `out`.
2. Người dùng chọn `Loại thu/chi`.
3. UI tính danh sách đối tượng nộp/nhận hợp lệ theo hướng phiếu và loại thu/chi.
4. Nếu đối tượng hiện tại không còn hợp lệ sau khi đổi loại thu/chi, reset về đối tượng hợp lệ đầu tiên.
5. Ô tên lấy gợi ý theo nhóm đối tượng đã chọn.
6. Submit gửi đầy đủ: hướng phiếu, loại thu/chi, phương thức TT, tài khoản, nhóm đối tượng, id bản ghi bắt buộc nếu không phải `Khác`, tên snapshot, số điện thoại snapshot nếu có, số tiền, ghi chú, cờ hạch toán kết quả kinh doanh.

## Validation

- `Số tiền` bắt buộc và lớn hơn 0.
- `Tài khoản` bắt buộc khi `Phương thức TT = Chuyển khoản`.
- `Tên người nộp/nhận` bắt buộc với nhóm `Khác`.
- `counterparty_id` bắt buộc với `customer`, `supplier`, `employee`, `delivery_partner`.
- `Đối tác giao hàng` phải là bản ghi đã lưu hoặc bản ghi vừa tạo nhanh.
- Khi sửa phiếu, form phải prefill đúng giá trị cũ: thời gian, loại thu/chi, phương thức TT, tài khoản, đối tượng, tên, số tiền, ghi chú.

## Kiểm Thử Cần Có Khi Triển Khai

Frontend:

- Mở `Phiếu chi` mặc định đúng loại chi đầu tiên và đối tượng hợp lệ.
- Chọn `Vận chuyển` chỉ cho `Đối tác giao hàng` và `Khác`.
- Chọn `Đối tác giao hàng` hiện gợi ý đã lưu; tên mới phải đi qua `Tạo mới` trước khi lưu phiếu.
- Chọn `Nhân viên`, `Khách hàng`, `Nhà cung cấp` đúng nguồn gợi ý từ danh sách hiện có.
- Đổi `Phương thức TT` chỉ đổi cash/bank account, không đổi hướng phiếu.
- Sửa phiếu cũ prefill đúng toàn bộ trường cũ.

Backend:

- Manual voucher chấp nhận `delivery_partner`.
- Tên đối tác giao hàng mới được tạo qua `POST /finance/delivery-partners`, sau đó voucher lưu `counterparty_id`.
- Voucher lưu `counterparty_type`, `counterparty_id` với nhóm master data; chỉ `other` được lưu `counterparty_name` tự do không kèm id.
- Voucher snapshot tên/số điện thoại người nộp/nhận để lịch sử phiếu không đổi theo master data.
- `Khác` không sinh master data và không xuất hiện trong gợi ý các phiếu sau.
- Không làm hồi quy hành vi khách hàng, nhà cung cấp, nhân viên.

## Ngoài Phạm Vi

- Màn hình quản lý đối tác giao hàng đầy đủ ở giai đoạn đầu; chỉ cần quản lý nhẹ qua gợi ý/tạo nhanh.
- Đổi cách tính công nợ cho đối tác giao hàng.
- Import đối tác giao hàng từ KiotViet.
