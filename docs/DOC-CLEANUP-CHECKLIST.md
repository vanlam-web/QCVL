# DOC-CLEANUP-CHECKLIST — Checklist chỉnh lý tài liệu (tạm)

> **Vai trò:** Một nơi tạm để theo dõi chỉnh lý docs ↔ SoT ↔ runtime.  
> **Không** thay PHASE-CHECKLIST (queue sản phẩm) và **không** thay IMPLEMENTATION-CHECKLIST (baseline code).  
> **Updated:** 2026-07-21  
> **Phạm vi lần này:** chỉ tài liệu. Runtime chỉ ghi ở cột “hiện trạng”, không làm code trừ khi Owner bảo.
>
> **Owner 2026-07-21 — đóng băng V1 tạm:** bản hiện tại **dùng được tạm**. Slice BOM/POS KV đã lên `main`. Các mục P4 / hướng dài = **nâng cấp làm sau**, không mở code trong đợt này.

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

### PR / nhánh (docs + runtime đã chốt)

| PR | Chủ đề | Ghi chú |
|---|---|---|
| [#7](https://github.com/vanlam-web/QCVL/pull/7) | Runtime BOM KV + POS skip parent + `/bom` | **Đã gộp vào nhánh sync → main** |
| [#5](https://github.com/vanlam-web/QCVL/pull/5) | Inventory + Sales path + Purchase/Finance 3 lớp + checklist | Đã gộp; đồng bộ post-#7 trong sync |
| [#4](https://github.com/vanlam-web/QCVL/pull/4) | BOM SoT 3 lớp (docs-only) | Superseded bởi #7 BOM README + sync |
| [#6](https://github.com/vanlam-web/QCVL/pull/6) | POS skip parent hẹp | Superseded bởi #7 |

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
- [x] Đồng bộ stale “chưa sửa / runtime draft / stub `/bom`” sau khi code lên `main` · 2026-07-21 (PHASE, BOM-API, BOM-TABLES, audit, queue A/B)
- [x] Tách AC BOM-RULES: slice KV done vs P4 đóng băng
- [x] Freeze note Purchase/Finance/Sales mục hướng dài + queue PHASE A (V1) / B (P4)
- [ ] Mojibake / encoding PHASE-CHECKLIST header, INVENTORY-API — sửa khi đụng file (không bắt buộc một lần)
- [x] Chốt SoT debt: hiện âm đối soát + thu live không trả thừa (Owner 2026-07-21) · Finance README F/G · BR-DEBT-06
- [x] Hướng tiếp: vận hành đơn mới sau import + đối soát trùng KV · Sales README
- [x] Canonical `stocktake_balance` vs tên cũ `stocktake_adjustment` trong STOCKTAKE/TABLES
- [x] `POST /products` persist (Postgres + dev-memory); combo/service ép `track_inventory=false` theo KV · 2026-07-21
- [ ] Owner chỉ loại đơn cần UI trước (sau tạo SP/PN hàng thường) rồi mở gap còn lại nếu có

---

## Đã xong thêm (runtime + sync docs 2026-07-21)

- [x] Runtime BOM slice KV: migrate `0008` → `active`, POS skip parent, UI, `GET/POST/PUT /bom` · [#7](https://github.com/vanlam-web/QCVL/pull/7)
- [x] Đồng bộ Sales README / POS-CHECKOUT / audit / checklist sau #7 · nhánh sync → main
- [x] **Không** re-import Excel — chỉ migrate BOM đã có
- [x] `POST /products` tạo hàng/combo tay persist (không stub)

## P4 — Hướng dài (đóng băng — nâng cấp sau)

> Owner 2026-07-21: **không làm ngay.** Giữ trong checklist để không mất hướng.

- [ ] Runtime mốc mở tồn QCVL
- [ ] Purchase P5 nghiệm thu sâu + P4 object cuộn/tấm khi post phiếu nhập
- [ ] Deep-scan BOM / POS Lưu Combo / object cuộn-tấm đầy đủ

**Không** xếp các mục trên vào queue code hiện tại cho đến khi Owner mở lại.

---

## Backlog phát hiện thêm

| Ngày | Chỗ lệch | Ghi chú | Đã xử lý |
|---|---|---|---|
| 2026-07-20 | PRD tồn: fallback KV vs “không lấp QCVL” | Inventory README | [x] PR #5 |
| 2026-07-20 | Roll-sheet PRD “API thật” | stub/docs-ahead | [x] PR #5 |
| 2026-07-20 | Postgres POS live trừ mã combo | Sales README path | [x] PR #5 → code #7 |
| 2026-07-20 | Doc “BOM nháp / draft chờ duyệt” | SoT+runtime vệ tinh | [x] PR #5 → runtime #7 |
| 2026-07-21 | Purchase P2/P3/P5 “đã merge” vs HTTP stub | Purchase README | [x] PR #5 |
| 2026-07-21 | POS Postgres trừ mã combo + thiếu test combo | Biên bản → đã sửa code | [x] #7 + sync docs |
| 2026-07-21 | `POST /products` stub chặn tạo SP mới sau import | Persist + docs SoT | [x] create-product-persist |

---

## Liên kết nhanh

| Module | Bảng trạng thái 3 lớp |
|---|---|
| BOM | [03-BUSINESS-NghiepVu/BOM/README.md](./03-BUSINESS-NghiepVu/BOM/README.md) |
| Inventory / tồn | [03-BUSINESS-NghiepVu/Inventory/README.md](./03-BUSINESS-NghiepVu/Inventory/README.md) |
| Sales / trừ kho + lifecycle | [03-BUSINESS-NghiepVu/Sales/README.md](./03-BUSINESS-NghiepVu/Sales/README.md) |
| Purchase | [03-BUSINESS-NghiepVu/Purchase/README.md](./03-BUSINESS-NghiepVu/Purchase/README.md) |
| Finance | [03-BUSINESS-NghiepVu/Finance/README.md](./03-BUSINESS-NghiepVu/Finance/README.md) |
| Queue sản phẩm | [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) |
| Document rules | [DOCUMENT_RULES.md](./DOCUMENT_RULES.md) |

---

Khi chỉnh lý xong một khối: cập nhật bảng **Đã xong**, tick checkbox, ghi PR. Không cần mở file SoT khác chỉ để “đánh dấu tiến độ”.
