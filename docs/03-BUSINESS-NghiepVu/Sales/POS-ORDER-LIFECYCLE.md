# POS-ORDER-LIFECYCLE — Vòng đời đơn hàng POS

> **Vai trò:** Source of Truth nghiệp vụ cho trạng thái đơn hàng POS.
> **Runtime vs SoT:** [README.md](./README.md) mục “Vòng đời POS / chứng từ” — mở lại BG / hủy / revision có thể hẹp hơn SoT đầy đủ.

---

## 1. MỤC ĐÍCH

Tài liệu này là Source of Truth cho trạng thái đơn hàng POS, gồm hóa đơn nháp, báo giá và hóa đơn bán hàng.

QC-OMS không có nghiệp vụ `Đặt hàng` kiểu KiotViet trong MVP. Luồng bán hàng là **bán đứt**: khi checkout thành công thì sinh hóa đơn bán hàng, trừ kho, ghi nhận tiền/công nợ theo quy tắc checkout.

---

## 2. LOẠI MÃ ĐƠN

| Loại | Mã | Ý nghĩa |
|---|---|---|
| Hóa đơn nháp | Chưa có mã chính thức hoặc dùng tên tab tạm | Đang nhập/sửa trên POS, chưa lưu thành chứng từ bán hàng |
| Báo giá | `BG...` | Đơn hàng ở trạng thái báo giá, dùng để gửi giá cho khách |
| Hóa đơn bán hàng | `HD...` | Đơn hàng đã xác nhận bán/thanh toán |

---

## 3. QUY TẮC HÓA ĐƠN NHÁP

### BR-ORD-01: Nháp POS không phải chứng từ bán hàng

Hóa đơn nháp trên POS là trạng thái làm việc tạm thời của máy bán hàng.

Nháp chưa có mã chứng từ chính thức và chưa phát sinh doanh thu, kho, sổ quỹ hoặc công nợ.

### BR-ORD-02: Nháp được giữ theo máy POS

Mỗi máy POS có bộ nháp riêng.

Nháp đang mở trên máy A không tự xuất hiện trên máy B.

Nháp được giữ lại để nhân viên không mất dữ liệu khi reload, đóng trình duyệt hoặc khởi động lại máy.

### BR-ORD-03: Nháp bị xóa khi đóng tab hoặc hoàn tất chứng từ

Nháp chỉ bị xóa khỏi vùng làm việc khi:

- nhân viên chủ động đóng tab và xác nhận nếu tab có dữ liệu
- báo giá/hóa đơn liên quan đã được xử lý xong và nhân viên đóng tab
- thanh toán hóa đơn thành công

### BR-ORD-04: Một khách có thể có nhiều nháp

Một khách hàng có thể có nhiều hóa đơn nháp cùng lúc trên cùng máy POS.

Khi cần thêm dữ liệu vào nháp của khách mà khách có nhiều nháp, nhân viên phải chọn nháp cần thêm hoặc tạo nháp mới.

---

## 4. QUY TẮC BÁO GIÁ

### BR-QUOTE-01: Báo giá vẫn lưu trong đơn hàng

Báo giá được lưu trong nhóm dữ liệu đơn hàng để dễ quản lý, tra cứu và mở lại.

Báo giá không phải hóa đơn bán hàng hoàn thành.

Báo giá cũng không phải đơn đặt hàng:

- không giữ hàng
- không tạo vận đơn/giao hàng
- không tạo lệnh sản xuất
- không phát sinh doanh thu, tiền, kho hoặc công nợ

### BR-QUOTE-02: Không phát sinh kho và tiền

Khi tạo báo giá:

- Không trừ kho.
- Không ghi sổ quỹ.
- Không ghi công nợ.
- Không ghi doanh thu.

### BR-QUOTE-03: Mở lại báo giá

Khi sửa báo giá, hệ thống mở báo giá trở lại màn hình POS như một hóa đơn nháp.

Nhân viên được sửa dòng hàng, khách hàng, bảng giá, giá bán và ghi chú như đơn nháp bình thường.

Khi nhân viên bấm **Báo giá** từ nháp mở lại này, hệ thống hỏi:

- **Lưu đè báo giá cũ:** giữ nguyên mã `BG...` và cập nhật nội dung báo giá active.
- **Lưu thành báo giá mới:** sinh mã `BG...` mới, báo giá cũ giữ nguyên.

Mặc định đề xuất **Lưu thành báo giá mới** để tránh mất nội dung báo giá đã gửi cho khách.

### BR-QUOTE-04: Chuyển báo giá thành hóa đơn

Khi khách đồng ý, báo giá được mở lại thành đơn nháp để kiểm tra/sửa lần cuối rồi thanh toán.

Khi mở lại, POS xem nội dung báo giá như một nháp local độc lập. Nhân viên có thể:

- sửa nội dung rồi chọn lưu đè báo giá cũ hoặc lưu thành báo giá mới
- sửa nội dung rồi thanh toán thành hóa đơn `HD...`

Trong MVP, hóa đơn mới có thể giữ `source_quote_id` nếu frontend/backend còn truyền được nguồn báo giá. Nếu không giữ link, hóa đơn vẫn hợp lệ như hóa đơn bán thẳng. Mã `BG...` cũ vẫn nằm trong lịch sử báo giá để tra cứu.

Không có bước đặt hàng/giao hàng trung gian giữa báo giá và hóa đơn trong MVP.

### BR-QUOTE-05: Snapshot báo giá

Khi lưu báo giá, hệ thống lưu snapshot dữ liệu tại thời điểm báo giá, gồm tối thiểu:

- khách hàng hoặc thông tin khách lẻ tại thời điểm báo giá
- mã/tên sản phẩm tại thời điểm báo giá
- đơn vị bán và cách tính bán
- số lượng, kích thước hoặc mét tới nếu có
- đơn giá đã áp dụng
- nguồn giá: giá chung, bảng giá nhóm, fallback hoặc giá sửa tay
- ghi chú dòng và ghi chú đơn
- thành tiền dòng và tổng tiền báo giá

Snapshot giúp báo giá mở lại hoặc in lại đúng nội dung đã gửi, kể cả khi bảng giá hoặc tên sản phẩm thay đổi sau đó.

---

## 5. QUY TẮC HÓA ĐƠN BÁN HÀNG

### BR-INV-01: Hóa đơn bán hàng sinh từ checkout thành công

Hóa đơn bán hàng mã `HD...` chỉ được tạo khi checkout thành công.

Checkout thất bại không được tạo hóa đơn bán hàng dở dang.

### BR-INV-02: Hóa đơn giữ snapshot bán hàng

Hóa đơn bán hàng phải giữ snapshot dòng hàng tương tự báo giá, để lịch sử bán hàng không thay đổi khi danh mục, bảng giá hoặc hồ sơ khách hàng thay đổi sau này.

### BR-INV-03: Hóa đơn có thể giữ liên kết báo giá nguồn

Nếu checkout còn truyền được nguồn báo giá, hóa đơn nên giữ `source_quote_id` để truy vết `BG... -> HD...`.

Nếu nháp báo giá đã được sửa như một nháp local và checkout không truyền `source_quote_id`, hóa đơn vẫn hợp lệ như hóa đơn bán thẳng.

Mã `BG...` không bị mất; báo giá cũ vẫn nằm trong lịch sử báo giá để tra cứu.

### BR-INV-04: Sửa hóa đơn đã chốt tạo chứng từ mới

Hóa đơn đã checkout thành công không bị sửa đè trực tiếp.

Khi nhân viên sửa hóa đơn đã chốt:

- hệ thống mở hóa đơn sang POS như một nháp sửa bằng handoff riêng `invoice-revision`, không dùng lại quote reopen flow
- POS chạy mode `invoice-revision`, tab hiển thị `Sửa HD000123`
- hệ thống tạo một hóa đơn mới dựa trên nội dung đã sửa
- mã mới dùng mã cũ kèm số lần sửa, ví dụ `HD000123.01`, `HD000123.02`
- hóa đơn cũ chuyển sang trạng thái đã hủy với lý do sửa chứng từ
- hóa đơn cũ không bị xóa vật lý để có thể kiểm tra lại lịch sử
- hóa đơn mới giữ liên kết tới hóa đơn cũ gần nhất và mã gốc
- hóa đơn mới lưu lý do sửa bằng `revision_reason_code` và `revision_reason_note`
- sau khi lưu bản sửa thành công, POS đóng tab sửa và mở Bill Preview cho bản mới

Quy tắc này áp dụng chung cho các phiếu/chứng từ có cơ chế sửa sau chốt; mỗi domain sẽ mô tả chi tiết tác động đảo kho, tiền và công nợ tương ứng.

### BR-INV-05: Sửa chứng từ phải đồng bộ dữ liệu liên kết

Khi sửa/hủy hóa đơn đã phát sinh kho, tiền hoặc công nợ, hệ thống không chỉ sửa nội dung hiển thị của hóa đơn.

Toàn bộ dữ liệu liên kết phải được xử lý đồng bộ trong cùng nghiệp vụ:

- hóa đơn cũ chuyển trạng thái đã hủy vì sửa chứng từ
- bút toán kho của hóa đơn cũ được đảo, rồi hóa đơn mới trừ kho lại theo nội dung mới
- phiếu thu/sổ quỹ liên quan được đảo hoặc ghi giao dịch chênh lệch theo quy tắc Finance
- công nợ của hóa đơn cũ được đảo, rồi hóa đơn mới ghi công nợ lại theo nội dung mới
- hóa đơn mới `MaCu.01` ghi lại kho, tiền, công nợ theo nội dung mới
- lịch sử liên kết giữa chứng từ cũ và mới phải đủ để kiểm tra

Không được để trường hợp hóa đơn đã sửa nhưng tồn kho, sổ quỹ hoặc công nợ vẫn đứng theo bản cũ.

Nếu bản sửa làm tăng số khách cần trả, nhân viên chọn thu thêm ngay hoặc ghi thêm vào công nợ.

Nếu bản sửa làm giảm số khách cần trả và khách đã trả dư so với bản mới, hệ thống hỏi hoàn tiền hoặc cấn vào nợ cũ nếu khách còn nợ. MVP không tự tạo số dư trả trước âm.

### BR-INV-05A: Hủy hóa đơn không tạo bản sửa

Khi nhân viên hủy hóa đơn đã chốt mà không tạo bản sửa mới:

- hóa đơn chuyển `status = cancelled`, `cancel_reason_type = user_cancelled`
- hệ thống đảo toàn bộ kho, tiền và công nợ đã phát sinh từ hóa đơn
- bắt buộc chọn lý do hủy nhanh và có thể nhập ghi chú thêm
- hóa đơn đã hủy vẫn xem lại được qua bộ lọc trạng thái **Đã hủy** trong trang Chứng từ

### BR-INV-05B: Lý do sửa/hủy

Sửa hoặc hủy hóa đơn đã chốt phải có lý do.

UI dùng danh sách lý do nhanh, ví dụ:

- Sai giá
- Sai kích thước
- Sai khách
- Khách đổi ý
- Khác

Nhân viên chỉ cần chọn lý do nhanh để thao tác không rườm rà.

Ghi chú thêm không bắt buộc, trừ khi chọn lý do **Khác** thì phải nhập ghi chú ngắn.

Lý do nhanh và ghi chú được lưu trên chứng từ bằng cột riêng để dễ lọc/xem lại, đồng thời ghi vào lịch sử trạng thái để truy vết.

### BR-INV-05C: Thời hạn và quyền sửa/hủy

Nhân viên nội bộ được sửa/hủy hóa đơn trong vòng 10 ngày kể từ thời điểm tạo hóa đơn.

Sau 10 ngày, chỉ quản lý/admin hoặc người có quyền mạnh tương ứng được sửa/hủy.

QC-OMS hiện không có chốt ca/chốt ngày/báo cáo khóa sổ trong MVP. Báo cáo và thông báo là dữ liệu động, sẽ tính lại theo dữ liệu hiện tại sau khi hóa đơn được sửa/hủy.

### BR-INV-06: Khóa mềm khi sửa chứng từ

Khi một nhân viên mở chứng từ đã chốt để sửa, hệ thống nên tạo khóa mềm có thời hạn.

Quy tắc mặc định:

- người mở sửa trước giữ quyền sửa tạm thời
- nếu chứng từ đang được người khác sửa, UI cảnh báo tên người/máy đang giữ khóa và người mở sau chỉ xem
- quản lý hoặc người có quyền vẫn có thể mở nếu khóa đã quá hạn hoặc cần tiếp quản
- backend vẫn kiểm tra version khi lưu để tránh ghi đè dữ liệu mới hơn
- nếu version đã đổi, người lưu sau phải tải lại chứng từ và thao tác lại trên bản mới

Khóa mềm giúp giảm xung đột thao tác, nhưng không thay thế kiểm tra version ở backend.

---

## 6. Acceptance Criteria nghiệp vụ

1. Nháp POS chưa có mã chứng từ chính thức và không phát sinh kho/tiền/công nợ/doanh thu.
2. Nháp trên máy POS này không tự xuất hiện trên máy POS khác.
3. Một khách hàng có thể có nhiều nháp trên cùng máy.
4. Lưu báo giá sinh mã `BG...` và không phát sinh kho/tiền/công nợ/doanh thu.
5. Mở lại báo giá đưa nội dung báo giá trở lại POS như một nháp có thể sửa.
6. Khi lưu báo giá từ nháp mở lại, hệ thống hỏi lưu đè báo giá cũ hoặc lưu thành báo giá mới; mặc định đề xuất lưu thành báo giá mới.
7. Thanh toán nháp mở từ báo giá sinh hóa đơn `HD...`; link về `BG...` là tùy chọn trong MVP.
8. Báo giá và hóa đơn bán hàng đều giữ snapshot dòng hàng tại thời điểm lưu.
9. Sửa hóa đơn đã chốt không sửa đè hóa đơn cũ; hệ thống tạo mã mới dạng `MaCu.01` và giữ hóa đơn cũ ở trạng thái đã hủy để truy vết.
10. Hệ thống không tạo đơn đặt hàng, vận đơn, COD hoặc kênh bán online trong MVP.
11. Sửa/hủy chứng từ phải xử lý đồng bộ kho, tiền, công nợ và lịch sử liên kết.
12. Nhân viên được sửa/hủy hóa đơn trong 10 ngày; sau đó chỉ quản lý/admin hoặc quyền mạnh tương ứng.
13. Khi nhiều người cùng sửa một chứng từ, hệ thống dùng khóa mềm và version check để tránh ghi đè.

---

← [Quay về Sales README](./README.md)
