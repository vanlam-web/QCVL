# QC-OMS Phase Checklist

> **Vai trÃ²:** Checklist sá»‘ng cho tráº¡ng thÃ¡i hiá»‡n táº¡i, queue tiáº¿p theo vÃ  handoff giá»¯a cÃ¡c luá»“ng Codex.
> **Cáº­p nháº­t:** 2026-07-16.

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
| Review issue cÃ²n má»Ÿ | `REV-2026-07-08-001` Ä‘Ã£ implement, Ä‘ang `Ready for Re-check` trong [REVIEW-ISSUES.md](./REVIEW-ISSUES.md) |
| Docs cleanup | ÄÃ£ chuáº©n hoÃ¡ index/metadata; checklist nÃ y lÃ  nguá»“n xem tráº¡ng thÃ¡i sá»‘ng |
| Current product/inventory/POS direction | V1 ưu tiên chạy được: Hàng hóa/PriceBook/POS đã dùng dữ liệu import chính; `Tồn QCVL` fallback hiển thị tồn KV tạm khi chưa có stock movement. `/pos/cart/validate` Ä‘Ã£ validate thÃ¢t; roll/sheet object-level deduction vÃ  khui váº­t tÆ° nÃ¢ng cao cÃ²n pending |

Local status 2026-07-12:

- Current parent goal remains `Hoan thien Hang hoa` by making product stock trustworthy.
- Product import, stocktake import, customer import, supplier import, and purchase receipt KV import are usable for current local data.
- Purchase receipt KV file `DanhSachChiTietNhapHang_KV12072026-135400-901.xlsx` imported 684 posted receipts / 1,737 detail rows locally.
- Purchase receipt main list now follows the Owner-selected compact columns: checkbox, favorite star, `Ma nhap hang`, `Nha cung cap`, `Tong so luong`, `Tong tien hang`, `Can tra NCC`, `Tien da tra NCC`.
- Blank KiotViet supplier code maps to `NCC le` / `NCC lẻ`; historical KV-deleted products used by receipts are kept as inactive, non-inventory-tracked products.
- Imported posted purchase receipts now read as trusted `purchase_receipt` stock-in movements in dev-memory. Unit-conversion item codes such as `B260` map to the parent product and convert quantity into the parent stock unit.
- KiotViet sales invoice import now exists on `/sales-documents`: preview/import/delete endpoints, shared `Import` button/dialog for KiotViet files, grouping by `Ma hoa don`, `khachle` fallback, auto placeholder rows for KV-deleted customer/product codes ending `{DEL...}`, seller/creator collapsed to one QCVL account, and completed invoices writing `sale_deduction` stock-out movements in dev-memory.
- Next work for product stock: finish formula/opening-checkpoint/display on Products and close live POS stock-out gaps. Product stock must still show incomplete/needs checkpoint if opening balance is not selected.

Current status 2026-07-13:

- Product/customer/supplier/purchase receipt/sales invoice data imported and reviewed enough to promote the current 3202 state to NAS PostgreSQL for test operation.
- NAS `3200` now runs PostgreSQL-backed data. Imported snapshot groups include products, customer snapshots, supplier snapshots, purchase receipt snapshots, and sales orders from current 3202 state.
- Sales document cancel on NAS is fixed: cancelling a POS invoice must mark `orders.status = cancelled` and close related customer debt rows instead of relying on memory-only behavior.
- Product stock parity work is considered runnable for now. Deep upgrades for unit conversion selling, roll/sheet/object-level edge cases, and BOM history can be reopened later.
- New active direction: Finance foundation on local `3202` first. Cong no depends on So quy; So quy depends on real cash/bank finance accounts. Do not keep account data as hard-coded JSON blobs.
- KiotViet cashbook export has been inspected from Downloads. Next implementation should create/import `finance_accounts`, then import KV So Quy rows into cashbook data with traceable source metadata.
- Do not deploy the new finance/cashbook import to NAS until it is verified on local `3202`.
- Local `3202` implementation started: `/finance` has `Import` for So Quy KiotViet files, backend has preview/import/delete endpoints, parser tests, dev-memory persistence for imported cashbook rows, and dev-memory finance account list now includes imported KV bank accounts. PostgreSQL migration/repository for long-term NAS finance accounts is still a follow-up before NAS promotion.

Current status 2026-07-14:

- V1 operational scope is narrowed: keep UI visible for future roll/sheet/material-opening features where useful, but do not activate advanced flows until data rules are stable.
- Historical KiotViet `{DEL}` products are restored/kept for old receipts, invoices, stocktakes and audit. UI exposes them through `Đã xoá KV`; POS and new operational flows continue to use active products only.
- PriceBook on `3200` and `3202` uses reusable chip picker for price-list columns, displays default `Bảng giá chung` as `Giá chung`, removes Status/Actions columns, and keeps `Đã xoá KV` status filter.
- NAS `3200` has PostgreSQL product data and KV provisional stock (`products=682`, `inventory_provisional_balances=337`, `stock_movements=0`). `/products` now falls back to displaying `kiotviet_provisional_stock` in `Tồn QCVL` when no QCVL movement exists, while detail still labels it as `Tồn KV tạm nhập`/data for comparison.
- 3200/3202 have been synchronized for the deleted-product filter, PriceBook UI changes, POS quick product ordering source, and product stock fallback display. Backend health on NAS returns `persistence: "postgres"`.
- Local `3202` UI hardening progress: chi tiet hang/dong hang trong expanded detail da on theo shared `management-detail-lines-table`; So quy detail da on theo shared finance detail/table layout, hydrate duoc nguoi nop/nhan cho `TTHD...`, bo dong `Tu quy` trung, hien tai khoan cu the trong phuong thuc thanh toan, va bang chung tu lien ket dung `management-detail-linked-table`. Tiep tuc lam tren `3202` truoc, chi sync `3200` sau khi tung slice duoc xac nhan.
- Local `3202` data cleanup ngay `2026-07-14`: Owner da duyet `A+B`, da xoa 5 dong So quy KV ngay `2026-07-13` khong co chung tu goc va 7 hoa don POS/test `HD-POS-021...` cung dong hang tuong ung. Backup truoc xoa: `backups/dev-memory-state-before-delete-approved-fake-data-2026-07-14T15-44-30-303Z.json`. Sau xoa con `cashbookEntries=6899`, `salesDocuments=12355`, `salesDocumentItems=12355`. Ho so khach `Test KH` chua xoa vi khong nam trong pham vi duyet.
- Next V1 fixes must be done and verified on local `3202` first. After each step is confirmed, sync only that finished step to NAS `3200`.
- Still open for V1 hardening: missing edit/delete/add buttons across some modules, full filter coverage, KV-vs-QCVL reconciliation by filter, and review re-check for `REV-2026-07-08-001`.

Current status 2026-07-15:

- Sau mốc sync NAS `3200`, các chỉnh UI tiếp theo vẫn đang ở local `3202` trước: mặc định theme tối, topbar/content giới hạn theo max-width chung, page size mặc định theo viewport (`15/20/25/30`) và footer có dải `15, 20, 25, 30, 50, 100`.
- Đã rà soát lại page size theo viewport: helper chung áp dụng cho main list footer của Hóa đơn/Sổ quỹ/Khách hàng/Hàng hóa/Bảng giá/NCC/Phiếu nhập/Kiểm kho; detail list như thẻ kho/lịch sử giữ page size nghiệp vụ riêng.
- Shared detail shell đã mở rộng trên `3202`: `ManagementDetailPanel`, `ManagementDetailSummary`, `ManagementDetailSection`, `ManagementDetailInfoList`, `ManagementDetailCard`, `ManagementDetailNote`, `ManagementDetailNoteInput`; note readonly dùng fallback `Chưa có ghi chú`, note editable dùng textarea chung.
- Chi tiết Khách hàng/NCC/Sổ quỹ/Phiếu nhập/Hóa đơn đã đi theo shell chung ở mức đang làm: nhãn meta nhạt/nhỏ, dữ liệu DB đậm hơn; grid info tự chuyển toàn detail sang 2 dòng nếu một ô không đủ ngang.
- Chi tiết NCC trên `3202` đã bỏ cột/list riêng `Khách hàng liên kết` khỏi bảng chính; nếu NCC cũng là khách hàng thì hiện card liên kết trong detail. Info tab NCC dùng 3 cột (`Điện thoại`, `Email`, `MST`) và dòng `Địa chỉ` full width; `Nhóm nhà cung cấp` chỉ giữ field chuẩn bị, không hiện ở bảng chính khi chưa có nhóm thật.
- Đã build/copy các chỉnh UI 2026-07-15 lên NAS `3200` bằng `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate` pass; `health:nas` cuối pass với `persistence: "postgres"` trace `50e19ed9-f7aa-434d-bb13-9d84a68285a6`.
- So sánh NAS share sau deploy: `dist`, `dist-server`, `src`, `server`, `public`, `database` không có file lệch theo `robocopy /MIR /L`; các file config copy lẻ khớp SHA-256. Local `/suppliers` trên `3202` đã kiểm tra UI sau login: theme tối, không hiện cột `Khách hàng liên kết`, detail dùng grid chung 3 cột và note chung.
- Local `3202` đã sync bù data từ NAS để core counts khớp `3200`: products `682`, customers `542`, suppliers `45`, purchaseReceipts `684`, salesDocuments `12361`, cashbookEntries `6904`, provisionalStockBalances `337`. API `3100` đã restart để nạp lại `logs/dev-memory-state.json`; `/suppliers` local và NAS khớp exact ở THN list/detail.
- Đã smoke `/suppliers` sau login bằng tab Codex đang mở và khớp local; chưa smoke toàn bộ UI sau login trên NAS. NAS `qcvl-app` cũng chưa restart trong lần copy này, nên thay đổi backend/runtime cần restart trước khi coi là nạp code mới.
- NAS `3200` đã được bù 7 link KH-NCC trong `supplier_snapshots`; detail `NCC000035 - Út Tèo` hiện card `Khách hàng đồng thời là Nhà cung cấp`, khớp `3202`.
- Phiếu nhập posted trên `3200`/`3202` đã chuyển sang detail đọc-only theo shell chung: không còn form disabled, note dùng textarea chung, footer có `In` và `Thanh toán NCC` khi còn nợ. Tab `Lịch sử thanh toán` chỉ hiện khi có payment row; phiếu chưa thanh toán không hiện tab trống. Phiếu import KV đã trả nhưng thiếu row `supplier_payments` được hiển thị bằng row đọc-only `PCPN...` để đối chiếu.
- Chi tiết NCC dùng dữ liệu phiếu nhập chung: tab `Lịch sử nhập/trả hàng` hiển thị bảng phiếu nhập đã posted theo NCC; tab `Nợ cần trả nhà cung cấp` hiển thị danh sách phiếu còn nợ. API `/api/v1/purchase/receipts` hỗ trợ filter `supplier_id`; endpoint phiếu nợ NCC không còn lấy 10 phiếu đầu không lọc.
- Thẻ kho hàng hóa trên Postgres có fallback từ `purchase_receipt_snapshots` khi bảng `stock_movements` chưa được backfill cho sản phẩm. Fallback match theo mã hàng/import unit conversion, tính `Tồn cuối` theo thời gian nhập và chỉ dùng khi product cụ thể chưa có movement table.
- Chi tiết Khách hàng tab `Nợ cần thu` hiển thị summary nợ hiện tại và bảng `Lịch sử nợ cần thu` từ hóa đơn của khách, kể cả hóa đơn đã thu đủ. Nếu debt API chưa có dòng mở nhưng lịch sử hóa đơn còn `debt_amount`/`payment_status` nợ, UI tự tính lại `Tổng nợ`/`Hóa đơn mở` từ history để tránh số 0 giả; nếu chưa có service hóa đơn thì fallback về danh sách hóa đơn đang nợ từ debt API.
- Rà soát hiệu năng UI trên NAS `3200` qua in-app browser: list chính tải được 30 dòng trong khoảng `0.8s-2.4s` (`/price-book` ~0.82s, `/suppliers` ~0.82s, `/finance` ~1.13s, `/products` ~1.48s, `/inventory` ~1.51s, `/receipts` ~1.63s, `/customers` ~1.86s, `/sales-documents` ~2.38s). Console không có error/overlay. Mở detail bằng click tọa độ xác nhận `/customers` ~1.5s, `/suppliers` ~1.5s, `/sales-documents` vào trạng thái `Đang tải chi tiết...` ~1.5s; `/finance`, `/products`, `/inventory`, `/price-book`, `/receipts` cần kiểm tra riêng theo đúng vùng click/row vì phép đo chung chưa mở detail, chưa kết luận là API chậm.
- Local `3202` purchase receipt create search đã nối remote catalog search theo `search`, merge cache + API, và chọn được mã hàng ngoài cache nạp sẵn; vẫn giữ cơ chế POS-like `Tìm hàng (F3)` bên phải `Nhập hàng`.
- Đã build/copy fix search hàng nhập lên NAS `3200` bằng `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate`, `health:nas` pass; health trace `00862d6f-ed41-41ec-b534-dbadbf7029d7`, persistence `postgres`.

Current status 2026-07-16:

- Local `3202` purchase receipt create flow đã đổi sang workspace mới: thanh `Tìm hàng (F3)` nằm sát `Nhập hàng`, tìm theo mã/tên hàng giống POS, chọn hàng từ search để tạo card dòng hàng, không có row rỗng mặc định, không dùng dropdown chọn sản phẩm, và không cho lưu phiếu khi chưa có dòng hàng.
- Right-side purchase panel dùng shell chung kiểu `ManagementFilterSidebar`; list page `Tìm phiếu/NCC` giữ lại vị trí header chung như các trang khác, không kéo sát tiêu đề.
- Detail NCC/Phiếu nhập vẫn theo shell chung đã chốt: note chung, grid info chung, tab lịch sử thanh toán chỉ hiện khi có payment row, và `Khách hàng đồng thời là Nhà cung cấp` chỉ hiện khi dữ liệu liên kết thật có sẵn.
- Bảng NCC trên `3202` ẩn cột `Nhóm NCC`; field nhóm NCC chỉ giữ để mở rộng sau, không chiếm chiều ngang list khi chưa có dữ liệu thật.

Current status 2026-07-17:

- Local `3202` đã khôi phục đúng catalog sau khi dọn dữ liệu test sau `2026-07-11`: `products=682`, `active=497`, `inactive=185`. Nguyên nhân mất hàng là state cũ dùng ngày import `2026-07-14` làm `products.created_at`; file KiotViet `DanhSachSanPham_KV12072026-222359-533.xlsx` có cột `Thời gian tạo` và đã được dùng để cập nhật lại ngày tạo gốc cho `497` hàng active. Không dùng ngày import để xóa catalog theo mốc ngày.
- UI local `/products` đã xác nhận lại sau restart API `3100`: `1 - 15 trong 497 hàng hóa (611 mã hàng)`, không còn hàng active sau `2026-07-11`.
- Batch UI V1 2026-07-17 da ra soat tren `3202`: filter sidebar co nut an/hien va quick-time click-away dung; link chung doi mau hover va chi dung cho text co dich dieu huong; Hóa đơn/Phiếu nhập detail tách `Số lượng`/`Đơn vị`; hàng hóa ẩn placeholder `Cần cập nhật` va không còn dòng `Đơn vị` trong tab `Thông tin`; So quy co link sang hoa don/phieu nhap va popup sua phieu thu/chi gọn hơn.
- Link điều hướng thật trong V1 đang dùng cùng một màu `--color-info` để dễ nhận diện trên nền tối; không gạch chân, không dùng màu riêng khác nhau giữa các module.
- Link record noi bo 2026-07-17 dung `?open=` de mo detail that, khong dung `?search=` neu muc tieu la mo ban ghi. Detail title cua ban ghi dang mo khong duoc la self-link; vi du ten khach hang/NCC hien tai chi hien text thuong, con link cheo den khach/NCC/hoa don/phieu nhap/so quy khac moi giu `ManagementRecordLink`.
- Đã deploy batch này lên NAS `3200` với `QCVL_NAS_RESTART=false`; `verify:local`, `build:nas`, `verify:nas-bundle`, `db:migrate`, `health:nas` pass. Health trace `14a943e1-b214-4573-83c1-c3c6e859c208`, persistence `postgres`. Chưa chạy `smoke:nas` vì thiếu `QCVL_SMOKE_PASSWORD`.

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
| Product/Inventory/POS completion | Đang mở | V1 đang chạy được với dữ liệu import + fallback tồn KV tạm; chi tiet hang/dong hang va So quy detail da on tren `3202`; `/pos/cart/validate` da implement; phan con lai la detail cac module chua ra, POS roll/sheet object-level deduction, va doi chieu KV/QCVL theo bo loc |
| V1 functional gaps | Đang mở | Làm trên local `3202` trước, xong từng bước mới đẩy `3200`: 1) tiep tuc ra soat UI detail con lai khi cham module; 2) cac nut them/sua/xoa con thieu; 3) filter con thieu hoac chua dung shared controls; 4) bao cao doi chieu du lieu theo tung module truoc khi coi V1 on dinh |
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
