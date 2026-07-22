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
- [x] Tat ca `created_at`/`paid_at` di qua `date-format.ts`.
  - Da audit finance/manual voucher/edit/linked-document flows: `FinancePage.tsx`, `FinanceCashbookEditDialog.tsx`, `FinanceDetailPanel.tsx` chi dung helper chung `date-format.ts` + `finance-presenter.ts`, khong con local clock formatting cho `created_at`/`paid_at`.
- [x] Test sua phieu thu/chi va phieu lien ket hoa don/phieu nhap.
  - 2026-07-22 finance audit: `npx vitest run src/lib/date-format.test.ts src/features/finance/FinancePage.test.tsx src/features/finance/finance-presenter.test.ts src/features/finance/finance-service.test.ts server/db.test.ts server/dev-memory-repository.test.ts` (176 passed), `npm run typecheck`, `git diff --check`.
- [x] Cap nhat docs + TeamAI.

### 1.1. Finance: Chot 3 loi nghiep vu con lech

- [x] Sau khi sua hoa don, huy hoa don cu.
  - Da co rule trong POS invoice revision: `POST /api/v1/orders/{id}/revise` tao hoa don `MaCu.01`, set hoa don goc `cancelled`, `cancel_reason_type = revised`, `replaced_by_order_id = hoa don moi`. Regression co trong `server/http.test.ts`.
- [x] Tao phieu thu/chi: chon ngan hang phai chon duoc tai khoan.
  - Da doi tai khoan thu/chi trong modal tao phieu sang `ManagementDropdownField` chung, giong modal sua phieu.
  - Da bo sung tai khoan ngan hang vao dialog thanh toan cong no khach hang; payload gui `bank_account_id` khi thu chuyen khoan.
- [x] Thanh toan cong no khach hang: so quy hien dung khach hang, khong hien `Nguoi nhan: khach hang`.
  - Da sua PostgreSQL `collectCustomerDebt` lay customer snapshot theo `customerId` lam counterparty cho cashbook receipt, fallback debt row chi dung khi snapshot thieu.
- [x] Test 3 luong tren + cap nhat docs + TeamAI.
  - Test: `npx vitest run src/features/finance/FinancePage.test.tsx src/features/finance/finance-presenter.test.ts src/features/finance/finance-service.test.ts server/db.test.ts server/dev-memory-repository.test.ts` (166 passed), `npm run typecheck`, `git diff --check`.
  - Test bo sung cong no KH: `npx vitest run src/features/catalog/CustomersPage.test.tsx` (30 passed), `npm run typecheck`.

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

- [x] Tach list/detail/action footer.
  - Da tach `PurchaseReceiptList` ra component rieng, gom bang danh sach + empty state + pagination + favorite/select/sort.
  - Da tach `PurchaseReceiptActionFooter` ra component rieng, gom cac nut Huy/Sao chep/Xuat file/Thanh toan NCC/Mo phieu/Luu/In cua detail posted.
- [x] Tach create/edit form.
  - 2026-07-22 partial: da tach form detail/edit draft sang `src/features/purchase/PurchaseReceiptForm.tsx`; create workspace con nam trong `PurchaseReceiptsPage.tsx`, chua tick full.
  - 2026-07-22 create slice: da tach workspace tao phieu sang `src/features/purchase/PurchaseReceiptCreateWorkspace.tsx`; page chi giu state, search, service calls, save/post orchestration.
- [x] Tach payment panel.
  - Da tach `PurchaseReceiptPaymentHistory` ra component rieng, dung chung cho 2 tab thanh toan NCC.
  - Da tach `PurchaseReceiptSupplierPaymentForm` ra component rieng, dung chung cho 2 vi tri thanh toan NCC.
  - 2026-07-22 verify: `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/purchase/purchase-receipt-presenter.test.ts src/features/purchase/purchase-receipt-calculations.test.ts src/features/purchase/purchase-receipt-service.test.ts` (51 passed).
- [x] Xoa field khong co DB/API hoac render disabled/empty ro.
  - Da bo field rong `Ma dat hang nhap` khoi UI tao phieu vi hien tai khong co DB/API source.
- [x] Test purchase page + service + server.
  - 2026-07-22 detail/edit form slice: `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/purchase/purchase-receipt-presenter.test.ts src/features/purchase/purchase-receipt-calculations.test.ts src/features/purchase/purchase-receipt-service.test.ts` (51 passed), `npm run typecheck`, `git diff --check`.
  - 2026-07-22 action footer slice: `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/purchase/purchase-receipt-presenter.test.ts src/features/purchase/purchase-receipt-calculations.test.ts src/features/purchase/purchase-receipt-service.test.ts` (51 passed), `npm run typecheck`.
  - 2026-07-22 create workspace slice: `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/purchase/purchase-receipt-presenter.test.ts src/features/purchase/purchase-receipt-calculations.test.ts src/features/purchase/purchase-receipt-service.test.ts` (51 passed), `npm run typecheck`, `git diff --check`.
  - 2026-07-22 server/final purchase slice: `npx vitest run src/features/purchase/PurchaseReceiptsPage.test.tsx src/features/purchase/purchase-receipt-presenter.test.ts src/features/purchase/purchase-receipt-calculations.test.ts src/features/purchase/purchase-receipt-service.test.ts server/db.test.ts server/dev-memory-repository.test.ts server/modules/purchase/purchase-receipt-import.test.ts` (159 passed), `npm run typecheck`, `npm run lint` (0 errors, 16 existing warnings), `git diff --check`.
- [x] Cap nhat docs + TeamAI.

## 4. Customers: Tach Debt UI Khoi Page

- [x] Tach `CustomerDebtPanel`.
  - Da tach tab/bang cong no sang `src/features/catalog/CustomerDebtPanel.tsx`; `CustomersPage.tsx` khong con render truc tiep bang cong no.
- [x] Tach `CustomerDebtPaymentDialog`.
  - Da tach dialog thanh toan cong no sang `src/features/catalog/CustomerDebtPaymentDialog.tsx`; page chi giu flow mo dialog, form state, va submit.
- [x] Tach `CustomerDebtAdjustmentDialog`.
  - Da tach dialog dieu chinh cong no sang `src/features/catalog/CustomerDebtAdjustmentDialog.tsx`; form type + helper parse/format thoi gian nam o `src/features/catalog/customer-debt-adjustment-form.ts`.
- [x] Cong thuc no chi nam ledger/core/backend.
  - Da chuyen cong thuc tong hop/phan bo cong no sang `src/features/catalog/customer-debt-ledger.ts`; UI panel/dialog chi render va gui input.
- [x] Test customer debt page/core/server.
  - 2026-07-22 server pass: `npx vitest run server/db.test.ts server/dev-memory-repository.test.ts src/features/catalog/CustomersPage.test.tsx src/features/catalog/customer-debt-ledger.test.ts` (138 passed), `git diff --check`.
  - 2026-07-22 core slice: `npx vitest run src/features/catalog/CustomersPage.test.tsx src/features/catalog/customer-debt-ledger.test.ts` (37 passed), `npm run typecheck`.
  - 2026-07-22 adjustment dialog slice: `npx vitest run src/features/catalog/CustomersPage.test.tsx` (30 passed), `npm run typecheck`.
- [x] Cap nhat docs + TeamAI.

## 5. POS: Tach `PosShell.tsx`

- [x] Tach recent invoice dialog.
  - Da tach `RecentInvoicesDialog` khoi `PosShell.tsx`; page chi giu state/load/open invoice. Page-size constant nam o `src/features/pos/recent-invoices.ts`.
- [x] Tach product quick grid/search state.
  - Da tach hook `usePosProductSearch` vao `src/features/pos/pos-product-search.ts`; `PosShell.tsx` khong con tu giu debounce/search rank/load quick products.
- [x] Tach material opening dialog.
  - Da tach `PosQuickMaterialOpeningDialog` va `PosManualMaterialOpeningDialog` vao `src/features/pos/PosMaterialOpeningDialogs.tsx`; `PosShell.tsx` giu state/API submit.
- [ ] Khong doi checkout debt rule neu chua co scope rieng.
- [ ] Test POS focused.
  - 2026-07-22 recent invoice slice: `npx vitest run src/features/pos/PosShell.test.tsx` (58 passed), `npm run typecheck`.
  - 2026-07-22 product search slice: `npx vitest run src/features/pos/PosShell.test.tsx src/features/pos/CheckoutPanel.test.tsx src/features/pos/CustomerPanel.test.tsx` (104 passed), `npm run typecheck`.
  - 2026-07-22 material opening dialog slice: `npx vitest run src/features/pos/PosShell.test.tsx src/features/pos/CheckoutPanel.test.tsx src/features/pos/CustomerPanel.test.tsx` (104 passed), `npm run typecheck`.
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
