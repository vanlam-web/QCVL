# CUSTOMER-PRODUCT-PRICING-API â€” API Customer, Product vÃ  Pricing POS

> **Base path:** `/api/v1`
> **Business:** [POS-CUSTOMER.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md), [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md)
> **Database:** [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md)

---

## 1. Pháº¡m vi

TÃ i liá»‡u nÃ y lÃ  Source of Truth cho API Customer, Product vÃ  Pricing phá»¥c vá»¥ POS Phase 1.

Bao gá»“m:

- tÃ¬m, táº¡o vÃ  cáº­p nháº­t khÃ¡ch hÃ ng
- Ä‘á»c nhÃ³m khÃ¡ch
- tÃ¬m sáº£n pháº©m Ä‘ang bÃ¡n trÃªn POS
- láº¥y giÃ¡ theo khÃ¡ch/nhÃ³m khÃ¡ch/báº£ng giÃ¡ chung
- Ä‘á»c lá»‹ch sá»­ giÃ¡ gáº§n Ä‘Ã¢y theo khÃ¡ch hÃ ng + sáº£n pháº©m
- quáº£n lÃ½ danh má»¥c sáº£n pháº©m vÃ  báº£ng giÃ¡ tá»‘i thiá»ƒu cho Phase 1

KhÃ´ng bao gá»“m:

- táº¡o Ä‘Æ¡n hÃ ng, bÃ¡o giÃ¡, hÃ³a Ä‘Æ¡n hoáº·c checkout
- ghi lá»‹ch sá»­ giÃ¡ tá»« chá»©ng tá»« bÃ¡n hÃ ng
- tá»“n kho, BOM, cuá»™n/táº¥m/lot váº­t tÆ°
- káº¿t ná»‘i mÃ¡y sáº£n xuáº¥t hoáº·c Realtime queue

---

## 2. Auth vÃ  response chuáº©n

Má»i endpoint trong file nÃ y yÃªu cáº§u:

```http
Authorization: Bearer <qcvl_access_token>
X-Workstation-Id: <uuid>
X-Request-Id: <client-generated-id>   # khÃ´ng báº¯t buá»™c
```

Ãp dá»¥ng response chuáº©n táº¡i [FOUNDATION-API.md](../FOUNDATION-API.md#2-response-chuáº©n).

Táº¥t cáº£ dá»¯ liá»‡u Ä‘á»c/ghi pháº£i Ä‘Æ°á»£c giá»›i háº¡n trong organization cá»§a actor.

---

## 3. Permission

| NhÃ³m API | Permission |
|---|---|
| TÃ¬m khÃ¡ch, táº¡o nhanh khÃ¡ch, sá»­a thÃ´ng tin khÃ¡ch phá»¥c vá»¥ POS | `perm.create_order` |
| TÃ¬m sáº£n pháº©m Ä‘ang bÃ¡n, láº¥y giÃ¡ máº·c Ä‘á»‹nh, Ä‘á»c lá»‹ch sá»­ giÃ¡ gáº§n Ä‘Ã¢y | `perm.create_order` |
| Quáº£n lÃ½ sáº£n pháº©m, nhÃ³m khÃ¡ch, báº£ng giÃ¡ vÃ  chi tiáº¿t báº£ng giÃ¡ | `perm.edit_price_book` |

Backend pháº£i kiá»ƒm tra permission á»Ÿ má»i endpoint, khÃ´ng phá»¥ thuá»™c viá»‡c Frontend áº©n nÃºt.

---

## 4. Customers

### `GET /customers`

TÃ¬m khÃ¡ch hÃ ng trong organization hiá»‡n táº¡i.

**Permission:** `perm.create_order`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `search` | `string` | KhÃ´ng | TÃ¬m theo mÃ£ khÃ¡ch, tÃªn khÃ¡ch hoáº·c SÄT |
| `page` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `1` |
| `page_size` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `20`, tá»‘i Ä‘a `100` |

**Validation:**

- `page >= 1`
- `1 <= page_size <= 100`
- `search` Ä‘Æ°á»£c trim; chuá»—i rá»—ng sau trim tÆ°Æ¡ng Ä‘Æ°Æ¡ng khÃ´ng truyá»n search

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "KH000001",
      "name": "CÃ´ng ty ABC",
      "phone": "0901234567",
      "customer_group": {
        "id": "uuid",
        "code": "DAILY",
        "name": "Äáº¡i lÃ½"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `POST /customers`

Táº¡o khÃ¡ch hÃ ng tá»« POS.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "code": "KH000123",
  "name": "CÃ´ng ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

`code`, `phone`, `customer_group_id` Ä‘Æ°á»£c phÃ©p bá» trá»‘ng.

**Validation:**

- `name` báº¯t buá»™c, trim xong khÃ´ng rá»—ng.
- Náº¿u cÃ³ `code`, trim xong khÃ´ng rá»—ng vÃ  khÃ´ng trÃ¹ng trong organization.
- Náº¿u thiáº¿u `code`, Backend tá»± sinh mÃ£ dáº¡ng `KH000001`, tÄƒng dáº§n trong organization.
- Náº¿u cÃ³ `phone`, Backend chuáº©n hÃ³a thÃ nh `phone_normalized` vÃ  khÃ´ng cho trÃ¹ng trong organization.
- Náº¿u cÃ³ `customer_group_id`, nhÃ³m khÃ¡ch pháº£i tá»“n táº¡i, active vÃ  cÃ¹ng organization.

**Workflow:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Trim input.
3. Chuáº©n hÃ³a SÄT náº¿u cÃ³.
4. Tá»± sinh mÃ£ khÃ¡ch náº¿u thiáº¿u `code`.
5. Kiá»ƒm tra trÃ¹ng mÃ£ khÃ¡ch vÃ  SÄT.
6. Ghi `public.customers`.
7. Tráº£ khÃ¡ch hÃ ng vá»«a táº¡o.

**Response data:**

```json
{
  "id": "uuid",
  "code": "KH000123",
  "name": "CÃ´ng ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

### `PATCH /customers/{id}`

Cáº­p nháº­t thÃ´ng tin khÃ¡ch hÃ ng phá»¥c vá»¥ POS.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "code": "KH000123",
  "name": "CÃ´ng ty ABC",
  "phone": "0901234567",
  "customer_group_id": "uuid"
}
```

**Validation:**

- KhÃ¡ch hÃ ng pháº£i tá»“n táº¡i trong organization.
- Náº¿u sá»­a `name`, trim xong khÃ´ng rá»—ng.
- Náº¿u sá»­a `code`, khÃ´ng Ä‘Æ°á»£c trÃ¹ng trong organization.
- Náº¿u sá»­a `phone`, SÄT chuáº©n hÃ³a khÃ´ng Ä‘Æ°á»£c trÃ¹ng vá»›i khÃ¡ch khÃ¡c trong organization.
- `customer_group_id = null` nghÄ©a lÃ  khÃ¡ch khÃ´ng gÃ¡n nhÃ³m vÃ  dÃ¹ng báº£ng giÃ¡ chung.
- Náº¿u `customer_group_id` khÃ¡c null, nhÃ³m khÃ¡ch pháº£i active vÃ  cÃ¹ng organization.

---

## 5. Customer groups

### `GET /customer-groups`

Láº¥y danh sÃ¡ch nhÃ³m khÃ¡ch active Ä‘á»ƒ gÃ¡n cho khÃ¡ch hÃ ng.

**Permission:** `perm.create_order`

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "DAILY",
      "name": "Äáº¡i lÃ½",
      "price_list_id": "uuid"
    }
  ]
}
```

### `POST /customer-groups`

Táº¡o nhÃ³m khÃ¡ch.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "DAILY",
  "name": "Äáº¡i lÃ½",
  "price_list_id": "uuid"
}
```

**Validation:**

- `code` vÃ  `name` trim xong khÃ´ng rá»—ng.
- `code` khÃ´ng trÃ¹ng trong organization.
- `price_list_id` pháº£i tá»“n táº¡i, active vÃ  cÃ¹ng organization.

### `PATCH /customer-groups/{id}`

Cáº­p nháº­t nhÃ³m khÃ¡ch.

**Permission:** `perm.edit_price_book`

Cho phÃ©p sá»­a `code`, `name`, `price_list_id`, `is_active`.

Náº¿u chuyá»ƒn `is_active = false`, khÃ¡ch hÃ ng Ä‘ang thuá»™c nhÃ³m nÃ y váº«n giá»¯ liÃªn káº¿t hiá»‡n táº¡i; nhÃ³m inactive chá»‰ khÃ´ng Ä‘Æ°á»£c gÃ¡n má»›i.

---

## 6. Products

### `GET /products`

Query dùng cho POS và trang Hàng hóa.

Tham số hiện tại:

| Query | Ý nghĩa |
|---|---|
| `search` | Tìm theo mã/tên; hỗ trợ tìm không dấu ở frontend và backend nếu có cột chuẩn hóa |
| `status` | Lọc `active` / `inactive`; POS chỉ dùng `active` |
| `sell_method` | Lọc cách tính bán |
| `product_kind` | Lọc loại hàng |
| `page`, `page_size` | Phân trang |
| `sort=pos_usage` | Dùng cho lưới sản phẩm nhanh POS; ưu tiên sản phẩm có `pos_product_usage.usage_count` cao hơn |

Với `sort=pos_usage`, backend join theo `(organization_id, product_id)`, sắp `usage_count DESC`, rồi fallback theo thứ tự sản phẩm ổn định. Không dùng cache trình duyệt cho thứ tự này.

TÃ¬m sáº£n pháº©m/dá»‹ch vá»¥ Ä‘ang bÃ¡n trÃªn POS.

**Permission:** `perm.create_order` hoáº·c `perm.edit_price_book`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `search` | `string` | KhÃ´ng | TÃ¬m theo mÃ£ hoáº·c tÃªn sáº£n pháº©m |
| `status` | `string` | KhÃ´ng | POS máº·c Ä‘á»‹nh chá»‰ dÃ¹ng `active`; chá»‰ endpoint quáº£n lÃ½ Ä‘Æ°á»£c dÃ¹ng `inactive` hoáº·c `all` |
| `product_group_id` | `uuid` | KhÃ´ng | Lá»c theo nhÃ³m hÃ ng trong module HÃ ng hÃ³a |
| `product_kind` | `string` | KhÃ´ng | Lá»c loáº¡i hÃ ng: `goods`, `service`, `auxiliary_material`, `roll`, `sheet`, `combo` |
| `page` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `1` |
| `page_size` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `20`, tá»‘i Ä‘a `100` |

**Validation vÃ  rule:**

- Náº¿u actor chá»‰ cÃ³ `perm.create_order`, Backend luÃ´n Ã©p `status = active`.
- Náº¿u actor cÃ³ `perm.edit_price_book`, `status` Ä‘Æ°á»£c phÃ©p lÃ  `active`, `inactive` hoáº·c `all`.
- `search` trim xong rá»—ng thÃ¬ bá» qua.
- TÃ¬m kiáº¿m há»— trá»£ khÃ´ng dáº¥u theo chiáº¿n lÆ°á»£c ká»¹ thuáº­t Ä‘Æ°á»£c chá»‘t khi triá»ƒn khai search.
- KhÃ´ng há»— trá»£ QR/barcode trong Phase 1.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "MICA-3MM",
      "name": "Mica 3mm",
      "status": "active",
      "product_group_id": "uuid",
      "product_group": { "id": "uuid", "code": "GENERAL", "name": "GiÃ¡ chung" },
      "unit_name": "m",
      "sell_method": "linear_m",
      "unit_conversions": [
        {
          "unit_id": "uuid",
          "unit_name": "m tá»›i",
          "stock_qty_per_unit": 0.5,
          "is_default_purchase_unit": true,
          "is_default_sale_unit": true
        }
      ]
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `POST /products`

Táº¡o sáº£n pháº©m/dá»‹ch vá»¥.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "MICA-3MM",
  "name": "Mica 3mm",
  "status": "active",
  "unit_name": "m",
  "sell_method": "linear_m",
  "inventory_shape": "sheet",
  "track_inventory": true,
  "product_group_id": "uuid",
  "latest_purchase_cost": 125000,
  "unit_conversions": [
    {
      "unit_name": "m tá»›i",
      "stock_qty_per_unit": 0.5,
      "is_default_purchase_unit": true,
      "is_default_sale_unit": true
    }
  ]
}
```

**Validation:**

- `code`, `name`, `unit_name` trim xong khÃ´ng rá»—ng.
- `code` khÃ´ng trÃ¹ng trong organization.
- `status` thuá»™c `active | inactive`.
- `sell_method` thuá»™c `quantity | area_m2 | linear_m | sheet | combo`.
- `inventory_shape` thuá»™c `normal | roll | sheet`; náº¿u bá» trá»‘ng máº·c Ä‘á»‹nh lÃ  `normal`.
- `product_kind` thuá»™c `goods | service | auxiliary_material | roll | sheet | combo`; náº¿u bá» trá»‘ng Backend tá»± suy ra tá»« `sell_method`, `inventory_shape` vÃ  `track_inventory`.
- `track_inventory` lÃ  boolean; náº¿u bá» trá»‘ng Backend tá»± suy ra theo loáº¡i tá»“n/cÃ¡ch tÃ­nh bÃ¡n.
- `latest_purchase_cost` lÃ  sá»‘ lá»›n hÆ¡n hoáº·c báº±ng `0`; náº¿u bá» trá»‘ng thÃ¬ chÆ°a ghi giÃ¡ vá»‘n gáº§n nháº¥t.
- `product_group_id` náº¿u bá» trá»‘ng thÃ¬ Backend gÃ¡n nhÃ³m máº·c Ä‘á»‹nh `GiÃ¡ chung`.
- `unit_conversions` lÃ  danh sÃ¡ch Ä‘Æ¡n vá»‹ phá»¥ kiá»ƒu KiotViet; má»—i dÃ²ng cÃ³ `unit_name`, `stock_qty_per_unit > 0`, vÃ  cá» máº·c Ä‘á»‹nh mua/bÃ¡n. VÃ­ dá»¥ `Ram = 100 tá»`, `m tá»›i = 0.5 m`, `Táº¥c = 0.042 Ä‘Æ¡n vá»‹ cÆ¡ báº£n`.

### `GET /product-groups`

Danh sÃ¡ch nhÃ³m hÃ ng.

**Permission:** `perm.create_order`, `perm.edit_price_book` hoáº·c `perm.manage_inventory`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `active_only` | `boolean` | KhÃ´ng | Máº·c Ä‘á»‹nh chá»‰ tráº£ nhÃ³m Ä‘ang hoáº¡t Ä‘á»™ng |

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "GENERAL",
      "name": "GiÃ¡ chung",
      "is_default": true,
      "is_active": true
    }
  ]
}
```

### `POST /product-groups`

Táº¡o nhÃ³m hÃ ng.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "name": "Váº­t tÆ°",
  "code": "VAT-TU"
}
```

`code` khÃ´ng báº¯t buá»™c; náº¿u bá» trá»‘ng Backend tá»± sinh code tá»« tÃªn nhÃ³m. Má»—i organization cÃ³ má»™t nhÃ³m máº·c Ä‘á»‹nh `GiÃ¡ chung`.

`GET /products` há»— trá»£ query `product_kind = goods | service | auxiliary_material | roll | sheet | combo`. Backend lá»c theo `products.product_kind` Ä‘á»ƒ `Váº­t tÆ° phá»¥` Ä‘Æ°á»£c lÆ°u tháº­t, khÃ´ng láº«n vá»›i hÃ ng thÆ°á»ng:

- `service`: `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = false`.
- `auxiliary_material`: váº­t tÆ° phá»¥; váº«n cÃ³ tá»“n nhÆ° hÃ ng thÆ°á»ng nhÆ°ng Ä‘Æ°á»£c nháº­n diá»‡n riÃªng cho BOM/khui váº­t tÆ°.
- `goods`: `inventory_shape = normal`, `track_inventory = true`, khÃ´ng pháº£i combo.
- `roll`: `inventory_shape = roll`.
- `sheet`: `inventory_shape = sheet`.
- `combo`: `sell_method = combo`.

**Ghi chÃº UI HÃ ng hÃ³a:**

- Form `+ Táº¡o hÃ ng hÃ³a` dÃ¹ng má»™t modal chung, chá»n loáº¡i hÃ ng á»Ÿ Ä‘áº§u form: hÃ ng thÆ°á»ng, dá»‹ch vá»¥, váº­t tÆ° phá»¥, hÃ ng cuá»™n, hÃ ng táº¥m, combo - Ä‘Ã³ng gÃ³i.
- Dá»‹ch vá»¥ lÃ  phÃ¢n loáº¡i riÃªng trong UI/filter, nhÆ°ng Backend nháº­n diá»‡n báº±ng cáº¥u hÃ¬nh tá»“n hiá»‡n cÃ³: `inventory_shape = normal`, `sell_method = quantity`, `track_inventory = false`; UI áº©n pháº§n tá»“n kho khi táº¡o.
- HÃ ng cuá»™n lÆ°u `inventory_shape = roll`, hÃ ng táº¥m lÆ°u `inventory_shape = sheet`.
- Combo lÆ°u `sell_method = combo`, `track_inventory = false`; UI áº©n pháº§n tá»“n kho vÃ  hiá»‡n khu vá»±c váº­t tÆ° cáº¥u thÃ nh. Khi táº¡o combo, frontend gá»i `POST /products` trÆ°á»›c rá»“i gá»i `POST /products/{product_id}/bom` Ä‘á»ƒ lÆ°u BOM cho sáº£n pháº©m vá»«a táº¡o. Khi bÃ¡n combo, tá»“n trá»« vÃ o váº­t tÆ° cáº¥u thÃ nh theo BOM active, khÃ´ng trá»« theo chÃ­nh mÃ£ combo. Má»—i dÃ²ng BOM khÃ´ng gá»­i `component_type`; váº­t tÆ° phá»¥ Ä‘Æ°á»£c nháº­n diá»‡n tá»« loáº¡i hÃ ng cá»§a váº­t tÆ° sau khi cÃ³ metadata lÆ°u loáº¡i hÃ ng riÃªng.
- ThÃ nh pháº§n combo váº«n cÃ³ thá»ƒ sá»­a sau á»Ÿ chi tiáº¿t hÃ ng hÃ³a; má»—i láº§n lÆ°u táº¡o BOM/version hiá»‡n hÃ nh theo contract BOM.
- `LÆ°u & táº¡o thÃªm` dÃ¹ng cÃ¹ng endpoint `POST /products`, táº¡o xong reset form á»Ÿ frontend vÃ  giá»¯ modal má»Ÿ.
- Modal táº¡o hÃ ng khÃ´ng cÃ³ vÃ¹ng áº£nh hÃ ng hÃ³a, khÃ´ng cÃ³ tab mÃ´ táº£ disabled vÃ  khÃ´ng cÃ³ checkbox `BÃ¡n trá»±c tiáº¿p`; sáº£n pháº©m/dá»‹ch vá»¥ Ä‘ang hoáº¡t Ä‘á»™ng máº·c Ä‘á»‹nh Ä‘Æ°á»£c bÃ¡n trá»±c tiáº¿p. Module nÃ y khÃ´ng dÃ¹ng nÃºt `In tem mÃ£`.

### `PATCH /products/{id}`

Cáº­p nháº­t sáº£n pháº©m/dá»‹ch vá»¥.

**Permission:** `perm.edit_price_book`

Cho phÃ©p sá»­a `code`, `name`, `status`, `unit_name`, `sell_method`.

KhÃ´ng xÃ³a váº­t lÃ½ sáº£n pháº©m Ä‘Ã£ cÃ³ lá»‹ch sá»­; ngÆ°ng bÃ¡n dÃ¹ng `status = inactive`.

---

## 7. Price lists

### `GET /price-lists`

Láº¥y danh sÃ¡ch báº£ng giÃ¡.

**Permission:** `perm.edit_price_book`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `active_only` | `boolean` | KhÃ´ng | Máº·c Ä‘á»‹nh `true` |

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "DEFAULT",
      "name": "Báº£ng giÃ¡ chung",
      "is_default": true,
      "is_active": true
    }
  ]
}
```

### `POST /price-lists`

Táº¡o báº£ng giÃ¡.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "code": "DAILY",
  "name": "Báº£ng giÃ¡ Ä‘áº¡i lÃ½",
  "is_default": false
}
```

**Validation:**

- `code`, `name` trim xong khÃ´ng rá»—ng.
- `code` khÃ´ng trÃ¹ng trong organization.
- Náº¿u `is_default = true`, Backend pháº£i Ä‘áº£m báº£o organization chá»‰ cÃ³ má»™t báº£ng giÃ¡ chung active.

### `PATCH /price-lists/{id}`

Cáº­p nháº­t báº£ng giÃ¡.

**Permission:** `perm.edit_price_book`

Cho phÃ©p sá»­a `code`, `name`, `is_default`, `is_active`.

KhÃ´ng cho inactive báº£ng giÃ¡ Ä‘ang lÃ  báº£ng giÃ¡ chung duy nháº¥t cá»§a organization.

### `PUT /price-lists/{id}/items/{product_id}`

Táº¡o hoáº·c cáº­p nháº­t giÃ¡ cá»§a má»™t sáº£n pháº©m trong báº£ng giÃ¡.

**Permission:** `perm.edit_price_book`

**Input:**

```json
{
  "unit_price": 120000
}
```

**Validation:**

- Báº£ng giÃ¡ vÃ  sáº£n pháº©m pháº£i cÃ¹ng organization.
- `unit_price >= 0`.
- Vá»›i sáº£n pháº©m `sell_method = linear_m`, `unit_price` lÃ  giÃ¡ cho `1 m tá»›i`.

### `DELETE /price-lists/{id}/items/{product_id}`

XÃ³a giÃ¡ riÃªng cá»§a má»™t sáº£n pháº©m khá»i báº£ng giÃ¡.

**Permission:** `perm.edit_price_book`

Sau khi xÃ³a, náº¿u báº£ng giÃ¡ nhÃ³m khÃ´ng cÃ²n giÃ¡ cho sáº£n pháº©m, luá»“ng POS fallback vá» báº£ng giÃ¡ chung.

---

## 8. Price resolution

### `POST /pricing/resolve`

Láº¥y giÃ¡ máº·c Ä‘á»‹nh cho má»™t hoáº·c nhiá»u sáº£n pháº©m theo khÃ¡ch hÃ ng hiá»‡n táº¡i.

**Permission:** `perm.create_order`

**Input:**

```json
{
  "customer_id": "uuid",
  "product_ids": ["uuid"]
}
```

`customer_id` Ä‘Æ°á»£c phÃ©p null hoáº·c bá» trá»‘ng.

**Workflow:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Kiá»ƒm tra má»i sáº£n pháº©m tá»“n táº¡i, active vÃ  cÃ¹ng organization.
3. Náº¿u cÃ³ `customer_id`, táº£i khÃ¡ch hÃ ng cÃ¹ng organization.
4. Náº¿u khÃ¡ch cÃ³ nhÃ³m active, láº¥y báº£ng giÃ¡ cá»§a nhÃ³m; náº¿u khÃ´ng, dÃ¹ng báº£ng giÃ¡ chung.
5. Vá»›i má»—i sáº£n pháº©m, tÃ¬m giÃ¡ trong báº£ng giÃ¡ Ä‘Ã£ chá»n.
6. Náº¿u khÃ´ng cÃ³ giÃ¡ trong báº£ng giÃ¡ Ä‘Ã£ chá»n, fallback vá» báº£ng giÃ¡ chung.
7. Tráº£ giÃ¡ vÃ  nguá»“n giÃ¡.

**Response data:**

```json
{
  "items": [
    {
      "product_id": "uuid",
      "unit_price": 120000,
      "price_source": "customer_group",
      "price_list_id": "uuid"
    }
  ]
}
```

`price_source` cÃ³ thá»ƒ lÃ :

- `customer_group`
- `default_price_list`
- `fallback_default_price_list`

---

## 9. Recent customer prices

### `GET /customers/{customer_id}/products/{product_id}/recent-prices`

Äá»c tá»‘i Ä‘a 5 giÃ¡ sá»­a tay gáº§n nháº¥t cho cáº·p khÃ¡ch hÃ ng + sáº£n pháº©m.

**Permission:** `perm.create_order`

**Validation:**

- KhÃ¡ch hÃ ng vÃ  sáº£n pháº©m pháº£i tá»“n táº¡i trong cÃ¹ng organization.

**Response data:**

```json
{
  "items": [
    {
      "unit_price": 115000,
      "sold_at": "2026-06-30T08:00:00Z"
    }
  ]
}
```

API nÃ y chá»‰ Ä‘á»c lá»‹ch sá»­. Viá»‡c ghi lá»‹ch sá»­ giÃ¡ phÃ¡t sinh tá»« order/checkout khi chá»©ng tá»« bÃ¡n hÃ ng Ä‘Æ°á»£c lÆ°u thÃ nh cÃ´ng.

---

## 10. Error Handling

| HTTP | Code | Khi dÃ¹ng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai Ä‘á»‹nh dáº¡ng, thiáº¿u trÆ°á»ng báº¯t buá»™c hoáº·c giÃ¡ trá»‹ ngoÃ i enum |
| 401 | `AUTH_REQUIRED` | Thiáº¿u hoáº·c sai access token |
| 403 | `PERMISSION_DENIED` | Thiáº¿u permission yÃªu cáº§u |
| 403 | `WORKSTATION_INVALID` | Workstation khÃ´ng há»£p lá»‡ |
| 404 | `RESOURCE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y customer/product/price list trong organization |
| 409 | `RESOURCE_CONFLICT` | TrÃ¹ng mÃ£ khÃ¡ch, SÄT, mÃ£ sáº£n pháº©m, mÃ£ nhÃ³m hoáº·c mÃ£ báº£ng giÃ¡ |
| 500 | `INTERNAL_ERROR` | Lá»—i há»‡ thá»‘ng khÃ´ng cÃ´ng khai chi tiáº¿t |

Validation lá»—i cÃ³ thá»ƒ tráº£ thÃªm:

```json
{
  "fields": {
    "phone": "PHONE_ALREADY_EXISTS",
    "code": "CODE_ALREADY_EXISTS"
  }
}
```

---

## 11. Logging vÃ  metric

Backend nÃªn log cÃ¡c thao tÃ¡c ghi quan trá»ng:

- táº¡o/sá»­a khÃ¡ch hÃ ng
- táº¡o/sá»­a nhÃ³m khÃ¡ch
- táº¡o/sá»­a sáº£n pháº©m
- táº¡o/sá»­a báº£ng giÃ¡
- táº¡o/sá»­a/xÃ³a chi tiáº¿t báº£ng giÃ¡

Log khÃ´ng ghi token, secret hoáº·c dá»¯ liá»‡u nháº¡y cáº£m khÃ´ng cáº§n thiáº¿t.

Metric gá»£i Ã½:

- sá»‘ request tÃ¬m sáº£n pháº©m
- sá»‘ request resolve giÃ¡
- sá»‘ lá»—i conflict khi táº¡o khÃ¡ch hoáº·c táº¡o sáº£n pháº©m
- latency cá»§a `/pricing/resolve`

---

â† [Quay vá» POS README](./README.md)
