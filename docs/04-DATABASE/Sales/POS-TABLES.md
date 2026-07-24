# Schema bán hàng và POS QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [schema.sql](../../../database/schema.sql), [migration 0003](../../../database/migrations/0003_catalog_inventory_import.sql), module [sales](../../../server/modules/sales/).

## Phạm vi

PostgreSQL QCVL lưu chứng từ bán, dòng hàng, receipt/phương thức thanh toán, công nợ và catalog snapshot/import. Không suy đoán schema legacy, workflow Phase 1, hoặc constraint chưa có migration/repository runtime.

## Chứng từ bán

### `orders`

Invoice/quote dùng chung một bảng.

| Cột/nhóm | Ý nghĩa |
|---|---|
| `id`, `organization_id`, `code` | Định danh; `code` duy nhất trong organization. |
| `order_type` | `invoice` hoặc `quote`. |
| `status`, `payment_status` | Trạng thái chứng từ/thanh toán; enum nghiệp vụ do sales handler kiểm tra. |
| `customer_id`, `customer_snapshot`, `seller_snapshot` | Liên kết/snapshot lịch sử. Không đổi snapshot cũ khi master data đổi. |
| `subtotal_amount`, `discount_amount`, `total_amount`, `paid_amount`, `debt_amount` | Số tiền chứng từ. |
| `source_quote_id` | Quote nguồn nếu invoice tạo từ quote. |
| `base_code`, `revision_no`, `revised_from_order_id`, `replaced_by_order_id` | Chuỗi sửa/phiên bản. |
| `cancel_reason_type`, `revision_reason_code`, `revision_reason_note` | Evidence hủy/sửa. |
| `created_at`, `updated_at` | UTC instant. |

### `order_items`

Dòng hàng thuộc `orders`: product ID, `product_snapshot`, quantity, đơn giá, chiết khấu, thành tiền, sort order. Snapshot giá/hàng là lịch sử chứng từ; catalog thay đổi không sửa dòng đã chốt.

## Thanh toán và công nợ

| Bảng | Vai trò |
|---|---|
| `payment_receipts` | Chứng từ nhận tiền, có khách/đơn liên quan, tổng nhận và note. |
| `payment_receipt_methods` | Phương thức `cash`/`bank_transfer`, account, amount, bank reference, allocation JSON. |
| `customer_debt_entries` | Công nợ theo invoice: gốc, đã trả, còn lại, open/closed. Unique `(organization_id, order_id)`. |
| `customer_debt_adjustments` | Điều chỉnh công nợ có source code/system/file/row và snapshot khách. |

Không tái phân bổ payment/allocation theo FIFO hoặc mismatch tổng. Mutation cần ownership/evidence nguồn exact.

## Catalog dùng trong POS

Catalog runtime từ migration `0003`:

- `product_groups`, `products`, `inventory_units`, `product_unit_conversions`.
- `price_lists`, `price_list_items`; unique price item `(price_list_id, product_id)`.
- `customer_snapshots` là snapshot/import storage QCVL; không giả định table customer legacy ngoài source migration/repository.
- Route catalog/pricing hiện hành xem [CUSTOMER-PRODUCT-PRICING-API.md](../../05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md).

## Usage và import

- `pos_product_usage` giữ usage count theo organization/product cho ranking.
- KiotViet invoice importer group theo source code, transactionally upsert document và movement; only completed invoice tạo sale deduction.
- Delete importer hiện có broad `HD%` path trong repository là rủi ro đã biết, không dùng làm repair workflow. Hardening scoped importer thuộc plan riêng.
- Import/rebuild không được xóa invoice, receipt, allocation, stock movement ngoài allow-list/source fingerprint cụ thể.

## Quy tắc thời gian và scope

- Mọi record/query scope `organization_id`.
- Timestamp lưu UTC; filter/report business date dùng `Asia/Ho_Chi_Minh`, UI `DD-MM-YYYY`.
- Không cập nhật trực tiếp snapshot/payment/debt JSON trong production; dùng route/repository current, transaction và audit.

## Tham chiếu

- [Order API](../../05-BACKEND-MayChu/POS/ORDER-API.md)
- [Catalog và pricing API](../../05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md)
- [Finance schema](../Finance/CASHBOOK-TABLES.md)
- [Schema runtime](../../../database/schema.sql)
