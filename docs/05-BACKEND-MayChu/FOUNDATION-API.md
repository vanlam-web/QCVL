# FOUNDATION API â€” Auth, Profile, Permission vÃ  Workstation

> **Má»‘c chá»‘t:** Giai Ä‘oáº¡n 0.
> **Base path:** `/api/v1`
> **Database:** [AUTH-PERMISSIONS.md](../04-DATABASE/System/AUTH-PERMISSIONS.md)

---

## 1. AUTHENTICATION

ÄÄƒng nháº­p, phá»¥c há»“i session, Ä‘á»•i máº­t kháº©u cá»§a chÃ­nh user vÃ  Ä‘Äƒng xuáº¥t sá»­ dá»¥ng QCVL Node API Auth SDK. KhÃ´ng táº¡o endpoint REST bá»c láº¡i cÃ¡c thao tÃ¡c nÃ y trong Giai Ä‘oáº¡n 0.

Má»i endpoint Ä‘Æ°á»£c báº£o vá»‡ nháº­n:

```http
Authorization: Bearer <qcvl_access_token>
X-Workstation-Id: <uuid>
X-Client-Device-Id: <uuid>
X-Request-Id: <client-generated-id>   # khÃ´ng báº¯t buá»™c
```

Quy táº¯c:

- `Authorization` báº¯t buá»™c, trá»« health check.
- `X-Workstation-Id` báº¯t buá»™c vá»›i request nghiá»‡p vá»¥ sau khi user Ä‘Ã£ chá»n mÃ¡y tráº¡m; `/me` vÃ  danh sÃ¡ch workstation cho phÃ©p thiáº¿u trong láº§n khá»Ÿi táº¡o Ä‘áº§u tiÃªn.
- `X-Client-Device-Id` do frontend sinh vÃ  lÆ°u trong `localStorage` theo tá»«ng browser; `/me` dÃ¹ng header nÃ y Ä‘á»ƒ tÃ¡ch thiáº¿t bá»‹ Ä‘Äƒng nháº­p. Header nÃ y pháº£i náº±m trong CORS allowlist, náº¿u thiáº¿u browser sáº½ cháº·n request sau preflight.
- Backend xÃ¡c thá»±c workstation active vÃ  cÃ¹ng organization vá»›i user.
- Náº¿u thiáº¿u `X-Request-Id`, Backend tá»± sinh `trace_id`.

---

## 2. RESPONSE CHUáº¨N

ThÃ nh cÃ´ng:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "trace_id": "uuid"
}
```

Lá»—i:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "ThÃ´ng bÃ¡o an toÃ n cho ngÆ°á»i dÃ¹ng",
  "trace_id": "uuid"
}
```

Danh sÃ¡ch cÃ³ phÃ¢n trang:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 0
  },
  "message": "",
  "trace_id": "uuid"
}
```

---

## 3. ERROR CODE CHUNG

| HTTP | Code | Khi dÃ¹ng |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input khÃ´ng há»£p lá»‡ |
| 401 | `AUTH_REQUIRED` | Thiáº¿u hoáº·c sai access token |
| 403 | `PERMISSION_DENIED` | KhÃ´ng cÃ³ permission yÃªu cáº§u |
| 403 | `ACCOUNT_INACTIVE` | Profile Ä‘Ã£ bá»‹ vÃ´ hiá»‡u hÃ³a |
| 403 | `WORKSTATION_INVALID` | MÃ¡y tráº¡m khÃ´ng tá»“n táº¡i, inactive hoáº·c khÃ¡c organization |
| 404 | `RESOURCE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y resource trong pháº¡m vi tenant |
| 409 | `RESOURCE_CONFLICT` | Email/code hoáº·c tráº¡ng thÃ¡i bá»‹ trÃ¹ng/xung Ä‘á»™t |
| 429 | `RATE_LIMITED` | VÆ°á»£t giá»›i háº¡n request |
| 500 | `INTERNAL_ERROR` | Lá»—i khÃ´ng cÃ´ng khai chi tiáº¿t |

Validation lá»—i cÃ³ thá»ƒ tráº£ thÃªm `details.fields`, nhÆ°ng khÃ´ng tráº£ stack trace hoáº·c lá»—i SQL.

---

## 4. HEALTH CHECK

### `GET /health`

**Auth:** KhÃ´ng yÃªu cáº§u.

**Má»¥c Ä‘Ã­ch:** Liveness cá»§a Edge Function; khÃ´ng kiá»ƒm tra sÃ¢u Database Ä‘á»ƒ trÃ¡nh biáº¿n health endpoint thÃ nh nguá»“n táº£i.

**Response data:**

```json
{
  "status": "ok",
  "service": "qc-oms-api",
  "version": "git-sha"
}
```

KhÃ´ng tráº£ environment variable, connection string hoáº·c thÃ´ng tin háº¡ táº§ng.

---

## 5. Há»’ SÆ  HIá»†N Táº I

### `GET /me`

**Auth:** Báº¯t buá»™c; khÃ´ng yÃªu cáº§u permission chá»©c nÄƒng.

**Workflow:**

1. XÃ¡c thá»±c access token.
2. Táº£i profile theo user ID.
3. Tá»« chá»‘i profile khÃ´ng tá»“n táº¡i hoáº·c inactive.
4. Táº£i danh sÃ¡ch permission active.
5. Náº¿u cÃ³ `X-Workstation-Id`, kiá»ƒm tra workstation.
6. Ghi nháº­n thiáº¿t bá»‹ hiá»‡n táº¡i tá»« `x-client-device-id`; fallback vá» `User-Agent` vÃ  IP request náº¿u header thiáº¿u.
7. Tráº£ dá»¯ liá»‡u phiÃªn á»©ng dá»¥ng.

**Response data:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Thu ngÃ¢n 1"
  },
  "profile": {
    "username": "0947900909",
    "phone": "0947900909",
    "email": "contact@example.com",
    "birthday": "1990-01-31",
    "region": "TP Há»“ ChÃ­ Minh",
    "ward": "PhÆ°á»ng Báº¿n NghÃ©",
    "address": "1 LÃª Lá»£i",
    "note": "Ca sÃ¡ng"
  },
  "organization": {
    "id": "uuid",
    "code": "VAN-LAM",
    "name": "XÆ°á»Ÿng VÄƒn LÃ¢m"
  },
  "workstation": {
    "id": "uuid",
    "code": "POS-01",
    "name": "Quáº§y thu ngÃ¢n 1"
  },
  "devices": [
    {
      "id": "uuid",
      "device_name": "Chrome trÃªn macOS",
      "device_type": "desktop",
      "browser_name": "Chrome",
      "os_name": "macOS",
      "ip_address": "203.0.113.10",
      "last_seen_at": "2026-07-06T14:00:00Z",
      "created_at": "2026-07-06T13:00:00Z",
      "is_current_device": true,
      "status": "active"
    }
  ],
  "permissions": ["perm.create_order"]
}
```

`workstation` tráº£ `null` náº¿u request khá»Ÿi táº¡o chÆ°a gá»­i header.
CÃ¡c field trong `profile` tráº£ `null` náº¿u chÆ°a lÆ°u dá»¯ liá»‡u.
`devices` tráº£ tá»‘i Ä‘a 10 thiáº¿t bá»‹ active má»›i nháº¥t cá»§a user hiá»‡n táº¡i. Frontend pháº£i gá»­i header `x-client-device-id` á»•n Ä‘á»‹nh theo tá»«ng browser Ä‘á»ƒ backend khÃ´ng gá»™p Chrome ngoÃ i vá»›i browser Codex khi cÃ¹ng `User-Agent` vÃ  IP. TÃªn thiáº¿t bá»‹ Æ°u tiÃªn dáº¡ng `Chrome trÃªn macOS` khi backend nháº­n diá»‡n Ä‘Æ°á»£c trÃ¬nh duyá»‡t vÃ  há»‡ Ä‘iá»u hÃ nh tá»« `User-Agent`.

### `PATCH /me/devices/:id/sign-out`

**Auth:** Báº¯t buá»™c; user chá»‰ thao tÃ¡c trÃªn thiáº¿t bá»‹ cá»§a chÃ­nh mÃ¬nh.

Thu há»“i session khÃ¡c cá»§a cÃ¹ng user báº±ng QCVL Node API Auth Admin `signOut(accessToken, "others")`, Ä‘Ã¡nh dáº¥u má»i thiáº¿t bá»‹ active khÃ¡c thiáº¿t bá»‹ hiá»‡n táº¡i thÃ nh `signed_out` trong `account_devices`, rá»“i tráº£ danh sÃ¡ch thiáº¿t bá»‹ active cÃ²n láº¡i. Endpoint khÃ´ng cho sign out thiáº¿t bá»‹ hiá»‡n táº¡i. Do giá»›i háº¡n QCVL Node API, thao tÃ¡c theo má»™t dÃ²ng thiáº¿t bá»‹ sáº½ Ä‘Äƒng xuáº¥t táº¥t cáº£ session khÃ¡c, khÃ´ng chá»‰ Ä‘Ãºng má»™t session remote riÃªng láº».

### `PATCH /me/profile`

**Auth:** Báº¯t buá»™c; user chá»‰ sá»­a há»“ sÆ¡ cá»§a chÃ­nh mÃ¬nh.

**Input:**

```json
{
  "display_name": "VÄƒn LÃ¢m",
  "username": "0947900909",
  "phone": "0947900909",
  "email": "contact@example.com",
  "birthday": "1990-01-31",
  "region": "TP Há»“ ChÃ­ Minh",
  "ward": "PhÆ°á»ng Báº¿n NghÃ©",
  "address": "1 LÃª Lá»£i",
  "note": "Ghi chÃº"
}
```

**Validation:**

- `display_name` báº¯t buá»™c, trim, 1-100 kÃ½ tá»±.
- Chuá»—i rá»—ng cá»§a cÃ¡c field cÃ²n láº¡i lÆ°u thÃ nh `null`.
- `phone` chá»‰ gá»“m sá»‘/khoáº£ng tráº¯ng/`+().-`, 8-20 kÃ½ tá»±.
- `email` lÃ  email liÃªn há»‡ hiá»ƒn thá»‹, khÃ´ng Ä‘á»•i email Ä‘Äƒng nháº­p QCVL Node API Auth.
- `birthday` dÃ¹ng Ä‘á»‹nh dáº¡ng `YYYY-MM-DD`.

**Response data:** giá»‘ng `GET /me` sau khi cáº­p nháº­t.

---

## 6. WORKSTATIONS

### `GET /workstations`

**Auth:** Báº¯t buá»™c; khÃ´ng yÃªu cáº§u permission chá»©c nÄƒng.

**Output:** Danh sÃ¡ch workstation `active` cÃ¹ng organization, sáº¯p xáº¿p theo `code`.

Chá»‰ tráº£ `id`, `code`, `name`; khÃ´ng tráº£ thÃ´ng tin ná»™i bá»™ khÃ´ng cáº§n cho mÃ n hÃ¬nh chá»n mÃ¡y.

### `POST /workstations`

**Permission:** `perm.manage_users` trong Giai Ä‘oáº¡n 0.

**Input:**

```json
{
  "code": "POS-01",
  "name": "Quáº§y thu ngÃ¢n 1"
}
```

Backend tá»± gÃ¡n organization cá»§a actor. Code Ä‘Æ°á»£c trim, viáº¿t hoa vÃ  pháº£i duy nháº¥t trong organization.

### `PATCH /workstations/{id}`

**Permission:** `perm.manage_users`.

Cho phÃ©p sá»­a `code`, `name`, `status`. KhÃ´ng xÃ³a váº­t lÃ½ workstation Ä‘Ã£ cÃ³ lá»‹ch sá»­.

---

## 7. QUáº¢N LÃ USER

Má»i endpoint trong má»¥c nÃ y yÃªu cáº§u `perm.manage_users`.

### `GET /users`

Query há»— trá»£:

- `search`: tÃ¬m theo display name, username, phone hoáº·c email liÃªn há»‡;
- `status`: `active` hoáº·c `inactive`;
- `page`, `page_size`; `page_size` tá»‘i Ä‘a 100.

Chá»‰ tráº£ user trong cÃ¹ng organization vá»›i actor.

Response má»—i item:

```json
{
  "id": "uuid",
  "email": "cashier@example.com",
  "username": "cashier01",
  "phone": "0900000000",
  "display_name": "Thu ngÃ¢n 1",
  "status": "active",
  "permissions": ["perm.create_order"]
}
```

Frontend `/admin` hiá»ƒn thá»‹ `Vai trÃ²` báº±ng cÃ¡ch suy ra tá»« permissions hiá»‡n cÃ³ trong MVP: `perm.manage_users` â†’ `Quáº£n trá»‹`, `perm.manage_finance` â†’ `Káº¿ toÃ¡n`, `perm.manage_inventory` â†’ `Quáº£n lÃ½ kho`, `perm.create_order` â†’ `NhÃ¢n viÃªn thu ngÃ¢n`, cÃ²n láº¡i â†’ `NhÃ¢n viÃªn`.

### `GET /users/{id}`

Tráº£ profile, email, tráº¡ng thÃ¡i vÃ  permission cá»§a má»™t user cÃ¹ng organization.

### `POST /users`

**Input:**

```json
{
  "email": "cashier@example.com",
  "username": "cashier-01",
  "phone": "0947900909",
  "birthday": "1990-01-31",
  "region": "TP Há»“ ChÃ­ Minh",
  "ward": "PhÆ°á»ng Báº¿n ThÃ nh",
  "address": "12 Nguyá»…n TrÃ£i",
  "note": "Ca tá»‘i",
  "password": "temporary-secret",
  "display_name": "Thu ngÃ¢n 1",
  "permissions": ["perm.create_order"]
}
```

**Validation:**

- Email há»£p lá»‡ vÃ  chÆ°a tá»“n táº¡i.
- `username` sau trim khÃ´ng rá»—ng, tá»‘i Ä‘a 100 kÃ½ tá»±; náº¿u khÃ´ng gá»­i thÃ¬ dÃ¹ng email.
- `phone` cho phÃ©p trá»‘ng hoáº·c sá»‘/kÃ½ tá»± Ä‘iá»‡n thoáº¡i phá»• biáº¿n, 8-20 kÃ½ tá»±.
- `birthday` cho phÃ©p trá»‘ng hoáº·c Ä‘á»‹nh dáº¡ng `YYYY-MM-DD`.
- `region`, `ward`, `address`, `note` cho phÃ©p trá»‘ng; láº§n lÆ°á»£t tá»‘i Ä‘a 100, 100, 255, 500 kÃ½ tá»±.
- Password Ä‘Ã¡p á»©ng policy Auth cá»§a mÃ´i trÆ°á»ng.
- `display_name` sau trim khÃ´ng rá»—ng, tá»‘i Ä‘a 100 kÃ½ tá»±.
- Má»i permission code tá»“n táº¡i vÃ  Ä‘ang active.
- Actor cÃ³ `perm.manage_users` Ä‘Æ°á»£c gÃ¡n má»i permission code active trong cÃ¹ng organization.
- KhÃ´ng Ä‘Æ°á»£c vÃ´ hiá»‡u hÃ³a user quáº£n trá»‹ cuá»‘i cÃ¹ng hoáº·c xÃ³a `perm.manage_users` khá»i user quáº£n trá»‹ cuá»‘i cÃ¹ng cá»§a organization.

**Workflow:**

1. Kiá»ƒm tra input vÃ  permission actor.
2. Táº¡o QCVL Node API Auth user báº±ng Admin API.
3. Táº¡o profile cÃ¹ng organization actor.
4. GÃ¡n permissions.
5. Ghi permission audit log.
6. Náº¿u bÆ°á»›c Database tháº¥t báº¡i, cleanup Auth user vá»«a táº¡o hoáº·c ghi tráº¡ng thÃ¡i retry cÃ³ kiá»ƒm soÃ¡t.

KhÃ´ng log hoáº·c tráº£ láº¡i password.

### `PATCH /users/{id}`

**Input:**

```json
{
  "display_name": "Thu ngÃ¢n ca sÃ¡ng",
  "status": "active"
}
```

KhÃ´ng dÃ¹ng endpoint nÃ y Ä‘á»ƒ thay permission hoáº·c password.

Khi chuyá»ƒn sang `inactive`, Backend pháº£i lÃ m máº¥t hiá»‡u lá»±c truy cáº­p á»©ng dá»¥ng sá»›m nháº¥t cÃ³ thá»ƒ; má»i request tiáº¿p theo bá»‹ `/me` vÃ  permission middleware tá»« chá»‘i.

### `PUT /users/{id}/permissions`

Thay tháº¿ toÃ n bá»™ permission hiá»‡n táº¡i báº±ng danh sÃ¡ch má»›i.

**Input:**

```json
{
  "permissions": [
    "perm.create_order",
    "perm.apply_discount"
  ]
}
```

**Workflow transaction:**

1. Lock táº­p permission cá»§a target user.
2. Validate target cÃ¹ng organization.
3. Validate toÃ n bá»™ code vÃ  quyá»n Ä‘Æ°á»£c phÃ©p gÃ¡n.
4. TÃ­nh before/after.
5. Thay tháº¿ `user_permissions`.
6. Ghi má»™t `permission_audit_logs` vá»›i action `replace`.
7. Commit vÃ  Ä‘á»ƒ Realtime phÃ¡t tÃ­n hiá»‡u cho target user.

Request gá»­i láº¡i cÃ¹ng danh sÃ¡ch pháº£i cho káº¿t quáº£ giá»‘ng nhau vÃ  khÃ´ng lÃ m thay Ä‘á»•i quyá»n ngoÃ i Ã½ muá»‘n.

---

## 8. PERMISSION CATALOG

### `GET /permissions`

**Permission:** `perm.manage_users`.

Tráº£ danh má»¥c permission active, nhÃ³m theo module Ä‘á»ƒ dá»±ng báº£ng tick quyá»n. Danh má»¥c lÃ  read-only trÃªn UI.

---

## 9. RATE LIMIT VÃ€ AUDIT

- Endpoint táº¡o/sá»­a user vÃ  permission pháº£i cÃ³ rate limit tháº¥p hÆ¡n endpoint Ä‘á»c.
- Má»i thay Ä‘á»•i user, workstation vÃ  permission ghi log vá»›i actor, target/resource, trace ID vÃ  thá»i gian.
- KhÃ´ng log password, access token hoáº·c refresh token.

---

## 10. ACCEPTANCE TEST GIAI ÄOáº N 0

1. User active Ä‘Äƒng nháº­p vÃ  gá»i `/me` thÃ nh cÃ´ng.
2. User inactive bá»‹ tá»« chá»‘i dÃ¹ access token cÃ²n háº¡n.
3. User khÃ´ng cÃ³ `perm.manage_users` khÃ´ng gá»i Ä‘Æ°á»£c API quáº£n trá»‹.
4. Admin khÃ´ng Ä‘á»c/sá»­a user thuá»™c organization khÃ¡c.
5. Thay permission táº¡o Ä‘Ãºng audit log vÃ  target user nháº­n tÃ­n hiá»‡u refetch.
6. Workstation sai organization bá»‹ tá»« chá»‘i.
7. KhÃ´ng thá»ƒ vÃ´ hiá»‡u hÃ³a hoáº·c tÆ°á»›c quyá»n user quáº£n trá»‹ cuá»‘i cÃ¹ng.
8. Response lá»—i luÃ´n cÃ³ `code` vÃ  `trace_id`, khÃ´ng lá»™ chi tiáº¿t há»‡ thá»‘ng.
