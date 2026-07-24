# Công nợ khách hàng QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [customer-debt.ts](../../../server/modules/finance/customer-debt.ts), [PAYMENT-DEBT-TABLES.md](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md).

## Nguồn chuẩn

Tất cả read path công nợ phải dùng canonical `customer-debt.ts`. Không dùng `customer_snapshots.total_debt_amount` hoặc `customer_debt_adjustments.balance_after` làm tổng runtime.

Số âm được giữ nguyên: biểu thị credit khách hàng, không clamp về `0`.

## Thành phần tổng công nợ

Query PostgreSQL cộng các nguồn trong cùng `organization_id`:

1. Invoice active (`orders.order_type = 'invoice'`, không `cancelled`) theo `total_amount`.
2. Adjustment khách: `CB...` theo `amount_delta`; `CKKH...` làm giảm nợ theo `-abs(amount_delta)`.
3. Cashbook payment `posted`: `payment_receipt_method`, hoặc import KiotViet có mã payment allowed. Receipt `in` giảm nợ; `out` tăng nợ.
4. Purchase receipt `posted` của supplier có `linked_customer_id`: đưa vào customer view với dấu đối ứng.

Tổng cho một khách là tổng bốn nguồn trên. `customer_debt_entries` bổ trợ remaining/open invoice, count và thứ tự invoice cũ; không thay canonical total bằng một bảng đơn lẻ.

## Match payment import

Cashbook payment chỉ vào customer debt khi có ownership evidence:

- `source.customer_id`; hoặc
- `source.order_code` map tới invoice active; hoặc
- `counterparty_code` map customer code/import ID sau khi bỏ suffix `{DEL...}`.

Không chỉ nhìn prefix để gán payment vào khách. Không double-count payment đã biểu diễn qua ledger source.

## Adjustment và linked supplier

- `CB...` dùng normalized `amount_delta` trực tiếp.
- `CKKH...` giảm debt, không mặc định là tiền thu.
- Supplier linked là view đối ứng, không phải khoản customer debt độc lập để cộng hai lần.
- Không tự cấn trừ customer/supplier chỉ vì trùng tên, điện thoại hoặc tổng đối xứng.

## Allocation và thu nợ

`sliceCustomerOpenDebtsOldestFirst` tạo danh sách invoice open theo `created_at`, rồi code, để **đề xuất** allocation amount/limit. Utility này không là quyền suy đoán ownership hoặc mass mutation.

- Allocation actual phải từ receipt/source evidence hoặc explicit user input có validation.
- Không FIFO/mass-reallocate theo aggregate mismatch.
- Thu nợ/revision/import mutation cần transaction, source ownership và post-invariant audit.

## Quy tắc UI/API

- Customer list, customer detail, Finance và POS chỉ hiển thị total backend canonical; frontend không tự cộng/trừ.
- Timestamp lưu UTC; hiển thị/business date theo `Asia/Ho_Chi_Minh`, UI `DD-MM-YYYY`.
- Khi sai số: tách invoice, adjustment, payment, linked supplier; kiểm source ownership từng record trước khi sửa.

## Tham chiếu

- [Finance schema payment/debt](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md)
- [Canonical debt module](../../../server/modules/finance/customer-debt.ts)
- [Finance API](../../05-BACKEND-MayChu/Finance/FINANCE-API.md)
