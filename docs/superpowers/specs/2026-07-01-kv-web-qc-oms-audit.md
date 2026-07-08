# KiotViet Web Audit for QC-OMS — Draft

> Ngày rà: 2026-07-01
> Trạng thái: Draft tham khảo, không phải Source of Truth nghiệp vụ
> Nguồn: giao diện KiotViet đang đăng nhập tại `quangcaoinvanlam.kiotviet.vn`

---

## 1. Mục tiêu

File này ghi lại các màn hình KiotViet có liên quan tới QC-OMS để quyết định phần nào nên đưa vào đặc tả, phần nào chỉ tham khảo, phần nào loại khỏi MVP.

Nguyên tắc:

- KiotViet là nguồn tham khảo thao tác và cách tổ chức dữ liệu, không copy 100%.
- Quyết định cuối cùng của QC-OMS nằm trong Source of Truth đúng tầng: PRD-UX, Business, Database, Backend.
- Mục nào chưa chắc thì để ở draft/backlog, không đẩy thẳng vào spec chính.
- Nếu một màn KiotViet không có dữ liệu, rất ít dữ liệu, hoặc chỉ là chức năng retail chung mà xưởng không dùng, phải kiểm tra khoảng thời gian dài hơn trước khi dùng làm căn cứ lược bỏ.
- Không kết luận chỉ từ bộ lọc mặc định `Tháng này`.
- Nếu đã mở rộng thời gian dài mà vẫn không có dữ liệu, mặc định xếp vào nhóm bỏ khỏi MVP hoặc để sau.
- Chỉ giữ màn ít dữ liệu nếu Owner đã chốt đó là nghiệp vụ lõi của QC-OMS, ví dụ Kiểm kho.

---

## 2. Menu KiotViet đã thấy

Các nhóm menu chính:

- Tổng quan
- Hàng hóa: Danh sách hàng hóa, Thiết lập giá, Kiểm kho, Xuất dùng nội bộ, Xuất hủy
- Mua hàng: Nhà cung cấp, Hóa đơn đầu vào, Nhập hàng, Trả hàng nhập, Mua dịch vụ
- Đơn hàng: Đặt hàng, Hóa đơn, Trả hàng, Đối tác giao hàng, Vận đơn
- Khách hàng: Khách hàng, Khuyến mại, Cửa hàng online trên Zalo
- Nhân viên: Danh sách nhân viên, Lịch làm việc, Bảng chấm công, Bảng lương, Hoa hồng, Thiết lập nhân viên
- Sổ quỹ
- Phân tích/Báo cáo
- Bán online
- Thuế & Kế toán, Hóa đơn điện tử

---

## 3. Phân loại cho QC-OMS

### Làm hoặc đã làm trong MVP

| KiotViet | QC-OMS tương ứng | Trạng thái |
|---|---|---|
| Tổng quan | Overview Dashboard | Đã có PRD-UX tổng quan vận hành |
| Bán hàng | POS | Đã có PRD-UX POS, Business/DB/API đang mở rộng |
| Danh sách hàng hóa | Inventory/Product | Đã có PRD-UX Inventory |
| Thiết lập giá | Price List | Đã có PRD-UX/Business/DB/API nền |
| Kiểm kho | Stocktake | Đã có PRD-UX/Business/DB/API |
| Hóa đơn | Sales Documents | Đã có PRD-UX trang chứng từ |
| Khách hàng | Customer | Đã có PRD-UX trang khách hàng riêng |
| Sổ quỹ | Finance Cashbook | Đã có PRD-UX/Business/DB/API |

### Tham khảo, chưa làm MVP

| KiotViet | Lý do |
|---|---|
| Đặt hàng | Owner đã chốt QC-OMS bán đứt; báo giá không phải đơn đặt hàng |
| Trả hàng | QC-OMS đã chốt chưa có nghiệp vụ trả hàng trong POS MVP |
| Đối tác giao hàng, vận đơn | Owner đã chốt không dùng vận đơn, không bán giao hàng/COD |
| Xuất dùng nội bộ, xuất hủy | Có liên quan kho nhưng chưa phải luồng chính; nên gom vào backlog Inventory |
| Mua hàng/Nhập hàng/Nhà cung cấp | Quan trọng cho kho về sau, nhưng MVP đang ưu tiên bán hàng và tồn hiện có |
| Nhân viên | Chỉ giữ tài khoản/quyền/máy trạm trong System |
| Chấm công/lương/hoa hồng | Không thuộc scope hiện tại |
| Báo cáo phân tích | Làm sau khi dữ liệu lõi ổn định |
| Bán online/Zalo shop/Website bán hàng | Owner đã chốt không bán hàng online |
| Thuế & Kế toán/HĐĐT | Owner chốt bỏ khỏi scope QC-OMS hiện tại |

### Ứng viên bỏ khỏi QC-OMS nếu không có dữ liệu thực tế

| KiotViet | Dấu hiệu quan sát | Đề xuất |
|---|---|---|
| Trả hàng bán | Đã mở rộng `01/07/2016 - 01/07/2026` vẫn không có giao dịch phù hợp; Owner đã chốt POS MVP không có trả hàng | Bỏ khỏi MVP |
| Trả hàng nhập | Đã mở rộng `01/07/2016 - 01/07/2026` vẫn không có giao dịch phù hợp; phụ thuộc Purchase/NCC chưa chốt | Bỏ khỏi MVP, chỉ xét lại sau Purchase |
| Xuất dùng nội bộ | Đã mở rộng `01/07/2016 - 01/07/2026` vẫn không có giao dịch phù hợp; nghiệp vụ xưởng chưa cần module riêng | Không làm riêng; nếu cần thì là lý do điều chỉnh giảm tồn |
| Xuất hủy | Đã mở rộng `01/07/2016 - 01/07/2026` vẫn không có giao dịch phù hợp | Không làm module riêng; chỉ cân nhắc lịch sử hủy vật tư/tấm lỡ nếu Owner cần |
| Mua dịch vụ | Màn tháng hiện tại không có kết quả phù hợp; có thể xử lý bằng phiếu chi Sổ quỹ | Không làm module riêng trong MVP |
| Đặt hàng | Owner chốt không đặt hàng, chỉ bán đứt; báo giá chỉ là bản giá gửi khách | Bỏ khỏi MVP |
| Đối tác giao hàng/Vận đơn | Owner chốt không dùng vận đơn, không bán giao hàng; màn KiotViet có nhiều trường COD/giao hàng | Bỏ khỏi MVP |
| Kênh bán/Bán online/Zalo shop/Website | Không thuộc luồng QC-OMS nội bộ | Bỏ |
| VAT/HĐĐT/Thuế kế toán | Owner chốt không làm trong QC-OMS hiện tại | Bỏ; nếu cần chỉ lưu tên đơn vị/MST/địa chỉ pháp lý như thông tin nội bộ |
| Thương hiệu/thuộc tính retail | Có thể ghi trong tên hàng hoặc nhóm hàng | Không tạo field/module riêng |

Ghi chú: "không có dữ liệu" ở đây là dấu hiệu từ giao diện KiotViet đang xem, không phải kết luận kỹ thuật từ database. Các màn có nút `vào đây để tiếp tục tìm kiếm` đã được kiểm tra bằng khoảng dài `01/07/2016 - 01/07/2026` trước khi xếp vào nhóm bỏ/để sau.

---

## 4. Ghi chú theo màn hình

### 4.0. Tổng quan / Dashboard

KiotViet có:

- Kết quả bán hàng hôm nay: doanh thu, trả hàng, doanh thu thuần.
- Biểu đồ doanh thu theo ngày/giờ/thứ.
- Top 10 hàng bán chạy.
- Top 10 khách mua nhiều nhất.
- Doanh thu theo nhân viên.
- Theo dõi chấm công và link thiết lập chấm công.
- Widget dịch vụ ngoài như thanh toán QR/vay vốn.
- Cảnh báo hoạt động đăng nhập khác thường.
- Hoạt động gần đây với link hóa đơn, ví dụ `HD010985`.

Quyết định QC-OMS:

- Làm Dashboard tổng quan vận hành riêng tại `docs/02-PRD-UX-PhongCanh/Overview/01-DASHBOARD.md`.
- Giữ doanh thu hôm nay, thực thu, công nợ mới, số hóa đơn, top hàng, top khách, doanh thu theo người bán và hoạt động gần đây.
- Có thể thêm cảnh báo tồn âm, công nợ lâu ngày và chứng từ sửa/hủy.
- Không hiển thị trả hàng vì không làm trả hàng bán.
- Không hiển thị chấm công/ca làm/vay vốn/widget marketing dịch vụ ngoài.
- Không hiển thị COD/vận đơn/kênh bán online.
- Số Dashboard phải khớp Reports/Finance/Sales Documents cùng khoảng thời gian.

### 4.1. Sổ quỹ

KiotViet có:

- Quỹ tiền: Tiền mặt, Ngân hàng, Ví điện tử, Tổng quỹ.
- Bộ lọc thời gian, loại chứng từ, loại thu chi, trạng thái, người tạo, nhân viên, người nộp/nhận.
- Bộ lọc công nợ đối tác: tính vào công nợ, không tính vào công nợ, không có công nợ.
- Tổng quan: quỹ đầu kỳ, tổng thu, tổng chi, tồn quỹ.
- Bảng: mã phiếu, thời gian, loại thu chi, người nộp/nhận, giá trị.
- Ngày `01/07/2026`, filter `Tháng này` trống do đầu tháng mới; chọn `Toàn thời gian` trên quỹ tiền mặt có `4,161 phiếu thu chi`.
- Phiếu thu tự động `TTHD010973` gắn hóa đơn `HD010973`, có người tạo/người thu, chi nhánh, phương thức `Tiền mặt`, khách nộp, và bảng phân bổ vào hóa đơn.
- Phiếu chi thủ công `CTM001170` có cờ `Có hạch toán`, người tạo/người chi, đối tượng nhận `Khác`, người nhận kèm SĐT và ghi chú `Xăng xe`.

Quyết định QC-OMS hiện tại:

- MVP chỉ làm Tiền mặt và Ngân hàng; chưa làm Ví điện tử.
- Chuyển khoản phải chọn đúng tài khoản nhận.
- Sổ quỹ có phiếu thu/chi thủ công và phiếu phát sinh từ POS/thu nợ.
- Đối soát cuối ngày theo tiền mặt và từng tài khoản ngân hàng.
- Tìm theo mã phiếu phải mở rộng/bỏ filter thời gian nếu filter hiện tại che kết quả.
- Phiếu thu tự động phải truy vết chứng từ gốc và phân bổ hóa đơn.
- Phiếu thu/chi thủ công cần lưu có/không hạch toán kết quả kinh doanh.

### 4.2. Hóa đơn

KiotViet có:

- Bộ lọc: thời gian, loại hóa đơn, trạng thái hóa đơn, trạng thái giao hàng, đối tác giao hàng, thời gian/khu vực giao hàng, phương thức thanh toán, người tạo, người bán, bảng giá, kênh bán.
- Cột chính: mã hóa đơn, thời gian, mã trả hàng, mã khách hàng, khách hàng, tổng tiền hàng, giảm giá, tổng sau giảm giá, khách đã trả.
- Cột mở rộng nhiều: email, điện thoại, địa chỉ, người bán, người tạo, kênh bán, đối tác giao hàng, phí/COD, trạng thái giao hàng, HĐĐT.
- Thao tác: tạo mới, import/export, in, sửa thông tin giao hàng, hủy hóa đơn, phát hành/chuyển HĐĐT.
- Màn lọc `Tháng này` có thể trống; tìm trực tiếp `HD010985` mở được hóa đơn `30/06/2026 17:08`.
- Chi tiết hóa đơn có khách, trạng thái, người tạo/người bán, ngày bán, kênh bán, bảng giá, chi nhánh, dòng hàng, tổng tiền hàng, giảm giá, khách cần trả, khách đã trả.
- Dòng hàng có kích thước ngay trên chi tiết, ví dụ `2.5m x 3.3m x 1` và số lượng tính tiền `8.25`.

Đề xuất QC-OMS:

- Làm trang Sales Documents tối giản hơn: báo giá, hóa đơn, đã hủy.
- Không làm trả hàng, giao hàng, COD, HĐĐT trong scope hiện tại.
- Có thao tác mở lại báo giá, in lại bill, sửa hóa đơn theo quy tắc `MaCu.01`, hủy hóa đơn.
- Tìm theo mã chứng từ phải bỏ qua/mở rộng filter thời gian nếu filter hiện tại che mất kết quả.
- Dòng hàng kích thước phải lưu có cấu trúc để phục vụ in lại, công nợ, trừ kho và đối soát sản xuất.

### 4.3. Đặt hàng

KiotViet có:

- Trạng thái: phiếu tạm, đang giao hàng, hoàn thành và các trạng thái khác.
- Cột: mã đặt hàng, mã hóa đơn, thời gian, mã khách hàng, khách hàng, khách cần trả, khách đã trả, trạng thái.
- Bộ lọc người nhận đặt, kênh bán, giao hàng.

Đề xuất QC-OMS:

- Không copy nguyên mô hình đặt hàng giao hàng.
- Owner đã chốt QC-OMS không làm đặt hàng, chỉ bán đứt.
- Báo giá `BG...` nếu có chỉ là bản giá gửi khách; không giữ hàng, không trừ kho, không giao hàng, không tạo công nợ/tiền/doanh thu.
- Khi khách đồng ý, mở lại báo giá để checkout thành hóa đơn `HD...`.
- Nếu về sau cần đơn sản xuất/chờ lấy hàng, tách thành module Production/Work Orders, không ép vào Đặt hàng KiotViet.

### 4.3b. Đối tác giao hàng / Vận đơn / Bán online

KiotViet có:

- Đối tác giao hàng như GHN/GHTK, tổng đơn hàng, COD, phí giao hàng và đối soát giao hàng.
- Vận đơn có trạng thái giao hàng, đối tác giao hàng, thời gian tạo/hoàn thành, khu vực giao hàng, COD, mã hóa đơn và khách hàng.
- Bán online/Zalo/Website thuộc nhóm kênh bán riêng.
- `Bán online` là màn đa kênh/TMĐT/MXH: Shopee, Tiktok Shop, Lazada, Tiki, Facebook, Instagram, Zalo OA.
- `Website bán hàng`/KiotVietWeb có dashboard website, thống kê lượt truy cập/người truy cập, chỉnh sửa giao diện, banner, video hướng dẫn, thiết lập ẩn hiện hàng hóa và sắp xếp nhóm/danh mục nổi bật.

Quyết định QC-OMS:

- Owner đã chốt không dùng vận đơn.
- Không bán hàng online.
- Không bán giao hàng/COD.
- Không làm `Đặt hàng` kiểu KiotViet; chỉ có bán đứt qua POS/checkout.
- Không làm website bán hàng, đồng bộ sàn TMĐT, MXH/Zalo OA hoặc quản lý đơn online trong QC-OMS hiện tại.
- Không có kênh bán, trạng thái đồng bộ kênh, tồn online, chỉnh giao diện website, banner website hoặc báo cáo lượt truy cập trong QC-OMS.
- Địa chỉ nhận hàng, đối tác giao hàng, trạng thái giao hàng, COD và kênh bán không nằm trong phạm vi hiện tại.

### 4.3c. Thuế & Kế toán / Hóa đơn điện tử

KiotViet `TaxDeclaration` đang là màn onboarding cho hộ kinh doanh:

- Tiêu đề: `Quản lý thuế và kế toán ngay trong KiotViet`.
- Nhấn mạnh 2 nhóm tính năng: `Sổ kế toán` và `Tờ khai thuế`.
- Mô tả `Sổ kế toán`: tự động ghi nhận thu chi từ giao dịch bán hàng.
- Mô tả `Tờ khai thuế`: tự động tổng hợp dữ liệu, sẵn sàng in nộp mỗi kỳ kê khai.
- Có thông điệp dữ liệu chỉ lưu trong KiotViet và nút `Tạo hồ sơ kê khai thuế`.
- Menu KiotViet cũng có mục `Hóa đơn điện tử`.

Quyết định QC-OMS:

- Không làm hồ sơ kê khai thuế.
- Không làm sổ kế toán thuế.
- Không làm tờ khai thuế.
- Không phát hành, chuyển hoặc quản lý HĐĐT trong QC-OMS hiện tại.
- Không tính VAT/thuế kế toán trên POS, chứng từ bán hàng hoặc báo cáo quản trị.
- Nếu cần lưu tên công ty, mã số thuế, địa chỉ pháp lý của khách/NCC, chỉ xem là thông tin nội bộ để tham khảo/in bill thường, không mở luồng thuế/HĐĐT.

Lý do:

- Owner đã chốt bỏ thuế/HĐĐT khỏi phạm vi QC-OMS hiện tại.
- Luồng vận hành xưởng đang ưu tiên bán đứt, kho vật lý, sổ quỹ, công nợ và báo cáo quản trị.
- Thêm thuế/HĐĐT sẽ kéo theo nghiệp vụ pháp lý/kê khai riêng, không phù hợp mục tiêu thao tác gọn.

### 4.4. Khách hàng

KiotViet có:

- Bộ lọc nhóm khách hàng, ngày tạo, người tạo, loại khách, giới tính, sinh nhật, giao dịch cuối, tổng bán, nợ hiện tại, khu vực giao hàng, trạng thái.
- Cột: mã khách hàng, tên khách hàng, loại khách hàng, điện thoại, nhóm khách, email, Facebook, công ty, mã số thuế, địa chỉ, nợ hiện tại, tổng bán, trạng thái.
- Ngày `01/07/2026`, màn Khách hàng mặc định đang ở `Toàn thời gian`, hiển thị `515 khách hàng`.
- Tổng danh sách đang thấy có `Nợ hiện tại` khoảng `225,542,645`, `Tổng bán` khoảng `4,868,230,320`.
- Tìm trực tiếp `KH000517` mở được chi tiết khách `Chị Hương (Taxi Thành Cổ)`, có nợ hiện tại `1,553,585`.
- Tab thông tin có mã/tên khách, người tạo, ngày tạo `16/06/2026`, nhóm khách, SĐT/email/địa chỉ/ngày sinh/giới tính, thông tin xuất hóa đơn theo KiotViet và ghi chú.
- Tab `Lịch sử bán/trả hàng` có bảng hóa đơn theo mã, thời gian, người bán, tổng cộng, trạng thái; ví dụ `HD010803`.
- Tab `Nợ cần thu từ khách` có mã phiếu, thời gian, loại, giá trị và dư nợ khách hàng; ví dụ phát sinh bán hàng `HD010803` còn nợ `1,553,585`.
- KiotViet còn có dấu hiệu các tab mở rộng như lịch sử đặt hàng, công nợ, lịch sử mua dịch vụ, lịch sử tích điểm.

Quyết định QC-OMS hiện tại:

- Mã khách và tên khách là bắt buộc; mã có thể tự sinh.
- SĐT không bắt buộc; nếu có thì unique.
- Nhóm khách quyết định bảng giá; không gán nhóm thì dùng bảng giá chung.
- Không dùng giới tính/ngày sinh/ảnh khách trong MVP.
- Không làm điểm thưởng, mua dịch vụ, giao hàng/COD sâu hoặc các trường retail trên danh sách chính.
- Trang Customer riêng cần quản lý danh sách, chi tiết, nhóm khách, lịch sử bán và công nợ theo hóa đơn.
- Tìm theo mã khách chính xác nên mở được khách dù filter hiện tại đang che kết quả, tương tự quy tắc đã chốt cho hóa đơn/sổ quỹ.

QC-OMS đã đặc tả tương ứng tại:

- `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
- `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md`

### 4.5. Hàng hóa

KiotViet có:

- Bộ lọc nhóm hàng, tồn kho, kho hàng, dự kiến hết hàng, thời gian tạo, thuộc tính, nhà cung cấp, thương hiệu, vị trí, loại hàng, bán trực tiếp, liên kết kênh bán, trạng thái hàng hóa.
- Cột: mã hàng, tên hàng, nhóm hàng, loại hàng, kích thước, giá bán, giá vốn, tồn kho, khách đặt, thời gian tạo, dự kiến hết hàng, trạng thái.
- Ngày `01/07/2026`, bộ lọc `Hàng đang kinh doanh` có `381 hàng hóa (495 mã hàng)`.
- Có dòng tổng hợp phía trên danh sách và cột `Dự kiến hết hàng`.

Quyết định QC-OMS hiện tại:

- Sản phẩm ngưng bán không xuất hiện trong POS, chỉ thấy trong trang Hàng hóa qua bộ lọc trạng thái.
- Vật tư cuộn/tấm cần quản lý tồn vật lý theo cuộn/tấm, không chỉ tổng m2 như KiotViet.
- Tấm lỡ dưới `0.3m2` mặc định bỏ, có thể tạo/sửa thủ công nếu tận dụng.
- Không tạo field/module riêng cho thương hiệu hoặc kênh bán; nếu cần nhận diện thì ghi trong tên/mã/nhóm hàng.
- Nhà cung cấp/vị trí để sau khi Purchase/Warehouse location được chốt.

### 4.6. Thiết lập giá

KiotViet có:

- Bảng giá chung và nhiều bảng giá khác.
- Cột dạng ngang: mã hàng, tên hàng, tồn kho, giá vốn, giá nhập cuối, bảng giá chung, BG1, BG2...
- Có công thức cập nhật giá hàng loạt.
- Màn `Hàng hóa > Thiết lập giá` mở được tại `#/PriceBook`.
- Bộ lọc bên trái gồm bảng giá, nhóm hàng, tồn kho và điều kiện giá bán.
- Bảng đang thấy `Bảng giá chung` với cột mã hàng, tên hàng, giá vốn, giá nhập cuối, giá bán của bảng đang chọn; ô giá cho nhập trực tiếp.
- Màn đang hiển thị khoảng `496 hàng hóa`, có phân trang, import/export và ẩn hiện cột.

Quyết định QC-OMS hiện tại:

- Bảng giá theo nhóm khách, không trải 5 giá lịch sử ra thành 5 cột.
- Giá mặc định luôn lấy theo bảng giá hiện hành.
- Giá sửa tay lưu lịch sử theo khách + sản phẩm; POS có nút xem 5 giá gần đây.
- Mỗi màn chi tiết chỉ sửa một bảng giá đang chọn để tránh lưới quá rộng.
- Giá `0` là một giá hợp lệ nếu được khai báo; fallback về bảng giá chung chỉ xảy ra khi dòng giá không tồn tại/để trống.

QC-OMS đã đặc tả tương ứng tại:

- `docs/02-PRD-UX-PhongCanh/PriceBook/01-PRICE-LIST.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/02-PRICE-LIST-DETAIL.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-PRICING.md`

### 4.7. Kiểm kho

KiotViet có:

- Phiếu tạm, đã cân bằng kho, đã hủy.
- Cột: mã kiểm kho, thời gian, ngày cân bằng, số lượng thực tế, tổng thực tế, tổng chênh lệch, lệch tăng, lệch giảm, ghi chú, trạng thái.
- Khi mở rộng khoảng `01/07/2016 - 01/07/2026`, có `332 giao dịch`.
- Nhiều phiếu là phiếu tự động khi cập nhật Hàng hóa, ví dụ ghi chú `Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa:<Mã hàng>`.

Kết luận:

- Đây là màn có dữ liệu thật và trùng nghiệp vụ QC-OMS, nên giữ trong MVP.
- Không dùng bộ lọc `Tháng này` để đánh giá mức độ sử dụng của Kiểm kho.

QC-OMS đã đặc tả tương ứng tại:

- `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/STOCKTAKE.md`

### 4.8. Nhà cung cấp / Nhập hàng / Mua dịch vụ

KiotViet có:

- Nhà cung cấp: mã NCC, tên, SĐT, email, địa chỉ, nhóm NCC, mã số thuế, nợ cần trả hiện tại, tổng mua.
- Nhập hàng: phiếu tạm, đã nhập hàng, đã hủy; mã nhập hàng, mã NCC, nhà cung cấp, tổng số lượng, tổng tiền hàng, cần trả NCC, tiền đã trả NCC.
- Mua dịch vụ: mã phiếu, loại chi, người nhận, cần thanh toán, đã thanh toán, còn phải trả.
- Màn Nhà cung cấp có `43 nhà cung cấp`, tổng nợ cần trả khoảng `57,483,058`, tổng mua khoảng `1,968,034,063`.
- Màn Nhập hàng mặc định `Tháng này` trống; sau khi bấm mở rộng tìm kiếm sang `01/07/2016 - 01/07/2026` vẫn không tìm thấy phiếu nhập hàng phù hợp.

Đề xuất QC-OMS:

- Chưa đưa Purchase vào MVP nếu chưa chốt nhập kho vật lý theo cuộn/tấm.
- Khi làm sau này, tách `Suppliers`, `Purchase Receipts` và `Supplier Payables`.
- Mua dịch vụ có thể đi qua phiếu chi Sổ quỹ trước, chưa cần module riêng.
- Nhà cung cấp là dữ liệu thật nên không bỏ dài hạn, nhưng chưa copy luồng nhập hàng KiotViet do không có giao dịch nhập hàng dài hạn trên màn này.
- Nếu cần trước khi làm Purchase đầy đủ, chỉ lưu NCC như metadata nguồn nhập trên từng cuộn/tấm vật lý.
- Draft chi tiết: `docs/superpowers/specs/2026-07-01-kv-purchase-supplier-draft.md`.

### 4.9. Báo cáo

KiotViet có:

- Báo cáo cuối ngày: doanh thu, thực thu, số lượng giao dịch, thu khác, phương thức thanh toán.
- Báo cáo bán hàng: doanh thu theo thời gian, bảng giá, nhân viên, kênh bán.
- Báo cáo tài chính: tổng hợp theo tháng/năm.
- Báo cáo hàng hóa: top sản phẩm doanh thu cao, top sản phẩm bán chạy, lọc theo nhóm hàng/tồn kho.
- Màn `Báo cáo > Cuối ngày` có kiểu hiển thị báo cáo dọc, mối quan tâm `Bán hàng`, lọc thời gian, khách hàng, nhân viên, người tạo, phương thức thanh toán và phương thức bán hàng.
- Báo cáo cuối ngày có các cột/chỉ số như doanh thu, thực thu, số lượng, mã giao dịch, thu khác, làm tròn, phí trả hàng và VAT.
- Ngày `01/07/2026` báo cáo cuối ngày không có dữ liệu do đầu ngày/tháng mới, không dùng làm căn cứ lược bỏ.

Đề xuất QC-OMS:

- Báo cáo/phân tích vẫn cần đầy đủ để quản trị xưởng, nhưng bỏ các chiều không có trong QC-OMS.
- Làm báo cáo cuối ngày trước, gắn với đối soát tiền mặt/tài khoản ngân hàng.
- Giữ các nhóm phân tích: bán hàng, khách hàng, công nợ, hàng hóa/tồn kho, tài chính.
- Bỏ kênh bán, VAT/HĐĐT và thương hiệu/thuộc tính retail.
- Không tạo tab/luồng hóa đơn điện tử trong QC-OMS; nếu cần tên đơn vị/MST/địa chỉ pháp lý thì chỉ là thông tin nội bộ trong hồ sơ khách.
- Thương hiệu nếu cần thì ghi trong tên hàng/mã hàng/nhóm hàng, không tạo field báo cáo riêng.
- Báo cáo hàng hóa phải ưu tiên tồn vật lý cuộn/tấm, không chỉ tổng m2.
- Chưa gọi là báo cáo lợi nhuận đầy đủ nếu chưa chốt giá vốn/nhập hàng/chi phí sản xuất.
- Draft chi tiết: `docs/superpowers/specs/2026-07-01-kv-reporting-draft.md`.

QC-OMS đã đặc tả một phần tại:

- `docs/02-PRD-UX-PhongCanh/Reports/README.md`
- `docs/02-PRD-UX-PhongCanh/Reports/01-END-OF-DAY.md`
- `docs/02-PRD-UX-PhongCanh/Reports/02-SALES-REPORT.md`
- `docs/02-PRD-UX-PhongCanh/Reports/03-DEBT-REPORT.md`
- `docs/02-PRD-UX-PhongCanh/Reports/04-INVENTORY-REPORT.md`
- `docs/02-PRD-UX-PhongCanh/Reports/05-FINANCE-REPORT.md`

### 4.10. Xuất dùng nội bộ / Xuất hủy / Trả hàng

KiotViet có:

- Xuất dùng nội bộ: phiếu tạm, hoàn thành, đã hủy; loại xuất, người nhận, tổng giá trị.
- Xuất hủy: phiếu tạm, hoàn thành, đã hủy; tổng giá trị hủy, người xuất hủy, ghi chú.
- Trả hàng nhập: mã trả hàng nhập, mã nhập hàng, nhà cung cấp, NCC cần trả/NCC đã trả.
- Trả hàng bán: trả theo hóa đơn/trả nhanh/chuyển hoàn, cần trả khách/đã trả khách.
- Các màn Xuất dùng nội bộ, Xuất hủy, Trả hàng nhập, Trả hàng bán đều đã kiểm tra dài hạn `01/07/2016 - 01/07/2026`; kết quả vẫn không có giao dịch phù hợp.

Đề xuất QC-OMS:

- Xuất hủy nên giữ ở mức tối giản dưới dạng điều chỉnh giảm tồn/hủy vật tư.
- Xuất dùng nội bộ chưa cần module riêng; nếu cần thì dùng lý do `Dùng nội bộ` trong điều chỉnh giảm tồn.
- Trả hàng nhập để sau Purchase/Supplier.
- Trả hàng bán tiếp tục không thuộc MVP; hóa đơn sai xử lý bằng sửa chứng từ `MaCu.01`.
- PRD-UX đã nâng phần điều chỉnh/hủy vật tư tối giản: `docs/02-PRD-UX-PhongCanh/Inventory/05-INVENTORY-ADJUSTMENTS.md`.
- Draft tham khảo phần KiotViet: `docs/superpowers/specs/2026-07-01-kv-inventory-adjustments-returns-draft.md`.

### 4.11. Nguyên tắc lược bỏ theo dữ liệu KiotViet

Khi KiotViet có một màn nhưng tài khoản thực tế không có dữ liệu đáng kể sau khi đã kiểm tra thời gian dài, QC-OMS không mặc định làm theo.

Áp dụng hiện tại:

- Giữ chắc: sản phẩm, khách hàng, bảng giá, POS, hóa đơn/chứng từ, sổ quỹ, công nợ, tồn kho/cuộn/tấm, báo cáo quản trị.
- Giữ tối giản: kiểm kho, hủy vật tư/điều chỉnh giảm tồn, báo cáo cuối ngày.
- Bỏ khỏi scope hiện tại: đặt hàng KiotViet, trả hàng bán, trả hàng nhập, vận đơn/COD, bán giao hàng, VAT/HĐĐT, kênh bán online, thương hiệu retail, mua dịch vụ riêng, chấm công/lương/hoa hồng.
- Để sau: nhà cung cấp/nhập hàng/công nợ NCC, nếu sau này cần quản lý nhập kho và giá vốn chặt hơn.
- Đã có PRD-UX nền cho tài khoản/quyền/máy trạm: `docs/02-PRD-UX-PhongCanh/System/01-USERS-PERMISSIONS.md`.

### 4.12. Thiết lập hệ thống

KiotViet `Settings` có các nhóm:

- Quản lý: Hàng hóa, Mua hàng, Đơn hàng, Khách hàng, Sổ quỹ, Thuế & Kế toán, Hóa đơn điện tử, Mẫu in.
- Tiện ích: Giao hàng, Thanh toán, Gửi SMS/Zalo.
- Cửa hàng: Thông tin cửa hàng, Quản lý tiền tệ, Quản lý người dùng, Quản lý chi nhánh, Bảo mật.
- Dữ liệu: Khóa sổ, Lịch sử thao tác, Xóa dữ liệu gian hàng.
- Thiết bị: Cân điện tử.

Một số chi tiết đã thấy:

- `Thông tin cửa hàng` có tên cửa hàng, điện thoại, quốc gia, địa chỉ, địa chỉ truy cập và hạn sử dụng.
- `Sổ quỹ` quản lý tài khoản ngân hàng/ví điện tử; tài khoản KiotViet đang có 4 tài khoản ngân hàng và 0 ví điện tử.
- `Thanh toán` là trang đăng ký thông báo thanh toán QR qua ngân hàng/NAPAS và ví MoMo/ZaloPay; các mục đang chưa đăng ký/chưa kết nối.
- `Quản lý tiền tệ` có tiền mặc định, ngoại tệ/tỷ giá, định dạng thập phân và lịch sử tỷ giá.
- `Quản lý người dùng` có danh sách tài khoản, vai trò và trạng thái.
- `Quản lý chi nhánh` đang có `Chi nhánh trung tâm`.
- `Bảo mật` có xác thực khi xuất file và xác thực 2 lớp cho nhân viên.
- `Quản lý người dùng` có `Tài khoản người dùng`, `Quản lý vai trò`, cột tên hiển thị, tên đăng nhập, điện thoại, vai trò, trạng thái và gợi ý quyền mặc định theo vai trò.
- `Gửi SMS, Zalo` có mẫu tin và thiết lập kết nối SMS/Zalo.
- `Mẫu in` có các nhóm mẫu đặt hàng, hóa đơn, giao hàng, trả hàng, đổi trả hàng, đặt hàng nhập, nhập hàng, trả hàng nhập, chuyển hàng, phiếu thu, phiếu chi và bình luận; đang thấy mẫu `Báo giá chưa thế - A4` với thao tác xem trước.
- `Hàng hóa` trong Settings có mã vạch, tự động gợi ý thông tin, đơn vị tính, thuộc tính, nhóm hàng, thương hiệu, vị trí, phương pháp tính giá vốn, bảo hành/bảo trì, sản xuất hàng hóa và phân quyền theo nhóm hàng.
- `Mua hàng` có thiết lập nhà cung cấp theo chi nhánh, đặt hàng nhập, chi phí nhập hàng và mua dịch vụ.
- `Đơn hàng` có đặt hàng, giao dịch khi hết tồn, in báo giá, xác nhận trước khi hoàn thành, giới hạn trả hàng, khóa thay đổi thời gian giao dịch, chặn sửa HĐĐT và thu khác.
- `Khách hàng` có khách theo chi nhánh/người phụ trách, khách đồng thời là NCC, cảnh báo công nợ, trường bắt buộc, tích điểm, khuyến mại, voucher và coupon.
- KiotViet có màn `Lịch xóa`/`Xóa dữ liệu gian hàng`, gồm lựa chọn xóa toàn bộ dữ liệu hoặc một số nhóm dữ liệu.
- `Lịch sử thao tác` theo dõi thao tác nhân viên, có lọc nhân viên/tính năng/thời gian và ghi chi tiết các việc như tạo hóa đơn, tạo phiếu thu/chi, nhập hàng, xuất file công nợ.
- `Khóa sổ` chặn chỉnh sửa giao dịch trước ngày khóa sổ hoặc đổi ngày giao dịch về trước thời điểm khóa.
- `Xóa dữ liệu gian hàng` cho đặt lịch xóa dữ liệu cũ và nhận thông báo khi hoàn tất; popup có tab `Lịch xóa`, `Lịch sử xóa`, trạng thái chưa có lịch sắp tới và nút `Thêm lịch`.
- `Cân điện tử` là thiết lập thiết bị hỗ trợ bán hàng, nhập hàng và chuyển hàng theo cân.
- `Thông tin cửa hàng` còn có ảnh đại diện/logo, địa chỉ truy cập KiotViet và hạn sử dụng tài khoản.
- `Quản lý chi nhánh` có tên chi nhánh, địa chỉ, điện thoại, số người dùng, múi giờ, trạng thái và gợi ý thiết lập địa chỉ lấy hàng.

Quyết định QC-OMS:

- Giữ Settings ở mức tối giản, chỉ hiện các cấu hình thật sự dùng trong QC-OMS.
- Giữ: thông tin cửa hàng/xưởng, người dùng/quyền, chi nhánh nền, bảo mật cơ bản, tài khoản ngân hàng/tài khoản quỹ, mẫu bill thường, đơn vị tính/nhóm hàng/cấu hình hàng hóa liên quan Inventory/PriceBook/BOM.
- Thông tin cửa hàng chỉ giữ tên, SĐT, địa chỉ và logo nếu cần cho bill/báo cáo; không cần URL/hạn dùng kiểu KiotViet trong Settings vận hành.
- Chi nhánh MVP chỉ là một chi nhánh ngầm để phòng hờ dữ liệu; UI không cần hiện `Chi nhánh trung tâm`, bộ chọn chi nhánh hoặc tab quản lý chi nhánh. Chưa làm chuyển hàng/liên chi nhánh hoặc địa chỉ lấy hàng phức tạp.
- Thiết lập hàng hóa được đơn giản hóa: giữ đơn vị tính, nhóm hàng, giá vốn tham khảo và hướng BOM/định mức riêng của QC-OMS; không copy nguyên các toggle KiotViet.
- Sổ quỹ chỉ dùng tiền mặt và tài khoản ngân hàng; chưa làm ví điện tử.
- Chuyển khoản trong POS/thu nợ chỉ ghi vào tài khoản ngân hàng đã khai báo, không cần kết nối QR partner.
- Mẫu in giữ cho bill thường; không liên quan HĐĐT.
- Mẫu in scope hiện tại chỉ gồm báo giá, hóa đơn/bill bán hàng, phiếu thu và phiếu chi; không làm mẫu đặt hàng/giao hàng/trả hàng/chuyển hàng/nhập hàng trong MVP.
- Giữ lịch sử thao tác/audit log, nhưng không cho sửa/xóa log từ UI thường.
- Vai trò/preset nếu có chỉ dùng để tick quyền nhanh; nguồn authorization vẫn là permission cụ thể.
- Bảo mật giữ mức nhẹ: có thể xác thực lại khi xuất file nhạy cảm và 2FA cho tài khoản quản trị/thiết bị lạ nếu triển khai được.
- Không làm giao hàng/COD/đối tác vận chuyển.
- Không làm QR ting ting, đăng ký bank partner, NAPAS, MoMo/ZaloPay hoặc ví điện tử trong MVP.
- Không làm SMS/Zalo marketing provider; chỉ giữ hỗ trợ mở/copy/gửi ảnh bill theo cấu hình khách đã chốt trong POS.
- Không làm ngoại tệ/tỷ giá; mặc định VND.
- Không làm VAT, Thuế & Kế toán, HĐĐT.
- Không làm tích điểm, voucher, coupon, khuyến mại campaign trong MVP.
- Không làm bảo hành/bảo trì retail.
- Không làm mã vạch/POS scan, tự động gợi ý thông tin hàng hóa, thuộc tính retail, thương hiệu riêng hoặc vị trí giá/kệ/tủ trong MVP.
- Không làm cân điện tử vì QC-OMS không có nghiệp vụ bán/nhập/chuyển hàng theo cân.
- Không làm UI xóa dữ liệu hàng loạt/lịch xóa trong vận hành thường ngày; nếu cần reset dữ liệu phải là runbook kỹ thuật có backup và quyền đặc biệt.
- Giữ audit log đơn giản với bộ lọc nhân viên/tính năng/thời gian và chi tiết hành động quan trọng.
- Chưa làm khóa sổ kiểu KiotViet trong MVP. Báo cáo cuối ngày vẫn là báo cáo động; sửa chứng từ theo quy tắc `MaCu.01` và audit log.

PRD-UX đã bổ sung:

- `docs/02-PRD-UX-PhongCanh/System/02-SYSTEM-SETTINGS.md`

---

## 5. Thứ tự spec nên làm tiếp

1. Rà và bổ sung Scope MVP khi Owner chốt thêm phần bỏ/giữ từ KiotViet.
2. Purchase/Supplier: đã có draft, để sau MVP nếu chưa chốt nhập kho vật lý theo cuộn/tấm và giá vốn.
3. Workstation/Production reconciliation: tiếp tục để dạng draft cho tới khi giải được cách ghép file máy sản xuất với bill/hoa đơn.
4. Bill/Printer/Messaging: viết spec sau khi flow POS/in bill ổn định.
5. PriceBook/Customer/SalesDocuments/Reports/Inventory Adjustments/System permissions: đã có PRD-UX nền; sau này bổ sung chi tiết khi implementation bắt đầu phase tương ứng.
