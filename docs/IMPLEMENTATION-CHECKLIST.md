# QC-OMS Implementation Checklist

> **Vai trÃ²:** Log baseline implement gáº§n nháº¥t, khÃ´ng pháº£i roadmap sá»‘ng dÃ i háº¡n.
> **Nguá»“n tráº¡ng thÃ¡i sá»‘ng:** [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).
> **Cáº­p nháº­t:** 2026-07-05.

---

## Baseline ÄÃ£ Kiá»ƒm

| NhÃ³m | Káº¿t quáº£ |
|---|---|
| Lint | Pass |
| Typecheck | Pass |
| Frontend unit tests | Pass |
| Function tests | Pass |
| DB tests | Pass |
| E2E | Pass |
| Build | Pass, route-level chunks dÆ°á»›i ngÆ°á»¡ng cáº£nh bÃ¡o Vite |

---

## Module UI ÄÃ£ CÃ³ Trong Baseline

| Module | Ná»™i dung chÃ­nh |
|---|---|
| Inventory | Route `/inventory`, danh sÃ¡ch tá»“n, detail sáº£n pháº©m, stock movement, chá»‰nh tá»“n hÃ ng thÆ°á»ng |
| Finance | Route `/finance`, tÃ i khoáº£n/quá»¹, sá»• quá»¹, cÃ´ng ná»£ khÃ¡ch hÃ ng, thu ná»£, danh sÃ¡ch voucher readonly |
| Reports | Route `/reports`, bÃ¡o cÃ¡o cuá»‘i ngÃ y, bÃ¡n hÃ ng, cÃ´ng ná»£, kho |
| BOM | BOM v1 má»™t cáº¥p cho normal inventory components, lÆ°u active BOM, snapshot/trá»« component khi checkout |

---

## Lá»‡nh Kiá»ƒm Khi Cháº¡m Baseline

```bash
npm run lint
npm run typecheck
npm test
npm run api:build
npm run db:migrate
npm run test:e2e
npm run build
```
