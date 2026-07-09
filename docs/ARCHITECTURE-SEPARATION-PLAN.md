# Architecture Separation Plan

> Cap nhat: 2026-07-09. Muc tieu: tach vo UI va ruot nghiep vu/toan bo du an theo tung lat cat nho, co test, khong lam vo luong ban hang.

## Nguyen Tac

- Khong refactor toan bo bang mot commit lon.
- Moi batch chi cham 1-2 feature hoac 1 helper dung chung.
- Page React chi render, giu state UI, bat event.
- Query/API contract nam trong `*-service.ts` hoac `*-filters.ts`.
- Label/tone/format/view mapping nam trong `*-presenter.ts`.
- Tinh tien, cong no, so quy, ton kho nam backend/service/core co test.
- Sau moi batch phai chay `npm run typecheck`, `npm run lint`, test lien quan, va neu doi shared core thi chay `npm test`.

## Trang Thai Hien Tai

| Khu vuc | Trang thai | Viec can tach tiep |
| --- | --- | --- |
| Sales Documents | Da tach filters/presenter/detail/print helper | Chi tach tiep khi them nghiep vu moi |
| Finance | Da tach presenter/filter/storage | Chi tach tiep khi co logic moi trong page |
| Purchase Receipts | Da tach calculations/presenter/filter | Chi tach tiep khi co logic moi trong page |
| Suppliers | Da tach presenter/filter | Chi tach tiep khi them thanh toan/nha cung cap phuc tap |
| Customers | Da tach filters/presenter | Tach tiep `customer-history-presenter.ts` neu lich su phuc tap hon |
| POS | Da tach cart/payment vao `pos-core.ts` | Chi tach tiep presenter nho neu UI phat sinh label moi |
| Inventory | Da tach presenter/list summary | Tach tiep filter/list summary khi sua tiep |
| Catalog/PriceBook | Catalog da tach presenter/storage | PriceBook tach khi phat sinh logic moi |
| Reports | Da tach presenter | Chi tach tiep khi them report moi |
| Admin/Auth/Account/Dashboard | Da tach presenter/helper | Chi tach tiep khi them logic moi |

## Thu Tu Thuc Hien

1. **Shared foundation**
   - Tao helper date range/time preset dung chung.
   - Tao helper display date/number neu chua co.
   - Khong doi UI.

2. **Finance**
   - Tach label/tone/message/status/detail rows ra `finance-presenter.ts`.
   - Tach time filter, status/direction selection ra `finance-filters.ts`.
   - Tach localStorage pin/favorite ra `finance-storage.ts`.
   - Test presenter/filter/storage.

3. **Purchase**
   - Tach tinh line amount, totals, vat tu/roll/sheet summary ra `purchase-receipt-calculations.ts`.
   - Tach status label, money helper ra presenter.
   - Tach date filter/request params ra filters.
   - Test calculation/filter.

4. **Customers**
   - Tach number filter/request params ra `customer-filters.ts`.
   - Tach status lich su/label tab/no can thu ra presenter.
   - Test filter/presenter.

5. **POS**
   - Khong dua checkout nghiep vu vao UI.
   - Mo rong `pos-core.ts` cho cart totals, line totals, payment defaults.
   - Tach format/presenter rieng neu can.

6. **Inventory/Catalog/Reports**
   - Tach label/status/date/summary nho.
   - Uu tien file nao dang tren 800 dong hoac co nhieu ham helper trong page.

## Definition Of Done Cho Moi Feature

- Page khong con ham `statusText`, `xxxLabel`, `currentMonthRange`, `lineAmount`, `physicalSummary` neu cac ham nay co the dung lai/test rieng.
- Moi helper moi co `*.test.ts`.
- UI test chi test render/interaction, khong test lai cong thuc nghiep vu.
- Service test giu API contract.
- Docs cap nhat khi them convention moi.

## Batch Da Lam Ngay 2026-07-09

- Shared: tao `src/lib/date-ranges.ts` cho date preset dung chung.
- Sales Documents: chuyen quick date range sang shared helper, giu `sales-document-filters.ts` lam boundary cua feature.
- Finance: tao `src/features/finance/finance-presenter.ts`, tach label/status/message/linked document display khoi `FinancePage.tsx`.
- Finance: tao `src/features/finance/finance-filters.ts` va `src/features/finance/finance-storage.ts`, tach query filter va localStorage pin/favorite khoi page.
- Purchase Receipts: tao `src/features/purchase/purchase-receipt-calculations.ts`, tach line amount, totals, roll/sheet summary khoi `PurchaseReceiptsPage.tsx`.
- Purchase Receipts: tao `src/features/purchase/purchase-receipt-presenter.ts` va `src/features/purchase/purchase-receipt-filters.ts`.
- Suppliers: tao `src/features/purchase/supplier-presenter.ts` va `src/features/purchase/supplier-filters.ts`, tach tong no/tong mua/parse filter so khoi `SuppliersPage.tsx`.
- Customers: tao `src/features/catalog/customer-filters.ts`, tach parse number va build customer list filters khoi `CustomersPage.tsx`.
- Customers: tao `src/features/catalog/customer-presenter.ts`, tach label/hien thi khach hang khoi page.
- Inventory: tao `src/features/inventory/inventory-presenter.ts`, tach label/date/money display khoi `InventoryPage.tsx`.
- Inventory: them `inventoryListSummary`, tach tong ton/am kho khoi `InventoryPage.tsx`.
- POS: mo rong `src/features/pos/pos-core.ts` cho checkout summary, line discount, invoice-level discount split, line percent discount, checkout item payload.
- Reports: tao `src/features/reports/reports-presenter.ts`, tach tong quan doanh thu/no/kho va format hien thi khoi `ReportsPage.tsx`.

## Batch Hoan Tat Them Ngay 2026-07-09

- Sales Documents: mo rong `sales-document-presenter.ts` cho list summary, date text, line sell price, quote print money/measure/date/dimension.
- Catalog: tao `src/features/catalog/catalog-presenter.ts` va `src/features/catalog/catalog-storage.ts`, tach format, inventory shape label, BOM normalize, favorite localStorage khoi `CatalogPage.tsx`.
- Account: tao `src/features/account/account-presenter.ts`, tach role/device/date/form/error display khoi `AccountPage.tsx`.
- Admin: tao `src/features/admin/admin-presenter.ts`, tach user status/role, permission label/description/grouping, nullable form khoi `FoundationAdminPage.tsx`.
- Dashboard: tao `src/features/dashboard/dashboard-presenter.ts`, tach chart point/path khoi `DashboardPage.tsx`.
- Customers: mo rong `customer-presenter.ts` cho visible summary va price rule label.
- Finance: mo rong `finance-presenter.ts` cho date text.
- Purchase Receipts: mo rong `purchase-receipt-calculations.ts` cho receipt list summary, supplier payment total/outstanding, sheet group quantity.
- Auth: tao `src/features/auth/auth-presenter.ts`, tach normalize login khoi `LoginPage.tsx`.

## Trang Thai Sau Dot Tach 100%

- Page React con giu JSX, state UI, event handler, filter interaction, open/close panel/dialog, child component thuoc layout.
- Helper con lai trong page neu co la component con render UI (`*Panel`, `*Dialog`, `RankCard`) hoac filter state thao tac truc tiep voi UI.
- Business/presenter/storage/calculation da co file rieng va test rieng cho cac trang dang dung.

## Khong Lam Trong Dot Tach

- Khong doi schema DB neu khong co bug nghiep vu.
- Khong doi API response shape neu UI dang dung.
- Khong deploy NAS tru khi user noi ro "dua len NAS".
- Khong gop/sua fixture demo ngoai pham vi test.
