# BOM Tables — Phác thảo dữ liệu định mức vật tư

> **Vai trò:** Thiết kế dữ liệu mục tiêu.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)
> **Trạng thái runtime / path trừ kho:** [Sales README](../../03-BUSINESS-NghiepVu/Sales/README.md) · [DOC-CLEANUP-CHECKLIST](../../DOC-CLEANUP-CHECKLIST.md)
> *(README BOM 3 lớp đầy đủ trên PR #4 nếu chưa merge.)*

---

## 1. Bảng BOM chuẩn

### `product_boms`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `product_id` | Sản phẩm/combo sở hữu BOM |
| `version` | Số version tăng dần |
| `status` | `draft`, `active`, `archived` |
| `notes` | Nullable; import KV có thể ghi source text |
| `created_by`, `created_at` | Audit |

**SoT từ 2026-07-20:** BOM import từ KiotViet phải là `active`. `draft` không dùng làm “chờ duyệt KV”.

Chỉ một BOM `active` hiện hành cho một sản phẩm tại một thời điểm.

### `product_bom_items`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `bom_id` | FK `product_boms` |
| `component_product_id` | Vật tư/sản phẩm thành phần |
| `quantity` | Định mức |
| `unit_id` | Đơn vị định mức (nullable tùy implement) |
| `calculation_payload` | JSON nếu có (hướng dài) |
| `sort_order` | Thứ tự |
| `notes` | Nullable |

---

## 2. Snapshot trên chứng từ *(hướng dài)*

### `order_item_bom_snapshots`

Mục tiêu: hóa đơn cũ không đổi khi BOM chuẩn sửa sau. **Chưa bắt buộc** nghiệm thu slice trừ thành phần cấp 1.

---

## 3. Import KiotViet

### Mục tiêu SoT (Owner 2026-07-20)

- Parse `Mã:Định mức|Mã:Định mức` → `product_bom_items`.
- `status = active`.
- Import lại: archive BOM KV cũ → version mới `active`.
- Bán combo: trừ items; không trừ mã combo.

### Runtime (2026-07-20) — chưa khớp

- `upsertDraftProductBoms` vẫn insert `draft` + note *Review before activating*.
- Field API `draft_bom` vẫn mang nghĩa draft/UI nháp.
- Khi làm code: đổi sang active, migrate draft cũ, bỏ copy nháp.

Dữ liệu `Hàng thành phần` từ KiotViet được import thành BOM **`active`**, dùng ngay khi bán (Owner 2026-07-20).

Không lưu định dạng text `Ma:SoLuong|Ma:SoLuong` làm schema chính.

## Ghi chú triển khai import KiotViet (cập nhật 2026-07-21)

- **Đã import hết:** không mở đợt import mới. BOM `draft` sẵn có → migration `0008_promote_kiotviet_bom_active.sql`.
- Path Import (nút khẩn): parse `Hàng thành phần` → `product_boms.status = active`, note `Trusted for stock deduction`.
- Mỗi lần Import lại (khẩn): version mới; archive BOM KV cũ (`draft`|`active`) cùng sản phẩm.
- Thiếu sản phẩm cha hoặc thiếu component theo mã hàng thì bỏ qua BOM đó và tăng `bom_skipped_rows`.
- Ghi source text vào `notes` để đối soát, schema chính vẫn là `product_bom_items`.

### Lịch sử (superseded)

2026-07-10 từng chốt import `draft` rồi duyệt. **Đã thay** bởi 2026-07-20.
