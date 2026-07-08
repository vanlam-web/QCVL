# QC-OMS Phase Checklist

> **Vai trÃ²:** Checklist sá»‘ng cho tráº¡ng thÃ¡i hiá»‡n táº¡i, queue tiáº¿p theo vÃ  handoff giá»¯a cÃ¡c luá»“ng Codex.
> **Cáº­p nháº­t:** 2026-07-08.

File nay chi giu tinh trang hien tai va tom tat cac moc da merge. Log trien khai chi tiet nam trong Git history.

Quy trÃ¬nh phá»‘i há»£p:

- [WORKFLOW-SPEC-IMPLEMENT.md](./WORKFLOW-SPEC-IMPLEMENT.md)
- [WORKFLOW-AUTO-SPEC-IMPLEMENT.md](./WORKFLOW-AUTO-SPEC-IMPLEMENT.md)
- [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md)
- [REVIEW-ISSUES.md](./REVIEW-ISSUES.md)

---

## Hiá»‡n táº¡i

| Má»¥c | TÃ¬nh tráº¡ng |
|---|---|
| Branch chÃ­nh | `main` |
| Backend dev/staging | QCVL Node API + PostgreSQL tren NAS |
| Local backend | QCVL Node API chay tu server/ khi can dev local |
| Active coordination board | CÃ³ item `COORD-2026-07-07-PRODUCT-INVENTORY-POS` Ä‘ang má»Ÿ trong [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md) |
| Review issue cÃ²n má»Ÿ | CÃ³ `REV-2026-07-08-001` trong [REVIEW-ISSUES.md](./REVIEW-ISSUES.md) |
| Docs cleanup | ÄÃ£ chuáº©n hoÃ¡ index/metadata; checklist nÃ y lÃ  nguá»“n xem tráº¡ng thÃ¡i sá»‘ng |
| Current product/inventory/POS direction | Äang hoÃ n táº¥t HÃ ng hÃ³a â†’ Kiá»ƒm kho hÃ ng thÆ°á»ng â†’ Cuá»™n/táº¥m/khui object-level â†’ POS trá»« kho tháº­t; normal/combo checkout Ä‘Ã£ cÃ³ `sale_deduction`, roll/sheet POS object-level deduction cÃ²n pending |

---

## ÄÃ£ Merge VÃ o `main`

| Má»‘c | PR / commit | Ghi chÃº |
|---|---|---|
| Phase 0 â€” Foundation | history trÆ°á»›c PR #1 | Auth/profile/workstation/permission, API core, POS shell ná»n |
| Phase 1A â€” Catalog/Pricing | PR #1, `b503e98` | Product catalog, price list, pricing resolve |
| Phase 1B â€” Customer/Pricing | PR #2 | Customer/customer group, chá»n khÃ¡ch trong POS, giÃ¡ theo nhÃ³m khÃ¡ch |
| Phase 1C â€” Checkout/Inventory/Finance foundation | PR #4, `2b83df7` | Checkout transaction, order/items, stock movement, payment/debt/cashbook |
| Phase 2A â€” POS direct checkout UI | PR #5, `cf82542` | Cart editable, payment fields, customer debt, receipt summary |
| Phase 2B â€” Production queue foundation | PR #6, `80b521e` | K02-D queue, claim/add-to-draft/dismiss/restore |
| Phase 2C â€” Line discount | PR #7, `1d7a6f5` | Discount UI/backend persistence |
| Phase 2D â€” Sales Documents readonly | PR #8, `552db05` | List/detail hÃ³a Ä‘Æ¡n `HD...` |
| Phase 3A â€” Quote/reopen | PR #15, `f6df941` | LÆ°u bÃ¡o giÃ¡ `BG...`, má»Ÿ láº¡i vÃ o POS draft |
| PriceBook zero-price correction | PR #16, `75ebc89` | KhÃ´ng fallback sai khi giÃ¡ báº±ng `0` |
| PriceBook formula MVP | PR #17, `c72ab46` | Structured formula, preview/apply, rounding |
| POS checkout data integrity | PR #18, `5544421` | Cá»§ng cá»‘ dá»¯ liá»‡u checkout |
| Sales Documents dimensions detail | PR #19, `e34bc61` | Chi tiáº¿t kÃ­ch thÆ°á»›c/m2/mÃ©t tá»›i |
| PriceBook UI refinement | PR #20, `3374312` | Grid-first UI, cá»™t Chi phÃ­/Lá»£i nhuáº­n |
| Docs/spec sync | PR #21, `b8c1af7` | Äá»“ng bá»™ SoT vÃ  bridge docs |
| Quote print Phase 3B | PR #22, `2c5e067` | In/xem bÃ¡o giÃ¡ Ä‘Æ¡n giáº£n |
| Sales Documents payment history | Commit `ec23e1b` | Ná»‘i tab lá»‹ch sá»­ thanh toÃ¡n tá»« `payment_receipts`, fallback dá»¯ liá»‡u thiáº¿u Ä‘á»ƒ khÃ´ng sáº­p detail |
| Purchase P1 â€” Supplier foundation | PR #23, `ad19559` | Danh sÃ¡ch/chi tiáº¿t NCC, linked customer |
| Purchase P2 â€” Receipt draft/list/detail | PR #24, `0239061` | Phiáº¿u nháº­p draft/list/detail cho hÃ ng thÆ°á»ng |
| Purchase P3 â€” Post normal receipt | PR #26, `2c87a6e` | HoÃ n thÃ nh phiáº¿u nháº­p hÃ ng thÆ°á»ng, tÄƒng tá»“n/cÃ´ng ná»£/cashbook |
| Purchase P5 â€” Supplier payments | PR #30 | Chi tiá»n/thanh toÃ¡n NCC sau phiáº¿u nháº­p |

---

## Queue CÃ³ Thá»ƒ Má»Ÿ Tiáº¿p

Chá»‰ má»Ÿ khi Owner chá»n vÃ  Spec xÃ¡c nháº­n Source of Truth cÃ²n Ä‘Ãºng vá»›i hiá»‡n tráº¡ng code.

| Viá»‡c | Má»©c sáºµn sÃ ng | Ghi chÃº |
|---|---|---|
| Purchase P4 â€” nháº­p cuá»™n/táº¥m váº­t lÃ½ | Trung bÃ¬nh | Cáº§n khá»›p vá»›i model kho cuá»™n/táº¥m hiá»‡n táº¡i trÆ°á»›c khi implement |
| Product/Inventory/POS completion | Äang má»Ÿ | Theo dÃµi á»Ÿ `COORD-2026-07-07-PRODUCT-INVENTORY-POS`; pháº§n cÃ²n láº¡i chÃ­nh lÃ  POS roll/sheet object-level deduction vÃ  drift `/pos/cart/validate` |
| PriceBook product groups/filter | Trung bÃ¬nh | Cáº§n schema/UI filter nhÃ³m hÃ ng náº¿u Owner cáº§n |
| Sales Documents edit/cancel/reversal | Cáº§n chá»‘t thÃªm | Cháº¡m kho/tiá»n/cÃ´ng ná»£, pháº£i cÃ³ spec Ä‘áº£o nghiá»‡p vá»¥ |
| Production reconciliation má»Ÿ rá»™ng | Cáº§n review hiá»‡n tráº¡ng | Chá»‰ lÃ m khi Ä‘Ã£ xÃ¡c nháº­n pháº§n read-only hiá»‡n táº¡i vÃ  dá»¯ liá»‡u mÃ¡y sáº£n xuáº¥t |
| Realtime module updates | Trung bÃ¬nh | Chá»‰ má»Ÿ cho module cÃ³ lá»£i rÃµ nhÆ° production queue hoáº·c stock/user lock |

---

## ChÆ°a NÃªn Má»Ÿ Náº¿u ChÆ°a Chá»‘t ThÃªm

- Sá»­a/há»§y hÃ³a Ä‘Æ¡n cÃ³ Ä‘áº£o kho/tiá»n/cÃ´ng ná»£.
- Purchase return/tráº£ hÃ ng nháº­p.
- MÃ¡y sáº£n xuáº¥t tá»± Ä‘á»™ng trá»« kho hoáº·c tá»± match file vá»›i bill.
- HÄÄT/VAT, delivery/COD, kÃªnh online.
- Loyalty/campaign, HR/payroll/timesheet/commission.
- CÃ´ng thá»©c PriceBook kiá»ƒu Excel/free-form.

---

## Lá»‡nh ThÆ°á»ng DÃ¹ng

```bash
cd /Users/vanlam/Documents/project/QC-OMS

git switch main
git status --short --branch

npm ci
npm run dev

npm test
npm run typecheck
npm run lint
npm run build

# Optional local isolated QCVL Node API
npm run api:dev
npm run db:migrate
npm run smoke:nas
```
