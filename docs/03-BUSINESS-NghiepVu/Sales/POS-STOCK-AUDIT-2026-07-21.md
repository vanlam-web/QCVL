# POS Stock Audit — 2026-07-21

> **Loại:** Biên bản rà code + doc (chưa sửa runtime).  
> **Phạm vi:** Trừ kho khi checkout POS / lưu hóa đơn.  
> **SoT:** [README.md](./README.md) mục Trừ kho khi bán · [BOM-RULES](../BOM/BOM-RULES.md) · [DOC-CLEANUP-CHECKLIST](../../DOC-CLEANUP-CHECKLIST.md).

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

## 3. Runtime theo path

### 3.1 Postgres POS live — **LỆCH SoT (nặng)**

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

## 4. Điểm liên quan (ngoài trừ kho dòng)

| Hạng mục | Kết quả rà |
|---|---|
| Cart validate | Không chặn thiếu tồn (đúng MVP cảnh báo/tồn âm) |
| BOM API get/save trên product | Stub `http.ts` — UI BOM có thể không load BOM import thật |
| Import BOM status | Vẫn `draft` + note Review… (SoT = `active`) |
| Revision hóa đơn | Gọi lại `saveSalesDocumentStockMovements` — cùng bug parent nếu Postgres |
| Báo giá | Không trừ kho — OK |

---

## 5. Việc nên làm khi Owner bảo code (không làm trong biên bản này)

1. **Postgres POS:** trước khi insert parent movement, load product; skip nếu `!track_inventory` hoặc `product_kind === 'combo'` (và ideally `service`).  
2. Thêm regression test Postgres: bán combo `track_inventory=false` + BOM → chỉ movement thành phần.  
3. Align import BOM → `active` + UI (slice BOM riêng hoặc cùng PR).  
4. Cân nhắc chỉ trừ BOM `active` khi SoT đã promote (hiện draft cũng trừ — intentional tạm hay bug? Doc: SoT muốn active).

---

## 6. Checklist nghiệm thu sau khi sửa code

- [ ] Bán 1 combo KV trên Postgres: `stock_movements` không có dòng mã combo  
- [ ] Có đủ dòng thành phần × định mức × SL  
- [ ] Hàng thường vẫn trừ parent  
- [ ] Báo giá không sinh `sale_deduction`  
- [ ] Dev-memory + Postgres cùng rule parent  
- [ ] Test mới trong `db.test.ts` xanh  

---

← [Sales README](./README.md) · [DOC-CLEANUP-CHECKLIST](../../DOC-CLEANUP-CHECKLIST.md)
