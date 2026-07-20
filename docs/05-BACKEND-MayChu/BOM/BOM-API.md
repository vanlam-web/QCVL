# BOM API — Backend contract

> **Vai trò:** Contract mục tiêu + ghi rõ hiện trạng stub.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)
> **Hiện trạng tổng:** [BOM README mục 2](../../03-BUSINESS-NghiepVu/BOM/README.md)

---

## 0. Hiện trạng runtime (2026-07-20)

| Hạng mục | Hiện trạng |
|---|---|
| Import KV → BOM | Có parse/ghi DB; **sai status** (`draft` thay vì `active`) |
| Product list field `draft_bom` | Có; chỉ join BOM `draft`; UI copy “nháp / rà soát” — **sai SoT** |
| `GET /api/v1/products/{id}/bom` | **Stub** (`data: null`) trong `server/http.ts` |
| `POST` / `PUT` `/api/v1/products/{id}/bom` | Frontend gọi `POST`; handler **stub** trả BOM rỗng fake `active` |
| `POST /v1/boms/{id}/activate` | **Không có** |
| `preview` / `validate` | **Không có** |
| Trừ kho khi bán (Postgres POS) | Trừ parent + component — **sai SoT** (xem README) |

Không mô tả stub như đã hoàn thành. Khi nối thật API, cập nhật mục này cùng PR.

---

## 1. Endpoints mục tiêu

| Method | Path | Mục đích | Ưu tiên |
|---|---|---|---|
| `GET` | `/v1/products/{product_id}/bom` | Lấy BOM **active** (đang dùng) | Slice khi bỏ stub |
| `POST` | `/v1/products/{product_id}/bom` | Tạo/lưu version BOM | Slice khi bỏ stub |
| `PUT` | `/v1/products/{product_id}/bom` | Alias lưu/thay thế (nếu giữ) | Tùy; frontend hiện dùng `POST` |
| `GET` | `/v1/boms/{bom_id}` | Chi tiết version | Hướng dài |
| `POST` | `/v1/boms/{bom_id}/activate` | Đặt version `active` (BOM **tay**, không dùng sau import KV) | Hướng dài / tùy chọn |
| `POST` | `/v1/boms/preview` | Deep-scan / chi phí tham khảo | Hướng dài |
| `POST` | `/v1/boms/validate` | Vòng lặp, độ sâu | Hướng dài |

### Tạo combo tay (mục tiêu)

1. `POST /products` với `sell_method = combo`, `track_inventory = false`.
2. `POST /products/{id}/bom` lưu thành phần → BOM `active`.
3. Bán: trừ thành phần, không trừ mã combo.

### Owner 2026-07-20

- Import KV đặt `active` ngay; **không** bắt `activate` sau import.
- `draft_bom` trên list/detail: tên cũ; nghĩa = BOM đang dùng; **không** UI “nháp chờ duyệt”.
- Migrate draft KV cũ khi triển khai.

### Metadata dòng BOM

Không lưu `component_type` / role chính-phụ trên dòng. `product_kind = auxiliary_material` là loại hàng của vật tư. Payload dòng: `component_product_id`, `quantity`, `notes` (+ metadata đọc: `product_kind`, `latest_purchase_cost` nếu có).

Tự hiệu chỉnh định mức từ kiểm kho/khui: **phase sau**.

---

## 2. Checkout / trừ kho *(SoT)*

| Trường hợp | Contract mục tiêu |
|---|---|
| Dùng BOM chuẩn | Backend resolve BOM `active` (hoặc client gửi `bom_id`/version) |
| BOM phát sinh trên dòng | `line_bom_snapshot` — **hướng dài** |

Khi chốt hóa đơn combo:

1. Không `sale_deduction` trên mã combo nếu `track_inventory = false` / `product_kind = combo`.
2. Tạo `sale_deduction` cho từng thành phần theo định mức × SL bán.
3. Snapshot đầy đủ: hướng dài.

---

## 3. Deep-scan *(hướng dài)*

Giữ hướng: bung BOM con → vật tư lá; chống vòng lặp; max 5 cấp; thiếu BOM con → warning, không chặn checkout MVP nếu rule cho phép.

**Slice hiện tại:** trừ phẳng `product_bom_items` cấp 1.

---

## 4. Inventory

BOM API (khi có) chỉ tính vật tư cần trừ. Chọn cuộn/tấm và ghi movement theo Inventory rules. Không trừ tổng `m2` trực tiếp cho `roll`/`sheet` khi đã quản lý vật lý.
