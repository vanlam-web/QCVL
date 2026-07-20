# SUPPLIER-PURCHASE — Nhà cung cấp, nhập hàng và công nợ NCC

> **Vai trò:** Source of Truth nghiệp vụ.
> **Tham khảo:** KiotViet `Nhà cung cấp`, `Nhập hàng`
> **Quyết định Owner:** Có NCC, có nhập hàng mua thật, có công nợ NCC; mua cuộn/tấm theo vật lý, không mua `m2`

---

## 1. Mục tiêu

Purchase/Supplier giúp QC-OMS ghi nhận nguồn hàng mua vào, tăng tồn kho, lưu giá vốn và theo dõi khoản phải trả nhà cung cấp.

Khác KiotViet, QC-OMS không được quản lý hàng cuộn/tấm bằng tổng `m2` gộp. Khi nhập hàng dạng cuộn hoặc tấm, phiếu nhập phải tạo dữ liệu tồn vật lý tương ứng để sau này xuất kho/trừ kho chính xác hơn.

---

## 2. Nhà cung cấp

### BR-PUR-01: Hồ sơ nhà cung cấp

Thông tin tối thiểu:

| Trường | Quy tắc |
|---|---|
| Mã NCC | Bắt buộc, tự sinh nếu người dùng không nhập |
| Tên NCC | Bắt buộc |
| Số điện thoại | Không bắt buộc |
| Email | Không bắt buộc |
| Địa chỉ | Không bắt buộc |
| Mã số thuế | Không bắt buộc; chỉ lưu nội bộ, không mở luồng thuế/HĐĐT |
| Khách hàng liên kết | Không bắt buộc; dùng khi cùng một đối tác vừa là NCC vừa là khách hàng |
| Ghi chú | Không bắt buộc |
| Trạng thái | `active`, `inactive` |

Số điện thoại NCC không chốt unique trong MVP. Nếu sau này cần chống trùng NCC, hệ thống nên cảnh báo mềm thay vì chặn cứng.

NCC và khách hàng là hai vai trò nghiệp vụ khác nhau nhưng có thể liên kết cùng một đối tác. MVP không tự gộp hồ sơ theo số điện thoại/tên để tránh sai dữ liệu; người dùng chọn liên kết thủ công khi biết chắc đó là cùng một bên.

Khi NCC có `linked_customer_id`, danh sách NCC hiển thị icon liên kết màu cam ngay trước mã NCC để nhân viên nhận biết đối tác vừa là NCC vừa là khách hàng. Icon là tín hiệu nhận diện nhanh, không thay thế card liên kết trong chi tiết và không tạo thêm cột danh sách.

### BR-PUR-02: Tổng mua và công nợ NCC

Danh sách NCC cần hiển thị tối thiểu:

- mã NCC
- tên NCC
- điện thoại
- nợ cần trả hiện tại
- tổng mua
- trạng thái

`Nợ cần trả hiện tại` và `Tổng mua` là số tổng hợp từ phiếu nhập, phiếu chi/trả NCC và các điều chỉnh hợp lệ; không nhập tay trực tiếp trên hồ sơ NCC.

Nếu `Nợ cần trả hiện tại < 0`, không mặc định hiểu là NCC được trả trước. Với QC-OMS, trường hợp thường gặp là đối tác đó cũng là khách hàng và còn khoản phải thu ở phía khách hàng. UI/API cần giữ số âm để đối soát và hiển thị liên kết khách hàng nếu có, nhưng không mở workflow trả trước NCC riêng trong MVP.

---

## 3. Phiếu nhập hàng

### BR-PUR-03: Purchase receipt là luồng nhập chính

Lát cắt Purchase đầu tiên dùng phiếu nhập trực tiếp, không bắt buộc có đặt hàng nhập trước.

Trạng thái phiếu:

| Trạng thái | Ý nghĩa | Ảnh hưởng tồn/công nợ |
|---|---|---|
| `draft` | Phiếu tạm | Chưa tăng tồn, chưa sinh công nợ, chưa ghi sổ quỹ |
| `posted` | Đã nhập hàng | Tăng tồn, ghi giá vốn, sinh công nợ NCC nếu chưa trả đủ, ghi sổ quỹ nếu có trả tiền |
| `cancelled` | Đã hủy | Không còn hiệu lực; nếu đã posted thì phải có bút toán đảo/an toàn, không xóa phiếu cũ |

Phiếu đã posted không sửa phá dữ liệu. Nếu cần sửa, dùng quy tắc chứng từ sửa đã chốt: tạo mã phiên bản mới dạng `MaCu.01`, phiếu cũ chuyển trạng thái hủy/không hiệu lực để kiểm tra lại được.

### BR-PUR-04: Trường dữ liệu phiếu nhập

Thông tin tối thiểu:

| Nhóm | Trường |
|---|---|
| Header | mã phiếu nhập, thời gian nhập, NCC, người nhập, kho, ghi chú |
| Tham chiếu | số hóa đơn/chứng từ NCC nếu có, chỉ là text |
| Dòng hàng | sản phẩm/vật tư, đơn vị mua, số lượng, giá nhập, giảm giá nếu có, thành tiền |
| Thanh toán | tổng tiền hàng, giảm giá phiếu, cần trả NCC, đã trả, còn phải trả |
| Audit | người tạo, ngày tạo, người sửa/hủy, lý do sửa/hủy nếu có |

Không có kênh bán, vận đơn, COD, VAT/HĐĐT trong phiếu nhập QC-OMS.

Quyết định Owner 2026-07-02 cho P2/P3:

- P2/P3 chỉ dùng kho mặc định trong MVP; chưa cần chọn nhiều kho trên phiếu nhập.
- Mã phiếu `PN...` cần tham khảo KiotViet trước khi chốt có cho sửa ở trạng thái draft hay không.
- P2/P3 có thể ghi nhận `paid_amount` trên phiếu để tính còn phải trả; tác động sổ quỹ chỉ phát sinh khi post theo P3, không phát sinh side effect ở draft P2.
- Giảm giá phiếu nhập được giữ theo SoT nếu có UI/API hỗ trợ, nhưng backend vẫn phải tự tính tổng, không tin tổng từ client.

### BR-PUR-04B: Không nhập tồn theo mã combo

Theo Owner 2026-07-20 và [BOM-RULES.md](../BOM/BOM-RULES.md):

- Phiếu nhập vận hành trên hàng tồn thật (`normal` / `roll` / `sheet` / vật tư).
- Không dùng phiếu nhập để tăng tồn theo mã combo như một SKU tồn kho.
- Combo chỉ tiêu hao thành phần khi bán; thành phần mới là đối tượng nhập/kiểm tồn.

---

## 4. Nhập theo loại tồn kho

### BR-PUR-05: Hàng thường

Hàng `normal` nhập theo đơn vị tồn chính hoặc đơn vị quy đổi đã cấu hình.

Ví dụ:

```text
1 ram giấy = 500 tờ
Nhập 10 ram -> tăng tồn 10 ram hoặc 5,000 tờ tùy đơn vị tồn chính
```

### BR-PUR-06: Hàng cuộn

Hàng `roll` phải nhập theo từng cuộn vật lý hoặc nhiều cuộn cùng thông số.

Mỗi cuộn nhập vào cần có:

- sản phẩm/vật tư
- khổ rộng
- chiều dài ban đầu theo mét tới
- chiều dài còn lại ban đầu, mặc định bằng chiều dài nhập
- diện tích tính toán
- giá nhập hoặc phân bổ giá nhập
- NCC/phiếu nhập nguồn
- trạng thái cuộn

Không nhập mua cuộn bằng `m2`. `m2` chỉ là số quy đổi để tính diện tích, giá vốn tham khảo và báo cáo.

Ví dụ:

```text
Nhập bạt 3.2m: 2 cuộn, mỗi cuộn 50m tới
Hệ thống tạo Roll R001 và R002, mỗi cuộn 3.2 x 50 = 160m2
```

### BR-PUR-07: Hàng tấm

Hàng `sheet` phải nhập theo tấm hoặc lô tấm cùng kích thước.

Mỗi lô/tấm nhập cần có:

- sản phẩm/vật tư
- kích thước dài/rộng
- số lượng tấm
- diện tích tính toán
- giá nhập hoặc phân bổ giá nhập
- NCC/phiếu nhập nguồn
- trạng thái tấm

Không nhập mua tấm bằng tổng `m2` nếu thực tế mua theo tấm. `m2` chỉ là số tính toán.

---

## 5. Giá vốn

### BR-PUR-08: Giá vốn từ phiếu nhập phải lưu lại

Mỗi dòng nhập phải lưu giá vốn tại thời điểm nhập. Với cuộn/tấm, giá vốn phải gắn được với object/lô vật lý để sau này đối chiếu tồn và lợi nhuận.

Nguồn giá vốn phục vụ nhiều mục đích:

- lịch sử mua hàng
- báo cáo tồn kho
- báo cáo lợi nhuận khi phương pháp giá vốn đã chốt
- công thức PriceBook theo nhóm hàng trong MVP chỉ đọc `giá nhập cuối`

### BR-PUR-09: PriceBook MVP chỉ dùng giá nhập cuối

PriceBook MVP không chọn nhiều nguồn tính giá để tránh rườm rà.

Nguồn duy nhất cho công thức PriceBook là `giá nhập cuối` của sản phẩm/vật tư.

Khi giá nhập cuối thay đổi, các ô giá đang ở chế độ `theo công thức` trong PriceBook tự tính lại theo giá nhập cuối mới. Các ô đã nhập giá tay không tự đổi. Rule riêng của bảng giá nhóm `0` vẫn lấy động theo giá nhập gần nhất.

Quyết định Owner 2026-07-02:

- Khi post phiếu nhập hàng thường, hệ thống phải tăng tồn.
- Khi nhập giá mua thấp hơn giá nền/giá nhập tham chiếu hiện có, UI nên cảnh báo để người dùng xác nhận, tránh nhập nhầm giá quá thấp.
- Nếu việc xác định "giá nền" làm chậm slice, tối thiểu phải cảnh báo khi giá nhập thấp hơn giá nhập gần nhất đang lưu.
- Khi post phiếu nhập, luôn cập nhật `products.latest_purchase_cost` theo giá nhập tay của phiếu posted.
- Lịch sử giá nhập phải được lưu/giữ lại để đối chiếu sau này; không chỉ ghi đè giá cuối mà mất dấu giá cũ.

---

## 6. Công nợ nhà cung cấp và sổ quỹ

### BR-PUR-10: Công nợ NCC phát sinh từ phiếu nhập chưa trả đủ

Khi phiếu nhập posted:

```text
Còn phải trả = Cần trả NCC - Đã trả ngay
```

Nếu `Còn phải trả > 0`, hệ thống ghi nhận công nợ cần trả NCC.

Nếu `Còn phải trả < 0`, MVP cho phép ghi nhận số âm như trạng thái NCC đang nợ lại mình/trả thừa để đối soát. Không tự cấn trừ với công nợ khách hàng liên kết nếu Owner chưa chốt luồng cấn trừ riêng.

### BR-PUR-11: Trả tiền NCC ghi vào sổ quỹ

Nếu trả tiền ngay trên phiếu nhập hoặc trả nợ NCC sau đó, hệ thống phải ghi phiếu chi/sổ quỹ theo phương thức:

- tiền mặt
- chuyển khoản và tài khoản nhận/chi tương ứng

MVP ưu tiên một lần trả tiền dùng một phương thức/tài khoản để thao tác gọn. Nếu sau này cần tách nhiều tài khoản trong một lần trả, mở rộng sau.

Quyết định Owner 2026-07-02:

- P3 có trả ngay trên phiếu nhập.
- Khi chuyển khoản, UI ưu tiên tài khoản ngân hàng/STK dùng gần nhất, có thể có nút chọn tài khoản mặc định và dropdown để chọn tài khoản khác.
- Khi post có trả ngay, hệ thống phải tạo phiếu chi/sổ quỹ.
- Nội dung phiếu chi nên đủ để đối soát: mã phiếu nhập, tên/mã NCC, số chứng từ NCC nếu có, phương thức trả và tài khoản chi nếu chuyển khoản.

### BR-PUR-12: Phân bổ trả nợ NCC

Mặc định đề xuất cũ là tiền trả NCC được phân bổ vào phiếu nhập nợ cũ nhất trước. Quyết định Owner 2026-07-02 cho P5 đã merge: khi trả tiền NCC sau phiếu nhập, người dùng chọn phiếu nhập cụ thể để trả, không tự phân bổ cứng vào phiếu cũ nhất.

Quy tắc này đi cùng hướng công nợ khách đã chốt: trả nợ theo chứng từ. UI có thể gợi ý chứng từ cũ nhất để dễ đối soát, nhưng người dùng vẫn chọn phiếu cụ thể.

Quyết định Owner 2026-07-02 cho P5:

- P5 đã merge sau P3.
- Cho phép trả một phần công nợ NCC.
- Không cho trả thừa trong luồng trả NCC sau phiếu nhập. Số âm ở P3 chỉ dùng cho tình huống đối tác vừa là NCC vừa là khách hàng và cần đối soát; P5 không mở workflow trả trước/trả thừa NCC.
- Một lần trả NCC dùng một phương thức: tiền mặt hoặc chuyển khoản.
- Nếu chuyển khoản, người dùng chọn được nhiều tài khoản ngân hàng đang có, nhưng mỗi lần trả chỉ chọn một tài khoản.

Tham khảo KiotViet 2026-07-02:

- Lịch sử công nợ NCC hiển thị giao dịch thanh toán với mã dạng `PCPN000673`, đi cặp với phiếu nhập `PN000673`.
- Trong chi tiết phiếu nhập, chỉ hiện tab `Lịch sử thanh toán` khi phiếu đã có ít nhất một dòng thanh toán NCC. Tab này hiển thị `Mã phiếu`, `Thời gian`, `Người tạo`, `Phương thức`, `Trạng thái`, `Tiền chi`.
- Trong chi tiết NCC, tab `Nợ cần trả nhà cung cấp` hiển thị lịch sử `Nhập hàng`/`Thanh toán` và có action `Thanh toán`.
- Sổ quỹ là module quản lý `Phiếu thu`/`Phiếu chi`, có filter quỹ tiền `Tiền mặt`/`Ngân hàng` và cột `Số tài khoản` khi dùng ngân hàng.

Quyết định QC-OMS cho P5:

- Mã chứng từ trả NCC dùng prefix `PCPN` để bám sát KiotViet và dễ đối chiếu với `PN...`.
- UI P5 nên hỗ trợ thao tác từ chi tiết NCC và từ chi tiết phiếu nhập posted còn nợ. Cả hai đường đều mở cùng một form trả NCC và bắt buộc chọn phiếu nhập cụ thể.
- Chi tiết phiếu nhập posted cần có lịch sử thanh toán NCC để xem các `PCPN...` đã chi cho phiếu đó. Nếu chưa có thanh toán, không hiện tab `Lịch sử thanh toán`; action `Thanh toán NCC` nằm ở footer tab `Thông tin`.
- Với phiếu nhập KiotViet đã có `Tiền đã trả NCC` nhưng không có dòng `supplier_payments` riêng, UI được phép dựng một dòng lịch sử đọc-only mã `PC` + mã phiếu nhập để đối chiếu, ví dụ `PCPN000684`.

---

## 7. Không làm trong lát cắt Purchase đầu tiên

| Phần KiotViet | Quyết định QC-OMS |
|---|---|
| Đặt hàng nhập | Không làm trước; nhập trực tiếp khi hàng về |
| Trả hàng nhập | Không làm trước; nếu sai dùng sửa/hủy chứng từ, kiểm kho hoặc điều chỉnh tồn |
| Hóa đơn đầu vào điện tử | Bỏ; chỉ lưu số chứng từ/hóa đơn dạng text nếu cần |
| Mua dịch vụ | Đi qua phiếu chi/sổ quỹ, chưa mở module riêng |
| Báo cáo NCC nâng cao | Làm sau khi Purchase/Supplier có dữ liệu chuẩn |
| Nhóm NCC phức tạp | Chưa cần trong MVP |

---

## 8. Acceptance Criteria

- Tạo NCC bắt buộc có mã và tên; mã tự sinh nếu bỏ trống.
- Danh sách NCC hiển thị tổng mua và nợ hiện tại từ dữ liệu chứng từ.
- Phiếu nhập draft không tăng tồn, không ghi công nợ, không ghi sổ quỹ.
- Phiếu nhập posted tăng tồn đúng theo `inventory_shape`.
- Không nhập/tăng tồn theo mã combo; nhập trên hàng thành phần/tồn thật (Owner 2026-07-20).
- Hàng cuộn/tấm nhập theo đối tượng vật lý, không nhập mua bằng tổng `m2`.
- Phiếu nhập posted lưu được giá vốn tại thời điểm nhập.
- Phiếu nhập trả chưa đủ sinh công nợ NCC.
- Trả tiền NCC tạo phiếu chi/sổ quỹ đúng phương thức tiền.
- Không có luồng HĐĐT/VAT/thuế trong Purchase MVP.

---

## 9. Lát cắt Purchase

Purchase/Supplier chạm Inventory, Finance và PriceBook, nên được chia nhỏ để kiểm soát rủi ro. P1/P2/P3/P5 đã merge; P4 còn là candidate khi cần nhập cuộn/tấm vật lý.

### Slice P1 — Supplier foundation

Đã merge. Phạm vi:

- bảng `suppliers`
- CRUD NCC tối thiểu
- danh sách/search/filter
- liên kết thủ công `linked_customer_id`
- hiển thị tổng mua/nợ hiện tại dạng tổng hợp, có thể trả `0` nếu chưa có phiếu nhập

Không gồm:

- phiếu nhập
- công nợ thật
- thanh toán NCC
- báo cáo NCC

Acceptance:

- tạo NCC chỉ cần tên; mã tự sinh nếu trống
- số điện thoại được phép trống và không unique cứng
- gắn khách hàng liên kết nếu cùng organization
- nếu NCC inactive, không chọn làm NCC mới trong phiếu nhập sau này

### Slice P2 — Purchase receipt draft/list/detail

Đã merge. Phạm vi hiện tại:

- tạo phiếu nhập `draft`
- sửa draft
- danh sách phiếu nhập
- chi tiết phiếu nhập readonly/edit draft
- tìm hàng trong màn tạo bằng thanh `Tìm hàng (F3)` giống POS, chỉ theo mã hàng/tên hàng
- chọn hàng từ search để thêm card dòng hàng; không có row rỗng mặc định và không dùng bảng/dropdown chọn sản phẩm
- dòng hàng thường với quantity/unit_cost/discount/line_total
- dòng hàng roll/sheet lưu được `physical_payload` trong draft; post object vật lý vẫn thuộc P4
- số chứng từ NCC dạng text

Không gồm:

- post tăng tồn
- thanh toán thật
- post roll/sheet object vật lý đầy đủ

Acceptance:

- draft không tạo stock movement, cashbook, payable
- tìm exact mã `PN...` không bị mất do filter tháng hiện tại
- tính tổng tiền hàng/giảm giá/tổng nợ hoặc còn phải trả từ dòng hàng
- không cho lưu phiếu nhập khi chưa có dòng hàng

### Slice P3 — Post receipt cho hàng thường

Đã merge. Phạm vi:

- `POST /purchase/receipts/{id}/post`
- transaction tăng tồn hàng `normal`
- cập nhật `products.latest_purchase_cost`
- tạo payable nếu chưa trả đủ
- tạo cashbook outflow nếu trả ngay

Không gồm:

- roll/sheet object vật lý nếu Inventory chưa sẵn sàng
- trả nợ NCC sau nhiều phiếu
- sửa/hủy posted nâng cao

Acceptance:

- post idempotent/guard: không post lại phiếu đã posted
- rollback toàn bộ nếu stock/cash/payable lỗi
- `latest_purchase_cost` lấy từ dòng nhập của sản phẩm trong phiếu posted; P2/P3 ưu tiên không cho trùng sản phẩm trong cùng phiếu
- nếu cùng sản phẩm nhiều dòng trong một phiếu, backend phải merge trước hoặc dùng dòng cuối sau khi validate; ưu tiên không cho trùng dòng sản phẩm trong draft để đơn giản
- tăng tồn vào kho mặc định trong MVP
- cho phép `remaining_amount < 0` để thể hiện NCC đang nợ lại mình/trả thừa
- khi có trả ngay thì tạo cashbook outflow/phiếu chi trong cùng transaction post
- cảnh báo giá nhập thấp hơn giá nhập gần nhất hoặc giá nền nếu có dữ liệu
- lưu được lịch sử giá nhập, không chỉ ghi đè `latest_purchase_cost`

### Slice P4 — Roll/sheet purchase objects

Candidate tiếp theo sau khi khớp lại code hiện tại. Form draft đã có UI nhập payload vật lý trong card dòng hàng; P4 còn phạm vi post object vật lý và sửa posted an toàn.

Phạm vi:

- nhập cuộn/tấm theo vật lý
- tạo roll/sheet object hoặc lot theo Inventory schema hiện có
- phân bổ unit cost vào object/lô

Chỉ làm sau khi Inventory roll/sheet object model đủ rõ trong code.

Quyết định Owner 2026-07-02 cho P4:

- Cuộn: cần hỗ trợ cả nhập nhiều cuộn cùng khổ/cùng mét và từng cuộn khác chiều dài.
- Cuộn: không cần quản lý mã từng cuộn rườm rà trong MVP; chỉ cần ghi nhận cuộn/lô vật lý đủ để tính tồn và xuất sau này.
- Tấm: chủ yếu nhập nhiều tấm cùng kích thước; sau này có thể gặp vật tư khác kích thước.
- Tấm: không cần mã từng tấm.
- Giá mua tấm: thường theo tấm.

Spec audit code 2026-07-02:

- Inventory hiện đã có bảng vật lý `inventory_rolls` và `inventory_sheets`, cùng `stock_movements.inventory_object_type`, `inventory_roll_id`, `inventory_sheet_id`.
- `purchase_receipt_items` đã có `inventory_shape` và `physical_payload`; P2/P3 hiện mới lưu/post `normal`.
- P4 không tạo model lot mới nếu chưa cần. P4 nối phiếu nhập vào object vật lý hiện có.
- Dù DB có cột `code` cho roll/sheet, UI P4 không bắt người dùng nhập/quản lý mã từng cuộn/tấm. Backend tự sinh mã kỹ thuật để thỏa unique constraint và phục vụ trace/debug.
- Cuộn nhập theo object: mỗi cuộn tạo một row `inventory_rolls`, có `width_m`, `initial_length_m`, `remaining_length_m`, `initial_area_m2`, `remaining_area_m2`, `status = available`.
- Nếu nhiều cuộn cùng thông số, UI cho nhập nhanh `số cuộn x khổ x chiều dài`; backend bung ra nhiều roll object.
- Nếu nhiều cuộn khác chiều dài, UI cho nhập danh sách chiều dài; backend tạo một roll object cho mỗi chiều dài.
- Tấm nhập theo số lượng tấm: MVP tạo một row `inventory_sheets` cho mỗi tấm vật lý, `sheet_kind = full`, `status = available`; mã tấm là mã tự sinh ẩn.
- Nếu nhập tấm nhiều nhóm kích thước trong cùng sản phẩm, dùng `physical_payload.sheet_groups[]` để giữ các nhóm kích thước/số lượng; không cần tạo nhiều dòng trùng sản phẩm trong cùng phiếu vì schema P2 đang unique `(purchase_receipt_id, product_id)`.
- Giá vốn: `purchase_receipt_items.unit_cost` là đơn giá nhập của đơn vị mua; P4 phải lưu đủ metadata trong `physical_payload` để sau này đối chiếu unit cost theo cuộn/tấm. Không thêm phương pháp giá vốn nâng cao trong P4.
- Stock movement khi post P4 phải gắn object id: roll dùng `inventory_object_type = roll`, `inventory_roll_id`; sheet dùng `inventory_object_type = sheet`, `inventory_sheet_id`.

P4 acceptance khi làm:

- Draft cho phép dòng `roll`/`sheet` với `physical_payload` hợp lệ.
- Post một phiếu có roll/sheet tạo object vật lý và stock movement trong cùng transaction.
- Roll/sheet object rollback nếu post lỗi sau khi tạo một phần.
- Backend vẫn reject nếu `inventory_shape` của item không khớp `product_inventory_settings.inventory_shape`.
- Không cho nhập roll/sheet bằng tổng `m2` trừ khi đó chỉ là số tính toán hiển thị; nguồn tồn vật lý là object.
- Không bắt người dùng nhập mã từng cuộn/tấm.
- P4 không làm xuất/trừ cuộn/tấm khi bán, tối ưu cắt, remnant nâng cao, hủy/sửa posted.

### Slice P5 — Supplier payments

Đã merge. Phạm vi:

- trả tiền NCC sau phiếu nhập
- người dùng chọn phiếu nhập cụ thể để trả
- cho trả một phần
- không cho trả thừa trong P5
- ghi cashbook outflow theo tiền mặt hoặc chuyển khoản một tài khoản

Không cần nhiều tài khoản trong một lần trả ở MVP. Nếu chuyển khoản, UI cho chọn từ các tài khoản ngân hàng đang có.

KiotViet audit 2026-07-02 đã chốt:

- format chứng từ trả NCC: prefix `PCPN...`
- vị trí thao tác: từ chi tiết NCC và chi tiết phiếu nhập posted còn nợ; chi tiết phiếu nhập có lịch sử thanh toán
