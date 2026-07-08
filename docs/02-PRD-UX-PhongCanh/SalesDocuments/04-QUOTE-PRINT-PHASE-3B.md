# 04-QUOTE-PRINT-PHASE-3B — In/xem báo giá đơn giản

> **Vai trò:** Source of Truth cho in/xem báo giá đơn giản đã merge.
> **Quyết định:** Làm mẫu báo giá mặc định trước, chưa làm hệ thống nhiều mẫu bill phức tạp.

---

## 1. Phạm vi

Phạm vi hiện tại cho báo giá:

- mở xem mẫu báo giá mặc định từ chứng từ `BG...`
- in từ trình duyệt bằng `window.print()` hoặc cơ chế print native tương đương
- dùng dữ liệu snapshot của báo giá, không tự cập nhật theo bảng giá/danh mục hiện tại

Ngoài phạm vi hiện tại:

- export PDF/ảnh ổn định ở backend
- nhiều mẫu báo giá tùy biến
- chọn nhiều bill/mẫu như bill hóa đơn nâng cao
- tự gửi Zalo/Facebook/email
- tracking lịch sử gửi
- ký số, VAT/HĐĐT, mẫu kế toán

---

## 2. Nút thao tác

Tại chi tiết báo giá:

| Nút | Hành vi |
|---|---|
| `Xem/In báo giá` | Mở màn/preview mẫu báo giá mặc định và cho in bằng trình duyệt |

Danh sách báo giá có thể có action nhanh nếu dễ làm, nhưng không bắt buộc. Không thêm nút `Tải/Xuất` trong phạm vi hiện tại để tránh kéo thêm PDF/export.

Nếu cần gửi cho khách, nhân viên dùng print dialog của trình duyệt để in/lưu PDF thủ công hoặc chụp/gửi thủ công bên ngoài hệ thống.

---

## 2.1. Cách triển khai UI đề xuất

Luồng in/xem báo giá ưu tiên frontend-only print view:

- dùng dữ liệu chi tiết báo giá đã có trong Sales Documents
- mở route/modal print riêng, ví dụ `/sales-documents/:id/quote-print` hoặc print panel trong detail
- giao diện print có nút `In` và `Đóng`
- nút `In` gọi print dialog của trình duyệt
- CSS có `@media print` để chỉ in phần báo giá, ẩn nav/sidebar/button

Không cần API render PDF, không cần lưu file, không cần lưu lịch sử in/gửi trong phạm vi hiện tại.

Đề xuất cụ thể cho implement:

| Phần | Quyết định hiện tại |
|---|---|
| Route | Ưu tiên route riêng `/sales-documents/:id/quote-print` để dễ test và print CSS |
| Nguồn dữ liệu | Dùng API chi tiết Sales Documents hiện có; nếu thiếu field snapshot thì bổ sung response, không thêm endpoint PDF |
| Nút từ detail | `Xem/In báo giá`, chỉ hiện với chứng từ loại `quote`/mã `BG...` |
| Nút trong print view | `In`, `Đóng` |
| Điều hướng đóng | Quay về chi tiết báo giá hoặc danh sách chứng từ trước đó |
| Permission | Dùng quyền xem/tạo chứng từ hiện có trong MVP; không thêm permission riêng |
| Mobile | Có thể đọc được, nhưng ưu tiên khổ in A4/desktop |

---

## 3. Nội dung mẫu báo giá mặc định

Mẫu báo giá tối thiểu hiển thị:

- thông tin cửa hàng
- mã báo giá `BG...`
- ngày tạo báo giá
- nhân viên tạo
- khách hàng/khách lẻ snapshot
- dòng hàng: mã/tên, đơn vị, kích thước/m2/mét tới nếu có, số lượng, đơn giá, chiết khấu, thành tiền
- tổng tiền hàng, giảm giá, tổng báo giá
- ghi chú đơn
- dòng chữ mặc định ngắn nếu cần, ví dụ giá trị báo giá chỉ dùng để tham khảo/xác nhận trước khi bán

Không hiển thị công nợ, tiền khách trả, tiền thừa hoặc dữ liệu kho vì báo giá chưa phát sinh các phần này.

### 3.1. Layout mẫu mặc định

Mẫu mặc định nên là một trang A4 đơn giản, không marketing:

```text
TÊN XƯỞNG / CỬA HÀNG
Địa chỉ - SĐT nếu có

                         BÁO GIÁ
Mã: BG000123                                  Ngày: 01/07/2026
Khách hàng: ...
Nhân viên: ...

STT | Mã hàng | Nội dung | ĐVT | SL | Đơn giá | CK | Thành tiền
 1  | F5      | Fomex 5mm ... 2.44 x 1.22 | tấm | 1 | ... | ... | ...

Tổng tiền hàng: ...
Giảm giá: ...
Tổng báo giá: ...

Ghi chú: ...

Giá trị báo giá chỉ dùng để xác nhận nội dung trước khi bán.
```

Không cần logo/ảnh nền/mẫu đẹp trong phạm vi hiện tại. Nếu cần mẫu thương hiệu hơn, mở phase template riêng.

### 3.2. Dòng hàng và kích thước

Frontend phải ưu tiên hiển thị dữ liệu có cấu trúc đã lưu trong snapshot:

| Dữ liệu dòng | Cách hiển thị |
|---|---|
| `area_m2` | Hiển thị kích thước `rộng x cao`, số lượng và diện tích tính tiền nếu có |
| `linear_m` | Hiển thị mét tới và khổ/tấm liên quan nếu snapshot có |
| `sheet` | Hiển thị kích thước tấm và số tấm |
| `quantity` | Hiển thị số lượng và đơn vị bán |
| Giá sửa tay | Không cần badge nổi bật trong bản in, nhưng đơn giá in theo snapshot |
| Chiết khấu dòng | Hiển thị nếu khác 0; nếu không có có thể để trống/0 |

Không ghép kích thước thành text tùy tiện nếu snapshot đã có field cấu trúc. Text mô tả chỉ là fallback khi dữ liệu cũ thiếu field.

---

## 4. Quy tắc dữ liệu

- Mẫu báo giá dùng snapshot tại thời điểm lưu báo giá.
- Báo giá hiện tại không có revision/converted; in đúng snapshot báo giá đang mở.
- In/xem báo giá không làm thay đổi trạng thái báo giá.
- In/xem báo giá không ghi sổ quỹ, công nợ, tồn kho hoặc doanh thu.
- Không ghi log/lịch sử gửi/in bắt buộc trong phạm vi hiện tại.
- Không tự resolve lại giá hiện tại khi in.
- Nếu báo giá có dòng sản phẩm inactive/missing, bản in vẫn hiển thị snapshot đã lưu; cảnh báo xử lý checkout thuộc flow mở lại POS, không thuộc bản in.

---

## 4.1. Backend và database

Phạm vi hiện tại không yêu cầu schema mới.

Backend chỉ cần đảm bảo endpoint đọc chi tiết chứng từ/báo giá trả đủ snapshot để frontend dựng mẫu in:

- thông tin cửa hàng/organization cơ bản nếu frontend chưa có
- mã/ngày/nhân viên/khách hàng snapshot
- dòng hàng và tổng tiền snapshot
- ghi chú

Không thêm endpoint render PDF/ảnh nếu chưa cần.

Nếu API chi tiết hiện chưa trả đủ thông tin cửa hàng, frontend có thể dùng config/app context hiện có. Không tạo bảng cấu hình mới chỉ vì in báo giá mặc định.

Nếu API thiếu field snapshot quan trọng như kích thước/m2/mét tới/chiết khấu dòng, implement được phép mở rộng response readonly từ dữ liệu đã có trong `orders/order_items`; không thay đổi lifecycle báo giá.

---

## 4.2. Print CSS và trạng thái UI

CSS in:

- khổ giấy mặc định A4
- font dễ đọc, không dùng font tải ngoài nếu không cần
- ẩn navigation/sidebar/topbar/button khi in
- giữ bảng dòng hàng không bị vỡ cột cơ bản
- nếu nhiều dòng thì cho phép qua trang, lặp header bảng nếu dễ làm

Trạng thái UI:

| Trạng thái | Hành vi |
|---|---|
| Loading | Hiển thị skeleton/loading ngắn |
| Không phải báo giá | Hiển thị lỗi nhẹ: `Chỉ in báo giá BG... trong màn này` |
| Không tìm thấy báo giá | Hiển thị empty/error và nút quay lại |
| Thiếu thông tin cửa hàng | Vẫn in được, bỏ qua trường thiếu |
| Dữ liệu dòng thiếu field kích thước | In các field snapshot còn lại, không chặn |

---

## 5. Acceptance Criteria

- Từ chi tiết báo giá `BG...`, nhân viên mở được mẫu báo giá mặc định.
- Route print chỉ dùng cho báo giá; hóa đơn `HD...` không bị lẫn phạm vi.
- Mẫu hiển thị đúng snapshot, gồm kích thước/diện tích/mét tới và chiết khấu nếu có.
- In qua trình duyệt được ở mức cơ bản.
- Print CSS ẩn nav/sidebar/button, chỉ in nội dung báo giá.
- Không gọi API render PDF/ảnh và không tạo schema mới.
- Không có cấu hình nhiều mẫu trong phạm vi hiện tại.
- Không tự gửi báo giá cho khách trong phạm vi hiện tại.
- Không tạo stock/cash/debt/revenue/log gửi khi chỉ xem/in báo giá.

## 6. Verification gợi ý cho implement

Local/unit:

- Test component render với quote snapshot có dòng thường.
- Test component render với dòng có `area_m2` hoặc `linear_m`.
- Test route không cho in hóa đơn `HD...` trong phạm vi báo giá.
- Test nút `In` gọi `window.print()` bằng mock.

E2E/smoke:

1. Tạo hoặc dùng báo giá `BG...` có ít nhất một dòng hàng.
2. Mở Sales Documents detail.
3. Bấm `Xem/In báo giá`.
4. Xác nhận route/preview hiện mã báo giá, khách, dòng hàng, tổng tiền.
5. Xác nhận không phát sinh stock/cash/debt/revenue mới.

Cloud smoke không cần kiểm browser print dialog thật; chỉ cần mở preview và xác nhận dữ liệu hiển thị.
