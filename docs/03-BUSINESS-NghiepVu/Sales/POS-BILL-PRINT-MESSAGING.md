# POS-BILL-PRINT-MESSAGING — Bill, in và gửi bill sau bán hàng

> **Vai trò:** Source of Truth nghiệp vụ cho bill sau khi lưu báo giá hoặc hóa đơn POS.
> **Liên quan:** [POS-CHECKOUT.md](./POS-CHECKOUT.md), [POS-ORDER-LIFECYCLE.md](./POS-ORDER-LIFECYCLE.md)

---

## 1. Mục đích

Bill giúp nhân viên in hoặc gửi lại nội dung báo giá/hóa đơn cho khách sau khi chứng từ đã lưu thành công.

Bill không phải hóa đơn điện tử, không xử lý VAT/thuế và không thay thế chứng từ kế toán thuế.

---

## 2. Quy tắc mở bill

Sau khi lưu báo giá `BG...` hoặc hóa đơn `HD...` thành công, hệ thống mở **Bill Preview / Print Popup**.

Bill được tạo từ snapshot chứng từ đã lưu:

- mã chứng từ
- thời gian tạo/bán
- khách hàng snapshot
- nhân viên tạo/bán
- dòng hàng snapshot
- kích thước, mét tới, m2 nếu có
- số lượng, đơn giá, thành tiền
- ghi chú dòng và ghi chú đơn
- tổng tiền hàng, giảm giá, khách cần trả, khách đã trả, còn nợ hoặc tiền thừa

Không lấy lại tên hàng, giá, thông tin khách hoặc bảng giá hiện tại để render bill cũ.

---

## 3. Mẫu bill

Hệ thống có một **Bill mặc định** ban đầu.

Về sau có màn quản lý mẫu bill riêng vì xưởng có thể dùng nhiều mẫu:

- bill báo giá
- bill hóa đơn bán hàng
- mẫu A4
- mẫu máy in nhiệt
- mẫu nội bộ khác nếu cần

Mỗi mẫu bill có:

- tên gợi nhớ
- loại chứng từ áp dụng: báo giá, hóa đơn hoặc dùng chung
- khổ in/kênh in phù hợp, ví dụ A4 hoặc in nhiệt
- nội dung mẫu
- trạng thái đang dùng hoặc ngưng dùng

Bill mặc định luôn tồn tại. Nếu muốn thay đổi riêng cho một khách, không sửa mất cấu hình chung; hệ thống lưu preference riêng của khách đó.

---

## 4. Lưu lựa chọn bill theo khách

Lựa chọn bill được lưu theo khách hàng.

Khi khách quay lại, hệ thống tự hiểu khách đó thường cần in/gửi mẫu nào.

Quy tắc:

- Một khách có thể chọn một hoặc nhiều bill.
- Nếu khách A sửa lựa chọn từ Bill mặc định sang bill khác, lựa chọn đó chỉ áp dụng cho khách A.
- Nếu khách A chọn nhiều bill, lần sau mở bill của khách A thì hệ thống tự tick lại các bill đã chọn.
- Khách lẻ dùng cấu hình chung gần nhất hoặc Bill mặc định nếu chưa có cấu hình chung.
- Trạng thái chọn bill gần nhất được lưu sau mỗi lần nhân viên in/gửi/xác nhận lựa chọn.

---

## 5. Máy in

Mỗi mẫu bill có thể gợi ý máy in phù hợp, ví dụ:

- mẫu A4 gợi ý máy in A4
- mẫu in nhiệt gợi ý máy in bill

Hệ thống lưu lại máy in dùng gần nhất theo lựa chọn bill/khách nếu trình duyệt hoặc máy POS cho phép.

Ví dụ: khách A thường in bill nhiệt ở máy in bill. Lần sau khách A mở Bill Preview, hệ thống gợi ý lại bill nhiệt và máy in bill.

Trong MVP, in dùng browser print dialog. Hệ thống không in ngầm và không tự vượt qua hộp thoại in của trình duyệt.

---

## 6. Gửi bill cho khách

Mỗi khách chỉ có **một kênh gửi bill mặc định** tại một thời điểm.

Hồ sơ khách cần có:

- công tắc bật/tắt gửi bill
- kênh gửi mặc định
- link/ID mở hội thoại hoặc nhóm
- ghi chú kiểm tra nếu cần

Kênh MVP:

- Zalo cá nhân
- nhóm Zalo
- Facebook/Messenger

UI có thể là dropdown chọn một kênh hoặc danh sách tick chọn một kênh. Không cho bật nhiều kênh gửi mặc định cùng lúc trong MVP.

Nếu khách chưa bật gửi bill, Bill Preview không hỏi gửi.

Nếu khách bật gửi bill nhưng thiếu hoặc sai link/ID, hệ thống cảnh báo và không tự mở nơi gửi.

Sai cấu hình gửi bill không làm fail báo giá/hóa đơn đã lưu.

---

## 7. Cách gửi trong MVP

MVP dùng Frontend render trước.

Luồng đề xuất:

1. Backend lưu báo giá/hóa đơn và snapshot chứng từ.
2. Frontend mở Bill Preview từ snapshot đã lưu.
3. Nhân viên kiểm tra bill, chọn bill cần in/gửi.
4. Nếu in, Frontend gọi browser print dialog.
5. Nếu gửi, Frontend render ảnh từ bill đang xem.
6. Hệ thống cố gắng copy ảnh vào Clipboard.
7. Hệ thống mở Zalo/Facebook/Messenger theo cấu hình khách.
8. Nhân viên kiểm tra đúng khách/nhóm/cuộc trò chuyện, dán ảnh và tự bấm gửi.

Hệ thống chỉ chuẩn bị và điều hướng, không tự gửi thay nhân viên.

---

## 8. Ngoài phạm vi MVP

- Không tự động gửi tin thay nhân viên.
- Không tích hợp Zalo OA API hoặc Messenger Platform trong MVP.
- Không lưu lịch sử đã gửi/đã lỗi gửi bill.
- Không có queue gửi lại bill.
- Không backend render PDF/ảnh trong lát cắt đầu.
- Không driver in riêng, không agent in ngầm.
- Không HĐĐT/VAT/thuế.

Backend render PDF/ảnh chỉ mở sau nếu cần chất lượng đồng nhất, font ổn định hoặc gửi qua integration server-side.

---

## 9. Acceptance Criteria

1. Lưu báo giá/hóa đơn thành công mở Bill Preview.
2. Bill render từ snapshot chứng từ đã lưu.
3. Có Bill mặc định ban đầu.
4. Có thể quản lý nhiều mẫu bill theo loại/kích thước in.
5. Lựa chọn bill được lưu theo khách; khách quay lại tự tick lại bill thường dùng.
6. Một khách có thể lưu nhiều bill thường dùng.
7. Máy in gần nhất được gợi ý theo bill/khách nếu môi trường cho phép.
8. Mỗi khách chỉ có một kênh gửi bill mặc định tại một thời điểm.
9. Gửi bill chỉ hỗ trợ chuẩn bị ảnh, mở nơi gửi và để nhân viên tự gửi.
10. Lỗi gửi/in không rollback chứng từ đã lưu.

---

## 10. Trạng thái triển khai (cập nhật 2026-07-22)

| Mục SoT | Trạng thái | Ghi chú |
|---|---|---|
| §2 Snapshot dòng hàng / tiền / NV | **Có** | Địa chỉ khách: enrich từ master khi mở bill (chưa gắn vào snapshot lúc lưu) |
| §3 Nhiều mẫu A4/K80 + quản lý | **Có** | Structured toggles; chưa HTML+token |
| §4 Preference theo khách | **Có** | Multi-tick `preferred_bill_templates` + primary đang xem — xem [plan](../../superpowers/plans/2026-07-22-customer-multi-bill.md) |
| §5 Gợi ý máy in | **Chưa** | Browser print dialog |
| §6–7 Gửi Zalo/Messenger ảnh | **Chưa** | — |
| Layout A4 gần KV xưởng | **Có** | Xem [plan polish](../../superpowers/plans/2026-07-22-bill-a4-kv-polish.md) |

### Cấu hình cửa hàng liên quan in

- `shop_name`, `shop_address`, `shop_phone`, `logo_data_url`
- `print_place` — địa danh trước dòng ngày cuối bill (vd. `TP. Hồ Chí Minh`)

### Nợ cũ / Tổng nợ trên bill (chỉ hiển thị)

- `Tổng nợ` ≈ `customer.total_debt_amount` (master)
- `Nợ cũ` ≈ `max(0, total_debt_amount − còn lại chứng từ)`
- Không thay thế màn công nợ; không đổi công thức sổ cái

Tham chiếu đối chiếu KV/Sapo/ERPNext/Odoo: [kiotviet-bill-template-reference.md](../../superpowers/plans/2026-07-21-kiotviet-bill-template-reference.md)

---

← [Quay về Sales README](./README.md)
