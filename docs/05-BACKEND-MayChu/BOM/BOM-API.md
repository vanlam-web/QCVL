# BOM API — Backend contract

> **Vai trò:** Contract mục tiêu + hiện trạng runtime.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)
>
> **Runtime 2026-07-21 (đã lên `main`):** `GET` + `POST|PUT /api/v1/products/{id}/bom` nối Postgres/dev-memory (lưu `active`). Path Import khẩn ghi BOM `active`; dữ liệu đã có → migrate `0008` (**không** re-import). SoT: [BOM README](../../03-BUSINESS-NghiepVu/BOM/README.md) · trừ kho: [Sales README](../../03-BUSINESS-NghiepVu/Sales/README.md) · [DOC-CLEANUP-CHECKLIST](../../DOC-CLEANUP-CHECKLIST.md).

---

## 0. Hiện trạng runtime (cập nhật 2026-07-21)

| Hạng mục | Hiện trạng | Khớp SoT? |
|---|---|---|
| Import KV / migrate → BOM | `active` + note *Trusted…*; migrate `0008` cho draft cũ | Có |
| `draft_bom` trên product list | Field tương thích; ưu tiên BOM `active` | Có |
| `GET/POST/PUT /products/{id}/bom` | Repo Postgres + dev-memory | Có (MVP) |
| `POST /products` tạo combo tay | Persist Postgres + dev-memory; ép `track_inventory=false` theo KV | Có |
| `POST /boms/{id}/activate` | Không có route | Chưa cần KV |
| `preview` / `validate` / deep-scan | Không có | P4 đóng băng |
| Trừ kho Postgres POS | Skip parent combo/service / `!track_inventory`; trừ thành phần BOM | Có |

---

## 1. Endpoints

| Method | Path | Mục đích | Trạng thái |
|---|---|---|---|
| `GET` | `/v1/products/{product_id}/bom` | Lấy BOM đang dùng (`active`, fallback `draft`) | **Có** |
| `POST` | `/v1/products/{product_id}/bom` | Tạo/lưu version `active` | **Có** |
| `PUT` | `/v1/products/{product_id}/bom` | Alias của `POST` | **Có** |
| `GET` | `/v1/boms/{bom_id}` | Chi tiết version | P4 / hướng dài |
| `POST` | `/v1/boms/{bom_id}/activate` | Active BOM tay | P4 — không bắt buộc sau import KV |
| `POST` | `/v1/boms/preview` | Deep-scan / chi phí tham khảo | P4 đóng băng |
| `POST` | `/v1/boms/validate` | Vòng lặp, độ sâu | P4 đóng băng |

**Owner 2026-07-20:** Import KV → `active` ngay. `draft_bom` = tên tương thích = BOM đang dùng.

Tạo combo tay: `POST /products` (`sell_method=combo`, `track_inventory=false`) rồi `POST .../bom` → `active`. Runtime đã persist product + BOM.

Payload dòng: `component_product_id`, `quantity`, `notes` (+ metadata đọc). Không `component_type`/role trên dòng.

---

## 2. Checkout / trừ kho (SoT)

1. Không `sale_deduction` trên mã combo nếu `track_inventory=false` / `product_kind=combo` (hoặc `service`).
2. Trừ thành phần theo định mức × SL từ BOM `draft`|`active`.
3. Snapshot đầy đủ / deep-scan: **P4 đóng băng**.

Runtime path: Sales README.

---

## 3. Deep-scan *(P4 đóng băng)*

Slice hiện tại: trừ phẳng cấp 1. Hướng dài: bung BOM con, chống vòng lặp, max 5 cấp — Owner 2026-07-21: nâng cấp sau.

---

## 4. Inventory

BOM API chỉ tính vật tư cần trừ. Chọn cuộn/tấm theo Inventory. Không trừ tổng `m2` trực tiếp cho `roll`/`sheet` khi đã quản lý vật lý (P4).
