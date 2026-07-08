# PROJECT-COORDINATION â€” Board Äiá»u Phá»‘i

> **Vai trÃ²:** Board cho viá»‡c Ä‘ang má»Ÿ giá»¯a cÃ¡c luá»“ng Spec / Implement / Review.
> **Cáº­p nháº­t:** 2026-07-08.

File nÃ y chá»‰ dÃ¹ng khi cÃ³ item Ä‘ang cáº§n nhiá»u luá»“ng phá»‘i há»£p. Náº¿u khÃ´ng cÃ³ item Ä‘ang má»Ÿ, xem queue sá»‘ng á»Ÿ [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) vÃ  issue review á»Ÿ [REVIEW-ISSUES.md](./REVIEW-ISSUES.md).

---

## Má»¥c ÄÃ­ch

Board nÃ y giÃºp Owner khÃ´ng pháº£i tá»± chuyá»ƒn lá»i giá»¯a cÃ¡c luá»“ng.

Má»—i viá»‡c Ä‘ang má»Ÿ pháº£i tráº£ lá»i Ä‘Æ°á»£c:

- má»¥c tiÃªu nghiá»‡p vá»¥ lÃ  gÃ¬
- luá»“ng nÃ o Ä‘ang giá»¯ viá»‡c
- luá»“ng nÃ o nháº­n bÆ°á»›c tiáº¿p theo
- branch / PR / commit liÃªn quan
- cÃ³ cáº§n Owner quyáº¿t Ä‘á»‹nh hay khÃ´ng

---

## Máº«u Item

```text
Viá»‡c:
- ID:
- Má»¥c tiÃªu nghiá»‡p vá»¥:
- Luá»“ng Ä‘ang giá»¯: Spec / Implement / Review / Owner
- Luá»“ng nháº­n tiáº¿p: Spec / Implement / Review / Owner
- TÃ¬nh tráº¡ng: Drafting / Implementing / Waiting Spec / Waiting Review / Must Fix / Ready to Merge / Merged / Blocked / Deferred
- Branch / PR / commit:
- Source of Truth:
- BÃ¡o cÃ¡o gáº§n nháº¥t:
- BÆ°á»›c tiáº¿p theo:
- Cáº§n Owner quyáº¿t Ä‘á»‹nh: CÃ³ / KhÃ´ng
- Rá»§i ro:
```

KhÃ´ng xem lÃ  Ä‘Ã£ handoff náº¿u thiáº¿u `Luá»“ng Ä‘ang giá»¯`, `Luá»“ng nháº­n tiáº¿p`, hoáº·c `BÆ°á»›c tiáº¿p theo`.

---

## Board Äang Má»Ÿ

Viá»‡c:
- ID: `COORD-2026-07-07-PRODUCT-INVENTORY-POS`
- Má»¥c tiÃªu nghiá»‡p vá»¥: HoÃ n táº¥t luá»“ng HÃ ng hÃ³a, Kiá»ƒm kho vÃ  POS theo thá»© tá»± Ä‘Ã£ chá»‘t: HÃ ng hÃ³a â†’ Kiá»ƒm kho hÃ ng thÆ°á»ng â†’ Cuá»™n/táº¥m/khui object-level â†’ POS trá»« kho tháº­t.
- Luá»“ng Ä‘ang giá»¯: Implement
- Luá»“ng nháº­n tiáº¿p: Implement
- TÃ¬nh tráº¡ng: Implementing
- Branch / PR / commit: current `main`; historical branch `codex/products-inventory-pos-completion` khÃ´ng cÃ³ trong checkout hiá»‡n táº¡i.
- Source of Truth:
  - [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md)  - [Inventory layout](./02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md)
  - [Stocktake](./02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md)
  - [Khui váº­t tÆ°](./02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)
- BÃ¡o cÃ¡o gáº§n nháº¥t: Task 8 Ä‘Ã£ tick Ä‘á»§ trong plan: DB test `server/tests/database/015_material_opening_normal.test.sql` chá»©ng minh `open_normal_material_tx` táº¡o `inventory_material_openings`, ghi `stock_movements.material_opening_id` khi cáº§n vÃ  khÃ´ng táº¡o `stocktakes`; function/UI test Ä‘Ã£ phá»§ normal, roll, sheet material opening. Task 9 Ä‘Ã£ xong normal checkout `sale_deduction` vÃ  combo BOM component deduction; roll/sheet POS object-level deduction váº«n pending á»Ÿ Step 3. Review cÅ©ng ghi drift `REV-2026-07-08-001`: frontend/docs cÃ³ `/api/v1/pos/cart/validate` nhÆ°ng QCVL Node API router chÆ°a route endpoint nÃ y.
- BÆ°á»›c tiáº¿p theo: Implement chá»‘t Task 9 Step 3 báº±ng má»™t trong hai hÆ°á»›ng: POS gá»­i object roll/sheet Ä‘Æ°á»£c chá»n Ä‘á»ƒ checkout trá»« Ä‘Ãºng object, hoáº·c backend tá»« chá»‘i rÃµ checkout roll/sheet khi thiáº¿u object; Ä‘á»“ng thá»i xá»­ lÃ½ `REV-2026-07-08-001`.
- Cáº§n Owner quyáº¿t Ä‘á»‹nh: KhÃ´ng á»Ÿ bÆ°á»›c hiá»‡n táº¡i. ChÆ°a deploy cloud theo quyáº¿t Ä‘á»‹nh gom batch.
- Rá»§i ro: Kho/stock movement/POS lÃ  vÃ¹ng dá»¯ liá»‡u lÃ¢u dÃ i; má»i slice schema/API/stock movement cáº§n Spec gate vÃ  verification trÆ°á»›c merge.

---

## Máº«u BÃ¡o CÃ¡o Giá»¯a Luá»“ng

```text
TÃ¬nh tráº¡ng:
- ...

Luá»“ng Ä‘ang giá»¯:
- Spec / Implement / Review / Owner

Luá»“ng nháº­n tiáº¿p:
- Spec / Implement / Review / Owner

BÆ°á»›c tiáº¿p theo:
- ...

Cáº§n Owner quyáº¿t Ä‘á»‹nh:
- CÃ³ / KhÃ´ng
```

Náº¿u cáº§n Owner quyáº¿t Ä‘á»‹nh, chá»‰ há»i má»™t cÃ¢u nghiá»‡p vá»¥ ngáº¯n vÃ  kÃ¨m Ä‘á» xuáº¥t máº·c Ä‘á»‹nh.

---

## Khi NÃ o XoÃ¡ Khá»i Board

Má»™t item rá»i board khi:

- Ä‘Ã£ merge vÃ  Ä‘Ã£ report láº¡i Ä‘Ãºng luá»“ng
- Ä‘Ã£ defer cÃ³ lÃ½ do vÃ  trigger quay láº¡i
- bá»‹ block bá»Ÿi quyáº¿t Ä‘á»‹nh Owner vÃ  Ä‘Ã£ bÃ¡o rÃµ
- Ä‘Æ°á»£c thay báº±ng item má»›i cÃ³ link/reference
