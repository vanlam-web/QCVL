# POS-CHECKOUT — Nghiệp vụ thanh toán

> **Nguồn:** Di chuyển từ `02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md` (Section III)

---

## 1. MỤC ĐÍCH

Khi nhân viên bấm **THANH TOÁN** (`F9`), hệ thống thực thi 3 nhóm nghiệp vụ:

| Nhóm | Chi tiết |
|---|---|
| **Tính toán** | Tiền hàng → Trừ chiết khấu → Khách cần trả → Khách đưa → Tiền thừa / Nợ |
| **Hệ thống** | Lưu đơn hàng → Trừ kho vật tư → Tạo hóa đơn → Ghi nhận dòng tiền phát sinh |
| **Tiện ích** | Xử lý bill theo cấu hình đã chọn: in nếu cần, hỗ trợ gửi ảnh bill nếu khách đã cấu hình gửi tin |

---

## 2. NHÓM 1 — TÍNH TOÁN THANH TOÁN

### BR-CHK-01: Quy trình tính tiền

```
Tiền hàng (từ K02-C)
    ↓
Trừ chiết khấu (F8 — bảng giá / % giảm của đối tác)
    ↓
= Khách cần trả
    ↓
Nhập số tiền khách đưa
    ↓
= Tiền thừa (khách đưa > cần trả)  HOẶC  Nợ gối (khách đưa < cần trả)
```

### BR-CHK-02: Tiền thừa / Nợ gối

| Điều kiện | Kết quả |
|---|---|
| Khách đưa **>** Khách cần trả | `Tiền thừa = Khách đưa − Khách cần trả` |
| Khách đưa **=** Khách cần trả | `Tiền thừa = 0` |
| Khách đưa **<** Khách cần trả | `Nợ gối = Khách cần trả − Khách đưa` |

Mặc định trên POS, `Khách đưa = Khách cần trả`. Nhân viên có thể sửa về số tiền thực trả hoặc chọn nợ toàn bộ.

### BR-CHK-02A: Khách lẻ còn nợ

Nếu chưa chọn khách hàng cụ thể nhưng hóa đơn còn nợ, hệ thống vẫn cho phép hoàn tất thanh toán dưới dạng **Khách lẻ nợ** thuộc khách mặc định `KH000001 - Khách lẻ`.

Điều kiện bắt buộc: nhân viên phải nhập ghi chú nợ để nhận diện lại giao dịch sau này.

Ghi chú nợ nên có tên/gợi nhớ khách, SĐT nếu biết, lý do nợ và hẹn ngày lấy/trả nếu có.

Khoản nợ khách lẻ không tạo bucket `customer_id = null`. Nếu sau này chuyển hóa đơn/khoản nợ từ `KH000001` sang khách cụ thể, cần spec riêng vì đây là thao tác đổi chủ công nợ/chứng từ.

### BR-CHK-02B: Thanh toán nợ cũ trong dialog thanh toán

Khi đã chọn khách hàng, dialog thanh toán hiển thị tổng nợ hiện tại của khách.

Ô **Thanh toán nợ cũ** mặc định là `0`.

Tiền thanh toán hóa đơn hiện tại và tiền thanh toán nợ cũ là hai khoản riêng:

- Tiền thanh toán hóa đơn hiện tại dùng để tính tiền thừa/còn nợ của hóa đơn mới.
- Tiền thanh toán nợ cũ dùng để giảm công nợ đã tồn tại trước đó.

Nếu có nhập tiền thanh toán nợ cũ, hệ thống ghi nhận thêm một giao dịch **Thu tiền khách**.

Công nợ được quản lý theo từng hóa đơn còn nợ. Khi khách trả bớt công nợ một số tiền nhất định, hệ thống mặc định phân bổ tiền trả vào các hóa đơn còn nợ cũ nhất trước.

Tiền thanh toán hóa đơn mới và tiền thanh toán nợ cũ là hai khoản riêng. Hệ thống không tự lấy tiền dư của hóa đơn mới để cấn nợ cũ nếu nhân viên không chọn hoặc không nhập khoản thanh toán nợ cũ.

Nếu khách trả dư so với hóa đơn mới và còn nợ cũ, nhân viên có thể dùng phần dư để cấn nợ tổng. Phần cấn nợ vẫn phân bổ vào các hóa đơn còn nợ cũ nhất trước.

Nếu sau khi cấn hết nợ cũ vẫn còn dư, phần còn lại là tiền thừa trả lại khách.

MVP không lưu phần dư thành khách trả trước.

### BR-CHK-02C: Phương thức thanh toán

POS ghi nhận và UI hiển thị ba kiểu thanh toán nghiệp vụ: **Tiền mặt**, **Chuyển khoản** và **Kết hợp**.

QCVL MVP không hiển thị hoặc ghi nhận **Thẻ** và **Ví**. QR ting ting, bank partner, NAPAS, MoMo/ZaloPay cũng không thuộc MVP.

| Phương thức | Cách nhập | Ghi nhận |
|---|---|---|
| Tiền mặt | Nhập số tiền mặt | Ghi vào quỹ tiền mặt |
| Chuyển khoản | Nhập số tiền chuyển khoản, chọn tài khoản ngân hàng nhận tiền, có thể kèm mã giao dịch/ghi chú | Ghi vào đúng tài khoản ngân hàng |
| Kết hợp | Nhập cả tiền mặt và chuyển khoản vào cùng lần thanh toán | Tách ghi tiền mặt và tài khoản ngân hàng tương ứng |

Tổng thực thu = tiền mặt + chuyển khoản.

Khi chọn **Kết hợp**, hệ thống hiển thị cả ô tiền mặt và ô chuyển khoản để nhân viên tự chia số tiền khách trả.

Tiền trả nợ cũ dùng cùng phương thức thanh toán đang nhập trong dialog. Nếu có cả hai khoản, hệ thống ghi tổng tiền mặt vào quỹ tiền mặt và tổng tiền chuyển khoản vào quỹ ngân hàng.

Trong MVP, một lần thanh toán chỉ có tối đa một tài khoản ngân hàng cho phần chuyển khoản.

### BR-CHK-03: Điều kiện thanh toán thành công

| Điều kiện | Mô tả |
|---|---|
| Giỏ hàng không rỗng | Phải có ít nhất 1 dòng sản phẩm |
| Không có lỗi validation | Toàn bộ dòng hợp lệ (kích thước > 0, SL > 0) |

---

## 3. NHÓM 2 — XỬ LÝ HỆ THỐNG

### BR-CHK-04: Trừ kho vật tư

Khi đơn bán thành công, hệ thống **luôn trừ kho** theo các dòng hàng đã chốt.

| Loại dòng | Hành vi trừ kho |
|---|---|
| **Loại 1 (m²)** | Trừ định mức nguyên liệu tương ứng diện tích: `Tổng m² × Định mức (m²/lần)` |
| **Loại 2 (Cái)** | Trừ số lượng tồn kho |
| **Loại 3 (Combo/BOM)** | Trừ từng vật tư thành phần theo BOM của dòng hàng. BOM có thể lấy từ combo có sẵn hoặc do nhân viên thêm/sửa ngay trong POS cho riêng dòng đó |

Nếu nhân viên chọn **Không lưu — Chỉ trừ kho**, BOM vừa nhập vẫn là định mức của dòng hàng đó để trừ kho khi chốt hóa đơn, nhưng không tạo combo/SKU mới trong danh mục. Nếu chọn **Lưu Combo mới**, hệ thống tạo một combo mới để dùng lại sau.

Giá bán combo độc lập với tổng giá vật tư thành phần. Tổng giá vật tư nếu có chỉ dùng để tham khảo chi phí.

Nếu hệ thống phát hiện thiếu vật tư trên dòng hàng hoặc thành phần BOM, POS chỉ cảnh báo và có thể hiện nút `Khui vật tư` trên dòng đó. Khui là tùy chọn; không bấm khui thì báo giá vẫn lưu được và hóa đơn vẫn theo rule tồn âm/cảnh báo đã chốt.

### BR-CHK-05: Lưu đơn hàng

| Trạng thái | Mô tả |
|---|---|
| Đơn mới | Tạo hóa đơn mới với đầy đủ thông tin |
| Đơn cũ | Cập nhật hóa đơn, giải phóng lock |

### BR-CHK-06: Ghi nhận dòng tiền

Khi có tiền thực thu phát sinh (`khách đưa > 0` hoặc `thanh toán nợ cũ > 0`), hệ thống sinh **Phiếu thu** ghi nhận số tiền thực thu vào Sổ Quỹ theo từng phương thức thanh toán.

Nếu khách chưa trả tiền hoặc chỉ trả một phần, phần còn nợ được lưu theo đơn hàng để theo dõi công nợ; Sổ Quỹ chỉ ghi số tiền thực nhận.

Nếu còn nợ nhưng chưa chọn khách, phần còn nợ được lưu vào `KH000001 - Khách lẻ` dưới dạng **Khách lẻ nợ** kèm ghi chú nợ bắt buộc.

Nếu khách vừa thanh toán hóa đơn hiện tại vừa trả bớt nợ cũ, tổng tiền thực thu được ghi vào Sổ Quỹ theo từng phương thức; phần trả nợ cũ đồng thời tạo giao dịch **Thu tiền khách** để giảm công nợ cũ.

> Sổ Quỹ là bảng ghi nhận luồng tiền vào/ra — xem [CASHBOOK.md](../Finance/CASHBOOK.md).

---

## 4. NHÓM 3 — TIỆN ÍCH

### BR-CHK-07: Bill Preview / Print Popup sau thanh toán

Sau khi thanh toán thành công, hệ thống mở **Bill Preview / Print Popup**.

- Nếu bill được cấu hình in, nhân viên có thể in/xuất bill theo máy in đã chọn.
- Nếu khách hàng có bật cấu hình gửi tin hợp lệ, hệ thống hỗ trợ sinh ảnh bill và mở nơi gửi theo cấu hình khách.
- Giai đoạn đầu ưu tiên gửi ảnh bill; tin nhắn text không bắt buộc.
- Hệ thống không tự gửi thay nhân viên. Nhân viên phải kiểm tra đúng nơi gửi và tự bấm gửi.

> Quy tắc bill, mẫu in, máy in và gửi bill xem [POS-BILL-PRINT-MESSAGING.md](./POS-BILL-PRINT-MESSAGING.md). UX chi tiết xem `02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md`.

---

## 5. LUỒNG TỔNG HỢP

```
Nhân viên bấm [THANH TOÁN] (F9)
    ↓
Dialog thanh toán hiện ra
    → Hiển thị: Tổng tiền | Chiết khấu | Khách cần trả
        → Nhân viên nhập số tiền khách đưa
            → Hệ thống tính: Tiền thừa / Còn nợ
                → Nhân viên bấm [XÁC NHẬN]
                    → Đơn hàng được lưu (BR-CHK-05)
                    → Kho vật tư được trừ (BR-CHK-04)
                    → Dòng tiền thực thu được ghi nhận nếu có (BR-CHK-06)
                    → Mở Bill Preview / Print Popup (BR-CHK-07)
                        → In hoặc hủy in
                        → Hỏi gửi ảnh bill nếu khách có cấu hình gửi tin hợp lệ
```

---

← [Quay về Sales README](./README.md)
