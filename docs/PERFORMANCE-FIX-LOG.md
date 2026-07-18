# PERFORMANCE-FIX-LOG

> **Vai trÃ²:** Log Ä‘o táº£i, fix Ä‘Ã£ lÃ m vÃ  verification Ä‘á»ƒ cÃ¡c luá»“ng sau khÃ´ng lÃ m trÃ¹ng.
> **Cáº­p nháº­t:** 2026-07-05.

---

## 2026-07-18 - Sales Documents Direct Open Waterfall Removal

### Van De Da Kiem

- LAN benchmark cho thay `/sales-documents?open=HD...&type=invoice` hot avg khoang `802ms`, cham hon `/sales-documents` hot avg khoang `543ms`.
- Root cause frontend: initial route `open=` van doi list xong moi lay id tu row roi moi goi detail.
- Root cause backend: PostgreSQL `getSalesDocument` chi match `o.id = $2`, nen khong the goi chi tiet truc tiep bang ma hoa don.

### Fix Da Lam

- `server/db.ts` cho `getSalesDocument` match `(o.id = $2 or o.code = $2)`.
- `SalesDocumentsPage` start `getSalesDocument(openCode)` ngay luc initial load, song song voi list.
- `server/http.test.ts`, `server/db.test.ts`, `SalesDocumentsPage.test.tsx` co regression cho luong `open=HD...`.

### Verification Da Chay

```bash
npx vitest run src/features/sales-documents/SalesDocumentsPage.test.tsx -t "loads route-open invoice detail by code"
npx vitest run server/db.test.ts -t "gets sales document detail by id or code"
npx vitest run server/http.test.ts -t "returns the checked-out product"
npx vitest run src/features/sales-documents/SalesDocumentsPage.test.tsx src/features/sales-documents/sales-document-service.test.ts server/http.test.ts server/db.test.ts
npm run typecheck
npm run build:nas
npm run verify:nas-bundle
```

Ket qua:

- Focused frontend direct-open test: pass.
- Focused DB id/code detail test: pass.
- Focused HTTP smoke: pass.
- Sales-documents/HTTP/DB suite: pass, `4` files / `158` tests.
- `typecheck`: pass.
- `build:nas`: pass.
- `verify:nas-bundle`: pass.
- Deploy copy len NAS pass voi `QCVL_NAS_RESTART=false`; health trace `e6e62e97-c1f2-48ba-936e-9d4059d71d94`.
- Static asset sau deploy van gzip dung: `index-B-tPEID3.js` -> `94358` bytes.
- Backend runtime van can restart `qcvl-app` de code DB lookup by code co hieu luc tren `3200`.

## 2026-07-18 - NAS Static Compression And Frontend Waterfall Cleanup

### Van De Da Kiem

- NAS `3200` da nhanh hon sau SQL paging, nhung static asset van gui nguyen ban.
- Do truc tiep asset `/assets/index-*.js`: `Accept-Encoding: gzip` khong lam giam byte tai xuong (`312927` bytes), nen server chua nen gzip.
- `FinancePage` lan dau con goi `listCashbookBalances` va `listCashbookVouchers` du 2 phan nay dang an.
- Dashboard activity load them con doi sales xong moi goi purchase; dashboard period helper tai page 2+ tuan tu.

### Fix Da Lam

- `server/static.ts` them cache file theo `mtimeMs + size`, gzip cho text asset lon, `ETag`, `304`, va `immutable` cho asset hash.
- `server/index.ts` truyen request headers vao static handler de doc `Accept-Encoding` va `If-None-Match`.
- `FinancePage` bo request balance/voucher khi auxiliary section dang tat; initial finance load chay accounts/debts/cashbook song song.
- `dashboard-service` load activity sales/purchase song song va tai cac page con lai cua period song song sau page 1.

### Verification Da Chay

```bash
npx vitest run server/static.test.ts
npm run typecheck
npx vitest run src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx
npx vitest run src/features/finance/FinancePage.test.tsx src/features/finance/finance-service.test.ts server/static.test.ts
npm run build:nas
npm run verify:nas-bundle
```

Ket qua:

- Static tests: pass, `3` tests.
- Dashboard tests: pass, `21` tests.
- Finance/static tests: pass, `46` tests.
- `typecheck`: pass.
- `build:nas`: pass.
- `verify:nas-bundle`: pass.
- Local built static server on `127.0.0.1:3322`: `index-Qg8dCbMn.js` plain `313068`, gzip `94361`, `content-encoding: gzip`.
- Deploy copy len NAS pass voi `QCVL_NAS_RESTART=false`; health trace `a5b1b447-4af7-47d4-b37e-6465df62034b`.
- Gzip do lai tren `3200` van chua co hieu luc truoc restart runtime: `index-Qg8dCbMn.js` plain `313068`, request gzip `313068`.

---

## 2026-07-18 - Finance Cashbook SQL Paging And Lookup Cache

### Van De Da Kiem

- `/api/v1/finance/cashbook` tren NAS `3200` van cham du cho da paging, vi backend con load full list roi cat trong JS.
- Warm call van bi keo boi 2 lookup lap lai: user display name va finance account list.

### Fix Da Lam

- Them `repository.listCashbookEntriesPage` cho PostgreSQL.
- Day filter, summary va pagination xuong SQL; chi hydrate page hien tai.
- Cache theo `pg.Pool + organizationId` cho user display name va finance account list.
- Cashbook search scope va `is_business_accounted` khop voi filter UI.

### Verification Da Chay

```bash
npm run typecheck
npx vitest run server/http.test.ts server/db.test.ts
```

Ket qua benchmark warm NAS DB:

- `accounts`: `101ms`
- `debts`: `102ms`
- `cashbook-month-page`: `137ms`
- `cashbook-bank-page`: `137ms`
- `sales-page`: `162ms`

---

## 2026-07-18 - Dashboard NAS Missing Token Guard

### Van De Da Kiem

- Tren `3200`, browser dang o `/dashboard` nhung `localStorage` khong con `qc_oms.access_token`.
- UI van giu `currentUser` cu trong React state, nen protected route khong ve `/login`.
- Dashboard goi API khong co bearer token, du lieu hien `0` va tao cam giac trang load cham/khong tra du lieu.

### Fix Da Lam

- `AuthProvider` khi bootstrap khong thay token se clear cache, clear `currentUser`, reset realtime state va danh dau ready.
- Token/user memory fallback chi duoc dung khi browser chan storage; neu storage doc duoc nhung rong thi khong lay lai memory cu.
- `DashboardPage` gap `AUTH_REQUIRED`, `ACCOUNT_INACTIVE` hoac `PERMISSION_DENIED` se goi `onSignOut()` thay vi hien dashboard rong.
- Them regression test cho ca token bien mat trong luc session UI van dang co active user va dashboard API tra 401.

### Verification Da Chay

```bash
npx vitest run src/features/auth/AuthProvider.test.tsx
npx vitest run src/features/auth/auth-service.test.ts src/features/auth/AuthProvider.test.tsx src/features/dashboard/DashboardPage.test.tsx
npm run typecheck
npx vitest run src/features/auth/auth-service.test.ts src/features/auth/AuthProvider.test.tsx src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx server/http.test.ts server/db.test.ts
```

Ket qua:

- Auth service/provider/dashboard targeted: pass, `3` files / `19` tests.
- `typecheck`: pass.
- Auth/Dashboard/HTTP/DB regression: pass, `6` files / `153` tests.

## 2026-07-18 - Dashboard NAS SQL Paging

### Van De Da Kiem

- `/dashboard` tren NAS `3200` load cham khi dung PostgreSQL co nhieu hoa don.
- Root cause: API `/api/v1/sales-documents` goi `repository.listSalesDocuments`, query toan bo `orders` + `order_items`, sau do moi filter/page trong JS.
- Dashboard goi sales-documents nhieu lan cho KPI, bieu do, top hang, top khach va nhat ky, nen chi phi bi nhan len theo so luong hoa don.

### Fix Da Lam

- Them `repository.listSalesDocumentsPage` cho PostgreSQL.
- Day filter `type`, `status`, `customer_id`, `payment_status`, `from`, `to`, `search`, `limit`, `offset` xuong SQL.
- Tinh `total` va `summary` trong SQL tren tap da filter.
- Chi hydrate `order_items` cho page hien tai, khong join/load toan bo line item.
- HTTP route uu tien dung `listSalesDocumentsPage`; giu fallback cu cho repository chua ho tro.

### Verification Da Chay

```bash
npm test -- server/db.test.ts
npm run typecheck
npm test -- server/http.test.ts src/features/dashboard/dashboard-service.test.ts
npm run build:nas
```

Ket qua:

- `server/db.test.ts`: pass, `82` files / `614` tests.
- `typecheck`: pass.
- `server/http.test.ts` + `dashboard-service.test.ts`: pass, `82` files / `687` tests.
- `build:nas`: pass.
- Deploy copy len NAS da pass voi `QCVL_NAS_RESTART=false`.
- `health:nas` sau copy pass, `persistence: "postgres"`, trace `a637686e-1e18-4062-8730-3a8b7c7dcbc8`.
- Can restart service `qcvl-app` tren NAS de backend nap code moi; restart tu dong chua chay duoc vi thieu `QCVL_NAS_SSH_TARGET`.

## 2026-07-18 - Dashboard NAS Auth Cache Revalidation

### Van De Da Kiem

- `/dashboard` tren NAS `3200` co luc hien app shell nhung tat ca KPI/top/nhat ky = `0`.
- NAS PostgreSQL van co du lieu thang 7 (`156` hoa don, `69 798 008`), va API co auth tra du lieu dung.
- Root cause: frontend tin cache `/me` con moi trong `sessionStorage` va bo qua refresh. Sau NAS reset hoac session server thay doi, browser co the con current-user cache nhung token khong con hop le; dashboard request bi `401`, roi hien empty state.

### Fix Da Lam

- `AuthProvider` van dung cached `/me` de render nhanh.
- Khi cache con moi, frontend van refresh `/me` nen neu token het han/khong hop le se sign out va ve login thay vi de dashboard rong.
- Them regression test cho stale token + fresh current-user cache.

### Verification Da Chay

```bash
npx vitest run src/features/auth/AuthProvider.test.tsx src/features/dashboard/DashboardPage.test.tsx
```

Ket qua:

- Pass, `2` files / `13` tests.

# 2026-07-18 - Route Hot-Path Cut For 3200

### Van De Da Kiem

- `/products` va `/inventory/stocktakes` van co cam giac nang vi route con goi list/full hydrate rat nhieu lan.
- `/sales-documents?open=...` truoc do van keo full catalog ngay ca khi detail da co `product_snapshot`.
- NAS backend can restart de nhan code server moi.

### Fix Da Lam

- `server/http.ts`
  - `GET /api/v1/products` va `GET /api/v1/inventory/stocktakes` uu tien `listProductsPage` / `listStocktakesPage` neu repository co ho tro.
  - `GET /api/v1/sales-documents/{id}` chi keo catalog khi item thieu snapshot.
  - `PATCH /api/v1/sales-documents/{id}` cung dung duong snapshot, khong keo catalog vo can.
- `server/db.ts`
  - them `listProductsPage` va `listStocktakesPage` de route co the chuyen sang path page-aware khi repo ho tro.
  - them helper page/creator option de giam route bookkeeping.
- Tests:
  - product page route khong goi full catalog hai lan.
  - stocktake route khong goi full list hai lan.
  - sales document detail dung snapshot item thay vi catalog khi du lieu da co snapshot.

### Verification Da Chay

```bash
npx vitest run server/http.test.ts
npx vitest run server/db.test.ts
npm run typecheck
```

Ket qua:

- HTTP: PASS, `100` tests.
- DB: PASS, `25` tests.
- Typecheck: PASS.

## 2026-07-18 - Dashboard Detail Waterfall Cut

### Van De Da Kiem

- Doc Dashboard quy dinh trang chi hien tom tat va loi tat; khong load chi tiet hang loat.
- Code Dashboard van goi `getSalesDocument` toi da 50 hoa don cho Top hang va System log sau khi da load list.
- Tren PostgreSQL, moi detail tiep tuc hydrate catalog lon trong HTTP detail, lam `/dashboard` NAS co cam giac treo/lau moi co du lieu.

### Fix Da Lam

- `loadDashboardData` khong goi `getSalesDocument` trong lan tai dau.
- Top hang tinh tu `items` trong list response.
- `listSalesDocumentsPage` tra them `product_snapshot` trong `items`, fallback bang join `products` neu snapshot cu rong.
- Tab `He thong` giu rong khi chua co log them/sua/xoa rieng, dung theo doc import data co the chua co log.

### Verification Da Chay

```bash
npx vitest run src/features/dashboard/dashboard-service.test.ts src/features/dashboard/DashboardPage.test.tsx server/db.test.ts server/http.test.ts
npm run typecheck
npm run build:nas
```

Ket qua:

- Dashboard/DB/HTTP tests: pass, `4` files / `137` tests.
- Typecheck: pass.
- Build NAS: pass.

## 2026-07-05 â€” LÆ°á»£t Tá»‘i Æ¯u Load

Branch thá»±c hiá»‡n: `codex/load-performance`

### Váº¥n Äá» ÄÃ£ Kiá»ƒm

- Nhiá»u trang list load cháº­m vÃ¬ gá»i API trÃ¹ng hoáº·c gá»i thÃªm theo tá»«ng dÃ²ng.
- `/sales-documents` khi báº¥m chi tiáº¿t cÃ³ cáº£m giÃ¡c Ä‘á»©ng vÃ¬ UI chá» payload xong má»›i pháº£n há»“i.
- Auth guard lÃ m route hiá»ƒn thá»‹ cháº­m vÃ¬ pháº£i Ä‘á»£i `/api/v1/me`.
- Má»™t sá»‘ endpoint list/detail tráº£ nhiá»u dá»¯ liá»‡u UI chÆ°a dÃ¹ng.

### Fix ÄÃ£ LÃ m

- Shared API client:
  - dedupe cÃ¡c `GET` cháº¡y Ä‘á»“ng thá»i
  - cache `GET` Ä‘Ã£ xong trong 1 giÃ¢y
  - clear cache sau request ghi dá»¯ liá»‡u
- Auth:
  - cache `/api/v1/me` trong `sessionStorage`
  - cho route render ngay khi cÃ³ token
  - refresh `/me` ná»n
- POS:
  - load ban Ä‘áº§u giá»›i háº¡n 12 sáº£n pháº©m
  - tÃ¡ch load sáº£n pháº©m khá»i resolve giÃ¡
- Customers:
  - list tráº£ `total_debt_amount`
  - bá» gá»i debt detail theo tá»«ng dÃ²ng lÃºc má»Ÿ list
  - debt detail chá»‰ load khi má»Ÿ tab cÃ´ng ná»£
- Sales documents:
  - list dÃ¹ng database pagination khi khÃ´ng search text
  - báº¥m chi tiáº¿t hiá»‡n `Äang táº£i chi tiáº¿t...` ngay
  - detail endpoint ban Ä‘áº§u khÃ´ng load máº£ng payment/debt/stock/history chÆ°a dÃ¹ng
  - tab lá»‹ch sá»­ thanh toÃ¡n váº«n hiá»‡n nhÆ°ng chÆ°a gá»i history API
- Purchase receipts:
  - list ban Ä‘áº§u khÃ´ng load supplier/product/finance lookup
  - lookup supplier/product chá»‰ load khi táº¡o hoáº·c má»Ÿ chi tiáº¿t phiáº¿u nháº­p
  - finance accounts chá»‰ load khi dÃ¹ng control chuyá»ƒn khoáº£n
  - báº¥m chi tiáº¿t hiá»‡n loading inline ngay
- Suppliers:
  - list ban Ä‘áº§u khÃ´ng load linked-customer options hoáº·c finance accounts
  - customer options chá»‰ load khi táº¡o/sá»­a NCC
  - finance accounts chá»‰ load khi dÃ¹ng control chuyá»ƒn khoáº£n
  - chi tiáº¿t/thanh toÃ¡n NCC hiá»‡n loading inline ngay

### Káº¿t Quáº£ Äo

| Trang / thao tÃ¡c | TrÆ°á»›c | Sau |
|---|---:|---:|
| `/customers` initial API requests | 17 | 2 |
| `/purchase/receipts` initial API requests | 7 | 2 |
| `/price-book` initial API requests | 4 | 3 |
| `/suppliers` initial API requests | 4 | 2 |
| `/pos` initial API requests | 4 | 4 |

Ghi chÃº:

- `/sales-documents` list thÆ°á»ng cÃ²n khoáº£ng 1.09s sau auth/cache.
- `/sales-documents` detail API cÃ²n khoáº£ng 1.3-1.4s trÃªn local QCVL Node API, nhÆ°ng UI Ä‘Ã£ pháº£n há»“i loading ngay.
- `/purchase/receipts` detail cÃ²n 3 API song song (`receipt`, `suppliers`, `products`), nhÆ°ng loading inline hiá»‡n trÆ°á»›c khi API xong.
- Local QCVL Node API váº«n lÃ  giá»›i háº¡n thá»i gian: má»™t sá»‘ endpoint cÃ²n 0.7-1.4s trÆ°á»›c khi frontend render xong.

### Verification ÄÃ£ Cháº¡y

```bash
npm test -- --run --reporter dot --pool forks --silent=false
npm run typecheck
npm run api:build
npm run smoke:nas
git diff --check
```

Káº¿t quáº£:

- Vitest: PASS â€” 31 files, 178 tests.
- Typecheck: PASS.
- API build: PASS.
- NAS smoke: PASS.
- Diff whitespace check: PASS.
- Cáº£nh bÃ¡o React `act(...)` cÅ© váº«n cÃ²n, khÃ´ng phÃ¡t sinh tá»« lÆ°á»£t tá»‘i Æ°u nÃ y.
