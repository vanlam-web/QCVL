# ORDER-API â€” API nhÃ¡p, bÃ¡o giÃ¡ vÃ  hÃ³a Ä‘Æ¡n POS

> **Base path:** `/api/v1`
> **Business:** [POS-ORDER-LIFECYCLE.md](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md)
> **Database:** [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md), [INVENTORY-TABLES.md](../../04-DATABASE/Inventory/INVENTORY-TABLES.md), [PAYMENT-DEBT-TABLES.md](../../04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md), [CASHBOOK-TABLES.md](../../04-DATABASE/Finance/CASHBOOK-TABLES.md)

---

## 1. Pháº¡m vi

TÃ i liá»‡u nÃ y lÃ  Source of Truth cho Backend API liÃªn quan Ä‘áº¿n vÃ²ng Ä‘á»i Ä‘Æ¡n POS:

- validate/tÃ­nh giá» hÃ ng nhÃ¡p
- lÆ°u bÃ¡o giÃ¡ `BG...`
- tÃ¬m vÃ  má»Ÿ láº¡i bÃ¡o giÃ¡
- cáº­p nháº­t bÃ¡o giÃ¡
- checkout táº¡o hÃ³a Ä‘Æ¡n `HD...`
- sá»­a hÃ³a Ä‘Æ¡n Ä‘Ã£ chá»‘t báº±ng báº£n má»›i `MaCu.01`
- Ä‘á»c chá»©ng tá»« Ä‘Ã£ lÆ°u
- khÃ³a hÃ³a Ä‘Æ¡n cÅ© khi má»Ÿ láº¡i Ä‘á»ƒ sá»­a á»Ÿ phase sau

Tráº¡ng thÃ¡i implementation hiá»‡n táº¡i:

- ÄÃ£ cÃ³ foundation checkout/hÃ³a Ä‘Æ¡n vÃ  Sales Documents readonly theo cÃ¡c phase Ä‘Ã£ merge.
- Sá»­a/há»§y hÃ³a Ä‘Æ¡n Ä‘Ã£ chá»‘t vÃ  Ä‘áº£o kho/tiá»n/cÃ´ng ná»£ náº±m ngoÃ i pháº¡m vi hiá»‡n táº¡i. Chá»‰ báº­t khi cÃ³ transaction an toÃ n, rule nghiá»‡p vá»¥ rÃµ vÃ  test Ä‘á»§ cho cÃ¡c báº£ng liÃªn quan.

KhÃ´ng bao gá»“m:

- API quáº£n trá»‹ sá»• quá»¹/Ä‘á»‘i soÃ¡t Ä‘á»™c láº­p
- API kiá»ƒm kho/quáº£n trá»‹ tá»“n kho Ä‘á»™c láº­p
- in/gá»­i bill

NhÃ¡p POS Phase 2 váº«n lÆ°u local theo mÃ¡y táº¡i `POS/ARCHITECTURE.md`. Backend khÃ´ng táº¡o báº£n ghi `orders` cho nhÃ¡p cho Ä‘áº¿n khi nhÃ¢n viÃªn lÆ°u bÃ¡o giÃ¡ hoáº·c checkout thÃ nh cÃ´ng.

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
| Validate/tÃ­nh giá» nhÃ¡p | `perm.create_order` |
| Táº¡o, Ä‘á»c, cáº­p nháº­t bÃ¡o giÃ¡ | `perm.create_order` |
| Checkout táº¡o hÃ³a Ä‘Æ¡n | `perm.create_order` |
| Sá»­a hÃ³a Ä‘Æ¡n Ä‘Ã£ chá»‘t | `perm.edit_order_locked` |
| KhÃ³a/má»Ÿ khÃ³a hÃ³a Ä‘Æ¡n cÅ© Ä‘á»ƒ sá»­a | `perm.edit_order_locked` |

Ghi chÃº MVP: `perm.create_order` vÃ  cÃ¡c quyá»n thao tÃ¡c POS thÆ°á»ng ngÃ y pháº£i náº±m trong preset `NhÃ¢n viÃªn ná»™i bá»™`. `perm.edit_order_locked` lÃ  guard ká»¹ thuáº­t cho luá»“ng sá»­a/há»§y chá»©ng tá»« Ä‘Ã£ chá»‘t báº±ng báº£n má»›i `MaCu.01`; náº¿u Owner muá»‘n kiá»ƒm soÃ¡t máº¡nh hÆ¡n, tÃ¡ch á»Ÿ preset hoáº·c yÃªu cáº§u xÃ¡c nháº­n láº¡i, khÃ´ng thÃªm approval nhiá»u bÆ°á»›c trong MVP.

---

## 3. Cart validation

### `POST /pos/cart/validate`

Validate vÃ  tÃ­nh láº¡i giá» hÃ ng nhÃ¡p tá»« dá»¯ liá»‡u POS gá»­i lÃªn.

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
      "note": "Cáº¯t gáº¥p"
    }
  ],
  "note": "Giao chiá»u nay"
}
```

`customer_id` Ä‘Æ°á»£c phÃ©p null á»Ÿ bÆ°á»›c validate giá» hÃ ng vÃ¬ chÆ°a ghi chá»©ng tá»«.

**Validation:**

- Má»i `product_id` pháº£i tá»“n táº¡i, active vÃ  cÃ¹ng organization.
- `quantity > 0`.
- `unit_price >= 0`.
- `sell_method` pháº£i khá»›p sáº£n pháº©m hoáº·c lÃ  cÃ¡ch bÃ¡n há»£p lá»‡ Ä‘Æ°á»£c Backend cho phÃ©p.
- Vá»›i `area_m2`, `width_m` vÃ  `height_m` báº¯t buá»™c lá»›n hÆ¡n 0.
- Vá»›i `linear_m`, `linear_m` báº¯t buá»™c lá»›n hÆ¡n 0.
- `price_source = manual` Ä‘Æ°á»£c phÃ©p khi ngÆ°á»i dÃ¹ng sá»­a giÃ¡.

**Workflow:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Táº£i sáº£n pháº©m active trong organization.
3. Validate tá»«ng dÃ²ng.
4. TÃ­nh láº¡i `line_total` theo Business Rule tÃ­nh giá» hÃ ng.
5. Tráº£ giá» hÃ ng Ä‘Ã£ chuáº©n hÃ³a cho Frontend.

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

LÆ°u hÃ³a Ä‘Æ¡n nhÃ¡p hiá»‡n táº¡i thÃ nh bÃ¡o giÃ¡.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "customer_id": "uuid",
  "customer_snapshot": {
    "code": "KH000001",
    "name": "CÃ´ng ty ABC",
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
      "note": "Cáº¯t gáº¥p"
    }
  ],
  "note": "Giao chiá»u nay"
}
```

**Validation:**

- Náº¿u Frontend khÃ´ng gá»­i `customer_id`, Backend resolve vá» khÃ¡ch máº·c Ä‘á»‹nh `KH000001 - KhÃ¡ch láº»` trÆ°á»›c khi lÆ°u.
- Náº¿u cÃ³ `customer_id`, khÃ¡ch pháº£i cÃ¹ng organization.
- `customer_snapshot` báº¯t buá»™c, ká»ƒ cáº£ khÃ¡ch láº».
- CÃ³ Ã­t nháº¥t má»™t dÃ²ng hÃ ng.
- DÃ²ng hÃ ng pháº£i pass cÃ¹ng validation vá»›i `/pos/cart/validate`.
- `subtotal_amount` vÃ  `total_amount` do Backend tÃ­nh láº¡i, khÃ´ng tin tá»•ng tiá»n client gá»­i lÃªn.

**Workflow:**

1. Validate giá» hÃ ng.
2. Sinh mÃ£ `BG...` tÄƒng dáº§n trong organization.
3. Táº¡o `orders` vá»›i `order_type = quote`, `status = active`.
4. Táº¡o `order_items` theo snapshot Ä‘Ã£ validate.
5. Cộng lượt dùng sản phẩm vào `pos_product_usage` cho từng dòng có `product_id`.
6. Ghi `order_status_history` tá»« null sang `active`.
7. Tráº£ bÃ¡o giÃ¡ vá»«a táº¡o.

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

TÃ¬m bÃ¡o giÃ¡.

**Permission:** `perm.create_order`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `search` | `string` | Không | Tìm bỏ dấu theo mã báo giá/hóa đơn, tên/mã khách trong snapshot và ghi chú chứng từ |
| `status` | `string` | KhÃ´ng | `active`, `converted`, `cancelled`, máº·c Ä‘á»‹nh `active` |
| `page` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `1` |
| `page_size` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `20`, tá»‘i Ä‘a `100` |

### `GET /orders/{id}`

Äá»c bÃ¡o giÃ¡ hoáº·c hÃ³a Ä‘Æ¡n Ä‘Ã£ lÆ°u.

**Permission:** `perm.create_order`

Chá»‰ tráº£ chá»©ng tá»« trong cÃ¹ng organization.

### `PUT /orders/quotes/{id}`

Cáº­p nháº­t bÃ¡o giÃ¡ active.

**Permission:** `perm.create_order`

Validation giá»‘ng `POST /orders/quotes`.

Chá»‰ cho cáº­p nháº­t bÃ¡o giÃ¡ `order_type = quote` vÃ  `status = active`.

Khi Frontend má»Ÿ bÃ¡o giÃ¡ vÃ o POS rá»“i nhÃ¢n viÃªn báº¥m **BÃ¡o giÃ¡**, UI pháº£i há»i lÆ°u Ä‘Ã¨ bÃ¡o giÃ¡ cÅ© hay lÆ°u thÃ nh bÃ¡o giÃ¡ má»›i:

- LÆ°u Ä‘Ã¨ gá»i `PUT /orders/quotes/{id}` vÃ  giá»¯ mÃ£ `BG...`.
- LÆ°u má»›i gá»i `POST /orders/quotes` vÃ  sinh mÃ£ `BG...` má»›i.
- Máº·c Ä‘á»‹nh UI nÃªn Ä‘á» xuáº¥t lÆ°u má»›i Ä‘á»ƒ trÃ¡nh máº¥t ná»™i dung bÃ¡o giÃ¡ Ä‘Ã£ gá»­i.

Workflow cáº­p nháº­t:

1. Validate input.
2. Cáº­p nháº­t snapshot tá»•ng á»Ÿ `orders`.
3. Thay tháº¿ toÃ n bá»™ `order_items` cá»§a bÃ¡o giÃ¡ báº±ng danh sÃ¡ch má»›i.
4. KhÃ´ng Ä‘á»•i mÃ£ `BG...`.

### `POST /orders/quotes/{id}/cancel`

Há»§y bÃ¡o giÃ¡.

**Permission:** `perm.create_order`

Chá»‰ cho há»§y bÃ¡o giÃ¡ `status = active`.

Há»§y bÃ¡o giÃ¡ khÃ´ng xÃ³a dá»¯ liá»‡u, chá»‰ Ä‘á»•i `status = cancelled` vÃ  ghi `order_status_history`.

---

## 5. Invoice link from quote

### `POST /orders/quotes/{id}/mark-converted`

ÄÃ¡nh dáº¥u bÃ¡o giÃ¡ Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn thÃ nh hÃ³a Ä‘Æ¡n.

**Permission:** `perm.create_order`

Endpoint nÃ y chá»‰ Ä‘Æ°á»£c gá»i ná»™i bá»™ sau khi checkout táº¡o hÃ³a Ä‘Æ¡n `HD...` thÃ nh cÃ´ng vÃ  checkout cÃ³ giá»¯ `source_quote_id`.

Frontend khÃ´ng gá»i endpoint nÃ y trá»±c tiáº¿p trong MVP. Náº¿u checkout khÃ´ng truyá»n `source_quote_id`, bÃ¡o giÃ¡ cÅ© váº«n giá»¯ tráº¡ng thÃ¡i hiá»‡n táº¡i vÃ  hÃ³a Ä‘Æ¡n má»›i Ä‘Æ°á»£c xem nhÆ° hÃ³a Ä‘Æ¡n bÃ¡n tháº³ng.

**Input:**

```json
{
  "invoice_order_id": "uuid"
}
```

**Validation:**

- BÃ¡o giÃ¡ pháº£i cÃ¹ng organization, `order_type = quote`, `status = active`.
- HÃ³a Ä‘Æ¡n pháº£i cÃ¹ng organization, `order_type = invoice`.
- HÃ³a Ä‘Æ¡n pháº£i cÃ³ `source_quote_id` trá» vá» bÃ¡o giÃ¡ nÃ y.

**Workflow:**

1. Kiá»ƒm tra bÃ¡o giÃ¡ vÃ  hÃ³a Ä‘Æ¡n.
2. Äá»•i bÃ¡o giÃ¡ sang `status = converted`.
3. Ghi `order_status_history`.

---

## 6. Checkout hÃ³a Ä‘Æ¡n

### `POST /orders/checkout`

Checkout giá» hÃ ng hiá»‡n táº¡i thÃ nh hÃ³a Ä‘Æ¡n bÃ¡n hÃ ng `HD...`.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "source_quote_id": "uuid",
  "customer_id": "uuid",
  "customer_snapshot": {
    "code": "KH000001",
    "name": "CÃ´ng ty ABC",
    "phone": "0901234567"
  },
  "price_list_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "product_snapshot": {
        "code": "BAT-HIFLEX-32",
        "name": "Báº¡t Hiflex 3.2m",
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
      "note": "Chá»«a biÃªn theo máº·c Ä‘á»‹nh"
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
  "note": "Giao chiá»u nay"
}
```

`source_quote_id`, `customer_id`, `price_list_id`, `bank_account_id` Ä‘Æ°á»£c phÃ©p null trong input theo nghiá»‡p vá»¥. Khi ghi hÃ³a Ä‘Æ¡n, `customer_id` null pháº£i Ä‘Æ°á»£c Backend resolve vá» `KH000001 - KhÃ¡ch láº»`; dá»¯ liá»‡u lÆ°u khÃ´ng dÃ¹ng bucket khÃ¡ch láº» null.

Ghi chÃº: khi nhÃ¢n viÃªn má»Ÿ bÃ¡o giÃ¡ vá» POS, POS táº¡o má»™t nhÃ¡p local cÃ³ thá»ƒ sá»­a. Náº¿u checkout gá»­i `source_quote_id`, backend giá»¯ link `BG... -> HD...` vÃ  Ä‘á»•i bÃ¡o giÃ¡ sang `converted`. Náº¿u checkout khÃ´ng gá»­i `source_quote_id`, backend táº¡o hÃ³a Ä‘Æ¡n nhÆ° bÃ¡n tháº³ng; Ä‘Ã¢y váº«n lÃ  hÃ nh vi há»£p lá»‡ trong MVP.

`payment.cash_amount` vÃ  `payment.bank_amount` lÃ  sá»‘ tiá»n thá»±c giá»¯ láº¡i Ä‘á»ƒ ghi quá»¹, khÃ´ng bao gá»“m tiá»n thá»«a Ä‘Ã£ tráº£ láº¡i khÃ¡ch.

Náº¿u khÃ¡ch tráº£ dÆ° vÃ  nhÃ¢n viÃªn chá»n cáº¥n vÃ o ná»£ cÅ©, pháº§n cáº¥n ná»£ Ä‘Æ°á»£c Ä‘Æ°a vÃ o `old_debt_payment_amount`. Náº¿u tráº£ láº¡i khÃ¡ch, pháº§n Ä‘Ã³ khÃ´ng Ä‘Æ°a vÃ o `cash_amount`/`bank_amount`.

**Validation:**

- CÃ³ Ã­t nháº¥t má»™t dÃ²ng hÃ ng.
- DÃ²ng hÃ ng pháº£i pass validation nhÆ° `/pos/cart/validate`.
- Backend tá»± tÃ­nh láº¡i `line_subtotal_amount`, `line_total`, `subtotal_amount`, `discount_amount`, `total_amount`.
- Náº¿u `source_quote_id` cÃ³ giÃ¡ trá»‹, bÃ¡o giÃ¡ pháº£i cÃ¹ng organization, `order_type = quote`, `status = active`.
- Náº¿u Frontend khÃ´ng gá»­i `customer_id`, Backend resolve vá» `KH000001 - KhÃ¡ch láº»`.
- Náº¿u khÃ¡ch Ä‘Æ°á»£c resolve lÃ  `KH000001` vÃ  hÃ³a Ä‘Æ¡n cÃ²n ná»£, `retail_debt_note` báº¯t buá»™c Ä‘á»ƒ nháº­n diá»‡n ngÆ°á»i ná»£.
- `cash_amount >= 0`, `bank_amount >= 0`, `old_debt_payment_amount >= 0`.
- Náº¿u `bank_amount > 0`, `bank_account_id` báº¯t buá»™c, active, cÃ¹ng organization vÃ  lÃ  tÃ i khoáº£n `bank`.
- Má»™t láº§n checkout chá»‰ Ä‘Æ°á»£c chá»n tá»‘i Ä‘a má»™t tÃ i khoáº£n bank.
- Náº¿u `old_debt_payment_amount > 0`, `customer_id` báº¯t buá»™c.
- Cho phÃ©p tá»“n kho Ã¢m sau cáº£nh bÃ¡o; Backend khÃ´ng cháº·n checkout chá»‰ vÃ¬ thiáº¿u tá»“n.

**Workflow báº¯t buá»™c trong má»™t transaction nghiá»‡p vá»¥:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Validate giá» hÃ ng vÃ  tÃ­nh láº¡i tiá»n.
3. Sinh mÃ£ `HD...`.
4. Resolve khÃ¡ch hÃ ng: náº¿u input khÃ´ng cÃ³ khÃ¡ch, dÃ¹ng `KH000001 - KhÃ¡ch láº»`.
5. Táº¡o `orders` loáº¡i `invoice`, `status = completed`.
6. Táº¡o `order_items` snapshot.
7. Cộng lượt dùng sản phẩm vào `pos_product_usage` cho từng dòng có `product_id`.
8. Trá»« kho theo Inventory rule báº±ng `stock_movements`.
9. Náº¿u cÃ³ tiá»n thá»±c giá»¯ láº¡i, táº¡o `payment_receipts` vÃ  `payment_receipt_methods`.
10. Táº¡o `cashbook_entries` tá»« tá»«ng dÃ²ng phÆ°Æ¡ng thá»©c thu.
11. Náº¿u hÃ³a Ä‘Æ¡n má»›i cÃ²n ná»£, táº¡o `customer_debt_entries` loáº¡i `invoice_debt`.
12. Náº¿u cÃ³ tráº£ ná»£ cÅ©, phÃ¢n bá»• vÃ o hÃ³a Ä‘Æ¡n cÃ²n ná»£ cÅ© nháº¥t trÆ°á»›c báº±ng `customer_debt_allocations` vÃ  táº¡o `customer_debt_entries` loáº¡i `debt_payment`.
13. Náº¿u cÃ³ `source_quote_id`, Ä‘á»•i bÃ¡o giÃ¡ sang `converted`; náº¿u khÃ´ng cÃ³ thÃ¬ bá» qua bÆ°á»›c nÃ y.
14. Ghi `order_status_history`.
15. Tráº£ hÃ³a Ä‘Æ¡n, payment summary, debt summary vÃ  cáº£nh bÃ¡o tá»“n kho náº¿u cÃ³.

Náº¿u báº¥t ká»³ bÆ°á»›c ghi dá»¯ liá»‡u chÃ­nh nÃ o lá»—i, transaction pháº£i rollback; khÃ´ng Ä‘Æ°á»£c táº¡o hÃ³a Ä‘Æ¡n dá»Ÿ dang.

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

## 7. Sá»­a hÃ³a Ä‘Æ¡n Ä‘Ã£ chá»‘t

### `POST /orders/{id}/revise`

Táº¡o báº£n sá»­a cá»§a hÃ³a Ä‘Æ¡n Ä‘Ã£ chá»‘t theo mÃ£ `MaCu.01`, khÃ´ng sá»­a Ä‘Ã¨ hÃ³a Ä‘Æ¡n cÅ©.

**Permission:** `perm.edit_order_locked`

**Input:**

```json
{
  "customer_id": "uuid",
  "customer_snapshot": {
    "code": "KH000001",
    "name": "CÃ´ng ty ABC",
    "phone": "0901234567"
  },
  "items": [
    {
      "product_id": "uuid",
      "product_snapshot": {
        "code": "BAT-HIFLEX-32",
        "name": "Báº¡t Hiflex 3.2m",
        "unit_name": "m2",
        "sell_method": "area_m2"
      },
      "sell_method": "area_m2",
      "quantity": 1,
      "width_m": 2,
      "height_m": 3,
      "unit_price": 50000,
      "discount_amount": 0,
      "price_source": "manual",
      "note": "Ná»™i dung sau sá»­a"
    }
  ],
  "payment": {
    "cash_amount": 0,
    "bank_amount": 0,
    "bank_account_id": null,
    "old_debt_payment_amount": 0
  },
  "revision_reason_code": "wrong_dimension",
  "revision_reason_note": "Sá»­a sai kÃ­ch thÆ°á»›c",
  "note": "Ná»™i dung sau sá»­a"
}
```

**Validation:**

- HÃ³a Ä‘Æ¡n gá»‘c pháº£i cÃ¹ng organization, `order_type = invoice`.
- Chá»‰ cho sá»­a báº£n hÃ³a Ä‘Æ¡n cÃ²n hiá»‡u lá»±c gáº§n nháº¥t trong chuá»—i `base_code`.
- HÃ³a Ä‘Æ¡n Ä‘ang bá»‹ user khÃ¡c lock thÃ¬ tráº£ `RESOURCE_CONFLICT`.
- `revision_reason_code` báº¯t buá»™c, thuá»™c nhÃ³m `wrong_price`, `wrong_dimension`, `wrong_customer`, `customer_changed_mind`, `other`.
- `revision_reason_note` khÃ´ng báº¯t buá»™c, trá»« khi `revision_reason_code = other`.
- NhÃ¢n viÃªn ná»™i bá»™ Ä‘Æ°á»£c sá»­a/há»§y trong 10 ngÃ y tá»« thá»i Ä‘iá»ƒm táº¡o hÃ³a Ä‘Æ¡n; sau 10 ngÃ y endpoint yÃªu cáº§u quyá»n quáº£n lÃ½/admin hoáº·c quyá»n máº¡nh tÆ°Æ¡ng á»©ng.
- Input giá» hÃ ng vÃ  payment validate nhÆ° checkout.

**Workflow:**

1. Lock hÃ³a Ä‘Æ¡n gá»‘c hoáº·c kiá»ƒm tra lock hiá»‡n cÃ³ cá»§a actor.
2. Validate láº¡i toÃ n bá»™ ná»™i dung sau sá»­a.
3. Táº¡o hÃ³a Ä‘Æ¡n má»›i vá»›i cÃ¹ng `base_code`, `revision_no` tÄƒng 1 vÃ  mÃ£ dáº¡ng `HD000123.01`.
4. Chuyá»ƒn hÃ³a Ä‘Æ¡n cÅ© sang `status = cancelled`, `cancel_reason_type = revised`, `replaced_by_order_id = hÃ³a Ä‘Æ¡n má»›i`.
5. HÃ³a Ä‘Æ¡n má»›i lÆ°u `revised_from_order_id = hÃ³a Ä‘Æ¡n cÅ©`.
6. Äáº£o kho cá»§a hÃ³a Ä‘Æ¡n cÅ© báº±ng `stock_movements.movement_type = invoice_reversal`, rá»“i trá»« kho láº¡i theo hÃ³a Ä‘Æ¡n má»›i.
7. Äáº£o cÃ´ng ná»£ cá»§a hÃ³a Ä‘Æ¡n cÅ©, rá»“i ghi cÃ´ng ná»£ láº¡i theo hÃ³a Ä‘Æ¡n má»›i náº¿u cÃ²n ná»£.
8. Xá»­ lÃ½ tiá»n theo chÃªnh lá»‡ch: báº£n má»›i tÄƒng tiá»n thÃ¬ thu thÃªm hoáº·c ghi ná»£; báº£n má»›i giáº£m tiá»n thÃ¬ hoÃ n tiá»n hoáº·c cáº¥n ná»£ cÅ© náº¿u khÃ¡ch cÃ²n ná»£.
9. Ghi `order_status_history` cho cáº£ hÃ³a Ä‘Æ¡n cÅ© vÃ  hÃ³a Ä‘Æ¡n má»›i.
10. Unlock hÃ³a Ä‘Æ¡n.

**Response data:**

```json
{
  "old_order": {
    "id": "uuid",
    "code": "HD000123",
    "status": "cancelled"
  },
  "new_order": {
    "id": "uuid",
    "code": "HD000123.01",
    "status": "completed",
    "revision_no": 1
  }
}
```

---

## 8. Order lock

### `POST /orders/{id}/lock`

KhÃ³a hÃ³a Ä‘Æ¡n cÅ© khi má»Ÿ láº¡i Ä‘á»ƒ sá»­a trong phase sau.

**Permission:** `perm.edit_order_locked`

Chi tiáº¿t lock hiá»‡n táº¡i tham chiáº¿u [ARCHITECTURE.md Â§3](./ARCHITECTURE.md#3-concurrency-lock--khÃ³a-Ä‘Æ¡n-tranh-cháº¥p).

### `POST /orders/{id}/unlock`

Giáº£i phÃ³ng khÃ³a hÃ³a Ä‘Æ¡n.

**Permission:** `perm.edit_order_locked`

---

## 9. Error Handling

| HTTP | Code | Khi dÃ¹ng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Giá» hÃ ng sai, thiáº¿u snapshot, giÃ¡ trá»‹ khÃ´ng há»£p lá»‡ |
| 401 | `AUTH_REQUIRED` | Thiáº¿u hoáº·c sai access token |
| 403 | `PERMISSION_DENIED` | Thiáº¿u permission |
| 403 | `WORKSTATION_INVALID` | Workstation khÃ´ng há»£p lá»‡ |
| 404 | `RESOURCE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y customer/product/order trong organization |
| 409 | `RESOURCE_CONFLICT` | BÃ¡o giÃ¡ khÃ´ng cÃ²n active, Ä‘Æ¡n Ä‘ang bá»‹ khÃ³a hoáº·c mÃ£ chá»©ng tá»« xung Ä‘á»™t |
| 422 | `CHECKOUT_FAILED` | Checkout khÃ´ng thá»ƒ hoÃ n táº¥t do lá»—i nghiá»‡p vá»¥ cÃ³ thá»ƒ giáº£i thÃ­ch |
| 500 | `INTERNAL_ERROR` | Lá»—i há»‡ thá»‘ng khÃ´ng cÃ´ng khai chi tiáº¿t |

---

## 10. Logging vÃ  metric

Backend nÃªn log:

- táº¡o bÃ¡o giÃ¡
- cáº­p nháº­t bÃ¡o giÃ¡
- há»§y bÃ¡o giÃ¡
- chuyá»ƒn bÃ¡o giÃ¡ thÃ nh hÃ³a Ä‘Æ¡n
- checkout hÃ³a Ä‘Æ¡n thÃ nh cÃ´ng/tháº¥t báº¡i
- sá»­a hÃ³a Ä‘Æ¡n táº¡o báº£n má»›i
- lock/unlock hÃ³a Ä‘Æ¡n cÅ©

Metric gá»£i Ã½:

- sá»‘ bÃ¡o giÃ¡ táº¡o má»›i
- sá»‘ bÃ¡o giÃ¡ chuyá»ƒn hÃ³a Ä‘Æ¡n
- sá»‘ hÃ³a Ä‘Æ¡n checkout thÃ nh cÃ´ng
- lá»—i checkout theo nhÃ³m validation/payment/inventory
- lá»—i validate giá» hÃ ng
- latency `/pos/cart/validate`
- latency `/orders/checkout`

---

â† [Quay vá» POS README](./README.md)
