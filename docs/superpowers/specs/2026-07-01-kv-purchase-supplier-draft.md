# KiotViet Purchase/Supplier Draft for QC-OMS

> Ngày rà: 2026-07-01
> Trạng thái: Draft tham khảo đã được Owner chốt hướng chính; cần chuyển thành SoT khi bắt đầu phase Purchase/Supplier
> Nguồn: KiotViet `Mua hàng`, `Nhà cung cấp`, `Nhập hàng`, `Mua dịch vụ`, `Hóa đơn đầu vào`, `Báo cáo nhà cung cấp`

---

## 1. Mục tiêu

Draft này ghi lại các phần mua hàng/nhà cung cấp trong KiotViet để sau này quyết định QC-OMS có làm hay không, làm ở phase nào, và làm tối giản tới đâu.

Hiện tại QC-OMS đang ưu tiên bán hàng, tồn kho vật lý cuộn/tấm, sổ quỹ và công nợ khách. Owner đã chốt Purchase/Supplier có trong phạm vi dự án, nhưng chưa nằm trong lát cắt POS MVP đang implement.

Quyết định chính:

- Có quản lý nhà cung cấp.
- Có nhập hàng mua thật.
- Có công nợ nhà cung cấp.
- Nhập đúng đơn vị mua vật lý: mua cuộn thì nhập từng cuộn, mua tấm thì nhập tấm/lô tấm; không mua `m2` cho hàng cuộn/tấm.
- Giá vốn từ phiếu nhập phải lưu lại để sau này PriceBook có thể dùng trong công thức gợi ý/tính giá bán theo nhóm hàng.

---

## 2. KiotViet có gì

### 2.1. Nhà cung cấp

KiotViet có:

- Danh sách nhà cung cấp.
- Nhóm nhà cung cấp.
- Bộ lọc tổng mua, nợ hiện tại, trạng thái, loại đối tác.
- Cột: mã NCC, tên NCC, điện thoại, email, địa chỉ, mã số thuế, nợ cần trả hiện tại, tổng mua, trạng thái.
- Chi tiết có thông tin địa chỉ, nhóm NCC, ghi chú, thông tin xuất hóa đơn.

Dữ liệu thực tế trong tài khoản có `43 nhà cung cấp`.

Tổng danh sách đang thấy:

- `Nợ cần trả hiện tại`: khoảng `57,483,058`
- `Tổng mua`: khoảng `1,968,034,063`

Ví dụ cột danh sách: mã NCC, tên NCC, điện thoại, email, nợ cần trả hiện tại, tổng mua.

Kết luận: nhà cung cấp là dữ liệu thật và nằm trong phạm vi QC-OMS. Không đưa vào POS MVP, nhưng không loại khỏi dự án.

### 2.2. Nhập hàng

KiotViet có:

- Trạng thái: Phiếu tạm, Đã nhập hàng, Đã hủy.
- Bộ lọc thời gian, người tạo, số hóa đơn đầu vào, người nhập.
- Cột: mã nhập hàng, thời gian, mã NCC, nhà cung cấp, tổng số lượng, số lượng mặt hàng, tổng tiền hàng, giảm giá, cần trả NCC, tiền đã trả NCC, ghi chú, trạng thái.
- Có liên hệ tới kho hàng và công nợ nhà cung cấp.

Quan sát thêm ngày `01/07/2026`:

- Bộ lọc mặc định `Tháng này` không có phiếu nhập.
- Sau khi bấm `vào đây`, KiotViet đổi khoảng thời gian sang `01/07/2016 - 01/07/2026`.
- Màn hiển thị `626 giao dịch`.
- Tổng `Cần trả NCC` trên danh sách khoảng `2,048,849,460`.
- Các phiếu gần nhất có mã `PN...`, ví dụ `PN000668`, `PN000667`, trạng thái `Đã nhập hàng`.
- Dữ liệu thực tế có nhiều nhà cung cấp như `A Thanh Huế (In bao)`, `Shoper`, `Thiệp cưới Đông Hà`, `toàn led`, `In Offset SG`, `Thịnh Hồng Nguyên`, `Chị giao`.

Form tạo phiếu nhập trong KiotViet có:

- Tìm hàng hóa theo mã hoặc tên.
- Dòng hàng gồm mã hàng, tên hàng, ĐVT, số lượng, đơn giá, giảm giá, thành tiền.
- Thêm sản phẩm từ file Excel.
- Chọn chi nhánh/kho.
- Thời gian nhập.
- Tìm/chọn nhà cung cấp.
- Mã phiếu nhập tự động.
- Mã đặt hàng nhập.
- Trạng thái `Phiếu tạm`.
- Số hóa đơn đầu vào.
- Tổng tiền hàng, giảm giá, cần trả nhà cung cấp.
- Ghi chú.
- Hành động `Lưu tạm` và `Hoàn thành`.

Kết luận: nhập hàng là nghiệp vụ có dữ liệu thật và cần làm ở phase Purchase/Supplier. Không bê nguyên luồng KiotViet vào MVP bán hàng; QC-OMS phải thiết kế theo tồn vật lý cuộn/tấm của xưởng, không copy cách quản lý tổng số lượng/m2 của KiotViet.

### 2.3. Mua dịch vụ

KiotViet có:

- Mua các khoản dịch vụ/chi phí.
- Bộ lọc thời gian, loại chi, trạng thái, người tạo, đối tượng nộp/nhận, công nợ đối tác.
- Cột: mã phiếu, thời gian, loại chi, người nhận, cần thanh toán, đã thanh toán, còn phải trả, ghi chú, trạng thái.
- Có thể liên quan tới sổ quỹ và công nợ đối tác.

Quan sát ngày `01/07/2026`:

- Bộ lọc mặc định `Tháng này` không có kết quả.
- Màn có tổng nhanh: `Cần thanh toán`, `Đã thanh toán`, `Còn phải trả`.
- Đối tượng nộp/nhận có lựa chọn `Tất cả`, `Nhà cung cấp`, `Khác`.
- Công nợ đối tác có lọc `Tất cả`, `Đã thanh toán`, `Thanh toán 1 phần`, `Chưa thanh toán`.
- Datepicker màn này không có nút mở rộng nhanh kiểu `vào đây`; chưa xác nhận được dữ liệu dài hạn trong lượt rà này.

Kết luận: `Mua dịch vụ` giống một biến thể của phiếu chi/công nợ đối tác. Với QC-OMS MVP, chưa cần module riêng nếu Sổ quỹ đã có phiếu chi rõ loại chi, người nhận và tài khoản tiền.

### 2.4. Đặt hàng nhập

KiotViet có màn `Đặt hàng nhập` trước khi nhập hàng thật.

Các trường/lọc chính:

- Mã phiếu đặt hàng nhập.
- Trạng thái: Phiếu tạm, Đã xác nhận NCC, Nhập một phần, trạng thái khác.
- Thời gian.
- Người tạo.
- Người nhận đặt.
- Nhà cung cấp.
- Ngày nhập dự kiến.
- Số ngày chờ.
- Cần trả NCC.

Quan sát ngày `01/07/2026`:

- Bộ lọc mặc định `Tháng này` không có dữ liệu.
- Mở rộng `01/07/2016 - 01/07/2026` có `4` phiếu đặt hàng nhập, tổng khoảng `5,450,000`.
- Ví dụ: `PDN000004`, `PDN000003`, `PDN000002`, `PDN000001`.

Kết luận: nghiệp vụ đặt hàng nhập có tồn tại nhưng rất ít so với `626` phiếu nhập hàng. QC-OMS không nên ưu tiên đặt hàng nhập trong MVP; khi hàng về thì nhập kho vật lý trực tiếp quan trọng hơn.

### 2.5. Trả hàng nhập

KiotViet có màn `Trả hàng nhập`.

Các trường/lọc chính:

- Mã phiếu trả.
- Trạng thái: Phiếu tạm, Đã trả hàng, Đã hủy.
- Thời gian.
- Người tạo.
- Người trả.
- Nhà cung cấp.
- Tổng tiền hàng, giảm giá, NCC cần trả, NCC đã trả.

Quan sát ngày `01/07/2026`:

- Bộ lọc mặc định `Tháng này` không có dữ liệu.
- Mở rộng `01/07/2016 - 01/07/2026` vẫn không có giao dịch.

Kết luận: trả hàng nhập không phải nghiệp vụ đang dùng thường xuyên. QC-OMS nên để sau Purchase/Supplier; trong MVP, xử lý sai lệch tồn bằng sửa/hủy chứng từ, kiểm kho hoặc điều chỉnh tồn theo quy tắc đã chốt.

### 2.6. Hóa đơn đầu vào

KiotViet có màn `Hóa đơn đầu vào` để quản lý hóa đơn đầu vào và tối ưu nhập liệu khi tạo phiếu nhập, phiếu chi.

Quan sát ngày `01/07/2026`:

- Màn hiển thị trạng thái `Chưa có kết nối với Cơ quan Thuế`.
- Có nút `Kết nối ngay`.
- Đây là tính năng thuộc nhóm hóa đơn điện tử/thuế, không phải luồng nhập kho vật lý tối thiểu.

Kết luận: QC-OMS không làm hóa đơn điện tử/VAT/thuế trong scope hiện tại, nên bỏ `Hóa đơn đầu vào` khỏi MVP. Nếu cần lưu số hóa đơn đầu vào, chỉ lưu như trường tham chiếu text trên phiếu nhập, không tích hợp Cơ quan Thuế.

### 2.7. Báo cáo nhà cung cấp

KiotViet có `Báo cáo nhà cung cấp` trong nhóm Phân tích.

Các trường chính:

- Kiểu hiển thị: Biểu đồ hoặc Báo cáo.
- Mối quan tâm: mặc định `Nhập hàng`.
- Thời gian.
- Tìm nhà cung cấp theo mã, tên, số điện thoại.
- Biểu đồ `Top 10 nhà cung cấp nhập hàng nhiều nhất`.

Quan sát ngày `01/07/2026`:

- Bộ lọc mặc định `Tuần này` không có dữ liệu đáng kể.
- Báo cáo này phụ thuộc dữ liệu Purchase/Supplier, không độc lập với module nhập hàng.

Kết luận: chỉ làm báo cáo NCC sau khi Purchase/Supplier được đưa vào Source of Truth. Trong MVP báo cáo tài chính không hiển thị công nợ NCC nếu Purchase chưa làm.

---

## 3. Quyết định cho QC-OMS

### 3.1. Purchase/Supplier có trong dự án, nhưng sau POS MVP

POS MVP hiện tại chưa làm đầy đủ module mua hàng vì:

- Xưởng cần chốt trước cách nhập tồn cuộn/tấm theo vật lý.
- Nhập hàng có thể làm thay đổi tồn, giá vốn, công nợ NCC và sổ quỹ cùng lúc.
- Nếu làm vội theo KiotViet, dễ quay về quản lý tổng m2 thay vì quản lý từng cuộn/tấm đúng mục tiêu QC-OMS.
- KiotViet có hồ sơ NCC, tổng mua/nợ và nhiều phiếu nhập thật, nhưng luồng nhập của QC-OMS cần khác KiotViet ở điểm cốt lõi: phiếu nhập phải tạo tồn vật lý theo cuộn/tấm nếu hàng đó thuộc nhóm quản lý vật lý.
- Purchase/Supplier khi làm phải đi cùng công nợ NCC và giá vốn, nên nên tách thành phase riêng để không làm rối checkout.

### 3.2. Khi làm, nên tách thành 3 phần

1. **Suppliers**: hồ sơ nhà cung cấp.
2. **Purchase Receipts**: phiếu nhập hàng làm tăng tồn kho vật lý.
3. **Supplier Payables**: công nợ cần trả nhà cung cấp và phiếu chi liên quan.

Mua dịch vụ nên đi theo Finance/Cashbook trước, không nhất thiết nằm chung với nhập hàng vật tư.

`Đặt hàng nhập` và `Trả hàng nhập` không nằm trong lát cắt Purchase đầu tiên vì KiotViet đang dùng rất ít/không có dữ liệu phù hợp.

`Hóa đơn đầu vào` và `Báo cáo nhà cung cấp` không làm trước Purchase; `Hóa đơn đầu vào` còn thuộc phạm vi thuế/HĐĐT đã loại khỏi MVP.

---

## 4. Quyết định Owner đã chốt

1. QC-OMS có quản lý nhà cung cấp.
2. Khi nhập cuộn, phải nhập đúng cuộn vật lý mua vào, có khổ/chiều dài và thông tin giá nhập.
3. Khi nhập tấm, phải nhập đúng tấm/lô tấm mua vào, có kích thước/số lượng và thông tin giá nhập.
4. Không nhập mua hàng cuộn/tấm theo `m2`; `m2` chỉ là số quy đổi/tính toán.
5. Có quản lý công nợ nhà cung cấp.
6. Giá vốn từ phiếu nhập phải lưu lại để phục vụ báo cáo và công thức bảng giá sau này.
7. Công thức bảng giá có thể đặt theo từng nhóm hàng.
8. Công thức bảng giá có thể lấy nguồn giá vốn bình quân hoặc giá vốn mới nhất.

Còn cần tự nghiên cứu/đặc tả tiếp khi vào phase Purchase:

- Phân bổ tiền trả NCC theo phiếu nhập cũ nhất hay chọn phiếu cụ thể.
- Công thức giá vốn dùng cho báo cáo lợi nhuận chuẩn có thể cần khác nguồn giá vốn dùng để gợi ý bảng giá.
- Mua dịch vụ đi qua phiếu chi Sổ quỹ hay cần mở rộng công nợ đối tác sau này.

---

## 5. Định hướng Phase Purchase/Supplier

### Suppliers

Thông tin tối thiểu:

- Mã NCC.
- Tên NCC.
- SĐT.
- Địa chỉ.
- Mã số thuế nếu có.
- Ghi chú.
- Trạng thái.

Không cần nhóm NCC trong lát cắt đầu tiên nếu chưa có nghiệp vụ phân nhóm rõ.

Khi Purchase đầy đủ chưa làm xong nhưng Inventory vật lý cần nguồn nhập, có thể lưu nhà cung cấp trên từng cuộn/tấm như metadata tạm. Khi module Purchase chính thức chạy, metadata này phải được đồng bộ/ngược tham chiếu về phiếu nhập nếu có.

### Purchase Receipts

Phiếu nhập tối thiểu:

- Mã phiếu nhập.
- Nhà cung cấp.
- Thời gian nhập.
- Người nhập.
- Kho.
- Dòng hàng/vật tư.
- Số lượng nhập theo đúng đơn vị mua.
- Giá nhập.
- Chi phí khác nếu có.
- Tổng cần trả.
- Đã trả.
- Còn phải trả.
- Trạng thái: Phiếu tạm, Đã nhập, Đã hủy.

Với hàng cuộn/tấm, dòng nhập phải tạo object tồn vật lý tương ứng, không chỉ cộng tổng `m2`.

Quy tắc gợi ý theo loại hàng:

- Hàng thường: nhập số lượng như KiotViet, tăng tồn tổng theo đơn vị tồn chính.
- Hàng cuộn: mỗi cuộn nhập vào phải có object riêng, gồm khổ, chiều dài ban đầu, `m2` ban đầu, số còn lại và trạng thái cuộn.
- Hàng tấm: nhập theo từng tấm hoặc lô tấm cùng kích thước; hệ thống tạo tồn tấm theo số lượng/kích thước thực tế.
- Giá nhập gắn vào object/lô vật lý để làm giá vốn tham khảo/chính thức tùy phương pháp giá vốn sau này.
- Không dùng phiếu nhập để tự sửa tồn tổng cuộn/tấm bằng tay; sửa sai tồn vật lý đi qua kiểm kho/điều chỉnh tồn.

### Supplier Payables

Công nợ NCC tối thiểu:

- Nợ phát sinh từ phiếu nhập chưa trả đủ.
- Phiếu chi trả NCC.
- Phân bổ trả NCC vào phiếu nhập cũ nhất trước hoặc chọn phiếu cụ thể, cần đặc tả khi làm phase này.

### Giá vốn và PriceBook

Giá vốn lưu từ phiếu nhập không chỉ để xem lịch sử mua, mà còn là dữ liệu đầu vào cho:

- báo cáo lợi nhuận khi đã chốt phương pháp giá vốn
- gợi ý giá bán trong bảng giá
- công thức bảng giá theo nhóm hàng, ví dụ `giá vốn * hệ số + chi phí` hoặc công thức riêng theo nhóm hàng

Nguồn giá vốn cho công thức PriceBook có thể chọn:

- `giá vốn bình quân`
- `giá vốn mới nhất`

PriceBook không tự sửa giá bán khi giá vốn thay đổi nếu người dùng chưa bấm cập nhật/lưu công thức. Giá bán đã lưu trong bảng giá vẫn là giá áp dụng chính thức cho POS.

---

## 6. Không đưa vào phạm vi hiện tại

- Trả hàng nhập: không làm trong lát cắt đầu tiên; sau này chỉ xem lại nếu thực tế phát sinh.
- Đặt hàng nhập: không làm trong lát cắt đầu tiên vì dữ liệu KiotViet rất ít.
- Hóa đơn đầu vào điện tử: không làm trong QC-OMS hiện tại.
- Báo cáo nhà cung cấp: chỉ làm sau khi Purchase/Supplier có dữ liệu đủ.
- Chiết khấu thanh toán NCC.
- Kênh bán/đối tác giao hàng trong nhập hàng.
- Nhóm nhà cung cấp phức tạp.
- Mua dịch vụ thành module riêng nếu phiếu chi đã đủ dùng.
