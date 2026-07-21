# Purchase API — Backend contract mức khung

> **Vai trò:** Draft kỹ thuật từ Source of Truth nghiệp vụ.
> **Business:** [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md)

---

## 1. Endpoints tối thiểu

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/v1/suppliers` | Danh sách NCC, search/filter |
| `POST` | `/v1/suppliers/import/kiotviet/preview` | Xem trước import NCC từ Excel KiotViet |
| `POST` | `/v1/suppliers/import/kiotviet` | Import/upsert NCC từ Excel KiotViet |
| `DELETE` | `/v1/suppliers/import/kiotviet` | Xóa dữ liệu NCC cũ từ import KiotViet |
| `POST` | `/v1/suppliers` | Tạo NCC |
| `GET` | `/v1/suppliers/{id}` | Chi tiết NCC |
| `PATCH` | `/v1/suppliers/{id}` | Sửa hồ sơ NCC |
| `GET` | `/v1/purchase/receipts` | Danh sách phiếu nhập |
| `POST` | `/v1/purchase/receipts/import/kiotviet/preview` | Xem trước import chi tiết nhập hàng KiotViet |
| `POST` | `/v1/purchase/receipts/import/kiotviet` | Import/upsert chi tiết nhập hàng KiotViet |
| `DELETE` | `/v1/purchase/receipts/import/kiotviet` | Xóa dữ liệu phiếu nhập import cũ |
| `POST` | `/v1/purchase/receipts` | Tạo phiếu nhập draft |
| `GET` | `/v1/purchase/receipts/{id}` | Chi tiết phiếu nhập |
| `PATCH` | `/v1/purchase/receipts/{id}` | Sửa draft |
| `POST` | `/v1/purchase/receipts/{id}/post` | Hoàn thành nhập hàng |
| `POST` | `/v1/purchase/receipts/{id}/cancel` | Hủy phiếu |
| `POST` | `/v1/suppliers/{id}/payments` | Trả tiền NCC |

Không cần implement tất cả endpoint trong một slice. P1 nền có; **P2/P3/P5 live create/post/pay vẫn HTTP stub** dù SoT/UI từng ghi “đã merge” — [Purchase README](../../03-BUSINESS-NghiepVu/Purchase/README.md). P4 cuộn/tấm là candidate riêng theo [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md#9-lát-cắt-purchase).

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

### Import KiotViet suppliers

Endpoint nội bộ hiện dùng prefix `/api/v1`:

- `POST /api/v1/suppliers/import/kiotviet/preview`
- `POST /api/v1/suppliers/import/kiotviet`
- `DELETE /api/v1/suppliers/import/kiotviet`

Payload preview/import nhận `file_base64` hoặc `rows`. Import dùng mã NCC làm khóa upsert.

Các cột dùng:

- `Mã nhà cung cấp`, `Tên nhà cung cấp`
- `Email`, `Điện thoại`
- `Địa chỉ`, `Phường/Xã`, `Khu vực`
- `Tổng mua`, `Nợ cần trả hiện tại`, `Tổng mua trừ trả hàng`
- `Mã số thuế`, `Ghi chú`, `Trạng thái`, `Công ty`
- `Người tạo`, `Ngày tạo`

Cột bỏ qua: `Số CMND/CCCD`, `Nhóm nhà cung cấp`.

Dev-memory repository phải persist import NCC vào state file; không chỉ lưu vào dữ liệu demo runtime.

---

## 4. Purchase receipt API contract

### Import KiotViet purchase receipts

Endpoint nội bộ hiện dùng prefix `/api/v1`:

- `POST /api/v1/purchase/receipts/import/kiotviet/preview`
- `POST /api/v1/purchase/receipts/import/kiotviet`
- `DELETE /api/v1/purchase/receipts/import/kiotviet`

Payload preview/import nhận `file_base64` hoặc `rows`. File đúng là `DanhSachChiTietNhapHang_KV...xlsx`.

Cột dùng:

- `Mã nhập hàng`, `Thời gian`, `Thời gian tạo`, `Ngày cập nhật`, `Trạng thái`.
- `Mã nhà cung cấp`, `Tên nhà cung cấp`, `Điện thoại`, `Địa chỉ`.
- `Người nhập`, `Người tạo`, `Số hóa đơn đầu vào`, `Ghi chú`.
- `Tổng tiền hàng`, `Giảm giá phiếu nhập`, `Cần trả NCC`, `Tiền đã trả NCC`, `Tổng số lượng`, `Tổng số mặt hàng`.
- `Mã hàng`, `Tên hàng`, `ĐVT`, `Đơn giá`, `Giá nhập`, `Giảm giá %`, `Giảm giá`, `Thành tiền`, `Số lượng`.

Rules:

- Import gom dòng theo `Mã nhập hàng`; trùng mã thì cập nhật.
- `Mã nhà cung cấp` phải khớp NCC đã import/tạo trong QCVL.
- Nếu file KiotViet không có `Mã nhà cung cấp`, backend map dòng đó về `NCC lẻ` / `Nhà cung cấp lẻ`. Preview không xem đây là thiếu tham chiếu; import tự tạo/upsert NCC lẻ trước khi ghi phiếu.
- `Mã hàng` phải khớp Hàng hóa đã import/tạo trong QCVL, hoặc khớp `product_unit_conversions.source_code` nếu đó là mã đơn vị quy đổi KiotViet.
- Mã KiotViet có hậu tố `{DEL}`, `{DEL1}`, `{DEL2}` được đối chiếu bằng mã gốc nếu mã gốc đang tồn tại.
- Không import partial khi thiếu NCC/Hàng hóa; preview trả `missing_supplier_codes` và `missing_product_codes`, import trả skipped để tránh tạo tồn sai.
- `Đã nhập hàng` từ KV map thành receipt `posted`.
- `Xóa dữ liệu cũ` chỉ xóa phiếu nhập có nguồn import KiotViet, không xóa phiếu nhập tạo tay.

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
