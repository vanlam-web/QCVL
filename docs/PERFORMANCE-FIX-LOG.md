# PERFORMANCE-FIX-LOG

> **Vai trÃ²:** Log Ä‘o táº£i, fix Ä‘Ã£ lÃ m vÃ  verification Ä‘á»ƒ cÃ¡c luá»“ng sau khÃ´ng lÃ m trÃ¹ng.
> **Cáº­p nháº­t:** 2026-07-05.

---

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
