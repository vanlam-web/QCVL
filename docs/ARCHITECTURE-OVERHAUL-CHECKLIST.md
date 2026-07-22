# Architecture Overhaul Checklist

> Cap nhat: 2026-07-22. Day la checklist dieu phoi dot dai tu code QCVL de tranh chap va.

## Nguyen Tac Lam

- Lam tung checklist nho, khong gom thanh mot refactor lon.
- Moi checklist xong phai chay test lien quan, `npm run typecheck`, va `git diff --check`.
- Neu cham shared UI/CSS thi chay `src/styles/index.test.ts` va test page lien quan.
- Neu cham tien/no/kho/hoa don/thoi gian nghiep vu thi phai co test server hoac core/presenter tuong ung.
- Sau moi checklist: tick trang thai, ghi commit/test vao file nay va `Y:\TeamAI\WORKER-NOW.md`.
- Khong deploy NAS neu Owner chua noi ro deploy.

## 0. Baseline Da Lam

- [x] Search query param frontend dung `search`, backend giu fallback `q`.
  - Commit: `40eb447 refactor: standardize search query params`
  - Test: purchase/supplier/inventory service tests pass.
- [x] POS invoice time dung serializer chung.
  - Commit: `97d2272 refactor: use shared clock serializer for POS invoices`
  - Test: `src/features/pos/PosShell.test.tsx` pass.
- [x] Date-time picker helper chung.
  - Commit: `d3615dc refactor: share date time picker helpers`
  - Test: helper/Customers/Checkout/PosShell tests pass.
- [x] Date-time picker CSS dung shared class.
  - Commit: `641b4f7 refactor: reuse shared date time picker styles`
  - Test: style/management-layout/Customers/Checkout tests pass.

## 1. Finance: Gom Mot UI Sua Phieu

- [x] Audit vi sao co 2 UI sua phieu trong So quy.
  - Ket qua 2026-07-22: `FinancePage.tsx` dang co 2 mau modal khac nhau: modal tao phieu thu/chi (`voucherMode`) va modal sua dong so quy (`cashbookEditPreview`). Edit that chi di qua `openCashbookDetailEdit` -> `cashbookEditPreview`; khong co handler edit thu hai, nhung UI tao/sua dang khac shell/layout nen nguoi dung thay nhu 2 UI. Can gom ve 1 component/dialog pattern chung.
- [x] Chot UI sua phieu duy nhat.
  - Quyet dinh 2026-07-22: UI sua phieu duy nhat la dialog `cashbookEditPreview`, mo tu nut `Sửa` trong `FinanceDetailPanel`. Modal `voucherMode` chi duoc dung de tao phieu thu/chi moi, khong dung lam edit. Khi can sua manual voucher hay phieu sinh tu hoa don/phieu nhap, cung route qua dialog edit nay va API `updateCashbookEntry`.
- [x] Tach dialog sua phieu ra component rieng neu dang nam trong `FinancePage.tsx`.
  - Da tach thanh `src/features/finance/FinanceCashbookEditDialog.tsx`.
  - Commit: checkpoint batch nay
  - Test: `npm run typecheck`, `npx vitest run src/features/finance/FinancePage.test.tsx src/features/finance/finance-presenter.test.ts src/styles/index.test.ts`, `git diff --check`.
- [ ] Tat ca `created_at`/`paid_at` di qua `date-format.ts`.
- [ ] Test sua phieu thu/chi va phieu lien ket hoa don/phieu nhap.
- [ ] Cap nhat docs + TeamAI.

## 2. Finance: Thoi Gian So Quy Chuan

- [x] Viet regression: ban hang thu tien ngay thi hoa don va so quy cung thoi gian.
- [x] Viet regression: thu no sau thi so quy duoc co thoi gian rieng.
- [x] Audit backend mapping invoice -> cashbook.
- [x] Sua mot ham chuan, khong va UI.
- [x] Test server + finance presenter/page.
- [x] Cap nhat docs + TeamAI.
  - Ket qua 2026-07-22: `date-format.ts` la helper chung cho parse/store/format gio. `FinancePage.test.tsx` da co regression tao phieu chi voi thoi gian `15/07/2026 09:25` va luu `2026-07-15T09:25:00.000Z`; `CustomersPage.test.tsx` da co regression thu no luc `18/07/2026 08:20`; `finance-presenter.test.ts` va `date-format.test.ts` giu quy tac khong shift timezone. Backend `server/db.ts` lay `created_at` tu payload da chuan hoa, khong co UI-local override cho luong so quy chuan.
  - Test: `npx vitest run src/lib/date-format.test.ts src/features/catalog/CustomersPage.test.tsx src/features/pos/CheckoutPanel.test.tsx server/db.test.ts server/dev-memory-repository.test.ts`, `npm run api:build`.

## 3. Purchase: Giam `PurchaseReceiptsPage.tsx`

- [ ] Tach list/detail/action footer.
  - Da tach `PurchaseReceiptList` ra component rieng, gom bang danh sach + empty state + pagination + favorite/select/sort.
- [ ] Tach create/edit form.
- [ ] Tach payment panel.
  - Da tach `PurchaseReceiptPaymentHistory` ra component rieng, dung chung cho 2 tab thanh toan NCC.
- [ ] Xoa field khong co DB/API hoac render disabled/empty ro.
- [ ] Test purchase page + service + server.
- [ ] Cap nhat docs + TeamAI.

## 4. Customers: Tach Debt UI Khoi Page

- [ ] Tach `CustomerDebtPanel`.
- [ ] Tach `CustomerDebtPaymentDialog`.
- [ ] Tach `CustomerDebtAdjustmentDialog`.
- [ ] Cong thuc no chi nam ledger/core/backend.
- [ ] Test customer debt page/core/server.
- [ ] Cap nhat docs + TeamAI.

## 5. POS: Tach `PosShell.tsx`

- [ ] Tach recent invoice dialog.
- [ ] Tach product quick grid/search state.
- [ ] Tach material opening dialog.
- [ ] Khong doi checkout debt rule neu chua co scope rieng.
- [ ] Test POS focused.
- [ ] Cap nhat docs + TeamAI.

## 6. CSS Chung

- [ ] Audit page-specific CSS trung shared.
- [ ] Gom modal footer, dropdown, truncation, pagination, compact input.
- [ ] Them style tests cho rule moi.
- [ ] Cap nhat `CODE_ARCHITECTURE_RULES.md`.

## 7. Verify Tong

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run api:build`
- [ ] `npm test -- --run`
- [ ] `git diff --check`
- [ ] Push sau khi Owner chot.
- [ ] Deploy NAS sau khi Owner noi deploy.
