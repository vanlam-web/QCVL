# BOM API — Backend contract

> **Vai trò:** Contract mục tiêu + hiện trạng runtime.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)
>
> **Runtime 2026-07-21:** `GET` + `POST|PUT /api/v1/products/{id}/bom` đã nối Postgres/dev-memory (lưu version `active`). Import KV ghi BOM `active` (Owner đã import hết — chỉ migrate `0008`, không re-import). `POST /boms/{id}/activate`, preview/validate, deep-scan — chưa. SoT: [BOM README](../../03-BUSINESS-NghiepVu/BOM/README.md) · trừ kho bán: [Sales README](../../03-BUSINESS-NghiepVu/Sales/README.md) · [DOC-CLEANUP-CHECKLIST](../../DOC-CLEANUP-CHECKLIST.md).


---

## 0. Hiện trạng runtime (2026-07-20)

| Hạng mục | Hiện trạng |
|---|---|
| Import KV → BOM | Parse/ghi DB; **sai status** (`draft` thay vì SoT `active`) |
| `draft_bom` trên product list | Có; nghĩa runtime vẫn draft + UI nháp — **sai SoT** |
| `GET/POST /products/{id}/bom` | **Stub** trong `server/http.ts` (null / BOM rỗng fake) |
| `POST /boms/{id}/activate` | **Không có** route |
| `preview` / `validate` | **Không có** |
| Trừ kho Postgres POS | Có thể trừ parent + component — **sai SoT combo** |

---

## 1. Endpoints mục tiêu

| Method | Path | Mục đích | Ưu tiên |
|---|---|---|---|
| `GET` | `/v1/products/{product_id}/bom` | Lấy BOM **active** | Khi bỏ stub |
| `POST` | `/v1/products/{product_id}/bom` | Tạo/lưu version | Khi bỏ stub |
| `PUT` | `/v1/products/{product_id}/bom` | Alias (frontend hiện `POST`) | Tùy |
| `GET` | `/v1/boms/{bom_id}` | Chi tiết version | Hướng dài |
| `POST` | `/v1/boms/{bom_id}/activate` | Active BOM **tay** (không bắt buộc sau import KV) | Hướng dài |
| `POST` | `/v1/boms/preview` | Deep-scan / chi phí tham khảo | Hướng dài |
| `POST` | `/v1/boms/validate` | Vòng lặp, độ sâu | Hướng dài |

**Owner 2026-07-20:** Import KV → `active` ngay; không bắt activate sau import. `draft_bom` = tên tương thích, nghĩa = BOM đang dùng.

Tạo combo tay (mục tiêu): `POST /products` (`sell_method=combo`, `track_inventory=false`) rồi `POST .../bom` → `active`. Bán: trừ thành phần, không trừ mã combo.

Payload dòng: `component_product_id`, `quantity`, `notes` (+ metadata đọc). Không `component_type`/role trên dòng.

---

## 2. Checkout / trừ kho (SoT)

1. Không `sale_deduction` trên mã combo nếu `track_inventory=false` / `product_kind=combo`.
2. Trừ thành phần theo định mức × SL.
3. Snapshot đầy đủ / deep-scan: hướng dài.

Runtime path: Sales README.

---

## 3. Deep-scan *(hướng dài)*

Slice hiện tại: trừ phẳng cấp 1. Hướng dài: bung BOM con, chống vòng lặp, max 5 cấp.

---

## 4. Inventory

BOM API (khi có) chỉ tính vật tư cần trừ. Chọn cuộn/tấm theo Inventory. Không trừ tổng `m2` trực tiếp cho `roll`/`sheet` khi đã quản lý vật lý.
