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

## 2. Hiện trạng code (rà soát 2026-07-20)

**Chưa khớp** quyết định 2026-07-20. Checklist cũng ghi runtime chưa làm cho đến khi Owner bảo triển khai.

| Hạng mục | Runtime hiện tại | Khớp SoT? |
|---|---|---|
| Parse `Hàng thành phần`, ép `product_kind = combo`, `track_inventory = false` | Có | Có |
| Import ghi `product_boms.status` | Vẫn `draft` + note *Review before activating* | **Không** (cần `active`) |
| Field API `draft_bom` | Chỉ trả BOM `status = draft` | **Không** (nghĩa phải = BOM đang dùng) |
| UI Catalog / import dialog | “BOM nháp KiotViet”, “Cần rà soát trước khi kích hoạt”, “BOM nháp” | **Không** |
| Trừ thành phần khi bán (Postgres) | Có — lấy BOM `draft` **và** `active` | Một phần (đúng hướng trừ component, sai trạng thái) |
| Trừ mã combo khi bán (Postgres POS `saveSalesDocumentStockMovements`) | Trừ parent **không** check `track_inventory` → có thể trừ **cả parent lẫn component** | **Không** |
| Trừ kho import hóa đơn KV / dev-memory | Thường chỉ trừ component nếu parent `track_inventory = false` | Gần đúng; lệch path Postgres POS |
| Migrate BOM KV `draft` → `active` | Chưa có | **Không** |
| `GET/POST /products/{id}/bom` | Stub trong `server/http.ts` (null / BOM rỗng fake) | **Không** (UI vẫn gọi) |
| `POST /boms/{id}/activate` | Không có route | Chưa cần cho KV; endpoint tay cũng chưa làm |
| Purchase / sửa tồn loại combo | UI đã loại combo | Có |
| Deep-scan nhiều cấp / snapshot BOM trên chứng từ / POS “Lưu Combo mới” đầy đủ | Chưa | Xem mục 3 |

**Khi Owner bảo triển khai**, thứ tự tối thiểu để khớp mục 1:

1. Import BOM → `active` + promote/archive draft KV cũ.
2. Postgres POS: không trừ parent khi combo / `track_inventory = false`.
3. Đổi nghĩa `draft_bom` + bỏ copy “nháp / cần rà soát”.
4. Nối thật `GET|POST .../bom` (hoặc tạm ẩn sửa BOM nếu chưa sẵn sàng).

---

## 3. Hướng dài / chưa làm (đã chốt hướng, chưa slice)

Giữ trong SoT để không mất hướng; **không** hiểu là đã có trong runtime:

| Hạng mục | Hướng đã chốt | Slice hiện tại |
|---|---|---|
| Deep-scan BOM lồng / chống vòng lặp / max 5 cấp | Có trong BOM-RULES | Chưa làm — trừ phẳng cấp 1 |
| Snapshot BOM đầy đủ trên mọi dòng hóa đơn | Có trong BOM-RULES / TABLES | Chưa làm đủ |
| POS chỉnh BOM dòng + `Không lưu` / `Lưu Combo mới` | Có trong PRD K02 + RULES | Chưa runtime đầy đủ |
| `preview` / `validate` BOM API | Có trong BOM-API | Chưa |
| Tự hiệu chỉnh định mức từ kiểm kho / khui / lịch sử | Phase sau | Chưa |
| Sản xuất sẵn / work order tăng tồn combo | **Không làm** theo 2026-07-20 | Loại khỏi scope hiện tại |

---

## 4. Quy ước ghi docs (tránh lệch lần sau)

- Quyết định nghiệp vụ chỉ sửa ở **mục 1** + [BOM-RULES.md](./BOM-RULES.md).
- Mỗi lần đổi code BOM/combo: cập nhật **mục 2** cùng PR (hoặc ghi rõ “đã khớp”).
- Không viết lại “nháp chờ duyệt” cho BOM KV trừ khi trong mục Lịch sử / superseded.
- Field `draft_bom` = **tên tương thích**; không dùng chữ “nháp” trong UI khi SoT đã chốt dùng ngay.

---

← [Quay về Business README](../README.md)
