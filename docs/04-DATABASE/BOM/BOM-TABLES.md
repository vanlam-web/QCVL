# BOM Tables — Phác thảo dữ liệu định mức vật tư

> **Vai trò:** Thiết kế dữ liệu mục tiêu.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)
> **Hiện trạng runtime:** [BOM README mục 2](../../03-BUSINESS-NghiepVu/BOM/README.md) — bảng đã có; import vẫn ghi `draft`; snapshot/deep-scan chưa đủ.

---

## 1. Bảng BOM chuẩn

### `product_boms`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `product_id` | Sản phẩm/combo sở hữu BOM |
| `version` | Số version tăng dần |
| `status` | `draft`, `active`, `archived` |
| `notes` | Nullable; import KV có thể ghi source text để đối soát |
| `created_by`, `created_at` | Audit |

**SoT từ 2026-07-20:** BOM import từ KiotViet phải là `active`. Giá trị `draft` chỉ còn nghĩa cho BOM tay chưa hoàn tất (nếu sau này có), **không** dùng làm “chờ duyệt KV”.

Chỉ một BOM `active` hiện hành cho một sản phẩm tại một thời điểm.

### `product_bom_items`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `bom_id` | FK `product_boms` |
| `component_product_id` | Vật tư/sản phẩm thành phần |
| `quantity` | Định mức |
| `unit_id` | Đơn vị định mức (nullable tùy implement) |
| `calculation_payload` | JSON kích thước/diện tích nếu có (hướng dài) |
| `sort_order` | Thứ tự |
| `notes` | Nullable |

Thành phần có thể là vật tư lá hoặc (hướng dài) sản phẩm có BOM con.

---

## 2. Snapshot trên chứng từ *(hướng dài)*

### `order_item_bom_snapshots`

Mục tiêu: hóa đơn cũ không đổi khi BOM chuẩn sửa sau.

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `order_item_id` | Dòng hóa đơn/báo giá |
| `source_type` | `standard_bom`, `line_override` |
| `source_bom_id` / `source_bom_version` | Nullable |
| `snapshot_payload` | JSON thành phần đã dùng |
| `created_at` | Audit |

**Chưa bắt buộc** để nghiệm thu slice import KV + trừ thành phần cấp 1. Bắt buộc khi làm đủ chỉnh BOM trên POS / deep-scan.

---

## 3. Validation *(hướng dài trừ rule cơ bản)*

| Rule | Slice hiện tại | Hướng dài |
|---|---|---|
| Import thiếu component → skip BOM | Có | — |
| Một `active` / sản phẩm | Mục tiêu khi promote import | — |
| Chống vòng lặp / max 5 cấp | Chưa | Có |
| Không xóa version đã tham chiếu chứng từ | Chưa | Có |

---

## 4. Import KiotViet

### Mục tiêu SoT (Owner 2026-07-20)

- Parse `Mã:Định mức|Mã:Định mức` → `product_bom_items`.
- `status = active`.
- Import lại: archive BOM KV cũ của cùng sản phẩm → version mới `active`.
- Bán combo: trừ items; không trừ mã combo.
- Promote dữ liệu cũ còn `draft` khi triển khai.

### Runtime rà soát 2026-07-20 *(chưa khớp)*

- Hàm `upsertDraftProductBoms` vẫn insert `draft` và archive theo `status = draft`.
- Khi làm code: đổi sang upsert active (đổi tên hàm cho khớp hành vi), promote draft KV cũ, bỏ note “Review before activating”.

### Field API `draft_bom`

Tên tương thích client. Nghĩa SoT = metadata BOM đang dùng (thường `active`). Không gắn UI “nháp chờ kích hoạt”.

### Endpoint activate

Không bắt buộc sau import KV. Có thể thêm sau cho BOM tạo tay; hiện **chưa có** route.

### Lịch sử (superseded)

2026-07-10 từng chốt import `draft` rồi duyệt. **Đã thay** bởi 2026-07-20.
