# 01a-K01-SEARCH-TABS.md — K01: Tìm kiếm F3 & Đa Tab

> **Thuộc khối:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) — Mục II.1 và II.2
>
> **Trở về:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) | [Master Map](../01-POS-LAYOUT.md)

---

## II.1. Ô Tìm Kiếm Nhanh Hàng Hóa Tổng Lực (F3 Input Search)

**Giao diện:** Cố định bên góc trái. Khi nhấn `F3`, con trỏ chuột lập tức focus vào ô này, bôi đen toàn bộ văn bản cũ để sẵn sàng gõ từ khóa mới.

**Logic tìm kiếm (Search Engine):**

- Hỗ trợ tìm kiếm theo **Tên hàng hóa / dịch vụ** hoặc **Mã hàng hóa**.
- **Mã hàng lấy từ Danh mục hàng hóa.**
- **F3 chỉ tìm theo Mã hàng hoặc Tên hàng hóa/dịch vụ.**
- **Không hỗ trợ QR/barcode scan trong POS.**
- **Không có nút quét mã cạnh ô F3.**
- Hỗ trợ tìm kiếm không dấu. Ví dụ: gõ `bat` vẫn tìm được `Bạt`, gõ `hop den` vẫn tìm được `Hộp đèn`.
- **Không có tìm theo viết tắt tự chế.** Nếu muốn gõ `IB` ra `In bạt`, thì `IB` phải là mã hàng chính thức trong Danh mục hàng hóa.
- **Quy tắc:** Mọi sản phẩm được thêm vào giỏ hàng phải thông qua thao tác chủ động của nhân viên (chọn trong dropdown rồi bấm `Enter`, hoặc click chuột).

**Dropdown Kết quả (Hộp gợi ý xổ xuống):**

- **Vị trí và Hiển thị:** Xuất hiện ngay sát mép dưới của ô nhập liệu F3, có chiều rộng bằng **150%** chiều rộng của ô input để đảm bảo hiển thị đủ text. Nằm nổi lên trên tất cả các khối giao diện khác (Z-index cao). Giới hạn chiều cao tối đa hiển thị **7 dòng** kết quả, nếu nhiều hơn sẽ tự động xuất hiện thanh cuộn dọc (Scrollbar) mượt mà.
- **Không có ảnh sản phẩm:** Không có cột ảnh. Không có placeholder ảnh. Không có icon ảnh.
- **Cấu trúc hiển thị từng dòng kết quả (Layout 4 cột):**
  Mỗi dòng chia làm 4 cột cố định bằng Flexbox/Grid:

  | Cột   | Độ rộng        | Nội dung                         | Định dạng                                                               |
  | ----- | -------------- | -------------------------------- | ----------------------------------------------------------------------- |
  | Cột 1 | 50% — Căn trái | `[Mã hàng] Tên hàng hóa / dịch vụ` | **In đậm** phần từ khóa khớp với tìm kiếm                               |
  | Cột 2 | 12% — Căn giữa | ĐVT                              | Màu xám nhạt (Ví dụ: `m²`, `Cái`, `Cuộn`)                               |
  | Cột 3 | 18% — Căn phải | Tồn hiện tại                     | Số tồn theo ĐVT nếu có quản lý tồn; ngược lại hiển thị `—` (font nhỏ hơn) |
  | Cột 4 | 20% — Căn phải | Giá bán                          | Định dạng phân tách hàng nghìn, màu xanh hoặc đen đậm (Ví dụ: `40,000`) |

- **Quy tắc hiển thị tồn hiện tại:**
  - Hàng vật tư / hàng hóa có quản lý tồn kho: hiển thị số tồn hiện tại theo ĐVT của hàng.
  - Dịch vụ in theo `m²`: không hiển thị tồn → hiển thị `—`.
  - Combo/BOM: không hiển thị tồn → hiển thị `—`.
  - Nếu không hiển thị tồn thì để dấu `—`.

- **Hiệu ứng tương tác trực quan (Hover/Active State):**
  Khi di chuột qua hoặc bấm phím mũi tên `↑`/`↓`, dòng được chọn đổi màu nền (Background) sang **xanh nhạt hoặc xám dịu** để nhân viên biết rõ hàng đang "găm" trước khi ấn `Enter`.
- **Trạng thái trống (Empty State):**
  Nếu gõ từ khóa không có trong hệ thống, dropdown chỉ hiển thị một dòng cố định: `Không tìm thấy hàng hóa phù hợp`. Không cho tạo nhanh ngay tại màn hình bán hàng.
- **Không có footer dropdown:** Không có dòng `+ Thêm mới hàng hóa`. Không có sticky footer. Không có dòng thứ 8 thay thế. Không mở modal/drawer tạo nhanh hàng hóa từ POS.

**Nguyên tắc phạm vi F3:**

- POS chỉ dùng để tìm và chọn hàng hóa/dịch vụ đã tồn tại.
- Tạo mới hàng hóa chỉ thực hiện ở module Danh mục hàng hóa.

---

## II.2. Thanh Tab Đa Hóa Đơn Động (Multitasking Tabs Manager)

**Vai trò:** Giúp nhân viên xử lý đồng thời nhiều đơn hàng khi xưởng bị dồn khách tại quầy.

**Vòng đời của một Tab (Tab Lifecycle):**

**Mở POS lần đầu:**

- Nếu máy không có nháp đang mở, mặc định mở sẵn tab trống **Hóa đơn 1** — đây là tab đầu tiên và đang active.
- Tên tab hiển thị số cụ thể (`Hóa đơn 1`, `Hóa đơn 2`, ...). `[X]` trong tài liệu chỉ là ký hiệu mô tả quy luật tăng số, không hiển thị trên UI.

**Mỗi tab là một hóa đơn nháp độc lập:**

- Mỗi tab có thể đang **chưa chọn khách hàng**.
- Một khách hàng có thể có **nhiều hóa đơn nháp** cùng lúc.
- Mỗi tab lưu riêng:
  - Giỏ hàng (danh sách hàng đã thêm).
  - Khách hàng.
  - Bảng giá / chiết khấu đang áp dụng.
  - Ghi chú đơn hàng.
  - Trạng thái thanh toán nháp nếu có — nếu tab đã nhập thông tin thanh toán tạm thời nhưng chưa chốt, dữ liệu đó thuộc tab hiện tại và không ảnh hưởng tab khác. Chi tiết thanh toán thuộc K03/Checkout, không mở rộng trong file này.

**Khởi tạo tab mới:**

- Bấm nút `[+]` ở cuối dải tab hoặc dùng phím tắt → sinh tab mới theo **số nhỏ nhất đang trống**.
- Ví dụ đang có `Hóa đơn 3`, nhưng `Hóa đơn 1` và `Hóa đơn 2` đã xử lý xong/đã đóng → tab mới quay lại dùng `Hóa đơn 1`.

**Giới hạn số tab đang mở:**

- **Tối đa 10 tab hóa đơn đang mở** cùng lúc.
- Khi đã đủ 10 tab: nút `[+]` chuyển sang trạng thái **disabled** + hiển thị tooltip giải thích: `Đã đạt tối đa 10 hóa đơn đang mở`.
- Không tạo thêm tab thứ 11.

**Giữ hóa đơn nháp theo từng máy bán hàng (Draft Persistence by POS Machine):**

- Trên **cùng một máy bán hàng**, các hóa đơn nháp đang mở phải được giữ lại. Mục đích: nhân viên không mất dữ liệu khi có sự cố gián đoạn phiên.
- POS phải **khôi phục lại các tab hóa đơn nháp chưa hoàn tất của máy đó** khi nhân viên:
  - Reload trang.
  - Tắt phần mềm rồi mở lại.
  - Tắt trình duyệt rồi mở lại.
  - Tắt máy tính rồi mở lại.
- **Hóa đơn nháp chỉ được xóa khỏi tab khi:**
  - Nhân viên bấm `[X]` trên tab và xác nhận xóa, **hoặc**
  - Hóa đơn đó thanh toán thành công.
- **Khi mở POS:**
  - Nếu máy có hóa đơn nháp chưa hoàn tất → khôi phục các tab đó.
  - Nếu không có hóa đơn nháp → tạo mặc định `Hóa đơn 1` trống.
- **Khi thanh toán thành công:**
  - Đóng tab hóa đơn vừa thanh toán.
  - Nếu còn tab khác → tự chuyển sang tab kế bên.
  - Nếu không còn tab nào → tự tạo lại `Hóa đơn 1` trống.
- **Giới hạn tối đa 10 tab hóa đơn đang mở** vẫn áp dụng ngay cả với các tab được khôi phục sau reload/tắt máy. Nếu dữ liệu khôi phục vượt quá 10 → chỉ khôi phục tối đa 10 tab, các tab còn lại không tự động khôi phục trong phiên này.

**Quan hệ hóa đơn nháp giữa nhiều máy POS:**

- Mỗi máy POS hoạt động với **bộ hóa đơn nháp riêng** của máy đó.
- Hóa đơn nháp đang mở trên máy A **không tự xuất hiện** trên máy B.
- Không có luồng `[Nhận xử lý]` nháp từ máy khác trong phạm vi POS hiện tại.
- Máy sản xuất có thể gửi cùng một thông báo file đến nhiều máy POS; mỗi máy xử lý thông báo đó theo các hóa đơn nháp đang có trên chính máy mình.
- Nếu nhập thông báo máy sản xuất vào khách đang có 1 nháp trên máy hiện tại → mặc định thêm vào nháp đó.
- Nếu khách chưa có nháp trên máy hiện tại → tạo nháp mới cho khách.
- Nếu khách có nhiều nháp trên máy hiện tại → hỏi thu ngân chọn nháp nào.

**Ngoại lệ tạo nháp từ đơn hàng đã lưu:**

- Trường hợp một đơn hàng đã lưu cần sửa và được đẩy lại thành nháp sẽ được đặc tả sau ở luồng quản lý đơn hàng.
- Nháp tạo từ đơn hàng đã lưu dùng tên theo dạng `HDxxxx.stt`.
- Các nháp ngoại lệ dạng `HDxxxx.stt` **không tính vào giới hạn 10 tab hóa đơn bán hàng mới**; quy tắc giới hạn riêng sẽ được đặc tả khi làm module đơn hàng.

**Phạm vi tài liệu:** file này chỉ ghi **hành vi người dùng và yêu cầu UX**. Cơ chế lưu trữ cụ thể (RAM, localStorage, IndexedDB, API, Database, v.v.) và cơ chế đồng bộ realtime thuộc tầng Architecture/Backend — không đặc tả trong file PRD này.

**Quy tắc thêm hàng và chuyển tab:**

- F3 thêm hàng vào **tab đang active**.
- Chuyển tab không làm mất dữ liệu của tab khác.
- **Tồn kho là dữ liệu chung**: sau khi một đơn thanh toán thành công, các tab khác khi tìm hàng sẽ thấy tồn mới.

**Trạng thái Chờ (Dirty/Draft State):**

- Nếu Tab có hàng hóa nhưng chưa bấm thanh toán → tên Tab hiển thị thêm dấu chấm nhỏ màu cam `•` để nhắc nhở đơn đang xử lý dở.

**Đóng Tab [X]:**

- Tab trống → Đóng lập tức.
- Tab có dữ liệu dở dang (Dirty) → Bật Popup cảnh báo: *"Đơn hàng này chưa được lưu, bạn có chắc chắn muốn xóa không?"*. Nhân viên bấm Xác nhận mới xóa dữ liệu trong tab.

**Logic điều phối khi tràn dải tab (Horizontal Scroll Navigation):**

Khi tổng chiều rộng các tab vượt quá vùng hiển thị (kể cả vì số lượng nhiều hoặc tên tab dài), hệ thống tự động kích hoạt cơ chế cuộn ngang:

| Thành phần | Vị trí | Chức năng |
|---|---|---|
| Nút `[◀]` | **Đầu trái** dải tab (sát mép cụm tìm kiếm) | Click → cuộn dải tab sang trái, hiện các tab bị che bên trái |
| Nút `[▶]` | **Cuối phải** dải tab (trước cụm tiện ích góc phải) | Click → cuộn dải tab sang phải, hiện các tab bị che bên phải |

**Quy tắc chi tiết:**

- Nút `[◀]` chỉ hiển thị khi còn tab **che bên trái** ngoài vùng nhìn thấy. Nếu đã ở đầu → ẩn hoặc mờ 50% + disabled.
- Nút `[▶]` chỉ hiển thị khi còn tab **che bên phải** ngoài vùng nhìn thấy. Nếu đã ở cuối → ẩn hoặc mờ 50% + disabled.
- Mỗi lần click cuộn **1 tab** (snap-to-tab) để tab đích dừng ở mép trái/mép phải, không cuộn lăn mịn kiểu pixel.
- Hỗ trợ **cuộn bằng bánh xe chuột** khi rê chuột vào dải tab (`wheel → horizontal scroll`).
- Tab **Active luôn tự động cuộn vào vùng nhìn thấy** (auto-scroll into view) khi chuyển tab bằng phím tắt hoặc khi vừa được tạo.
- Vùng hiển thị tab chiếm **chiều rộng co giãn** giữa cụm tìm kiếm (trái) và cụm tiện ích (phải) — không cố định pixel, ưu tiên nút `[+]` luôn hiển thị để mở thêm.

---

← [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
