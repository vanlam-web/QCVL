# BOM — Định mức vật tư và combo

> Index SoT BOM/combo. Queue sống: [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
> Nguồn: cột `Hàng thành phần` KiotViet, PRD K02-A.
>
> Cách đọc tài liệu này (tránh lệch docs ↔ code):
> 1. **Quyết định Owner** = nghiệp vụ phải đạt khi implement xong.
> 2. **Hiện trạng code** = runtime đang làm gì (có thể chưa khớp quyết định).
> 3. **Hướng dài / chưa làm** = đã chốt hướng, chưa thuộc slice hiện tại.

---

## Tài liệu trong nhóm

| File | Vai trò |
|---|---|
| [BOM-RULES.md](./BOM-RULES.md) | Quy tắc nghiệp vụ (SoT) |
| [../../04-DATABASE/BOM/BOM-TABLES.md](../../04-DATABASE/BOM/BOM-TABLES.md) | Schema mục tiêu + ghi chú import |
| [../../05-BACKEND-MayChu/BOM/BOM-API.md](../../05-BACKEND-MayChu/BOM/BOM-API.md) | Contract API mục tiêu + hiện trạng stub |

---

## 1. Quyết định Owner (SoT nghiệp vụ)

### 2026-07-20 — KiotViet / bán combo (hiện hành)

| # | Chốt |
|---|---|
| A | Import `Hàng thành phần` → BOM **`active`**, dùng ngay khi bán |
| B | **Không** luồng nháp → duyệt → kích hoạt cho BOM import từ KV |
| C | **Không** sản xuất sẵn (không tăng tồn mã combo trước khi bán) |
| D | Bán combo: **chỉ trừ thành phần**; **không** trừ tồn theo mã combo |
| E | Combo/`track_inventory = false`: không quản lý tồn riêng trên mã combo |
| F | Nhập hàng / kiểm kho: trên hàng tồn thật; không nhập/kiểm tồn theo mã combo như SKU tồn |

### 2026-07-01 — Hướng dài (vẫn giữ)

- BOM có thể nhiều cấp; chứng từ lưu snapshot.
- POS có thể chỉnh BOM dòng (`Không lưu — Chỉ trừ kho` / `Lưu Combo mới`).
- Deep-scan, chống vòng lặp, giới hạn độ sâu — xem mục 3.

Chi tiết rule: [BOM-RULES.md](./BOM-RULES.md).

---

## 2. Hiện trạng code (rà soát 2026-07-21)

**Owner 2026-07-20: đã import hết KV.** Không mở đợt import mới. Dữ liệu BOM đã có → **chỉ migrate** (`0008`) promote `draft` → `active`. Đổi path import/`upsertDraftProductBoms` chỉ để nút Import (khẩn) nếu bấm lại cũng ghi `active` — **không** yêu cầu chạy lại file Excel.

| Hạng mục | Runtime hiện tại | Khớp SoT? |
|---|---|---|
| Parse `Hàng thành phần`, ép `product_kind = combo`, `track_inventory = false` | Có (path emergency) | Có |
| Path import ghi `product_boms.status` (nếu bấm Import lại) | **`active`** + note *Trusted for stock deduction* | Có |
| **Dữ liệu đã import:** migrate BOM KV `draft` → `active` | Migration `0008_promote_kiotviet_bom_active.sql` — **không cần re-import** | Có |
| Field API `draft_bom` | Trả BOM `active` (fallback `draft`); tên field giữ tương thích | Có |
| UI Catalog / import dialog | “BOM KiotViet” / “Đang dùng khi bán”; bỏ copy nháp | Có |
| Trừ thành phần khi bán (Postgres) | BOM `draft` **và** `active` | Có |
| Trừ mã combo khi bán (Postgres POS) | Skip parent nếu `!track_inventory` hoặc `product_kind` ∈ (`combo`,`service`) | Có |
| `GET/POST/PUT /products/{id}/bom` | Repo Postgres + dev-memory; route POST|PUT | Có (MVP lưu active) |
| `POST /boms/{id}/activate` | Không có route | Chưa cần cho KV |
| Purchase / sửa tồn loại combo | UI đã loại combo | Có |
| Deep-scan nhiều cấp / snapshot BOM trên chứng từ / POS “Lưu Combo mới” đầy đủ | Chưa | Xem mục 3 |
| `POST /products` tạo combo tay | Vẫn stub HTTP | Một phần — BOM save thật sau khi có product id thật |

### Tiến trình tài liệu / code

| Việc | Trạng thái |
|---|---|
| SoT 3 lớp (quyết định / runtime / hướng dài) | Xong |
| Runtime slice KV: (1) migrate BOM đã có → `active` (+ sửa path Import khẩn) · (2) POS skip parent · (3) `draft_bom`/UI · (4) GET\|POST `/bom` | **Xong** — PR runtime slice |
| Hướng dài mục 3 | **Chưa** — không nhầm với slice KV |

**Quy tắc:** Doc vệ tinh chỉ được viết “import `active` / dùng ngay” như **SoT đã khớp runtime** khi mục 2 ghi Có. Không viết “nháp chờ duyệt” cho BOM KV.

---

## 3. Hướng dài / chưa làm (đã chốt hướng, chưa slice)

| Hạng mục | Hướng đã chốt | Slice hiện tại |
|---|---|---|
| Deep-scan BOM lồng / chống vòng lặp / max 5 cấp | Có trong BOM-RULES | Chưa làm — trừ phẳng cấp 1 |
| Snapshot BOM đầy đủ trên mọi dòng hóa đơn | Có trong BOM-RULES / TABLES | Chưa làm đủ |
| POS chỉnh BOM dòng + `Không lưu` / `Lưu Combo mới` | Có trong PRD K02 + RULES | Chưa runtime đầy đủ |
| `preview` / `validate` BOM API | Có trong BOM-API | Chưa |
| Tự hiệu chỉnh định mức từ kiểm kho / khui / lịch sử | Phase sau | Chưa |
| Sản xuất sẵn / work order tăng tồn combo | **Không làm** theo 2026-07-20 | Loại khỏi scope hiện tại |
| `POST /products` create combo tay không stub | Cần product create thật | Chưa — ngoài slice KV import |

---

## 4. Quy ước ghi docs (tránh lệch lần sau)

- Quyết định nghiệp vụ chỉ sửa ở **mục 1** + [BOM-RULES.md](./BOM-RULES.md).
- Mỗi lần đổi code BOM/combo: cập nhật **mục 2** cùng PR.
- Không viết lại “nháp chờ duyệt” cho BOM KV trừ khi trong mục Lịch sử / superseded.
- Field `draft_bom` = **tên tương thích**; không dùng chữ “nháp” trong UI khi SoT đã chốt dùng ngay.

**Owner 2026-07-20 (tóm tắt):** BOM KV dùng ngay (`active`); bán combo chỉ trừ thành phần. Bảng SoT đầy đủ / runtime path trừ kho: [BOM-RULES.md](./BOM-RULES.md) và [Sales README — Trừ kho khi bán](../Sales/README.md#trừ-kho-khi-bán--trạng-thái-2026-07-20). Tiến độ chỉnh lý docs: [../../DOC-CLEANUP-CHECKLIST.md](../../DOC-CLEANUP-CHECKLIST.md). *(README BOM 3 lớp chi tiết nằm trên PR #4 nếu chưa merge `main`.)*

---

← [Quay về Business README](../README.md)
