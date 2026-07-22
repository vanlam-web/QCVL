# Code Architecture Rules

> Cap nhat: 2026-07-14. File nay la quy tac bat buoc de tranh sua UI lam hong nghiep vu.

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
8. Dinh dang/parse/serialize thoi gian nghiep vu UI phai di qua helper chung `src/lib/date-format.ts`; filter ngay phai uu tien `src/lib/date-ranges.ts` va query di qua service/repository, khong tinh truc tiep trong JSX.
9. O ngay trong bo loc phai dung `ManagementDateRangeInputs`. UI hien `dd/MM/yyyy` nhu KV, co icon lich va popup lich chung; service/API van nhan `YYYY-MM-DD`.
10. Bo loc chon nhieu dang the phai dung `ManagementChipPicker` + `useChipSelection`. Khong tao picker rieng cho tung page; page chi truyen options, default selected va noi ket qua vao cot/query cua feature.
11. Ten bang gia hien thi phai di qua helper chung `displayPriceListName`. Backend/import co the giu ten nguon `Bang gia le`/`Bảng giá chung`; UI phai hien bang gia mac dinh la `Gia chung` va khong so chuoi rieng trong page.
12. Vung chi tiet duoi gom ghi chu + tong ket phai dung shared class `management-detail-lower management-detail-lower-right`, `management-detail-note`, `management-detail-summary-box management-detail-summary-box-right`. Ghi chu nhap/sua phai dung `ManagementDetailNoteInput`; khong tao textarea/CSS rieng theo tung page neu cung nhu cau. Gia tri tien/so trong summary phai khong xuong dong.
13. Bang dong hang/dong kiem/chung tu con trong expanded detail phai uu tien `management-detail-table` va, neu bo cuc la `ma + ten + cac cot so`, them `management-detail-lines-table`. Class nay giu ma/ten canh trai, cac cot so tu cot 3 canh phai va khong wrap. Khong dung lai ten page-specific nhu `sales-document-lines-table` lam pattern moi; alias cu chi de tuong thich.
14. Bang chung tu lien ket trong detail phai dung `management-detail-linked-table`. Pattern nay danh cho bang nho dang ma/thoi gian + cac cot tien: ma/thoi gian canh trai, cot tien canh phai, `table-layout: auto`, khong scroll ngang tren desktop binh thuong. Khong viet CSS rieng theo tung page neu chi de sua canh cot.
15. Khung chi tiet phai tach ro vo/ruot bang shared shell: `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, `ManagementDetailSection`, `ManagementInlineDetailTabs`, `ManagementDetailInfoList`, `ManagementDetailMetaText`, `ManagementDetailInlineNote`, `ManagementDetailActionFooter`. Page chi truyen title, badge, metaItems, tab list, field list, table con va action descriptors; khong lap lai wrapper/summary/tab/footer theo tung page neu co the dung shell chung.
16. Grid thong tin ngan trong detail phai dung `ManagementDetailInfoList`/`management-detail-meta-grid`. Grid nay tu do kich thuoc: neu tat ca cap label/value du cho 1 dong thi giu 1 dong; neu co bat ky o nao khong du cho 1 dong thi ca grid trong detail do doi sang 2 dong label tren, value duoi. Label va value luon canh trai, label nho/nhat hon, value dam hon. Khong viet CSS rieng theo page cho kieu `dt/dd` nay.
17. UI tham chieu KiotViet chi duoc dua vao QCVL khi QCVL co field/API/hanh vi that. Tab shell co the giu de dung bo cuc da chot, nhung ruot tab, nut hanh dong, bang con, hoac field chua co nguon du lieu that phai hien empty/disabled ro rang hoac bo khoi UI; khong render du lieu gia/placeholder nhu da hoan thien.

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
- Catalog ngay 2026-07-10: bo loc `Thoi gian tao` cua Hang hoa da tach theo ranh gioi: UI dung class chung trong sidebar; query nam o `catalog-service.ts`; backend/dev-memory loc theo `products.created_at`; contract ghi `created_from`/`created_to`.
- Catalog import ngay 2026-07-10: `Thoi gian tao` tu file KiotViet la source time cua san pham, co the o dang Excel serial. Parser/import service chuan hoa va ghi vao `products.created_at`; import lai cung `Ma hang` duoc phep sua `created_at` sai cu. Khong tao field UI rieng hoac cache rieng cho ngay nay.
- Catalog import ngay 2026-07-12: dong don vi quy doi trong file KiotViet khong tao san pham rieng. Cot `Ma hang` cua dong quy doi phai luu vao `product_unit_conversions.source_code` lam alias cua san pham goc trong `Ma DVT Co ban` (vi du `B260` -> `BT`). Cac import sau nhu nhap hang/kiem kho/hoa don phai lookup san pham qua ca `products.code` va alias nay; khong map bang ten hang va khong coi alias la `{DEL}`.
- Stock movement ngay 2026-07-12: khi chung tu nhap/ban dung ma don vi quy doi KiotViet, movement phai ghi vao san pham goc va quy doi so luong ve don vi ton chinh bang `quantity * stock_qty_per_unit`; khong tao movement rieng cho ma alias.
- Purchase import ngay 2026-07-12: neu dong nhap hang KiotViet thieu `Ma nha cung cap`, parser phai map ve `NCC le` (`NCC lẻ` trong UI/data) va `Nha cung cap le`. Preview khong bao thieu NCC cho fallback nay; apply import phai upsert NCC le truoc khi ghi phieu.
- Shared time: `src/lib/date-format.ts` la cong duy nhat cho thoi gian nghiep vu QCVL/KiotViet. UI hien `dd/MM/yyyy HH:mm`; API/DB luu shape `YYYY-MM-DDTHH:mm:00.000Z` nhu wall-clock da nhap, khong chuyen doi timezone. Page/presenter/service khong duoc tu viet regex parse ngay gio, khong tu noi chuoi `T${hour}:${minute}`, khong dung `Date.toISOString()` de serialize `created_at`/`received_at`/`paid_at`/`adjusted_at` cua chung tu. Khi can luu tu input nguoi dung, dung `parseQcvDateTimeInputToStoredIso`; khi can luu tu Date cua picker/current clock, dung `dateTimeStoredIsoFromLocalClock`; khi hien thi, dung `formatQcvDateTime`. Cung mot chung tu phat sinh hoa don va so quy phai hien cung thoi gian. Thu no sau khi ban hang duoc phep co thoi gian khac hoa don.
- Shared date filter: `ManagementDateRangeInputs` trong `src/components/ui-shell/management-layout.tsx` dung cho Hang hoa, Khach hang, Hoa don, Kiem kho, Phieu nhap va So quy. Khong tao lai cap input `type=date` rieng trong tung page vi browser/OS co the hien sai dinh dang KV. Khong con radio `Tuy chinh`: preset hien bang button/menu nhanh, hai o tu ngay/den ngay luon hien. Icon lich mo popup lich o ben phai cot filter nhu menu thoi gian nhanh; chi mot popup duoc mo, mo lich thi dong menu nhanh va mo menu nhanh thi dong lich. Preset thoi gian hien tai (thang nay, quy nay, nam nay) khong hien den ngay vuot qua hom nay; `Toan thoi gian` hien min/max ngay dang co du lieu khi co the.
- Shared management table: sticky header chi duoc target table cap 1 bang `.management-table-viewport > table > thead th`. Khong dung selector rong `.management-list-surface thead th`, vi table chi tiet nam trong expanded row se bi sticky theo va chong len noi dung khi cuon.
- Shared detail lower layout: `management-detail-lower-right` dung grid `minmax(0, 1fr) max-content`; cot note an phan trong, summary co theo label/value va value `white-space: nowrap`. Note nhap/sua dung `ManagementDetailNoteInput` de giu chung class `management-detail-note` va hanh vi input. Ap dung cho Sales Documents, Inventory/Stocktake va cac detail tuong tu, khong them CSS rieng neu cung nhu cau.
- Shared detail shell: `ManagementDetailPanel`, `ManagementDetailHeader`, `ManagementDetailSummary`, `ManagementDetailSection`, `ManagementInlineDetailTabs`, `ManagementDetailInfoList`, `ManagementDetailInlineNote`, `ManagementDetailActionFooter` la vo chung cho expanded detail. Customers, Finance, Purchase/Suppliers da dung shell nay; cac page sau chi them ruot data/presenter/table, khong tao class rieng kieu `customer-detail-summary` hoac `finance-cashbook-detail` neu khong co khac biet that su.
- Shared detail meta grid: `ManagementDetailInfoList` tu dong chuyen ca grid giua 1 dong va 2 dong theo do rong thuc te cua label/value. Neu 1 o bi chat, tat ca o trong cung detail grid chuyen sang 2 dong de doc dong bo. Tat ca label/value canh trai de khong bi ke thua canh phai tu bang cha.
- Shared detail line table: `management-detail-lines-table` la pattern chung cho bang detail dang `ma + ten + so lieu` trong Sales Documents, Inventory/Stocktake va cac detail tuong tu. Sales Documents con giu `sales-document-lines-table` nhu alias cu, nhung feature moi phai dung class shared.
- Shared linked document table: `management-detail-linked-table` la pattern chung cho bang chung tu lien ket trong detail, nhu So quy lien ket hoa don/phieu nhap. Cot dinh danh/thoi gian canh trai, cot tien canh phai, tieu de canh theo cot, khong co lai cot den muc kho doc tren man desktop rong.
- Shared detail typography: nhan/label render san trong UI dung chu nho va nhat hon; gia tri lay tu DB/API dung chu dam hon. Khong viet style page-specific cho cap `dt/dd` neu pattern da co trong `management-detail-meta-grid` hoac shared detail class.
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
