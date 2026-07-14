# 04-K03D-THANH-TOAN.md — K03-D: BÁO GIÁ / THANH TOÁN / BILL PREVIEW

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. GIAO DIỆN

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 [BÁO GIÁ]                           [THANH TOÁN]                                │
│                              (Màu xám - Phụ)                  (Màu chủ đạo, lớn nhất - F9)                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## II. NÚT [BÁO GIÁ]

| Thuộc tính | Giá trị |
|---|---|
| **Loại** | Tác vụ phụ |
| **Màu** | Xám |
| **Kích thước** | Nhỏ hơn nút THANH TOÁN |
| **Chức năng** | Lưu báo giá trong đơn hàng với mã `BG...`, sau đó xử lý bill báo giá theo cấu hình đã chọn |

### Luồng BÁO GIÁ

```
Nhân viên bấm [BÁO GIÁ]
  → Kiểm tra giỏ hàng hợp lệ
      → Lưu đơn hàng ở trạng thái Báo giá với mã BG...
          → Không trừ kho
          → Không ghi sổ quỹ
          → Không ghi công nợ
          → Không ghi doanh thu
          → Xử lý bill báo giá theo cấu hình đã chọn
```

- Báo giá vẫn lưu trong nhóm đơn hàng để dễ quản lý và tìm lại.
- Có thể tạo báo giá khi chưa chọn khách; backend gán báo giá vào `khachle - Khách lẻ` để Customer Detail của khách lẻ có lịch sử báo giá.
- Báo giá không làm mất hóa đơn nháp hiện tại trừ khi người dùng chủ động đóng/xóa nháp.
- Khi mở lại báo giá để sửa, hệ thống đưa báo giá trở lại POS như một hóa đơn nháp bình thường.
- Khi khách đồng ý, nhân viên mở báo giá thành nháp, sửa nếu cần rồi bấm `[THANH TOÁN]`.
- Nháp mở từ báo giá có thể lưu thành báo giá mới hoặc thanh toán thành hóa đơn. Hóa đơn có thể giữ link về báo giá gốc nếu hệ thống còn truyền được nguồn báo giá; nếu không, hóa đơn vẫn được xem như hóa đơn bán thẳng.
- Quy tắc vòng đời báo giá xem tại [POS-ORDER-LIFECYCLE.md](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md#4-quy-tắc-báo-giá).

---

## III. NÚT [THANH TOÁN]

| Thuộc tính | Giá trị |
|---|---|
| **Loại** | Tác vụ chính |
| **Màu** | Màu chủ đạo (VD: xanh dương / xanh lá đậm) |
| **Kích thước** | Lớn nhất trong khối K03 |
| **Phím tắt** | `F9` (kích hoạt luồng thanh toán trong khối K03 Panel) |

---

### 3 nhóm logic khi bấm THANH TOÁN

| Nhóm | Chi tiết |
|---|---|
| **Tính toán** — Tiền hàng → Chiết khấu → Khách cần trả → Khách đưa → Tiền thừa / Nợ | [→ POS-CHECKOUT.md §2](../../../03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md#2-nhóm-1--tính-toán-thanh-toán) |
| **Hệ thống** — Lưu đơn hàng → Trừ kho vật tư → Ghi nhận dòng tiền nếu có | [→ POS-CHECKOUT.md §3](../../../03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md#3-nhóm-2--xử-lý-hệ-thống) |
| **Tiện ích** — Xử lý bill, in nếu được chọn, hỗ trợ gửi ảnh bill theo cấu hình khách | [→ POS-CHECKOUT.md §4](../../../03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md#4-nhóm-3--tiện-ích) |

---

### Luồng chi tiết bước THANH TOÁN

```text
Nhân viên bấm [THANH TOÁN] (F9) trong khối K03 Panel
  → Hệ thống kiểm tra và kích hoạt các trường nhập liệu trong khu vực "Thanh toán chính" của K03 Panel
      → Hiển thị: Tổng tiền | Chiết khấu | Khách cần trả | Khách thanh toán | Tổng nợ | Thanh toán nợ cũ | Tiền thừa / Còn nợ
          → Nhân viên nhập số tiền khách đưa và chọn phương thức thanh toán
              → Hệ thống tính: Tiền thừa / Còn nợ
                  → Nhân viên bấm [THANH TOÁN] (lần 2, nút ở cuối panel)
                      → Đơn được lưu
                      → Kho vật tư được trừ
                      → Dòng tiền thực thu được ghi vào Sổ Quỹ nếu có
                      → Mở Bill Preview / Print Popup
                          → In nếu bill được chọn in
                          → Hỏi gửi tin nếu khách có cấu hình gửi tin hợp lệ
```

- Mặc định `Khách thanh toán = Khách cần trả`.
- Có nút nhanh `[TRẢ ĐỦ]` để điền đủ tiền và `[NỢ TOÀN BỘ]` để đưa số tiền khách thanh toán về `0`.
- Nếu khách thanh toán nhỏ hơn khách cần trả, phần thiếu được ghi nhận là còn nợ.
- Nếu đã chọn khách, phần còn nợ gắn vào khách đó.
- Nếu chưa chọn khách, phần còn nợ gắn vào `khachle - Khách lẻ`.
- Ghi chú nợ khách lẻ nên có tên/gợi nhớ khách, SĐT nếu biết, lý do nợ và hẹn ngày lấy/trả nếu có.
- Sau này khi xác định được khách, việc chuyển hóa đơn/khoản nợ từ `khachle` sang khách cụ thể cần spec riêng vì đây là thay đổi chủ công nợ/chứng từ.
- Nếu đã chọn khách, dialog hiển thị **Tổng nợ hiện tại** của khách.
- Bên dưới Tổng nợ có ô **Thanh toán nợ cũ**, mặc định `0`.
- Tiền thanh toán hóa đơn hiện tại và tiền thanh toán nợ cũ là hai khoản riêng, không cộng lẫn để tính còn nợ của hóa đơn mới.
- Công nợ được quản lý theo từng hóa đơn còn nợ, không chỉ theo một số tổng.
- Khi nhập tiền **Thanh toán nợ cũ**, hệ thống mặc định phân bổ tiền vào các hóa đơn còn nợ cũ nhất trước.

---

## IV. DIALOG THANH TOÁN

Layout thanh toán trên POS tham khảo cách gom nhóm của KiotViet nhưng chỉ giữ nghiệp vụ QCVL:

- Panel nằm ở cột/phần bên phải khi nhân viên bấm **Thanh toán**, trình bày theo thẻ dọc để nhìn nhanh.
- Nhóm thông tin trên cùng hiển thị khách đang chọn; nếu chưa chọn khách thì là **Khách lẻ**.
- Nhóm dòng tiền hiển thị **Tổng tiền hàng**, **Chiết khấu**, **Khách cần trả** nổi bật, và **Tiền thừa / Còn nợ**.
- Nhóm nhập tiền hiển thị **Khách thanh toán** theo đúng tổng tiền mặt + chuyển khoản đang nhập.
- Nhóm phương thức có **Tiền mặt**, **Chuyển khoản** và **Kết hợp**. Không hiển thị **Thẻ** hoặc **Ví** trong QCVL MVP.
- Khi chọn **Tiền mặt**, UI ưu tiên ô tiền mặt và các nút nhanh như **TRẢ ĐỦ**, **NỢ TOÀN BỘ** hoặc mệnh giá phổ biến nếu màn hình đủ chỗ.
- Khi chọn **Chuyển khoản**, UI ưu tiên ô chuyển khoản và tài khoản ngân hàng nhận tiền. QR/đối soát tự động kiểu KiotViet không thuộc MVP; nếu sau này cần QR thật phải mở spec riêng.
- Khi chọn **Kết hợp**, UI hiển thị cả ô tiền mặt và ô chuyển khoản để nhân viên tự chia tiền; nếu chuyển khoản lớn hơn `0` thì vẫn bắt buộc chọn tài khoản nhận tiền.
- Nếu khách đang có nợ cũ, bên dưới **Khách thanh toán** hiển thị dòng gọn **Tổng nợ cũ** và nút/ô **Trả thêm nợ cũ**. Ô **Thanh toán nợ cũ** mặc định ẩn, chỉ xổ ra khi nhân viên bấm trả thêm nợ cũ.
- Nút **Báo giá** và **Tạo hóa đơn** giữ nguyên tên, vị trí cuối panel và hành vi hiện có của QCVL.

```
┌──────────────────────────────────────────────┐
│ Thanh toán hóa đơn                           │
│ Tổng tiền hàng        [...]                  │
│ Chiết khấu            [...]                  │
│ Khách cần trả         [...]                  │
│ Khách thanh toán      [................]     │
│ [TRẢ ĐỦ] [NỢ TOÀN BỘ]                        │
│ Tổng nợ hiện tại      [...]                  │
│ Thanh toán nợ cũ      [0...............]     │
│ Phương thức           [Tiền mặt ▼]           │
│ Tiền mặt              [................]     │
│ Tài khoản nhận CK     [................▼]    │
│ Chuyển khoản          [................]     │
│ Mã GD/Ghi chú CK      [................]     │
│ Tiền thừa / Còn nợ    [...]                  │
│ Ghi chú nợ            [................]     │
│                         [Bỏ qua] [Xác nhận]  │
└──────────────────────────────────────────────┘
```

- Trường **Ghi chú nợ** chỉ bắt buộc khi chưa chọn khách và còn nợ.
- Trường **Tổng nợ hiện tại** chỉ hiển thị khi đã chọn khách có hồ sơ công nợ.
- Trường **Thanh toán nợ cũ** mặc định `0`; nếu nhập lớn hơn `0`, hệ thống ghi nhận thêm một khoản thu nợ cũ.
- Tiền thanh toán nợ cũ được tự động cấn vào các hóa đơn còn nợ theo thứ tự cũ nhất trước.
- Phương thức thanh toán hiển thị gồm **Tiền mặt**, **Chuyển khoản** và **Kết hợp**. **Thẻ** và **Ví** không hiển thị trong QCVL MVP.
- Nếu chọn **Tiền mặt**, chỉ nhập tiền mặt; hệ thống ghi vào quỹ tiền mặt.
- Nếu chọn **Chuyển khoản**, chỉ nhập tiền chuyển khoản, bắt buộc chọn tài khoản nhận tiền; có thể nhập mã giao dịch/ghi chú chuyển khoản; hệ thống ghi vào đúng quỹ ngân hàng đã chọn.
- Nếu chọn **Kết hợp**, nhập cả tiền mặt và chuyển khoản; tổng thực thu là tổng hai khoản.
- Trong MVP, một lần thanh toán chỉ chọn tối đa một tài khoản nhận chuyển khoản.
- Tiền trả nợ cũ dùng cùng phương thức thanh toán đang chọn trong dialog.
- Nếu có tiền thực thu, hệ thống ghi vào Sổ Quỹ theo từng phương thức thanh toán.
- Nếu không có tiền thực thu, không ghi Sổ Quỹ.
- Tiền thực thu trong dialog gồm tiền thanh toán hóa đơn hiện tại và tiền thanh toán nợ cũ.
- Nếu khách còn nợ tổng và số tiền khách đưa lớn hơn tiền cần trả của hóa đơn mới, phần dư được hỏi nhanh: **Trả lại khách** hoặc **Cấn vào nợ cũ**.
- Nếu chọn **Cấn vào nợ cũ**, hệ thống tự điền phần dư vào **Thanh toán nợ cũ** và phân bổ vào hóa đơn còn nợ cũ nhất trước.
- Nếu chọn **Trả lại khách**, hệ thống hiển thị tiền thừa cần trả và không tạo khoản công nợ âm.
- `Enter` xác nhận khi dữ liệu hợp lệ. `Esc` đóng dialog nếu chưa xác nhận.

---

## V. BILL PREVIEW / PRINT POPUP

- Sau khi báo giá hoặc hóa đơn được lưu thành công, hệ thống mở **Bill Preview / Print Popup**.
- Popup này hiển thị bản xem trước bill giống giao diện in của trình duyệt.
- Nhân viên có thể in hoặc hủy in.
- Bill mặc định luôn có sẵn.
- Có nút `+ Bill` để tạo thêm loại bill/mẫu in khác và lưu thành một tab bill mới.
- Mỗi bill có:
  - Tên gợi nhớ tự đặt.
  - Mẫu nội dung riêng.
  - Máy in mặc định riêng.
  - Trạng thái được chọn hoặc không chọn khi mở Bill Preview.
- Bill báo giá là một loại bill riêng trong danh sách bill, thao tác tương tự bill thanh toán.
- Có thể chọn một hoặc nhiều bill để in/xuất cùng lúc.
- Lựa chọn bill/máy in được lưu lại sau mỗi lần dùng:
  - Nếu đã chọn khách, lưu theo khách đó.
  - Nếu là khách lẻ, dùng cấu hình mặc định chung gần nhất.
- Trạng thái chọn một bill hay nhiều bill được lưu theo lần dùng gần nhất của khách; không mặc định tick cứng Bill mặc định.
- Khi mở Bill Preview, hệ thống tự tick lại các bill đã dùng gần nhất theo khách hiện tại; nếu là khách lẻ thì dùng cấu hình mặc định chung gần nhất.
- Các bill được sắp xếp tự động theo số lần được chọn nhiều nhất, ưu tiên nằm phía bên trái.
- Bill mặc định luôn tồn tại và không bị xóa.
- Nếu dùng Bill mặc định với máy in mặc định, hệ thống không yêu cầu cấu hình thêm.
- Trong Bill Preview, hệ thống xử lý các bill đang được chọn theo cấu hình: có thể in hoặc không in.
- Nếu khách hàng đã bật hỗ trợ gửi bill và có cấu hình phương thức gửi hợp lệ, hệ thống hiện popup hỏi `Bạn có muốn gửi bill cho khách không?`.
- Popup gửi bill chỉ có hai lựa chọn chính: `[Gửi]` và `[Không gửi]`.
- Nếu chọn `[Không gửi]`, popup đóng và không làm thêm thao tác gửi.
- Nếu chọn `[Gửi]`, hệ thống sinh ảnh của các bill đang được chọn và mở đúng nơi gửi theo cấu hình khách hàng.
- Có thể gửi nhiều hơn một bill trong cùng một lần gửi.
- Giai đoạn đầu ưu tiên gửi **ảnh bill**; tin nhắn text không bắt buộc.
- Hệ thống cố gắng copy ảnh bill vào Clipboard để nhân viên dán trực tiếp bằng `Ctrl+V`.
- Nhân viên kiểm tra đúng khách/nhóm/cuộc trò chuyện, bấm `Ctrl+V` để dán ảnh bill, rồi tự bấm gửi.
- Popup luôn hiển thị ảnh bill đã sinh để nhân viên kiểm tra trước khi gửi.
- Nếu mở được đúng nơi gửi và ảnh bill đã được chuẩn bị để dán, nhân viên gửi xong thì thoát bill/kết thúc tiến trình gửi.
- Nếu không mở được đúng nơi gửi hoặc không chuẩn bị được ảnh bill để dán, hệ thống hiển thị thông báo lỗi rõ nguyên nhân nếu xác định được và giữ bill trên màn hình.
- Khi gửi lỗi, nhân viên có thể tự chụp màn hình bill hoặc tự tải ảnh bill rồi mở nơi gửi thủ công.
- Hệ thống không lưu lịch sử gửi bill trong POS.
- Nếu không mở được nơi gửi, hệ thống hiển thị lỗi rõ nguyên nhân nếu xác định được, ví dụ: link sai, không tìm thấy khách/nhóm, người nhận chặn, chưa đăng nhập ứng dụng gửi, hoặc trình duyệt/ứng dụng không cho mở link.
- Kênh gửi bill lấy từ cấu hình gửi tin nhắn trong hồ sơ khách hàng: Zalo cá nhân, nhóm Zalo hoặc Facebook. Nếu chưa kích hoạt ở khách hàng thì không hiện popup gửi.
- Mỗi khách chỉ có một kênh gửi bill mặc định tại một thời điểm. UI có thể dùng dropdown hoặc tick chọn một kênh.
- Lựa chọn bill và máy in được lưu theo khách để lần sau tự gợi ý đúng mẫu bill/máy in khách thường dùng.

> Quy tắc nghiệp vụ đầy đủ xem [POS-BILL-PRINT-MESSAGING.md](../../../03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md).

### V.1. Ghi chú kỹ thuật cho gửi bill

- Sinh ảnh bill từ mẫu bill HTML là khả thi cho giai đoạn đầu.
- Giai đoạn đầu ưu tiên sinh ảnh ở Frontend để triển khai nhanh.
- Nếu ảnh bill sai font, sai layout hoặc hiệu năng kém, cân nhắc chuyển sang render ảnh bill ở Backend trong slice riêng.
- Giai đoạn đầu ưu tiên chạy trên Chrome.
- Mỗi máy POS chỉ cấu hình một kiểu mở Zalo: **Zalo PC** hoặc **Zalo Web**.
- Khi khách dùng kênh Zalo, hệ thống mở theo kiểu Zalo đã cấu hình cho máy POS đó; không tự đổi qua kiểu Zalo khác trong cùng máy.
- Với Facebook, hệ thống mở Messenger/Facebook theo cấu hình khách hàng nếu có cấu hình phù hợp.
- Mở Zalo/Facebook đúng nơi gửi phụ thuộc link/cấu hình, ứng dụng đã cài, trạng thái đăng nhập và quyền mở ứng dụng ngoài của trình duyệt/hệ điều hành.
- Hệ thống chỉ hỗ trợ mở đúng nơi gửi và chuẩn bị nội dung; nhân viên vẫn là người kiểm tra và bấm gửi để tránh gửi nhầm.
- Gửi trực tiếp ngay trong popup POS không dùng Zalo/Facebook app/web không thuộc MVP. Nếu làm về sau, cần tích hợp API chính thức như Zalo OA API hoặc Messenger Platform API và chấp nhận giới hạn về tài khoản, quyền, khách đã follow/tương tác và chính sách nền tảng.

---

## VI. MẪU NỘI DUNG BILL

```
================================
   CỬA HÀNG IN ẢNH VĂN LÂM
   ĐC: ...
   SDT: ...
================================
Ngay: DD/MM/YYYY HH:mm
NV: [Tên nhan vien]
KH: [Tên khach hang]
--------------------------------
1. In bat thuong
   1.2m x 2.5m x 2 = 6.0 m²
   Don gia: 40,000/m²
   Thanh tien: 240,000
...
--------------------------------
TONG M2 IN  : 6.0 m²
TONG TIEN   : 480,000
GIAM TRU    : 0
KHACH TRA   : 500,000
TIEN THUA   : 20,000
================================
   Cam on quy khach!
```

---

← [Quay về Master Map](../01-POS-LAYOUT.md)
