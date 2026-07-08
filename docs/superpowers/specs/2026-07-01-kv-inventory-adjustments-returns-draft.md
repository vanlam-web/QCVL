# KiotViet Inventory Adjustments & Returns Draft for QC-OMS

> Ngày rà: 2026-07-01
> Trạng thái: Draft tham khảo, chưa phải Source of Truth
> Nguồn: KiotViet `Xuất dùng nội bộ`, `Xuất hủy`, `Trả hàng nhập`, `Trả hàng`

---

## 1. Mục tiêu

Draft này ghi lại các luồng làm giảm/tăng lại tồn ngoài bán hàng trong KiotViet, rồi đề xuất phần nào QC-OMS nên giữ, bỏ hoặc để sau.

Nguyên tắc theo trao đổi với Owner:

- Không copy KiotViet 100%.
- Chỉ chốt Source of Truth khi Owner đồng ý.
- Nếu nghiệp vụ xưởng chưa sâu, ưu tiên lược bớt.
- Không kết luận từ bộ lọc mặc định `Tháng này`; cần kiểm tra khoảng thời gian dài hơn.
- Nếu màn KiotViet không có dữ liệu thực tế hoặc rất ít dùng sau khi đã kiểm tra dài hạn, mặc định đề xuất bỏ khỏi MVP.

---

## 2. KiotViet có gì

### 2.1. Xuất dùng nội bộ

KiotViet có:

- Trạng thái: Phiếu tạm, Hoàn thành, Đã hủy.
- Bộ lọc thời gian, người tạo, người xuất, loại xuất, người nhận.
- Cột: mã xuất dùng nội bộ, loại xuất, tổng giá trị, thời gian, chi nhánh, ghi chú, trạng thái.
- Có thể xuất hàng ra khỏi kho cho mục đích nội bộ không gắn đơn bán.
- Đã mở rộng thời gian `01/07/2016 - 01/07/2026`; vẫn không có giao dịch phù hợp.

### 2.2. Xuất hủy

KiotViet có:

- Trạng thái: Phiếu tạm, Hoàn thành, Đã hủy.
- Bộ lọc thời gian, người tạo, người xuất hủy.
- Cột: mã xuất hủy, tổng giá trị hủy, thời gian, người xuất hủy, ghi chú, trạng thái.
- Dùng để giảm tồn khi hàng hỏng/mất/không dùng được.
- Đã mở rộng thời gian `01/07/2016 - 01/07/2026`; vẫn không có giao dịch phù hợp.

### 2.3. Trả hàng nhập

KiotViet có:

- Trạng thái: Phiếu tạm, Đã trả hàng, Đã hủy.
- Cột: mã trả hàng nhập, mã nhập hàng, nhà cung cấp, tổng tiền hàng, NCC cần trả, NCC đã trả, trạng thái.
- Liên quan trực tiếp tới module nhập hàng, nhà cung cấp, công nợ NCC.
- Đã mở rộng thời gian `01/07/2016 - 01/07/2026`; vẫn không có giao dịch phù hợp.

### 2.4. Trả hàng bán

KiotViet có:

- Loại trả hàng: theo hóa đơn, trả nhanh, chuyển hoàn.
- Trạng thái: Đã trả, Đã hủy.
- Cột: mã trả hàng, mã hóa đơn, mã KH, khách hàng, tổng tiền hàng, cần trả khách, đã trả khách.
- Có VAT, kênh bán, thu khác hoàn lại, phí trả hàng.
- Đã mở rộng thời gian `01/07/2016 - 01/07/2026`; vẫn không có giao dịch phù hợp.

---

## 3. Đề xuất cho QC-OMS

### 3.1. Xuất hủy: chỉ giữ nếu thật sự cần, và làm tối giản

Có thể cần một cách ghi nhận vật tư bị bỏ/hỏng/mất ngoài bán hàng, đặc biệt với:

- tấm lỡ dưới ngưỡng `0.3m2` mặc định bỏ
- cuộn/tấm hỏng khi gia công
- vật tư sai, bẩn, rách, không tận dụng được

Đề xuất nếu Owner muốn giữ trong MVP:

- Không cần module lớn giống KiotViet.
- Có thể bắt đầu bằng **phiếu điều chỉnh giảm tồn / phiếu hủy vật tư** trong Inventory.
- Trạng thái tối giản: Hoàn thành, Đã hủy.
- Không cần Phiếu tạm nếu thao tác quá rườm rà.
- Bắt buộc ghi lý do khi hủy vật tư có giá trị đáng kể.

Nếu thực tế xưởng ít dùng:

- Không tạo màn danh sách phiếu riêng.
- Chỉ ghi lịch sử trong chi tiết cuộn/tấm/sản phẩm khi có thao tác hủy hoặc bỏ tấm lỡ.

### 3.2. Xuất dùng nội bộ: để sau hoặc gộp vào điều chỉnh giảm tồn

Xưởng có thể có dùng vật tư nội bộ, nhưng nếu chưa quản trị sâu thì chưa cần module riêng.

Đề xuất:

- MVP không làm riêng `Xuất dùng nội bộ`.
- Nếu cần ghi nhận, dùng cùng form điều chỉnh giảm tồn và chọn lý do `Dùng nội bộ`.
- Sau này nếu phát sinh nhiều loại xuất nội bộ, mới tách module.
- Nếu KiotViet không có dữ liệu thực tế ở màn này, xem như không phải nghiệp vụ QC-OMS hiện tại.
- Đã kiểm tra dài hạn mà vẫn không có dữ liệu, nên mặc định bỏ module riêng khỏi MVP.

### 3.3. Trả hàng nhập: để sau Purchase

Trả hàng nhập chỉ có ý nghĩa khi QC-OMS đã quản lý:

- nhà cung cấp
- phiếu nhập
- công nợ NCC
- hoàn tiền/giảm nợ NCC
- tồn vật lý theo phiếu nhập

Đề xuất:

- Không làm MVP.
- Chỉ quay lại sau khi chốt Purchase Receipts và Supplier Payables.
- Nếu KiotViet không có dữ liệu thực tế ở màn này, tiếp tục bỏ khỏi phạm vi đến khi Owner nêu nhu cầu thật.
- Đã kiểm tra dài hạn mà vẫn không có dữ liệu, nên không ưu tiên đặc tả.

### 3.4. Trả hàng bán: tiếp tục bỏ khỏi MVP

Owner đã chốt QC-OMS không có nghiệp vụ trả hàng trong POS MVP.

Đề xuất giữ:

- Không tạo module trả hàng bán.
- Nếu hóa đơn sai, xử lý bằng cơ chế sửa chứng từ `MaCu.01` và hủy chứng từ cũ.
- Nếu cần hoàn tiền đặc biệt, ghi phiếu chi thủ công với ghi chú, chưa tạo nghiệp vụ trả hàng chuẩn.
- Nếu KiotViet không có dữ liệu thực tế ở màn này, càng củng cố quyết định bỏ trả hàng khỏi MVP.
- Đã kiểm tra dài hạn mà vẫn không có dữ liệu, nên quyết định bỏ khỏi MVP là phù hợp hơn.

---

## 4. Quyết định hiện tại

Owner đã chốt hướng tối giản:

- Không làm các module riêng: Xuất dùng nội bộ, Trả hàng nhập, Trả hàng bán.
- Không làm phiếu hủy nhiều bước nếu thao tác gây rườm rà.
- Với tấm lỡ dưới `0.3m2`, mặc định bỏ.
- Nếu tấm lỡ vẫn tận dụng được, phải có thao tác giữ lại/chỉnh sửa/xóa tấm lỡ để không trừ kho sai.
- Vật tư hỏng ngoài sản xuất ghi lịch sử theo lý do tối giản, không cần module lớn.
- Hóa đơn bán sai xử lý bằng sửa chứng từ `MaCu.01` và hủy chứng từ cũ; nếu có hoàn tiền đặc biệt thì dùng phiếu chi thủ công có ghi chú, không tạo nghiệp vụ trả hàng bán.

---

## 5. Đề xuất SoT khi nâng lên PRD-UX

Khi chuyển draft này vào đặc tả chính, nên dùng mô hình:

- Chỉ ghi lịch sử tự động cho các thao tác hủy/tấm bỏ đã phát sinh từ quản lý cuộn/tấm.
- Chưa tạo màn danh sách phiếu riêng; xem lịch sử trong chi tiết vật tư/cuộn/tấm.
- Lý do chuẩn ban đầu:
  - `tam_lo_bo`
  - `huy_hong`
  - `dung_noi_bo`
  - `khac`
- Chỉ tạo màn danh sách điều chỉnh tồn riêng nếu sau này phát sinh nhiều thao tác cần kiểm tra tập trung.
