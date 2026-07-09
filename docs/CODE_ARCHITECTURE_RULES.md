# Code Architecture Rules

> Cap nhat: 2026-07-09. File nay la quy tac bat buoc de tranh sua UI lam hong nghiep vu.

## Muc Tieu

Moi thay doi code phai tach ro:

- **Vo**: UI, layout, CSS, wording, icon, hover, dropdown, table, modal.
- **Ruot**: business rule, API contract, DB/repository, tinh tien, cong no, so quy, ton kho, trang thai nghiep vu.

Khi sua vo, khong duoc lam thay doi ruot neu user khong yeu cau nghiep vu.

Khi sua ruot, phai co test va khong dua logic nghiep vu moi vao component UI.

## Quy Tac Bat Buoc

1. React page/component chi nen render UI, giu state UI, bat event nguoi dung.
2. API request/query string phai nam trong `*-service.ts` hoac helper filter rieng.
3. Mapping hien thi phai nam trong `*-presenter.ts`, `*-view-model.ts` hoac helper dung chung.
4. Business rule cuoi cung phai nam backend/repository va duoc test o server khi lien quan tien/no/kho/hoa don.
5. CSS phai uu tien class dung chung trong `src/styles/shared.css` hoac component shell co san.
6. Khong copy logic tinh tien/no/trang thai vao nhieu page.
7. Khong dung RAM fixture, localStorage hoac cache UI lam nguon luu du lieu nghiep vu.

## Mau File Chuan Cho Moi Feature

Moi feature nen co cau truc:

```text
src/features/<feature>/
  <FeaturePage>.tsx              # vo: render, event UI, compose components
  <feature>-service.ts           # API boundary, query string, request/response
  <feature>-types.ts hoac types.ts # type dung chung cua feature
  <feature>-filters.ts           # filter state, date range, query params
  <feature>-presenter.ts         # label, tone, format display, view-only mapping
  <feature>-service.test.ts      # test API contract
  <feature>-filters.test.ts      # test filter/query/date
  <feature>-presenter.test.ts    # test label/status display
  <FeaturePage>.test.tsx         # test interaction/render, khong test lai business rule
```

Neu feature nho, co the gop file, nhung khi page bat dau co logic filter/status/format qua 1 man hinh thi phai tach.

## Ranh Gioi Vo

Duoc nam trong page/component:

- JSX, layout, className, icon, button, table, tab.
- State mo/dong dropdown, selected row, hover, focus.
- Goi service qua ham da co interface ro.
- Chuyen event UI thanh input cho helper/service.

Khong duoc nam trong page/component:

- Tinh trang thai hoa don/cong no/so quy.
- Tinh so tien da tra/con no/tru kho.
- Serialize query phuc tap lap lai.
- Mapping label/tone nghiep vu lap o nhieu trang.
- Fetch truc tiep bang `fetch` neu feature da co service.
- Tong hop danh sach bang `reduce/filter` cho tien/no/kho neu ket qua co y nghia nghiep vu. Dua vao `*-presenter.ts`, `*-core.ts` hoac helper co test.

## Ranh Gioi Ruot

Phai nam trong backend/repository/service:

- Checkout, tao bao gia, tao hoa don.
- Ghi phieu thu, cashbook, cong no.
- Cap nhat ton kho.
- Trang thai thanh toan, con no, hoan tat, huy.
- Sap xep/filter API mac dinh co tac dong du lieu.

Frontend chi hien thi ket qua API tra ve, khong tu suy dien ket qua nghiep vu khi backend da co truong du lieu.

## Quy Trinh Khi Sua UI

1. Xac dinh thay doi co anh huong ruot khong.
2. Neu chi UI: sua component/CSS/helper presenter, khong sua backend/DB.
3. Neu can label/status/filter: them/sua `*-presenter.ts` hoac `*-filters.ts` truoc, co test rieng.
4. Chay test feature va typecheck.
5. Cap nhat docs neu them convention moi.

## Quy Trinh Khi Sua Ruot

1. Doc [CURRENT-DATA-SOURCE.md](./CURRENT-DATA-SOURCE.md).
2. Sua DB/repository/API theo Source of Truth.
3. Viet test server truoc khi sua code runtime.
4. Chi cap nhat UI sau khi API contract ro.
5. Chay verify persistence neu lien quan sales/finance.

## Trang Thai Da Tach Ngay 2026-07-09

Sales Documents da tach them:

- `src/features/sales-documents/sales-document-filters.ts`: time filter, multi-select filter, API list request params.
- `src/features/sales-documents/sales-document-presenter.ts`: label/tone trang thai, payment receipt display.
- `src/features/sales-documents/SalesDocumentsPage.tsx`: giu render, state UI, event handler.

Da tach them trong dot sau:

- Finance: `finance-presenter.ts`, `finance-filters.ts`, `finance-storage.ts`.
- Purchase: `purchase-receipt-calculations.ts`, `purchase-receipt-presenter.ts`, `purchase-receipt-filters.ts`, `supplier-presenter.ts`, `supplier-filters.ts`.
- Customers: `customer-filters.ts`, `customer-presenter.ts`.
- Inventory: `inventory-presenter.ts` gom label/date/money va list summary.
- POS: `pos-core.ts` gom cart line total, line discount, checkout summary, checkout item payload, percent discount.
- Reports: `reports-presenter.ts` gom report summary va format hien thi.
- Catalog: `catalog-presenter.ts`, `catalog-storage.ts` gom format, label, normalize BOM, favorite storage.
- Sales Documents: presenter gom list summary, date text, line sell price, quote print display helper.
- Account/Admin/Auth/Dashboard: presenter/helper gom role/status/permission/form/date/chart/login normalization.

Con lai can tiep tuc ap dung khi cham vao feature khac:

- Page con duoc phep giu component con thuoc UI (`*Panel`, `*Dialog`, card render) va filter/event state cuc bo.
- Neu them logic moi cho tien/no/kho/status/date/format/storage/query, phai them vao helper/presenter/filter/storage truoc, co test rieng.

## Dau Hieu Can Dung Lai

Dung lai va tach truoc khi code tiep neu thay:

- Component page dai them do them helper tinh toan.
- Cung mot label/trang thai xuat hien o 2 page bang 2 ham khac nhau.
- Sua CSS ma phai sua logic tien/no/kho.
- Sua filter UI ma backend/API query bi thay doi khong co test.
- Test page phai assert cong thuc nghiep vu thay vi assert UI.
