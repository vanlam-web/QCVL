# PROJECT-COORDINATION â€” Board Äiá»u Phá»‘i

> **Vai trÃ²:** Board cho viá»‡c Ä‘ang má»Ÿ giá»¯a cÃ¡c luá»“ng Spec / Implement / Review.
> **Cáº­p nháº­t:** 2026-07-17.

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
- TÃ¬nh tráº¡ng: Implementing / V1 hardening
- Branch / PR / commit: current `main`; historical branch `codex/products-inventory-pos-completion` khÃ´ng cÃ³ trong checkout hiá»‡n táº¡i.
- Source of Truth:
  - [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md)  - [Inventory layout](./02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md)
  - [Stocktake](./02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md)
  - [Khui váº­t tÆ°](./02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)
- Báo cáo gần nhất: Ngày 2026-07-14 V1 đã chốt hướng chạy được trước: dữ liệu import chính đã lên NAS `3200`, PriceBook đồng bộ 3200/3202, POS quick products dùng nguồn lịch sử, hàng `{DEL}` được giữ cho lịch sử và lọc bằng `Đã xoá KV`. NAS có `inventory_provisional_balances=337` nhưng `stock_movements=0`, nên `/products` fallback hiển thị tồn KV tạm trong cột `Tồn QCVL` để không trống; detail vẫn gọi rõ là dữ liệu đối chiếu. Local `3202` đã ổn phần chi tiết hàng/dòng hàng trong expanded detail bằng shared `management-detail-lines-table`; sổ quỹ detail đã ổn theo shared finance detail/table layout, gồm hydrate người nộp/nhận cho `TTHD...`, bỏ dòng `Từ quỹ` trùng, phương thức thanh toán hiện tài khoản cụ thể, và bảng chứng từ liên kết dùng `management-detail-linked-table`. Owner đã duyệt xóa dữ liệu giả/test `A+B`: 5 dòng Sổ quỹ KV ngày `2026-07-13` không có chứng từ gốc và 7 hóa đơn POS/test `HD-POS-021...`; backup nằm tại `backups/dev-memory-state-before-delete-approved-fake-data-2026-07-14T15-44-30-303Z.json`. Sau dọn local còn `cashbookEntries=6899`, `salesDocuments=12355`, `salesDocumentItems=12355`; chưa xóa hồ sơ khách `Test KH`. Roll/sheet POS object-level deduction và review drift `REV-2026-07-08-001` vẫn pending.
- Báo cáo cập nhật 2026-07-15: local `3202` đã sync bù data NAS để core counts khớp `3200` (`products=682`, `customers=542`, `suppliers=45`, `purchaseReceipts=684`, `salesDocuments=12361`, `cashbookEntries=6904`, `provisionalStockBalances=337`) và API `3100` đã restart sau khi ghi `logs/dev-memory-state.json`. UI `/suppliers` local và NAS khớp exact ở list/detail THN. Cùng mốc này, các chỉnh UI shell/detail 2026-07-15 cũng đã được build/copy lên NAS `3200` bằng `QCVL_NAS_DEPLOY_CONFIRM=true` và `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate` và `health:nas` đều pass; health cuối trả `persistence: "postgres"` trace `50e19ed9-f7aa-434d-bb13-9d84a68285a6`. So sánh share bằng `robocopy /MIR /L` cho `dist`, `dist-server`, `src`, `server`, `public`, `database` không báo file lệch; các file config copy lẻ (`package*.json`, `index.html`, `vite.config.ts`, `tsconfig*`, script build/migrate/seed`) khớp SHA-256. Local `3202` đã xác nhận `/suppliers`: theme tối, cột `Nhóm NCC`, không có cột `Khách hàng liên kết`, detail dùng `management-detail-meta-grid-three`, note chung `Chưa có ghi chú`.
- Báo cáo cập nhật 2026-07-17: local `3202` phát hiện xóa nhầm `products` do dùng ngày import làm `created_at`. Đã khôi phục từ backup, đọc lại cột `Thời gian tạo` trong `DanhSachSanPham_KV12072026-222359-533.xlsx`, cập nhật `497` sản phẩm active về ngày tạo gốc, restart API `3100`, và xác nhận `/products` hiển thị `1 - 15 trong 497 hàng hóa (611 mã hàng)`. Quy ước mới: không dùng `products.created_at` import time để dọn catalog sau mốc ngày nếu chưa đối chiếu với nguồn KV.
- Báo cáo cập nhật 2026-07-17 batch UI/link/filter: local `3202` đã gom các chỉnh V1 trên Hàng hóa/Hóa đơn/Sổ quỹ/Phiếu nhập/NCC/Khách hàng. Link chung chỉ tô xanh khi có điều hướng thật; So quy mở được HD/PN liên kết; quick time menu đóng khi click ra ngoài hoặc khoảng trống sidebar; detail hóa đơn/phiếu nhập tách `Số lượng` và `Đơn vị`; detail Hàng hóa bỏ dòng `Đơn vị` khỏi tab `Thông tin` và ẩn placeholder `Cần cập nhật`; popup tạo/sửa nhóm hàng và phiếu thu/chi đã gọn hơn theo UI hiện tại.
- Báo cáo cập nhật 2026-07-17 link color: link điều hướng thật dùng `ManagementRecordLink`/`finance-cashbook-linked-document-link` đã chuyển sang `--color-info` để rõ hơn trên theme tối; text chỉ mở detail tại chỗ hoặc không điều hướng giữ màu chữ thường, không gạch chân.
- Báo cáo cập nhật 2026-07-17 link mở detail: link record nội bộ đã đổi sang `?open=` để mở trực tiếp detail trên `/customers`, `/products`, `/sales-documents`, `/purchase/receipts`, `/suppliers`, `/finance`; ô tìm kiếm vẫn rỗng để phân biệt với trạng thái lọc. Tên record trong detail đang mở (tên khách/NCC hiện tại) không còn là link tự trỏ về chính nó; chỉ giữ link chéo sang record khác.
- Báo cáo cập nhật deploy 2026-07-17: batch UI/link/filter/detail đã copy lên NAS `3200` với `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `verify:local`, `build:nas`, `verify:nas-bundle`, `db:migrate`, `health:nas` pass; health trace `14a943e1-b214-4573-83c1-c3c6e859c208`. Chưa chạy `smoke:nas` vì thiếu `QCVL_SMOKE_PASSWORD`.
- Báo cáo cập nhật deploy 2026-07-17 link open: fix `?open=` va bo self-link title Khach hang/NCC da copy len NAS `3200` voi `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate`, `health:nas` pass; health trace `00766c83-5c9b-4125-b26c-80b339df85bc`.
- Cách triển khai: Làm và kiểm tra từng bước trên local `3202` trước. Khi một bước đã ổn và được xác nhận, mới đẩy/sync bước đó lên NAS `3200`; không gom thay đổi chưa kiểm xong vào `3200`.
- Bước tiếp theo: Implement rà V1 theo thứ tự: 1) không làm lại chi tiết hàng/dòng hàng và sổ quỹ đã ổn; chỉ rà tiếp UI chi tiết các module còn lại khi mở tới module đó, để hóa đơn/phiếu cũ thấy đúng dữ liệu lịch sử, kể cả hàng `{DEL}` và dữ liệu tham chiếu; 2) các nút thêm/sửa/xóa còn thiếu ở từng trang; 3) các bộ lọc còn thiếu hoặc chưa dùng shared controls; 4) đối chiếu KV/QCVL theo bộ lọc trước ngày 12; 5) xử lý `REV-2026-07-08-001`; 6) sau đó mới mở lại roll/sheet/object-level deduction và khui vật tư nâng cao.
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
