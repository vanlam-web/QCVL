# Purchase API — Backend contract mức khung

> **Vai trò:** Draft kỹ thuật từ Source of Truth nghiệp vụ.
> **Business:** [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md)

---

## 1. Endpoints tối thiểu

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/v1/suppliers` | Danh sách NCC, search/filter |
| `POST` | `/v1/suppliers` | Tạo NCC |
| `GET` | `/v1/suppliers/{id}` | Chi tiết NCC |
| `PATCH` | `/v1/suppliers/{id}` | Sửa hồ sơ NCC |
| `GET` | `/v1/purchase/receipts` | Danh sách phiếu nhập |
| `POST` | `/v1/purchase/receipts` | Tạo phiếu nhập draft |
| `GET` | `/v1/purchase/receipts/{id}` | Chi tiết phiếu nhập |
| `PATCH` | `/v1/purchase/receipts/{id}` | Sửa draft |
| `POST` | `/v1/purchase/receipts/{id}/post` | Hoàn thành nhập hàng |
| `POST` | `/v1/purchase/receipts/{id}/cancel` | Hủy phiếu |
| `POST` | `/v1/suppliers/{id}/payments` | Trả tiền NCC |

Không cần implement tất cả endpoint trong một slice. P1/P2/P3/P5 đã merge; P4 cuộn/tấm là candidate riêng theo [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md#9-lát-cắt-purchase).

Search contract:

- `GET /v1/suppliers` nhận `search` hoặc `q`, tìm bỏ dấu theo mã NCC, tên NCC, SĐT, email, mã số thuế và ghi chú.
- `GET /v1/purchase/receipts` nhận `search` hoặc `q`, tìm bỏ dấu theo mã phiếu nhập, mã/tên NCC, số chứng từ NCC và ghi chú.
- Các endpoint list phải kết hợp search với filter trạng thái/ngày/tổng tiền hiện có, không trả tất cả khi có search.

## 2. Supplier/customer link

Hồ sơ NCC có thể liên kết tới khách hàng khi cùng một đối tác vừa mua vừa bán với xưởng.

Quy tắc API:

- `POST/PATCH /v1/suppliers` nhận tùy chọn `linked_customer_id`.
- `linked_customer_id` phải thuộc cùng organization nếu có.
- Backend không tự gộp NCC và khách hàng theo số điện thoại/tên.
- Nếu công nợ NCC âm, API giữ số âm và trả thêm thông tin khách hàng liên kết nếu có để UI đối soát; không tự chuyển thành trả trước NCC.

---

## 3. Supplier API contract

### `GET /v1/suppliers`

**Permission:** `perm.manage_inventory` hoặc permission quản lý danh mục/kho tương đương trong MVP preset nội bộ.

**Query:**

| Tham số | Mô tả |
|---|---|
| `q` | Tìm theo mã/tên/số điện thoại |
| `status` | `active`, `inactive`, `all`; mặc định `active` |
| `page`, `page_size` | Phân trang |

**Response item tối thiểu:**

```json
{
  "id": "uuid",
  "code": "NCC000001",
  "name": "Nguyễn Phong",
  "phone": "090...",
  "email": null,
  "status": "active",
  "linked_customer": {
    "id": "uuid",
    "code": "KH000123",
    "name": "Nguyễn Phong"
  },
  "current_payable_amount": 0,
  "total_purchase_amount": 0
}
```

### `POST /v1/suppliers`

**Input:**

```json
{
  "code": "",
  "name": "Nguyễn Phong",
  "phone": "",
  "email": "",
  "address": "",
  "tax_code": "",
  "linked_customer_id": "uuid",
  "notes": ""
}
```

Rules:

- `name` bắt buộc.
- `code` bỏ trống thì backend tự sinh `NCC000001...`.
- `phone` được phép trống, không unique cứng.
- `linked_customer_id` nếu có phải cùng organization.

### `PATCH /v1/suppliers/{id}`

Cho phép sửa các trường hồ sơ và `status`.

Không xóa vật lý NCC đã có chứng từ.

---

## 4. Purchase receipt API contract

### `POST /v1/purchase/receipts`

Tạo phiếu nhập draft.

**Input tối thiểu P2:**

```json
{
  "supplier_id": "uuid",
  "received_at": "2026-07-01T10:00:00+07:00",
  "supplier_document_no": "HD-NCC-001",
  "notes": "",
  "items": [
    {
      "product_id": "uuid",
      "unit_name": "tấm",
      "quantity": 2,
      "unit_cost": 100000,
      "discount_amount": 0
    }
  ],
  "discount_amount": 0,
  "paid_amount": 0,
  "payment_method": null,
  "bank_account_id": null
}
```

Rules:

- Draft hiện tại hỗ trợ hàng thường; roll/sheet object model thuộc P4.
- `quantity > 0`, `unit_cost >= 0`, discount không âm.
- Backend tính `subtotal_amount`, `payable_amount`, `remaining_amount`; không tin tổng tiền từ client.
- Draft không tạo stock movement, payable, cashbook.
- Không cho trùng cùng `product_id` trong một draft P2 để tránh nhập nhiều dòng cùng sản phẩm làm mơ hồ `latest_purchase_cost`.

### `GET /v1/purchase/receipts`

Hỗ trợ filter:

- `q`: mã phiếu, mã/tên NCC, số chứng từ NCC
- `date_from`, `date_to`
- `status`
- `created_by`, `posted_by` nếu có

Nếu `q` là exact mã phiếu `PN...`, backend phải bỏ qua/widen date filter mặc định.

### `POST /v1/purchase/receipts/{id}/post`

## 5. Transaction khi post phiếu nhập

`POST /v1/purchase/receipts/{id}/post` phải chạy trong transaction:

1. validate phiếu đang `draft`
2. validate NCC, dòng hàng, đơn vị, giá nhập
3. với hàng `normal`: tạo stock movement tăng tồn
4. với hàng `roll`: tạo roll object vật lý và stock movement liên quan
5. với hàng `sheet`: tạo sheet object/lô tấm và stock movement liên quan
6. lưu giá vốn trên dòng nhập và object vật lý
7. tạo payable nếu chưa trả đủ
8. tạo cashbook outflow nếu có trả ngay
9. cập nhật `products.latest_purchase_cost`, `latest_purchase_cost_at`, `latest_purchase_cost_updated_by`
10. chuyển trạng thái phiếu sang `posted`

Nếu bất kỳ bước nào lỗi, rollback toàn bộ.

---

## 6. Search và filter

Danh sách phiếu nhập cần hỗ trợ:

- search exact theo mã phiếu
- search theo NCC
- date range dài hạn
- trạng thái
- người tạo/người nhập

Nếu search exact mã phiếu, backend nên bỏ qua/widen date filter mặc định để tránh không tìm thấy chứng từ cũ do đang lọc tháng hiện tại.

---

## 7. Không làm trong API đầu tiên

- đặt hàng nhập
- trả hàng nhập
- tích hợp hóa đơn điện tử/thuế
- nhiều phương thức thanh toán trong một lần trả NCC
- báo cáo NCC nâng cao
- tự động đối trừ công nợ NCC âm với công nợ khách hàng liên kết
