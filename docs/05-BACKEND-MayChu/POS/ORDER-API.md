# ORDER-API — API nháp, báo giá và hóa đơn POS

> **Base path:** `/api/v1`
> **Business:** [POS-ORDER-LIFECYCLE.md](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md)
> **Database:** [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md), [INVENTORY-TABLES.md](../../04-DATABASE/Inventory/INVENTORY-TABLES.md), [PAYMENT-DEBT-TABLES.md](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md), [CASHBOOK-TABLES.md](../../04-DATABASE/Finance/CASHBOOK-TABLES.md)

---

## 1. Phạm vi

Tài liệu này là Source of Truth cho Backend API liên quan đến vòng đời đơn POS:

- validate/tính giỏ hàng nháp
- lưu báo giá `BG...`
- tìm và mở lại báo giá
- cập nhật báo giá
- checkout tạo hóa đơn `HD...`
- sửa hóa đơn đã chốt bằng bản mới `MaCu.01`
- đọc chứng từ đã lưu
- khóa hóa đơn cũ khi mở lại để sửa ở phase sau

Trạng thái implementation hiện tại:

- Đã có foundation checkout/hóa đơn và Sales Documents readonly theo các phase đã merge.
- 2026-07-12: Sales Documents có import hóa đơn KiotViet cho dữ liệu lịch sử và stock-out. Import này phục vụ hoàn thiện tồn `Hang hoa`: đọc chi tiết hóa đơn KV, gom theo `Ma hoa don`, và hóa đơn hoàn tất tạo nguồn trừ tồn `sale_deduction` trong dev-memory.
- 2026-07-18: Sửa hóa đơn đã chốt đã có flow riêng từ Sales Documents sang POS bằng handoff `invoice-revision`; khi lưu POS gọi `POST /orders/{id}/revise`, tạo hóa đơn mới `MaCu.01` và chuyển hóa đơn cũ sang `cancelled`.
- Hủy hóa đơn độc lập và các rule nâng cao như khóa mềm/giới hạn 10 ngày vẫn thuộc phase sau nếu code chưa enforce tại endpoint.

Không bao gồm:

- API quản trị sổ quỹ/đối soát độc lập
- API kiểm kho/quản trị tồn kho độc lập
- in/gửi bill

Nháp POS Phase 2 vẫn lưu local theo máy tại `POS/ARCHITECTURE.md`. Backend không tạo bản ghi `orders` cho nháp cho đến khi nhân viên lưu báo giá hoặc checkout thành công.

Rule thời gian:

- Hóa đơn/báo giá tạo trực tiếp từ POS dùng mã chứng từ kiểu KiotViet: `HD` + 6 số cho hóa đơn và `BG` + 6 số cho báo giá. Backend lấy số lớn nhất đang có cùng prefix trong Sales Documents rồi cộng 1; không sinh dạng `HD-POS-*`/`BG-POS-*` nữa. `created_at` là thời điểm backend nhận checkout/quote; UI hiển thị theo giờ local vận hành Việt Nam, không lấy giờ tạo tab nháp làm giờ hóa đơn.
- Hóa đơn import KiotViet giữ nguyên clock nguồn KiotViet khi hiển thị để đối chiếu với file/KV; không dùng formatter local-shift của POS cho mã import KV.

Rule chi tiết dòng hàng:

- Detail hóa đơn POS phải hydrate sản phẩm theo `order_items.product_id` từ catalog/repository thật. Không được fallback sang mảng demo `products[0]`; nếu không hàng import như `IB - In bạt` sẽ bị hiển thị sai thành `MICA-3MM`.
- POS phải dùng `unit_conversions` đã import từ KiotViet cho menu đơn vị bán trên từng dòng. Ví dụ `F5 - Fomex 5mm` có đơn vị gốc `Tấm` và các đơn vị `Tấc`, `Tấm CNC`, `Tấc CNC`.
- Khi khôi phục tab nháp sau F5/reload hoặc mở lại POS, frontend phải resolve `product_id` của từng dòng về catalog/repository hiện tại để lấy `unit_conversions` mới nhất. Không khóa dropdown đơn vị theo snapshot cũ trong localStorage.
- Khi checkout bằng đơn vị quy đổi, payload dòng hàng gửi `sale_unit_name` và `stock_qty_per_sale_unit`. Hóa đơn hiển thị đơn vị bán đã chọn, còn tồn vận hành quy đổi về đơn vị gốc bằng `quantity * stock_qty_per_sale_unit`.
- Không tự suy diễn đơn vị ảo như `m2`, `m tới`, `m` nếu KV chưa có quy đổi. Phần đó thuộc nâng cấp cuộn/tấm/object-level sau.

---

## 2. Auth, response và permission

Mọi endpoint yêu cầu:

```http
Authorization: Bearer <qcvl_access_token>
X-Workstation-Id: <uuid>
X-Request-Id: <client-generated-id>   # không bắt buộc
```

Áp dụng response chuẩn tại [FOUNDATION-API.md](../FOUNDATION-API.md#2-response-chuẩn).

| Nhóm API | Permission |
|---|---|
| Validate/tính giỏ nháp | `perm.create_order` |
| Tạo, đọc, cập nhật báo giá | `perm.create_order` |
| Checkout tạo hóa đơn | `perm.create_order` |
| Sửa hóa đơn đã chốt | `perm.edit_order_locked` |
| Khóa/mở khóa hóa đơn cũ để sửa | `perm.edit_order_locked` |

Ghi chú MVP: `perm.create_order` và các quyền thao tác POS thường ngày phải nằm trong preset `Nhân viên nội bộ`. `perm.edit_order_locked` là guard kỹ thuật cho luồng sửa/hủy chứng từ đã chốt bằng bản mới `MaCu.01`; nếu Owner muốn kiểm soát mạnh hơn, tách ở preset hoặc yêu cầu xác nhận lại, không thêm approval nhiều bước trong MVP.

---

## 2A. KiotViet invoice import

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sales-documents/import/kiotviet/preview` | Preview KiotViet invoice detail Excel import |
| `POST` | `/sales-documents/import/kiotviet` | Import/upsert KiotViet invoices by `Ma hoa don` |
| `DELETE` | `/sales-documents/import/kiotviet` | Delete old KiotViet invoice import data |
| `PATCH` | `/sales-documents/{id}` | Cancel a sales document or update its note |

### `PATCH /sales-documents/{id}`

Hỗ trợ 2 thao tác riêng:

- Lưu ghi chú nhanh trong detail: `{ "note": "Ghi chú mới" }`. Chuỗi rỗng lưu về `null`/rỗng tùy storage, response trả detail giống `GET /sales-documents/{id}`.
- Hủy chứng từ: `{ "status": "cancelled" }`. Không gửi kèm `note` trong cùng request.
- Đổi `created_at` của chứng từ chỉ đồng bộ dòng quỹ sinh cùng lần bán đó (`TTHD...`/`TTHD...-NH`/`TTHD...-TM`) và `payment_receipts`/`payment_receipt_methods` của chính hóa đơn này. Dòng thu nợ sau (`TT...`) giữ thời gian thu thật, không kéo theo ngày bán.

### Mapping rules

- Source file: KiotViet invoice detail export (`DanhSachChiTietHoaDon_...xlsx`).
- Group detail rows by `Ma hoa don`; that code is the idempotent import key.
- Blank `Ma khach hang` or `Khach le` maps to customer code `khachle`.
- If `khachle` is missing, import auto-creates the default walk-in customer before writing invoices.
- Customer codes ending `{DEL}`, `{DEL1}`, `{DEL2}`, ... are historical KiotViet-deleted customers. Import auto-creates inactive placeholder customers so old invoices can be kept.
- `Nguoi ban` and `Nguoi tao` collapse to one QCVL seller/account reference for now.
- `Kenh ban` is ignored because QCVL current scope is direct sales only.
- Payment fields kept: `Tien mat`, `Chuyen khoan`, `Khach da tra`, `Khach can tra`.
- Payment fields ignored: card and wallet.
- `Ma hang` must match an imported product code or a product unit-conversion source code. Example: `B260` can resolve to parent product `BT`, and quantity is converted by `stock_qty_per_unit`.
- Product codes ending `{DEL}`, `{DEL1}`, `{DEL2}`, ... are historical KiotViet-deleted products. Import auto-creates inactive, non-inventory-tracked placeholder products so old invoice lines can be kept without affecting current stock.
- Completed invoices create `sale_deduction` stock movements. Cancelled invoices do not deduct stock.
- Cleanup is a separate explicit action in the import dialog; do not hide delete inside the import action.

---

## 3. Cart validation

### `POST /pos/cart/validate`

Validate và tính lại giỏ hàng nháp từ dữ liệu POS gửi lên.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "customer_id": "uuid",
  "items": [
    {
      "client_line_id": "local-line-1",
      "product_id": "uuid",
      "sell_method": "linear_m",
      "quantity": 1,
      "width_m": null,
      "height_m": null,
      "linear_m": 1.5,
      "unit_price": 120000,
      "price_source": "customer_group",
      "note": "Cắt gấp"
    }
  ],
  "note": "Giao chiều nay"
}
```

`customer_id` được phép null ở bước validate giỏ hàng vì chưa ghi chứng từ.

**Validation:**

- Mọi `product_id` phải tồn tại, active và cùng organization.
- `quantity > 0`.
- `unit_price >= 0`.
- `sell_method` phải khớp sản phẩm hoặc là cách bán hợp lệ được Backend cho phép.
- Với `area_m2`, `width_m` và `height_m` bắt buộc lớn hơn 0.
- Với `linear_m`, `linear_m` bắt buộc lớn hơn 0.
- `price_source = manual` được phép khi người dùng sửa giá.

**Workflow:**

1. Xác thực actor, workstation và permission.
2. Tải sản phẩm active trong organization.
3. Validate từng dòng.
4. Tính lại `line_total` theo Business Rule tính giỏ hàng.
5. Trả giỏ hàng đã chuẩn hóa cho Frontend.

**Response data:**

```json
{
  "items": [
    {
      "client_line_id": "local-line-1",
      "product_id": "uuid",
      "quantity": 1,
      "unit_price": 120000,
      "line_total": 180000,
      "price_source": "customer_group"
    }
  ],
  "subtotal_amount": 180000,
  "total_amount": 180000
}
```

---

## 4. Quotes

### `POST /orders/quotes`

Lưu hóa đơn nháp hiện tại thành báo giá.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "customer_id": "uuid",
  "customer_snapshot": {
    "code": "KH000001",
    "name": "Công ty ABC",
    "phone": "0901234567"
  },
  "price_list_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "product_snapshot": {
        "code": "MICA-3MM",
        "name": "Mica 3mm",
        "unit_name": "m",
        "sell_method": "linear_m"
      },
      "sell_method": "linear_m",
      "quantity": 1,
      "linear_m": 1.5,
      "unit_price": 120000,
      "price_source": "customer_group",
      "line_total": 180000,
      "note": "Cắt gấp"
    }
  ],
  "note": "Giao chiều nay"
}
```

**Validation:**

- Nếu Frontend không gửi `customer_id`, Backend resolve về khách mặc định `khachle - Khách lẻ` trước khi lưu.
- Nếu có `customer_id`, khách phải cùng organization.
- `customer_snapshot` bắt buộc, kể cả khách lẻ.
- Có ít nhất một dòng hàng.
- Dòng hàng phải pass cùng validation với `/pos/cart/validate`.
- `subtotal_amount` và `total_amount` do Backend tính lại, không tin tổng tiền client gửi lên.

**Workflow:**

1. Validate giỏ hàng.
2. Sinh mã `BG...` tăng dần trong organization.
3. Tạo `orders` với `order_type = quote`, `status = active`.
4. Tạo `order_items` theo snapshot đã validate.
5. Cộng lượt dùng sản phẩm vào `pos_product_usage` cho từng dòng có `product_id`.
6. Ghi `order_status_history` từ null sang `active`.
7. Trả báo giá vừa tạo.

**Response data:**

```json
{
  "id": "uuid",
  "code": "BG000001",
  "order_type": "quote",
  "status": "active",
  "total_amount": 180000
}
```

### `GET /orders/quotes`

Tìm báo giá.

**Permission:** `perm.create_order`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | `string` | Không | Tìm bỏ dấu theo mã báo giá/hóa đơn, tên/mã khách trong snapshot và ghi chú chứng từ |
| `status` | `string` | Không | `active`, `converted`, `cancelled`, mặc định `active` |
| `page` | `number` | Không | Mặc định `1` |
| `page_size` | `number` | Không | Mặc định `20`, tối đa `100` |

### `GET /orders/{id}`

Đọc báo giá hoặc hóa đơn đã lưu.

**Permission:** `perm.create_order`

Chỉ trả chứng từ trong cùng organization.

### `PUT /orders/quotes/{id}`

Cập nhật báo giá active.

**Permission:** `perm.create_order`

Validation giống `POST /orders/quotes`.

Chỉ cho cập nhật báo giá `order_type = quote` và `status = active`.

Khi Frontend mở báo giá vào POS rồi nhân viên bấm **Báo giá**, UI phải hỏi lưu đè báo giá cũ hay lưu thành báo giá mới:

- Lưu đè gọi `PUT /orders/quotes/{id}` và giữ mã `BG...`.
- Lưu mới gọi `POST /orders/quotes` và sinh mã `BG...` mới.
- Mặc định UI nên đề xuất lưu mới để tránh mất nội dung báo giá đã gửi.

Workflow cập nhật:

1. Validate input.
2. Cập nhật snapshot tổng ở `orders`.
3. Thay thế toàn bộ `order_items` của báo giá bằng danh sách mới.
4. Không đổi mã `BG...`.

### `POST /orders/quotes/{id}/cancel`

Hủy báo giá.

**Permission:** `perm.create_order`

Chỉ cho hủy báo giá `status = active`.

Hủy báo giá không xóa dữ liệu, chỉ đổi `status = cancelled` và ghi `order_status_history`.

---

## 5. Invoice link from quote

### `POST /orders/quotes/{id}/mark-converted`

Đánh dấu báo giá đã được chuyển thành hóa đơn.

**Permission:** `perm.create_order`

Endpoint này chỉ được gọi nội bộ sau khi checkout tạo hóa đơn `HD...` thành công và checkout có giữ `source_quote_id`.

Frontend không gọi endpoint này trực tiếp trong MVP. Nếu checkout không truyền `source_quote_id`, báo giá cũ vẫn giữ trạng thái hiện tại và hóa đơn mới được xem như hóa đơn bán thẳng.

**Input:**

```json
{
  "invoice_order_id": "uuid"
}
```

**Validation:**

- Báo giá phải cùng organization, `order_type = quote`, `status = active`.
- Hóa đơn phải cùng organization, `order_type = invoice`.
- Hóa đơn phải có `source_quote_id` trỏ về báo giá này.

**Workflow:**

1. Kiểm tra báo giá và hóa đơn.
2. Đổi báo giá sang `status = converted`.
3. Ghi `order_status_history`.

---

## 6. Checkout hóa đơn

### `POST /orders/checkout`

Checkout giỏ hàng hiện tại thành hóa đơn bán hàng `HD...`.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "source_quote_id": "uuid",
  "customer_id": "uuid",
  "customer_snapshot": {
    "code": "KH000001",
    "name": "Công ty ABC",
    "phone": "0901234567"
  },
  "price_list_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "product_snapshot": {
        "code": "BAT-HIFLEX-32",
        "name": "Bạt Hiflex 3.2m",
        "unit_name": "m2",
        "sell_method": "area_m2"
      },
      "sell_method": "area_m2",
      "quantity": 1,
      "width_m": 2,
      "height_m": 3,
      "unit_price": 50000,
      "discount_amount": 0,
      "price_source": "customer_group",
      "note": "Chừa biên theo mặc định"
    }
  ],
  "payment": {
    "cash_amount": 300000,
    "bank_amount": 0,
    "bank_account_id": null,
    "bank_transaction_ref": null,
    "old_debt_payment_amount": 0
  },
  "retail_debt_note": null,
  "note": "Giao chiều nay"
}
```

`source_quote_id`, `customer_id`, `price_list_id`, `bank_account_id` được phép null trong input theo nghiệp vụ. Khi ghi hóa đơn, `customer_id` null phải được Backend resolve về `khachle - Khách lẻ`; dữ liệu lưu không dùng bucket khách lẻ null.

Ghi chú: khi nhân viên mở báo giá về POS, POS tạo một nháp local có thể sửa. Nếu checkout gửi `source_quote_id`, backend giữ link `BG... -> HD...` và đổi báo giá sang `converted`. Nếu checkout không gửi `source_quote_id`, backend tạo hóa đơn như bán thẳng; đây vẫn là hành vi hợp lệ trong MVP.

`payment.cash_amount` và `payment.bank_amount` là số tiền thực giữ lại để ghi quỹ, không bao gồm tiền thừa đã trả lại khách.

Nếu khách trả dư và nhân viên chọn cấn vào nợ cũ, phần cấn nợ được đưa vào `old_debt_payment_amount`. Nếu trả lại khách, phần đó không đưa vào `cash_amount`/`bank_amount`.

**Validation:**

- Có ít nhất một dòng hàng.
- Dòng hàng phải pass validation như `/pos/cart/validate`.
- Backend tự tính lại `line_subtotal_amount`, `line_total`, `subtotal_amount`, `discount_amount`, `total_amount`.
- Nếu `source_quote_id` có giá trị, báo giá phải cùng organization, `order_type = quote`, `status = active`.
- Nếu Frontend không gửi `customer_id`, Backend resolve về `khachle - Khách lẻ`.
- Nếu khách được resolve là `khachle` và hóa đơn còn nợ, `retail_debt_note` bắt buộc để nhận diện người nợ.
- `cash_amount >= 0`, `bank_amount >= 0`, `old_debt_payment_amount >= 0`.
- Nếu `bank_amount > 0`, `bank_account_id` bắt buộc, active, cùng organization và là tài khoản `bank`.
- Một lần checkout chỉ được chọn tối đa một tài khoản bank.
- Nếu `old_debt_payment_amount > 0`, `customer_id` bắt buộc.
- Cho phép tồn kho âm sau cảnh báo; Backend không chặn checkout chỉ vì thiếu tồn.

**Workflow bắt buộc trong một transaction nghiệp vụ:**

1. Xác thực actor, workstation và permission.
2. Validate giỏ hàng và tính lại tiền.
3. Sinh mã `HD...`.
4. Resolve khách hàng: nếu input không có khách, dùng `khachle - Khách lẻ`.
5. Tạo `orders` loại `invoice`, `status = completed`.
6. Tạo `order_items` snapshot.
7. Cộng lượt dùng sản phẩm vào `pos_product_usage` cho từng dòng có `product_id`.
8. Trừ kho theo Inventory rule bằng `stock_movements`.
9. Nếu có tiền thực giữ lại, tạo `payment_receipts` và `payment_receipt_methods`.
10. Tạo `cashbook_entries` từ từng dòng phương thức thu.
11. Nếu hóa đơn mới còn nợ, tạo `customer_debt_entries` loại `invoice_debt`.
12. Nếu có trả nợ cũ, phân bổ vào hóa đơn còn nợ cũ nhất trước bằng `customer_debt_allocations` và tạo `customer_debt_entries` loại `debt_payment`.
13. Nếu có `source_quote_id`, đổi báo giá sang `converted`; nếu không có thì bỏ qua bước này.
14. Ghi `order_status_history`.
15. Trả hóa đơn, payment summary, debt summary và cảnh báo tồn kho nếu có.

Nếu bất kỳ bước ghi dữ liệu chính nào lỗi, transaction phải rollback; không được tạo hóa đơn dở dang.

**Response data:**

```json
{
  "order": {
    "id": "uuid",
    "code": "HD000123",
    "order_type": "invoice",
    "status": "completed",
    "total_amount": 300000,
    "paid_amount": 300000,
    "debt_amount": 0,
    "payment_status": "paid"
  },
  "payment_receipt": {
    "id": "uuid",
    "code": "PT000001",
    "total_received_amount": 300000
  },
  "inventory_warnings": []
}
```

---

## 7. Sửa hóa đơn đã chốt

### `POST /orders/{id}/revise`

Tạo bản sửa của hóa đơn đã chốt theo mã `MaCu.01`, không sửa đè hóa đơn cũ.

**Permission:** `perm.edit_order_locked`

**Input:**

Payload dùng cùng cấu trúc checkout, cộng thêm lý do sửa. Frontend không gửi `customer_snapshot`; Backend resolve khách và tạo snapshot khi lưu.

```json
{
  "customer_id": "uuid",
  "created_at": "2026-07-18T04:15:00+07:00",
  "note": "Nội dung sau sửa",
  "retail_debt_note": "Ghi chú công nợ sau sửa",
  "items": [
    {
      "product_id": "uuid",
      "sell_method": "area_m2",
      "quantity": 1,
      "width_m": 2,
      "height_m": 3,
      "unit_price": 50000,
      "sale_unit_name": "m2",
      "stock_qty_per_sale_unit": 1,
      "discount_amount": 0,
      "price_source": "manual",
      "note": "Nội dung sau sửa"
    }
  ],
  "payment": {
    "cash_amount": 0,
    "bank_amount": 0,
    "bank_account_id": null,
    "old_debt_payment_amount": 0,
    "change_returned_amount": 0
  },
  "revision_reason_code": "wrong_dimension",
  "revision_reason_note": "Sửa sai kích thước"
}
```

**Validation:**

- Actor phải có `perm.edit_order_locked`.
- Hóa đơn gốc phải cùng organization, `order_type = invoice`, `status = completed`.
- `customer_id` được phép bỏ trống; Backend resolve về `khachle - Khách lẻ` giống checkout.
- `revision_reason_code` bắt buộc, thuộc nhóm `wrong_price`, `wrong_dimension`, `wrong_customer`, `customer_changed_mind`, `other`.
- `revision_reason_note` không bắt buộc, trừ khi `revision_reason_code = other`.
- Input giỏ hàng và payment validate như checkout.

**Workflow:**

1. Validate quyền, hóa đơn gốc, lý do sửa và payload checkout.
2. Tính `base_code` từ hóa đơn gốc và lấy `revision_no` kế tiếp trong cùng organization.
3. Tạo hóa đơn mới với mã dạng `HD000123.01`, lưu `base_code`, `revision_no`, `revised_from_order_id` và `revision_reason_*`.
4. Chuyển hóa đơn cũ sang `status = cancelled`, `cancel_reason_type = revised`, `replaced_by_order_id = hóa đơn mới`.
5. Ghi cashbook/payment receipt cho hóa đơn mới theo payload payment.
6. Trả kết quả checkout của hóa đơn mới để POS mở Bill Preview.

**Response data:**

HTTP `201`.

```json
{
  "order": {
    "id": "uuid",
    "code": "HD000123.01",
    "order_type": "invoice",
    "status": "completed",
    "created_at": "2026-07-18T04:15:00.000Z",
    "total_amount": 300000,
    "paid_amount": 300000,
    "debt_amount": 0,
    "payment_status": "paid",
    "base_code": "HD000123",
    "revision_no": 1,
    "revised_from_order_id": "old-order-id"
  },
  "payment_receipt": null,
  "inventory_warnings": []
}
```

`payment_receipt` có dữ liệu khi payload tạo phiếu thu; nếu không thu tiền ngay thì trả `null`.

---

## 8. Order lock

### `POST /orders/{id}/lock`

Khóa hóa đơn cũ khi mở lại để sửa trong phase sau.

**Permission:** `perm.edit_order_locked`

Chi tiết lock hiện tại tham chiếu [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-concurrency-lock--khóa-đơn-tranh-chấp).

### `POST /orders/{id}/unlock`

Giải phóng khóa hóa đơn.

**Permission:** `perm.edit_order_locked`

---

## 9. Error Handling

| HTTP | Code | Khi dùng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Giỏ hàng sai, thiếu snapshot, giá trị không hợp lệ |
| 401 | `AUTH_REQUIRED` | Thiếu hoặc sai access token |
| 403 | `PERMISSION_DENIED` | Thiếu permission |
| 403 | `WORKSTATION_INVALID` | Workstation không hợp lệ |
| 404 | `RESOURCE_NOT_FOUND` | Không tìm thấy customer/product/order trong organization |
| 409 | `RESOURCE_CONFLICT` | Báo giá không còn active, đơn đang bị khóa hoặc mã chứng từ xung đột |
| 422 | `CHECKOUT_FAILED` | Checkout không thể hoàn tất do lỗi nghiệp vụ có thể giải thích |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống không công khai chi tiết |

---

## 10. Logging và metric

Backend nên log:

- tạo báo giá
- cập nhật báo giá
- hủy báo giá
- chuyển báo giá thành hóa đơn
- checkout hóa đơn thành công/thất bại
- sửa hóa đơn tạo bản mới
- lock/unlock hóa đơn cũ

Metric gợi ý:

- số báo giá tạo mới
- số báo giá chuyển hóa đơn
- số hóa đơn checkout thành công
- lỗi checkout theo nhóm validation/payment/inventory
- lỗi validate giỏ hàng
- latency `/pos/cart/validate`
- latency `/orders/checkout`

---

← [Quay về POS README](./README.md)
