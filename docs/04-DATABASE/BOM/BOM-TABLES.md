# BOM Tables — Phác thảo dữ liệu định mức vật tư

> **Vai trò:** Source of Truth mức thiết kế dữ liệu; tên bảng/cột có thể tinh chỉnh khi implement.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)

---

## 1. Bảng BOM chuẩn

### `product_boms`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `product_id` | Sản phẩm/combo sở hữu BOM |
| `version` | Số version tăng dần |
| `status` | `draft`, `active`, `archived` |
| `notes` | Nullable |
| `created_by`, `created_at` | Audit |

Chỉ một BOM `active` hiện hành cho một sản phẩm tại một thời điểm.

### `product_bom_items`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `bom_id` | FK `product_boms` |
| `component_product_id` | Vật tư/sản phẩm thành phần |
| `quantity` | Định mức |
| `unit_id` | Đơn vị định mức |
| `calculation_payload` | JSON cho kích thước, diện tích, mét tới nếu có |
| `sort_order` | Thứ tự hiển thị |
| `notes` | Nullable |

Thành phần có thể là vật tư lá hoặc sản phẩm có BOM con.

---

## 2. Snapshot trên chứng từ

### `order_item_bom_snapshots`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `order_item_id` | Dòng hóa đơn/báo giá |
| `source_type` | `standard_bom`, `line_override` |
| `source_bom_id` | Nullable |
| `source_bom_version` | Nullable |
| `snapshot_payload` | JSON đầy đủ thành phần đã dùng |
| `created_at` | Audit |

Snapshot bắt buộc để hóa đơn cũ không đổi khi BOM chuẩn được sửa.

Với combo cha chứa combo con, snapshot phải giữ được cả:

- dòng combo con như một thành phần tham chiếu trong combo cha
- `source_bom_id` / `source_bom_version` hoặc dữ liệu tương đương của combo con tại thời điểm bán
- danh sách vật tư lá đã deep-scan nếu backend đã tính ở thời điểm chốt

Chứng từ cũ đọc theo snapshot/version đã lưu, không đọc lại BOM active mới nhất.

Khi lưu combo mới từ POS, BOM chuẩn mới giữ combo con là component tham chiếu. Không tự flatten combo con thành vật tư lá nếu người dùng không yêu cầu.

---

## 3. Validation bắt buộc

Backend/database layer phải hỗ trợ:

- chặn vòng lặp BOM
- giới hạn deep-scan mặc định 5 cấp
- không cho xóa BOM version đã được chứng từ tham chiếu nếu chưa có cơ chế archive an toàn
- sửa BOM active bằng cách tạo version mới

---

## 4. Import KiotViet

Dữ liệu `Hàng thành phần` từ KiotViet được import thành BOM **đang dùng** (`active`).

Không lưu định dạng text `Ma:SoLuong|Ma:SoLuong` làm schema chính.

### Quyết định Owner 2026-07-20

- Import xong dùng ngay khi bán combo trừ thành phần.
- Không còn luồng nháp → duyệt → kích hoạt cho BOM KiotViet.
- Không sản xuất sẵn trong phạm vi quyết định này.

## Ghi chú triển khai import KiotViet

### Lịch sử 2026-07-10 (đã superseded)

- Parse `Hàng thành phần` dạng `Mã:Định mức|Mã:Định mức`.
- Lúc đó lưu `product_boms.status = draft`, không tự active.
- Quyết định này **đã bị thay** bởi Owner 2026-07-20.

### Hiện hành từ 2026-07-20

- Parse `Hàng thành phần` dạng `Mã:Định mức|Mã:Định mức`.
- Lưu thành `product_boms.status = active`, dùng ngay khi bán.
- Tạo version mới cho mỗi lần import lại mã có BOM.
- Archive BOM KiotViet cũ (`draft` hoặc `active`) của cùng sản phẩm trước khi tạo version mới.
- Thiếu sản phẩm cha hoặc thiếu component theo mã hàng thì bỏ qua BOM đó và tăng `bom_skipped_rows`.
- Ghi source text vào `notes` để đối soát; schema chính vẫn là `product_bom_items`.
- Bán combo: trừ `product_bom_items`, không trừ tồn theo mã combo.