# 01-K03A-DOI-TAC.md — K03-A: HỒ SƠ ĐỐI TÁC & BỘ LỌC GIÁ

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. GIAO DIỆN

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [👤 Tìm khách hàng (F4)...] [+]                                                                              │
│  [Đối tác đã chọn ▼]    Dư nợ: [...]    Tổng doanh thu: [...]                         [× Bỏ chọn KH]         │
│  Bảng giá: [Tên bảng giá ▼]    Chiết khấu: [...]                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## II. CHỨC NĂNG

| Thành phần | Mô tả | Phím tắt |
|---|---|---|
| **Tìm/Chọn KH** | Tìm kiếm và chọn khách hàng đã có trong hệ thống theo SĐT, tên khách hàng hoặc mã khách hàng. Hỗ trợ tìm không dấu. | `F4` |
| **[+] Thêm nhanh KH** | Mở form thêm nhanh khách mới ngay trong POS. Thông tin tối thiểu: mã khách hàng và tên khách hàng; SĐT không bắt buộc. Sau khi tạo xong, tự gán khách vào tab hóa đơn đang active. | — |
| **Bảng giá** | Dropdown chọn bảng giá theo tên cho khách hàng đã chọn. Nếu khách không được gán bảng giá thì dùng Bảng giá chung. Tự động tính lại Thành tiền trong K02-A khi đổi bảng giá. | — |
| **Chiết khấu** | Hiển thị riêng phần trăm chiết khấu nếu chính sách giá đang áp dụng có chiết khấu. | — |
| **Công nợ và doanh thu** | Hiển thị tóm tắt dư nợ hiện tại và tổng doanh thu của khách đã chọn. | — |
| **Chi tiết KH đã chọn** | Nhấp vào khách hàng đã chọn để mở bảng chi tiết hồ sơ, lịch sử bán hàng và dư nợ. | — |
| **Bỏ chọn KH** | Reset UI về trạng thái Khách lẻ và áp Bảng giá chung; khi lưu chứng từ backend vẫn gán vào `khachle - Khách lẻ` | — |

---

## III. TRẠNG THÁI ĐỐI TÁC

| Trạng thái | Hiển thị |
|---|---|
| **Chưa chọn** | Input placeholder: `Tìm khách hàng (F4)...`; UI chưa chọn khách cụ thể, nhưng khi lưu báo giá/hóa đơn backend dùng `khachle - Khách lẻ` |
| **Đã chọn** | Hiển thị tên KH, mã KH, dư nợ, tổng doanh thu, tên bảng giá, chiết khấu nếu có và nút `[× Bỏ chọn KH]` |
| **Thiếu SĐT** | Khi người dùng chọn khách đã tồn tại, kích hoạt `K03-B` nếu khách còn thiếu SĐT |

---

## IV. QUY TẮC TÌM VÀ THÊM NHANH

- Nhấn `F4` → focus ô tìm khách hàng tại K03-A.
- Ô tìm khách hỗ trợ tìm theo:
  - Số điện thoại.
  - Tên khách hàng.
  - Mã khách hàng.
- Hỗ trợ tìm không dấu.
- Mỗi kết quả tìm kiếm hiển thị tên khách hàng, mã khách hàng, SĐT và dư nợ hiện tại.
- Trong danh sách kết quả, dùng phím `↑`/`↓` để di chuyển, `Enter` để chọn và `Esc` để đóng danh sách.
- Khi chọn khách, hệ thống gắn khách vào tab hóa đơn đang active.
- Cảnh báo bổ sung thông tin khách hàng chỉ được kiểm tra khi người dùng chọn khách hàng đã tồn tại; không tự bật khi người dùng chỉ đứng yên ở màn hình POS.
- Nếu tab đang active đã có hàng, khi chọn hoặc đổi khách thì hệ thống tự cập nhật lại giá và chiết khấu theo dữ liệu của khách vừa chọn, đồng thời hiện thông báo ngắn. Chỉ các dòng đang dùng giá tự động được tính lại; dòng đã sửa giá thủ công được giữ nguyên và có dấu hiệu nhận biết. Số lượng, kích thước và ghi chú của các dòng hàng được giữ nguyên.
- Khi bỏ chọn khách, các dòng đang dùng giá tự động được tính lại theo Bảng giá chung; dòng đã sửa giá thủ công được giữ nguyên.
- Nếu khách hàng không được gán bảng giá thì áp dụng Bảng giá chung.
- Tab hóa đơn có thể ở trạng thái chưa chọn khách; khách có thể được chọn sau khi đã có hàng trong giỏ.
- Khi tab hóa đơn ở trạng thái chưa chọn khách và người dùng lưu báo giá/thanh toán, payload/backend phải tạo chứng từ với `customer_id` của khách mã `khachle`, không để `customer_id = null`.
- Nút `[+]` cạnh ô tìm khách dùng để thêm nhanh khách mới trong POS.
- Form thêm khách sử dụng cùng modal, bố cục, các tab và trường dữ liệu với bảng chi tiết khách hàng. Chế độ thêm mới để trống dữ liệu; chế độ chỉnh sửa nạp dữ liệu của khách đã chọn.
- Thông tin bắt buộc:
  - Mã khách hàng.
  - Tên khách hàng.
- Mã khách hàng:
  - Cho phép nhập thủ công hoặc tự sinh nếu để trống.
  - Phải duy nhất, viết hoa, không chứa khoảng trắng hoặc ký tự `_` vì `_` được dùng làm dấu phân tách trong tên file máy sản xuất.
  - Được phép sửa sau khi đã tạo khách hàng; mỗi lần lưu lại đều phải kiểm tra tính duy nhất và đúng định dạng.
- Thông tin tùy chọn gồm:
  - Địa chỉ, Tỉnh/Thành phố và Phường/Xã; danh sách Phường/Xã phụ thuộc Tỉnh/Thành phố đã chọn.
  - Một nhóm khách hàng chính dùng để áp dụng bảng giá.
  - Email.
  - Nút cấu hình gửi tin nhắn/bill cho khách.
  - Ghi chú.
- Không sử dụng ảnh khách hàng, chi nhánh, ngày sinh hoặc giới tính trong hồ sơ khách hàng QC-OMS.
- Các trường tùy chọn được đặt trong phần **Thông tin thêm** để thao tác thêm nhanh vẫn gọn.
- SĐT là thông tin tùy chọn. Nếu có nhập thì phải hợp lệ sau chuẩn hóa và không được trùng với khách khác.
- Tên khách không được trùng khách khác trong cùng tổ chức sau khi chuẩn hóa khoảng trắng và hoa/thường; không thể tạo thêm biến thể của `Khách lẻ`.
- Nút cấu hình gửi tin nhắn dùng để bật/tắt hỗ trợ gửi bill và chọn một trong ba phương thức gửi:
  - Zalo cá nhân.
  - Nhóm Zalo.
  - Facebook.
- Khi bấm nút cấu hình gửi tin nhắn, hệ thống mở popup cấu hình riêng; các trường định danh/link nằm trong popup này.
- Các thông tin kỹ thuật cần để mở đúng nơi gửi được lưu trong cấu hình gửi tin nhắn, không hiển thị thành các trường rời trong form khách hàng.
- Cấu hình gửi tin nhắn phải lưu đủ dữ liệu để thử mở đúng nơi gửi:
  - Zalo cá nhân: định danh/link Zalo của khách.
  - Nhóm Zalo: định danh/link nhóm.
  - Facebook: username/link hội thoại phù hợp.
- Chỉ hỗ trợ sinh ảnh bill và mở nơi gửi khi hồ sơ khách đã bật hỗ trợ gửi bill và cấu hình phương thức gửi hợp lệ.
- Nếu chưa bật hỗ trợ gửi bill hoặc cấu hình phương thức gửi chưa hợp lệ, hệ thống không tự mở nơi gửi cho khách.
- Trước khi kiểm tra trùng, SĐT được chuẩn hóa bằng cách loại bỏ khoảng trắng và các ký tự trình bày không cần thiết.
- Nếu SĐT để trống, hệ thống cho phép lưu khách hàng.
- Nếu SĐT đã tồn tại, hệ thống hiển thị khách hàng tương ứng để người dùng chọn lại và không cho tạo hồ sơ trùng.
- Nút `[Lưu]` tạo hồ sơ khách hàng. Nút `[Bỏ qua]` hoặc `[X]` đóng modal; nếu đã nhập dữ liệu thì phải xác nhận trước khi bỏ thay đổi.
- Sau khi tạo nhanh thành công, khách mới được tự động gán vào tab hóa đơn đang active; thu ngân không cần tìm lại.
- Mã khách hàng là mã chính thức dùng trong POS và là mã `KH` được máy sản xuất dùng khi gửi thông báo về K02-D.
- Khi mã khách hàng được sửa:
  - Thông báo máy sản xuất đã được hệ thống tiếp nhận và liên kết đúng khách vẫn tiếp tục được xử lý bình thường.
  - Tên file gửi mới phải sử dụng mã khách hàng mới; mã cũ không còn được nhận diện cho các thông báo mới.
- Cấu hình khách hàng được phép nhận thông báo máy sản xuất sẽ được đặc tả sau ở module Khách hàng/Backend. Trong phạm vi POS, K03-A chỉ sử dụng kết quả cấu hình này.

---

## V. BẢNG THÊM / CHI TIẾT KHÁCH HÀNG

- Bảng này là một giao diện dùng chung cho hai chế độ:
  - **Thêm mới:** mở bằng nút `[+]`, các trường dữ liệu ban đầu để trống.
  - **Chỉnh sửa:** mở bằng cách nhấp vào khách hàng đã chọn, các trường được điền bằng dữ liệu hiện có.
- Hai chế độ sử dụng cùng bố cục, quy tắc nhập liệu và hành vi đóng bảng.
- Chế độ Thêm mới chỉ hiển thị tab **Thông tin**.
- Hai tab **Lịch sử bán hàng** và **Dư nợ** chỉ hiển thị trong chế độ Chỉnh sửa đối với khách hàng đã tồn tại.
- Phần đầu bảng hiển thị:
  - Chế độ Thêm mới: tiêu đề `Thêm khách hàng`; thông tin khách, dư nợ và tổng doanh thu chưa có dữ liệu.
  - Chế độ Chỉnh sửa: tên khách hàng, mã khách hàng, dư nợ hiện tại và tổng doanh thu. Tổng doanh thu chỉ tính các hóa đơn ở trạng thái Hoàn thành, không tính hóa đơn Đã hủy.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Thêm khách hàng / Chi tiết khách hàng                                  [X]  │
│ [Tên KH]  [Mã KH]        Dư nợ: [...]        Tổng doanh thu: [...]           │
│                                                                              │
│ [Thông tin] [Lịch sử bán hàng] [Dư nợ]                                      │
│                                                                              │
│ Nội dung tab đang chọn                                                       │
│                                                                              │
│                                                        [Bỏ qua] [Lưu]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Ở chế độ Thêm mới, hai tab **Lịch sử bán hàng** và **Dư nợ** không hiển thị.
- Bảng chi tiết gồm ba tab:
  - **Thông tin:** hồ sơ và thông tin liên hệ của khách.
  - **Lịch sử bán hàng:** các giao dịch bán hàng của khách.
  - **Dư nợ:** lịch sử phát sinh và thanh toán công nợ.
- Người dùng có quyền sử dụng POS được sửa toàn bộ thông tin khách hàng trong bảng này, gồm cả nhóm khách hàng và cấu hình gửi tin nhắn.
- Các trường thông tin gồm: mã khách hàng, tên khách hàng, SĐT, địa chỉ, nhóm khách hàng, email, nút cấu hình gửi tin nhắn/bill, ghi chú và thông tin pháp lý nội bộ nếu cần. Cấu trúc trường phải thống nhất với form thêm khách hàng.
- Nút `[Lưu]` tạo khách trong chế độ Thêm mới hoặc ghi nhận thay đổi trong chế độ Chỉnh sửa. Nút `[Bỏ qua]`, `[X]` hoặc phím `Esc` dùng để đóng bảng; nhấp ra ngoài modal không đóng bảng.
- Nếu khách đang được gắn vào tab hóa đơn active và việc chỉnh sửa làm thay đổi nhóm khách hàng hoặc bảng giá áp dụng, sau khi lưu hệ thống tính lại các dòng đang dùng giá tự động và giữ nguyên các dòng đã sửa giá thủ công.
- Nếu đóng bảng hoặc bấm `[Bỏ qua]` khi có dữ liệu đã thay đổi nhưng chưa lưu, hệ thống yêu cầu xác nhận bỏ thay đổi.
- Tab Lịch sử bán hàng và tab Dư nợ hiển thị dữ liệu đã có; quy tắc nghiệp vụ chi tiết sẽ được đặc tả sau.
- Khi sửa và bổ sung SĐT hợp lệ, cảnh báo thiếu SĐT tại K03-B không còn hiển thị.

### V.1. Thông tin pháp lý nội bộ

- QC-OMS không làm hóa đơn điện tử/VAT trong scope hiện tại.
- Không có tab `Thông tin xuất hóa đơn` riêng trong POS.
- Nếu xưởng cần lưu tên đơn vị, mã số thuế hoặc địa chỉ pháp lý để tham khảo nội bộ, đặt trong tab **Thông tin** hoặc ghi chú khách hàng.
- Không có nút tra cứu MST, phát hành HĐĐT hoặc kiểm tra trường bắt buộc cho HĐĐT.

### V.2. Tab Lịch sử bán hàng

- QC-OMS không có nghiệp vụ trả hàng; không hiển thị trạng thái trả hàng, số lượng trả hoặc chức năng trả hàng trong tab này.
- Danh sách được sắp xếp theo thời gian mới nhất ở trên cùng.
- Bảng gồm các cột:
  - Mã hóa đơn.
  - Thời gian.
  - Người bán.
  - Tổng cộng.
  - Trạng thái.
- Trạng thái trong danh sách gồm **Hoàn thành** và **Đã hủy**.
- Mã hóa đơn là liên kết. Khi nhấp vào, hệ thống chuyển sang chi tiết tương ứng tại trang Đơn hàng; giao diện và hành vi tại trang đó được quy định trong đặc tả trang Đơn hàng.
- Mỗi trang hiển thị 20 giao dịch, có điều hướng phân trang và tổng số giao dịch.
- Hỗ trợ lọc theo mã hóa đơn, thời gian và trạng thái.
- Chức năng đưa hóa đơn cũ trở lại thành hóa đơn nháp sẽ được đặc tả sau tại trang Đơn hàng.

### V.3. Tab Dư nợ

- Danh sách được sắp xếp theo thời gian mới nhất ở trên cùng.
- Quy tắc nghiệp vụ công nợ xem tại [POS-CUSTOMER-DEBT.md](../../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md).
- Bảng gồm các cột:
  - Mã chứng từ.
  - Thời gian.
  - Loại.
  - Giá trị.
  - Dư nợ sau giao dịch.
- Mã chứng từ là liên kết:
  - Nhấp mã hóa đơn để chuyển đến chi tiết tương ứng tại trang Đơn hàng.
  - Nhấp mã phiếu thu để chuyển đến chi tiết tương ứng tại trang Sổ quỹ.
  - Giao diện và hành vi tại trang đích được quy định trong đặc tả của trang đó.
- Cột Dư nợ sau giao dịch hiển thị số dư lũy kế theo quy tắc Business.
- Không hiển thị số dư âm/khách trả trước trong MVP. Nếu khách trả dư khi còn nợ, phần dư được xử lý theo lựa chọn trả lại khách hoặc cấn vào nợ cũ; hệ thống không tạo công nợ âm.
- Mỗi trang hiển thị 20 giao dịch, có điều hướng phân trang và tổng số giao dịch.
- Hỗ trợ lọc theo mã chứng từ, thời gian và loại giao dịch.
- Có chức năng `[Xuất Excel]` để lập bảng đối chiếu công nợ.
- Không cho sửa trực tiếp số dư công nợ tại POS. Nghiệp vụ điều chỉnh công nợ sẽ được đặc tả sau.

---

## VI. THAM CHIẾU DỮ LIỆU

| Nội dung | Mục đích | Chi tiết |
|---|---|---|
| Hồ sơ đối tác | Lưu thông tin khách hàng / đối tác | [→ POS-TABLES.md §1](../../../04-DATABASE/Sales/POS-TABLES.md#1-bảng-publiccustomers--đối-tác--khách-hàng) |
| Bảng giá | Danh sách bảng giá áp dụng | [→ POS-TABLES.md §2](../../../04-DATABASE/Sales/POS-TABLES.md#2-bảng-publicprice_lists--bảng-giá) |
| Công nợ khách hàng | Quy tắc phát sinh nợ, thu tiền và số dư lũy kế | [→ POS-CUSTOMER-DEBT.md](../../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md) |

---

← [Quay về Master Map](../01-POS-LAYOUT.md)
