# FOUNDATION TECHNICAL DESIGN â€” Ná»n táº£ng QC-OMS

> **NgÃ y chá»‘t:** 2026-06-28
> **Pháº¡m vi:** Kiáº¿n trÃºc á»©ng dá»¥ng, ranh giá»›i FEâ€“BE vÃ  cáº¥u trÃºc source code ná»n táº£ng.

---

## 1. Má»¤C TIÃŠU

Thiáº¿t káº¿ nÃ y Ä‘á»§ Ä‘á»ƒ báº¯t Ä‘áº§u Giai Ä‘oáº¡n 0 cá»§a [DEVELOPMENT-PLAN.md](../DEVELOPMENT-PLAN.md): Ä‘Äƒng nháº­p, há»“ sÆ¡ ngÆ°á»i dÃ¹ng, permission, mÃ¡y tráº¡m, POS Shell vÃ  triá»ƒn khai staging.

Thiáº¿t káº¿ khÃ´ng chá»‘t trÆ°á»›c workflow cá»§a Sales, Checkout, Inventory, BOM hoáº·c Workstation Queue. CÃ¡c domain Ä‘Ã³ pháº£i cÃ³ thiáº¿t káº¿ ká»¹ thuáº­t riÃªng trÆ°á»›c giai Ä‘oáº¡n tÆ°Æ¡ng á»©ng.

---

## 2. QUYáº¾T Äá»ŠNH KIáº¾N TRÃšC

| Chá»§ Ä‘á» | Quyáº¿t Ä‘á»‹nh |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | QCVL Node API Edge Functions cung cáº¥p REST API `/api/v1` |
| Database | QCVL Node API PostgreSQL, quáº£n lÃ½ báº±ng migration |
| Authentication | QCVL Node API Auth, email + password trong Giai Ä‘oáº¡n 0 |
| Authorization | Permission-based; Backend kiá»ƒm tra má»i request Ä‘Æ°á»£c báº£o vá»‡ |
| Realtime | QCVL Node API Realtime, chá»‰ dÃ¹ng cho subscription/event |
| Business data | FE Ä‘á»c/ghi qua `/api/v1`, khÃ´ng gá»i trá»±c tiáº¿p báº£ng báº±ng `direct database access` |
| Frontend deploy | Vercel |
| Backend deploy | QCVL Node API Edge Functions |
| Package manager | `npm` |
| Repository | Má»™t repository, chÆ°a tÃ¡ch monorepo/package dÃ¹ng chung |

### 2.1. Ranh giá»›i sá»­ dá»¥ng QCVL Node API SDK trÃªn FE

Frontend chá»‰ Ä‘Æ°á»£c dÃ¹ng QCVL Node API SDK trá»±c tiáº¿p cho:

- táº¡o, phá»¥c há»“i vÃ  káº¿t thÃºc phiÃªn Auth;
- Ä‘á»•i máº­t kháº©u cá»§a chÃ­nh ngÆ°á»i dÃ¹ng Ä‘ang Ä‘Äƒng nháº­p;
- Ä‘Äƒng kÃ½ hoáº·c há»§y Ä‘Äƒng kÃ½ Realtime channel Ä‘Ã£ Ä‘Æ°á»£c Backend cho phÃ©p.

Frontend khÃ´ng Ä‘Æ°á»£c dÃ¹ng `direct database access`, RPC hoáº·c Admin API Ä‘á»ƒ Ä‘á»c/ghi dá»¯ liá»‡u nghiá»‡p vá»¥. Má»i thao tÃ¡c dá»¯ liá»‡u Ä‘i qua API Client vÃ  `/api/v1`.

### 2.2. LÃ½ do chá»n Edge Functions + REST API

- TuÃ¢n thá»§ `BACKEND_CONVENTIONS.md` vá» prefix `/api/v1`.
- Giá»¯ transaction, validation vÃ  permission á»Ÿ phÃ­a mÃ¡y chá»§.
- TrÃ¡nh Ä‘á»ƒ Service Role Key hoáº·c logic nháº¡y cáº£m trong trÃ¬nh duyá»‡t.
- Váº«n dÃ¹ng Ä‘Æ°á»£c Auth vÃ  Realtime cá»§a QCVL Node API mÃ  khÃ´ng cáº§n váº­n hÃ nh server riÃªng á»Ÿ giai Ä‘oáº¡n Ä‘áº§u.

Náº¿u Edge Functions khÃ´ng Ä‘Ã¡p á»©ng hiá»‡u nÄƒng hoáº·c runtime cá»§a má»™t use case tÆ°Æ¡ng lai, use case Ä‘Ã³ cÃ³ thá»ƒ tÃ¡ch thÃ nh service riÃªng mÃ  khÃ´ng thay Ä‘á»•i API contract cÃ´ng khai.

---

## 3. LUá»’NG REQUEST CHUáº¨N

```text
React Component
    â†“ gá»i hook/action
Feature Service hoáº·c POS Store
    â†“
API Client
    â†“ Authorization: Bearer <access_token>
QCVL Node API Edge Function /api/v1
    â†“ xÃ¡c thá»±c JWT
    â†“ táº£i profile + permissions
    â†“ validate input
Application Use Case
    â†“ transaction/repository
PostgreSQL
    â†“
Response envelope + trace_id
```

Realtime khÃ´ng thay tháº¿ API ghi dá»¯ liá»‡u. Má»™t thay Ä‘á»•i luÃ´n Ä‘Æ°á»£c ghi thÃ nh cÃ´ng qua API trÆ°á»›c; Realtime chá»‰ thÃ´ng bÃ¡o tráº¡ng thÃ¡i má»›i cho cÃ¡c client liÃªn quan.

---

## 4. Cáº¤U TRÃšC SOURCE CODE

```text
QC-OMS/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/                 # Router, providers, app shell
â”‚   â”œâ”€â”€ components/          # Component dÃ¹ng chung, khÃ´ng chá»©a nghiá»‡p vá»¥
â”‚   â”œâ”€â”€ features/
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”œâ”€â”€ users/
â”‚   â”‚   â””â”€â”€ pos/
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ api/             # API client, response/error types
â”‚   â”‚   â”œâ”€â”€ auth/            # QCVL Node API Auth client
â”‚   â”‚   â”œâ”€â”€ realtime/        # Realtime subscriptions
â”‚   â”‚   â””â”€â”€ validation/      # Validation phá»¥c vá»¥ UX
â”‚   â”œâ”€â”€ stores/              # Client working state, gá»“m POS Store
â”‚   â”œâ”€â”€ styles/
â”‚   â””â”€â”€ main.tsx
â”œâ”€â”€ QCVL Node API/
â”‚   â”œâ”€â”€ functions/
â”‚   â”‚   â””â”€â”€ api/
â”‚   â”‚       â”œâ”€â”€ routes/
â”‚   â”‚       â”œâ”€â”€ use-cases/
â”‚   â”‚       â”œâ”€â”€ repositories/
â”‚   â”‚       â”œâ”€â”€ middleware/
â”‚   â”‚       â””â”€â”€ index.ts
â”‚   â”œâ”€â”€ migrations/
â”‚   â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ seed.sql
â”‚   â””â”€â”€ config.toml
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ e2e/
â”œâ”€â”€ docs/
â”œâ”€â”€ .env.example
â”œâ”€â”€ package.json
â””â”€â”€ vite.config.ts
```

KhÃ´ng táº¡o `packages/`, microservice hoáº·c abstraction dÃ¹ng chung trÆ°á»›c khi cÃ³ Ã­t nháº¥t hai consumer tháº­t.

---

## 5. FRONTEND STATE

Frontend phÃ¢n state thÃ nh ba nhÃ³m:

| NhÃ³m | CÃ¡ch quáº£n lÃ½ | VÃ­ dá»¥ |
|---|---|---|
| Server state | Query/cache layer | Há»“ sÆ¡ ngÆ°á»i dÃ¹ng, permissions, danh má»¥c mÃ¡y tráº¡m |
| Working state | Store táº­p trung | Tab POS, giá» hÃ ng, ghi chÃº, khÃ¡ch Ä‘ang chá»n |
| UI state cá»¥c bá»™ | Component state | Modal má»Ÿ/Ä‘Ã³ng, tab Ä‘ang hiá»ƒn thá»‹, input táº¡m |

Quy táº¯c:

- KhÃ´ng sao chÃ©p server state vÃ o Store náº¿u khÃ´ng cáº§n chá»‰nh sá»­a táº¡m thá»i.
- Component khÃ´ng gá»i API trá»±c tiáº¿p; gá»i feature service, hook hoáº·c Store action.
- Store khÃ´ng chá»©a QCVL Node API Service Role Key hoáº·c logic authorization.
- Validation FE chá»‰ há»— trá»£ UX; Backend luÃ´n validate láº¡i.
- Dá»¯ liá»‡u Auth khÃ´ng Ä‘Æ°á»£c ghi vÃ o LocalStorage thá»§ cÃ´ng; QCVL Node API Auth quáº£n lÃ½ session.

---

## 6. AUTHENTICATION VÃ€ WORKSTATION

### 6.1. ÄÄƒng nháº­p

Giai Ä‘oáº¡n 0 sá»­ dá»¥ng email + password qua QCVL Node API Auth. TÃªn hiá»ƒn thá»‹ vÃ  mÃ£ mÃ¡y tráº¡m khÃ´ng pháº£i thÃ´ng tin Ä‘Äƒng nháº­p.

Sau khi Auth thÃ nh cÃ´ng:

1. FE láº¥y access token tá»« QCVL Node API Auth.
2. FE gá»i `GET /api/v1/me`.
3. Backend kiá»ƒm tra profile Ä‘ang `active` vÃ  tráº£ permissions.
4. Náº¿u trÃ¬nh duyá»‡t chÆ°a cÃ³ mÃ¡y tráº¡m há»£p lá»‡, FE yÃªu cáº§u chá»n má»™t mÃ¡y tráº¡m active.
5. ID mÃ¡y tráº¡m Ä‘Æ°á»£c lÆ°u cá»¥c bá»™ báº±ng key `qc_oms.workstation_id` vÃ  gá»­i trong header `X-Workstation-Id`.

MÃ¡y tráº¡m lÃ  Ä‘á»‹nh danh thiáº¿t bá»‹/quáº§y, khÃ´ng gáº¯n cá»©ng vÃ o má»™t ngÆ°á»i dÃ¹ng. Má»™t ngÆ°á»i cÃ³ thá»ƒ Ä‘Äƒng nháº­p á»Ÿ mÃ¡y khÃ¡c náº¿u cÃ³ quyá»n sá»­ dá»¥ng há»‡ thá»‘ng.

### 6.1.1. Há»“ sÆ¡ tÃ i khoáº£n tá»± sá»­a

Trang `/account` Ä‘á»c dá»¯ liá»‡u tá»« `GET /api/v1/me` vÃ  lÆ°u báº±ng `PATCH /api/v1/me/profile`.

Backend lÆ°u cÃ¡c field tá»± sá»­a vÃ o `public.profiles`: `display_name`, `username`, `phone`, `email`, `birthday`, `region`, `ward`, `address`, `note`. `profiles.email` lÃ  email liÃªn há»‡/hiá»ƒn thá»‹ trong app, khÃ´ng Ä‘á»•i email Ä‘Äƒng nháº­p QCVL Node API Auth. Chuá»—i rá»—ng Ä‘Æ°á»£c chuáº©n hÃ³a thÃ nh `null`.

`Vai trÃ²` khÃ´ng lÆ°u qua popup tÃ i khoáº£n. Quyá»n há»‡ thá»‘ng váº«n láº¥y tá»« `user_permissions`; thay Ä‘á»•i quyá»n pháº£i Ä‘i qua luá»“ng quáº£n trá»‹ user.

### 6.1.2. Thiáº¿t bá»‹ Ä‘Ã£ Ä‘Äƒng nháº­p

Má»—i láº§n `GET /api/v1/me` thÃ nh cÃ´ng, frontend gá»­i `x-client-device-id` lÆ°u trong `localStorage` cá»§a tá»«ng browser; backend dÃ¹ng mÃ£ nÃ y Ä‘á»ƒ tÃ¡ch thiáº¿t bá»‹, fallback vá» `User-Agent` + IP náº¿u header thiáº¿u. Nhá» váº­y Chrome ngoÃ i, browser Codex vÃ  browser khÃ¡c khÃ´ng bá»‹ gá»™p náº¿u cÃ¹ng IP/UA. Backend ghi/upsert thiáº¿t bá»‹ hiá»‡n táº¡i vÃ o `public.account_devices`; tÃªn thiáº¿t bá»‹ Æ°u tiÃªn dáº¡ng `Chrome trÃªn macOS` khi nháº­n diá»‡n Ä‘Æ°á»£c cáº£ trÃ¬nh duyá»‡t vÃ  há»‡ Ä‘iá»u hÃ nh. Response `/me` tráº£ `devices` gá»“m tá»‘i Ä‘a 10 thiáº¿t bá»‹ active má»›i nháº¥t, Ä‘Ã¡nh dáº¥u `is_current_device` cho thiáº¿t bá»‹ Ä‘ang dÃ¹ng.

Migration táº¡o `account_devices` pháº£i grant `SELECT`, `INSERT`, `UPDATE` cho `service_role`; náº¿u thiáº¿u grant, Edge Function khÃ´ng ghi Ä‘Æ°á»£c thiáº¿t bá»‹ vÃ  `/me` sáº½ tráº£ `INTERNAL_ERROR`.

Trang `/account` hiá»ƒn thá»‹ tÃªn thiáº¿t bá»‹, loáº¡i thiáº¿t bá»‹, trÃ¬nh duyá»‡t, há»‡ Ä‘iá»u hÃ nh, IP vÃ  `last_seen_at`. NÃºt `ÄÄƒng xuáº¥t` thiáº¿t bá»‹ khÃ¡c gá»i `PATCH /api/v1/me/devices/:id/sign-out`. Backend dÃ¹ng QCVL Node API Auth Admin `signOut(accessToken, "others")`, vÃ¬ váº­y thao tÃ¡c nÃ y thu há»“i táº¥t cáº£ session khÃ¡c cá»§a cÃ¹ng user, khÃ´ng thu há»“i Ä‘Ãºng 1 session remote riÃªng láº». Sau Ä‘Ã³ backend Ä‘Ã¡nh dáº¥u má»i thiáº¿t bá»‹ active khÃ¡c thiáº¿t bá»‹ hiá»‡n táº¡i lÃ  `signed_out` Ä‘á»ƒ danh sÃ¡ch chá»‰ cÃ²n thiáº¿t bá»‹ Ä‘ang dÃ¹ng.

### 6.2. Máº¥t hoáº·c thu há»“i quyá»n

- FE subscribe thay Ä‘á»•i permission cá»§a user Ä‘ang Ä‘Äƒng nháº­p.
- Khi nháº­n event, FE gá»i láº¡i `GET /api/v1/me`.
- Náº¿u quyá»n cá»§a route hiá»‡n táº¡i bá»‹ thu há»“i, FE Ä‘iá»u hÆ°á»›ng vá» trang há»£p lá»‡ gáº§n nháº¥t.
- Backend kiá»ƒm tra permission trÃªn tá»«ng request; viá»‡c FE áº©n nÃºt khÃ´ng pháº£i biá»‡n phÃ¡p báº£o máº­t.

### 6.3. TÃ i khoáº£n bá»‹ vÃ´ hiá»‡u hÃ³a

Backend tráº£ `ACCOUNT_INACTIVE` cho tÃ i khoáº£n cÃ³ profile khÃ´ng active. FE xÃ³a session cá»¥c bá»™ vÃ  Ä‘Æ°a ngÆ°á»i dÃ¹ng vá» mÃ n hÃ¬nh Ä‘Äƒng nháº­p.

---

## 7. TENANCY

Giai Ä‘oáº¡n Ä‘áº§u chá»‰ váº­n hÃ nh má»™t tá»• chá»©c lÃ  XÆ°á»Ÿng VÄƒn LÃ¢m, nhÆ°ng cÃ¡c báº£ng á»©ng dá»¥ng ná»n táº£ng cÃ³ `organization_id` ngay tá»« Ä‘áº§u.

RÃ ng buá»™c:

- Má»™t user thuá»™c Ä‘Ãºng má»™t organization trong MVP.
- Má»i API chá»‰ thao tÃ¡c dá»¯ liá»‡u cÃ¹ng organization vá»›i user hiá»‡n táº¡i.
- Client khÃ´ng Ä‘Æ°á»£c tá»± quyáº¿t Ä‘á»‹nh `organization_id`; Backend láº¥y tá»« profile.
- ChÆ°a xÃ¢y giao diá»‡n chuyá»ƒn organization hoáº·c quáº£n trá»‹ nhiá»u tenant.

---

## 8. SECURITY VÃ€ ERROR HANDLING

- Service Role Key chá»‰ tá»“n táº¡i trong secret cá»§a Backend.
- Access token Ä‘Æ°á»£c xÃ¡c thá»±c á»Ÿ má»i endpoint Ä‘Æ°á»£c báº£o vá»‡.
- Permission Ä‘Æ°á»£c kiá»ƒm tra trÆ°á»›c khi cháº¡y use case.
- KhÃ´ng nháº­n `organization_id`, `actor_id` hoáº·c permission tá»« Client lÃ m nguá»“n tin cáº­y.
- Response khÃ´ng chá»©a stack trace, SQL hoáº·c secret.
- Má»—i request cÃ³ `trace_id`; Æ°u tiÃªn nháº­n `X-Request-Id`, náº¿u thiáº¿u thÃ¬ Backend tá»± sinh.
- Log tá»‘i thiá»ƒu gá»“m thá»i gian, route, status, latency, user ID, workstation ID vÃ  trace ID; khÃ´ng log password/token.

---

## 9. TRANSACTION VÃ€ IDEMPOTENCY

- Giai Ä‘oáº¡n 0 dÃ¹ng transaction khi táº¡o user kÃ¨m profile vÃ  permissions.
- Náº¿u táº¡o Auth user thÃ nh cÃ´ng nhÆ°ng ghi profile tháº¥t báº¡i, Backend pháº£i thá»±c hiá»‡n cleanup hoáº·c Ä‘Ã¡nh dáº¥u lá»—i Ä‘á»ƒ retry an toÃ n.
- Endpoint thay permission ghi tráº¡ng thÃ¡i má»›i vÃ  audit log trong cÃ¹ng transaction Database.
- Checkout vÃ  cÃ¡c use case tÃ i chÃ­nh ghi nhiá»u báº£ng báº¯t buá»™c cÃ³ idempotency key; contract cá»¥ thá»ƒ chá»‘t trong slice liÃªn quan.

---

## 10. KIá»‚M THá»¬

| Lá»›p | CÃ´ng cá»¥/Pháº¡m vi |
|---|---|
| Unit | HÃ m validation, permission guard, mapper |
| Component | Login form, route guard, profile menu |
| Integration | Edge Function + PostgreSQL local, RLS vÃ  permission |
| E2E | ÄÄƒng nháº­p â†’ chá»n mÃ¡y tráº¡m â†’ vÃ o POS â†’ Ä‘Äƒng xuáº¥t |
| Security | User khÃ´ng cÃ³ quyá»n, user khÃ¡c organization, account inactive |

Má»i test pháº£i cháº¡y Ä‘Æ°á»£c khÃ´ng phá»¥ thuá»™c Database production.

---

## 11. Ná»˜I DUNG CHÆ¯A CHá»T TRONG FILE NÃ€Y

CÃ¡c quyáº¿t Ä‘á»‹nh sau Ä‘Æ°á»£c chá»‘t just-in-time táº¡i giai Ä‘oáº¡n tÆ°Æ¡ng á»©ng:

- schema báº£ng giÃ¡ vÃ  API danh má»¥c;
- cÆ¡ cháº¿ lÆ°u hÃ³a Ä‘Æ¡n nhÃ¡p;
- schema Order/Payment/Debt/Inventory;
- transaction Checkout;
- protocol mÃ¡y in/CNC;
- render vÃ  gá»­i bill.

KhÃ´ng Ä‘Æ°á»£c suy ra thiáº¿t káº¿ cá»§a cÃ¡c domain trÃªn chá»‰ tá»« tÃ i liá»‡u ná»n táº£ng nÃ y.
