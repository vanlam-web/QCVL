# INVENTORY-API â€” API tá»“n kho, cuá»™n/táº¥m vÃ  kiá»ƒm kho

> **Base path:** `/api/v1`
> **Business:** [STOCK-RULES.md](../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md), [UNIT-CONVERSION.md](../../03-BUSINESS-NghiepVu/Inventory/UNIT-CONVERSION.md), [STOCKTAKE.md](../../03-BUSINESS-NghiepVu/Inventory/STOCKTAKE.md)
> **Database:** [INVENTORY-TABLES.md](../../04-DATABASE/Inventory/INVENTORY-TABLES.md)

---

## 1. Pháº¡m vi

TÃ i liá»‡u nÃ y lÃ  Source of Truth cho Backend API Inventory MVP:

V1 freeze 2026-07-14:

- V1 UI only exposes stocktake list/detail, product operating stock, stock movement evidence, and manual stock adjustment needed to correct stock.
- V1 may show disabled/dormant entry points for material opening and roll/sheet object inventory, but does not activate those workflows or selling by a selected roll/sheet.
- Backend/API notes for material opening and roll/sheet remain long-term design notes unless explicitly marked as V1-ready.
- V1 acceptance: app runs, core pages open, PostgreSQL stock writers cover import PN, import/created HD, manual adjustment, and product-vs-movement mismatch remains 0.

- Ä‘á»c tá»“n kho theo sáº£n pháº©m
- quáº£n lÃ½ cáº¥u hÃ¬nh tá»“n kho cá»§a sáº£n pháº©m
- quáº£n lÃ½ cuá»™n váº­t lÃ½
- quáº£n lÃ½ táº¥m nguyÃªn/táº¥m dá»Ÿ/táº¥m lá»¡
- khui hÃ ng `normal` cÃ³ quy Ä‘á»•i Ä‘Æ¡n vá»‹/cuá»™n/táº¥m Ä‘á»ƒ chuáº©n hÃ³a tá»“n dáº§n
- xem stock movement
- táº¡o/lÆ°u/cÃ¢n báº±ng/há»§y phiáº¿u kiá»ƒm kho
- sá»­a tá»“n hÃ ng thÆ°á»ng trong trang HÃ ng hÃ³a báº±ng phiáº¿u kiá»ƒm kho tá»± Ä‘á»™ng

KhÃ´ng bao gá»“m:

- checkout trá»« kho tá»« bÃ¡n hÃ ng; xem [ORDER-API.md](../POS/ORDER-API.md)
- dá»¯ liá»‡u mÃ¡y sáº£n xuáº¥t tá»± trá»« kho
- multi-warehouse nÃ¢ng cao
- nháº­p kho mua hÃ ng Ä‘áº§y Ä‘á»§; sáº½ Ä‘áº·c táº£ sau khi nghiá»‡p vá»¥ mua hÃ ng Ä‘Æ°á»£c chá»‘t

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
| Xem tá»“n kho, cuá»™n, táº¥m, stock movement | `perm.create_order` hoáº·c `perm.manage_inventory` |
| Khui váº­t tÆ° tá»« POS/topbar hoáº·c kho | `perm.create_order` hoáº·c `perm.manage_inventory` |
| Táº¡o/sá»­a cuá»™n, táº¥m, táº¥m lá»¡ | `perm.manage_inventory` |
| Táº¡o/lÆ°u/cÃ¢n báº±ng/há»§y kiá»ƒm kho | `perm.manage_inventory` |
| Sá»­a tá»“n trá»±c tiáº¿p trong HÃ ng hÃ³a | `perm.manage_inventory` |

Backend pháº£i scope má»i dá»¯ liá»‡u theo organization cá»§a actor.

Ghi chÃº MVP:

- CÃ¡c permission trong báº£ng trÃªn lÃ  guard ká»¹ thuáº­t á»Ÿ API, khÃ´ng pháº£i ma tráº­n vai trÃ² chi tiáº¿t cho váº­n hÃ nh thÆ°á»ng ngÃ y.
- Preset `NhÃ¢n viÃªn ná»™i bá»™` nÃªn cÃ³ Ä‘á»§ quyá»n xem hÃ ng hÃ³a/kho, kiá»ƒm kho, cuá»™n/táº¥m vÃ  thao tÃ¡c inventory thÆ°á»ng ngÃ y trong MVP.
- Chá»‰ dÃ¹ng tÃ i khoáº£n háº¡n cháº¿ Ä‘áº·c biá»‡t náº¿u tháº­t sá»± cáº§n áº©n thao tÃ¡c kho khá»i má»™t ngÆ°á»i dÃ¹ng cá»¥ thá»ƒ.
- KhÃ´ng thÃªm approval nhiá»u bÆ°á»›c cho kiá»ƒm kho/Ä‘iá»u chá»‰nh tá»“n trong MVP; thay Ä‘á»•i pháº£i cÃ³ chá»©ng tá»«, audit vÃ  lá»‹ch sá»­ stock movement.

---

## 3. Inventory summary

### `GET /inventory/products`

TÃ¬m sáº£n pháº©m kÃ¨m thÃ´ng tin tá»“n kho tá»•ng há»£p.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `search` | `string` | Không | Tìm bỏ dấu theo mã, tên sản phẩm và đơn vị tồn; alias `q` được chấp nhận cho UI cũ |
| `status` | `string` | KhÃ´ng | `active`, `inactive`, `all`; máº·c Ä‘á»‹nh `active` náº¿u gá»i tá»« POS, `all` náº¿u gá»i tá»« trang Kho |
| `inventory_shape` | `string` | KhÃ´ng | `normal`, `roll`, `sheet` |
| `negative_only` | `boolean` | KhÃ´ng | Chá»‰ láº¥y máº·t hÃ ng tá»“n Ã¢m |
| `page` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `1` |
| `page_size` | `number` | KhÃ´ng | Máº·c Ä‘á»‹nh `20`, tá»‘i Ä‘a `100` |

**Validation:**

- Náº¿u actor chá»‰ cÃ³ `perm.create_order`, Backend khÃ´ng tráº£ sáº£n pháº©m `inactive`.
- `page >= 1`.
- `1 <= page_size <= 100`.

**Workflow:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Táº£i product + `product_inventory_settings`.
3. TÃ­nh tá»“n:
   - `normal`: tá»« tá»•ng stock movement hoáº·c snapshot tá»“n hiá»‡n hÃ nh náº¿u implementation cÃ³ cache.
   - `roll`: tá»•ng tá»« `inventory_rolls.remaining_area_m2` hoáº·c Ä‘Æ¡n vá»‹ tá»“n chÃ­nh tÆ°Æ¡ng á»©ng.
   - `sheet`: tá»•ng tá»« `inventory_sheets.area_m2` cÃ²n `available`.
4. Tráº£ danh sÃ¡ch kÃ¨m cáº£nh bÃ¡o tá»“n Ã¢m náº¿u cÃ³.

**Catalog product-list import metadata:** `GET /api/v1/products` (màn Hàng hóa) phải trả thêm các trường rà soát import khi có dữ liệu:

- `kiotviet_provisional_stock`: tồn tạm từ `inventory_provisional_balances`, lấy từ export Hàng hóa KiotViet.
- `latest_kiotviet_stocktake`: phiếu kiểm kho KiotViet gần nhất từ `stocktakes`/`stocktake_items`, chỉ dùng làm bằng chứng đối soát.
- `draft_bom`: tên field giữ cũ. **SoT (Owner 2026-07-20):** nghĩa = BOM đang dùng (thường `active`), không UI “nháp chờ duyệt”. **Runtime 2026-07-20:** vẫn chỉ trả `status = draft` — lệch SoT; xem `docs/03-BUSINESS-NghiepVu/BOM/README.md` mục 2.

`latest_kiotviet_stocktake.actual_qty` không được dùng để cập nhật `inventory_provisional_balances`, tồn vận hành, hoặc tạo `stock_movements`.

**Response data:**

```json
{
  "items": [
    {
      "product_id": "uuid",
      "code": "BAT-HIFLEX-32",
      "name": "Báº¡t Hiflex 3.2m",
      "status": "active",
      "inventory_shape": "roll",
      "stock_unit": "m2",
      "available_qty": 125.5,
      "is_negative": false
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `GET /inventory/products/{product_id}`

Äá»c chi tiáº¿t cáº¥u hÃ¬nh vÃ  tá»“n kho cá»§a má»™t sáº£n pháº©m.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

Response pháº£i cho biáº¿t:

- cáº¥u hÃ¬nh `product_inventory_settings`
- Ä‘Æ¡n vá»‹ tá»“n chÃ­nh
- tá»•ng tá»“n hiá»‡n táº¡i
- náº¿u `roll`: danh sÃ¡ch cuá»™n cÃ²n dÃ¹ng
- náº¿u `sheet`: danh sÃ¡ch táº¥m/táº¥m lá»¡ cÃ²n dÃ¹ng
- 10 stock movement gáº§n nháº¥t

---

## 4. Product inventory settings

### `PUT /inventory/products/{product_id}/settings`

Cáº­p nháº­t cáº¥u hÃ¬nh tá»“n kho cá»§a sáº£n pháº©m.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "track_inventory": true,
  "inventory_shape": "roll",
  "stock_unit_id": "uuid",
  "default_allow_negative": true,
  "roll_default_margin_width_m": 0.1,
  "roll_default_margin_length_m": 0.1,
  "roll_allow_rotate": true,
  "sheet_width_m": null,
  "sheet_length_m": null,
  "sheet_default_cut_margin_m": null,
  "sheet_remnant_min_area_m2": 0.3
}
```

**Validation:**

- Product pháº£i cÃ¹ng organization.
- `inventory_shape IN ('normal', 'roll', 'sheet')`.
- `stock_unit_id` pháº£i cÃ¹ng organization vÃ  active.
- KhÃ´ng cho Ä‘á»•i `inventory_shape` náº¿u Ä‘Ã£ cÃ³ cuá»™n/táº¥m/stock movement phÃ¡t sinh, trá»« khi cÃ³ migration nghiá»‡p vá»¥ riÃªng.
- Vá»›i `roll`, biÃªn chá»«a náº¿u cÃ³ pháº£i `>= 0`.
- Vá»›i `sheet`, kÃ­ch thÆ°á»›c táº¥m gá»‘c náº¿u nháº­p pháº£i `> 0`, ngÆ°á»¡ng táº¥m lá»¡ máº·c Ä‘á»‹nh `0.3m2`.

**Workflow:**

1. Validate input.
2. Upsert `product_inventory_settings`.
3. Tráº£ cáº¥u hÃ¬nh má»›i.

---

## 5. Roll inventory

### `GET /inventory/rolls`

TÃ¬m cuá»™n váº­t lÃ½.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Query:** `product_id`, `status`, `width_m`, `page`, `page_size`.

Náº¿u gá»i tá»« POS/checkout, Backend chá»‰ tráº£ cuá»™n `available` hoáº·c `in_use`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "code": "ROLL-001",
      "width_m": 3.2,
      "initial_length_m": 50,
      "remaining_length_m": 18,
      "initial_area_m2": 160,
      "remaining_area_m2": 57.6,
      "status": "in_use",
      "note": "Cuá»™n Ä‘ang dÃ¹ng",
      "created_at": "2026-07-07T08:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

### `POST /inventory/rolls`

Táº¡o cuá»™n váº­t lÃ½ khi nháº­p hoáº·c khai bÃ¡o tá»“n ban Ä‘áº§u.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "code": "ROLL-001",
  "width_m": 3.2,
  "initial_length_m": 50,
  "remaining_length_m": 50,
  "note": "Tá»“n Ä‘áº§u ká»³"
}
```

**Validation:**

- Product pháº£i cÃ³ `inventory_shape = roll`.
- `width_m > 0`, `initial_length_m >= 0`, `remaining_length_m >= 0`.
- `code` khÃ´ng trÃ¹ng trong cÃ¹ng product/organization.
- `remaining_area_m2 = width_m * remaining_length_m` do Backend tÃ­nh.

**Workflow:**

1. Táº¡o `inventory_rolls`.
2. Náº¿u Ä‘Ã¢y lÃ  khai bÃ¡o tá»“n ban Ä‘áº§u hoáº·c Ä‘iá»u chá»‰nh tá»“n, táº¡o `stock_movements` loáº¡i `manual_adjustment` cÃ³ lÃ½ do.
3. Tráº£ cuá»™n vá»«a táº¡o.

### `PATCH /inventory/rolls/{id}`

Sá»­a thÃ´ng tin/cuá»™n cÃ²n láº¡i.

**Permission:** `perm.manage_inventory`

Backend khÃ´ng Ä‘Æ°á»£c sá»­a Ã¢m tháº§m tá»“n cuá»™n. Náº¿u `remaining_length_m` hoáº·c `remaining_area_m2` thay Ä‘á»•i, pháº£i táº¡o `stock_movements` loáº¡i `manual_adjustment` kÃ¨m `reason`.

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** endpoint nháº­n `remaining_length_m`, `status`, `reason`. Backend tÃ­nh láº¡i `remaining_area_m2 = width_m * remaining_length_m`. Náº¿u diá»‡n tÃ­ch thay Ä‘á»•i, ghi `stock_movements.manual_adjustment` theo object `roll`; náº¿u delta báº±ng `0`, khÃ´ng ghi movement vÃ¬ DB khÃ´ng cho movement sá»‘ lÆ°á»£ng `0`.

### `POST /inventory/rolls/suggest`

Äá» xuáº¥t cuá»™n/khá»• cho má»™t dÃ²ng cáº§n xuáº¥t váº­t tÆ° cuá»™n.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "required_width_m": 2.5,
  "required_length_m": 2.05,
  "margin_width_m": 0.1,
  "margin_length_m": 0.1,
  "allow_rotate": true
}
```

**Workflow:**

1. TÃ­nh kÃ­ch thÆ°á»›c tiÃªu hao sau biÃªn chá»«a.
2. Lá»c cuá»™n Ä‘á»§ khá»• vÃ  Ä‘á»§ chiá»u dÃ i.
3. Æ¯u tiÃªn hao há»¥t ngang Ã­t nháº¥t.
4. Æ¯u tiÃªn cuá»™n Ä‘ang dÃ¹ng dá»Ÿ.
5. Tráº£ danh sÃ¡ch Ä‘á» xuáº¥t cÃ³ Ä‘iá»ƒm Æ°u tiÃªn vÃ  snapshot cÃ´ng thá»©c.

Endpoint nÃ y chá»‰ Ä‘á» xuáº¥t, khÃ´ng trá»« kho.

---

## 6. Sheet inventory

### `GET /inventory/sheets`

TÃ¬m táº¥m nguyÃªn/táº¥m dá»Ÿ/táº¥m lá»¡.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Query:** `product_id`, `sheet_kind`, `status`, `min_width_m`, `min_length_m`, `page`, `page_size`.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "code": "SHEET-001",
      "sheet_kind": "full",
      "width_m": 1.22,
      "length_m": 2.44,
      "area_m2": 2.977,
      "status": "available",
      "note": "Táº¥m nguyÃªn",
      "created_at": "2026-07-07T08:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

### `POST /inventory/sheets`

Táº¡o táº¥m/táº¥m lá»¡ thá»§ cÃ´ng.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "code": "SHEET-001",
  "sheet_kind": "full",
  "width_m": 1.22,
  "length_m": 2.44,
  "status": "available",
  "note": "Tá»“n Ä‘áº§u ká»³"
}
```

**Validation:**

- Product pháº£i cÃ³ `inventory_shape = sheet`.
- `width_m > 0`, `length_m > 0`.
- `area_m2 = width_m * length_m` do Backend tÃ­nh.
- `code` khÃ´ng trÃ¹ng trong cÃ¹ng product/organization.

**Workflow:**

1. Táº¡o `inventory_sheets`.
2. Náº¿u Ä‘Ã¢y lÃ  khai bÃ¡o tá»“n ban Ä‘áº§u hoáº·c Ä‘iá»u chá»‰nh tá»“n, táº¡o `stock_movements` loáº¡i `manual_adjustment` cÃ³ lÃ½ do.
3. Tráº£ táº¥m/táº¥m lá»¡ vá»«a táº¡o.

### `PATCH /inventory/sheets/{id}`

Sá»­a hoáº·c Ä‘á»•i tráº¡ng thÃ¡i táº¥m/táº¥m lá»¡.

**Permission:** `perm.manage_inventory`

**Validation vÃ  workflow:**

- Cho phÃ©p sá»­a kÃ­ch thÆ°á»›c, tráº¡ng thÃ¡i, ghi chÃº.
- Náº¿u sá»­a kÃ­ch thÆ°á»›c/diá»‡n tÃ­ch hoáº·c Ä‘á»•i `discarded`, Backend pháº£i táº¡o `stock_movements` loáº¡i `manual_adjustment` hoáº·c `remnant_discarded`.
- Má»i thao tÃ¡c sá»­a/xÃ³a táº¥m lá»¡ pháº£i ghi log nghiá»‡p vá»¥ tá»‘i thiá»ƒu qua stock movement hoáº·c audit log hiá»‡n hÃ nh.

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** endpoint nháº­n `width_m`, `length_m`, `status`, `reason`. Backend tÃ­nh láº¡i `area_m2 = width_m * length_m`. Náº¿u diá»‡n tÃ­ch thay Ä‘á»•i, ghi `stock_movements.manual_adjustment` theo object `sheet`; náº¿u delta báº±ng `0`, khÃ´ng ghi movement.

### `POST /inventory/sheets/suggest`

Äá» xuáº¥t táº¥m/táº¥m lá»¡ phÃ¹ há»£p cho má»™t kÃ­ch thÆ°á»›c cáº§n dÃ¹ng.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Input:**

```json
{
  "product_id": "uuid",
  "required_width_m": 1.0,
  "required_length_m": 1.22,
  "cut_margin_m": 0.01
}
```

**Workflow:**

1. Æ¯u tiÃªn táº¥m lá»¡ phÃ¹ há»£p nhá» nháº¥t.
2. Náº¿u khÃ´ng cÃ³ táº¥m lá»¡ phÃ¹ há»£p, chá»n táº¥m nguyÃªn hoáº·c táº¥m dá»Ÿ phÃ¹ há»£p.
3. TÃ­nh pháº§n cÃ²n láº¡i.
4. Náº¿u pháº§n cÃ²n láº¡i dÆ°á»›i `sheet_remnant_min_area_m2` máº·c Ä‘á»‹nh `0.3`, Ä‘Ã¡nh dáº¥u sáº½ bá».
5. Tráº£ Ä‘á» xuáº¥t vÃ  pháº§n táº¥m lá»¡ dá»± kiáº¿n náº¿u cÃ³.

Endpoint nÃ y chá»‰ Ä‘á» xuáº¥t, khÃ´ng trá»« kho.

---

## 7. Material opening / Khui váº­t tÆ°

### `GET /inventory/material-openings/options`

Äá»c dá»¯ liá»‡u gá»£i Ã½ Ä‘á»ƒ má»Ÿ popup khui váº­t tÆ° cho má»™t sáº£n pháº©m.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `product_id` | `uuid` | CÃ³ | Sáº£n pháº©m/váº­t tÆ° cáº§n khui |

**Workflow:**

1. XÃ¡c thá»±c actor, workstation vÃ  permission.
2. Táº£i product + `product_inventory_settings`.
3. Náº¿u `normal`, tráº£ cáº¥u hÃ¬nh Ä‘Æ¡n vá»‹ tá»“n vÃ  danh sÃ¡ch quy Ä‘á»•i Ä‘Æ¡n vá»‹ tá»« `product_unit_conversions`, gá»“m Ä‘Æ¡n vá»‹, há»‡ sá»‘ quy Ä‘á»•i vá» tá»“n chÃ­nh, cá» máº·c Ä‘á»‹nh khi mua vÃ  cá» máº·c Ä‘á»‹nh khi bÃ¡n.
4. Náº¿u `roll`, tráº£ danh sÃ¡ch khá»• kháº£ dá»¥ng tá»« `inventory_rolls` vÃ  tá»“n táº¡m KiotViet náº¿u cÃ³.
5. Náº¿u `sheet`, tráº£ khá»• thao tÃ¡c tá»« settings vÃ  táº¥m/táº¥m dá»Ÿ/táº¥m lá»¡ liÃªn quan náº¿u cÃ³.
6. KhÃ´ng tá»± táº¡o object, khÃ´ng trá»« tá»“n.

**Response data:**

```json
{
  "product": {
    "id": "uuid",
    "code": "BAT-HIFLEX-32",
    "name": "Báº¡t Hiflex 3.2m",
    "inventory_shape": "roll",
    "stock_unit": "m2"
  },
  "provisional_balance": {
    "id": "uuid",
    "source_type": "kiotviet_import",
    "remaining_qty": 128,
    "stock_unit": "m2"
  },
  "roll_options": [
    {
      "width_m": 3.2,
      "available_roll_count": 2,
      "suggested_old_roll_id": "uuid",
      "suggested_old_remaining_length_m": 18
    }
  ],
  "sheet_options": [],
  "warnings": ["PROVISIONAL_SOURCE"]
}
```

### `POST /inventory/material-openings`

Ghi nháº­n má»™t láº§n khui váº­t tÆ°.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

Endpoint nÃ y xá»­ lÃ½ cáº£ `normal`, `roll`, `sheet` theo `inventory_shape` cá»§a product.

KhÃ´ng nháº­n cÃ¡c trÆ°á»ng:

- nhÃ  cung cáº¥p
- lÃ´/ngÃ y mua
- giÃ¡ vá»‘n
- thÃ´ng tin bÃ¡o cÃ¡o hao há»¥t nÃ¢ng cao

#### Input cho `normal`

```json
{
  "product_id": "uuid",
  "inventory_shape": "normal",
  "opened_unit_id": "uuid",
  "opened_qty": 1,
  "old_remaining_qty": 0,
  "note": "Khui keo má»›i, pháº§n cÅ© khÃ´ bá»"
}
```

Quy táº¯c:

- Product pháº£i cÃ³ `inventory_shape = normal`.
- Product pháº£i cÃ³ cáº¥u hÃ¬nh quy Ä‘á»•i Ä‘Æ¡n vá»‹ phÃ¹ há»£p Ä‘á»ƒ khui; náº¿u khÃ´ng cÃ³ quy Ä‘á»•i, tráº£ validation error Ä‘á»ƒ trÃ¡nh hiá»‡n nháº§m hÃ ng khÃ´ng cáº§n khui.
- `opened_unit_id` lÃ  Ä‘Æ¡n vá»‹ lá»›n/Ä‘Æ¡n vá»‹ nháº­p khui, vÃ­ dá»¥ ram, bao, cuá»™n; backend quy Ä‘á»•i vá» Ä‘Æ¡n vá»‹ tá»“n chÃ­nh theo `product_unit_conversions`.
- `opened_qty > 0`.
- `old_remaining_qty >= 0`, MVP máº·c Ä‘á»‹nh `0`.
- KhÃ´ng táº¡o `inventory_rolls` hoáº·c `inventory_sheets`.
- Táº¡o `inventory_material_openings`.
- Táº¡o `stock_movements` loáº¡i `material_opening` chá»‰ khi cÃ³ thay Ä‘á»•i tá»“n chÃ­nh thá»©c cáº§n ghi nháº­n.
- KhÃ´ng táº¡o `stocktakes`; khui váº­t tÆ° khÃ´ng pháº£i phiáº¿u kiá»ƒm kho.
- Náº¿u `old_remaining_qty = 0` vÃ  há»‡ thá»‘ng Ä‘ang cÃ³ pháº§n dá»Ÿ/cÅ© cÃ²n sá»‘ lÆ°á»£ng, backend ghi movement Ã¢m Ä‘á»ƒ Ä‘Æ°a pháº§n cÅ© vá» `0` trÆ°á»›c khi cá»™ng pháº§n khui má»›i.
- Náº¿u tá»“n thiáº¿u/Ã¢m, tráº£ warning nháº¹, khÃ´ng cháº·n náº¿u actor cÃ³ quyá»n.

#### Input cho `roll`

**Trạng thái triển khai hiện tại:** payload roll đang xử lý phần cuộn cũ đã chuẩn hóa. Backend cập nhật `inventory_rolls.remaining_length_m`, đổi trạng thái `empty` nếu còn lại `0`, ghi `inventory_material_openings` và `stock_movements.material_opening` cho phần chênh lệch diện tích. Luồng tạo/khui cuộn mới phải đi từ chứng từ vận hành QCVL hoặc thao tác kho có truy vết; tồn tạm KiotViet chỉ là dữ liệu đối chiếu, không phải nguồn sinh tồn chính thức.

```json
{
  "product_id": "uuid",
  "inventory_shape": "roll",
  "old_inventory_roll_id": "uuid",
  "old_remaining_length_m": 0,
  "note": "Khui cuá»™n má»›i"
}
```

Quy táº¯c:

- Product pháº£i cÃ³ `inventory_shape = roll`.
- `old_inventory_roll_id` pháº£i thuá»™c cÃ¹ng product/organization.
- `old_remaining_length_m >= 0`.
- KhÃ´ng báº¯t chá»n lÃ´/ngÃ y mua/nhÃ  cung cáº¥p.
- Náº¿u `old_remaining_length_m = 0`, cuá»™n cÅ© chuyá»ƒn `empty`; khÃ´ng táº¡o object rÃ¡c.
- Náº¿u `old_remaining_length_m > 0`, giá»¯/cáº­p nháº­t cuá»™n cÅ© thÃ nh `in_use`.
- ChÃªnh lá»‡ch cÅ©/má»›i ghi vÃ o `inventory_material_openings.old_snapshot`, `input_payload`, `result_payload`.
- Stock movement dÃ¹ng `movement_type = material_opening` cho pháº§n tá»“n chÃ­nh thá»©c thay Ä‘á»•i.
- KhÃ´ng táº¡o `stocktakes`; náº¿u cáº§n cÃ¢n báº±ng láº¡i nhiá»u cuá»™n sau khi kiá»ƒm thá»±c táº¿ thÃ¬ dÃ¹ng endpoint stocktake riÃªng.
- Phase sau sáº½ bá»• sung payload khui cuá»™n má»›i tá»« object `available` hoáº·c tá»“n táº¡m KiotViet.

#### Input cho `sheet`

**Trạng thái triển khai hiện tại:** payload sheet đang xử lý phần tấm cũ đã chuẩn hóa. Backend cập nhật `inventory_sheets`: nếu bỏ thì chuyển `discarded`, nếu giữ thì cập nhật rộng/dài/diện tích còn lại. Backend ghi `inventory_material_openings` và `stock_movements.material_opening` cho phần chênh lệch diện tích. Luồng tạo tấm mới phải đi từ chứng từ vận hành QCVL hoặc thao tác kho có truy vết; tồn tạm KiotViet chỉ là dữ liệu đối chiếu, không phải nguồn sinh tồn chính thức.

```json
{
  "product_id": "uuid",
  "inventory_shape": "sheet",
  "old_inventory_sheet_id": "uuid",
  "old_remaining_width_m": 1.2,
  "old_remaining_length_m": 0.35,
  "note": "Khui táº¥m má»›i, giá»¯ pháº§n cÅ©"
}
```

Hoáº·c bá» pháº§n táº¥m cÅ©:

```json
{
  "product_id": "uuid",
  "inventory_shape": "sheet",
  "old_inventory_sheet_id": "uuid",
  "discard_old_sheet": true,
  "note": "Bá» pháº§n táº¥m cÅ©"
}
```

Quy táº¯c:

- Product pháº£i cÃ³ `inventory_shape = sheet`.
- Khá»• thao tÃ¡c dÃ¹ng giÃ¡ trá»‹ Ä‘Æ¡n giáº£n nhÆ° `1.2m x 2.4m`.
- `old_inventory_sheet_id` pháº£i thuá»™c cÃ¹ng product/organization.
- Náº¿u `discard_old_sheet = true`, khÃ´ng cáº§n gá»­i kÃ­ch thÆ°á»›c cÃ²n láº¡i.
- Náº¿u khÃ´ng bá», `old_remaining_width_m > 0` vÃ  `old_remaining_length_m > 0`.
- Náº¿u giá»¯ láº¡i pháº§n cÅ©, cáº­p nháº­t táº¥m cÅ© vá»›i diá»‡n tÃ­ch cÃ²n láº¡i.
- Náº¿u bá» pháº§n cÅ©, chuyá»ƒn táº¥m cÅ© sang `discarded`; khÃ´ng táº¡o object rÃ¡c.
- NgÆ°á»¡ng ráº»o nhá» hoáº·c pháº§n mÃ©t tá»›i dÆ°á»›i `0.2m` hiá»‡n má»›i lÃ  rule UX/spec, chÆ°a enforce trong API.
- KhÃ´ng tÃ­nh giÃ¡ vá»‘n hoáº·c bÃ¡o cÃ¡o hao há»¥t nÃ¢ng cao trong endpoint nÃ y.

#### Response data

```json
{
  "id": "uuid",
  "product_id": "uuid",
  "inventory_shape": "roll",
  "source_type": "kiotviet_provisional",
  "warnings": ["PROVISIONAL_SOURCE", "LOW_STOCK"],
  "created_rolls": [
    {
      "id": "uuid",
      "code": "KHUI-000001-R001",
      "width_m": 3.2,
      "remaining_length_m": 50,
      "remaining_area_m2": 160,
      "status": "in_use"
    }
  ],
  "updated_rolls": [],
  "created_sheets": [],
  "updated_sheets": [],
  "stock_movements": [
    {
      "id": "uuid",
      "movement_type": "material_opening",
      "quantity_delta": 160
    }
  ]
}
```

### `GET /inventory/material-openings`

Tra cá»©u lá»‹ch sá»­ khui váº­t tÆ°.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

**Query:** `product_id`, `inventory_shape`, `source_type`, `from`, `to`, `page`, `page_size`.

### `GET /inventory/material-openings/{id}`

Chi tiáº¿t má»™t láº§n khui váº­t tÆ°, gá»“m input/result snapshot vÃ  stock movements liÃªn quan.

**Permission:** `perm.create_order` hoáº·c `perm.manage_inventory`

---

## 8. Stock movements

### `GET /inventory/stock-movements`

Tra cá»©u sá»• kho chÃ­nh thá»©c.

**Permission:** `perm.manage_inventory`

**Query:**

| Tham sá»‘ | Kiá»ƒu | Báº¯t buá»™c | MÃ´ táº£ |
|---|---|---|---|
| `product_id` | `uuid` | KhÃ´ng | Lá»c theo sáº£n pháº©m |
| `movement_type` | `string` | KhÃ´ng | `sale_deduction`, `invoice_reversal`, `invoice_revision`, `stocktake_adjustment`, `manual_adjustment`, `remnant_created`, `remnant_discarded`, `purchase_receipt`, `material_opening` |
| `order_id` | `uuid` | KhÃ´ng | Lá»c theo Ä‘Æ¡n |
| `stocktake_id` | `uuid` | KhÃ´ng | Lá»c theo phiáº¿u kiá»ƒm kho |
| `from` / `to` | `datetime` | KhÃ´ng | Khoáº£ng thá»i gian |
| `page` / `page_size` | `number` | KhÃ´ng | PhÃ¢n trang |

Backend chá»‰ cho Ä‘á»c. Táº¡o stock movement pháº£i Ä‘i qua use case nghiá»‡p vá»¥ tÆ°Æ¡ng á»©ng: checkout, kiá»ƒm kho, sá»­a cuá»™n/táº¥m hoáº·c Ä‘iá»u chá»‰nh thá»§ cÃ´ng cÃ³ lÃ½ do.

**Response MVP:**

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "movement_type": "sale_deduction",
      "quantity_delta": -1.656,
      "created_at": "2026-07-07T05:30:00Z",
      "document_code": "HD011036",
      "document_type": "sale_invoice",
      "transaction_price": 300000,
      "cost_price": 107751.2,
      "ending_qty": 18.344,
      "partner_name": "KhÃ¡ch láº»"
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

Tab `Tháº» kho` trong chi tiáº¿t hÃ ng hÃ³a dÃ¹ng response nÃ y Ä‘á»ƒ hiá»‡n báº£ng kiá»ƒu KiotViet. Backend hydrate:

- `document_code`: `orders.code`, `purchase_receipts.code` hoáº·c `stocktakes.code`.
- `document_type`: `sale_invoice`, `purchase_receipt`, `stocktake`, `manual`, `material_opening`.
- `transaction_price`: bÃ¡n láº¥y `order_items.unit_price`, mua láº¥y `purchase_receipt_items.unit_cost`.
- `cost_price`: Æ°u tiÃªn `products.latest_purchase_cost`, fallback `purchase_receipt_items.unit_cost`.
- `partner_name`: bÃ¡n láº¥y khÃ¡ch tá»« `orders.customer_snapshot`, mua láº¥y `suppliers.name`.

API chÆ°a tráº£ `balance_after`, nÃªn `Tá»“n cuá»‘i` trong UI váº«n hiá»‡n `ChÆ°a cÃ³`. Khi cáº§n Ä‘Ãºng nhÆ° KiotViet, nÃªn lÆ°u snapshot tá»“n sau má»—i stock movement hoáº·c bá»• sung query tÃ­nh running balance á»•n Ä‘á»‹nh á»Ÿ backend.

---

PostgreSQL current note 2026-07-14:

- `stock_movements` is the read source for `GET /inventory/stock-movements`.
- `GET /products` hydrates `operating_stock` from the latest movement of each product.
- `ending_qty` is returned when a movement stores the balance after the transaction. If it is null, UI shows `Chua co`.
- PostgreSQL now writes `stock_movements` for imported KiotViet purchase receipts (`purchase_receipt`) and invoices (`sale_invoice`). Re-import deletes old movements for the same document, inserts the new rows, then recomputes `ending_qty` for affected products.
- PostgreSQL `saveSalesDocument` writes `sale_deduction` movements for completed POS invoices and removes invoice movements when the saved document is not a completed invoice.
- PostgreSQL manual stock adjustment (`POST/PATCH /inventory/products/{id}/adjust-stock`) creates a balanced QCVL stocktake, one stocktake item, and one `stocktake_balance` movement. Delta is `actual_qty - latest ending_qty`, then affected product balances are recomputed.
- PostgreSQL normal material opening writes `inventory_material_openings` and one `material_opening` movement. Delta is `opened_qty * conversion_factor - old_remaining_qty`, then affected product balances are recomputed.
- Remaining movement writers: roll/sheet material opening after inventory object tables exist, and any future opening checkpoint flow that is separate from manual stock adjustment.

## 9. Stocktake

### `POST /inventory/stocktakes`

Táº¡o phiáº¿u kiá»ƒm kho thá»§ cÃ´ng.

**Permission:** `perm.manage_inventory`

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** endpoint Ä‘Ã£ má»Ÿ route nhÆ°ng tráº£ `VALIDATION_ERROR` vá»›i thÃ´ng Ä‘iá»‡p `Manual stocktake mutations are not implemented yet.`. KhÃ´ng tráº£ fake success. Luá»“ng sá»­a tá»“n hÃ ng thÆ°á»ng Ä‘ang dÃ¹ng endpoint riÃªng `POST /inventory/products/{product_id}/adjust-stock` Ä‘á»ƒ tá»± sinh phiáº¿u `balanced`.

**Input:**

```json
{
  "note": "Kiá»ƒm kho cuá»‘i thÃ¡ng",
  "items": [
    {
      "product_id": "uuid",
      "actual_qty": 10,
      "inventory_object_type": null,
      "inventory_roll_id": null,
      "inventory_sheet_id": null,
      "note": ""
    }
  ],
  "save_mode": "draft"
}
```

`save_mode` lÃ  `draft` hoáº·c `balance_now`.

**Validation:**

- CÃ³ Ã­t nháº¥t má»™t dÃ²ng.
- Product pháº£i cÃ¹ng organization.
- Backend tá»± láº¥y `system_qty` táº¡i thá»i Ä‘iá»ƒm táº¡o/cÃ¢n báº±ng.
- HÃ ng `normal`: khÃ´ng nháº­n `inventory_roll_id`/`inventory_sheet_id`.
- HÃ ng `roll`: báº¯t buá»™c `inventory_roll_id`.
- HÃ ng `sheet`: báº¯t buá»™c `inventory_sheet_id`.

**Workflow:**

1. Sinh mÃ£ `KK...`.
2. TÃ­nh `system_qty` vÃ  `difference_qty`.
3. Táº¡o `stocktakes` + `stocktake_items`.
4. Náº¿u `save_mode = draft`, lÆ°u `status = draft`, khÃ´ng Ä‘á»•i tá»“n.
5. Náº¿u `save_mode = balance_now`, táº¡o `stock_movements` loáº¡i `stocktake_adjustment`, cáº­p nháº­t Ä‘á»‘i tÆ°á»£ng tá»“n tÆ°Æ¡ng á»©ng, Ä‘á»•i phiáº¿u sang `balanced`.

### `PUT /inventory/stocktakes/{id}`

Cáº­p nháº­t phiáº¿u kiá»ƒm kho `draft`.

**Permission:** `perm.manage_inventory`

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** route Ä‘Ã£ má»Ÿ nhÆ°ng tráº£ `VALIDATION_ERROR`; chÆ°a sá»­a phiáº¿u thá»§ cÃ´ng.

Chá»‰ cho sá»­a phiáº¿u `status = draft`. Khi cáº­p nháº­t, Backend tÃ­nh láº¡i `system_qty` hoáº·c giá»¯ snapshot cÅ© theo thá»i Ä‘iá»ƒm táº¡o tÃ¹y implementation, nhÆ°ng pháº£i nháº¥t quÃ¡n trong response.

### `POST /inventory/stocktakes/{id}/balance`

CÃ¢n báº±ng kho cho phiáº¿u `draft`.

**Permission:** `perm.manage_inventory`

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** route Ä‘Ã£ má»Ÿ nhÆ°ng tráº£ `VALIDATION_ERROR`; chÆ°a cÃ¢n báº±ng phiáº¿u thá»§ cÃ´ng.

Workflow:

1. Lock phiáº¿u kiá»ƒm kho.
2. Kiá»ƒm tra phiáº¿u cÃ²n `draft`.
3. Vá»›i tá»«ng dÃ²ng cÃ³ `difference_qty != 0`, táº¡o `stock_movements` loáº¡i `stocktake_adjustment`.
4. Cáº­p nháº­t tá»“n/tá»«ng cuá»™n/tá»«ng táº¥m theo sá»‘ thá»±c táº¿.
5. Äá»•i phiáº¿u sang `balanced`, set `balanced_at`.

### Hủy phiếu kiểm kho

Hủy phiếu kiểm kho hiện dùng `PATCH /inventory/stocktakes/{id}` với body:

```json
{
  "status": "cancelled"
}
```

**Permission:** `perm.manage_inventory`

**Trạng thái triển khai hiện tại:** đã hoạt động.

API đổi `stocktakes.status` sang `cancelled`, giữ nguyên dòng kiểm kho, không ghi hoặc đảo `stock_movements`. Nếu sau này cần đảo tồn của phiếu đã cân bằng, phải có spec riêng.

### `GET /inventory/stocktakes`

Danh sÃ¡ch phiáº¿u kiá»ƒm kho.

**Permission:** `perm.manage_inventory`

Query: `search`, `status`, `created_by`, `from`, `to`, `page`, `page_size`.

`search` tìm theo mã phiếu kiểm kho, ghi chú phiếu, mã hàng và tên hàng trong dòng kiểm kho. Với dòng import KV, backend ưu tiên `stocktake_items.source_product_code/source_product_name`; nếu dòng đã khớp hàng hóa QCVL thì cũng tìm được theo `products.code/products.name`.

Mỗi item list trả thêm `product_code`, `product_name`, `product_system_qty`, `product_actual_qty`, `product_difference_qty` đại diện cho dòng kiểm kho đầu tiên của phiếu, ưu tiên dữ liệu nguồn KiotViet rồi fallback sang hàng hóa QCVL đã khớp. UI dùng các trường này làm cột `Mã hàng`, `Tên hàng`, `Tồn trước`, `Kiểm được`, `Lệch` trên bảng chính; không dùng `Người tạo`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Tổng thực tế`, `Tổng chênh lệch` làm cột chính nữa.

Response list có thêm `creator_options`: danh sách tài khoản QCVL đã tạo phiếu trong tập kết quả theo `search/status/from/to`, nhưng không bị thu hẹp bởi `created_by` hiện tại. UI dùng danh sách này cho bộ lọc `Người tạo` để không bị mất option khi đang lọc hoặc phân trang.

**Response data:**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "KK000333",
      "status": "balanced",
      "source_type": "product_edit",
      "created_at": "2026-07-07T08:00:00Z",
      "balanced_at": "2026-07-07T08:00:00Z",
      "product_code": "F8",
      "product_name": "Fomex 8mm",
      "product_system_qty": 0.005,
      "product_actual_qty": 1.5,
      "product_difference_qty": 1.495,
      "total_actual_qty": 10,
      "total_actual_value": 100000,
      "total_difference_value": -5000,
      "increased_qty": 2,
      "decreased_qty": 3,
      "note": "Phiáº¿u kiá»ƒm kho Ä‘Æ°á»£c táº¡o tá»± Ä‘á»™ng khi cáº­p nháº­t HÃ ng hÃ³a...",
      "source_creator_name": "0947900909",
      "created_by": {
        "id": "user-uuid",
        "name": "Văn Lâm"
      }
    }
  ],
  "page": 1,
  "page_size": 15,
  "total": 1
}
```

CÃ¡c trÆ°á»ng giÃ¡ trá»‹ tá»•ng há»£p Ä‘Æ°á»£c hydrate tá»« `stocktake_items` vÃ  `products.latest_purchase_cost`. Náº¿u thiáº¿u giÃ¡ vá»‘n Ä‘á»ƒ tÃ­nh tiá»n, Backend tráº£ `null` cho `total_actual_value` hoáº·c `total_difference_value`; UI hiá»ƒn thá»‹ `ChÆ°a cÃ³`.

Creator fields:

- `source_creator_name` lưu raw `Người tạo` từ file KiotViet nếu file có cột này. Đây là dữ liệu audit/mapping, không phải nguồn người tạo thứ hai trong UI.
- `created_by` là tài khoản QCVL đã map. Backend chỉ map `source_creator_name` sang QCVL user khi giá trị đó khớp `users.username` sau khi bỏ hậu tố `{DEL}`.
- Không map theo `display_name`, `phone`, hoặc email. Danh sách hydrate `created_by.name` từ tài khoản hiện tại để đổi tên hiển thị/SĐT trong `/admin` được phản ánh lại.
- Nếu có `source_creator_name` nhưng không map được tài khoản, UI hiển thị `Chưa khớp tài khoản`. Nếu file không có creator, UI hiển thị `Chưa có dữ liệu`.

### `POST /inventory/stocktakes/import/kiotviet/preview`

Xem trước file chi tiết kiểm kho KiotViet trước khi import.

**Permission:** `perm.manage_inventory`

**Input:** gửi `rows` đã parse hoặc `file_base64` của file `DanhSachChiTietKiemKho_KV...xlsx`.

**Response data:**

```json
{
  "summary": {
    "total_rows": 333,
    "valid_rows": 333,
    "invalid_rows": 0,
    "stocktake_count": 333,
    "product_code_count": 129,
    "matched_product_count": 119,
    "missing_product_count": 10,
    "deleted_product_code_count": 10,
    "formula_error_count": 0
  },
  "invalid_rows": [],
  "missing_product_codes": ["SP001{DEL}"]
}
```

Preview không ghi DB. Backend kiểm tra công thức `SL lệch = Kiểm thực tế - Tồn kho` với sai số nhỏ, map trạng thái KiotViet sang `draft`, `balanced`, `cancelled` hoặc `unknown`, và nhận diện mã hàng `{DEL}` là mã đã xóa/không còn khớp.

### `POST /inventory/stocktakes/import/kiotviet`

Import lịch sử kiểm kho KiotViet vào `stocktakes` và `stocktake_items`.

**Permission:** `perm.manage_inventory`

**Input:** giống preview, có thêm `allow_partial` nếu chủ động muốn bỏ qua dòng lỗi.

**Rules:**

- Upsert phiếu theo `(organization_id, source_system = 'kiotviet', source_code)`.
- Upsert dòng theo dòng nguồn/line number.
- Dòng mã hàng không khớp vẫn được lưu lịch sử với `product_id = null`.
- Nếu file có `Người tạo`, lưu raw vào `stocktakes.source_creator_name` và map `stocktakes.created_by` chỉ theo QCVL `users.username` sau khi bỏ `{DEL}`.
- Không insert `stock_movements`.
- Không update `inventory_provisional_balances`.
- Không thay tồn chính thức; muốn đổi tồn phải dùng chứng từ vận hành QCVL hoặc flow cân bằng kho QCVL riêng. Tồn KV chỉ dùng để đối chiếu với tồn tính từ `stock_movements`.

### `DELETE /inventory/stocktakes/import/kiotviet`

Xóa dữ liệu kiểm kho cũ của lần import KiotViet để người dùng kiểm tra import lại từ đầu.

**Permission:** `perm.manage_inventory`

**Rules:**

- Chỉ xóa phiếu/dòng kiểm kho có `stocktakes.source_type = kiotviet_import` hoặc `source_system = kiotviet`.
- Không xóa hàng hóa.
- Không xóa tồn vận hành.
- Không xóa `stock_movements`.

**Response data:**

```json
{
  "deleted_rows": 333,
  "blocked_rows": 0
}
```

### `GET /inventory/stocktakes/{id}`

Chi tiáº¿t phiáº¿u kiá»ƒm kho vÃ  cÃ¡c dÃ²ng.

**Permission:** `perm.manage_inventory`

**Tráº¡ng thÃ¡i triá»ƒn khai hiá»‡n táº¡i:** tráº£ Ä‘áº§u phiáº¿u + cÃ¡c trÆ°á»ng tá»•ng há»£p giá»‘ng list + mảng `items` từ `stocktake_items`.

`items` dùng cho ô chi tiết `/inventory`: mã hàng, tên hàng, đơn vị, tồn kho nguồn, thực tế, SL lệch, giá trị thực tế nếu có, giá trị lệch, ghi chú, và `product_id` để biết dòng đã khớp hàng hóa QCVL hay chưa. UI hiện tại chỉ hiển thị compact 5 cột `Mã hàng`, `Tên hàng`, `Tồn kho`, `Thực tế`, `SL lệch`; các trường còn lại giữ cho audit hoặc menu chọn cột sau này. UI chỉ hiển thị `Người tạo`/`Ngày tạo`; không hiển thị `Ngày cân bằng` hoặc `Người cân bằng`; không có hàng tìm/lọc trong bảng chi tiết.

### `PATCH /inventory/stocktakes/{id}`

Lưu ghi chú đầu phiếu kiểm kho hoặc hủy phiếu.

Body:

```json
{
  "note": "Ghi chú mới"
}
```

Hoặc:

```json
{
  "status": "cancelled"
}
```

Response trả lại detail giống `GET /inventory/stocktakes/{id}`. Nếu `note` rỗng thì lưu `null`. Khi hủy, API đổi `stocktakes.status` sang `cancelled`, xóa thời điểm cân bằng phụ nếu có, không xóa `stocktake_items`, không ghi hoặc đảo `stock_movements`.

---

## 10. Sá»­a tá»“n trá»±c tiáº¿p tá»« HÃ ng hÃ³a

### `POST /inventory/products/{product_id}/adjust-stock`

Sá»­a tá»“n trá»±c tiáº¿p cho hÃ ng `normal` trong trang HÃ ng hÃ³a vÃ  tá»± sinh phiáº¿u kiá»ƒm kho Ä‘Ã£ cÃ¢n báº±ng.

**Permission:** `perm.manage_inventory`

**Input:**

```json
{
  "actual_qty": 120,
  "reason": "Cáº­p nháº­t tá»“n tá»« trang HÃ ng hÃ³a"
}
```

**Validation:**

- Product pháº£i cÃ¹ng organization.
- Product pháº£i cÃ³ `inventory_shape = normal`.
- `actual_qty >= 0` trá»« khi sau nÃ y cho phÃ©p nháº­p tá»“n Ã¢m thá»§ cÃ´ng báº±ng spec riÃªng.
- `reason` báº¯t buá»™c.
- HÃ ng `roll` vÃ  `sheet` khÃ´ng Ä‘Æ°á»£c sá»­a tá»•ng tá»“n báº±ng endpoint nÃ y; pháº£i sá»­a theo cuá»™n/táº¥m hoáº·c kiá»ƒm kho object-level.

**Workflow:**

1. Láº¥y tá»“n há»‡ thá»‘ng hiá»‡n táº¡i cá»§a product.
2. Sinh phiáº¿u kiá»ƒm kho `source_type = product_edit`, `status = balanced`.
3. Táº¡o má»™t `stocktake_item`.
4. Táº¡o `stock_movements` loáº¡i `stocktake_adjustment` vá»›i chÃªnh lá»‡ch.
5. Tráº£ phiáº¿u kiá»ƒm kho tá»± Ä‘á»™ng vá»«a táº¡o.

Frontend dÃ¹ng `id` vÃ  `code` trong response Ä‘á»ƒ hiá»ƒn thá»‹ thÃ´ng bÃ¡o:

```text
ÄÃ£ táº¡o phiáº¿u kiá»ƒm kho KK000001. Xem phiáº¿u KK000001
```

Link xem phiáº¿u trá» vá» danh sÃ¡ch/chi tiáº¿t phiáº¿u kiá»ƒm kho, khÃ´ng má»Ÿ modal giáº£ trong HÃ ng hÃ³a.

---

## 11. Error Handling

| HTTP | Code | Khi dÃ¹ng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input sai, thiáº¿u dÃ²ng, sai hÃ¬nh dáº¡ng tá»“n |
| 401 | `AUTH_REQUIRED` | Thiáº¿u hoáº·c sai access token |
| 403 | `PERMISSION_DENIED` | Thiáº¿u permission |
| 403 | `WORKSTATION_INVALID` | Workstation khÃ´ng há»£p lá»‡ |
| 404 | `RESOURCE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y product/cuá»™n/táº¥m/phiáº¿u trong organization |
| 409 | `RESOURCE_CONFLICT` | Phiáº¿u khÃ´ng cÃ²n draft, mÃ£ trÃ¹ng, object Ä‘ang bá»‹ dÃ¹ng |
| 409 | `INVENTORY_OBJECT_CONFLICT` | Cuá»™n/táº¥m Ä‘Æ°á»£c chá»n Ä‘á»ƒ khui Ä‘Ã£ Ä‘á»•i tráº¡ng thÃ¡i bá»Ÿi thao tÃ¡c khÃ¡c |
| 422 | `INVENTORY_OPERATION_FAILED` | KhÃ´ng thá»ƒ hoÃ n táº¥t nghiá»‡p vá»¥ kho cÃ³ thá»ƒ giáº£i thÃ­ch |
| 500 | `INTERNAL_ERROR` | Lá»—i há»‡ thá»‘ng khÃ´ng cÃ´ng khai chi tiáº¿t |

---

## 12. Logging vÃ  metric

Backend nÃªn log:

- táº¡o/sá»­a cuá»™n
- táº¡o/sá»­a/táº¡o thá»§ cÃ´ng táº¥m lá»¡
- táº¡o/cÃ¢n báº±ng/há»§y kiá»ƒm kho
- sá»­a tá»“n trá»±c tiáº¿p tá»« HÃ ng hÃ³a
- stock movement thá»§ cÃ´ng
- khui hÃ ng `normal` cÃ³ quy Ä‘á»•i Ä‘Æ¡n vá»‹/cuá»™n/táº¥m
- khui tá»« tá»“n táº¡m KiotViet

Metric gá»£i Ã½:

- sá»‘ stocktake táº¡o má»›i/cÃ¢n báº±ng/há»§y
- sá»‘ stock movement theo loáº¡i
- sá»‘ máº·t hÃ ng tá»“n Ã¢m
- sá»‘ láº§n khui váº­t tÆ° theo loáº¡i `normal`/`roll`/`sheet`
- latency API kiá»ƒm kho

---

â† [Quay vá» Inventory README](./README.md)
