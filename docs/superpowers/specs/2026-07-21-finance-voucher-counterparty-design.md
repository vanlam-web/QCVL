# Finance Voucher Counterparty Design

Date: 2026-07-21
Scope: `/finance` manual receipt/payment voucher form.

## Goal

QCVL should create manual cashbook vouchers from two main actions only:

- `Phiếu thu`
- `Phiếu chi`

Cash versus bank is not a separate voucher kind. It is decided by `Phương thức TT`.

## KiotViet Reference

KiotViet uses this mental model:

1. Choose receipt/payment direction.
2. Choose income/expense category.
3. Choose payer/payee object type.
4. Enter or select payer/payee name.

QCVL should keep that model but adapt it to QCVL data:

- Customers come from existing customer records.
- Suppliers come from existing supplier records.
- Employees come from user/employee records.
- Delivery partners can be selected from saved entries or typed freely.
- Other remains free text.

## Form Structure

Header:

- `Tạo phiếu thu` or `Tạo phiếu chi`
- Do not include `tiền mặt` or `ngân hàng` in the title.

Core fields:

- `Thời gian`
- `Loại thu` or `Loại chi`
- `Phương thức TT`: `Tiền mặt`, `Chuyển khoản`
- `Tài khoản`: shown only when `Phương thức TT = Chuyển khoản`
- `Đối tượng nộp` or `Đối tượng nhận`
- `Tên người nộp` or `Tên người nhận`
- `Số tiền`
- `Ghi chú`
- `Hạch toán kết quả kinh doanh`

`Người thu` or `Người chi` remains the logged-in account.

## Category To Counterparty Mapping

The selected `Loại thu/chi` controls which object types are available.

Suggested payment categories:

| Loại chi | Đối tượng nhận |
|---|---|
| `Vận chuyển` | `Đối tác giao hàng`, `Khác` |
| `Tiền trả NCC` | `Nhà cung cấp`, `Khác` |
| `Vật tư` | `Nhà cung cấp`, `Khác` |
| `Lương NV` | `Nhân viên` |
| `Hoàn tiền khách` | `Khách hàng`, `Khác` |
| `Chi phí vận hành` | `Nhân viên`, `Nhà cung cấp`, `Khác` |
| `Thuế/VAT` | `Khác` |
| `Hoa hồng` | `Nhân viên`, `Khác` |
| `Chuyển/Rút` | `Khác` |
| `Chi khác` | `Khách hàng`, `Nhà cung cấp`, `Nhân viên`, `Đối tác giao hàng`, `Khác` |

Suggested receipt categories:

| Loại thu | Đối tượng nộp |
|---|---|
| `Thu tiền khách` | `Khách hàng`, `Khác` |
| `Thu khác` | `Khách hàng`, `Nhà cung cấp`, `Nhân viên`, `Đối tác giao hàng`, `Khác` |
| `Chuyển/Rút` | `Khác` |
| `Góp vốn` | `Nhân viên`, `Khác` |

If current voucher categories differ, keep current category keys and map them by existing meaning.

## Delivery Partner Behavior

`Đối tác giao hàng` supports both saved suggestions and free text.

Behavior:

- The name field is still editable text.
- While typing, show saved delivery partners as suggestions.
- Selecting an existing delivery partner fills name and phone when available.
- Typing a new delivery partner is allowed.
- Saving a voucher with `Đối tượng nhận = Đối tác giao hàng` stores the name for future suggestions.

Data model:

- Prefer a new counterparty type: `delivery_partner`.
- Keep `other` only for true one-off free text.
- Delivery partner entries should be small master data: `id`, `name`, `phone`, `note`, `is_active`, timestamps.

Fallback:

- If schema work must be deferred, store voucher as `counterparty.type = other` plus source metadata that preserves `delivery_partner`.
- Do not lose the selected object type in UI.

## Data Flow

Create/edit voucher form state:

1. Direction chooses `in` or `out`.
2. Voucher category is selected.
3. Available counterparty types are derived from direction plus category.
4. If current counterparty type is no longer allowed after category change, reset it to the first allowed type.
5. Name suggestions load from the selected counterparty type.
6. Submit sends voucher direction, category, payment method/account, counterparty type/name/phone, amount, note, debt mode, and business-accounted flag.

Suggestion sources:

- `customer`: customers API
- `supplier`: suppliers API
- `employee`: users/employees API
- `delivery_partner`: delivery partner API
- `other`: no suggestions

## Validation

- `Số tiền` is required and greater than zero.
- Bank account is required when `Phương thức TT = Chuyển khoản`.
- Counterparty name is required for typed partner-related categories unless the category intentionally allows blank.
- `delivery_partner` accepts either selected saved entry or typed new text.
- Existing manual voucher edit must prefill old values exactly.

## Testing

Frontend tests:

- Opening `Phiếu chi` defaults to the first payment category and allowed counterparty type.
- Selecting `Vận chuyển` limits object types to `Đối tác giao hàng` and `Khác`.
- Selecting `Đối tác giao hàng` shows saved partner suggestions and still allows a new typed value.
- Selecting `Nhân viên` uses employee suggestions.
- Selecting `Khách hàng` and `Nhà cung cấp` keeps existing customer/supplier suggestions.
- Changing `Phương thức TT` toggles cash/bank account behavior without changing voucher direction.
- Editing an existing voucher preloads old category, payment method, account, counterparty, time, amount, and note.

Backend tests:

- Manual voucher accepts `delivery_partner`.
- New delivery partner typed in a voucher is available as future suggestion.
- Existing customer/supplier/employee behavior does not regress.

## Out Of Scope

- Full logistics partner management screen.
- Debt accounting changes for delivery partners.
- Importing delivery partners from KiotViet.

