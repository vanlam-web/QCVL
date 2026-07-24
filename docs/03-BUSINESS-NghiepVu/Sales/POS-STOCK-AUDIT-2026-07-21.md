# POS Stock Audit — 2026-07-21

> **Loại:** Biên bản rà code (lịch sử).  
> **Trạng thái 2026-07-21:** **Đã sửa runtime** — Postgres POS skip parent combo/service; BOM KV `active` + migrate `0008`; xem [Sales README](./README.md) · [BOM README](../BOM/README.md).  
> Các mục dưới giữ nguyên nội dung lúc rà để đối chiếu; không còn là “chờ code”.

---

## 1. Luồng gọi (Postgres / NAS)

```text
UI CheckoutPanel
  → orderService.checkout → POST /api/v1/orders/checkout
  → http.ts checkout
  → makeOrderFromCheckout (chỉ product_id + SL + giá…)
  → repository.saveSalesDocument
  → saveSalesDocumentStockMovements   ← trừ kho
```

Frontend (`pos-core.ts` `lineToCheckoutItem`) **không** gửi BOM/component; trừ kho hoàn toàn do backend.

Quote (`order_type = quote`) → `saveSalesDocumentStockMovements` **không** ghi `sale_deduction` (chỉ khi `invoice` + `completed`).

---

## 2. SoT (Owner)

| Rule | Nội dung |
|---|---|
| Hàng track inventory | Trừ theo mã hàng bán |
| Combo | **Chỉ** trừ thành phần; **không** trừ mã combo |
| BOM KV | Mục tiêu `active` dùng ngay (2026-07-20) |
| Báo giá | Không trừ kho |

---

## 3. Runtime theo path *(tại thời điểm rà — trước khi sửa trên `main`)*

> Sau #7 / sync: Postgres POS đã skip parent combo; BOM KV `active`. Xem [Sales README](./README.md). Các mục 3–4 dưới đây là **ảnh chụp lúc rà**, không phải trạng thái hiện tại.

### 3.1 Postgres POS live — **LỆCH SoT (nặng)** *(đã sửa)*

File: `server/db.ts` → `saveSalesDocumentStockMovements`

| Bước | Hành vi code |
|---|---|
| Parent | Với mọi dòng hóa đơn `completed`, luôn `sale_deduction` theo `product_id` nếu SL ≠ 0. **Không** đọc `products.track_inventory` / `product_kind`. |
| BOM | Sau đó trừ từng component từ `draftBomComponentsByProductId` (`status in ('draft','active')`), bỏ qua component `track_inventory = false`. |

**Hệ quả combo import chuẩn** (`product_kind=combo`, `track_inventory=false`, có BOM):

1. Trừ **mã combo** (sai SoT)  
2. Trừ **thành phần** (đúng hướng)  
→ tồn combo bị âm giả; thành phần vẫn trừ đúng định mức.

**Test Postgres:** `db.test.ts` chỉ cover hàng thường (`writes PostgreSQL stock movements from POS invoices…`). **Không** có test combo POS trên Postgres.

### 3.2 Postgres import hóa đơn KV — **gần đúng parent**

`upsertImportedKiotVietInvoices`: parent chỉ khi `product.track_inventory === true`; rồi trừ BOM draft/active.

Combo import thường `track_inventory=false` → **không** trừ parent. Vẫn dùng BOM `draft`.

### 3.3 Dev-memory POS — **gần đúng parent**

`stockMovementsFromDocuments` / `saveSalesDocument`: check `track_inventory` trên parent.

Test có: `deducts trusted KiotViet BOM components from POS invoices` — chỉ thấy movement thành phần `BT`, không trừ `IB`.

**Cảnh báo:** NAS/`3200` dùng Postgres → hành vi **3.1**, không phải 3.3.

---

## 4. Điểm liên quan *(lúc rà — một phần đã sửa)*

| Hạng mục | Kết quả rà | Sau `main` 2026-07-21 |
|---|---|---|
| Cart validate | Không chặn thiếu tồn (đúng MVP) | Giữ |
| BOM API get/save | Stub | **Đã nối** GET/POST/PUT |
| Import BOM status | `draft` + Review… | **`active`** + migrate `0008` |
| Revision hóa đơn | Cùng bug parent Postgres | Cùng rule skip parent |
| Báo giá | Không trừ kho | Giữ |

---

## 5. Chốt theo KiotViet (Owner: tham khảo KV — 2026-07-21)

Tham khảo chính thức KV + thẻ kho xưởng:

- [Hàng Combo – Đóng gói (Retail)](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-hang-hoa/hang-combo-dong-goi/)
- [Hàng Combo – Đóng gói (FnB)](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-hang-hoa/hang-combo-dong-goi/)
- Thẻ kho KV: dòng `Ban hang [Combo - Dong goi]` gắn **thành phần** (vd. `BT`), không trừ tồn mã combo

**KV nói gì (tóm tắt):**

1. Combo/đóng gói **không quản lý tồn riêng** — không có tồn/giá vốn độc lập trên mã combo.  
2. Khi bán combo: **không trừ tồn mã combo**; **tự động trừ tồn từng thành phần**.  
3. Giá vốn combo = tổng giá vốn thành phần.  
4. Không hỗ trợ đặt hàng nhập / nhập hàng trực tiếp cho loại Combo – Đóng gói.

| # | Câu hỏi trước đó | Chốt theo KV → QCVL |
|---|---|---|
| 1 | Skip parent theo gì? | **Không trừ tồn mã combo.** Gate: `track_inventory === false` **hoặc** `product_kind` ∈ (`combo`, `service`). Khớp KV: combo/đóng gói **không quản lý tồn riêng**; dịch vụ cũng không tồn. |
| 2 | Cùng lúc BOM `active`? | KV dùng thành phần **ngay khi bán**, không nháp duyệt. **Slice POS:** sửa skip parent trước; **vẫn trừ BOM `draft`\|`active`** cho đến khi migrate import → `active` (PR BOM riêng). Không chuyển “chỉ active” trước migrate — sẽ mất trừ thành phần. |
| 3 | Movement cũ đã trừ nhầm mã combo? | KV **không bao giờ** sinh tồn-out cho mã combo. QCVL lệch lịch sử: **mặc định để nguyên** (ghi nhận lệch); chỉ dọn/đảo nếu Owner yêu cầu riêng sau khi rule POS đúng. |

### Slice đã làm (2026-07-21)

1. Postgres skip parent theo gate mục 1 (+ test combo).  
2. Vẫn trừ thành phần từ BOM `draft`\|`active`.  
3. Cùng PR runtime: migrate BOM KV → `active`, UI, `GET/POST/PUT /bom` — [BOM README](../BOM/README.md).

---

## 6. Checklist nghiệm thu

- [x] Test Postgres combo trong `db.test.ts`  
- [x] Dev-memory + Postgres cùng rule skip parent  
- [ ] Smoke NAS: bán 1 combo KV — thẻ kho không có mã combo (sau deploy + `db:migrate`)

---

← [Sales README](./README.md) · [DOC-CLEANUP-CHECKLIST ](../../DOCUMENT_RULES.md)
