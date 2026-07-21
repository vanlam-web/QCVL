# Káº¾ HOáº CH PHÃT TRIá»‚N QC-OMS â€” FE + BE THEO Tá»ªNG GIAI ÄOáº N

> Doc cleanup status (SoT vs runtime): [DOC-CLEANUP-CHECKLIST.md](./DOC-CLEANUP-CHECKLIST.md). Owner 2026-07-20: no more KiotViet import waves.

> **Vai trÃ²:** Roadmap logic dÃ i háº¡n; tráº¡ng thÃ¡i sá»‘ng vÃ  queue hiá»‡n táº¡i náº±m á»Ÿ [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).
> **NgÃ y láº­p:** 2026-06-28
> **Cáº­p nháº­t:** 2026-07-05 theo checklist sá»‘ng hiá»‡n táº¡i
> **Má»¥c tiÃªu:** Sau má»—i giai Ä‘oáº¡n pháº£i cÃ³ má»™t luá»“ng ngÆ°á»i dÃ¹ng hoÃ n chá»‰nh, cháº¡y báº±ng Frontend vÃ  Backend tháº­t trÃªn mÃ´i trÆ°á»ng staging.

---

## 1. PHáº M VI VÃ€ NGUYÃŠN Táº®C

TÃ i liá»‡u nÃ y lÃ  roadmap Ä‘iá»u phá»‘i phÃ¡t triá»ƒn liÃªn táº§ng. NÃ³ khÃ´ng thay tháº¿ Source of Truth cá»§a tá»«ng táº§ng:

- HÃ nh vi giao diá»‡n: `02-PRD-UX-PhongCanh/`.
- Quy táº¯c nghiá»‡p vá»¥: `03-BUSINESS-NghiepVu/`.
- Schema dá»¯ liá»‡u: `04-DATABASE/`.
- API vÃ  workflow thá»±c thi: `05-BACKEND-MayChu/`.
- Há»‡ thá»‘ng bÃªn ngoÃ i: `06-INTEGRATION-KetHop/`.
- Háº¡ táº§ng vÃ  váº­n hÃ nh: `07-DEPLOYMENT-TrienKhai/`.

NguyÃªn táº¯c triá»ƒn khai:

1. PhÃ¡t triá»ƒn theo **vertical slice**: FE, BE, Database vÃ  kiá»ƒm thá»­ Ä‘Æ°á»£c lÃ m trong cÃ¹ng giai Ä‘oáº¡n.
2. KhÃ´ng nghiá»‡m thu mÃ n hÃ¬nh chá»‰ dÃ¹ng mock data hoáº·c API giáº£.
3. Backend lÃ  nguá»“n validation vÃ  tÃ­nh toÃ¡n cuá»‘i cÃ¹ng cho dá»¯ liá»‡u nghiá»‡p vá»¥.
4. Má»—i giai Ä‘oáº¡n pháº£i deploy Ä‘Æ°á»£c lÃªn staging vÃ  cÃ³ ká»‹ch báº£n demo hoÃ n chá»‰nh.
5. Business Rule chÆ°a rÃµ pháº£i Ä‘Æ°á»£c Owner chá»‘t trÆ°á»›c khi triá»ƒn khai.
6. Chá»©c nÄƒng chÆ°a hoÃ n thiá»‡n pháº£i Ä‘Æ°á»£c áº©n báº±ng feature flag hoáº·c permission ká»¹ thuáº­t, khÃ´ng Ä‘á»ƒ tráº¡ng thÃ¡i ná»­a hoáº¡t Ä‘á»™ng; riÃªng nghiá»‡p vá»¥ MVP Ä‘Ã£ má»Ÿ thÃ¬ preset nhÃ¢n viÃªn ná»™i bá»™ pháº£i Ä‘á»§ quyá»n thao tÃ¡c chÃ­nh, khÃ´ng chia cáº¯t luá»“ng háº±ng ngÃ y báº±ng quÃ¡ nhiá»u permission nhá».
7. KhÃ´ng má»Ÿ scope ngoÃ i [MVP-SCOPE](./01-VISION-TamNhin/03-MVP-SCOPE.md) náº¿u Owner chÆ°a chá»‘t láº¡i.
8. CÃ³ thá»ƒ lÃ m sá»›m foundation cá»§a giai Ä‘oáº¡n sau náº¿u cáº§n Ä‘á»ƒ hoÃ n táº¥t luá»“ng POS bÃ¡n Ä‘á»©t, miá»…n lÃ  khÃ´ng má»Ÿ thÃªm nghiá»‡p vá»¥ ngoÃ i MVP.

Giáº£ Ä‘á»‹nh thá»i gian trong káº¿ hoáº¡ch dÃ nh cho nhÃ³m 2â€“3 developer. Náº¿u chá»‰ cÃ³ má»™t ngÆ°á»i phÃ¡t triá»ƒn, thá»i gian cÃ³ thá»ƒ tÄƒng khoáº£ng 1,5â€“2 láº§n.

---

## 2. KIáº¾N TRÃšC TRIá»‚N KHAI Äá»€ XUáº¤T

```text
React + TypeScript + Vite
        â†“
Application Service / API Client
        â†“
backend cu da go Edge Functions hoáº·c API /api/v1
        â†“
PostgreSQL + Auth + Realtime + RLS
```

- Frontend triá»ƒn khai trÃªn Vercel.
- backend cu da go quáº£n lÃ½ Authentication, PostgreSQL vÃ  Realtime.
- FE khÃ´ng trá»±c tiáº¿p thá»±c hiá»‡n cÃ¡c workflow quan trá»ng nhÆ° checkout, trá»« kho hoáº·c phÃ¢n bá»• cÃ´ng ná»£.
- Má»i workflow ghi nhiá»u báº£ng pháº£i cháº¡y trong transaction phÃ¹ há»£p.
- CÃ¡c thao tÃ¡c cÃ³ thá»ƒ gá»­i láº¡i pháº£i cÃ³ idempotency key hoáº·c cÆ¡ cháº¿ chá»‘ng trÃ¹ng tÆ°Æ¡ng Ä‘Æ°Æ¡ng.
- Má»—i giai Ä‘oáº¡n cÃ³ migration, seed data vÃ  cáº¥u hÃ¬nh staging tÆ°Æ¡ng á»©ng.

---

## 3. Tá»”NG QUAN ROADMAP

### 3.1. CÃ¡ch Ä‘á»c roadmap sau khi chá»‘t MVP ngÃ y 2026-07-01

Roadmap Phase 0-8 bÃªn dÆ°á»›i lÃ  **roadmap logic dÃ i háº¡n theo nhÃ³m nÄƒng lá»±c**, khÃ´ng cÃ²n lÃ  thá»© tá»± commit/branch cá»©ng.

Tá»« Phase 1 trá»Ÿ Ä‘i, dá»± Ã¡n Ä‘ang thá»±c thi theo cÃ¡c lÃ¡t cáº¯t nhá» hÆ¡n:

```text
1A -> 1B -> 1C -> 2A -> 2B -> 2C -> 2D -> ...
```

Má»—i lÃ¡t cáº¯t váº«n theo nguyÃªn táº¯c vertical slice: cÃ³ UI/API/DB/test Ä‘á»§ Ä‘á»ƒ cháº¡y má»™t pháº§n nghiá»‡p vá»¥ tháº­t. VÃ¬ váº­y má»™t sá»‘ foundation cá»§a Phase 4 hoáº·c Phase 6 trong roadmap logic Ä‘Ã£ Ä‘Æ°á»£c lÃ m sá»›m Ä‘á»ƒ phá»¥c vá»¥ POS bÃ¡n Ä‘á»©t:

- checkout transaction
- inventory/finance foundation
- production queue foundation
- Sales Documents readonly

Äiá»u nÃ y khÃ´ng cÃ³ nghÄ©a dá»± Ã¡n bá»‹ "nháº£y phase". ÄÃ¢y lÃ  Ä‘iá»u chá»‰nh Ä‘Ãºng theo MVP scope hiá»‡n táº¡i:

```text
POS bÃ¡n Ä‘á»©t -> hÃ³a Ä‘Æ¡n -> trá»« kho -> thu tiá»n/cÃ´ng ná»£ -> sá»• quá»¹ -> Ä‘á»‘i soÃ¡t -> bÃ¡o cÃ¡o quáº£n trá»‹
```

KhÃ´ng má»Ÿ scope ngoÃ i MVP nhÆ° Äáº·t hÃ ng KiotViet, váº­n Ä‘Æ¡n/COD, kÃªnh online, VAT/HÄÄT, HR/payroll hoáº·c campaign retail.

### 3.2. Tráº¡ng thÃ¡i main hiá»‡n táº¡i

Nguá»“n theo dÃµi chi tiáº¿t: [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).

| LÃ¡t cáº¯t thá»±c thi | Tráº¡ng thÃ¡i | Ghi chÃº |
|---|---|---|
| Phase 1A | ÄÃ£ merge | Foundation UI + catalog/pricing |
| Phase 1B | ÄÃ£ merge | Customer selection vÃ  customer pricing |
| Phase 1C | ÄÃ£ merge | Checkout transaction, inventory/finance foundation |
| Phase 2A | ÄÃ£ merge | POS direct checkout UI |
| Phase 2B | ÄÃ£ merge | Production queue/K02-D foundation |
| Phase 2C | ÄÃ£ merge | POS line discount handling UI/backend persistence |
| Phase 2D | ÄÃ£ merge | Sales Documents readonly list/detail |
| Phase 3A | ÄÃ£ merge | BÃ¡o giÃ¡ `BG...` vÃ  má»Ÿ láº¡i vÃ o POS draft |
| Quote print Phase 3B | ÄÃ£ merge | In/xem bÃ¡o giÃ¡ Ä‘Æ¡n giáº£n |
| PriceBook formula MVP | ÄÃ£ merge | Structured formula, preview/apply, rounding |
| Purchase P1/P2/P3/P5 | ÄÃ£ merge | NCC, phiáº¿u nháº­p hÃ ng thÆ°á»ng, post receipt, thanh toÃ¡n NCC |

### 3.3. Mapping giá»¯a roadmap logic vÃ  lÃ¡t cáº¯t Ä‘Ã£ lÃ m

| Roadmap logic | Ná»™i dung roadmap gá»‘c | Tráº¡ng thÃ¡i/lÃ¡t cáº¯t thá»±c táº¿ |
|---|---|---|
| Phase 0 | ÄÄƒng nháº­p, phÃ¢n quyá»n, POS Shell | ÄÃ£ merge |
| Phase 1 | HÃ ng hÃ³a, khÃ¡ch hÃ ng, báº£ng giÃ¡ | ÄÃ£ cÃ³ foundation 1A/1B vÃ  PriceBook formula MVP |
| Phase 2 | Giá» hÃ ng vÃ  hÃ³a Ä‘Æ¡n nhÃ¡p | ÄÃ£ cÃ³ POS direct checkout UI; nhÃ¡p production queue á»Ÿ 2B |
| Phase 3 | BÃ¡o giÃ¡ vÃ  Bill Preview | BÃ¡o giÃ¡, má»Ÿ láº¡i bÃ¡o giÃ¡, Sales Documents readonly vÃ  quote print Ä‘Æ¡n giáº£n Ä‘Ã£ merge |
| Phase 4 | Thanh toÃ¡n, kho cÆ¡ báº£n vÃ  cÃ´ng ná»£ | Checkout transaction, inventory/finance foundation Ä‘Ã£ lÃ m sá»›m á»Ÿ 1C/2A |
| Phase 5 | Combo/BOM vÃ  quáº£n lÃ½ váº­t tÆ° | Purchase hÃ ng thÆ°á»ng Ä‘Ã£ merge; cuá»™n/táº¥m váº­t lÃ½ vÃ  BOM sÃ¢u cÃ²n phase riÃªng |
| Phase 6 | HÃ ng Ä‘á»£i mÃ¡y sáº£n xuáº¥t realtime | Production queue foundation Ä‘Ã£ lÃ m sá»›m á»Ÿ 2B; ingestion/realtime Ä‘áº§y Ä‘á»§ cÃ²n phase sau |
| Phase 7 | Bill nÃ¢ng cao vÃ  há»— trá»£ gá»­i khÃ¡ch | Quote print Ä‘Æ¡n giáº£n Ä‘Ã£ cÃ³; gá»­i tá»± Ä‘á»™ng/nhiá»u máº«u cÃ²n sau |
| Phase 8 | Production vÃ  váº­n hÃ nh | backend cu da go Cloud/dev-staging Ä‘Ã£ cÃ³; production hardening cÃ²n sau |

### 3.4. Roadmap logic dÃ i háº¡n

| Giai Ä‘oáº¡n | Káº¿t quáº£ sá»­ dá»¥ng Ä‘Æ°á»£c | Thá»i gian dá»± kiáº¿n |
|---|---|---|
| 0 | ÄÄƒng nháº­p, phÃ¢n quyá»n vÃ  POS Shell | 1â€“2 tuáº§n |
| 1 | TÃ¬m hÃ ng, khÃ¡ch hÃ ng vÃ  báº£ng giÃ¡ | 2 tuáº§n |
| 2 | Giá» hÃ ng vÃ  hÃ³a Ä‘Æ¡n nhÃ¡p | 2â€“3 tuáº§n |
| 3 | BÃ¡o giÃ¡ vÃ  Bill Preview cÆ¡ báº£n | 1â€“2 tuáº§n |
| 4 | Thanh toÃ¡n, kho cÆ¡ báº£n vÃ  cÃ´ng ná»£ | 3 tuáº§n |
| 5 | Combo/BOM vÃ  quáº£n lÃ½ váº­t tÆ° | 2â€“3 tuáº§n |
| 6 | HÃ ng Ä‘á»£i mÃ¡y sáº£n xuáº¥t Realtime | 2â€“3 tuáº§n |
| 7 | Bill nÃ¢ng cao vÃ  há»— trá»£ gá»­i khÃ¡ch | 2 tuáº§n |
| 8 | Production, giÃ¡m sÃ¡t vÃ  khÃ´i phá»¥c | 2 tuáº§n |

Má»‘c phÃ¡t hÃ nh logic ban Ä‘áº§u:

- **MVP ná»™i bá»™:** Giai Ä‘oáº¡n 0â€“4, khoáº£ng 9â€“12 tuáº§n.
- **Pilot táº¡i xÆ°á»Ÿng:** Giai Ä‘oáº¡n 5â€“7, thÃªm khoáº£ng 6â€“8 tuáº§n.
- **Production á»•n Ä‘á»‹nh:** Giai Ä‘oáº¡n 8, tá»•ng khoáº£ng 17â€“22 tuáº§n.
- **SaaS Ä‘a xÆ°á»Ÿng:** Chá»‰ báº¯t Ä‘áº§u sau khi báº£n ná»™i bá»™ váº­n hÃ nh á»•n Ä‘á»‹nh.

---

## 4. CHI TIáº¾T Tá»ªNG GIAI ÄOáº N

### Giai Ä‘oáº¡n 0 â€” Ná»n táº£ng vÃ  Ä‘Äƒng nháº­p

**TÃ­nh nÄƒng bÃ n giao:** NgÆ°á»i dÃ¹ng Ä‘Äƒng nháº­p, vÃ o mÃ n hÃ¬nh POS theo preset quyá»n MVP vÃ  Ä‘Äƒng xuáº¥t an toÃ n.

**Frontend**

- Khá»Ÿi táº¡o React, TypeScript, Vite vÃ  Tailwind CSS.
- Trang Ä‘Äƒng nháº­p, POS Shell vÃ  routing.
- Route guard vÃ  trang `KhÃ´ng cÃ³ quyá»n truy cáº­p` cho tÃ i khoáº£n háº¡n cháº¿ Ä‘áº·c biá»‡t hoáº·c truy cáº­p nháº§m vÃ¹ng quáº£n trá»‹.
- Hiá»ƒn thá»‹ tÃ i khoáº£n, mÃ£ mÃ¡y tráº¡m vÃ  tráº¡ng thÃ¡i káº¿t ná»‘i.

**Backend vÃ  Database**

- backend cu da go Auth.
- Há»“ sÆ¡ ngÆ°á»i dÃ¹ng, permissions vÃ  mÃ¡y tráº¡m.
- API láº¥y há»“ sÆ¡ ngÆ°á»i dÃ¹ng hiá»‡n táº¡i.
- RLS vÃ  kiá»ƒm tra permission phÃ­a Backend.
- Audit Ä‘Äƒng nháº­p vÃ  thay Ä‘á»•i quyá»n.

**Äiá»u kiá»‡n nghiá»‡m thu**

- ÄÄƒng nháº­p thÃ nh cÃ´ng vÃ  tháº¥t báº¡i Ä‘Ãºng hÃ nh vi.
- TÃ i khoáº£n ná»™i bá»™ máº·c Ä‘á»‹nh truy cáº­p Ä‘Æ°á»£c POS; tÃ i khoáº£n háº¡n cháº¿ Ä‘áº·c biá»‡t thiáº¿u quyá»n thÃ¬ khÃ´ng truy cáº­p Ä‘Æ°á»£c POS.
- Refresh khÃ´ng lÃ m máº¥t phiÃªn há»£p lá»‡.
- CÃ³ staging URL vÃ  pipeline build/test/deploy.

### Giai Ä‘oáº¡n 1 â€” HÃ ng hÃ³a, khÃ¡ch hÃ ng vÃ  báº£ng giÃ¡

**TÃ­nh nÄƒng bÃ n giao:** Thu ngÃ¢n tÃ¬m sáº£n pháº©m báº±ng `F3`, táº¡o/chá»n khÃ¡ch báº±ng `F4` vÃ  nháº­n Ä‘Ãºng giÃ¡ bÃ¡n.

**Frontend**

- TÃ¬m sáº£n pháº©m khÃ´ng dáº¥u vÃ  lÆ°á»›i sáº£n pháº©m K03-C.
- TÃ¬m, thÃªm vÃ  sá»­a khÃ¡ch hÃ ng K03-A.
- Chá»n báº£ng giÃ¡ vÃ  hiá»ƒn thá»‹ chiáº¿t kháº¥u.
- Nháº¯c bá»• sung SÄT K03-B.
- Back-office tá»‘i thiá»ƒu Ä‘á»ƒ quáº£n lÃ½ sáº£n pháº©m vÃ  báº£ng giÃ¡.

**Backend vÃ  Database**

- Schema sáº£n pháº©m, khÃ¡ch hÃ ng, báº£ng giÃ¡ vÃ  chi tiáº¿t báº£ng giÃ¡.
- API tÃ¬m kiáº¿m sáº£n pháº©m vÃ  khÃ¡ch hÃ ng.
- API CRUD khÃ¡ch hÃ ng.
- API xÃ¡c Ä‘á»‹nh giÃ¡ theo khÃ¡ch hÃ ng.
- Chuáº©n hÃ³a vÃ  kiá»ƒm tra trÃ¹ng SÄT, mÃ£ khÃ¡ch hÃ ng.

**Äiá»u kiá»‡n nghiá»‡m thu**

- Táº¡o khÃ¡ch má»›i vÃ  tá»± Ä‘á»™ng chá»n vÃ o hÃ³a Ä‘Æ¡n hiá»‡n táº¡i.
- Äá»•i khÃ¡ch lÃ m cáº­p nháº­t cÃ¡c dÃ²ng dÃ¹ng giÃ¡ tá»± Ä‘á»™ng.
- DÃ²ng Ä‘Ã£ sá»­a giÃ¡ thá»§ cÃ´ng Ä‘Æ°á»£c giá»¯ nguyÃªn.
- KhÃ´ng táº¡o trÃ¹ng SÄT hoáº·c mÃ£ khÃ¡ch hÃ ng.

### Giai Ä‘oáº¡n 2 â€” Giá» hÃ ng vÃ  hÃ³a Ä‘Æ¡n nhÃ¡p

**TÃ­nh nÄƒng bÃ n giao:** Thu ngÃ¢n táº¡o nhiá»u hÃ³a Ä‘Æ¡n nhÃ¡p, thÃªm sáº£n pháº©m vÃ  tÃ­nh tiá»n chÃ­nh xÃ¡c.

**Frontend**

- K01 Ä‘a tab, tá»‘i Ä‘a 10 tab.
- DÃ²ng hÃ ng thÆ°á»ng vÃ  dÃ²ng hÃ ng mÂ².
- Ghi chÃº dÃ²ng hÃ ng vÃ  ghi chÃº Ä‘Æ¡n.
- Tá»•ng mÂ² vÃ  tá»•ng tiá»n cáº­p nháº­t realtime.
- KhÃ´i phá»¥c tab sau reload hoáº·c khá»Ÿi Ä‘á»™ng láº¡i mÃ¡y.
- Cáº£nh bÃ¡o khi Ä‘Ã³ng tab cÃ³ dá»¯ liá»‡u.

**Backend**

- Endpoint tÃ­nh vÃ  validation giá» hÃ ng.
- PhÃ¢n loáº¡i sáº£n pháº©m theo Ä‘Æ¡n vá»‹ tÃ­nh.
- TÃ­nh hÃ ng thÆ°á»ng vÃ  hÃ ng mÂ² theo Business Rule hiá»‡n hÃ nh.
- Kiá»ƒm tra giÃ¡, kÃ­ch thÆ°á»›c vÃ  permission ká»¹ thuáº­t; preset ná»™i bá»™ MVP máº·c Ä‘á»‹nh cÃ³ quyá»n giáº£m giÃ¡/sá»­a giÃ¡ thá»§ cÃ´ng náº¿u Owner chÆ°a chá»‘t kiá»ƒm soÃ¡t riÃªng.

**Äiá»u kiá»‡n nghiá»‡m thu**

- FE vÃ  BE cho cÃ¹ng káº¿t quáº£ tÃ­nh tiá»n.
- HÃ ng thÆ°á»ng chá»n láº¡i Ä‘Æ°á»£c cá»™ng sá»‘ lÆ°á»£ng.
- HÃ ng mÂ² luÃ´n táº¡o dÃ²ng riÃªng.
- Dá»¯ liá»‡u giá»¯a cÃ¡c tab Ä‘á»™c láº­p.
- Reload khÃ´ng lÃ m máº¥t hÃ³a Ä‘Æ¡n nhÃ¡p.

### Giai Ä‘oáº¡n 3 â€” BÃ¡o giÃ¡ vÃ  Bill Preview

**TÃ­nh nÄƒng bÃ n giao:** Thu ngÃ¢n lÆ°u bÃ¡o giÃ¡, má»Ÿ láº¡i Ä‘á»ƒ sá»­a vÃ  xem/in bill bÃ¡o giÃ¡.

**Frontend**

- NÃºt `BÃO GIÃ`.
- Danh sÃ¡ch vÃ  tÃ¬m kiáº¿m bÃ¡o giÃ¡.
- Má»Ÿ láº¡i bÃ¡o giÃ¡ thÃ nh hÃ³a Ä‘Æ¡n nhÃ¡p.
- Bill Preview vÃ  in bill cÆ¡ báº£n.

**Backend vÃ  Database**

- Schema Ä‘Æ¡n hÃ ng, dÃ²ng hÃ ng vÃ  lá»‹ch sá»­ tráº¡ng thÃ¡i.
- Sinh mÃ£ `BG...`.
- API táº¡o, Ä‘á»c vÃ  cáº­p nháº­t bÃ¡o giÃ¡.
- LÆ°u snapshot giÃ¡ vÃ  thÃ´ng tin hÃ ng táº¡i thá»i Ä‘iá»ƒm bÃ¡o giÃ¡.
- KhÃ´ng phÃ¡t sinh kho, tiá»n, cÃ´ng ná»£ hoáº·c doanh thu.

**Äiá»u kiá»‡n nghiá»‡m thu**

- BÃ¡o giÃ¡ Ä‘Æ°á»£c lÆ°u vÃ  má»Ÿ láº¡i chÃ­nh xÃ¡c.
- CÃ³ thá»ƒ sá»­a rá»“i lÆ°u láº¡i.
- KhÃ´ng xuáº¥t hiá»‡n stock movement hoáº·c cash transaction.

### Giai Ä‘oáº¡n 4 â€” Thanh toÃ¡n, kho cÆ¡ báº£n vÃ  cÃ´ng ná»£

**TÃ­nh nÄƒng bÃ n giao:** Thu ngÃ¢n thanh toÃ¡n báº±ng tiá»n máº·t, chuyá»ƒn khoáº£n hoáº·c káº¿t há»£p; kho, sá»• quá»¹ vÃ  cÃ´ng ná»£ Ä‘Æ°á»£c cáº­p nháº­t Ä‘á»“ng thá»i.

**Frontend**

- Dialog thanh toÃ¡n K03-D.
- Tráº£ Ä‘á»§, ná»£ toÃ n bá»™ vÃ  tráº£ má»™t pháº§n.
- KhÃ¡ch láº» ná»£ vá»›i ghi chÃº báº¯t buá»™c.
- Thanh toÃ¡n ná»£ cÅ©.
- Xem lá»‹ch sá»­ hÃ³a Ä‘Æ¡n vÃ  cÃ´ng ná»£.

**Backend vÃ  Database**

- Schema payment, sá»• quá»¹, cÃ´ng ná»£ vÃ  phÃ¢n bá»• tráº£ ná»£.
- Kho cÆ¡ báº£n, sá»‘ dÆ° tá»“n vÃ  lá»‹ch sá»­ biáº¿n Ä‘á»™ng kho.
- Transaction checkout nguyÃªn tá»­.
- Idempotency chá»‘ng thanh toÃ¡n hai láº§n.
- Cáº¥n trá»« ná»£ vÃ o hÃ³a Ä‘Æ¡n cÅ© nháº¥t trÆ°á»›c.
- Sinh mÃ£ `HD...` vÃ  giá»¯ liÃªn káº¿t vá»›i bÃ¡o giÃ¡ nguá»“n.

**Äiá»u kiá»‡n nghiá»‡m thu**

- Má»™t láº§n xÃ¡c nháº­n chá»‰ táº¡o má»™t hÃ³a Ä‘Æ¡n.
- Lá»—i giá»¯a chá»«ng rollback toÃ n bá»™ transaction.
- Tiá»n thá»±c thu khá»›p sá»• quá»¹.
- CÃ´ng ná»£ khá»›p tá»«ng hÃ³a Ä‘Æ¡n.
- Kho Ä‘Æ°á»£c trá»« Ä‘Ãºng.
- BÃ¡o giÃ¡ chuyá»ƒn thÃ nh hÃ³a Ä‘Æ¡n vÃ  váº«n truy váº¿t Ä‘Æ°á»£c.

> HoÃ n thÃ nh giai Ä‘oáº¡n nÃ y Ä‘áº¡t má»‘c **MVP ná»™i bá»™**.

### Giai Ä‘oáº¡n 5 â€” Combo/BOM vÃ  quáº£n lÃ½ váº­t tÆ°

**TÃ­nh nÄƒng bÃ n giao:** Thu ngÃ¢n bÃ¡n Combo, chá»‰nh BOM vÃ  há»‡ thá»‘ng trá»« Ä‘Ãºng tá»«ng váº­t tÆ° thÃ nh pháº§n.

**Frontend**

- DÃ²ng Combo/BOM vÃ  chá»‰nh BOM cáº¥p 1.
- Combo cáº¥p 2 hiá»ƒn thá»‹ dáº¡ng khÃ³a.
- Tá»•ng chi phÃ­ váº­t tÆ°.
- Popup khui váº­t tÆ° tá»± do.
- Cáº£nh bÃ¡o khui cuá»™n hoáº·c táº¥m.

**Backend vÃ  Database**

- Schema BOM vÃ  thÃ nh pháº§n BOM.
- Deep-scan BOM khi checkout.
- Quy Ä‘á»•i mÂ² sang mÃ©t dÃ i hoáº·c táº¥m.
- Quáº£n lÃ½ lÃ´, phiÃªn váº­t tÆ° dá»Ÿ vÃ  hao há»¥t.
- Nháº­t kÃ½ ngÆ°á»i khui, váº­t tÆ°, lÃ½ do vÃ  thá»i Ä‘iá»ƒm.

**Äiá»u kiá»‡n nghiá»‡m thu**

- Combo checkout thÃ nh cÃ´ng vÃ  trá»« Ä‘á»§ váº­t tÆ° con.
- KhÃ´ng cho táº¡o vÃ²ng láº·p BOM.
- Thiáº¿u tá»“n xá»­ lÃ½ Ä‘Ãºng chÃ­nh sÃ¡ch cáº£nh bÃ¡o.
- Má»i thao tÃ¡c khui Ä‘á»u truy váº¿t Ä‘Æ°á»£c.

### Giai Ä‘oáº¡n 6 â€” HÃ ng Ä‘á»£i mÃ¡y sáº£n xuáº¥t Realtime

**TÃ­nh nÄƒng bÃ n giao:** MÃ¡y sáº£n xuáº¥t hoáº·c trÃ¬nh mÃ´ phá»ng gá»­i file; POS nháº­n realtime vÃ  Ä‘Æ°a file vÃ o Ä‘Ãºng hÃ³a Ä‘Æ¡n nhÃ¡p.

**Frontend**

- CÃ¡c block mÃ¡y sáº£n xuáº¥t vÃ  badge realtime.
- Danh sÃ¡ch chá» vÃ  lá»‹ch sá»­.
- ThÃªm, há»§y vÃ  khÃ´i phá»¥c thÃ´ng bÃ¡o.
- Sá»­a kÃ­ch thÆ°á»›c sai.
- Pháº£n há»“i xung Ä‘á»™t khi nhiá»u POS cÃ¹ng xá»­ lÃ½.

**Backend, Database vÃ  Integration**

- Schema mÃ¡y sáº£n xuáº¥t, sá»± kiá»‡n vÃ  lá»‹ch sá»­ hÃ ng Ä‘á»£i.
- Endpoint nháº­n thÃ´ng bÃ¡o tá»« mÃ¡y.
- Parser tÃªn file theo Ä‘áº·c táº£ K02-D.
- Atomic claim chá»‘ng xá»­ lÃ½ trÃ¹ng.
- Realtime broadcast vÃ  lÆ°u lá»‹ch sá»­ 10 ngÃ y.

**Äiá»u kiá»‡n nghiá»‡m thu**

- Sá»± kiá»‡n tá»« mÃ¡y xuáº¥t hiá»‡n trÃªn má»i POS.
- Hai POS khÃ´ng xá»­ lÃ½ Ä‘Æ°á»£c cÃ¹ng má»™t thÃ´ng bÃ¡o.
- Parse Ä‘Ãºng khÃ¡ch, hÃ ng, kÃ­ch thÆ°á»›c vÃ  sá»‘ lÆ°á»£ng.
- ThÃ´ng bÃ¡o khÃ´i phá»¥c trá»Ÿ láº¡i toÃ n bá»™ POS.

### Giai Ä‘oáº¡n 7 â€” Bill nÃ¢ng cao vÃ  há»— trá»£ gá»­i khÃ¡ch

**TÃ­nh nÄƒng bÃ n giao:** NgÆ°á»i dÃ¹ng quáº£n lÃ½ nhiá»u máº«u bill, in vÃ  chuáº©n bá»‹ áº£nh bill Ä‘á»ƒ gá»­i qua kÃªnh khÃ¡ch Ä‘Ã£ cáº¥u hÃ¬nh.

**Frontend**

- Quáº£n lÃ½ tab bill vÃ  mÃ¡y in.
- Nhá»› cáº¥u hÃ¬nh theo khÃ¡ch hÃ ng.
- Sinh vÃ  xem trÆ°á»›c áº£nh bill.
- Copy áº£nh vÃ o Clipboard.
- Má»Ÿ nÆ¡i gá»­i Ä‘Ã£ cáº¥u hÃ¬nh.

**Backend vÃ  Database**

- Schema máº«u bill vÃ  cáº¥u hÃ¬nh bill theo khÃ¡ch.
- API láº¥y vÃ  lÆ°u cáº¥u hÃ¬nh bill.
- Thá»‘ng kÃª máº«u bill Ä‘Æ°á»£c sá»­ dá»¥ng.
- Backend rendering dá»± phÃ²ng náº¿u Frontend khÃ´ng Ä‘áº£m báº£o layout.

**Äiá»u kiá»‡n nghiá»‡m thu**

- In Ä‘Æ°á»£c má»™t hoáº·c nhiá»u bill.
- Cáº¥u hÃ¬nh Ä‘Æ°á»£c nhá»› theo khÃ¡ch.
- KhÃ´ng tá»± gá»­i khi nhÃ¢n viÃªn chÆ°a xÃ¡c nháº­n.
- Lá»—i má»Ÿ á»©ng dá»¥ng khÃ´ng lÃ m máº¥t bill.

### Giai Ä‘oáº¡n 8 â€” Production vÃ  váº­n hÃ nh

**TÃ­nh nÄƒng bÃ n giao:** Há»‡ thá»‘ng Ä‘á»§ an toÃ n Ä‘á»ƒ cháº¡y tháº­t táº¡i xÆ°á»Ÿng vÃ  cÃ³ thá»ƒ khÃ´i phá»¥c khi gáº·p sá»± cá»‘.

- HoÃ n thiá»‡n RLS vÃ  permission.
- Audit log cho cÃ¡c thao tÃ¡c quan trá»ng.
- Backup tá»± Ä‘á»™ng vÃ  diá»…n táº­p restore.
- Monitoring, tracing vÃ  cáº£nh bÃ¡o lá»—i.
- Kiá»ƒm thá»­ E2E toÃ n bá»™ luá»“ng bÃ¡n hÃ ng.
- Kiá»ƒm thá»­ Ä‘á»“ng thá»i nhiá»u POS.
- Kiá»ƒm thá»­ hiá»‡u nÄƒng tÃ¬m kiáº¿m vÃ  checkout.
- Quy trÃ¬nh rollback.
- HÆ°á»›ng dáº«n váº­n hÃ nh cho thu ngÃ¢n vÃ  quáº£n trá»‹ viÃªn.

**Äiá»u kiá»‡n nghiá»‡m thu**

- CÃ³ dashboard sá»©c khá»e há»‡ thá»‘ng vÃ  cáº£nh bÃ¡o hoáº¡t Ä‘á»™ng.
- Backup Ä‘Æ°á»£c táº¡o tá»± Ä‘á»™ng vÃ  restore thá»­ thÃ nh cÃ´ng.
- CÃ³ thá»ƒ rollback má»™t phiÃªn báº£n lá»—i.
- CÃ¡c luá»“ng E2E trá»ng yáº¿u cháº¡y á»•n Ä‘á»‹nh trÃªn production-like environment.

---

## 5. DEFINITION OF DONE CHUNG

Má»™t giai Ä‘oáº¡n chá»‰ hoÃ n thÃ nh khi Ä‘Ã¡p á»©ng toÃ n bá»™ Ä‘iá»u kiá»‡n sau:

- FE sá»­ dá»¥ng Backend tháº­t, khÃ´ng dÃ¹ng mock Ä‘á»ƒ nghiá»‡m thu.
- CÃ³ migration vÃ  seed data tÃ¡i láº­p Ä‘Æ°á»£c mÃ´i trÆ°á»ng.
- Backend kiá»ƒm tra authentication, permission vÃ  validation.
- CÃ³ unit test cho Business Rule Ä‘Æ°á»£c triá»ƒn khai.
- CÃ³ integration test cho API vÃ  Database.
- CÃ³ Ã­t nháº¥t má»™t luá»“ng E2E cháº¡y trÃªn trÃ¬nh duyá»‡t.
- Deploy thÃ nh cÃ´ng lÃªn staging.
- Log vÃ  lá»—i Ä‘á»§ Ä‘á»ƒ truy váº¿t sá»± cá»‘.
- Owner cháº¡y thá»­ vÃ  cháº¥p nháº­n káº¿t quáº£.
- TÃ i liá»‡u liÃªn quan á»Ÿ cÃ¡c táº§ng 02â€“07 Ä‘Æ°á»£c cáº­p nháº­t.

---

## 6. Rá»¦I RO VÃ€ ÄIá»€U KIá»†N PHáº¢I CHá»T

CÃ¡c ná»™i dung sau pháº£i Ä‘Æ°á»£c giáº£i quyáº¿t trÆ°á»›c hoáº·c trong giai Ä‘oáº¡n tÆ°Æ¡ng á»©ng:

| Ná»™i dung | Quyáº¿t Ä‘á»‹nh / thá»i Ä‘iá»ƒm xem láº¡i |
|---|---|
| CÃ¡ch tá»• chá»©c Backend | âœ… Chá»‘t: backend cu da go Edge Functions + REST `/api/v1`; FE chá»‰ dÃ¹ng SDK trá»±c tiáº¿p cho Auth/Realtime |
| Schema báº£ng giÃ¡ | âœ… ÄÃ£ cÃ³ PriceBook formula MVP; má»Ÿ rá»™ng nhÃ³m hÃ ng/filter cáº§n slice riÃªng |
| CÆ¡ cháº¿ lÆ°u nhÃ¡p | âœ… Chá»‘t hiá»‡n táº¡i: LocalStorage theo mÃ¡y táº¡i `POS/ARCHITECTURE.md`; server draft chá»‰ má»Ÿ khi cÃ³ SoT má»›i |
| ERD Sales, Inventory vÃ  Finance | âœ… ÄÃ£ cÃ³ foundation; má»—i slice má»›i pháº£i rÃ  láº¡i schema liÃªn quan |
| ChÃ­nh sÃ¡ch tá»“n Ã¢m vÃ  cáº£nh bÃ¡o thiáº¿u kho | âœ… MVP cho bÃ¡n thiáº¿u/tá»“n Ã¢m cÃ³ cáº£nh bÃ¡o nháº¹; quy chuáº©n cuá»™n/táº¥m lÃ m dáº§n |
| Há»£p Ä‘á»“ng dá»¯ liá»‡u thá»±c táº¿ vá»›i mÃ¡y in/CNC | Production queue foundation Ä‘Ã£ cÃ³; ingestion/match tá»± Ä‘á»™ng lÃ  pháº¡m vi má»Ÿ rá»™ng cáº§n spec riÃªng |
| Kháº£ nÄƒng má»Ÿ Zalo/Facebook theo mÃ´i trÆ°á»ng mÃ¡y POS | NgoÃ i MVP hiá»‡n táº¡i; chá»‰ xem láº¡i khi Owner chá»‘t gá»­i khÃ¡ch tá»± Ä‘á»™ng |
| RPO, RTO vÃ  chÃ­nh sÃ¡ch lÆ°u backup | Xem láº¡i trÆ°á»›c production tháº­t |

---

## 7. THá»¨ Tá»° THá»°C HIá»†N

```text
Ná»n táº£ng
   â†“
Danh má»¥c + KhÃ¡ch hÃ ng
   â†“
Giá» hÃ ng + NhÃ¡p
   â†“
BÃ¡o giÃ¡
   â†“
Thanh toÃ¡n + Kho + CÃ´ng ná»£        â† MVP ná»™i bá»™
   â†“
BOM + Váº­t tÆ°
   â†“
MÃ¡y tráº¡m Realtime
   â†“
Bill nÃ¢ng cao
   â†“
Production
```

KhÃ´ng báº¯t Ä‘áº§u giai Ä‘oáº¡n káº¿ tiáº¿p náº¿u tiÃªu chÃ­ nghiá»‡m thu cá»‘t lÃµi cá»§a giai Ä‘oáº¡n hiá»‡n táº¡i chÆ°a Ä‘áº¡t, trá»« khi pháº§n cÃ´ng viá»‡c cháº¡y song song khÃ´ng phá»¥ thuá»™c vÃ  khÃ´ng lÃ m thay Ä‘á»•i Source of Truth Ä‘ang chá» chá»‘t.
