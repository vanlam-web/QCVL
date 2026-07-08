# FINANCE-API — API công nợ, sổ quỹ và đối soát

> **Base path:** `/api/v1`
> **Business:** [CASHBOOK.md](../../03-BUSINESS-NghiepVu/Finance/CASHBOOK.md), [POS-CUSTOMER-DEBT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md)
> **Database:** [PAYMENT-DEBT-TABLES.md](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md), [CASHBOOK-TABLES.md](../../04-DATABASE/Finance/CASHBOOK-TABLES.md)

---

## 1. Phạm vi

Tài liệu này là Source of Truth cho Backend API Finance MVP:

- quản lý quỹ tiền mặt và tài khoản ngân hàng
- xem công nợ khách hàng theo từng hóa đơn
- thu nợ khách ngoài checkout POS
- xem phiếu thu từ POS/thu nợ
- xem sổ quỹ theo tiền mặt/từng tài khoản ngân hàng
- tạo/sửa/hủy phiếu thu/chi thủ công
- tạo/lưu/chốt/hủy đối soát cuối ngày

Không bao gồm:

- checkout POS; xem [ORDER-API.md](../POS/ORDER-API.md)
- kế toán tổng hợp nâng cao
- khách trả trước/số dư âm
- tự động đối soát qua API ngân hàng

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
| Xem sổ quỹ/báo cáo ca | `perm.view_shift_report` hoặc `perm.manage_finance` |
| Xem công nợ khách | `perm.create_order` hoặc `perm.manage_finance` |
| Thu nợ khách ngoài checkout | `perm.manage_finance` |
| Quản lý quỹ/tài khoản | `perm.manage_finance` |
| Tạo/sửa/hủy phiếu thu/chi thủ công | `perm.manage_finance` |
| Tạo/lưu/chốt/hủy đối soát | `perm.manage_finance` |

Backend phải scope mọi dữ liệu theo organization của actor.

Ghi chú MVP:

- Các permission trong bảng trên là guard kỹ thuật ở API, không phải đề xuất chia nhỏ vận hành hằng ngày.
- Preset `Nhân viên nội bộ` nên có đủ quyền xem sổ quỹ, công nợ cơ bản, phiếu thu từ POS/thu nợ và các thao tác finance thường ngày đã nằm trong MVP.
- Chỉ nên tách mạnh `perm.manage_finance` cho tài khoản hạn chế đặc biệt hoặc khi Owner chốt finance nhạy cảm cần kiểm soát riêng.
- Không có approval nhiều bước cho phiếu thu/chi MVP; người có quyền tài chính tạo phiếu thì ghi sổ theo rule trong `CASHBOOK.md`.

---

## 3. Finance accounts

### `GET /finance/accounts`

Danh sách quỹ tiền mặt và tài khoản ngân hàng.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

**Query:** `account_type`, `is_active`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "CASH",
      "name": "Quỹ tiền mặt",
      "account_type": "cash",
      "is_default_cash": true,
      "is_active": true
    }
  ]
}
```

### `POST /finance/accounts`

Tạo quỹ/tài khoản.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "code": "MB01",
  "name": "MB Bank",
  "account_type": "bank",
  "bank_name": "MB Bank",
  "bank_account_no": "123456789",
  "is_default_cash": false
}
```

**Validation:**

- `code` không trùng trong organization.
- `account_type IN ('cash', 'bank')`.
- Nếu `cash`, không nhận `bank_name`/`bank_account_no`.
- Nếu `bank`, `bank_name` bắt buộc.
- Mỗi organization có tối đa một quỹ tiền mặt mặc định active.

### `PATCH /finance/accounts/{id}`

Cập nhật tên/trạng thái quỹ hoặc tài khoản.

**Permission:** `perm.manage_finance`

Không cho đổi `account_type` nếu tài khoản đã có `cashbook_entries`.

---

## 4. Customer debt

### `GET /finance/customer-debts`

Danh sách khách hàng đang có nợ.

**Permission:** `perm.create_order` hoặc `perm.manage_finance`

**Query:** `search`, `include_retail_debt`, `page`, `page_size`.

Response tổng hợp từ `customer_debt_entries`, không dùng một số tổng không truy vết được.

### `GET /finance/customers/{customer_id}/debt`

Chi tiết công nợ một khách.

**Permission:** `perm.create_order` hoặc `perm.manage_finance`

Response phải gồm:

- tổng nợ hiện tại
- danh sách hóa đơn còn nợ, sắp xếp cũ nhất trước
- lịch sử `customer_debt_entries`
- các lần phân bổ `customer_debt_allocations`

### `GET /finance/retail-debts`

Danh sách hóa đơn còn nợ của khách mặc định `KH000001 - Khách lẻ`.

**Permission:** `perm.manage_finance`

Mỗi dòng phát sinh từ POS chưa chọn khách phải có `retail_debt_note` để nhận diện lại người nợ. API này không dùng bucket `customer_id = null`.

---

## 5. Debt collection

### `POST /finance/debt-collections`

Thu nợ khách ngoài checkout POS.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "customer_id": "uuid",
  "amount": 500000,
  "payment_method": {
    "cash_amount": 200000,
    "bank_amount": 300000,
    "bank_account_id": "uuid",
    "bank_transaction_ref": "MB-123"
  },
  "note": "Khách trả nợ"
}
```

**Validation:**

- `customer_id` bắt buộc và cùng organization.
- `amount > 0`.
- `cash_amount >= 0`, `bank_amount >= 0`.
- `amount = cash_amount + bank_amount`.
- Nếu `bank_amount > 0`, `bank_account_id` bắt buộc, active, cùng organization và là tài khoản `bank`.
- Một lần thu nợ chỉ có tối đa một tài khoản bank trong MVP.
- Không cho thu vượt tổng nợ hiện tại để tạo trả trước.

**Workflow bắt buộc trong một transaction nghiệp vụ:**

1. Xác thực actor, workstation và permission.
2. Lấy danh sách hóa đơn còn nợ của khách, cũ nhất trước.
3. Tạo `payment_receipts` loại `debt_collection`.
4. Tạo `payment_receipt_methods` theo tiền mặt/chuyển khoản.
5. Tạo `cashbook_entries` từ từng phương thức thu.
6. Phân bổ tiền vào hóa đơn còn nợ cũ nhất trước bằng `customer_debt_allocations`.
7. Tạo `customer_debt_entries` loại `debt_payment`.
8. Trả phiếu thu và danh sách phân bổ.

Nếu bất kỳ bước ghi dữ liệu chính nào lỗi, transaction phải rollback.

---

## 6. Payment receipts

### `GET /finance/payment-receipts`

Tra cứu phiếu thu từ POS hoặc thu nợ.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

**Query:** `search`, `receipt_type`, `customer_id`, `order_id`, `status`, `from`, `to`, `page`, `page_size`.

### `GET /finance/payment-receipts/{id}`

Chi tiết phiếu thu, phương thức thu và phân bổ công nợ nếu có.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

Response phải gồm tối thiểu:

- thông tin phiếu thu: mã phiếu, trạng thái, người tạo, người thu, thời gian
- phương thức thu: tiền mặt/tài khoản ngân hàng, số tiền
- khách nộp nếu có
- chứng từ gốc nếu sinh từ hóa đơn/thu nợ
- danh sách phân bổ vào hóa đơn: mã hóa đơn, giá trị hóa đơn, đã thu trước, giá trị thu, còn nợ sau thu

Phiếu sinh từ hóa đơn/thu nợ không được sửa rời qua API này. Muốn sửa phải đi qua nghiệp vụ gốc tương ứng để Sales, Debt và Cashbook cùng khớp.

Quy ước phân bổ:

- Phiếu thu `sale_payment` từ POS cũng phải trả một dòng allocation cho hóa đơn vừa bán, kể cả khi hóa đơn trả đủ hoặc trả một phần và chưa phát sinh `customer_debt_allocations`.
- Phiếu thu `debt_collection` trả allocations từ `customer_debt_allocations`.
- Phiếu thu `mixed_sale_and_debt` trả allocation của hóa đơn mới trước, sau đó đến các allocation thu nợ cũ.
- Với dòng sổ quỹ legacy thiếu `payment_receipts.order_id` nhưng có ghi chú dạng `Checkout HD...`, backend phải suy ra hóa đơn từ mã trong ghi chú và trả allocation gồm `orders.total_amount`, số tiền thu của dòng sổ quỹ, `orders.paid_amount`, `orders.debt_amount`.
- Trạng thái thanh toán gắn hóa đơn do frontend map từ số liệu allocation và hiển thị ở chip đầu detail: còn nợ `0` là `Hoàn tất` màu success; còn nợ lớn hơn `0` là `Thanh toán 1 phần` màu warning. `Chưa thanh toán` màu neutral chỉ thuộc màn hóa đơn vì chưa thanh toán nghĩa là chưa có phiếu thu.

---

## 7. Cashbook

> Hiện trạng frontend sau PR #83: `/finance` đang gọi `GET /finance/cashbook` với `finance_account_id`, `direction`, `status`, `is_business_accounted`, `from`, `to`, `page`, `page_size`. Các tham số `search`, `search_scope`, `voucher_type`, `counterparty_*`, `partner_debt_filter` vẫn thuộc slice UI/filter tiếp theo dù backend contract đã định hướng trước.

### `GET /finance/cashbook`

Xem sổ quỹ theo từng quỹ/tài khoản.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

**Query:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `finance_account_id` | `uuid` | Không | Lọc theo quỹ/tài khoản |
| `finance_account_type` | `string` | Không | Lọc theo loại sổ quỹ: `cash` hoặc `bank`; dùng khi UI chọn `Ngân hàng` để lấy tất cả tài khoản ngân hàng |
| `search` | `string` | Không | Tìm theo mã phiếu, người nộp/nhận hoặc ghi chú |
| `direction` | `string` | Không | `in` hoặc `out` |
| `source_type` | `string` | Không | `payment_receipt_method` hoặc `cashbook_voucher` |
| `status` | `string` | Không | `posted` hoặc `cancelled` |
| `voucher_type` | `string` | Không | Nhóm loại thu/chi nội bộ |
| `is_business_accounted` | `boolean` | Không | Có/không hạch toán kết quả kinh doanh |
| `counterparty_type` | `string` | Không | `customer`, `supplier`, `employee`, `other`, `none` |
| `counterparty_search` | `string` | Không | Tìm tên/mã/số điện thoại người nộp/nhận |
| `partner_debt_filter` | `string` | Không | `affects_partner_debt`, `not_affect_partner_debt`, `no_partner_debt` |
| `from` / `to` | `datetime` | Không | Khoảng thời gian |
| `page` / `page_size` | `number` | Không | Phân trang |

Chỉ tính số dư hiệu lực từ `cashbook_entries.status = posted`.

Khi `search` khớp chính xác mã phiếu, backend phải tìm trên toàn bộ lịch sử hoặc bỏ qua `from/to` nếu client đang dùng filter thời gian mặc định. Không trả rỗng chỉ vì mã phiếu nằm ngoài tháng hiện tại.

`counterparty` trên list và detail phải dùng cùng nguồn dữ liệu. Dòng sinh từ `payment_receipt_method` lấy khách từ `payment_receipts.customer_id`; nếu phiếu thu không có `customer_id` nhưng có `order_id`, dùng `orders.customer_snapshot` để hiển thị `Khách lẻ` hoặc tên khách đã lưu lúc bán hàng. Với dữ liệu cũ thiếu cả `customer_id` và `order_id` nhưng dòng sổ quỹ có ghi chú dạng `Checkout HD...`, backend được phép suy ra hóa đơn từ mã trong ghi chú để lấy `customer_snapshot` cho list và detail. Frontend có thể hydrate nền từ detail cho dòng cũ còn thiếu `counterparty`, nhưng đó chỉ là lớp bù tương thích; contract đúng vẫn là list trả sẵn người nộp/nhận.

Detail dòng sổ quỹ sinh từ `payment_receipt_method` phải trả `allocations` đủ để UI không cần đoán `Tổng sau giảm`/giá trị chứng từ. Với phiếu thu bán hàng, `order_total_amount` lấy từ hóa đơn gốc và hiển thị ở cột `Tổng sau giảm`, `allocated_amount` là số tiền thu, `remaining_after` là số nợ còn lại của hóa đơn và hiển thị ở cột `Chưa TT`. `collected_before` vẫn trả để biết hóa đơn đã từng thu ở các phiếu trước khi thanh toán nhiều lần, nhưng không dùng làm cột chính. Với dữ liệu cũ có `receipt_type = sale_payment` và `order_id` nhưng thiếu `sale_payment_amount`, backend dùng `total_received_amount` để dựng allocation cho hóa đơn thay vì để frontend fallback từ ghi chú. Không dùng `cashbook_entries.amount_delta` làm tổng hóa đơn; field đó chỉ là giá trị của dòng tiền vào/ra.

Response list phải có summary theo filter:

```json
{
  "summary": {
    "opening_balance": 0,
    "total_in": 2730447402,
    "total_out": -2704685832,
    "ending_balance": 25761570
  },
  "items": []
}
```

Ghi chú search:

- `search` có thể tìm mã phiếu, ghi chú hoặc nội dung chuyển khoản.
- Nếu client cần tách rõ như KiotViet, dùng thêm `search_scope = code | note | transfer_content`.
- Khi `search_scope = code` và mã phiếu khớp mẫu mã chứng từ, backend phải bỏ qua `from/to` nếu filter thời gian làm che kết quả.

### `GET /finance/cashbook/{entry_id}`

Chi tiết một dòng sổ quỹ.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

Response gồm:

- mã phiếu, trạng thái, hướng thu/chi, số tiền
- quỹ/tài khoản
- có/không hạch toán kết quả kinh doanh
- người tạo và người thu/chi
- đối tượng nộp/nhận
- phương thức thanh toán
- ghi chú
- chứng từ gốc và phân bổ hóa đơn nếu dòng sinh từ hóa đơn/thu nợ
- thông tin phiếu thủ công nếu dòng sinh từ phiếu thu/chi thủ công

### `GET /finance/cashbook/balances`

Lấy số dư hiện tại theo từng quỹ/tài khoản.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

Response phải tách tiền mặt và từng tài khoản ngân hàng, không gộp chuyển khoản thành một tổng chung.

---

## 8. Manual cashbook vouchers

### `POST /finance/cashbook-vouchers`

Tạo phiếu thu/chi thủ công.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "voucher_direction": "out",
  "voucher_type": "operating_expense",
  "finance_account_id": "uuid",
  "amount": 150000,
  "is_business_accounted": true,
  "counterparty_type": "other",
  "counterparty_name": "Tý",
  "counterparty_phone": "0964917315",
  "partner_debt_mode": "no_partner_debt",
  "related_order_id": null,
  "related_customer_id": null,
  "reason": "Chi phí vật tư phụ"
}
```

**Validation:**

- `voucher_direction IN ('in', 'out')`.
- `voucher_type` phải hợp lệ theo hướng thu/chi.
- `amount > 0`.
- `finance_account_id` active và cùng organization.
- `is_business_accounted` mặc định theo `voucher_type` nhưng cho phép client gửi rõ.
- `counterparty_type IN ('customer', 'supplier', 'employee', 'other', 'none')`.
- `partner_debt_mode IN ('affects_partner_debt', 'not_affect_partner_debt', 'no_partner_debt')`.
- Thu bán hàng và thu nợ khách không được tạo qua endpoint này; phải dùng POS checkout hoặc `/finance/debt-collections`.

**Workflow:**

1. Sinh mã `PT...` nếu thu, `PC...` nếu chi.
2. Tạo `cashbook_vouchers` trạng thái `posted`.
3. Tạo một dòng `cashbook_entries`.
4. Trả phiếu và dòng sổ quỹ.

### `POST /finance/cashbook-vouchers/{id}/revise`

Sửa phiếu thu/chi thủ công bằng bản mới `MaCu.01`.

**Permission:** `perm.manage_finance`

**Validation:**

- Chỉ sửa phiếu thủ công.
- Phiếu cũ phải là bản hiệu lực gần nhất.
- `reason` sửa bắt buộc.

**Workflow:**

1. Chuyển phiếu cũ sang `cancelled`.
2. Chuyển dòng `cashbook_entries` cũ sang `cancelled`.
3. Tạo phiếu mới với cùng `base_code`, `revision_no + 1`.
4. Tạo dòng `cashbook_entries` mới.
5. Trả phiếu cũ và phiếu mới.

### `POST /finance/cashbook-vouchers/{id}/cancel`

Hủy phiếu thu/chi thủ công.

**Permission:** `perm.manage_finance`

Chỉ cho hủy phiếu thủ công đang `posted`. Khi hủy, dòng `cashbook_entries` tương ứng chuyển `cancelled`, không xóa vật lý.

### `POST /finance/cashbook-transfers`

Tạo cặp phiếu chuyển/rút giữa hai quỹ/tài khoản.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "from_finance_account_id": "uuid",
  "to_finance_account_id": "uuid",
  "amount": 1000000,
  "transfer_time": "2026-07-05T19:00:00+07:00",
  "reason": "Rút tiền ngân hàng về quỹ tiền mặt"
}
```

**Workflow:**

1. Tạo phiếu chi `transfer` ở quỹ nguồn.
2. Tạo phiếu thu `transfer` ở quỹ đích.
3. Tạo hai dòng `cashbook_entries`.
4. Gắn cùng mã/nhóm liên kết điều chuyển để xem lại đủ cặp.
5. Tổng quỹ toàn hệ thống không đổi.

Endpoint này là slice hoàn chỉnh sau manual voucher MVP. Khi chưa có endpoint này, nếu vận hành cần chuyển/rút thì phải nhập cặp phiếu thủ công và đối soát kỹ.

---

## 9. Reconciliation

### `POST /finance/reconciliations`

Tạo phiên đối soát.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "period_start": "2026-06-30T00:00:00+07:00",
  "period_end": "2026-06-30T23:59:59+07:00",
  "note": "Đối soát cuối ngày"
}
```

**Workflow:**

1. Sinh mã `DS...`.
2. Tạo `cash_reconciliations` trạng thái `draft`.
3. Tạo `cash_reconciliation_items` cho từng `finance_accounts.is_active = true`.
4. Tính `system_balance` từ `cashbook_entries.status = posted`.

### `PUT /finance/reconciliations/{id}`

Cập nhật số thực tế trên phiên đối soát `draft`.

**Permission:** `perm.manage_finance`

Input gồm danh sách `finance_account_id`, `actual_balance`, `note`. Backend tính lại `difference_amount`.

### `POST /finance/reconciliations/{id}/balance`

Chốt đối soát.

**Permission:** `perm.manage_finance`

Workflow:

1. Kiểm tra phiên còn `draft`.
2. Tính lại `difference_amount`.
3. Đổi trạng thái sang `balanced`, set `balanced_at`.
4. Không tự tạo phiếu điều chỉnh tiền trong MVP. Nếu lệch, nhân viên xử lý bằng phiếu thu/chi thủ công có lý do.

### `POST /finance/reconciliations/{id}/cancel`

Hủy phiên đối soát.

**Permission:** `perm.manage_finance`

Chỉ cho hủy phiên `draft`. Phiên đã `balanced` không hủy bằng endpoint này; nếu cần đảo sau này phải có spec riêng.

### `GET /finance/reconciliations`

Danh sách phiên đối soát.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

Query: `search`, `status`, `from`, `to`, `page`, `page_size`.

### `GET /finance/reconciliations/{id}`

Chi tiết phiên đối soát và các dòng.

**Permission:** `perm.view_shift_report` hoặc `perm.manage_finance`

---

## 10. Error Handling

| HTTP | Code | Khi dùng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai, số tiền không khớp, thiếu tài khoản |
| 401 | `AUTH_REQUIRED` | Thiếu hoặc sai access token |
| 403 | `PERMISSION_DENIED` | Thiếu permission |
| 403 | `WORKSTATION_INVALID` | Workstation không hợp lệ |
| 404 | `RESOURCE_NOT_FOUND` | Không tìm thấy tài khoản/khách/phiếu trong organization |
| 409 | `RESOURCE_CONFLICT` | Phiếu không còn hiệu lực, phiên đối soát không còn draft, mã trùng |
| 422 | `FINANCE_OPERATION_FAILED` | Không thể hoàn tất nghiệp vụ tài chính có thể giải thích |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống không công khai chi tiết |

---

## 11. Logging và metric

Backend nên log:

- tạo/sửa/hủy phiếu thu chi thủ công
- thu nợ khách
- tạo/chốt/hủy đối soát
- thay đổi quỹ/tài khoản

Metric gợi ý:

- tổng thu/chi theo ngày
- số phiếu thu/chi thủ công
- số lần thu nợ khách
- số phiên đối soát chốt có chênh lệch
- latency API sổ quỹ

---

← [Quay về Finance README](./README.md)
