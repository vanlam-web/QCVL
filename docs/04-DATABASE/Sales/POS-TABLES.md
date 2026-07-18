# POS-TABLES — Bảng phục vụ màn hình POS

> **Nguồn:** Cập nhật theo Business Sales `POS-CUSTOMER.md`, `POS-PRICING.md`, `POS-ORDER-LIFECYCLE.md`, `POS-ORDER-CALC.md`, `POS-CHECKOUT.md`

---

## 1. Phạm vi

Tài liệu này là Source of Truth cho cấu trúc dữ liệu Sales phục vụ Customer, Product, Pricing, báo giá và hóa đơn POS Phase 1.

Business Rule liên quan:

- [POS-CUSTOMER.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md)
- [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md)
- [POS-ORDER-LIFECYCLE.md](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md)
- [POS-ORDER-CALC.md](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md)
- [POS-CHECKOUT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md)

Không chốt trong file này:

- Chi tiết Finance, Debt, Cashbook, BOM và stock movement
- API request/response

---

## 2. Bảng `public.customers` — Khách hàng

### Mục đích

Lưu hồ sơ khách hàng phục vụ POS: chọn khách, chống trùng SĐT/mã khách và xác định nhóm khách.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã khách; nhập tay hoặc tự sinh dạng `KH000001` |
| `name` | `text` | ❌ | Tên khách hàng |
| `phone` | `text` | ✅ | SĐT hiển thị theo người dùng nhập |
| `phone_normalized` | `text` | ✅ | SĐT đã chuẩn hóa để chống trùng |
| `customer_group_id` | `uuid` | ✅ | FK → `public.customer_groups.id`; null nghĩa là dùng giá chung |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Quan hệ

```text
public.customers.organization_id
    -> public.organizations.id

public.customers.customer_group_id
    -> public.customer_groups.id
```

### Ràng buộc

- `UNIQUE (organization_id, code)`
- `phone_normalized` được phép null.
- Không cho trùng `phone_normalized` trong cùng `organization_id` khi `phone_normalized` không null.
- `name` không được rỗng sau khi trim.
- `code` không được rỗng sau khi trim.

### Index

- `idx_customers_org_name` trên `(organization_id, name)`
- `idx_customers_org_group` trên `(organization_id, customer_group_id)`
- `idx_customers_org_phone_normalized` trên `(organization_id, phone_normalized)` với điều kiện `phone_normalized IS NOT NULL`

---

## 3. Bảng `public.customer_groups` — Nhóm khách

### Mục đích

Lưu nhóm khách để xác định bảng giá mặc định áp dụng cho khách thuộc nhóm đó.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã nhóm khách |
| `name` | `text` | ❌ | Tên nhóm khách |
| `price_list_id` | `uuid` | ❌ | FK → `public.price_lists.id` |
| `is_active` | `boolean` | ❌ | Nhóm còn được dùng để gán cho khách mới |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Quan hệ

```text
public.customer_groups.organization_id
    -> public.organizations.id

public.customer_groups.price_list_id
    -> public.price_lists.id
```

### Ràng buộc

- `UNIQUE (organization_id, code)`
- `name` không được rỗng sau khi trim.
- `price_list_id` phải trỏ tới bảng giá cùng `organization_id`.

### Index

- `idx_customer_groups_org_active` trên `(organization_id, is_active)`
- `idx_customer_groups_org_price_list` trên `(organization_id, price_list_id)`

---

## 4. Bảng `public.price_lists` — Bảng giá

### Mục đích

Lưu đầu bảng giá. Chi tiết giá theo sản phẩm nằm ở `public.price_list_items`.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã bảng giá |
| `name` | `text` | ❌ | Tên bảng giá |
| `is_default` | `boolean` | ❌ | Giá chung mặc định của organization |
| `is_active` | `boolean` | ❌ | Bảng giá còn được áp dụng |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Ràng buộc

- `UNIQUE (organization_id, code)`
- Mỗi organization có đúng một giá chung đang active tại một thời điểm.
- `name` không được rỗng sau khi trim.

### Index

- `idx_price_lists_org_active` trên `(organization_id, is_active)`
- `idx_price_lists_org_default` trên `(organization_id, is_default)`

---

## 5. Bảng `public.price_list_items` — Chi tiết bảng giá

### Mục đích

Lưu đơn giá của từng sản phẩm trong từng bảng giá. Bảng này thay thế cách lưu mảng JSONB để dễ kiểm tra trùng, query và fallback về giá chung.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `price_list_id` | `uuid` | ❌ | FK → `public.price_lists.id` |
| `product_id` | `uuid` | ❌ | FK → `public.products.id` |
| `unit_price` | `numeric(12,0)` | ❌ | Giá bán theo đơn vị bán của sản phẩm |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Quan hệ

```text
public.price_list_items.price_list_id
    -> public.price_lists.id

public.price_list_items.product_id
    -> public.products.id
```

### Ràng buộc

- `UNIQUE (price_list_id, product_id)`
- `unit_price >= 0`
- `price_list_id` và `product_id` phải thuộc cùng `organization_id`.
- Với sản phẩm bán theo `m tới`, `unit_price` là giá cho `1 m tới`.

### Index

- `idx_price_list_items_list_product` trên `(price_list_id, product_id)`
- `idx_price_list_items_product` trên `(organization_id, product_id)`

---

## 6. Bảng `public.products` — Sản phẩm / dịch vụ

### Mục đích

Lưu danh sách sản phẩm/dịch vụ phục vụ POS và trang Hàng hóa.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã hàng hóa/dịch vụ |
| `name` | `text` | ❌ | Tên hàng hóa/dịch vụ |
| `status` | `text` | ❌ | `active` hoặc `inactive` |
| `product_group_id` | `uuid` | ✅ | FK → `public.product_groups.id`; nếu trống khi tạo thì backend gán nhóm mặc định |
| `unit_name` | `text` | ❌ | Tên đơn vị hiển thị, ví dụ `m²`, `m`, `cái`, `bộ` |
| `sell_method` | `text` | ❌ | Cách tính bán: `quantity`, `area_m2`, `linear_m`, `sheet`, `combo` |
| `product_kind` | `text` | ❌ | Loại hàng nghiệp vụ: `goods`, `service`, `auxiliary_material`, `roll`, `sheet`, `combo` |
| `inventory_shape` | `text` | ❌ | Kiểu tồn kho: `normal`, `roll`, `sheet` |
| `track_inventory` | `boolean` | ❌ | Có quản lý tồn kho hay không; dịch vụ/combo thường là `false` |
| `latest_purchase_cost` | `numeric(12,0)` | ✅ | Giá vốn/giá nhập cuối gần nhất để tham khảo và tính giá |
| `latest_purchase_cost_at` | `timestamptz` | ✅ | Thời điểm cập nhật giá vốn/giá nhập cuối |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Ràng buộc

- `UNIQUE (organization_id, code)`
- `status IN ('active', 'inactive')`
- `sell_method IN ('quantity', 'area_m2', 'linear_m', 'sheet', 'combo')`
- `product_kind IN ('goods', 'service', 'auxiliary_material', 'roll', 'sheet', 'combo')`
- `inventory_shape IN ('normal', 'roll', 'sheet')`
- `track_inventory = false` cho `product_kind IN ('service', 'combo')` trong nghiệp vụ hiện tại.
- `latest_purchase_cost IS NULL OR latest_purchase_cost >= 0`
- `name` không được rỗng sau khi trim.
- `unit_name` không được rỗng sau khi trim.
- POS bán hàng chỉ tìm và chọn sản phẩm có `status = 'active'`.

### Index

- `idx_products_org_status` trên `(organization_id, status)`
- `idx_products_org_code` trên `(organization_id, code)`
- `idx_products_org_name` trên `(organization_id, name)`
- `idx_products_org_group` trên `(organization_id, product_group_id)`
- `idx_products_org_kind` trên `(organization_id, product_kind)`
- `idx_products_org_inventory_shape` trên `(organization_id, inventory_shape)`
- Cần index hoặc cột phụ phục vụ tìm kiếm không dấu khi triển khai.

### Ghi chú đơn vị

- `product_kind` trả lời câu hỏi "hàng này thuộc loại nghiệp vụ nào": hàng thường, dịch vụ, vật tư phụ, cuộn, tấm hoặc combo.
- `inventory_shape` trả lời câu hỏi "tồn kho được quản lý theo kiểu nào": tổng thường, từng cuộn, hoặc từng tấm/tấm lỡ.
- `sell_method` trả lời câu hỏi "POS tính tiền/trừ kho theo công thức nào": số lượng, m², mét tới, tấm hoặc combo.
- `sell_method = 'linear_m'` dùng cho sản phẩm bán theo mét tới; `unit_price` trong `price_list_items` là giá cho `1 m tới`.
- `Cuộn` không phải đơn vị bán trực tiếp; hàng cuộn thường có `product_kind = 'roll'`, `inventory_shape = 'roll'`, `sell_method = 'linear_m'`.
- Hàng tấm thường có `product_kind = 'sheet'`, `inventory_shape = 'sheet'`, `sell_method = 'sheet'`.
- Dịch vụ có `product_kind = 'service'`, `track_inventory = false`; không quản lý tồn.
- Combo có `product_kind = 'combo'`, `sell_method = 'combo'`, `track_inventory = false`; khi bán trừ tồn vào vật tư cấu thành theo BOM, không trừ tồn mã combo.
- Vật tư phụ có `product_kind = 'auxiliary_material'`; vẫn quản lý tồn như hàng thường nhưng được nhận diện riêng trong BOM/khui vật tư.
- Quản lý tồn chi tiết theo cuộn/tấm/lot thuộc Inventory; bảng `products` chỉ giữ metadata để lọc, tạo hàng và tính POS.

### Import KiotViet Phase 1

- Khóa upsert sản phẩm: `UNIQUE (organization_id, code)`, trong đó `code` lấy từ cột `Mã hàng`.
- Import nhiều lần được phép. Lần sau cập nhật `name`, `status`, `product_group_id`, `unit_name`, `sell_method`, `product_kind`, `inventory_shape`, `track_inventory`, `latest_purchase_cost` và `updated_at`.
- `products.created_at` của hàng import từ KiotViet lưu `Thời gian tạo` gốc trong file KV, không phải thời điểm import. Import parser phải nhận cả Excel serial number và text date. Lần import sau được phép cập nhật `products.created_at` theo source time hợp lệ để sửa dữ liệu cũ từng bị ghi theo `now()`.
- `latest_purchase_cost_at` chỉ đổi khi `latest_purchase_cost` đổi.
- `Giá bán` ghi vào `price_list_items` của bảng giá mặc định, không ghi vào `products`.
- `Tồn kho` ghi vào `inventory_provisional_balances` với `source_type = kiotviet_import`; không tự tạo cuộn/tấm vật lý và không ghi `stock_movements` từ số tổng này.
- `Hàng thành phần` ghi thành BOM nháp (`product_boms.status = draft`) để rà soát; không tự active nên POS chưa dùng để trừ kho.
- Chưa ghi `Dự kiến hết hàng` trong phase này.
- Nếu file thiếu `ĐVT`, import ghi `unit_name = 'Cần cập nhật'` thay vì `NULL`. `unit_name` vẫn là trường bắt buộc để POS và danh sách hàng hóa không lỗi hiển thị.
- Không tự xóa sản phẩm không còn xuất hiện trong file KiotViet mới.
- Tùy chọn xóa dữ liệu mẫu chỉ được xóa các mã demo đã biết (`DEV20-SP-%`, `MICA-3MM`, `DECAL-PP`, `CUT-CNC`) khi không có tham chiếu ở `order_items`, `purchase_receipt_items`, `stock_movements`, `product_boms`, `product_bom_items`, `price_list_items`.

---

## 6.1. Bảng `public.product_groups` — Nhóm hàng

### Mục đích

Lưu nhóm hàng phục vụ import KiotViet, lọc danh mục hàng hóa và fallback nhóm mặc định.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã nhóm hàng |
| `name` | `text` | ❌ | Tên nhóm hàng |
| `is_default` | `boolean` | ❌ | Nhóm mặc định, tên nghiệp vụ `Giá chung` |
| `is_active` | `boolean` | ❌ | Còn dùng hay ngừng dùng |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Ràng buộc

- `UNIQUE (organization_id, code)`
- Mỗi organization chỉ có một nhóm mặc định đang hoạt động.
- `products.product_group_id` tham chiếu cùng organization.

### Index

- `product_groups_one_active_default_per_org` trên `(organization_id)` với điều kiện `is_default = true and is_active = true`
- `idx_product_groups_org_active` trên `(organization_id, is_active)`

---

## 7. Bảng `public.customer_product_price_history` — Lịch sử giá riêng

### Mục đích

Lưu giá sửa tay từng bán cho một cặp khách hàng + sản phẩm, để lần sau nhân viên có thể chọn lại tối đa 5 giá gần nhất.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `customer_id` | `uuid` | ❌ | FK → `public.customers.id` |
| `product_id` | `uuid` | ❌ | FK → `public.products.id` |
| `unit_price` | `numeric(12,0)` | ❌ | Giá sửa tay đã bán |
| `sold_at` | `timestamptz` | ❌ | Thời điểm phát sinh giá này |
| `created_at` | `timestamptz` | ❌ | Thời điểm ghi nhận |

### Quan hệ

```text
public.customer_product_price_history.customer_id
    -> public.customers.id

public.customer_product_price_history.product_id
    -> public.products.id
```

### Ràng buộc

- `unit_price >= 0`
- `customer_id` và `product_id` phải thuộc cùng `organization_id`.
- Lịch sử giá không thay thế bảng giá mặc định.

### Index

- `idx_customer_product_price_history_recent` trên `(organization_id, customer_id, product_id, sold_at DESC)`

## 8. Bảng `public.pos_product_usage` — Lượt dùng sản phẩm nhanh POS

### Mục đích

Lưu số lần sản phẩm xuất hiện trong báo giá/hóa đơn đã lưu để lưới sản phẩm nhanh POS tự đưa hàng hay dùng lên trước. Đây là dữ liệu server, không phải cache trình duyệt, nên dùng chung cho mọi máy POS trong cùng organization.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `product_id` | `uuid` | ❌ | FK → `public.products.id` |
| `usage_count` | `integer` | ❌ | Tổng lượt dùng đã ghi nhận |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Ràng buộc

- `PRIMARY KEY (organization_id, product_id)`
- `usage_count >= 0`
- Backend chỉ cộng lượt sau khi lưu báo giá hoặc checkout hóa đơn thành công.
- Nếu chứng từ bị sửa/hủy sau này, không trừ ngược lượt dùng trong phạm vi MVP; đây là tín hiệu ưu tiên thao tác, không phải báo cáo doanh số.

### Index

- `pos_product_usage_rank_idx` trên `(organization_id, usage_count DESC, product_id)`

## 9. Bảng `public.orders` — Báo giá và hóa đơn bán hàng

### Mục đích

Lưu chứng từ đã được server ghi nhận: báo giá `BG...` và hóa đơn bán hàng `HD...`.

Hóa đơn nháp POS Phase 2 vẫn lưu local theo máy POS, không tạo bản ghi `orders` cho đến khi nhân viên lưu báo giá hoặc checkout thành công.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `code` | `text` | ❌ | Mã chứng từ, ví dụ `BG000001`, `HD000001` |
| `order_type` | `text` | ❌ | `quote` hoặc `invoice` |
| `status` | `text` | ❌ | Trạng thái chứng từ |
| `source_quote_id` | `uuid` | ✅ | FK → `public.orders.id`; hóa đơn sinh từ báo giá |
| `base_code` | `text` | ❌ | Mã gốc của chuỗi chứng từ, ví dụ `HD000123` |
| `revision_no` | `integer` | ❌ | Số lần sửa; bản gốc là `0`, bản sửa đầu là `1` |
| `revised_from_order_id` | `uuid` | ✅ | FK → `public.orders.id`; chứng từ cũ gần nhất nếu đây là bản sửa |
| `replaced_by_order_id` | `uuid` | ✅ | FK → `public.orders.id`; chứng từ mới thay thế nếu bản này bị hủy do sửa |
| `customer_id` | `uuid` | ✅ | FK → `public.customers.id`; POS/báo giá/hóa đơn không chọn khách phải resolve về `khachle - Khách lẻ` trước khi lưu |
| `customer_snapshot` | `jsonb` | ❌ | Snapshot khách hàng tại thời điểm lưu; với khách lẻ dùng snapshot của `khachle` |
| `price_list_id` | `uuid` | ✅ | FK → `public.price_lists.id`; bảng giá áp dụng nếu có |
| `subtotal_amount` | `numeric(12,0)` | ❌ | Tổng tiền hàng trước chiết khấu |
| `discount_amount` | `numeric(12,0)` | ❌ | Tổng chiết khấu trên chứng từ |
| `total_amount` | `numeric(12,0)` | ❌ | Khách cần trả sau chiết khấu |
| `paid_amount` | `numeric(12,0)` | ❌ | Tổng tiền đã áp vào hóa đơn này; không phải tổng tiền khách đưa |
| `debt_amount` | `numeric(12,0)` | ❌ | Số tiền còn nợ của hóa đơn này |
| `change_returned_amount` | `numeric(12,0)` | ❌ | Tiền thừa trả lại khách, không ghi thành trả trước trong MVP |
| `payment_status` | `text` | ❌ | `not_applicable`, `unpaid`, `partial`, `paid` |
| `note` | `text` | ✅ | Ghi chú đơn |
| `cancel_reason_type` | `text` | ✅ | `user_cancelled` hoặc `revised`; null nếu chưa hủy |
| `revision_reason_code` | `text` | ✅ | Lý do nhanh khi tạo bản sửa: `wrong_price`, `wrong_dimension`, `wrong_customer`, `customer_changed_mind`, `other` |
| `revision_reason_note` | `text` | ✅ | Ghi chú thêm khi tạo bản sửa; bắt buộc nếu `revision_reason_code = 'other'` |
| `cancelled_at` | `timestamptz` | ✅ | Thời điểm hủy nếu có |
| `created_by` | `uuid` | ❌ | FK → `public.profiles.id` |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |
| `updated_at` | `timestamptz` | ❌ | Thời điểm cập nhật gần nhất |

### Ràng buộc

- `UNIQUE (organization_id, code)`
- `order_type IN ('quote', 'invoice')`
- Với `order_type = 'quote'`, `code` dùng prefix `BG`.
- Với `order_type = 'invoice'`, `code` dùng prefix `HD`.
- `status` hợp lệ theo `order_type`.
- Runtime POS không tạo bucket `customer_id = null` cho khách lẻ. Nếu Frontend bỏ trống khách hàng, Backend dùng `public.resolve_sales_customer_id(...)` để gán `khachle`.
- `subtotal_amount >= 0`
- `discount_amount >= 0`
- `total_amount >= 0`
- `paid_amount >= 0`
- `debt_amount >= 0`
- `change_returned_amount >= 0`
- `discount_amount <= subtotal_amount`
- `total_amount = subtotal_amount - discount_amount`
- `source_quote_id` nếu có phải trỏ tới `orders` cùng organization và `order_type = 'quote'`.
- `customer_snapshot` bắt buộc để giữ lịch sử ngay cả khi hồ sơ khách thay đổi.
- `payment_status IN ('not_applicable', 'unpaid', 'partial', 'paid')`
- Với `order_type = 'quote'`, `paid_amount = 0`, `debt_amount = 0`, `change_returned_amount = 0`, `payment_status = 'not_applicable'`.
- Với `order_type = 'invoice'`, `paid_amount <= total_amount` và `debt_amount = total_amount - paid_amount`.
- Với `order_type = 'invoice'` và `debt_amount = 0`, `payment_status = 'paid'`.
- Với `order_type = 'invoice'`, nếu `debt_amount > 0` và `paid_amount > 0` thì `payment_status = 'partial'`.
- Với `order_type = 'invoice'`, nếu `debt_amount > 0` và `paid_amount = 0` thì `payment_status = 'unpaid'`.
- Nếu `status = 'cancelled'`, `cancel_reason_type` bắt buộc.
- `cancel_reason_type IN ('user_cancelled', 'revised')` khi không null.
- `revision_reason_code IN ('wrong_price', 'wrong_dimension', 'wrong_customer', 'customer_changed_mind', 'other')` khi không null.
- Nếu `revision_reason_code = 'other'`, `revision_reason_note` bắt buộc.
- `revision_no >= 0`
- `base_code` không được rỗng sau khi trim.
- Với bản gốc, `revision_no = 0`, `code = base_code`, `revised_from_order_id` null.
- Với bản sửa, `revision_no > 0`, `code = base_code || '.' || LPAD(revision_no, 2, '0')`, `revised_from_order_id` bắt buộc.
- `revised_from_order_id` và `replaced_by_order_id` nếu có phải cùng `organization_id`, cùng `order_type` và cùng `base_code`.

### Trạng thái khởi điểm

| order_type | status | Ý nghĩa |
|---|---|---|
| `quote` | `active` | Báo giá đang còn hiệu lực để mở lại/sửa/chuyển hóa đơn |
| `quote` | `converted` | Báo giá đã được chuyển thành hóa đơn |
| `quote` | `cancelled` | Báo giá đã hủy |
| `invoice` | `completed` | Hóa đơn bán hàng đã checkout thành công |
| `invoice` | `cancelled` | Hóa đơn đã hủy/đảo theo nghiệp vụ tương ứng |

### Quy tắc sửa chứng từ đã chốt

- Không sửa đè dữ liệu chứng từ đã chốt.
- Khi sửa hóa đơn đã checkout, hệ thống tạo chứng từ mới với `base_code` giữ nguyên và `revision_no` tăng dần.
- Ví dụ: bản gốc `HD000123`; sửa lần 1 tạo `HD000123.01`; sửa lần 2 tạo `HD000123.02`.
- Bản cũ chuyển `status = 'cancelled'`, `cancel_reason_type = 'revised'`, và trỏ `replaced_by_order_id` tới bản mới.
- Bản mới trỏ `revised_from_order_id` tới bản cũ gần nhất, đồng thời lưu `revision_reason_code` và `revision_reason_note`.
- Hủy hóa đơn không tạo bản sửa dùng `cancel_reason_type = 'user_cancelled'`.
- Các tác động đảo kho, đảo tiền và đảo công nợ không được sửa trực tiếp vào dòng lịch sử cũ; domain Inventory/Finance phải tạo giao dịch đảo hoặc giao dịch bổ sung để truy vết.
- Đảo kho do sửa/hủy hóa đơn dùng `stock_movements.movement_type = 'invoice_reversal'`; nếu bản sửa ghi lại tồn theo hóa đơn mới thì dùng movement bán hàng chính thức tương ứng, hoặc `invoice_revision` nếu cần phân biệt rõ với checkout thường.
- Nhân viên nội bộ được sửa/hủy trong 10 ngày; sau 10 ngày chỉ quản lý/admin hoặc quyền mạnh tương ứng.

### Index

- `idx_orders_org_type_status` trên `(organization_id, order_type, status)`
- `idx_orders_org_customer` trên `(organization_id, customer_id)`
- `idx_orders_org_created_at` trên `(organization_id, created_at DESC)`
- `idx_orders_source_quote` trên `(organization_id, source_quote_id)` với điều kiện `source_quote_id IS NOT NULL`
- `orders_org_base_revision_idx` trên `(organization_id, base_code, revision_no)`

Chưa thêm index riêng cho `revised_from_order_id` và `replaced_by_order_id` trong migration hiện tại; chỉ bổ sung khi truy vấn lịch sử sửa cần tối ưu.

---

## 10. Bảng `public.order_items` — Dòng chứng từ

### Mục đích

Lưu snapshot dòng hàng của báo giá hoặc hóa đơn bán hàng.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `order_id` | `uuid` | ❌ | FK → `public.orders.id` |
| `line_no` | `integer` | ❌ | Số thứ tự dòng |
| `product_id` | `uuid` | ✅ | FK → `public.products.id`; null nếu sau này cho dòng tự do |
| `product_snapshot` | `jsonb` | ❌ | Snapshot mã, tên, đơn vị và cách tính bán |
| `sell_method` | `text` | ❌ | `quantity`, `area_m2`, `linear_m`, `sheet`, `combo` |
| `quantity` | `numeric(12,3)` | ❌ | Số lượng chính của dòng |
| `width_m` | `numeric(12,3)` | ✅ | Rộng theo mét nếu có |
| `height_m` | `numeric(12,3)` | ✅ | Dài/cao theo mét nếu có |
| `linear_m` | `numeric(12,3)` | ✅ | Mét tới nếu có |
| `unit_price` | `numeric(12,0)` | ❌ | Đơn giá đã áp dụng |
| `line_subtotal_amount` | `numeric(12,0)` | ❌ | Thành tiền dòng trước chiết khấu dòng |
| `discount_amount` | `numeric(12,0)` | ❌ | Chiết khấu riêng của dòng nếu có |
| `price_source` | `text` | ❌ | `customer_group`, `default_price_list`, `fallback_default_price_list`, `manual` |
| `line_total` | `numeric(12,0)` | ❌ | Thành tiền dòng sau chiết khấu dòng |
| `note` | `text` | ✅ | Ghi chú dòng |
| `created_at` | `timestamptz` | ❌ | Thời điểm tạo |

### Ràng buộc

- `UNIQUE (order_id, line_no)`
- `quantity > 0`
- `unit_price >= 0`
- `line_subtotal_amount >= 0`
- `discount_amount >= 0`
- `line_total >= 0`
- `discount_amount <= line_subtotal_amount`
- `line_total = line_subtotal_amount - discount_amount`
- `sell_method IN ('quantity', 'area_m2', 'linear_m', 'sheet', 'combo')`
- `price_source IN ('customer_group', 'default_price_list', 'fallback_default_price_list', 'manual')`
- `order_id` phải cùng `organization_id`.
- `product_id` nếu có phải cùng `organization_id`.

### Index

- `idx_order_items_order` trên `(organization_id, order_id, line_no)`
- `idx_order_items_product` trên `(organization_id, product_id)` với điều kiện `product_id IS NOT NULL`

---

## 11. Bảng `public.order_status_history` — Lịch sử trạng thái chứng từ

### Mục đích

Ghi lịch sử đổi trạng thái của báo giá và hóa đơn để truy vết vòng đời chứng từ.

### Các cột

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
|---|---|---|---|
| `id` | `uuid` | ❌ | Khóa chính |
| `organization_id` | `uuid` | ❌ | FK → `public.organizations.id` |
| `order_id` | `uuid` | ❌ | FK → `public.orders.id` |
| `from_status` | `text` | ✅ | Trạng thái trước đó |
| `to_status` | `text` | ❌ | Trạng thái mới |
| `reason` | `text` | ✅ | Lý do đổi trạng thái nếu có |
| `changed_by` | `uuid` | ❌ | FK → `public.profiles.id` |
| `changed_at` | `timestamptz` | ❌ | Thời điểm đổi trạng thái |

### Ràng buộc

- `order_id` phải cùng `organization_id`.
- Không xóa lịch sử trạng thái khi chứng từ bị hủy.

### Index

- `idx_order_status_history_order` trên `(organization_id, order_id, changed_at DESC)`

---

## 12. Ranh giới Production queue

### Mục đích

K02-D dùng hàng đợi máy sản xuất để đưa thông báo/file vào POS và thêm dòng vào nháp local. Schema production queue cần triển khai trong PostgreSQL runtime của QCVL, gồm `production_queue_items`, `production_queue_events`, claim và restore transaction.

Sales chỉ lưu kết quả khi nhân viên lưu báo giá hoặc checkout hóa đơn. Thông báo máy sản xuất không tự tạo `orders`, không tự trừ kho và không tự ghi doanh thu.

### Ranh giới với Sales

- `production_queue_items` không phải chứng từ bán hàng.
- `add-to-draft` chỉ trả payload để POS thêm vào nháp local.
- Khi checkout, dữ liệu đi vào `orders` / `order_items` theo flow POS bình thường.
- Không FK trực tiếp từ `orders` về queue item trong phạm vi hiện tại; nếu cần trace sâu hơn, mở spec riêng.

---

← [Quay về Sales README](./README.md)
