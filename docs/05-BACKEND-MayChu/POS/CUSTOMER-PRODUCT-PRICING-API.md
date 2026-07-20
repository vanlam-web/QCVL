# CUSTOMER-PRODUCT-PRICING-API — API Customer, Product và Pricing POS

> **Base path:** `/api/v1`
> **Business:** [POS-CUSTOMER.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md), [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md)
> **Database:** [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md)

---

## 1. Phạm vi

Tài liệu này là Source of Truth cho API Customer, Product và Pricing phục vụ POS Phase 1.

Bao gồm:

- tìm, tạo và cập nhật khách hàng
- đọc nhóm khách
- tìm sản phẩm đang bán trên POS
- lấy giá theo khách/nhóm khách/giá chung
- đọc lịch sử giá gần đây theo khách hàng + sản phẩm
- quản lý danh mục sản phẩm và bảng giá tối thiểu cho Phase 1

Không bao gồm:

- tạo đơn hàng, báo giá, hóa đơn hoặc checkout
- ghi lịch sử giá từ chứng từ bán hàng
- tồn kho, BOM, cuộn/tấm/lot vật tư
- kết nối máy sản xuất hoặc Realtime queue

---

## 2. Auth và response chuẩn

Mọi endpoint trong file này yêu cầu:

```http
Authorization: Bearer <qcvl_access_token>
X-Workstation-Id: <uuid>
X-Request-Id: <client-generated-id>   # không bắt buộc
```

Áp dụng response chuẩn tại [FOUNDATION-API.md](../FOUNDATION-API.md#2-response-chuẩn).

Tất cả dữ liệu đọc/ghi phải được giới hạn trong organization của actor.

---

## 3. Permission

| Nhóm API | Permission |
|---|---|
| Tìm khách, tạo nhanh khách, sửa thông tin khách phục vụ POS | `perm.create_order` |
| Tìm sản phẩm đang bán, lấy giá mặc định, đọc lịch sử giá gần đây | `perm.create_order` |
| Quản lý sản phẩm, nhóm khách, bảng giá và chi tiết bảng giá | `perm.edit_price_book` |

Backend phải kiểm tra permission ở mọi endpoint, không phụ thuộc việc Frontend ẩn nút.

---

## 4. Customers

### `GET /customers`

Tìm khách hàng trong organization hiện tại.

**Permission:** `perm.create_order`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | `string` | Không | Tìm theo mã khách, tên khách hoặc SĐT |
| `page` | `number` | Không | Mặc định `1` |
| `page_size` | `number` | Không | Mặc định `20`, tối đa `100` |

**Validation:**

- `page >= 1`
- `1 <= page_size <= 100`
- `search` được trim; chuỗi rỗng sau trim tương đương không truyền search

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "KH000001",
      "name": "Công ty ABC",
      "phone": "0901234567",
      "customer_group": {
        "id": "uuid",
        "code": "DAILY",
        "name": "Đại lý"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `POST /customers`

Tạo khách hàng từ POS.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "code": "KH000123",
  "name": "Công ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

`code`, `phone`, `customer_group_id` được phép bỏ trống.

**Validation:**

- `name` bắt buộc, trim xong không rỗng.
- Nếu có `code`, trim xong không rỗng và không trùng trong organization.
- Nếu thiếu `code`, Backend tự sinh mã dạng `KH000001`, tăng dần trong organization.
- Nếu có `phone`, Backend chuẩn hóa thành `phone_normalized` và không cho trùng trong organization.
- Nếu có `customer_group_id`, nhóm khách phải tồn tại, active và cùng organization.

**Workflow:**

1. Xác thực actor, workstation và permission.
2. Trim input.
3. Chuẩn hóa SĐT nếu có.
4. Tự sinh mã khách nếu thiếu `code`.
5. Kiểm tra trùng mã khách và SĐT.
6. Ghi `public.customers`.
7. Trả khách hàng vừa tạo.

**Response data:**

```json
{
  "id": "uuid",
  "code": "KH000123",
  "name": "Công ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

### `PATCH /customers/{id}`

Cập nhật thông tin khách hàng phục vụ POS.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "code": "KH000123",
  "name": "Công ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

**Validation:**

- Khách hàng phải tồn tại trong organization.
- Nếu sửa `name`, trim xong không rỗng.
- Nếu sửa `code`, không được trùng trong organization.
- Nếu sửa `phone`, SĐT chuẩn hóa không được trùng với khách khác trong organization.
- `customer_group_id = null` nghĩa là khách không gán nhóm và dùng giá chung.
- Nếu `customer_group_id` khác null, nhóm khách phải active và cùng organization.

### `POST /customers/import/kiotviet/preview`

Xem trước file khách hàng KiotViet. Preview không ghi DB.

Import dùng `organization_id + Mã khách hàng` làm khóa upsert. `Tên khách hàng` bắt buộc nhưng được phép trùng giống KiotViet. SĐT không bắt buộc.

Các trường vận hành hiện dùng: mã khách, tên khách, loại khách, công ty, điện thoại, MST, địa chỉ một dòng, phường/xã, khu vực giao hàng, nhóm khách, ghi chú, người tạo nguồn, ngày tạo nguồn, ngày giao dịch cuối, trạng thái.

`Nợ cần thu hiện tại`, `Tổng bán`, `Tổng bán trừ trả hàng` chỉ là số tham chiếu KiotViet, không phải công nợ chính của QCVL.

### `POST /customers/import/kiotviet`

Ghi import khách hàng sau preview. Backend map lại rows bằng cùng contract và trả `invalid_rows` nếu thiếu `Mã khách hàng` hoặc `Tên khách hàng`.

Không tự xóa khách vắng trong file. Muốn nhập lại từ đầu phải dùng nút riêng `Xóa dữ liệu cũ` trong dialog import.

### `DELETE /customers/import/kiotviet`

Xóa dữ liệu khách hàng cũ của lần import KiotViet để import lại từ đầu.

**Rules:**

- Chỉ xóa dữ liệu khách hàng được tạo từ import KiotViet của trang Khách hàng.
- Không xóa khách tạo tay.
- Nếu khách đang được hóa đơn, công nợ hoặc lịch sử bán hàng dùng, backend không xóa và trả số lượng trong `blocked_rows`.
- Với demo fallback hiện tại, backend xóa khách import có id prefix `customer-kv-*` và khách mẫu local có mã `DEV20-KH-*`. Backend giữ lại `khachle` và khách tạo tay; khách đã tồn tại rồi bị import cập nhật sẽ không rollback vì không có snapshot cũ.

**Response data:**

```json
{
  "deleted_rows": 531,
  "blocked_rows": 0
}
```

---

## 5. Customer groups

### `GET /customer-groups`

Lấy danh sách nhóm khách active để gán cho khách hàng.

**Permission:** `perm.create_order`

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "DAILY",
      "name": "Đại lý",
      "price_list_id": "uuid"
    }
  ]
}
```

### `POST /customer-groups`

Tạo nhóm khách.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "DAILY",
  "name": "Đại lý",
  "price_list_id": "uuid"
}
```

**Validation:**

- `code` và `name` trim xong không rỗng.
- `code` không trùng trong organization.
- `price_list_id` phải tồn tại, active và cùng organization.

### `PATCH /customer-groups/{id}`

Cập nhật nhóm khách.

**Permission:** `perm.edit_price_book`

Cho phép sửa `code`, `name`, `price_list_id`, `is_active`.

Nếu chuyển `is_active = false`, khách hàng đang thuộc nhóm này vẫn giữ liên kết hiện tại; nhóm inactive chỉ không được gán mới.

---

## 6. Products

### `GET /products`

Query dùng cho POS và trang Hàng hóa.

Tham số hiện tại:

| Query | Ý nghĩa |
|---|---|
| `search` | Tìm theo mã/tên; hỗ trợ tìm không dấu ở frontend và backend nếu có cột chuẩn hóa |
| `status` | Lọc `active` / `inactive`; POS chỉ dùng `active` |
| `sell_method` | Lọc cách tính bán |
| `inventory_shape` | Lọc kiểu tồn kho: `normal`, `roll`, `sheet`; dùng cho sidebar Hàng hóa |
| `product_kind` | Lọc loại hàng |
| `created_from`, `created_to` | Lọc theo `products.created_at`; ngày dạng `YYYY-MM-DD`, `created_to` bao gồm hết ngày |
| `page`, `page_size` | Phân trang |
| `sort=pos_usage` | Dùng cho lưới sản phẩm nhanh POS; ưu tiên sản phẩm có `pos_product_usage.usage_count` cao hơn |

Với `sort=pos_usage`, backend PostgreSQL đọc `pos_product_usage` theo `(organization_id, product_id)`, sắp `usage_count DESC`, rồi fallback theo thứ tự sản phẩm ổn định. Không dùng cache trình duyệt cho thứ tự này.

Với local `3202` chạy dev-memory, `getPosProductUsageCounts()` phải derive từ `salesDocuments.items` đã lưu/import trong `logs/dev-memory-state.json`. Không được fallback về fixture demo trong `server/http.ts`, vì sẽ làm lưới sản phẩm nhanh sai thứ tự so với lịch sử bán/báo giá thật của phiên dev.

POS chỉ dùng `sort=pos_usage&page_size=120` cho lưới sản phẩm nhanh. Ô tìm hàng POS phải gọi lại `GET /products?status=active&search=...`, không được coi cache lưới nhanh là nguồn tìm kiếm đầy đủ. Kết quả tìm phải bao gồm cả `sell_method = combo`; frontend có thể merge với cache nhanh nhưng phải ưu tiên khớp exact mã/tên, rồi khớp đầu chuỗi/từ, rồi mới khớp chứa ở giữa. Ví dụ tìm `In bạt` phải trả/ưu tiên sản phẩm hoặc combo tên đúng `In bạt` trước `Linh kiện máy in bạt`.

Tìm sản phẩm/dịch vụ đang bán trên POS.

**Permission:** `perm.create_order` hoặc `perm.edit_price_book`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | `string` | Không | Tìm theo mã hoặc tên sản phẩm |
| `status` | `string` | Không | POS mặc định chỉ dùng `active`; chỉ endpoint quản lý được dùng `inactive` hoặc `all` |
| `product_group_id` | `uuid` | Không | Lọc theo nhóm hàng trong module Hàng hóa |
| `product_kind` | `string` | Không | Lọc loại hàng: `goods`, `service`, `auxiliary_material`, `roll`, `sheet`, `combo` |
| `inventory_shape` | `string` | Không | Lọc kiểu tồn kho: `normal`, `roll`, `sheet` |
| `created_from` | `date` | Không | Lọc hàng hóa tạo từ ngày `YYYY-MM-DD` |
| `created_to` | `date` | Không | Lọc hàng hóa tạo đến hết ngày `YYYY-MM-DD` |
| `page` | `number` | Không | Mặc định `1` |
| `page_size` | `number` | Không | Mặc định `20`, tối đa `100` |

**Validation và rule:**

- Nếu actor chỉ có `perm.create_order`, Backend luôn ép `status = active`.
- Nếu actor có `perm.edit_price_book`, `status` được phép là `active`, `inactive` hoặc `all`.
- `search` trim xong rỗng thì bỏ qua.
- Tìm kiếm hỗ trợ không dấu theo chiến lược kỹ thuật được chốt khi triển khai search.
- Không hỗ trợ QR/barcode trong Phase 1.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "MICA-3MM",
      "name": "Mica 3mm",
      "status": "active",
      "product_group_id": "uuid",
      "product_group": { "id": "uuid", "code": "GENERAL", "name": "Giá chung" },
      "unit_name": "m",
      "sell_method": "linear_m",
      "unit_conversions": [
        {
          "unit_id": "uuid",
          "unit_name": "m tới",
          "stock_qty_per_unit": 0.5,
          "is_default_purchase_unit": true,
          "is_default_sale_unit": true
        }
      ]
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `POST /products`

Tạo sản phẩm/dịch vụ.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "MICA-3MM",
  "name": "Mica 3mm",
  "status": "active",
  "unit_name": "m",
  "sell_method": "linear_m",
  "inventory_shape": "sheet",
  "track_inventory": true,
  "product_group_id": "uuid",
  "latest_purchase_cost": 125000,
  "unit_conversions": [
    {
      "unit_name": "m tới",
      "stock_qty_per_unit": 0.5,
      "is_default_purchase_unit": true,
      "is_default_sale_unit": true
    }
  ]
}
```

**Validation:**

- `code`, `name`, `unit_name` trim xong không rỗng.
- `code` không trùng trong organization.
- `status` thuộc `active | inactive`.
- `sell_method` thuộc `quantity | area_m2 | linear_m | sheet | combo`.
- `inventory_shape` thuộc `normal | roll | sheet`; nếu bỏ trống mặc định là `normal`.
- `product_kind` thuộc `goods | service | auxiliary_material | roll | sheet | combo`; nếu bỏ trống Backend tự suy ra từ `sell_method`, `inventory_shape` và `track_inventory`.
- `track_inventory` là boolean; nếu bỏ trống Backend tự suy ra theo loại tồn/cách tính bán.
- `latest_purchase_cost` là số lớn hơn hoặc bằng `0`; nếu bỏ trống thì chưa ghi giá vốn gần nhất.
- `product_group_id` nếu bỏ trống thì Backend gán nhóm mặc định `Giá chung`.
- `unit_conversions` là danh sách đơn vị phụ kiểu KiotViet; mỗi dòng có `unit_name`, `stock_qty_per_unit > 0`, và cờ mặc định mua/bán. Ví dụ `Ram = 100 tờ`, `m tới = 0.5 m`, `Tấc = 0.042 đơn vị cơ bản`.

### `GET /product-groups`

Danh sách nhóm hàng.

**Permission:** `perm.create_order`, `perm.edit_price_book` hoặc `perm.manage_inventory`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `active_only` | `boolean` | Không | Mặc định chỉ trả nhóm đang hoạt động |

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "GENERAL",
      "name": "Giá chung",
      "is_default": true,
      "is_active": true
    }
  ]
}
```

### `POST /product-groups`

Tạo nhóm hàng.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "name": "Vật tư",
  "code": "VAT-TU"
}
```

`code` không bắt buộc; nếu bỏ trống Backend tự sinh code từ tên nhóm. Mỗi organization có một nhóm mặc định `Giá chung`.

`GET /products` hỗ trợ query `product_kind = goods | service | auxiliary_material | roll | sheet | combo`. Backend lọc theo `products.product_kind` để `Vật tư phụ` được lưu thật, không lẫn với hàng thường:

- `service`: `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = false`.
- `auxiliary_material`: vật tư phụ; vẫn có tồn như hàng thường nhưng được nhận diện riêng cho BOM/khui vật tư.
- `goods`: `inventory_shape = normal`, `track_inventory = true`, không phải combo.
- `roll`: `inventory_shape = roll`.
- `sheet`: `inventory_shape = sheet`.
- `combo`: `sell_method = combo`.

**Ghi chú UI Hàng hóa:**

- Form `+ Tạo hàng hóa` dùng một modal chung, chọn loại hàng ở đầu form: hàng thường, dịch vụ, vật tư phụ, hàng cuộn, hàng tấm, combo - đóng gói.
- Dịch vụ là phân loại riêng trong UI/filter, nhưng Backend nhận diện bằng cấu hình tồn hiện có: `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = false`; UI ẩn phần tồn kho khi tạo.
- Hàng cuộn lưu `inventory_shape = roll`, hàng tấm lưu `inventory_shape = sheet`.
- Combo lưu `sell_method = combo`, `track_inventory = false`; UI ẩn phần tồn kho và hiện khu vực vật tư cấu thành. Khi tạo combo, frontend gọi `POST /products` trước rồi gọi `POST /products/{product_id}/bom` để lưu BOM cho sản phẩm vừa tạo. Khi bán combo, tồn trừ vào vật tư cấu thành theo BOM active, không trừ theo chính mã combo. Mỗi dòng BOM không gửi `component_type`; vật tư phụ được nhận diện từ loại hàng của vật tư sau khi có metadata lưu loại hàng riêng.
- Thành phần combo vẫn có thể sửa sau ở chi tiết hàng hóa; mỗi lần lưu tạo BOM/version hiện hành theo contract BOM.
- `Lưu & tạo thêm` dùng cùng endpoint `POST /products`, tạo xong reset form ở frontend và giữ modal mở.
- Modal tạo hàng không có vùng ảnh hàng hóa, không có tab mô tả disabled và không có checkbox `Bán trực tiếp`; sản phẩm/dịch vụ đang hoạt động mặc định được bán trực tiếp. Module này không dùng nút `In tem mã`.

### `PATCH /products/{id}`

Cập nhật sản phẩm/dịch vụ.

**Permission:** `perm.edit_price_book`

Cho phép sửa `code`, `name`, `status`, `unit_name`, `sell_method`.

Không xóa vật lý sản phẩm đã có lịch sử; ngưng bán dùng `status = inactive`.

---

## 7. Price lists

### `GET /price-lists`

Lấy danh sách bảng giá.

**Permission:** `perm.edit_price_book`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `active_only` | `boolean` | Không | Mặc định `true` |

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "DEFAULT",
      "name": "Giá chung",
      "is_default": true,
      "is_active": true
    }
  ]
}
```

### `POST /price-lists`

Tạo bảng giá.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "DAILY",
  "name": "Bảng giá đại lý",
  "is_default": false
}
```

**Validation:**

- `code`, `name` trim xong không rỗng.
- `code` không trùng trong organization.
- Nếu `is_default = true`, Backend phải đảm bảo organization chỉ có một giá chung active.

### `PATCH /price-lists/{id}`

Cập nhật bảng giá.

**Permission:** `perm.edit_price_book`

Cho phép sửa `code`, `name`, `is_default`, `is_active`.

Không cho inactive bảng giá đang là giá chung duy nhất của organization.

### `PUT /price-lists/{id}/items/{product_id}`

Tạo hoặc cập nhật giá của một sản phẩm trong bảng giá.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "unit_price": 120000
}
```

**Validation:**

- Bảng giá và sản phẩm phải cùng organization.
- `unit_price >= 0`.
- Với sản phẩm `sell_method = linear_m`, `unit_price` là giá cho `1 m tới`.

### `DELETE /price-lists/{id}/items/{product_id}`

Xóa giá riêng của một sản phẩm khỏi bảng giá.

**Permission:** `perm.edit_price_book`

Sau khi xóa, nếu bảng giá nhóm không còn giá cho sản phẩm, luồng POS fallback về giá chung.

---

## 8. Price resolution

### `POST /pricing/resolve`

Lấy giá mặc định cho một hoặc nhiều sản phẩm theo khách hàng hiện tại.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "customer_id": "uuid",
  "product_ids": ["uuid"]
}
```

`customer_id` được phép null hoặc bỏ trống.

**Workflow:**

1. Xác thực actor, workstation và permission.
2. Kiểm tra mọi sản phẩm tồn tại, active và cùng organization.
3. Nếu có `customer_id`, tải khách hàng cùng organization.
4. Nếu khách có nhóm active, lấy bảng giá của nhóm; nếu không, dùng giá chung.
5. Với mỗi sản phẩm, tìm giá trong bảng giá đã chọn.
6. Nếu không có giá trong bảng giá đã chọn, fallback về giá chung.
7. Trả giá và nguồn giá.

**Response data:**

```json
{
  "items": [
    {
      "product_id": "uuid",
      "unit_price": 120000,
      "price_source": "customer_group",
      "price_list_id": "uuid"
    }
  ]
}
```

`price_source` có thể là:

- `customer_group`
- `default_price_list`
- `fallback_default_price_list`

V1 KiotViet price-book import:

- File `BangGia_KV*.xlsx` writes every positive price column after `Giá nhập cuối` into `price_list_items`.
- KV column `Bảng giá chung` writes the default price list; QCVL UI shows it as `Giá chung`. Numeric columns such as `25`, `26`, `30`, `35`, `40` become named active price lists.
- If a customer group has the same name as a price list, POS resolves price from that list first.
- If that list has no product price but the default list has one, POS returns `fallback_default_price_list`.
- If the product has no price in every list, POS returns unit price `0`.

---

## 9. Recent customer prices

### `GET /customers/{customer_id}/products/{product_id}/recent-prices`

Đọc tối đa 5 giá sửa tay gần nhất cho cặp khách hàng + sản phẩm.

**Permission:** `perm.create_order`

**Validation:**

- Khách hàng và sản phẩm phải tồn tại trong cùng organization.

**Response data:**

```json
{
  "items": [
    {
      "unit_price": 115000,
      "sold_at": "2026-06-30T08:00:00Z"
    }
  ]
}
```

API này chỉ đọc lịch sử. Việc ghi lịch sử giá phát sinh từ order/checkout khi chứng từ bán hàng được lưu thành công.

---

## 10. Import KiotViet Hàng hóa

### `POST /products/import/kiotviet/preview`

Xem trước file hàng hóa KiotViet sau khi frontend parse `.xlsx` thành `rows`.

Request:

```json
{
  "cleanup_demo": false,
  "file_name": "DanhSachSanPham_KV09072026-215404-812.xlsx",
  "rows": [
    {
      "rowNumber": 2,
      "Mã hàng": "A10T",
      "Tên hàng": "Alu 3li 0.1 Trắng",
      "ĐVT": "Tấm"
    }
  ]
}
```

Response:

```json
{
  "summary": {
    "total_rows": 657,
    "valid_rows": 646,
    "invalid_rows": 11,
    "unit_review_rows": 11,
    "price_rows": 620,
    "price_skipped_rows": 37,
    "provisional_stock_rows": 517,
    "provisional_stock_skipped_rows": 140,
    "bom_rows": 189,
    "bom_skipped_rows": 468,
    "create_rows": 640,
    "update_rows": 6,
    "cleanup_demo_requested": false,
    "ignored_columns": ["Thương hiệu", "Tồn nhỏ nhất", "Tồn lớn nhất", "Được bán trực tiếp", "Vị trí"],
    "deferred_columns": ["Dự kiến hết hàng"]
  },
  "invalid_rows": []
}
```

Preview không ghi DB.

### `POST /products/import/kiotviet`

Ghi import sau preview. Backend map lại rows bằng cùng contract, từ chối ghi bẩn bằng cách trả `invalid_rows` nếu thiếu mã hoặc tên.

Nếu thiếu `ĐVT`, backend gán tạm `unit_name = "Cần cập nhật"` và tăng `unit_review_rows`; dòng vẫn được import để người dùng sửa đơn vị sau.

Import dùng `organization_id + Mã hàng` làm khóa upsert. Không tự xóa sản phẩm vắng trong file. `cleanup_demo` chỉ còn là tương thích cũ; UI import dùng nút riêng `Xóa dữ liệu cũ`.

Phase hiện tại ghi: nhóm hàng, mã, tên, loại hàng, kiểu tồn kho, cách bán, đơn vị, giá vốn gần nhất, trạng thái, giá bán vào bảng giá mặc định, và tồn kho vào `inventory_provisional_balances`.

Với dòng đơn vị quy đổi trong file KiotViet, `Mã hàng` của dòng đó không tạo sản phẩm riêng. Backend lưu mã này vào `product_unit_conversions.source_code` làm alias của sản phẩm gốc trong `Mã ĐVT Cơ bản`, ví dụ `B260` khớp về `BT`. Các import chứng từ sau phải lookup sản phẩm bằng cả `products.code` và alias này.

`Thời gian tạo` từ file KiotViet ghi vào `products.created_at`. Backend chấp nhận cả dạng text `dd/MM/yyyy HH:mm`, ISO date, và Excel serial number như `46204.42164644676`. Import lại cùng `Mã hàng` được phép cập nhật `products.created_at` khi file có thời gian nguồn hợp lệ; nếu thời gian nguồn thiếu/sai thì giữ `created_at` cũ, sản phẩm mới fallback về thời gian import.

Tồn kho import từ KiotViet là tồn tạm với `source_type = kiotviet_import`; backend không tự tạo cuộn/tấm vật lý và không ghi `stock_movements` từ số tổng này.

`Hàng thành phần` import từ KiotViet được parse theo dạng `Mã:Định mức|Mã:Định mức`. **SoT Owner 2026-07-20:** `product_boms.status = active`, bán combo trừ thành phần, không duyệt lại. **Runtime:** vẫn `draft`; Postgres POS live có thể trừ cả mã combo — [Sales README — Trừ kho khi bán](../../03-BUSINESS-NghiepVu/Sales/README.md). `Dự kiến hết hàng` làm sau bằng luồng riêng.

### `DELETE /products/import/kiotviet`

Xóa dữ liệu hàng hóa cũ của lần import KiotViet để import lại từ đầu.

**Rules:**

- Xóa dữ liệu phụ KiotViet: tồn tạm `inventory_provisional_balances.source_type = kiotviet_import`, BOM KiotViet, giá import liên quan.
- Chỉ xóa sản phẩm nếu không còn tham chiếu nghiệp vụ thật.
- Nếu sản phẩm đang được hóa đơn, phiếu nhập, sổ kho hoặc BOM thật dùng, backend không xóa và trả số lượng trong `blocked_rows`.

**Response data:**

```json
{
  "deleted_rows": 517,
  "blocked_rows": 0
}
```

---

## 11. Error Handling

| HTTP | Code | Khi dùng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai định dạng, thiếu trường bắt buộc hoặc giá trị ngoài enum |
| 401 | `AUTH_REQUIRED` | Thiếu hoặc sai access token |
| 403 | `PERMISSION_DENIED` | Thiếu permission yêu cầu |
| 403 | `WORKSTATION_INVALID` | Workstation không hợp lệ |
| 404 | `RESOURCE_NOT_FOUND` | Không tìm thấy customer/product/price list trong organization |
| 409 | `RESOURCE_CONFLICT` | Trùng mã khách, SĐT, mã sản phẩm, mã nhóm hoặc mã bảng giá |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống không công khai chi tiết |

Validation lỗi có thể trả thêm:

```json
{
  "fields": {
    "phone": "PHONE_ALREADY_EXISTS",
    "code": "CODE_ALREADY_EXISTS"
  }
}
```

---

## 11. Logging và metric

Backend nên log các thao tác ghi quan trọng:

- tạo/sửa khách hàng
- tạo/sửa nhóm khách
- tạo/sửa sản phẩm
- tạo/sửa bảng giá
- tạo/sửa/xóa chi tiết bảng giá

Log không ghi token, secret hoặc dữ liệu nhạy cảm không cần thiết.

Metric gợi ý:

- số request tìm sản phẩm
- số request resolve giá
- số lỗi conflict khi tạo khách hoặc tạo sản phẩm
- latency của `/pricing/resolve`

---

← [Quay về POS README](./README.md)
