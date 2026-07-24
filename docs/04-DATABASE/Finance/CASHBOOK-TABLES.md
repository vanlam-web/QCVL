# Schema sổ quỹ QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [schema.sql](../../../database/schema.sql), [FINANCE-API.md](../../05-BACKEND-MayChu/Finance/FINANCE-API.md).

## Nguồn dữ liệu

PostgreSQL QCVL là nguồn runtime. Không dùng các bảng/document legacy như `cashbook_vouchers`, `employees`, `delivery_partners` làm contract hiện hành nếu chúng không có trong `database/schema.sql`.

## `finance_accounts`

Tài khoản quỹ/nhà băng theo organization.

| Cột | Ý nghĩa |
|---|---|
| `id`, `organization_id` | Khóa ghép và phạm vi tenant. |
| `code`, `name` | Mã/tên tài khoản. |
| `account_type` | `cash` hoặc `bank`. |
| `is_default_cash`, `is_active` | Cờ quỹ tiền mặt mặc định và trạng thái sử dụng. |
| `account_number`, `account_holder` | Thông tin ngân hàng, có thể null. |
| `opening_balance` | Số dư đầu kỳ. |
| `note`, `notify_on_transaction` | Ghi chú/cấu hình thông báo. |
| `created_at`, `updated_at` | Audit thời gian UTC. |

Khóa chính: `(organization_id, id)`. Không dùng account của organization khác.

## `cashbook_entries`

Sổ quỹ runtime. Một dòng là biến động tiền của một tài khoản trong phạm vi organization.

| Cột | Ý nghĩa |
|---|---|
| `id`, `organization_id`, `code` | Định danh; `code` duy nhất trong organization. |
| `status` | Trạng thái dòng sổ. Không suy đoán enum ngoài route/repository hiện hành. |
| `direction`, `amount_delta` | Hướng `in`/`out` và số tiền biến động. |
| `finance_account` | Snapshot JSON tài khoản quỹ/ngân hàng. |
| `counterparty` | Snapshot JSON đối tượng giao dịch. |
| `source_type`, `source` | Loại và evidence nguồn sinh dòng; không ghi đè source lịch sử. |
| `allocations` | Mảng JSON phân bổ liên quan khi có. |
| `note`, `is_business_accounted` | Ghi chú và cờ hạch toán nghiệp vụ. |
| `created_at` | Instant UTC; filter/report dùng business timezone `Asia/Ho_Chi_Minh`. |

## `payment_receipts` và `payment_receipt_methods`

Thanh toán POS/thu nợ là chứng từ nhận tiền riêng, không tự nhân bản thành cashbook entry tùy tiện.

- `payment_receipts`: chứng từ nhận tiền, khách/đơn liên quan, tổng nhận và `created_at`.
- `payment_receipt_methods`: từng phương thức `cash` hoặc `bank_transfer`, account, amount, bank reference và `allocations`.
- Allocation phải có ownership/evidence nguồn; không FIFO hoặc mass-reallocate theo chênh lệch tổng.

## Quy tắc an toàn

- Scope tất cả truy vấn theo `organization_id`.
- Không sửa/xóa payment, allocation hay cashbook source khi chưa chứng minh ownership từ KiotViet/QCVL.
- Số dư/report dùng implementation finance hiện hành; không tự tính từ document legacy.
- Sửa chứng từ qua route/repository current có validation/audit, không cập nhật JSON trực tiếp trong production.
- Thời điểm lưu UTC; ngày lọc/hiển thị theo `Asia/Ho_Chi_Minh`, UI `DD-MM-YYYY`.

## Tham chiếu

- [Finance API](../../05-BACKEND-MayChu/Finance/FINANCE-API.md)
- [Schema database](../../../database/schema.sql)
- [Nguồn dữ liệu QCVL](../../CURRENT-DATA-SOURCE.md)
