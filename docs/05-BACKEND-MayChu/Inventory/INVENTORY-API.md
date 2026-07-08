# INVENTORY-API — API tồn kho, cuộn/tấm và kiểm kho

> **Base path:** `/api/v1`
> **Business:** [STOCK-RULES.md](../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md), [UNIT-CONVERSION.md](../../03-BUSINESS-NghiepVu/Inventory/UNIT-CONVERSION.md), [STOCKTAKE.md](../../03-BUSINESS-NghiepVu/Inventory/STOCKTAKE.md)
> **Database:** [INVENTORY-TABLES.md](../../04-DATABASE/Inventory/INVENTORY-TABLES.md)

---

## 1. Phạm vi

Tài liệu này là Source of Truth cho Backend API Inventory MVP:

- đọc tồn kho theo sản phẩm
- quản lý cấu hình tồn kho của sản phẩm
- quản lý cuộn vật lý
- quản lý tấm nguyên/tấm dở/tấm lỡ
- khui hàng `normal` có quy đổi đơn vị/cuộn/tấm để chuẩn hóa tồn dần
- xem stock movement
- tạo/lưu/cân bằng/hủy phiếu kiểm kho
- sửa tồn hàng thường trong trang Hàng hóa bằng phiếu kiểm kho tự động

Không bao gồm:

- checkout trừ kho từ bán hàng; xem [ORDER-API.md](../POS/ORDER-API.md)
- dữ liệu máy sản xuất tự trừ kho
- multi-warehouse nâng cao
- nhập kho mua hàng đầy đủ; sẽ đặc tả sau khi nghiệp vụ mua hàng được chốt

---

## 2. Auth, response và permission

Mọi endpoint yêu cầu:

```http
Authorization: Bearer <supabase_access_token>
X-Workstation-Id: <uuid>
X-Request-Id: <client-generated-id>   # không bắt buộc
```

Áp dụng response chuẩn tại [FOUNDATION-API.md](../FOUNDATION-API.md#2-response-chuẩn).

| Nhóm API | Permission |
|---|---|
| Xem tồn kho, cuộn, tấm, stock movement | `perm.create_order` hoặc `perm.manage_inventory` |
| Khui vật tư từ POS/topbar hoặc kho | `perm.create_order` hoặc `perm.manage_inventory` |
| Tạo/sửa cuộn, tấm, tấm lỡ | `perm.manage_inventory` |
| Tạo/lưu/cân bằng/hủy kiểm kho | `perm.manage_inventory` |
| Sửa tồn trực tiếp trong Hàng hóa | `perm.manage_inventory` |

Backend phải scope mọi dữ liệu theo organization của actor.

Ghi chú MVP:

- Các permission trong bảng trên là guard kỹ thuật ở API, không phải ma trận vai trò chi tiết cho vận hành thường ngày.
- Preset `Nhân viên nội bộ` nên có đủ quyền xem hàng hóa/kho, kiểm kho, cuộn/tấm và thao tác inventory thường ngày trong MVP.
- Chỉ dùng tài khoản hạn chế đặc biệt nếu thật sự cần ẩn thao tác kho khỏi một người dùng cụ thể.
- Không thêm approval nhiều bước cho kiểm kho/điều chỉnh tồn trong MVP; thay đổi phải có chứng từ, audit và lịch sử stock movement.

---

## 3. Inventory summary

### `GET /inventory/products`

Tìm sản phẩm kèm thông tin tồn kho tổng hợp.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | `string` | Không | Tìm theo mã/tên sản phẩm |
| `status` | `string` | Không | `active`, `inactive`, `all`; mặc định `active` nếu gọi từ POS, `all` nếu gọi từ trang Kho |
| `inventory_shape` | `string` | Không | `normal`, `roll`, `sheet` |
| `negative_only` | `boolean` | Không | Chỉ lấy mặt hàng tồn âm |
| `page` | `number` | Không | Mặc định `1` |
| `page_size` | `number` | Không | Mặc định `20`, tối đa `100` |

**Validation:**

- Nếu actor chỉ có `perm.create_order`, Backend không trả sản phẩm `inactive`.
- `page >= 1`.
- `1 <= page_size <= 100`.

**Workflow:**

1. Xác thực actor, workstation và permission.
2. Tải product + `product_inventory_settings`.
3. Tính tồn:
   - `normal`: từ tổng stock movement hoặc snapshot tồn hiện hành nếu implementation có cache.
   - `roll`: tổng từ `inventory_rolls.remaining_area_m2` hoặc đơn vị tồn chính tương ứng.
   - `sheet`: tổng từ `inventory_sheets.area_m2` còn `available`.
4. Trả danh sách kèm cảnh báo tồn âm nếu có.

**Response data:**

```json
{
  "items": [
    {
      "product_id": "uuid",
      "code": "BAT-HIFLEX-32",
      "name": "Bạt Hiflex 3.2m",
      "status": "active",
      "inventory_shape": "roll",
      "stock_unit": "m2",
      "available_qty": 125.5,
      "is_negative": false
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `GET /inventory/products/{product_id}`

Đọc chi tiết cấu hình và tồn kho của một sản phẩm.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

Response phải cho biết:

- cấu hình `product_inventory_settings`
- đơn vị tồn chính
- tổng tồn hiện tại
- nếu `roll`: danh sách cuộn còn dùng
- nếu `sheet`: danh sách tấm/tấm lỡ còn dùng
- 10 stock movement gần nhất

---

## 4. Product inventory settings

### `PUT /inventory/products/{product_id}/settings`

Cập nhật cấu hình tồn kho của sản phẩm.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "track_inventory": true,
  "inventory_shape": "roll",
  "stock_unit_id": "uuid",
  "default_allow_negative": true,
  "roll_default_margin_width_m": 0.1,
  "roll_default_margin_length_m": 0.1,
  "roll_allow_rotate": true,
  "sheet_width_m": null,
  "sheet_length_m": null,
  "sheet_default_cut_margin_m": null,
  "sheet_remnant_min_area_m2": 0.3
}
```

**Validation:**

- Product phải cùng organization.
- `inventory_shape IN ('normal', 'roll', 'sheet')`.
- `stock_unit_id` phải cùng organization và active.
- Không cho đổi `inventory_shape` nếu đã có cuộn/tấm/stock movement phát sinh, trừ khi có migration nghiệp vụ riêng.
- Với `roll`, biên chừa nếu có phải `>= 0`.
- Với `sheet`, kích thước tấm gốc nếu nhập phải `> 0`, ngưỡng tấm lỡ mặc định `0.3m2`.

**Workflow:**

1. Validate input.
2. Upsert `product_inventory_settings`.
3. Trả cấu hình mới.

---

## 5. Roll inventory

### `GET /inventory/rolls`

Tìm cuộn vật lý.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Query:** `product_id`, `status`, `width_m`, `page`, `page_size`.

Nếu gọi từ POS/checkout, Backend chỉ trả cuộn `available` hoặc `in_use`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "code": "ROLL-001",
      "width_m": 3.2,
      "initial_length_m": 50,
      "remaining_length_m": 18,
      "initial_area_m2": 160,
      "remaining_area_m2": 57.6,
      "status": "in_use",
      "note": "Cuộn đang dùng",
      "created_at": "2026-07-07T08:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

### `POST /inventory/rolls`

Tạo cuộn vật lý khi nhập hoặc khai báo tồn ban đầu.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "code": "ROLL-001",
  "width_m": 3.2,
  "initial_length_m": 50,
  "remaining_length_m": 50,
  "note": "Tồn đầu kỳ"
}
```

**Validation:**

- Product phải có `inventory_shape = roll`.
- `width_m > 0`, `initial_length_m >= 0`, `remaining_length_m >= 0`.
- `code` không trùng trong cùng product/organization.
- `remaining_area_m2 = width_m * remaining_length_m` do Backend tính.

**Workflow:**

1. Tạo `inventory_rolls`.
2. Nếu đây là khai báo tồn ban đầu hoặc điều chỉnh tồn, tạo `stock_movements` loại `manual_adjustment` có lý do.
3. Trả cuộn vừa tạo.

### `PATCH /inventory/rolls/{id}`

Sửa thông tin/cuộn còn lại.

**Permission:** `perm.manage_inventory`

Backend không được sửa âm thầm tồn cuộn. Nếu `remaining_length_m` hoặc `remaining_area_m2` thay đổi, phải tạo `stock_movements` loại `manual_adjustment` kèm `reason`.

**Trạng thái triển khai hiện tại:** endpoint nhận `remaining_length_m`, `status`, `reason`. Backend tính lại `remaining_area_m2 = width_m * remaining_length_m`. Nếu diện tích thay đổi, ghi `stock_movements.manual_adjustment` theo object `roll`; nếu delta bằng `0`, không ghi movement vì DB không cho movement số lượng `0`.

### `POST /inventory/rolls/suggest`

Đề xuất cuộn/khổ cho một dòng cần xuất vật tư cuộn.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "required_width_m": 2.5,
  "required_length_m": 2.05,
  "margin_width_m": 0.1,
  "margin_length_m": 0.1,
  "allow_rotate": true
}
```

**Workflow:**

1. Tính kích thước tiêu hao sau biên chừa.
2. Lọc cuộn đủ khổ và đủ chiều dài.
3. Ưu tiên hao hụt ngang ít nhất.
4. Ưu tiên cuộn đang dùng dở.
5. Trả danh sách đề xuất có điểm ưu tiên và snapshot công thức.

Endpoint này chỉ đề xuất, không trừ kho.

---

## 6. Sheet inventory

### `GET /inventory/sheets`

Tìm tấm nguyên/tấm dở/tấm lỡ.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Query:** `product_id`, `sheet_kind`, `status`, `min_width_m`, `min_length_m`, `page`, `page_size`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "code": "SHEET-001",
      "sheet_kind": "full",
      "width_m": 1.22,
      "length_m": 2.44,
      "area_m2": 2.977,
      "status": "available",
      "note": "Tấm nguyên",
      "created_at": "2026-07-07T08:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

### `POST /inventory/sheets`

Tạo tấm/tấm lỡ thủ công.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "code": "SHEET-001",
  "sheet_kind": "full",
  "width_m": 1.22,
  "length_m": 2.44,
  "status": "available",
  "note": "Tồn đầu kỳ"
}
```

**Validation:**

- Product phải có `inventory_shape = sheet`.
- `width_m > 0`, `length_m > 0`.
- `area_m2 = width_m * length_m` do Backend tính.
- `code` không trùng trong cùng product/organization.

**Workflow:**

1. Tạo `inventory_sheets`.
2. Nếu đây là khai báo tồn ban đầu hoặc điều chỉnh tồn, tạo `stock_movements` loại `manual_adjustment` có lý do.
3. Trả tấm/tấm lỡ vừa tạo.

### `PATCH /inventory/sheets/{id}`

Sửa hoặc đổi trạng thái tấm/tấm lỡ.

**Permission:** `perm.manage_inventory`

**Validation và workflow:**

- Cho phép sửa kích thước, trạng thái, ghi chú.
- Nếu sửa kích thước/diện tích hoặc đổi `discarded`, Backend phải tạo `stock_movements` loại `manual_adjustment` hoặc `remnant_discarded`.
- Mọi thao tác sửa/xóa tấm lỡ phải ghi log nghiệp vụ tối thiểu qua stock movement hoặc audit log hiện hành.

**Trạng thái triển khai hiện tại:** endpoint nhận `width_m`, `length_m`, `status`, `reason`. Backend tính lại `area_m2 = width_m * length_m`. Nếu diện tích thay đổi, ghi `stock_movements.manual_adjustment` theo object `sheet`; nếu delta bằng `0`, không ghi movement.

### `POST /inventory/sheets/suggest`

Đề xuất tấm/tấm lỡ phù hợp cho một kích thước cần dùng.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "required_width_m": 1.0,
  "required_length_m": 1.22,
  "cut_margin_m": 0.01
}
```

**Workflow:**

1. Ưu tiên tấm lỡ phù hợp nhỏ nhất.
2. Nếu không có tấm lỡ phù hợp, chọn tấm nguyên hoặc tấm dở phù hợp.
3. Tính phần còn lại.
4. Nếu phần còn lại dưới `sheet_remnant_min_area_m2` mặc định `0.3`, đánh dấu sẽ bỏ.
5. Trả đề xuất và phần tấm lỡ dự kiến nếu có.

Endpoint này chỉ đề xuất, không trừ kho.

---

## 7. Material opening / Khui vật tư

### `GET /inventory/material-openings/options`

Đọc dữ liệu gợi ý để mở popup khui vật tư cho một sản phẩm.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `product_id` | `uuid` | Có | Sản phẩm/vật tư cần khui |

**Workflow:**

1. Xác thực actor, workstation và permission.
2. Tải product + `product_inventory_settings`.
3. Nếu `normal`, trả cấu hình đơn vị tồn và danh sách quy đổi đơn vị từ `product_unit_conversions`, gồm đơn vị, hệ số quy đổi về tồn chính, cờ mặc định khi mua và cờ mặc định khi bán.
4. Nếu `roll`, trả danh sách khổ khả dụng từ `inventory_rolls` và tồn tạm KiotViet nếu có.
5. Nếu `sheet`, trả khổ thao tác từ settings và tấm/tấm dở/tấm lỡ liên quan nếu có.
6. Không tự tạo object, không trừ tồn.

**Response data:**

```json
{
  "product": {
    "id": "uuid",
    "code": "BAT-HIFLEX-32",
    "name": "Bạt Hiflex 3.2m",
    "inventory_shape": "roll",
    "stock_unit": "m2"
  },
  "provisional_balance": {
    "id": "uuid",
    "source_type": "kiotviet_import",
    "remaining_qty": 128,
    "stock_unit": "m2"
  },
  "roll_options": [
    {
      "width_m": 3.2,
      "available_roll_count": 2,
      "suggested_old_roll_id": "uuid",
      "suggested_old_remaining_length_m": 18
    }
  ],
  "sheet_options": [],
  "warnings": ["PROVISIONAL_SOURCE"]
}
```

### `POST /inventory/material-openings`

Ghi nhận một lần khui vật tư.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

Endpoint này xử lý cả `normal`, `roll`, `sheet` theo `inventory_shape` của product.

Không nhận các trường:

- nhà cung cấp
- lô/ngày mua
- giá vốn
- thông tin báo cáo hao hụt nâng cao

#### Input cho `normal`

```json
{
  "product_id": "uuid",
  "inventory_shape": "normal",
  "opened_unit_id": "uuid",
  "opened_qty": 1,
  "old_remaining_qty": 0,
  "note": "Khui keo mới, phần cũ khô bỏ"
}
```

Quy tắc:

- Product phải có `inventory_shape = normal`.
- Product phải có cấu hình quy đổi đơn vị phù hợp để khui; nếu không có quy đổi, trả validation error để tránh hiện nhầm hàng không cần khui.
- `opened_unit_id` là đơn vị lớn/đơn vị nhập khui, ví dụ ram, bao, cuộn; backend quy đổi về đơn vị tồn chính theo `product_unit_conversions`.
- `opened_qty > 0`.
- `old_remaining_qty >= 0`, MVP mặc định `0`.
- Không tạo `inventory_rolls` hoặc `inventory_sheets`.
- Tạo `inventory_material_openings`.
- Tạo `stock_movements` loại `material_opening` chỉ khi có thay đổi tồn chính thức cần ghi nhận.
- Không tạo `stocktakes`; khui vật tư không phải phiếu kiểm kho.
- Nếu `old_remaining_qty = 0` và hệ thống đang có phần dở/cũ còn số lượng, backend ghi movement âm để đưa phần cũ về `0` trước khi cộng phần khui mới.
- Nếu tồn thiếu/âm, trả warning nhẹ, không chặn nếu actor có quyền.

#### Input cho `roll`

**Trạng thái triển khai hiện tại:** payload roll đang xử lý phần cuộn cũ đã chuẩn hóa. Backend cập nhật `inventory_rolls.remaining_length_m`, đổi trạng thái `empty` nếu còn lại `0`, ghi `inventory_material_openings` và `stock_movements.material_opening` cho phần chênh lệch diện tích. Luồng tạo/khui cuộn mới từ tồn tạm KiotViet hoặc chọn cuộn `available` tự động vẫn là phase sau.

```json
{
  "product_id": "uuid",
  "inventory_shape": "roll",
  "old_inventory_roll_id": "uuid",
  "old_remaining_length_m": 0,
  "note": "Khui cuộn mới"
}
```

Quy tắc:

- Product phải có `inventory_shape = roll`.
- `old_inventory_roll_id` phải thuộc cùng product/organization.
- `old_remaining_length_m >= 0`.
- Không bắt chọn lô/ngày mua/nhà cung cấp.
- Nếu `old_remaining_length_m = 0`, cuộn cũ chuyển `empty`; không tạo object rác.
- Nếu `old_remaining_length_m > 0`, giữ/cập nhật cuộn cũ thành `in_use`.
- Chênh lệch cũ/mới ghi vào `inventory_material_openings.old_snapshot`, `input_payload`, `result_payload`.
- Stock movement dùng `movement_type = material_opening` cho phần tồn chính thức thay đổi.
- Không tạo `stocktakes`; nếu cần cân bằng lại nhiều cuộn sau khi kiểm thực tế thì dùng endpoint stocktake riêng.
- Phase sau sẽ bổ sung payload khui cuộn mới từ object `available` hoặc tồn tạm KiotViet.

#### Input cho `sheet`

**Trạng thái triển khai hiện tại:** payload sheet đang xử lý phần tấm cũ đã chuẩn hóa. Backend cập nhật `inventory_sheets`: nếu bỏ thì chuyển `discarded`, nếu giữ thì cập nhật rộng/dài/diện tích còn lại. Backend ghi `inventory_material_openings` và `stock_movements.material_opening` cho phần chênh lệch diện tích. Luồng tạo tấm mới từ tồn tạm KiotViet vẫn là phase sau.

```json
{
  "product_id": "uuid",
  "inventory_shape": "sheet",
  "old_inventory_sheet_id": "uuid",
  "old_remaining_width_m": 1.2,
  "old_remaining_length_m": 0.35,
  "note": "Khui tấm mới, giữ phần cũ"
}
```

Hoặc bỏ phần tấm cũ:

```json
{
  "product_id": "uuid",
  "inventory_shape": "sheet",
  "old_inventory_sheet_id": "uuid",
  "discard_old_sheet": true,
  "note": "Bỏ phần tấm cũ"
}
```

Quy tắc:

- Product phải có `inventory_shape = sheet`.
- Khổ thao tác dùng giá trị đơn giản như `1.2m x 2.4m`.
- `old_inventory_sheet_id` phải thuộc cùng product/organization.
- Nếu `discard_old_sheet = true`, không cần gửi kích thước còn lại.
- Nếu không bỏ, `old_remaining_width_m > 0` và `old_remaining_length_m > 0`.
- Nếu giữ lại phần cũ, cập nhật tấm cũ với diện tích còn lại.
- Nếu bỏ phần cũ, chuyển tấm cũ sang `discarded`; không tạo object rác.
- Ngưỡng rẻo nhỏ hoặc phần mét tới dưới `0.2m` hiện mới là rule UX/spec, chưa enforce trong API.
- Không tính giá vốn hoặc báo cáo hao hụt nâng cao trong endpoint này.

#### Response data

```json
{
  "id": "uuid",
  "product_id": "uuid",
  "inventory_shape": "roll",
  "source_type": "kiotviet_provisional",
  "warnings": ["PROVISIONAL_SOURCE", "LOW_STOCK"],
  "created_rolls": [
    {
      "id": "uuid",
      "code": "KHUI-000001-R001",
      "width_m": 3.2,
      "remaining_length_m": 50,
      "remaining_area_m2": 160,
      "status": "in_use"
    }
  ],
  "updated_rolls": [],
  "created_sheets": [],
  "updated_sheets": [],
  "stock_movements": [
    {
      "id": "uuid",
      "movement_type": "material_opening",
      "quantity_delta": 160
    }
  ]
}
```

### `GET /inventory/material-openings`

Tra cứu lịch sử khui vật tư.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

**Query:** `product_id`, `inventory_shape`, `source_type`, `from`, `to`, `page`, `page_size`.

### `GET /inventory/material-openings/{id}`

Chi tiết một lần khui vật tư, gồm input/result snapshot và stock movements liên quan.

**Permission:** `perm.create_order` hoặc `perm.manage_inventory`

---

## 8. Stock movements

### `GET /inventory/stock-movements`

Tra cứu sổ kho chính thức.

**Permission:** `perm.manage_inventory`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `product_id` | `uuid` | Không | Lọc theo sản phẩm |
| `movement_type` | `string` | Không | `sale_deduction`, `invoice_reversal`, `invoice_revision`, `stocktake_adjustment`, `manual_adjustment`, `remnant_created`, `remnant_discarded`, `purchase_receipt`, `material_opening` |
| `order_id` | `uuid` | Không | Lọc theo đơn |
| `stocktake_id` | `uuid` | Không | Lọc theo phiếu kiểm kho |
| `from` / `to` | `datetime` | Không | Khoảng thời gian |
| `page` / `page_size` | `number` | Không | Phân trang |

Backend chỉ cho đọc. Tạo stock movement phải đi qua use case nghiệp vụ tương ứng: checkout, kiểm kho, sửa cuộn/tấm hoặc điều chỉnh thủ công có lý do.

**Response MVP:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "movement_type": "sale_deduction",
      "quantity_delta": -1.656,
      "created_at": "2026-07-07T05:30:00Z",
      "document_code": "HD011036",
      "document_type": "sale_invoice",
      "transaction_price": 300000,
      "cost_price": 107751.2,
      "partner_name": "Khách lẻ"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

Tab `Thẻ kho` trong chi tiết hàng hóa dùng response này để hiện bảng kiểu KiotViet. Backend hydrate:

- `document_code`: `orders.code`, `purchase_receipts.code` hoặc `stocktakes.code`.
- `document_type`: `sale_invoice`, `purchase_receipt`, `stocktake`, `manual`, `material_opening`.
- `transaction_price`: bán lấy `order_items.unit_price`, mua lấy `purchase_receipt_items.unit_cost`.
- `cost_price`: ưu tiên `products.latest_purchase_cost`, fallback `purchase_receipt_items.unit_cost`.
- `partner_name`: bán lấy khách từ `orders.customer_snapshot`, mua lấy `suppliers.name`.

API chưa trả `balance_after`, nên `Tồn cuối` trong UI vẫn hiện `Chưa có`. Khi cần đúng như KiotViet, nên lưu snapshot tồn sau mỗi stock movement hoặc bổ sung query tính running balance ổn định ở backend.

---

## 9. Stocktake

### `POST /inventory/stocktakes`

Tạo phiếu kiểm kho thủ công.

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** endpoint đã mở route nhưng trả `VALIDATION_ERROR` với thông điệp `Manual stocktake mutations are not implemented yet.`. Không trả fake success. Luồng sửa tồn hàng thường đang dùng endpoint riêng `POST /inventory/products/{product_id}/adjust-stock` để tự sinh phiếu `balanced`.

**Input:**

```json
{
  "note": "Kiểm kho cuối tháng",
  "items": [
    {
      "product_id": "uuid",
      "actual_qty": 10,
      "inventory_object_type": null,
      "inventory_roll_id": null,
      "inventory_sheet_id": null,
      "note": ""
    }
  ],
  "save_mode": "draft"
}
```

`save_mode` là `draft` hoặc `balance_now`.

**Validation:**

- Có ít nhất một dòng.
- Product phải cùng organization.
- Backend tự lấy `system_qty` tại thời điểm tạo/cân bằng.
- Hàng `normal`: không nhận `inventory_roll_id`/`inventory_sheet_id`.
- Hàng `roll`: bắt buộc `inventory_roll_id`.
- Hàng `sheet`: bắt buộc `inventory_sheet_id`.

**Workflow:**

1. Sinh mã `KK...`.
2. Tính `system_qty` và `difference_qty`.
3. Tạo `stocktakes` + `stocktake_items`.
4. Nếu `save_mode = draft`, lưu `status = draft`, không đổi tồn.
5. Nếu `save_mode = balance_now`, tạo `stock_movements` loại `stocktake_adjustment`, cập nhật đối tượng tồn tương ứng, đổi phiếu sang `balanced`.

### `PUT /inventory/stocktakes/{id}`

Cập nhật phiếu kiểm kho `draft`.

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** route đã mở nhưng trả `VALIDATION_ERROR`; chưa sửa phiếu thủ công.

Chỉ cho sửa phiếu `status = draft`. Khi cập nhật, Backend tính lại `system_qty` hoặc giữ snapshot cũ theo thời điểm tạo tùy implementation, nhưng phải nhất quán trong response.

### `POST /inventory/stocktakes/{id}/balance`

Cân bằng kho cho phiếu `draft`.

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** route đã mở nhưng trả `VALIDATION_ERROR`; chưa cân bằng phiếu thủ công.

Workflow:

1. Lock phiếu kiểm kho.
2. Kiểm tra phiếu còn `draft`.
3. Với từng dòng có `difference_qty != 0`, tạo `stock_movements` loại `stocktake_adjustment`.
4. Cập nhật tồn/từng cuộn/từng tấm theo số thực tế.
5. Đổi phiếu sang `balanced`, set `balanced_at`.

### `POST /inventory/stocktakes/{id}/cancel`

Hủy phiếu kiểm kho.

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** route đã mở nhưng trả `VALIDATION_ERROR`; chưa hủy phiếu thủ công.

Chỉ cho hủy phiếu `draft`. Phiếu đã `balanced` không hủy bằng endpoint này; nếu cần đảo tồn sau này phải có spec riêng.

### `GET /inventory/stocktakes`

Danh sách phiếu kiểm kho.

**Permission:** `perm.manage_inventory`

Query: `search`, `status`, `created_by`, `from`, `to`, `page`, `page_size`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "KK000333",
      "status": "balanced",
      "source_type": "product_edit",
      "created_at": "2026-07-07T08:00:00Z",
      "balanced_at": "2026-07-07T08:00:00Z",
      "total_actual_qty": 10,
      "total_actual_value": 100000,
      "total_difference_value": -5000,
      "increased_qty": 2,
      "decreased_qty": 3,
      "note": "Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa..."
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

Các trường giá trị tổng hợp được hydrate từ `stocktake_items` và `products.latest_purchase_cost`. Nếu thiếu giá vốn để tính tiền, Backend trả `null` cho `total_actual_value` hoặc `total_difference_value`; UI hiển thị `Chưa có`.

### `GET /inventory/stocktakes/{id}`

Chi tiết phiếu kiểm kho và các dòng.

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** trả đầu phiếu + các trường tổng hợp giống list. Dòng chi tiết `stocktake_items` sẽ bổ sung khi làm form tạo/sửa phiếu thủ công.

---

## 10. Sửa tồn trực tiếp từ Hàng hóa

### `POST /inventory/products/{product_id}/adjust-stock`

Sửa tồn trực tiếp cho hàng `normal` trong trang Hàng hóa và tự sinh phiếu kiểm kho đã cân bằng.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "actual_qty": 120,
  "reason": "Cập nhật tồn từ trang Hàng hóa"
}
```

**Validation:**

- Product phải cùng organization.
- Product phải có `inventory_shape = normal`.
- `actual_qty >= 0` trừ khi sau này cho phép nhập tồn âm thủ công bằng spec riêng.
- `reason` bắt buộc.
- Hàng `roll` và `sheet` không được sửa tổng tồn bằng endpoint này; phải sửa theo cuộn/tấm hoặc kiểm kho object-level.

**Workflow:**

1. Lấy tồn hệ thống hiện tại của product.
2. Sinh phiếu kiểm kho `source_type = product_edit`, `status = balanced`.
3. Tạo một `stocktake_item`.
4. Tạo `stock_movements` loại `stocktake_adjustment` với chênh lệch.
5. Trả phiếu kiểm kho tự động vừa tạo.

Frontend dùng `id` và `code` trong response để hiển thị thông báo:

```text
Đã tạo phiếu kiểm kho KK000001. Xem phiếu KK000001
```

Link xem phiếu trỏ về danh sách/chi tiết phiếu kiểm kho, không mở modal giả trong Hàng hóa.

---

## 11. Error Handling

| HTTP | Code | Khi dùng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai, thiếu dòng, sai hình dạng tồn |
| 401 | `AUTH_REQUIRED` | Thiếu hoặc sai access token |
| 403 | `PERMISSION_DENIED` | Thiếu permission |
| 403 | `WORKSTATION_INVALID` | Workstation không hợp lệ |
| 404 | `RESOURCE_NOT_FOUND` | Không tìm thấy product/cuộn/tấm/phiếu trong organization |
| 409 | `RESOURCE_CONFLICT` | Phiếu không còn draft, mã trùng, object đang bị dùng |
| 409 | `INVENTORY_OBJECT_CONFLICT` | Cuộn/tấm được chọn để khui đã đổi trạng thái bởi thao tác khác |
| 422 | `INVENTORY_OPERATION_FAILED` | Không thể hoàn tất nghiệp vụ kho có thể giải thích |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống không công khai chi tiết |

---

## 12. Logging và metric

Backend nên log:

- tạo/sửa cuộn
- tạo/sửa/tạo thủ công tấm lỡ
- tạo/cân bằng/hủy kiểm kho
- sửa tồn trực tiếp từ Hàng hóa
- stock movement thủ công
- khui hàng `normal` có quy đổi đơn vị/cuộn/tấm
- khui từ tồn tạm KiotViet

Metric gợi ý:

- số stocktake tạo mới/cân bằng/hủy
- số stock movement theo loại
- số mặt hàng tồn âm
- số lần khui vật tư theo loại `normal`/`roll`/`sheet`
- latency API kiểm kho

---

← [Quay về Inventory README](./README.md)
