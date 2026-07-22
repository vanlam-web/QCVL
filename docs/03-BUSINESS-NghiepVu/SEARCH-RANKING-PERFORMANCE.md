# SEARCH-RANKING-PERFORMANCE - Quy tắc tìm kiếm, xếp hạng và tốc độ

> Cập nhật: 2026-07-22.
> Phạm vi: POS, nhập hàng, khách hàng, nhà cung cấp, hàng hóa, chứng từ, sổ quỹ và các ô tìm kiếm quản trị dùng dữ liệu lớn.

## 1. Mục tiêu

Tìm kiếm phải trả kết quả đúng nghiệp vụ, dễ chọn và không làm chậm máy chủ khi dữ liệu lớn.

Chuẩn chung:

- Hàng từng được chọn nhiều lần được ưu tiên cao nhất trong các màn hình chọn nhanh.
- Sau ưu tiên chọn nhiều, mã được ưu tiên trước tên.
- POS và nhập hàng không hiện dữ liệu đã xoá hoặc ngừng hoạt động.
- Trang quản trị không tìm theo từng ký tự; chỉ chạy tìm khi bấm `Enter`.

## 2. Phân loại ô tìm kiếm

| Nhóm | Màn hình | Cách chạy tìm | Lý do |
| --- | --- | --- | --- |
| Chọn nhanh | POS tìm hàng, POS chọn khách, nhập hàng chọn NCC, nhập hàng tìm hàng | Tìm sống có giới hạn, có debounce ngắn | Nhân viên cần chọn nhanh khi bán/nhập |
| Danh sách quản trị | Khách hàng, NCC, hàng hóa, phiếu nhập, hóa đơn/chứng từ, sổ quỹ, người dùng | Gõ xong bấm `Enter` | Tránh gọi API/DB theo từng ký tự |
| Bộ lọc phụ | Trạng thái, ngày, nhóm, người tạo, khoảng tiền | Đổi là áp dụng ngay | Đây là lựa chọn có chủ ý, ít nhiễu hơn gõ text |

Nút `Xóa tìm kiếm` luôn reset ngay, không cần bấm `Enter`.

## 3. Quy tắc lọc trạng thái

| Ngữ cảnh | Dữ liệu được hiện | Dữ liệu không được hiện |
| --- | --- | --- |
| POS chọn khách | Khách `active` | Khách đã xoá, ngừng hoạt động, mã/tên có hậu tố `{DEL}` |
| POS tìm hàng | Hàng/dịch vụ `active` và bán được | Hàng đã xoá, ngừng kinh doanh |
| Nhập hàng chọn NCC | NCC `active` | NCC đã xoá, ngừng hoạt động |
| Nhập hàng tìm hàng | Hàng/vật tư `active` và được phép nhập | Hàng đã xoá, ngừng kinh doanh |
| Trang quản trị | Theo bộ lọc trạng thái đang chọn | Không tự giấu nếu người dùng chọn `Tất cả` hoặc `Đã xoá` |

Không dùng hậu tố `{DEL}` để quyết định nghiệp vụ nếu DB có trường trạng thái. Hậu tố `{DEL}` chỉ là dấu vết import/hiển thị cũ; dữ liệu lọc phải dựa trên `status`, `is_active`, `deleted_at` hoặc cờ tương đương trong bảng nguồn.

## 4. Xếp hạng kết quả

Mọi search có kết quả nhiều dòng nên xếp theo điểm chung:

| Ưu tiên | Điều kiện | Ví dụ |
| --- | --- | --- |
| 1 | Lượt chọn nhiều của user hiện tại | Khách/hàng/NCC hay chọn có thể đứng trên mã khớp đúng |
| 2 | Mã khớp chính xác | Gõ `KH000384` ưu tiên `KH000384` nếu không có mục hay chọn hơn |
| 3 | Mã bắt đầu bằng từ khóa | Gõ `KH0003` ưu tiên các mã `KH0003...` |
| 4 | Mã chứa từ khóa | Gõ `0384` vẫn thấy `KH000384` |
| 5 | Tên bắt đầu bằng từ khóa, không dấu | Gõ `kl` ra `KL2`, `KL3` |
| 6 | Tên chứa từ khóa, không dấu | Gõ `bat` ra `In bạt` |
| 7 | Trường phụ chứa từ khóa | SĐT, MST, ghi chú, nội dung phiếu |
| 8 | Mới giao dịch/cập nhật gần hơn | Chỉ dùng khi các điểm trên bằng nhau |

Nguyên tắc quan trọng:

- Trong màn hình chọn nhanh, lượt chọn nhiều được phép đẩy kết quả hay dùng lên trên cả kết quả mã khớp đúng.
- Trong trang quản trị dạng danh sách, không dùng lượt chọn nhiều để đảo thứ tự mặc định trừ khi sau này Owner chốt thêm.
- Tìm không dấu áp dụng cho tên và ghi chú; mã giữ nguyên ký tự nhưng so sánh không phân biệt hoa/thường.
- Kết quả không hợp lệ trạng thái bị loại trước khi xếp hạng.

## 5. Lưu lịch sử chọn nhiều

Nên lưu lịch sử chọn vào DB để hai máy dùng chung dữ liệu.

Bảng đề xuất: `search_selection_stats`.

| Cột | Mô tả |
| --- | --- |
| `organization_id` | Tổ chức |
| `user_id` | Người dùng chọn |
| `entity_type` | Chỉ lưu `customer`, `supplier`, `product` |
| `entity_id` | ID đối tượng |
| `select_count` | Số lần chọn |
| `last_selected_at` | Lần chọn gần nhất |

Khóa unique: `(organization_id, user_id, entity_type, entity_id)`.

Chốt hiện tại: ưu tiên theo từng `user_id`. Sau này nếu cần gợi ý chung toàn cửa hàng, có thể cộng thêm điểm cấp tổ chức nhưng không thay thế điểm theo user.

Không lưu lịch sử chọn cho phiếu, chứng từ, sổ quỹ hoặc người dùng trong giai đoạn này.

### 5.1. Nơi ghi nhớ phù hợp hệ thống

Ghi nhớ bằng DB, không dùng `localStorage`, để hai máy dùng chung dữ liệu sau khi cùng trỏ về NAS DB.

Thiết kế API:

- Khi user chọn khách/NCC/hàng trong màn hình chọn nhanh, frontend gọi một API ghi nhận chọn.
- API chỉ nhận `entity_type` và `entity_id`; user hiện tại lấy từ phiên đăng nhập, organization lấy từ phiên làm việc.
- Backend tự tăng `select_count` và cập nhật `last_selected_at`.
- Nếu dòng đã có thì cộng thêm 1; nếu chưa có thì tạo mới.
- Nếu đối tượng đã bị xoá/ngừng hoạt động sau này, search vẫn lọc bỏ theo trạng thái trước khi áp dụng điểm hay chọn.

Endpoint đề xuất:

```text
POST /api/v1/search-selection-stats
```

Body:

```json
{ "entity_type": "customer", "entity_id": "customer-id" }
```

Backend validate:

- `entity_type` chỉ nhận `customer`, `supplier`, `product`.
- `entity_id` phải thuộc đúng tổ chức.
- Không ghi nhận nếu đối tượng không tồn tại.
- Không ghi nhận nếu đối tượng đã xoá/ngừng hoạt động trong ngữ cảnh chọn nhanh.

Ghi nhận lượt chọn khi:

- POS chọn khách.
- POS chọn hàng vào giỏ.
- Nhập hàng chọn NCC.
- Nhập hàng chọn hàng vào phiếu.
- Không ghi nhận khi chỉ mở phiếu/chứng từ/sổ quỹ trong danh sách quản trị.

## 6. Tối ưu tốc độ

### 6.1. Frontend

- Search quản trị chỉ gọi API khi bấm `Enter`, không gọi theo từng ký tự.
- Search chọn nhanh dùng debounce ngắn khoảng `150-300ms`.
- Chỉ gửi request khi từ khóa sau trim đủ ý nghĩa:
  - mã: cho phép từ 1 ký tự vì nhân viên hay gõ mã ngắn
  - tên: nên từ 2 ký tự trở lên nếu dữ liệu lớn
- Hủy/bỏ qua kết quả request cũ nếu người dùng đã gõ tiếp.
- Dropdown chỉ lấy trang đầu, giới hạn `8-20` kết quả theo ngữ cảnh.
- Không load toàn bộ danh sách về frontend để lọc nếu bảng đã lớn.

### 6.2. Backend/API

- API search phải nhận `search`, `status`, `page`, `page_size`.
- Tất cả danh sách lớn phải phân trang tại SQL.
- Query phải lọc trạng thái trước, rồi xếp hạng.
- Không dựng summary hoặc hydrate chi tiết bằng cách load toàn bộ bảng khi chỉ cần dropdown/danh sách.
- Không chạy migration/ensure schema trong hot read path.

### 6.3. Database

Index tối thiểu:

- B-tree theo `organization_id`, `status`, `code`.
- B-tree hoặc expression index cho `lower(code)`.
- Cột tên nên có bản normalized không dấu nếu cần tìm nhanh tiếng Việt.
- Với dữ liệu rất lớn, cân nhắc trigram/full-text cho tên/ghi chú, nhưng không dùng thay thế ưu tiên mã.
- `search_selection_stats` cần index `(organization_id, user_id, entity_type, entity_id)` và `(organization_id, user_id, entity_type, select_count desc, last_selected_at desc)`.

### 6.4. Thứ tự triển khai hiệu năng

1. Chặn live search ở trang quản trị.
2. Lọc active-only đúng cho POS/nhập hàng.
3. Chuẩn hóa rank theo lịch sử chọn, rồi tới mã trước tên ở backend.
4. Thêm bảng lịch sử chọn và cộng điểm khi chọn.
5. Thêm index/normalized search nếu đo thấy chậm.
6. Đo lại bằng browser và API timing trên dữ liệu NAS.

## 7. Acceptance

Một search đạt chuẩn khi:

- POS không hiện khách/hàng đã xoá hoặc ngừng hoạt động.
- Nhập hàng không hiện NCC/hàng đã xoá hoặc ngừng hoạt động.
- Trong POS/nhập hàng, mục đã chọn nhiều lần bởi user hiện tại được phép đứng trên cả mục khớp mã đúng.
- Trong trang quản trị, mã chính xác vẫn được ưu tiên theo bộ lọc đang chọn vì không dùng lịch sử chọn nhiều để đảo thứ tự.
- Trang quản trị không đổi danh sách hoặc gọi API khi chỉ mới gõ chữ.
- Bấm `Enter` ở trang quản trị mới áp dụng tìm kiếm.
- Clear search reset ngay.
- Danh sách lớn không bị tải toàn bộ về frontend chỉ để search.

## 8. Ghi chú triển khai

Không tạo công thức search riêng lẻ cho từng trang nếu có thể dùng service/ranking chung. Mỗi module chỉ nên khai báo:

- loại đối tượng
- trường được tìm
- trường trạng thái hợp lệ
- giới hạn kết quả
- có dùng lịch sử chọn hay không

Phần còn lại dùng chung một thuật toán rank để tránh mỗi màn hình một kiểu.
