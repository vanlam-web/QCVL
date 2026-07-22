# Data Load Performance Design - Tối ưu tải dữ liệu tìm kiếm và chi tiết

> Cập nhật: 2026-07-22.
> Phạm vi: POS, Dashboard, Reports, Customers, Suppliers, Products, Price Book, Purchase Receipts, Sales Documents, Finance, Inventory, Admin.

## 1. Mục tiêu

Giảm thời gian chờ và giảm tải DB/API khi thao tác hằng ngày, nhưng không đổi công thức nghiệp vụ.

Mục tiêu cụ thể:

- Không tải danh sách lớn chỉ để lọc ở frontend.
- Không tải 1000-10000 dòng nếu màn hình chỉ hiển thị một phần nhỏ.
- Mở chi tiết theo tab: tab nào cần dữ liệu mới thì mới gọi API.
- POS và nhập hàng vẫn chọn nhanh được; không làm nhân viên phải bấm nhiều bước hơn.
- Dữ liệu công nợ vẫn lấy từ công thức chuẩn hiện có, không quay lại dùng mốc KiotViet.

## 2. Hiện Trạng Cần Tối Ưu

| Khu vực | Hiện trạng | Rủi ro tốc độ |
| --- | --- | --- |
| Dashboard | Tải sản phẩm `page_size=10000` để dựng thống kê/top sản phẩm | Nặng nhất khi danh mục lớn |
| Customers/POS chi tiết khách | Tải hóa đơn KH `page_size=1000` cho công nợ | Nặng khi khách nhiều lịch sử |
| Checkout cấn nợ cũ | Tải lịch sử nợ để tự phân bổ | Dễ chậm ở khách nhiều bill |
| Products detail | Tab tồn/BOM gọi thêm dữ liệu, phần BOM lấy product active `100` | Chấp nhận được nhưng cần lazy theo tab |
| Reports | Tải 4 nhóm dữ liệu song song, mỗi nhóm `100` | Chấp nhận tạm, về sau cần API tổng hợp |
| Export | Tải toàn bộ theo filter hiện tại | Đúng nghiệp vụ, nhưng cần progress/giới hạn nếu dữ liệu lớn |

## 3. Nguyên Tắc Thiết Kế

- Danh sách chính chỉ tải page đang xem, page size theo viewport hoặc lựa chọn người dùng.
- Search quản trị chỉ chạy khi bấm `Enter`; quick-pick dùng debounce `200ms`.
- Detail không dùng dữ liệu list để suy diễn nghiệp vụ nếu thiếu; mở detail thì gọi detail API.
- Tab chi tiết lazy load:
  - Tab `Thông tin`: dùng detail chính.
  - Tab `Công nợ`, `Lịch sử`, `Tồn kho`, `BOM`: gọi API riêng khi tab mở lần đầu.
  - Đổi đối tượng đang chọn thì hủy/bỏ qua request cũ.
- API chi tiết lớn phải có phân trang server, không trả 1000 dòng mặc định.
- API phục vụ tác vụ đặc biệt nên trả đúng phần cần dùng, ví dụ `open-debts` cho phân bổ nợ cũ.

## 4. Thiết Kế Theo Cụm

### 4.1. Dashboard

Hiện tại Dashboard lấy nhiều chứng từ rồi tải thêm product catalog `page_size=10000`.

Thiết kế mới:

- Thêm API summary/top phục vụ Dashboard.
- Dashboard chỉ gọi:
  - sales document activity page `20`.
  - purchase receipt activity page `20`.
  - dashboard summary/top product API.
- Không gọi `listProducts({ page_size: 10000 })` trong runtime Dashboard.

Acceptance:

- Mở Dashboard không có request sản phẩm `page_size=10000`.
- Các thẻ tổng quan/top vẫn hiển thị đủ như trước.

### 4.2. Công Nợ Khách Hàng Và POS Khách

Hiện tại mở công nợ khách/POS chi tiết khách tải hóa đơn KH `page_size=1000`.

Thiết kế mới:

- `getCustomerDebt(customerId)` tiếp tục là nguồn tổng nợ và ledger chuẩn.
- Thêm phân trang cho lịch sử hóa đơn/công nợ:
  - page đầu `20` hoặc `50`.
  - nút `Xem thêm` tải trang tiếp.
- UI chỉ hiển thị page đang xem, không cắt 1000 dòng ở frontend.
- Nếu cần tổng để hiện badge thì dùng field summary từ `getCustomerDebt`, không cần tải hết hóa đơn.

Acceptance:

- Mở chi tiết khách không gọi `listSalesDocuments page_size=1000`.
- Tab lịch sử vẫn xem tiếp được bằng phân trang/xem thêm.
- Tổng nợ không đổi so với công thức hiện tại.

### 4.3. Checkout Cấn Nợ Cũ

Hiện tại checkout cần biết hóa đơn cũ để phân bổ tiền dư/nợ cũ.

Thiết kế mới:

- Thêm API hoặc mở rộng API công nợ để trả danh sách hóa đơn còn nợ theo thứ tự cũ nhất trước.
- Input:
  - `customer_id`
  - `amount` nếu đang cần preview phân bổ theo số tiền.
  - `limit` mặc định hợp lý, ví dụ `50`.
- Backend phân bổ oldest-first và trả các dòng bị ảnh hưởng.
- Nếu số tiền lớn hơn 50 hóa đơn đầu, API trả `has_more=true`; UI có thể gọi tiếp hoặc backend tự mở rộng đến đủ tiền.

Acceptance:

- Tick `Cấn vào nợ cũ` không cần kéo 1000 hóa đơn về frontend.
- Số tiền dư vẫn tự nhảy vào ô `Thanh toán nợ cũ`.
- Phân bổ vẫn cũ nhất trước.

### 4.4. Products, Inventory, Purchase Receipts

Thiết kế mới:

- Giữ danh sách chính phân trang như hiện tại.
- Product detail:
  - Tab tồn gọi `listStockMovements` page `15`.
  - Rolls/sheets chỉ gọi khi tab/khu tương ứng cần hiển thị.
  - BOM chỉ gọi `getProductBom` khi mở tab BOM; danh sách component có search/paging nếu danh mục lớn.
- Purchase receipt create:
  - Quick-pick hàng/NCC giữ debounce `200ms`, page `20`.
  - Lookup ban đầu NCC `100` chỉ dùng để chọn nhanh mặc định; nếu chậm sẽ đổi sang API lấy NCC mặc định/đã chọn riêng.

Acceptance:

- Không tăng số request khi mở list.
- Detail chỉ gọi API của tab đã mở.

### 4.5. Reports

Reports hiện tải 4 nhóm dữ liệu, mỗi nhóm `100`.

Thiết kế mới giai đoạn 1:

- Giữ nguyên vì chưa phải điểm đau lớn.
- Không tăng `page_size`.

Thiết kế giai đoạn 2:

- Thêm API báo cáo tổng hợp theo khoảng ngày.
- Frontend nhận summary đã tính sẵn thay vì tự tổng hợp từ danh sách.

Acceptance:

- Reports không block ưu tiên 1.
- Khi dữ liệu lớn, chuyển sang summary API.

## 5. API Đề Xuất

Tên endpoint có thể điều chỉnh theo module hiện có.

```text
GET /api/v1/dashboard/summary
GET /api/v1/finance/customers/:customerId/debt-ledger?page=1&page_size=20
GET /api/v1/finance/customers/:customerId/open-debts?amount=70000&limit=50
GET /api/v1/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Quy tắc response:

- Có `items`, `page`, `page_size`, `total` hoặc `has_more`.
- Có summary riêng nếu UI cần tổng.
- Không trả dư trường lớn nếu list chỉ cần label/tổng.

## 6. Thứ Tự Làm

1. Dashboard bỏ `page_size=10000`, thay bằng summary/top API.
2. Customer/POS detail bỏ `page_size=1000`, chuyển sang page đầu + xem thêm.
3. Checkout cấn nợ cũ dùng API `open-debts`/allocation preview.
4. Product detail lazy load rõ theo tab.
5. Reports summary API nếu đo vẫn chậm.

## 7. Kiểm Thử

Test bắt buộc:

- Dashboard không gọi `listProducts page_size=10000`.
- POS/customer detail không gọi `listSalesDocuments page_size=1000`.
- Công nợ/tổng nợ giữ nguyên với khách có nhiều hóa đơn.
- Checkout phân bổ tiền vào bill cũ nhất trước.
- Search Enter-only và quick-pick debounce không bị đổi.

Kiểm browser:

- Mở `/pos`, tìm khách, mở chi tiết khách.
- Tick `Cấn vào nợ cũ`, nhập tiền dư.
- Mở `/dashboard`.
- Mở `/customers`, chọn khách nhiều lịch sử.

## 8. Ngoài Phạm Vi

- Không đổi công thức công nợ.
- Không đổi quy tắc mã phiếu.
- Không đổi giao diện lớn.
- Không deploy NAS từ máy ngoài LAN.

## 9. Rủi Ro Và Cách Chặn

| Rủi ro | Cách chặn |
| --- | --- |
| Tổng nợ lệch khi không tải hết hóa đơn | Tổng lấy từ backend ledger summary, không tính từ page hiện tại |
| Tab lịch sử thiếu dữ liệu | Có phân trang/xem thêm rõ |
| Checkout phân bổ thiếu hóa đơn khi nhiều bill | Backend phân bổ theo amount hoặc trả `has_more` |
| Dashboard thiếu số liệu top | Tạo API summary trả đúng chỉ số đang dùng |
