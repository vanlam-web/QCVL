# DOC-CLEANUP-CHECKLIST — Checklist chỉnh lý tài liệu (tạm)

> **Vai trò:** Một nơi tạm để theo dõi chỉnh lý docs ↔ SoT ↔ runtime.  
> **Không** thay PHASE-CHECKLIST (queue sản phẩm) và **không** thay IMPLEMENTATION-CHECKLIST (baseline code).  
> **Updated:** 2026-07-20  
> **Phạm vi lần này:** chỉ tài liệu. Runtime chỉ ghi ở cột “hiện trạng”, không làm code trừ khi Owner bảo.

---

## Cách dùng

1. Mỗi chủ đề: tách **3 lớp** (Quyết định Owner / Hiện trạng code / Hướng dài).
2. Xong một mục → đánh `[x]` và ghi PR / commit.
3. Phát hiện chỗ lệch mới → thêm dòng vào **Backlog**, không sửa lung tung ngoài checklist.
4. Khi cả đợt dọn xong: có thể archive hoặc xóa file này (Owner quyết).

### Quy tắc viết (tránh lệch lần sau)

- SoT mục tiêu ≠ “đã ship”.
- Nói hành vi đang chạy → ghi **Runtime** hoặc link README mục 2 của module.
- Owner 2026-07-20: **đã import hết KV** — không xếp “import file mới” vào backlog docs/queue.

### PR đang mở (docs)

| PR | Chủ đề |
|---|---|
| [#4](https://github.com/vanlam-web/QCVL/pull/4) | BOM / combo KiotViet — SoT 3 lớp |
| [#5](https://github.com/vanlam-web/QCVL/pull/5) | Tồn QCVL + hết import + trừ kho path + dọn BOM nháp vệ tinh + roll/sheet API stub |

---

## Đã xong

- [x] **BOM/combo KV** — README 3 lớp; RULES/TABLES/API; vệ tinh Sales/K02/plan; AC slice vs hướng dài · PR #4
- [x] **Tồn QCVL / KV tạm / mốc mở** — Inventory README 3 lớp; chốt mâu thuẫn fallback list; roll/sheet stub; API notes · PR #5
- [x] **Owner: đã import hết** — không mở đợt import KV mới; nút import = phòng hờ · ghi trong Inventory README + PHASE + PRD · PR #5
- [x] **Trừ kho bán hàng: POS live Postgres vs import HD / dev-memory** — bảng path × SoT trên Sales README + POS-CHECKOUT · PR #5
- [x] **Stub BOM API / UI “BOM nháp”** — dọn vệ tinh PRD/API/plan/POS-TABLES/BOM-TABLES theo SoT+runtime · PR #5
- [x] **Material opening / roll-sheet API docs** — banner stub trên §5–6 INVENTORY-API; khui roll/sheet = docs-ahead · PR #5

---

## Đang / sắp làm (tick khi xong)

Đánh dấu theo thứ tự ưu tiên đề xuất. Owner có thể đổi thứ tự.

### P1 — Lệch docs↔runtime dễ gây hiểu nhầm

- [x] **Trừ kho bán hàng** · PR #5
- [x] **Stub BOM API / UI “BOM nháp”** · PR #5 (vệ tinh trên `main`/branch này)
- [x] **Material opening / roll-sheet API docs** · PR #5

### P2 — Module chưa có bảng trạng thái 3 lớp

- [ ] **Purchase / phiếu nhập** — SoT vs P2–P5 đã merge vs P4 cuộn-tấm chưa; không import KV thêm  
  Entry đề xuất: `docs/03-BUSINESS-NghiepVu/Purchase/README.md` (hoặc mở rộng file index hiện có)

- [ ] **Finance / sổ quỹ / công nợ** — import So quỹ đã có dữ liệu; SoT thu nợ / debt formula vs UI  
  Entry đề xuất: `docs/03-BUSINESS-NghiepVu/Finance/` (README 3 lớp nếu chưa có)

- [ ] **POS checkout / báo giá / sales documents** — nháp local, revision, cancel; doc vs runtime  
  Entry: `docs/03-BUSINESS-NghiepVu/Sales/README.md` (bổ sung mục trạng thái ngoài BOM)

- [ ] **Customers** — import xong; debt summary / tab nợ đã sửa gần đây; rà doc còn lệch không

### P3 — Dọn lịch sử / trùng / thừa

- [ ] **`docs/superpowers/plans/*`** — gắn banner “historical; SoT hiện hành = BOM/Inventory README”; bỏ câu như runtime đã `active`/đã có mốc mở  
- [ ] **`DEVELOPMENT-PLAN.md` / `03-MVP-SCOPE.md`** — một dòng trỏ checklist này + README module; tránh timeline “còn phải import”  
- [ ] **Mojibake / encoding** trong PHASE-CHECKLIST, INVENTORY-API (sửa khi đụng file, không bắt buộc cả file một lần)  
- [ ] **Trùng SoT** — cùng một quyết định lặp 5 nơi: giữ 1 SoT + link, rút vệ tinh

### P4 — Ngoài phạm vi đợt docs này (chỉ ghi để không quên)

- [ ] Runtime BOM slice (import `active`, POS không trừ mã combo, UI, stub `/bom`) — **code**, chờ Owner  
- [ ] Runtime mốc mở tồn QCVL — **code**, chờ Owner  
- [ ] Deep-scan BOM / POS Lưu Combo mới / object cuộn-tấm đầy đủ — hướng dài

---

## Backlog phát hiện thêm (thêm dòng khi rà)

| Ngày | Chỗ lệch | Ghi chú | Đã xử lý |
|---|---|---|---|
| 2026-07-20 | PRD tồn: fallback KV vs “không lấp QCVL” | Đã chốt đọc trong Inventory README | [x] PR #5 |
| 2026-07-20 | Roll-sheet PRD nói “API thật” | Đổi thành stub/docs-ahead | [x] PR #5 |
| 2026-07-20 | Postgres POS live trừ cả mã combo | Ghi bảng path trên Sales README; SoT = chỉ thành phần | [x] PR #5 |
| 2026-07-20 | Nhiều doc vẫn SoT cũ “BOM nháp / draft chờ duyệt” | Đổi SoT+runtime trên PRD/API/plan/TABLES | [x] PR #5 |
| | | | [ ] |

---

## Liên kết nhanh

| Module | Bảng trạng thái 3 lớp |
|---|---|
| BOM | [03-BUSINESS-NghiepVu/BOM/README.md](./03-BUSINESS-NghiepVu/BOM/README.md) *(3 lớp đầy đủ trên PR #4)* |
| Inventory / tồn | [03-BUSINESS-NghiepVu/Inventory/README.md](./03-BUSINESS-NghiepVu/Inventory/README.md) |
| Sales / trừ kho bán | [03-BUSINESS-NghiepVu/Sales/README.md](./03-BUSINESS-NghiepVu/Sales/README.md) |
| Queue sản phẩm | [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) |
| Document rules | [DOCUMENT_RULES.md](./DOCUMENT_RULES.md) |

---

Khi chỉnh lý xong một khối P1/P2: cập nhật bảng **Đã xong**, tick checkbox, ghi PR. Không cần mở file SoT khác chỉ để “đánh dấu tiến độ”.
