# DOC-CLEANUP-CHECKLIST — Checklist chỉnh lý tài liệu (tạm)

> **Vai trò:** Một nơi tạm để theo dõi chỉnh lý docs ↔ SoT ↔ runtime.  
> **Không** thay PHASE-CHECKLIST (queue sản phẩm) và **không** thay IMPLEMENTATION-CHECKLIST (baseline code).  
> **Updated:** 2026-07-21  
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
- “Đã merge” trong slice cũ có thể chỉ là UI/import — luôn đối chiếu README 3 lớp.

### PR đang mở (docs)

| PR | Chủ đề |
|---|---|
| [#4](https://github.com/vanlam-web/QCVL/pull/4) | BOM / combo KiotViet — SoT 3 lớp |
| [#5](https://github.com/vanlam-web/QCVL/pull/5) | Inventory + Sales path + Purchase/Finance 3 lớp + checklist |

---

## Đã xong

### P1

- [x] BOM/combo KV SoT 3 lớp · PR #4
- [x] Tồn QCVL / KV tạm / mốc mở · PR #5
- [x] Owner: đã import hết KV · PR #5
- [x] Trừ kho bán: POS live vs import HD / dev-memory · PR #5
- [x] Vệ tinh “BOM nháp / draft chờ duyệt” · PR #5
- [x] Material opening / roll-sheet API stub banners · PR #5

### P2

- [x] **Purchase** — README 3 lớp; P2/P3/P5 live = stub dù doc từng ghi merge · PR #5
- [x] **Finance** — README 3 lớp; So quỹ import đóng; debt canonical pointer · PR #5
- [x] **POS lifecycle / chứng từ** — bảng runtime trên Sales README; lifecycle header · PR #5
- [x] **Customers** — import đóng; debt UI → Finance canonical · PR #5

### P3 (vòng này)

- [x] Banner **Historical plan** trên `docs/superpowers/plans/2026-07-*.md` · PR #5
- [x] `03-MVP-SCOPE.md` + `DEVELOPMENT-PLAN.md` trỏ checklist · PR #5
- [ ] Mojibake / encoding PHASE-CHECKLIST, INVENTORY-API — sửa khi đụng file (không bắt buộc một lần)
- [ ] Rút trùng SoT còn sót khi rà thêm (backlog)

---

## Còn mở / P4

### P4 — Ngoài phạm vi đợt docs (chờ Owner bảo làm code)

- [ ] Runtime BOM slice (import `active`, POS không trừ mã combo, UI, stub `/bom`)
- [ ] Runtime mốc mở tồn QCVL
- [ ] Persist Purchase P2/P3/P5 (bỏ stub create/post/pay)
- [ ] Deep-scan BOM / POS Lưu Combo / object cuộn-tấm đầy đủ

---

## Backlog phát hiện thêm

| Ngày | Chỗ lệch | Ghi chú | Đã xử lý |
|---|---|---|---|
| 2026-07-20 | PRD tồn: fallback KV vs “không lấp QCVL” | Inventory README | [x] PR #5 |
| 2026-07-20 | Roll-sheet PRD “API thật” | stub/docs-ahead | [x] PR #5 |
| 2026-07-20 | Postgres POS live trừ mã combo | Sales README path | [x] PR #5 |
| 2026-07-20 | Doc “BOM nháp / draft chờ duyệt” | SoT+runtime vệ tinh | [x] PR #5 |
| 2026-07-21 | Purchase P2/P3/P5 “đã merge” vs HTTP stub | Purchase README | [x] PR #5 |
| | | | [ ] |

---

## Liên kết nhanh

| Module | Bảng trạng thái 3 lớp |
|---|---|
| BOM | [03-BUSINESS-NghiepVu/BOM/README.md](./03-BUSINESS-NghiepVu/BOM/README.md) *(đầy đủ hơn trên PR #4)* |
| Inventory / tồn | [03-BUSINESS-NghiepVu/Inventory/README.md](./03-BUSINESS-NghiepVu/Inventory/README.md) |
| Sales / trừ kho + lifecycle | [03-BUSINESS-NghiepVu/Sales/README.md](./03-BUSINESS-NghiepVu/Sales/README.md) |
| Purchase | [03-BUSINESS-NghiepVu/Purchase/README.md](./03-BUSINESS-NghiepVu/Purchase/README.md) |
| Finance | [03-BUSINESS-NghiepVu/Finance/README.md](./03-BUSINESS-NghiepVu/Finance/README.md) |
| Queue sản phẩm | [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) |
| Document rules | [DOCUMENT_RULES.md](./DOCUMENT_RULES.md) |

---

Khi chỉnh lý xong một khối: cập nhật bảng **Đã xong**, tick checkbox, ghi PR. Không cần mở file SoT khác chỉ để “đánh dấu tiến độ”.
