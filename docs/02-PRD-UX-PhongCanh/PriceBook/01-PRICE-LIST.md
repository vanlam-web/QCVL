# 01-PRICE-LIST — Danh sách bảng giá

> **Tham khảo:** KiotViet `Hàng hóa > Thiết lập giá`
> **Search SoT:** [SEARCH-RANKING-PERFORMANCE](../../03-BUSINESS-NghiepVu/SEARCH-RANKING-PERFORMANCE.md)

---

## 1. Mục tiêu

Trang danh sách bảng giá giúp quản lý các bảng giá đang dùng cho khách hàng và nhóm khách.

Trong PriceBook MVP, công thức giá chỉ dùng `giá nhập cuối` từ `products.latest_purchase_cost`. Trước khi Purchase/Supplier hoàn chỉnh, giá này có thể được nhập/import hoặc sửa có kiểm soát trong Product admin/API. Giá bán chính thức vẫn là giá đã lưu trong bảng giá; công thức chỉ đổi giá khi người dùng preview và áp dụng.

KiotViet chỉ là nguồn import/tham khảo ban đầu. Luồng giá của QCVL phải được thiết kế theo cách xưởng muốn vận hành, không copy nguyên cách KiotViet nếu cách đó không đúng mong muốn.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bảng giá                                           [+ Bảng giá]              │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc               │ [Theo mã/tên bảng giá...]                             │
│ - Trạng thái         │                                                       │
│ - Loại bảng giá      │ Bảng danh sách bảng giá                               │
│ - Nhóm khách dùng    │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Loại bảng giá

Ô tìm trong header dùng shared compact search:

- tìm bỏ dấu theo mã hàng/tên hàng trong lưới bảng giá;
- gõ chữ chỉ cập nhật nội dung tìm; bấm `Enter` mới gọi API/lọc lưới bảng giá theo mã hàng/tên hàng, phương thức bán và đơn vị;
- ưu tiên mã hàng trước tên hàng;
- không hiển thị dropdown/listbox gợi ý dưới ô tìm;
- nút `+` chuyển thành `Xóa tìm kiếm` khi ô có nội dung.

## Shared Management Layout Rule

PriceBook dùng chung khung quản trị với Customers/Suppliers:

- dùng `ManagementPage`, `ManagementCompactToolbar`, `ManagementCompactSearch`, `ManagementFilterSidebar`, `ManagementTableViewport`, `ManagementDataTable`;
- bộ lọc bảng giá dùng `ManagementChipPicker` + `useChipSelection`, không viết picker riêng trong `PriceBookPage`;
- bảng giá không tự render `<table>` riêng trong page;
- dữ liệu riêng của PriceBook chỉ nằm ở cấu hình cột, cell giá động theo `priceLists`, công thức preview/apply và API load;
- không đưa lại dropdown/listbox gợi ý dưới ô tìm;
- POS không áp dụng rule này.

Bộ lọc bảng giá hiện tại:

- `Giá chung` được chọn mặc định lúc đầu nhưng vẫn là một thẻ bình thường, có thể tắt.
- Mỗi bảng giá được chọn hiển thị thành một thẻ riêng; chọn thêm bảng giá thì thêm thẻ mới và thêm cột giá tương ứng trong lưới.
- Bấm/focus vào ô thẻ để xổ dropdown; gõ chữ trong ô để lọc nhanh danh sách bảng giá.
- Không có nút `Áp dụng bộ lọc`, không có nút mũi tên dropdown riêng, không có nút `+N khác` để chọn thêm.
- Bộ lọc trạng thái hàng có thêm `Đã xoá KV` để xem các mã lịch sử có hậu tố `{DEL}`. Các mã này chỉ phục vụ đối soát/lịch sử bảng giá và chứng từ cũ, không được POS hoặc luồng vận hành mới dùng làm hàng bán.
- Cột lưới PriceBook MVP gồm `Mã hàng`, `Tên hàng`, `Giá nhập cuối`, các cột bảng giá đang chọn và `Cách bán`; không hiển thị cột `Trạng thái` hoặc `Thao tác`.
- Pattern thẻ chọn nhiều này là UI shared cho các bộ lọc khác sau này, không gắn chặt riêng với PriceBook.

| Loại | Quy tắc |
|---|---|
| Giá chung | Luôn có đúng một giá chung đang active trong mỗi xưởng |
| Bảng giá nhóm khách | Dùng để gán cho một hoặc nhiều nhóm khách |

Khách không gán nhóm dùng giá chung.

---

## 4. Cột bảng

| Cột | Mô tả |
|---|---|
| Mã bảng giá | Unique trong xưởng; bấm để mở chi tiết |
| Tên bảng giá | Tên dễ hiểu cho nhân viên |
| Loại | Giá chung hoặc bảng giá nhóm |
| Nhóm khách đang dùng | Danh sách nhóm khách gán bảng giá này |
| Số sản phẩm có giá | Số dòng giá đã khai báo |
| Trạng thái | Đang dùng hoặc Ngừng dùng |
| Cập nhật gần nhất | Thời gian sửa gần nhất |

---

## 5. Thao tác

| Thao tác | Hành vi |
|---|---|
| Tạo bảng giá | Tạo bảng giá mới, mặc định chưa gán nhóm khách |
| Mở chi tiết | Quản lý giá sản phẩm trong bảng |
| Đổi trạng thái | Bảng giá ngừng dùng không được gán mới cho nhóm khách |
| Gán nhóm khách | Chọn nhóm khách dùng bảng giá này |
| Cấu hình công thức | Tạo/sửa công thức gợi ý giá theo nhóm hàng khi module giá vốn đã sẵn sàng |

Quy tắc:

- Không cho tắt giá chung nếu đó là giá chung duy nhất.
- Nếu ngừng dùng một bảng giá đang được nhóm khách sử dụng, phải yêu cầu chọn bảng giá thay thế hoặc hủy thao tác.
- Không có chiết khấu riêng ở màn này trong Phase 1.

---

## 6. Khác KiotViet

KiotViet `Hàng hóa > Thiết lập giá` hiển thị bảng giá theo dạng lưới hàng hóa:

- chọn bảng giá ở bộ lọc bên trái, ví dụ `Giá chung`
- lọc theo nhóm hàng, tồn kho, điều kiện giá bán
- bảng gồm mã hàng, tên hàng, giá vốn, giá nhập cuối, cột giá của bảng đang chọn
- ô giá có thể nhập trực tiếp trên lưới
- có import/export và ẩn hiện cột
- màn đang thấy `496 hàng hóa`

KiotViet có thể hiển thị nhiều bảng giá ngang như `BG1`, `BG2`, `BG3`. QCVL dùng lưới bảng giá có cột bảng giá động để nhân viên xem các bảng giá đang active trên cùng một mặt bằng, nhưng không hard-code riêng `25/26/30/35/40`.

Export KiotViet ngày `2026-07-01` có các cột bảng giá thật:

- `Bảng giá chung` trong file KV, hiển thị trong QCVL là `Giá chung`
- `25`
- `26`
- `30`
- `35`
- `40`

Quy tắc hiển thị tên bảng giá:

- Import/backend vẫn được nhận tên nguồn từ KiotViet như `Bảng giá chung` hoặc tên không dấu cũ.
- UI QCVL phải hiển thị bảng giá mặc định là `Giá chung` thông qua helper dùng chung, không so chuỗi riêng trong từng page.
- POS, hóa đơn, báo giá in, import preview và PriceBook phải dùng cùng mapping này để không lệch nhãn.

Các nhóm khách trong export Khách hàng cũng dùng đúng các nhãn `25`, `26`, `30`, `35`, `40`, nên QCVL có thể import/migrate ban đầu theo các bảng giá này. UI vẫn nên cho đặt tên dễ hiểu hơn nếu Owner đổi tên sau.

QCVL ưu tiên:

- danh sách bảng giá riêng
- mở một bảng giá để sửa chi tiết
- POS tự resolve giá theo khách/nhóm khách
- lịch sử 5 giá gần đây theo khách + sản phẩm là nút gợi ý trong POS, không phải 5 cột trong bảng giá

KiotViet `Khuyến mại` có dữ liệu thật dạng `Hàng hóa - Giá bán theo số lượng mua` cho một số vật tư PVC/CPVC. QCVL MVP không làm module khuyến mại/campaign riêng. Nếu sau này cần bán theo bậc số lượng, đặc tả lại như quy tắc giá trong PriceBook, không kéo nguyên module marketing/khuyến mại retail vào POS.

Giá vốn trong KiotViet hiển thị để tham khảo trên lưới thiết lập giá. QCVL MVP hiển thị `Giá nhập cuối` trên lưới và không cho sửa giá này trực tiếp trong ô bảng giá.

Export bảng giá có nhiều dòng `Bảng giá chung = 0` và một dòng giá nhóm `26 = 0`. Theo quyết định hiện tại, giá `0` là giá hợp lệ nếu được khai báo; fallback về giá chung chỉ xảy ra khi dòng giá không tồn tại/để trống trong schema QCVL, không phải vì giá bằng `0`.

## 6. Công thức giá hiện hành

Công thức giá là luồng operator-facing V1. Người dùng mở `Tạo công thức cho bộ lọc này`,
nhập điều kiện rồi bấm `Xem trước`. Preview chỉ đọc dữ liệu; chưa ghi bảng giá và POS
chưa đổi giá ở bước này.

### Checklist thao tác V1

- [x] Chọn điều kiện: mã hàng chứa, tên hàng chứa và cách bán.
- [x] Chọn một trong hai cách cộng chi phí: số tiền cố định, hoặc số tiền + `% giá nhập cuối`.
- [x] Chọn lợi nhuận cố định hoặc các tier theo `Giá nhập cuối` với toán tử `<`, `<=`, `>`, `>=`, `=`.
- [x] Chọn điều chỉnh từng bảng giá active: số tiền hoặc phần trăm; giá trị âm hợp lệ nếu kết quả không âm.
- [x] Bấm `Xem trước` để xem hàng khớp, giá hiện tại, giá đề xuất và chênh lệch.
- [x] Bấm `Áp dụng công thức` để ghi **toàn bộ ô giá trong preview**. Server tính lại từ `products.latest_purchase_cost`; client không gửi giá đích để tránh sửa giá giả.
- [x] Sau apply thành công, UI tải lại lưới. POS chỉ đọc giá đã lưu trong `price_list_items`, nên chỉ đổi sau apply thành công.

### Công thức tính V1

```text
chi phí = cố định
hoặc chi phí = cố định + giá nhập cuối × phần trăm chi phí / 100

giá nền = giá nhập cuối + chi phí + tổng tier lợi nhuận khớp

giá bảng = giá nền + điều chỉnh số tiền
hoặc giá bảng = giá nền × (1 + điều chỉnh phần trăm / 100)
```

- `Giá nhập cuối` null được tính là `0`.
- Kết quả giữ tối đa hai chữ số thập phân; không có làm tròn ngầm lên `1.000đ`.
- Kết quả âm, bảng giá inactive/mất, sản phẩm inactive/mất, lựa chọn trùng hoặc lựa chọn ngoài preview đều bị từ chối.
- Apply dùng transaction; lỗi ở bất kỳ ô chọn nào rollback toàn bộ batch.
- Giá `0` là giá hợp lệ. Fallback POS chỉ xảy ra khi dòng giá không tồn tại, không phải vì giá bằng `0`.

### Giới hạn V1 và V2

V1 **không** lưu rule để chạy lại, không tự đổi giá khi giá nhập cuối đổi, không áp dụng theo nhóm hàng thực thể, không có policy làm tròn, không có lịch sử/audit rule riêng và không có chọn thủ công từng ô trong preview. Đây là V2; chỉ làm sau khi Owner chốt rule, rounding, audit và chính sách tự áp dụng.

## 7. Lớp giá đang dùng

| Lớp | Hiện trạng |
|---|---|
| Giá đã lưu | `price_list_items`; POS resolve theo khách/nhóm khách và bảng giá mặc định. |
| Preview công thức | Dữ liệu read-only, tính từ giá nhập cuối và filter V1. |
| Lịch sử giá khách | Gợi ý trong POS, không cập nhật ngược bảng giá. |

## 8. Acceptance checklist

- [x] Preview không mutation.
- [x] Apply chỉ ghi product/list nằm trong preview hiện hành.
- [x] Apply tự tính lại server-side; không tin giá do trình duyệt gửi.
- [x] Giá POS không đổi trước apply thành công.
- [x] Lỗi validation/stale không ghi một phần batch.
- [ ] V2: rule persisted, tự tính lại theo giá nhập, rounding policy, audit rule và chọn subset preview cần Owner decision.
