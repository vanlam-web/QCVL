# Spec Gap Next Work — Deduped

> Ngay lap: 2026-07-05
> Nhanh: `codex/spec-docs`
> Trang thai: Draft dieu phoi da dong bo va push len main tai commit `3b50523`

## 1. Nguyen tac loc trung

Khong viet lai cac noi dung da co trong:

- `docs/DEVELOPMENT-PLAN.md`
- `docs/PHASE-CHECKLIST.md`
- `docs/superpowers/specs/2026-06-30-qc-oms-spec-gap-backlog.md`
- Source of Truth cac tang `02-PRD-UX`, `03-BUSINESS`, `04-DATABASE`, `05-BACKEND`

File nay chi giu nhung viec con thieu o muc **implementation bridge**: noi giua dac ta da co va viec code can lam, de tranh AI sau viet lai roadmap hoac lam trung module.

## 1B. Checklist hien trang

- [x] Loai viec trung voi roadmap/checklist cu.
- [x] Tao Inventory UI implementation bridge.
- [x] Sync SalesDocuments docs theo filter/detail hien tai.
- [x] Tao Finance UI implementation bridge.
- [x] Tao Reports API/UI bridge.
- [x] Bo sung Business Inventory ve ton tam m2, chuan hoa dan, khui vat tu, tam/reo.
- [x] Dong bo docs vao main trong commit `68f3cff`.
- [x] Remote `main` da cap nhat tai commit `3b50523`.
- [ ] Owner review lai docs sau khi push.

## 2. Viec da loai vi trung

| Viec | Ly do loai |
|---|---|
| Viet lai roadmap Phase 0-8 | Da co trong `docs/DEVELOPMENT-PLAN.md` |
| Viet lai checklist phase | Da co trong `docs/PHASE-CHECKLIST.md` |
| Viet lai Sales/POS checkout, debt, cashbook foundation | Da co Business/DB/API va da implement qua cac phase truoc |
| Viet lai Inventory policy tong | Da co Business Inventory, Database Inventory va Backend Inventory API |
| Viet lai Production queue draft | Da co `2026-07-01-production-queue-contract-draft.md`; chi can chuyen thanh SoT khi bat dau phase |
| Viet lai BOM boundary draft | Da co `2026-07-01-bom-combo-mvp-boundary-draft.md`; chua nen implement sau khi chua toi phase |
| Viet lai Bill/Printer/Messaging draft | Da co `2026-07-01-bill-printer-messaging-draft.md` |
| Viet lai Production/Backup baseline | Da co `docs/07-DEPLOYMENT-TrienKhai/PRODUCTION.md` va `BACKUP-RESTORE.md` |
| Mo scope Dat hang, Tra hang, COD, Van don, HDĐT, VAT, HR, campaign retail | Da bi loai trong MVP scope |

## 3. Bridge da tao va viec con mo

### P0 — Inventory UI implementation bridge

- [x] `docs/superpowers/specs/2026-07-05-inventory-ui-implementation-bridge.md`
- [x] Main co `/inventory`, list, detail, movement history va normal stock adjustment UI.
- [x] Business Inventory da ghi ton tam m2, chuan hoa dan, khui vat tu, tam/reo.
- [ ] Con mo: khui vat tu UI, stocktake UI day du, quan ly cuon/tam vat ly theo object.

### P1 — SalesDocuments docs sync

- [x] filter hien tai, nguoi ban/nguoi tao gom mot, tab lich su thanh toan chua goi API rieng.
- [x] `docs/02-PRD-UX-PhongCanh/SalesDocuments/01-SALES-DOCUMENT-LIST.md`
- [x] `docs/02-PRD-UX-PhongCanh/SalesDocuments/02-SALES-DOCUMENT-DETAIL.md`
- [ ] Con mo: sua/huy hoa don co dao kho/tien/cong no.

### P2 — Finance UI implementation bridge

- [x] `docs/superpowers/specs/2026-07-05-finance-ui-implementation-bridge.md`
- [x] Main co `/finance`, accounts/cashbook, customer debt, debt collection form va voucher readonly list.
- [ ] Con mo: payment receipt list endpoint rieng, reconciliation UI.

### P3 — Reports API/UI bridge

- [x] `docs/superpowers/specs/2026-07-05-reports-api-ui-bridge.md`
- [x] Main co `/reports`, End of Day, Sales, Debt va Inventory report baseline.
- [ ] Con mo: API tong hop `/reports/*` khi report can thanh nguon so lieu chinh thuc.

## 3B. Viec con mo sau khi dong bo

- [ ] Owner review docs bridge va Inventory business updates.
- [ ] Khi bat dau slice moi, cap nhat SoT truoc, bridge chi dung de doi chieu.
- [ ] Khi implement report chinh thuc, xem xet tao API `/reports/*` de tranh UI tu cong so lieu quan trong.
- [ ] Khi implement khui vat tu, dua rule tu bridge vao PRD/Business/API tuong ung truoc khi code.

## 4. Viec de sau, chua viet tiep bay gio

| Viec | Ly do |
|---|---|
| BOM UI/API/schema chi tiet | Da co draft boundary; doi toi phase BOM de chot theo du lieu thuc |
| Production queue SoT day du | Da co draft; doi khi bat dau ingestion/realtime day du |
| Bill advanced/messaging SoT | Da co draft; doi sau SalesDocuments/Bill print nhu cau ro hon |
| Purchase roll/sheet object P4 | Doi Inventory object model on dinh hon |
| Production hardening checklist | Doi ha tang production that ro cong cu monitoring/alert |

## 5. Nguyen tac doc file nay

`docs/IMPLEMENTATION-CHECKLIST.md` hien da duoc luong implement commit trong `68f3cff`; file nay chi giu checklist dac ta/dieu phoi de tranh trung roadmap.
