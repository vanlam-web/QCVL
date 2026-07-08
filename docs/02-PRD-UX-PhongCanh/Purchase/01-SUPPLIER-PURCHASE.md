# Purchase UI — Nhà cung cấp và nhập hàng

> **Vai trò:** PRD/UX Source of Truth mức khung.
> **Business:** [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md)

---

## 1. Nguyên tắc UX

QC-OMS tham khảo KiotViet nhưng đơn giản hơn:

- một màn danh sách nhà cung cấp
- một màn danh sách phiếu nhập
- một form tạo/sửa phiếu nhập trực tiếp
- không hiển thị đặt hàng nhập, trả hàng nhập, HĐĐT/VAT trong lát cắt đầu tiên

Mục tiêu thao tác là nhập đúng hàng thật mua vào, đặc biệt là cuộn/tấm vật lý.

Ghi nhận từ KiotViet:

- `Nhà cung cấp` có tìm theo mã/tên/số điện thoại, cột mã NCC, tên, điện thoại, email, nợ hiện tại, tổng mua.
- `Nhập hàng` có danh sách phiếu theo mã phiếu, thời gian, mã NCC, nhà cung cấp, cần trả NCC, trạng thái.
- Form nhập hàng có tìm hàng theo mã/tên, chọn/tạo nhanh NCC, mã phiếu tự động, số hóa đơn/chứng từ đầu vào dạng text, dòng hàng gồm số lượng, đơn giá, giảm giá, thành tiền.
- QC-OMS giữ các phần này, nhưng bỏ đặt hàng nhập, trả hàng nhập, VAT/HĐĐT và hiệu lực phức tạp trong lát cắt đầu.

---

## 2. Danh sách nhà cung cấp

### Bộ lọc

- tìm theo mã, tên, số điện thoại
- ô tìm NCC dùng shared compact search, hỗ trợ nhập không dấu và xổ tối đa 8 gợi ý dưới ô nhập; dòng gợi ý gồm mã + tên NCC, SĐT/email ở dòng phụ, mép phải là nợ cần trả hiện tại
- bấm gợi ý NCC sẽ lọc danh sách theo đúng mã NCC đã chọn
- trạng thái: tất cả/đang hoạt động/ngừng hoạt động
- nợ hiện tại: khoảng từ/tới
- tổng mua: khoảng từ/tới và khoảng thời gian nếu cần

### Cột mặc định

| Cột | Ghi chú |
|---|---|
| Mã NCC | Click mở chi tiết |
| Tên NCC | Bắt buộc |
| Điện thoại | Có thể trống |
| Email | Có thể trống |
| Nợ cần trả hiện tại | Tổng hợp từ công nợ NCC |
| Tổng mua | Tổng phiếu nhập posted |
| Trạng thái | Active/inactive |

Không cần nhóm NCC ở lát cắt đầu tiên nếu chưa có nghiệp vụ phân nhóm rõ.

Nếu `Nợ cần trả hiện tại < 0`, UI không mặc định hiểu là trả trước NCC. Trong nghiệp vụ QC-OMS, NCC có thể đồng thời là khách hàng; số âm là tín hiệu cần đối soát với hồ sơ khách hàng liên kết.

---

## 3. Chi tiết nhà cung cấp

Tab tối thiểu:

| Tab | Nội dung |
|---|---|
| Thông tin | Mã, tên, điện thoại, email, địa chỉ, MST text, ghi chú, trạng thái |
| Phiếu nhập | Lịch sử phiếu nhập của NCC |
| Công nợ | Các phiếu nhập còn nợ và lịch sử trả NCC |

Không có tab hóa đơn điện tử/thuế.

Nếu NCC cũng là khách hàng, tab Thông tin hiển thị liên kết tới hồ sơ khách hàng tương ứng. MVP chỉ cần liên kết thủ công/chọn khách hàng có sẵn; không bắt buộc tự động gộp theo số điện thoại.

---

## 4. Danh sách phiếu nhập

### Bộ lọc

- tìm theo mã phiếu nhập, tên/mã NCC, số chứng từ NCC
- thời gian nhập
- trạng thái: phiếu tạm, đã nhập, đã hủy
- người nhập/người tạo

Nếu người dùng nhập đúng mã phiếu như `PN000673`, kết quả tìm kiếm phải ưu tiên tìm chính xác và không bị mất do bộ lọc tháng hiện tại.

Ô tìm `Tìm phiếu/NCC` phải có gợi ý xổ xuống khi nhập từ khóa, giống kiểu tìm sản phẩm ở POS:

- gọi API tìm theo mã phiếu nhập, tên/mã NCC, số chứng từ NCC với bộ lọc trạng thái/ngày/người tạo đang chọn
- tối đa 8 dòng gợi ý dưới ô nhập
- dòng gợi ý hiển thị: mã phiếu + tên NCC, dòng phụ mã NCC - tên NCC, mép phải là `Cần trả NCC`
- bấm vào gợi ý sẽ lọc danh sách theo đúng mã phiếu nhập đã chọn
- bấm Enter hoặc nút lọc vẫn lọc bình thường theo nội dung đang nhập
- không có kết quả thì hiện `Không có kết quả phù hợp`

### Cột mặc định

| Cột | Ghi chú |
|---|---|
| Mã phiếu nhập | Dạng `PN...`, click mở chi tiết |
| Thời gian nhập | Thời điểm dự kiến/đã nhập |
| Nhà cung cấp | Mã + tên |
| Tổng số lượng | Tổng số lượng theo dòng, không thay thế tồn vật lý |
| Số mặt hàng | Số dòng hàng |
| Tổng tiền hàng | Trước thanh toán |
| Cần trả NCC | Sau giảm giá/chi phí liên quan nếu có |
| Đã trả NCC | Tiền đã chi |
| Còn phải trả | Công nợ phát sinh |
| Trạng thái | Draft/posted/cancelled |

---

## 5. Form phiếu nhập

### Header

- chọn/tạo nhanh nhà cung cấp
- thời gian nhập
- kho mặc định trong MVP; chưa cần chọn nhiều kho
- mã phiếu tự sinh, cho sửa trước khi posted nếu cần
- số chứng từ/hóa đơn NCC dạng text
- ghi chú

### Dòng hàng thường

- tìm/chọn sản phẩm
- đơn vị mua
- số lượng
- đơn giá
- giảm giá dòng nếu có
- thành tiền

### Dòng hàng cuộn

Với sản phẩm `inventory_shape = roll`, UI phải yêu cầu nhập vật lý:

- khổ rộng
- số cuộn
- chiều dài mỗi cuộn hoặc danh sách chiều dài từng cuộn
- đơn giá/tổng giá

Nếu nhiều cuộn cùng thông số, cho nhập nhanh `số cuộn x chiều dài`. Nếu khác chiều dài, cho bung danh sách từng cuộn.

### Dòng hàng tấm

Với sản phẩm `inventory_shape = sheet`, UI phải yêu cầu:

- kích thước dài/rộng
- số tấm
- đơn giá/tổng giá

Nếu cùng kích thước, cho nhập theo lô. Nếu khác kích thước, tách dòng hoặc bung danh sách.

---

## 6. Thanh toán trên phiếu nhập

Form hiển thị:

- tổng tiền hàng
- giảm giá phiếu nếu dùng
- cần trả NCC
- đã trả ngay
- còn phải trả
- phương thức trả: tiền mặt hoặc chuyển khoản/tài khoản

MVP ưu tiên một phương thức thanh toán cho một lần trả để thao tác gọn.

P2/P3 theo quyết định Owner 2026-07-02:

- P2 draft có thể nhập `đã trả` để xem còn phải trả, nhưng không tạo sổ quỹ khi còn draft.
- P3 post phiếu nhập có trả ngay thì phải ghi phiếu chi/sổ quỹ.
- Nếu chuyển khoản, UI ưu tiên tài khoản ngân hàng/STK dùng gần nhất, cho chọn tài khoản mặc định hoặc mở danh sách chọn tài khoản khác.
- Nếu `đã trả > cần trả`, UI/API cho phép số còn phải trả âm để thể hiện NCC đang nợ lại mình/trả thừa, chưa tự cấn trừ với khách hàng liên kết.

Nếu thao tác trả NCC làm số dư âm, hệ thống không mở workflow trả trước riêng trong MVP. UI hiển thị số âm để đối soát, và nếu NCC có liên kết khách hàng thì nhân viên có thể kiểm tra khoản khách còn nợ ở hồ sơ khách hàng.

---

## 7. Hành động

| Hành động | Quy tắc |
|---|---|
| Lưu tạm | Tạo draft, chưa tăng tồn/công nợ/sổ quỹ |
| Hoàn thành/Nhập hàng | Posted, tăng tồn, cập nhật `giá nhập cuối`, ghi công nợ/sổ quỹ |
| Hủy | Với phiếu posted phải dùng bút toán đảo/an toàn, không xóa vật lý |
| Sửa phiếu posted | Ngoài phạm vi hiện tại; sau này dùng quy tắc sửa chứng từ an toàn, không sửa phá dữ liệu |

---

## 8. Empty state và lược bỏ

Nếu chưa có dữ liệu trong tháng, empty state phải cho đổi khoảng thời gian dài hơn, giống kinh nghiệm rà KiotViet.

Không hiển thị menu/chức năng trong lát cắt đầu tiên:

- đặt hàng nhập
- trả hàng nhập
- hóa đơn đầu vào điện tử
- báo cáo NCC nâng cao

---

## 9. Trạng thái màn theo lát cắt

Để implement không phải làm toàn bộ Purchase một lần, UI chia theo lát cắt:

| Slice | UI bật | UI chưa bật |
|---|---|---|
| P1 Supplier foundation | Danh sách NCC, tạo/sửa NCC, liên kết khách hàng | Đã merge |
| P2 Purchase draft/list/detail | Danh sách phiếu nhập, tạo/sửa draft hàng thường | Đã merge |
| P3 Post normal receipt | Nút Hoàn thành cho hàng thường, cập nhật giá nhập cuối | Đã merge cho hàng thường |
| P4 Roll/sheet purchase | Form nhập cuộn/tấm vật lý | Sửa posted nâng cao |
| P5 Supplier payments | Trả tiền NCC sau phiếu nhập, lịch sử thanh toán NCC | Đã merge; trả nhiều tài khoản trong một lần để sau |

Quy tắc chung: UI không hiển thị nút chức năng chưa chạy được như thể đã chạy được. Nếu cần giữ vị trí, dùng disabled state kèm tooltip ngắn.

### 9.1. Supplier foundation P1

P1 đã merge. Phạm vi nền:

- route/list NCC
- form thêm/sửa NCC
- field `linked_customer_id` chọn từ khách hàng hiện có
- search theo mã/tên/sĐT
- filter trạng thái
- cột tổng mua/nợ hiện tại trả `0` nếu chưa có Purchase

Acceptance UI:

- tạo NCC với tên, mã tự sinh nếu bỏ trống
- SĐT trống vẫn lưu được
- gắn khách hàng liên kết và mở link qua hồ sơ khách
- NCC inactive không xuất hiện trong chọn NCC mặc định khi tạo phiếu nhập sau này

### 9.2. Purchase draft P2

P2 đã merge cho hàng thường. Phạm vi:

- form tạo phiếu nhập draft
- chọn NCC
- tìm hàng theo mã/tên
- dòng hàng thường: số lượng, đơn giá, giảm giá, thành tiền
- tổng tiền hàng, giảm giá phiếu, cần trả, đã trả tạm, còn phải trả
- lưu draft, sửa draft

Draft chỉ là dữ liệu nháp server; không post tồn/kế toán cho tới khi người dùng hoàn thành phiếu.

P2 dùng kho mặc định. Quy tắc có cho sửa mã `PN...` khi draft hay không cần tham khảo KiotViet trước khi chốt.

### 9.3. Supplier payment P5

P5 đã merge. KiotViet audit 2026-07-02 đã xác nhận mã thanh toán NCC dạng `PCPN...`, lịch sử thanh toán nằm trong chi tiết phiếu nhập, và action thanh toán nằm trong tab công nợ NCC.

Quyết định Owner đã chốt:

- trả tiền NCC sau phiếu nhập bằng cách chọn phiếu nhập cụ thể
- cho trả một phần
- không cho trả thừa trong P5
- một lần trả dùng tiền mặt hoặc chuyển khoản
- nếu chuyển khoản, chọn một tài khoản ngân hàng từ danh sách tài khoản đang có
- mã chứng từ trả NCC dùng prefix `PCPN...`
- UI có đường trả từ chi tiết NCC và từ chi tiết phiếu nhập posted còn nợ
- chi tiết phiếu nhập posted có lịch sử thanh toán NCC tối thiểu

Ngoài phạm vi P5 hiện tại:

- trả nhiều tài khoản trong một lần
- tự phân bổ cứng vào phiếu nợ cũ nhất
- tự cấn trừ với khách hàng liên kết
- workflow trả trước NCC

### 9.4. Roll/sheet purchase P4 chốt nền

P4 đã được Spec audit code 2026-07-02 và là candidate tiếp theo sau khi khớp lại code hiện tại. UI không bắt người dùng nhập/quản lý mã từng cuộn/tấm; mã vật lý nếu DB cần sẽ do backend tự sinh.

- cuộn hỗ trợ cả nhiều cuộn cùng thông số và từng cuộn khác chiều dài
- không cần mã từng cuộn rườm rà trong MVP
- tấm chủ yếu nhập cùng kích thước nhiều tấm; sau này có thể phát sinh vật tư khác kích thước
- không cần mã từng tấm
- giá mua tấm thường theo tấm

UX P4:

- Với sản phẩm `roll`, dòng nhập có mode nhanh:
  - cùng thông số: `số cuộn`, `khổ rộng`, `chiều dài mỗi cuộn`
  - khác chiều dài: `khổ rộng`, danh sách `chiều dài từng cuộn`
- Với sản phẩm `sheet`, dòng nhập có `dài`, `rộng`, `số tấm`; nếu cần nhiều nhóm kích thước, cho thêm nhóm kích thước trong cùng dòng sản phẩm.
- UI hiển thị diện tích quy đổi để người dùng kiểm tra tiền/giá vốn, nhưng không cho nhập mua bằng tổng `m2` thay cho object vật lý.
- Chi tiết phiếu posted hiển thị tóm tắt object đã tạo: số cuộn/tấm, kích thước, tổng diện tích; không cần lộ danh sách mã kỹ thuật nếu không cần đối soát.
