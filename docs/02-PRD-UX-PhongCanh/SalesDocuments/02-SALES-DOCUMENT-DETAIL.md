# 02-SALES-DOCUMENT-DETAIL — Chi tiết chứng từ bán hàng

> **Phase hiện tại:** Readonly detail cho `HD...`/`BG...`; báo giá active mở lại được vào POS draft

---

## 0. Ghi nhận từ KiotViet

Quan sát hóa đơn `HD010985` ngày `30/06/2026`:

- Chi tiết nằm ngay dưới dòng hóa đơn trong danh sách.
- Tab `Thông tin` của KiotViet có khách hàng, mã hóa đơn, trạng thái, người tạo, người bán, ngày bán, kênh bán, bảng giá và chi nhánh. Với hóa đơn QCVL, chip trạng thái chính hiển thị trạng thái thanh toán, không hiển thị lifecycle nội bộ.
- Dòng hàng có mã hàng, tên hàng, số lượng, đơn giá, giá bán và thành tiền.
- Một số dòng in/kích thước thể hiện ngay trong dòng hàng, ví dụ `2.5m x 3.3m x 1`, số lượng tính thành `8.25`.
- Tổng cuối chứng từ gồm tổng tiền hàng, giảm giá hóa đơn, khách cần trả, khách đã trả.
- Hóa đơn có thể `Hoàn thành` nhưng `Khách đã trả = 0`, nghĩa là chi tiết chứng từ phải thể hiện công nợ theo hóa đơn.

Áp dụng cho QCVL:

- Chi tiết chứng từ ưu tiên đọc nhanh ngay trong trang danh sách hoặc trang detail riêng đều được, miễn giữ đủ snapshot.
- Kích thước/m2/mét tới phải là dữ liệu có cấu trúc trong dòng hàng, không chỉ là text trang trí.
- `Bảng giá` và người bán phải lưu snapshot theo chứng từ.
- QCVL không lưu/hiển thị kênh bán trong MVP vì chỉ có bán trực tiếp tại xưởng.

---

## 1. Mục tiêu

Trang chi tiết giúp kiểm tra toàn bộ nội dung chứng từ đã lưu, gồm dữ liệu snapshot, thanh toán, công nợ, trừ kho và lịch sử nếu có.

Hiện tại đã đọc dữ liệu đã có:

- thông tin tổng quan hóa đơn hoặc báo giá
- snapshot dòng hàng
- tổng tiền, khách đã trả, công nợ theo hóa đơn nếu có; báo giá không phát sinh tiền/kho/công nợ
- lịch sử thanh toán đọc từ các phiếu thu đã liên kết với hóa đơn nếu API detail trả `payment_receipts`
- stock movements liên quan nếu Backend trả về
- thao tác mở lại báo giá active vào POS draft local
- tab `Thông tin` và `Lịch sử thanh toán` hiển thị ngay trong inline detail; tab lịch sử thanh toán không gọi API riêng mà dùng dữ liệu đã có trong response detail
- footer chi tiết hiện tại giữ các nút `Hủy`, `Sao chép`, `Sửa`, `Lưu`, `In`; chỉ không làm/không hiển thị `Trả hàng` và `Tạo QR` trong V1
- ghi chú đơn nằm trong ô nhập dùng chung `ManagementDetailNoteInput`/`management-detail-note`; bấm `Lưu` lưu nhanh ghi chú chứng từ và cập nhật lại dòng danh sách

Shared management detail:

- chi tiết chứng từ nằm trong detail row của `ManagementDataTable`;
- detail dùng shared `management-*` shell, tab, `ManagementDetailNoteInput`, detail table và footer action;
- action theo nghiệp vụ chứng từ vẫn khai báo riêng ở SalesDocuments;
- click trong vùng detail không được bubble làm đóng/mở lại row.

Không làm trong V1:

- nút `Trả hàng`
- nút `Tạo QR`
- transaction đảo kho/tiền/công nợ rời rạc ngoài API nghiệp vụ an toàn
- API lịch sử thanh toán riêng cho detail; hiện không cần nếu `payment_receipts` trong detail đã đủ

Đã có ở lát quote print:

- in/xem báo giá mẫu mặc định cho `BG...`

Các phần bên dưới về nghiệp vụ sửa/hủy/in là hướng thiết kế cần API transaction an toàn, không phải cam kết đã hoàn thiện toàn bộ hành vi sâu trong implementation hiện tại.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HD000123                          Hoàn thành        [Readonly detail]        │
│ Khách: KH000123 - Công ty A       Người bán: ...    Thời gian: ...          │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Tổng quan] [Dòng hàng] [Thanh toán & công nợ] [Kho] [Lịch sử]              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tab Tổng quan

Hiển thị:

- Mã chứng từ.
- Loại chứng từ: Báo giá hoặc Hóa đơn.
- Trạng thái.
- Khách hàng snapshot tại thời điểm lưu.
- Người bán: tài khoản tạo/chốt chứng từ. QCVL hiện tại không tách riêng `người tạo` và `người bán`.
- Bảng giá đã áp dụng.
- Chi nhánh không hiển thị trong MVP vì hiện chỉ có một chi nhánh ngầm; chỉ bổ sung nếu sau này thật sự vận hành nhiều chi nhánh/kho.
- Ghi chú đơn có thể sửa trực tiếp trong detail; lưu qua `PATCH /api/v1/sales-documents/{id}` body `{ "note": "..." }`.
- Tổng tiền hàng, giảm giá, khách cần trả, khách đã trả, còn nợ hoặc tiền thừa đã trả lại.

Nếu chứng từ là bản sửa:

- Hiển thị mã chứng từ gốc.
- Hiển thị mã chứng từ liền trước.
- Có liên kết mở chứng từ cũ.

Nếu chứng từ bị hủy:

- Hiển thị lý do hủy.
- Hiển thị người hủy và thời gian hủy.

---

## 4. Tab Dòng hàng

Mỗi dòng hiển thị dữ liệu snapshot tại thời điểm lưu:

- Mã hàng và tên hàng.
- Đơn vị bán.
- Số lượng.
- Kích thước, mét tới hoặc m2 nếu có.
- Số lượng quy đổi tính tiền nếu dòng hàng phát sinh từ kích thước, ví dụ `2.5m x 3.3m x 1 = 8.25m2`.
- Đơn giá đã áp dụng.
- Nguồn giá: giá chung, bảng giá nhóm, fallback hoặc giá sửa tay.
- Thành tiền.
- Ghi chú dòng.

Không tự cập nhật tên hàng, bảng giá hoặc thông tin khách theo dữ liệu hiện tại. Lịch sử phải giữ đúng nội dung đã bán/báo giá.

---

## 5. Tab Thanh toán & công nợ

Hiển thị:

- Khách cần trả.
- Khách đã trả.
- Phương thức thu: tiền mặt, chuyển khoản hoặc kết hợp.
- Tài khoản nhận chuyển khoản nếu có.
- Phiếu thu liên quan trong Sổ quỹ.
- Số còn nợ của hóa đơn nếu có.
- Các lần thu nợ đã phân bổ vào hóa đơn này.

Quy tắc:

- Không sửa trực tiếp thanh toán trong chi tiết hóa đơn.
- Thu thêm nợ thực hiện ở module Công nợ/Sổ quỹ theo quy tắc phân bổ hóa đơn cũ nhất trước.
- Nếu hóa đơn bị sửa/hủy, tác động đảo tiền/công nợ phải được ghi thành lịch sử, không xóa dòng cũ.
- Tab `Lịch sử thanh toán` đọc từ `payment_receipts` trong detail response. Nếu chưa có phiếu thu, không hiển thị tab lịch sử.
- Khi có phiếu thu, cột trạng thái trong lịch sử thanh toán map từ trạng thái phiếu thu: `posted` hiển thị `Đã thanh toán`, `cancelled` hiển thị `Đã hủy`.
- Trạng thái thanh toán hóa đơn dùng chung 3 màu: `Hoàn tất` khi trả đủ dùng `success` xanh như hiện tại; `Thanh toán 1 phần` dùng `warning`; `Chưa thanh toán` dùng `neutral`. Sổ quỹ khi gắn hóa đơn cũng lấy cùng bộ trạng thái này ở chip đầu detail.
- Dữ liệu phiếu thu từ hệ thống cũ/API cũ có thể thiếu ngày, người thu hoặc phương thức. UI phải hiển thị fallback thay vì làm sập detail.
- Nếu phiếu thu thiếu thời gian, dùng thời gian bán của chứng từ bán hàng.
- `created_by` của phiếu thu được xem là người thu tiền/thu ngân, tức user dùng phần mềm ở thời điểm ghi nhận phiếu. Nếu phiếu thu thiếu `created_by`, dùng người bán/user của chứng từ bán hàng làm người thu.

---

## 6. Tab Kho

Hiển thị các phát sinh kho liên quan chứng từ:

- Dòng sản phẩm/vật tư bị trừ.
- Số lượng trừ.
- Đơn vị tồn.
- Cuộn/tấm/tấm lỡ liên quan nếu có.
- Trạng thái trừ kho: đã trừ, trừ âm, đã đảo do hủy/sửa.

Trong MVP, kho được trừ khi lưu/chốt hóa đơn chính thức. Báo giá không trừ kho.

---

## 7. Tab Lịch sử

Ghi lại timeline:

- Tạo báo giá.
- Mở lại báo giá.
- Checkout thành hóa đơn.
- In lại bill.
- Sửa hóa đơn.
- Hủy hóa đơn.
- Phát sinh phiếu thu/công nợ.
- Đảo kho/đảo tiền/công nợ nếu có.

Mỗi dòng lịch sử có thời gian, nhân viên, hành động và ghi chú.

Hiện tại chỉ hiển thị phần lịch sử đã có dữ liệu readonly. Mở lại báo giá đã có ở mức draft local; in/sửa/hủy có nút trong footer, nhưng phần đảo dữ liệu sâu vẫn phải đi qua transaction tương ứng.

---

## 8. Thao tác cần API an toàn

Các thao tác trong mục này phải có rule nghiệp vụ rõ, API transaction an toàn nếu có tác động liên bảng, và kiểm thử đủ.

### 8.1. Mở lại báo giá

- Chỉ áp dụng cho chứng từ loại Báo giá chưa hủy.
- Mở POS với nội dung báo giá như một nháp.
- Khi checkout, tạo hóa đơn `HD...` như checkout POS bình thường.
- Hiện tại không tạo server draft và không tự sửa trạng thái báo giá gốc.

### 8.2. Sửa hóa đơn

- Chỉ áp dụng cho hóa đơn hoàn thành.
- Mở POS với snapshot hóa đơn cũ.
- Nhân viên sửa nội dung và xác nhận lại thanh toán.
- Khi lưu, tạo chứng từ mới theo mã `MaCu.01`.
- Chứng từ cũ chuyển **Đã hủy** với lý do sửa chứng từ.
- Phải chạy trong transaction an toàn để đảo/ghi lại kho, sổ quỹ, công nợ và liên kết chứng từ.

### 8.3. Hủy hóa đơn

- Yêu cầu nhập lý do hủy.
- Hóa đơn không bị xóa vật lý.
- Hệ thống ghi lịch sử hủy.
- Tác động đảo kho, sổ quỹ và công nợ theo Business tương ứng.
- Không cho hủy bằng cách sửa rời từng bảng hoặc xóa dữ liệu cũ.

### 8.4. In lại bill

- Mở Bill Preview với dữ liệu snapshot của chứng từ.
- Không làm thay đổi doanh thu, kho, sổ quỹ hoặc công nợ.
