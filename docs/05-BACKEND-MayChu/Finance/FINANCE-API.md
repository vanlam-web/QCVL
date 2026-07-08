# FINANCE-API â€” API cÃ´ng ná»£, sá»• quá»¹ vÃ  Ä‘á»‘i soÃ¡t

> **Base path:** `/api/v1`
> **Business:** [CASHBOOK.md](../../03-BUSINESS-NghiepVu/Finance/CASHBOOK.md), [POS-CUSTOMER-DEBT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md)
> **Database:** [PAYMENT-DEBT-TABLES.md](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md), [CASHBOOK-TABLES.md](../../04-DATABASE/Finance/CASHBOOK-TABLES.md)

---

## 1. Pháº¡m vi

TÃ i liá»‡u nÃ y lÃ  Source of Truth cho Backend API Finance MVP:

- quáº£n lÃ½ quá»¹ tiá»n máº·t vÃ  tÃ i khoáº£n ngÃ¢n hÃ ng
- xem cÃ´ng ná»£ khÃ¡ch hÃ ng theo tá»«ng hÃ³a Ä‘Æ¡n
- thu ná»£ khÃ¡ch ngoÃ i checkout POS
- xem phiáº¿u thu tá»« POS/thu ná»£
- xem sá»• quá»¹ theo tiá»n máº·t/tá»«ng tÃ i khoáº£n ngÃ¢n hÃ ng
- táº¡o/sá»­a/há»§y phiáº¿u thu/chi thá»§ cÃ´ng
- táº¡o/lÆ°u/chá»‘t/há»§y Ä‘á»‘i soÃ¡t cuá»‘i ngÃ y

KhÃ´ng bao gá»“m:

- checkout POS; xem [ORDER-API.md](../POS/ORDER-API.md)
- káº¿ toÃ¡n tá»•ng há»£p nÃ¢ng cao
- khÃ¡ch tráº£ trÆ°á»›c/sá»‘ dÆ° Ã¢m
- tá»± Ä‘á»™ng Ä‘á»‘i soÃ¡t qua API ngÃ¢n hÃ ng

---

## 2. Auth, response vÃ  permission

Má»i endpoint yÃªu cáº§u:

```http
Authorization: Bearer <qcvl_access_token>
X-Workstation-Id: <uuid>
X-Request-Id: <client-generated-id>   # khÃ´ng báº¯t buá»™c
```

Ãp dá»¥ng response chuáº©n táº¡i [FOUNDATION-API.md](../FOUNDATION-API.md#2-response-chuáº©n).

| NhÃ³m API | Permission |
|---|---|
| Xem sá»• quá»¹/bÃ¡o cÃ¡o ca | `perm.view_shift_report` hoáº·c `perm.manage_finance` |
| Xem cÃ´ng ná»£ khÃ¡ch | `perm.create_order` hoáº·c `perm.manage_finance` |
| Thu ná»£ khÃ¡ch ngoÃ i checkout | `perm.manage_finance` |
| Quáº£n lÃ½ quá»¹/tÃ i khoáº£n | `perm.manage_finance` |
| Táº¡o/sá»­a/há»§y phiáº¿u thu/chi thá»§ cÃ´ng | `perm.manage_finance` |
| Táº¡o/lÆ°u/chá»‘t/há»§y Ä‘á»‘i soÃ¡t | `perm.manage_finance` |

Backend pháº£i scope má»i dá»¯ liá»‡u theo organization cá»§a actor.

Ghi chÃº MVP:

- CÃ¡c permission trong báº£ng trÃªn lÃ  guard ká»¹ thuáº­t á»Ÿ API, khÃ´ng pháº£i Ä‘á» xuáº¥t chia nhá» váº­n hÃ nh háº±ng ngÃ y.
- Preset `NhÃ¢n viÃªn ná»™i bá»™` nÃªn cÃ³ Ä‘á»§ quyá»n xem sá»• quá»¹, cÃ´ng ná»£ cÆ¡ báº£n, phiáº¿u thu tá»« POS/thu ná»£ vÃ  cÃ¡c thao tÃ¡c finance thÆ°á»ng ngÃ y Ä‘Ã£ náº±m trong MVP.
- Chá»‰ nÃªn tÃ¡ch máº¡nh `perm.manage_finance` cho tÃ i khoáº£n háº¡n cháº¿ Ä‘áº·c biá»‡t hoáº·c khi Owner chá»‘t finance nháº¡y cáº£m cáº§n kiá»ƒm soÃ¡t riÃªng.
- KhÃ´ng cÃ³ approval nhiá»u bÆ°á»›c cho phiáº¿u thu/chi MVP; ngÆ°á»i cÃ³ quyá»n tÃ i chÃ­nh táº¡o phiáº¿u thÃ¬ ghi sá»• theo rule trong `CASHBOOK.md`.

---

## 3. Finance accounts

### `GET /finance/accounts`

Danh sÃ¡ch quá»¹ tiá»n máº·t vÃ  tÃ i khoáº£n ngÃ¢n hÃ ng.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

**Query:** `account_type`, `is_active`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "CASH",
      "name": "Quá»¹ tiá»n máº·t",
      "account_type": "cash",
      "is_default_cash": true,
      "is_active": true
    }
  ]
}
```

### `POST /finance/accounts`

Táº¡o quá»¹/tÃ i khoáº£n.

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

- `code` khÃ´ng trÃ¹ng trong organization.
- `account_type IN ('cash', 'bank')`.
- Náº¿u `cash`, khÃ´ng nháº­n `bank_name`/`bank_account_no`.
- Náº¿u `bank`, `bank_name` báº¯t buá»™c.
- Má»—i organization cÃ³ tá»‘i Ä‘a má»™t quá»¹ tiá»n máº·t máº·c Ä‘á»‹nh active.

### `PATCH /finance/accounts/{id}`

Cáº­p nháº­t tÃªn/tráº¡ng thÃ¡i quá»¹ hoáº·c tÃ i khoáº£n.

**Permission:** `perm.manage_finance`

KhÃ´ng cho Ä‘á»•i `account_type` náº¿u tÃ i khoáº£n Ä‘Ã£ cÃ³ `cashbook_entries`.

---

## 4. Customer debt

### `GET /finance/customer-debts`

Danh sÃ¡ch khÃ¡ch hÃ ng Ä‘ang cÃ³ ná»£.

**Permission:** `perm.create_order` hoáº·c `perm.manage_finance`

**Query:** `search`, `include_retail_debt`, `page`, `page_size`.

`search` phải tìm bỏ dấu theo mã khách, tên khách và mã hóa đơn nợ cũ nhất để phục vụ dropdown gợi ý ở header tài chính.

Response tá»•ng há»£p tá»« `customer_debt_entries`, khÃ´ng dÃ¹ng má»™t sá»‘ tá»•ng khÃ´ng truy váº¿t Ä‘Æ°á»£c.

### `GET /finance/customers/{customer_id}/debt`

Chi tiáº¿t cÃ´ng ná»£ má»™t khÃ¡ch.

**Permission:** `perm.create_order` hoáº·c `perm.manage_finance`

Response pháº£i gá»“m:

- tá»•ng ná»£ hiá»‡n táº¡i
- danh sÃ¡ch hÃ³a Ä‘Æ¡n cÃ²n ná»£, sáº¯p xáº¿p cÅ© nháº¥t trÆ°á»›c
- lá»‹ch sá»­ `customer_debt_entries`
- cÃ¡c láº§n phÃ¢n bá»• `customer_debt_allocations`

### `GET /finance/retail-debts`

Danh sÃ¡ch hÃ³a Ä‘Æ¡n cÃ²n ná»£ cá»§a khÃ¡ch máº·c Ä‘á»‹nh `KH000001 - KhÃ¡ch láº»`.

**Permission:** `perm.manage_finance`

Má»—i dÃ²ng phÃ¡t sinh tá»« POS chÆ°a chá»n khÃ¡ch pháº£i cÃ³ `retail_debt_note` Ä‘á»ƒ nháº­n diá»‡n láº¡i ngÆ°á»i ná»£. API nÃ y khÃ´ng dÃ¹ng bucket `customer_id = null`.

---

## 5. Debt collection

### `POST /finance/debt-collections`

Thu ná»£ khÃ¡ch ngoÃ i checkout POS.

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
  "note": "KhÃ¡ch tráº£ ná»£"
}
```

**Validation:**

- `customer_id` báº¯t buá»™c vÃ  cÃ¹ng organization.
- `amount > 0`.
- `cash_amount >= 0`, `bank_amount >= 0`.
- `amount = cash_amount + bank_amount`.
- Náº¿u `bank_amount > 0`, `bank_account_id` báº¯t buá»™c, active, cÃ¹ng organization vÃ  lÃ  tÃ i khoáº£n `bank`.
- Má»™t láº§n thu ná»£ chá»‰ cÃ³ tá»‘i Ä‘a má»™t tÃ i khoáº£n bank trong MVP.
- KhÃ´ng cho thu vÆ°á»£t tá»•ng ná»£ hiá»‡n táº¡i Ä‘á»ƒ táº¡o tráº£ trÆ°á»›c.

**Workflow báº¯t buá»™c trong má»™t transaction nghiá»‡p vá»¥:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Láº¥y danh sÃ¡ch hÃ³a Ä‘Æ¡n cÃ²n ná»£ cá»§a khÃ¡ch, cÅ© nháº¥t trÆ°á»›c.
3. Táº¡o `payment_receipts` loáº¡i `debt_collection`.
4. Táº¡o `payment_receipt_methods` theo tiá»n máº·t/chuyá»ƒn khoáº£n.
5. Táº¡o `cashbook_entries` tá»« tá»«ng phÆ°Æ¡ng thá»©c thu.
6. PhÃ¢n bá»• tiá»n vÃ o hÃ³a Ä‘Æ¡n cÃ²n ná»£ cÅ© nháº¥t trÆ°á»›c báº±ng `customer_debt_allocations`.
7. Táº¡o `customer_debt_entries` loáº¡i `debt_payment`.
8. Tráº£ phiáº¿u thu vÃ  danh sÃ¡ch phÃ¢n bá»•.

Náº¿u báº¥t ká»³ bÆ°á»›c ghi dá»¯ liá»‡u chÃ­nh nÃ o lá»—i, transaction pháº£i rollback.

---

## 6. Payment receipts

### `GET /finance/payment-receipts`

Tra cá»©u phiáº¿u thu tá»« POS hoáº·c thu ná»£.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

**Query:** `search`, `receipt_type`, `customer_id`, `order_id`, `status`, `from`, `to`, `page`, `page_size`.

### `GET /finance/payment-receipts/{id}`

Chi tiáº¿t phiáº¿u thu, phÆ°Æ¡ng thá»©c thu vÃ  phÃ¢n bá»• cÃ´ng ná»£ náº¿u cÃ³.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

Response pháº£i gá»“m tá»‘i thiá»ƒu:

- thÃ´ng tin phiáº¿u thu: mÃ£ phiáº¿u, tráº¡ng thÃ¡i, ngÆ°á»i táº¡o, ngÆ°á»i thu, thá»i gian
- phÆ°Æ¡ng thá»©c thu: tiá»n máº·t/tÃ i khoáº£n ngÃ¢n hÃ ng, sá»‘ tiá»n
- khÃ¡ch ná»™p náº¿u cÃ³
- chá»©ng tá»« gá»‘c náº¿u sinh tá»« hÃ³a Ä‘Æ¡n/thu ná»£
- danh sÃ¡ch phÃ¢n bá»• vÃ o hÃ³a Ä‘Æ¡n: mÃ£ hÃ³a Ä‘Æ¡n, giÃ¡ trá»‹ hÃ³a Ä‘Æ¡n, Ä‘Ã£ thu trÆ°á»›c, giÃ¡ trá»‹ thu, cÃ²n ná»£ sau thu

Phiáº¿u sinh tá»« hÃ³a Ä‘Æ¡n/thu ná»£ khÃ´ng Ä‘Æ°á»£c sá»­a rá»i qua API nÃ y. Muá»‘n sá»­a pháº£i Ä‘i qua nghiá»‡p vá»¥ gá»‘c tÆ°Æ¡ng á»©ng Ä‘á»ƒ Sales, Debt vÃ  Cashbook cÃ¹ng khá»›p.

Quy Æ°á»›c phÃ¢n bá»•:

- Phiáº¿u thu `sale_payment` tá»« POS cÅ©ng pháº£i tráº£ má»™t dÃ²ng allocation cho hÃ³a Ä‘Æ¡n vá»«a bÃ¡n, ká»ƒ cáº£ khi hÃ³a Ä‘Æ¡n tráº£ Ä‘á»§ hoáº·c tráº£ má»™t pháº§n vÃ  chÆ°a phÃ¡t sinh `customer_debt_allocations`.
- Phiáº¿u thu `debt_collection` tráº£ allocations tá»« `customer_debt_allocations`.
- Phiáº¿u thu `mixed_sale_and_debt` tráº£ allocation cá»§a hÃ³a Ä‘Æ¡n má»›i trÆ°á»›c, sau Ä‘Ã³ Ä‘áº¿n cÃ¡c allocation thu ná»£ cÅ©.
- Vá»›i dÃ²ng sá»• quá»¹ legacy thiáº¿u `payment_receipts.order_id` nhÆ°ng cÃ³ ghi chÃº dáº¡ng `Checkout HD...`, backend pháº£i suy ra hÃ³a Ä‘Æ¡n tá»« mÃ£ trong ghi chÃº vÃ  tráº£ allocation gá»“m `orders.total_amount`, sá»‘ tiá»n thu cá»§a dÃ²ng sá»• quá»¹, `orders.paid_amount`, `orders.debt_amount`.
- Tráº¡ng thÃ¡i thanh toÃ¡n gáº¯n hÃ³a Ä‘Æ¡n do frontend map tá»« sá»‘ liá»‡u allocation vÃ  hiá»ƒn thá»‹ á»Ÿ chip Ä‘áº§u detail: cÃ²n ná»£ `0` lÃ  `HoÃ n táº¥t` mÃ u success; cÃ²n ná»£ lá»›n hÆ¡n `0` lÃ  `Thanh toÃ¡n 1 pháº§n` mÃ u warning. `ChÆ°a thanh toÃ¡n` mÃ u neutral chá»‰ thuá»™c mÃ n hÃ³a Ä‘Æ¡n vÃ¬ chÆ°a thanh toÃ¡n nghÄ©a lÃ  chÆ°a cÃ³ phiáº¿u thu.

---

## 7. Cashbook

> Hiá»‡n tráº¡ng frontend sau PR #83: `/finance` Ä‘ang gá»i `GET /finance/cashbook` vá»›i `finance_account_id`, `direction`, `status`, `is_business_accounted`, `from`, `to`, `page`, `page_size`. CÃ¡c tham sá»‘ `search`, `search_scope`, `voucher_type`, `counterparty_*`, `partner_debt_filter` váº«n thuá»™c slice UI/filter tiáº¿p theo dÃ¹ backend contract Ä‘Ã£ Ä‘á»‹nh hÆ°á»›ng trÆ°á»›c.

### `GET /finance/cashbook`

Xem sá»• quá»¹ theo tá»«ng quá»¹/tÃ i khoáº£n.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `finance_account_id` | `uuid` | KhÃ´ng | Lá»c theo quá»¹/tÃ i khoáº£n |
| `finance_account_type` | `string` | KhÃ´ng | Lá»c theo loáº¡i sá»• quá»¹: `cash` hoáº·c `bank`; dÃ¹ng khi UI chá»n `NgÃ¢n hÃ ng` Ä‘á»ƒ láº¥y táº¥t cáº£ tÃ i khoáº£n ngÃ¢n hÃ ng |
| `search` | `string` | KhÃ´ng | TÃ¬m theo mÃ£ phiáº¿u, ngÆ°á»i ná»™p/nháº­n hoáº·c ghi chÃº |
| `direction` | `string` | KhÃ´ng | `in` hoáº·c `out` |
| `source_type` | `string` | KhÃ´ng | `payment_receipt_method` hoáº·c `cashbook_voucher` |
| `status` | `string` | KhÃ´ng | `posted` hoáº·c `cancelled` |
| `voucher_type` | `string` | KhÃ´ng | NhÃ³m loáº¡i thu/chi ná»™i bá»™ |
| `is_business_accounted` | `boolean` | KhÃ´ng | CÃ³/khÃ´ng háº¡ch toÃ¡n káº¿t quáº£ kinh doanh |
| `counterparty_type` | `string` | KhÃ´ng | `customer`, `supplier`, `employee`, `other`, `none` |
| `counterparty_search` | `string` | KhÃ´ng | TÃ¬m tÃªn/mÃ£/sá»‘ Ä‘iá»‡n thoáº¡i ngÆ°á»i ná»™p/nháº­n |
| `partner_debt_filter` | `string` | KhÃ´ng | `affects_partner_debt`, `not_affect_partner_debt`, `no_partner_debt` |
| `from` / `to` | `datetime` | KhÃ´ng | Khoáº£ng thá»i gian |
| `page` / `page_size` | `number` | KhÃ´ng | PhÃ¢n trang |

Chá»‰ tÃ­nh sá»‘ dÆ° hiá»‡u lá»±c tá»« `cashbook_entries.status = posted`.

Khi `search` khớp chính xác mã phiếu, backend phải tìm trên toàn bộ lịch sử hoặc bỏ qua `from/to` nếu client đang dùng filter thời gian mặc định. Không trả rỗng chỉ vì mã phiếu nằm ngoài tháng hiện tại.

`search` của sổ quỹ phải hỗ trợ bỏ dấu theo mã phiếu, người nộp/nhận, SĐT, ghi chú và mã/tên tài khoản quỹ.

`counterparty` trÃªn list vÃ  detail pháº£i dÃ¹ng cÃ¹ng nguá»“n dá»¯ liá»‡u. DÃ²ng sinh tá»« `payment_receipt_method` láº¥y khÃ¡ch tá»« `payment_receipts.customer_id`; náº¿u phiáº¿u thu khÃ´ng cÃ³ `customer_id` nhÆ°ng cÃ³ `order_id`, dÃ¹ng `orders.customer_snapshot` Ä‘á»ƒ hiá»ƒn thá»‹ `KhÃ¡ch láº»` hoáº·c tÃªn khÃ¡ch Ä‘Ã£ lÆ°u lÃºc bÃ¡n hÃ ng. Vá»›i dá»¯ liá»‡u cÅ© thiáº¿u cáº£ `customer_id` vÃ  `order_id` nhÆ°ng dÃ²ng sá»• quá»¹ cÃ³ ghi chÃº dáº¡ng `Checkout HD...`, backend Ä‘Æ°á»£c phÃ©p suy ra hÃ³a Ä‘Æ¡n tá»« mÃ£ trong ghi chÃº Ä‘á»ƒ láº¥y `customer_snapshot` cho list vÃ  detail. Frontend cÃ³ thá»ƒ hydrate ná»n tá»« detail cho dÃ²ng cÅ© cÃ²n thiáº¿u `counterparty`, nhÆ°ng Ä‘Ã³ chá»‰ lÃ  lá»›p bÃ¹ tÆ°Æ¡ng thÃ­ch; contract Ä‘Ãºng váº«n lÃ  list tráº£ sáºµn ngÆ°á»i ná»™p/nháº­n.

Detail dÃ²ng sá»• quá»¹ sinh tá»« `payment_receipt_method` pháº£i tráº£ `allocations` Ä‘á»§ Ä‘á»ƒ UI khÃ´ng cáº§n Ä‘oÃ¡n `Tá»•ng sau giáº£m`/giÃ¡ trá»‹ chá»©ng tá»«. Vá»›i phiáº¿u thu bÃ¡n hÃ ng, `order_total_amount` láº¥y tá»« hÃ³a Ä‘Æ¡n gá»‘c vÃ  hiá»ƒn thá»‹ á»Ÿ cá»™t `Tá»•ng sau giáº£m`, `allocated_amount` lÃ  sá»‘ tiá»n thu, `remaining_after` lÃ  sá»‘ ná»£ cÃ²n láº¡i cá»§a hÃ³a Ä‘Æ¡n vÃ  hiá»ƒn thá»‹ á»Ÿ cá»™t `ChÆ°a TT`. `collected_before` váº«n tráº£ Ä‘á»ƒ biáº¿t hÃ³a Ä‘Æ¡n Ä‘Ã£ tá»«ng thu á»Ÿ cÃ¡c phiáº¿u trÆ°á»›c khi thanh toÃ¡n nhiá»u láº§n, nhÆ°ng khÃ´ng dÃ¹ng lÃ m cá»™t chÃ­nh. Vá»›i dá»¯ liá»‡u cÅ© cÃ³ `receipt_type = sale_payment` vÃ  `order_id` nhÆ°ng thiáº¿u `sale_payment_amount`, backend dÃ¹ng `total_received_amount` Ä‘á»ƒ dá»±ng allocation cho hÃ³a Ä‘Æ¡n thay vÃ¬ Ä‘á»ƒ frontend fallback tá»« ghi chÃº. KhÃ´ng dÃ¹ng `cashbook_entries.amount_delta` lÃ m tá»•ng hÃ³a Ä‘Æ¡n; field Ä‘Ã³ chá»‰ lÃ  giÃ¡ trá»‹ cá»§a dÃ²ng tiá»n vÃ o/ra.

Response list pháº£i cÃ³ summary theo filter:

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

Ghi chÃº search:

- `search` cÃ³ thá»ƒ tÃ¬m mÃ£ phiáº¿u, ghi chÃº hoáº·c ná»™i dung chuyá»ƒn khoáº£n.
- Náº¿u client cáº§n tÃ¡ch rÃµ nhÆ° KiotViet, dÃ¹ng thÃªm `search_scope = code | note | transfer_content`.
- Khi `search_scope = code` vÃ  mÃ£ phiáº¿u khá»›p máº«u mÃ£ chá»©ng tá»«, backend pháº£i bá» qua `from/to` náº¿u filter thá»i gian lÃ m che káº¿t quáº£.

### `GET /finance/cashbook/{entry_id}`

Chi tiáº¿t má»™t dÃ²ng sá»• quá»¹.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

Response gá»“m:

- mÃ£ phiáº¿u, tráº¡ng thÃ¡i, hÆ°á»›ng thu/chi, sá»‘ tiá»n
- quá»¹/tÃ i khoáº£n
- cÃ³/khÃ´ng háº¡ch toÃ¡n káº¿t quáº£ kinh doanh
- ngÆ°á»i táº¡o vÃ  ngÆ°á»i thu/chi
- Ä‘á»‘i tÆ°á»£ng ná»™p/nháº­n
- phÆ°Æ¡ng thá»©c thanh toÃ¡n
- ghi chÃº
- chá»©ng tá»« gá»‘c vÃ  phÃ¢n bá»• hÃ³a Ä‘Æ¡n náº¿u dÃ²ng sinh tá»« hÃ³a Ä‘Æ¡n/thu ná»£
- thÃ´ng tin phiáº¿u thá»§ cÃ´ng náº¿u dÃ²ng sinh tá»« phiáº¿u thu/chi thá»§ cÃ´ng

### `GET /finance/cashbook/balances`

Láº¥y sá»‘ dÆ° hiá»‡n táº¡i theo tá»«ng quá»¹/tÃ i khoáº£n.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

Response pháº£i tÃ¡ch tiá»n máº·t vÃ  tá»«ng tÃ i khoáº£n ngÃ¢n hÃ ng, khÃ´ng gá»™p chuyá»ƒn khoáº£n thÃ nh má»™t tá»•ng chung.

---

## 8. Manual cashbook vouchers

### `POST /finance/cashbook-vouchers`

Táº¡o phiáº¿u thu/chi thá»§ cÃ´ng.

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
  "counterparty_name": "TÃ½",
  "counterparty_phone": "0964917315",
  "partner_debt_mode": "no_partner_debt",
  "related_order_id": null,
  "related_customer_id": null,
  "reason": "Chi phÃ­ váº­t tÆ° phá»¥"
}
```

**Validation:**

- `voucher_direction IN ('in', 'out')`.
- `voucher_type` pháº£i há»£p lá»‡ theo hÆ°á»›ng thu/chi.
- `amount > 0`.
- `finance_account_id` active vÃ  cÃ¹ng organization.
- `is_business_accounted` máº·c Ä‘á»‹nh theo `voucher_type` nhÆ°ng cho phÃ©p client gá»­i rÃµ.
- `counterparty_type IN ('customer', 'supplier', 'employee', 'other', 'none')`.
- `partner_debt_mode IN ('affects_partner_debt', 'not_affect_partner_debt', 'no_partner_debt')`.
- Thu bÃ¡n hÃ ng vÃ  thu ná»£ khÃ¡ch khÃ´ng Ä‘Æ°á»£c táº¡o qua endpoint nÃ y; pháº£i dÃ¹ng POS checkout hoáº·c `/finance/debt-collections`.

**Workflow:**

1. Sinh mÃ£ `PT...` náº¿u thu, `PC...` náº¿u chi.
2. Táº¡o `cashbook_vouchers` tráº¡ng thÃ¡i `posted`.
3. Táº¡o má»™t dÃ²ng `cashbook_entries`.
4. Tráº£ phiáº¿u vÃ  dÃ²ng sá»• quá»¹.

### `POST /finance/cashbook-vouchers/{id}/revise`

Sá»­a phiáº¿u thu/chi thá»§ cÃ´ng báº±ng báº£n má»›i `MaCu.01`.

**Permission:** `perm.manage_finance`

**Validation:**

- Chá»‰ sá»­a phiáº¿u thá»§ cÃ´ng.
- Phiáº¿u cÅ© pháº£i lÃ  báº£n hiá»‡u lá»±c gáº§n nháº¥t.
- `reason` sá»­a báº¯t buá»™c.

**Workflow:**

1. Chuyá»ƒn phiáº¿u cÅ© sang `cancelled`.
2. Chuyá»ƒn dÃ²ng `cashbook_entries` cÅ© sang `cancelled`.
3. Táº¡o phiáº¿u má»›i vá»›i cÃ¹ng `base_code`, `revision_no + 1`.
4. Táº¡o dÃ²ng `cashbook_entries` má»›i.
5. Tráº£ phiáº¿u cÅ© vÃ  phiáº¿u má»›i.

### `POST /finance/cashbook-vouchers/{id}/cancel`

Há»§y phiáº¿u thu/chi thá»§ cÃ´ng.

**Permission:** `perm.manage_finance`

Chá»‰ cho há»§y phiáº¿u thá»§ cÃ´ng Ä‘ang `posted`. Khi há»§y, dÃ²ng `cashbook_entries` tÆ°Æ¡ng á»©ng chuyá»ƒn `cancelled`, khÃ´ng xÃ³a váº­t lÃ½.

### `POST /finance/cashbook-transfers`

Táº¡o cáº·p phiáº¿u chuyá»ƒn/rÃºt giá»¯a hai quá»¹/tÃ i khoáº£n.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "from_finance_account_id": "uuid",
  "to_finance_account_id": "uuid",
  "amount": 1000000,
  "transfer_time": "2026-07-05T19:00:00+07:00",
  "reason": "RÃºt tiá»n ngÃ¢n hÃ ng vá» quá»¹ tiá»n máº·t"
}
```

**Workflow:**

1. Táº¡o phiáº¿u chi `transfer` á»Ÿ quá»¹ nguá»“n.
2. Táº¡o phiáº¿u thu `transfer` á»Ÿ quá»¹ Ä‘Ã­ch.
3. Táº¡o hai dÃ²ng `cashbook_entries`.
4. Gáº¯n cÃ¹ng mÃ£/nhÃ³m liÃªn káº¿t Ä‘iá»u chuyá»ƒn Ä‘á»ƒ xem láº¡i Ä‘á»§ cáº·p.
5. Tá»•ng quá»¹ toÃ n há»‡ thá»‘ng khÃ´ng Ä‘á»•i.

Endpoint nÃ y lÃ  slice hoÃ n chá»‰nh sau manual voucher MVP. Khi chÆ°a cÃ³ endpoint nÃ y, náº¿u váº­n hÃ nh cáº§n chuyá»ƒn/rÃºt thÃ¬ pháº£i nháº­p cáº·p phiáº¿u thá»§ cÃ´ng vÃ  Ä‘á»‘i soÃ¡t ká»¹.

---

## 9. Reconciliation

### `POST /finance/reconciliations`

Táº¡o phiÃªn Ä‘á»‘i soÃ¡t.

**Permission:** `perm.manage_finance`

**Input:**

```json
{
  "period_start": "2026-06-30T00:00:00+07:00",
  "period_end": "2026-06-30T23:59:59+07:00",
  "note": "Äá»‘i soÃ¡t cuá»‘i ngÃ y"
}
```

**Workflow:**

1. Sinh mÃ£ `DS...`.
2. Táº¡o `cash_reconciliations` tráº¡ng thÃ¡i `draft`.
3. Táº¡o `cash_reconciliation_items` cho tá»«ng `finance_accounts.is_active = true`.
4. TÃ­nh `system_balance` tá»« `cashbook_entries.status = posted`.

### `PUT /finance/reconciliations/{id}`

Cáº­p nháº­t sá»‘ thá»±c táº¿ trÃªn phiÃªn Ä‘á»‘i soÃ¡t `draft`.

**Permission:** `perm.manage_finance`

Input gá»“m danh sÃ¡ch `finance_account_id`, `actual_balance`, `note`. Backend tÃ­nh láº¡i `difference_amount`.

### `POST /finance/reconciliations/{id}/balance`

Chá»‘t Ä‘á»‘i soÃ¡t.

**Permission:** `perm.manage_finance`

Workflow:

1. Kiá»ƒm tra phiÃªn cÃ²n `draft`.
2. TÃ­nh láº¡i `difference_amount`.
3. Äá»•i tráº¡ng thÃ¡i sang `balanced`, set `balanced_at`.
4. KhÃ´ng tá»± táº¡o phiáº¿u Ä‘iá»u chá»‰nh tiá»n trong MVP. Náº¿u lá»‡ch, nhÃ¢n viÃªn xá»­ lÃ½ báº±ng phiáº¿u thu/chi thá»§ cÃ´ng cÃ³ lÃ½ do.

### `POST /finance/reconciliations/{id}/cancel`

Há»§y phiÃªn Ä‘á»‘i soÃ¡t.

**Permission:** `perm.manage_finance`

Chá»‰ cho há»§y phiÃªn `draft`. PhiÃªn Ä‘Ã£ `balanced` khÃ´ng há»§y báº±ng endpoint nÃ y; náº¿u cáº§n Ä‘áº£o sau nÃ y pháº£i cÃ³ spec riÃªng.

### `GET /finance/reconciliations`

Danh sÃ¡ch phiÃªn Ä‘á»‘i soÃ¡t.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

Query: `search`, `status`, `from`, `to`, `page`, `page_size`.

### `GET /finance/reconciliations/{id}`

Chi tiáº¿t phiÃªn Ä‘á»‘i soÃ¡t vÃ  cÃ¡c dÃ²ng.

**Permission:** `perm.view_shift_report` hoáº·c `perm.manage_finance`

---

## 10. Error Handling

| HTTP | Code | Khi dÃ¹ng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai, sá»‘ tiá»n khÃ´ng khá»›p, thiáº¿u tÃ i khoáº£n |
| 401 | `AUTH_REQUIRED` | Thiáº¿u hoáº·c sai access token |
| 403 | `PERMISSION_DENIED` | Thiáº¿u permission |
| 403 | `WORKSTATION_INVALID` | Workstation khÃ´ng há»£p lá»‡ |
| 404 | `RESOURCE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n/khÃ¡ch/phiáº¿u trong organization |
| 409 | `RESOURCE_CONFLICT` | Phiáº¿u khÃ´ng cÃ²n hiá»‡u lá»±c, phiÃªn Ä‘á»‘i soÃ¡t khÃ´ng cÃ²n draft, mÃ£ trÃ¹ng |
| 422 | `FINANCE_OPERATION_FAILED` | KhÃ´ng thá»ƒ hoÃ n táº¥t nghiá»‡p vá»¥ tÃ i chÃ­nh cÃ³ thá»ƒ giáº£i thÃ­ch |
| 500 | `INTERNAL_ERROR` | Lá»—i há»‡ thá»‘ng khÃ´ng cÃ´ng khai chi tiáº¿t |

---

## 11. Logging vÃ  metric

Backend nÃªn log:

- táº¡o/sá»­a/há»§y phiáº¿u thu chi thá»§ cÃ´ng
- thu ná»£ khÃ¡ch
- táº¡o/chá»‘t/há»§y Ä‘á»‘i soÃ¡t
- thay Ä‘á»•i quá»¹/tÃ i khoáº£n

Metric gá»£i Ã½:

- tá»•ng thu/chi theo ngÃ y
- sá»‘ phiáº¿u thu/chi thá»§ cÃ´ng
- sá»‘ láº§n thu ná»£ khÃ¡ch
- sá»‘ phiÃªn Ä‘á»‘i soÃ¡t chá»‘t cÃ³ chÃªnh lá»‡ch
- latency API sá»• quá»¹

---

â† [Quay vá» Finance README](./README.md)
