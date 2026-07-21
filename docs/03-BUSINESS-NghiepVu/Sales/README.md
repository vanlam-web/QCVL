# SALES — Nghiệp vụ Bán hàng

> Index nghiệp vụ bán hàng. Queue sản phẩm: [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).  
> Tiến độ chỉnh lý docs: [../../DOC-CLEANUP-CHECKLIST.md](../../DOC-CLEANUP-CHECKLIST.md).
>
> Cách đọc trừ kho/BOM: **SoT** ≠ **runtime từng path** (bảng dưới).

---

## Cấu trúc

| File | Mô tả | Nguồn gốc |
|---|---|---|
| [POS-CUSTOMER.md](./POS-CUSTOMER.md) | Nghiệp vụ khách hàng POS — SĐT, mã khách, tên khách và nhóm khách | Chốt từ draft 2026-06-30 |
| [POS-PRICING.md](./POS-PRICING.md) | Nghiệp vụ giá bán POS — bảng giá, giá sửa tay, lịch sử giá và đơn vị bán hàng | Chốt từ draft 2026-06-30 |
| [POS-ORDER-CALC.md](./POS-ORDER-CALC.md) | Quy tắc tính giỏ hàng — phân loại ĐVT, cộng dồn dòng trùng | Di chuyển từ PRD-UX 2026-06-26 |
| [POS-ORDER-LIFECYCLE.md](./POS-ORDER-LIFECYCLE.md) | Vòng đời đơn hàng POS — nháp, báo giá, hóa đơn bán hàng | Bổ sung 2026-06-27 |
| [POS-CHECKOUT.md](./POS-CHECKOUT.md) | Nghiệp vụ thanh toán — trừ kho, sổ quỹ, tiền thừa/nợ | Di chuyển từ PRD-UX 2026-06-26 |
| [POS-CUSTOMER-DEBT.md](./POS-CUSTOMER-DEBT.md) | Nghiệp vụ công nợ khách hàng — phát sinh nợ, thu tiền, số dư lũy kế | Tách từ PRD-UX 2026-06-27 |
| [POS-BILL-PRINT-MESSAGING.md](./POS-BILL-PRINT-MESSAGING.md) | Bill, in và gửi bill sau báo giá/hóa đơn | Chốt từ draft bill 2026-07-01 và Owner 2026-07-05 |

SoT BOM đầy đủ: [../BOM/BOM-RULES.md](../BOM/BOM-RULES.md) · Tồn kho: [../Inventory/README.md](../Inventory/README.md)

**Biên bản rà POS trừ kho (2026-07-21):** [POS-STOCK-AUDIT-2026-07-21.md](./POS-STOCK-AUDIT-2026-07-21.md)

---

## Trừ kho khi bán — trạng thái (2026-07-20)

### 1. SoT nghiệp vụ (Owner)

| # | Chốt |
|---|---|
| A | Hàng thường / có `track_inventory`: trừ theo **mã hàng bán** |
| B | **Combo/BOM:** chỉ trừ **thành phần**; **không** trừ tồn theo mã combo (`track_inventory = false`) |
| C | BOM từ KiotViet: mục tiêu **`active` dùng ngay** (Owner 2026-07-20) — không luồng nháp→duyệt cho KV |
| D | Giá bán combo độc lập với BOM |
| E | MVP: cảnh báo tồn âm, không chặn bán chỉ vì thiếu tồn |
| F | Owner 2026-07-20: **đã import hết** HD/KV — không mở import HD mới làm việc tiếp theo |

### 2. Runtime theo path (rà soát 2026-07-20)

| Path | Runtime | Khớp SoT? |
|---|---|---|
| **Postgres POS live** (`saveSalesDocument` → `saveSalesDocumentStockMovements`) | Hóa đơn `completed`: **luôn** `sale_deduction` cho **parent** dòng (không check `track_inventory` / `product_kind`); sau đó trừ component nếu có BOM `draft` **hoặc** `active` | **Không** — combo có thể bị trừ **cả mã combo lẫn thành phần**. Chi tiết: [POS-STOCK-AUDIT-2026-07-21.md](./POS-STOCK-AUDIT-2026-07-21.md) |
| **Postgres import HD KV** (`upsertImportedKiotVietInvoices`) | Parent chỉ khi `track_inventory = true` (combo import thường `false` → không trừ parent); vẫn trừ component từ BOM `draft`/`active` | **Một phần** |
| **Dev-memory** POS / import HD | Parent chỉ khi `track_inventory = true`; component từ `draftBoms` in-memory (không phân active) | **Một phần** |

**Không** viết “checkout đã trừ đúng combo” cho mọi path. Path lệch nặng nhất = **Postgres POS live**.

Chi tiết BOM import/UI stub: checklist + PR BOM docs (#4) nếu đã merge; SoT rule: [BOM-RULES.md](../BOM/BOM-RULES.md).

### 3. Hướng dài / chưa làm (docs ghi; code chờ Owner)

- Sửa Postgres POS: không trừ parent khi combo / `track_inventory = false`
- Import BOM → `active`; migrate draft KV; UI bỏ “BOM nháp”
- Snapshot BOM trên chứng từ; deep-scan nhiều cấp
- POS `Không lưu` / `Lưu Combo mới` đầy đủ
- Trừ kho object cuộn/tấm khi bán thành phần roll/sheet

---

## Ghi chú BOM/Combo (ranh giới sản phẩm)

- **SoT combo phẳng cấp 1:** đã chốt (mục trên + BOM-RULES).
- **Hướng dài:** chỉnh BOM trên dòng POS (`Không lưu` / `Lưu Combo mới`), deep-scan nhiều cấp — chưa runtime đầy đủ.
- Không nhầm “PRD K02 đã mô tả” với “Postgres POS đã đúng”.

---

## Vòng đời POS / chứng từ — trạng thái (2026-07-20)

| Hạng mục | SoT | Runtime |
|---|---|---|
| Nháp POS local | Chưa trừ kho / chưa doanh thu | Có |
| Lưu báo giá `BG...` | Không giữ hàng, không trừ kho | Có |
| Mở lại báo giá → POS | Đưa vào nháp để sửa/checkout | Có; **không** đảm bảo overwrite báo giá gốc / luôn gửi `source_quote_id` |
| Checkout → `HD...` | Trừ kho + tiền/công nợ | Có — **trừ kho combo:** xem mục Trừ kho khi bán |
| Sửa hóa đơn (revision) | Mã `MaCu.01`, đảo an toàn | Có một phần |
| Hủy hóa đơn / đảo kho-tiền | Spec đầy đủ | **Một phần** — không khẳng định đủ rule 10 ngày/soft-lock/đảo đầy đủ |

Chi tiết rule: [POS-ORDER-LIFECYCLE.md](./POS-ORDER-LIFECYCLE.md). Khi đọc lifecycle, ưu tiên bảng runtime trên; phần SoT rộng hơn code thì để hướng dài.

---

## Khách hàng / công nợ — trạng thái ngắn

| Hạng mục | Ghi chú |
|---|---|
| Import khách KV | **Đã xong / đóng** (Owner 2026-07-20 không import thêm) |
| List/detail Customers | PRD: [../../02-PRD-UX-PhongCanh/Customers/](../../02-PRD-UX-PhongCanh/Customers/) |
| Tổng nợ / tab nợ | UI đọc **canonical** Finance (`customer-debt`); ledger hiển thị; không tự cấn trừ NCC liên kết |
| SoT debt | [POS-CUSTOMER-DEBT.md](./POS-CUSTOMER-DEBT.md) — nếu doc cũ nói “không âm tuyệt đối” mà runtime có số âm đối soát, ưu tiên canonical backend + ghi chú đối soát |

---

## Tham chiếu

- [PRD-UX POS](../../02-PRD-UX-PhongCanh/POS/)
- [Database Sales](../../04-DATABASE/Sales/)
- [Backend POS](../../05-BACKEND-MayChu/POS/)
- [DOC-CLEANUP-CHECKLIST.md](../../DOC-CLEANUP-CHECKLIST.md)

---

← [Quay về 03-BUSINESS README](../README.md)
