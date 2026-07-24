# Schema thanh toán và công nợ QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [schema.sql](../../../database/schema.sql), [FINANCE-API.md](../../05-BACKEND-MayChu/Finance/FINANCE-API.md).

## Phạm vi

Các bảng dưới lưu receipt, phương thức nhận tiền, công nợ invoice và điều chỉnh import. `cashbook_entries`/tài khoản quỹ xem [CASHBOOK-TABLES.md](./CASHBOOK-TABLES.md). Không dùng tài liệu này để áp FIFO, revision code, receipt type hoặc field chưa có runtime schema.

## `payment_receipts`

Đầu chứng từ nhận tiền.

| Cột | Ý nghĩa |
|---|---|
| `id`, `organization_id`, `code` | Định danh; code unique trong organization. |
| `customer_id`, `order_id` | Khách/đơn liên quan, có thể null theo nguồn. |
| `total_received_amount` | Tổng tiền nguồn ghi nhận. |
| `note`, `created_at` | Ghi chú và instant UTC. |

## `payment_receipt_methods`

Dòng phương thức nhận tiền.

| Cột | Ý nghĩa |
|---|---|
| `payment_receipt_id`, `order_id` | Receipt/đơn liên quan. |
| `method` | `cash` hoặc `bank_transfer`. |
| `finance_account_id`, `amount` | Tài khoản nhận và số tiền. |
| `bank_transaction_ref` | Mã tham chiếu ngân hàng nếu có. |
| `allocations` | Mảng JSON phân bổ source-proven. |
| `created_at` | Instant UTC. |

## `customer_debt_entries`

Công nợ invoice theo `order_id`.

- `original_amount`, `paid_amount`, `remaining_debt`.
- `status`: `open` hoặc `closed`.
- Unique `(organization_id, order_id)`.
- Không dùng một dòng debt entry đơn lẻ làm total UI; tổng phải theo finance query/canonical contract hiện hành.

## `customer_debt_adjustments`

Điều chỉnh/import công nợ có `source_code`, `source_system`, source file/row, snapshot khách, delta, paid/remaining/balance và status.

- Unique `(organization_id, source_system, source_code)`.
- Source KiotViet phải giữ evidence; không tạo adjustment để ép tổng khớp.

## Quy tắc an toàn

- Scope tất cả query/mutation theo `organization_id`.
- Không FIFO, không mass-reallocate, không đổi paid/debt/payment/cashbook nếu chưa có ownership exact từ source.
- Receipt amount, allocation, invoice paid/debt và customer credit/advance là metric riêng; đối soát từng lớp.
- Mutation qua finance route/repository có preview/transaction/audit; không SQL update production trực tiếp.
- Timestamp UTC; business date `Asia/Ho_Chi_Minh`; UI `DD-MM-YYYY`.

## Tham chiếu

- [Finance API](../../05-BACKEND-MayChu/Finance/FINANCE-API.md)
- [Cashbook schema](./CASHBOOK-TABLES.md)
- [Nguồn dữ liệu QCVL](../../CURRENT-DATA-SOURCE.md)
- [Schema runtime](../../../database/schema.sql)
