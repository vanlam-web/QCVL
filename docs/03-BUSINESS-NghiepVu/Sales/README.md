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

### 2. Runtime theo path (cập nhật 2026-07-21)

| Path | Runtime | Khớp SoT? |
|---|---|---|
| **Postgres POS live** (`saveSalesDocumentStockMovements`) | Skip parent nếu `!track_inventory` hoặc `product_kind` ∈ (`combo`,`service`); trừ component từ BOM `draft`\|`active` | **Có** (slice KV) |
| **Postgres import HD KV** | Parent chỉ khi `track_inventory = true`; trừ component BOM `draft`\|`active` | **Có** (parent) |
| **Dev-memory** POS / import HD | Parent chỉ khi `track_inventory = true`; component từ BOM in-memory | **Có** (parent) |

BOM KV: migrate `0008` + path Import khẩn ghi `active` — [BOM README](../BOM/README.md). Biên bản trước sửa: [POS-STOCK-AUDIT-2026-07-21.md](./POS-STOCK-AUDIT-2026-07-21.md).

### 3. Hướng dài / chưa làm

> Owner 2026-07-21: **P4 đóng băng** — không mở code các mục dưới đến khi Owner bảo. Slice combo phẳng cấp 1 đã khớp trên `main`.

- Snapshot BOM trên chứng từ; deep-scan nhiều cấp
- POS `Không lưu` / `Lưu Combo mới` đầy đủ
- Trừ kho object cuộn/tấm khi bán thành phần roll/sheet
- Dọn movement lịch sử từng trừ nhầm mã combo (chỉ nếu Owner yêu cầu)

---

## Vận hành đơn mới sau import (Owner 2026-07-21)

> **Mục tiêu:** Không import file KV mới. Nhập **đơn phát sinh trên QCVL** sau đợt import; UI tạo một số loại đơn còn thiếu; sau khi nhập → **đối soát trùng/lệch với chứng từ KV đã có**.

### 1. SoT hướng làm

| # | Chốt |
|---|---|
| A | Master + chứng từ lịch sử KV **đã import đủ** — không mở đợt import mới |
| B | Đơn mới = chứng từ tạo trên QCVL (POS / sổ quỹ / …), **không** nhập lại bằng file Excel KV |
| C | Sau khi có đơn mới: đối soát với mã KV đã import (`HD…`, `PN…`, `TTHD…`…) — tránh nhầm / trùng nghiệp vụ |
| D | P4 (mốc mở, Purchase persist nếu vẫn stub, deep-scan…) vẫn đóng băng trừ khi chặn trực tiếp việc nhập đơn Owner chọn |

### 2. Runtime tạo đơn hôm nay

| Loại đơn | Tạo live? | Ghi chú |
|---|---|---|
| Hóa đơn bán POS → `HD…` | **Có** (Postgres) | Mã = `max(HD)+1` trên tập đã có (gồm HD import) |
| Báo giá → `BG…` | **Có** | Qua POS |
| Phiếu thu/chi thủ công Sổ quỹ | **Có** | Prefix `PT*` / `PC*` riêng (khác nhiều mã KV) |
| Tạo nhanh KH/NCC từ phiếu thu/chi | **Có** (UI) | Nút `Tạo mới` → `POST /customers` / `POST /suppliers` |
| Phiếu nhập → `PN…` | **Có** (hàng thường) | Draft/post Postgres; P4 object cuộn/tấm vẫn đóng băng — [Purchase README](../Purchase/README.md) |
| Tạo NCC mới | **Có** | `POST /suppliers` persist `supplier_snapshots` manual; mã trống → `NCC…`; trùng → 409 |
| Tạo hàng hóa mới | **Có** | `POST /products` persist Postgres/dev-memory; trùng mã → 409; combo/service ép `track_inventory=false` theo KV |

### 3. Đối soát trùng KV (SoT tối thiểu)

- Không gian mã: `UNIQUE (organization_id, code)` — trùng mã DB sẽ lỗi.
- HD/BG mới: sinh tiếp sau mã lớn nhất đã có (gồm import) → giảm trùng mã tự động; **chưa** có màn hình “check trùng KV” riêng khi lưu.
- Đối soát vận hành: tra list Hóa đơn / Phiếu nhập / Sổ quỹ theo mã trước khi tin tồn/công nợ.
- **Chưa chốt UI:** báo cáo/cờ “đơn QCVL vs đã có trên KV” — làm khi Owner mở slice.

### 4. Việc docs/code tiếp theo (chờ Owner chỉ loại đơn)

Trước khi sửa code: Owner chọn loại đơn cần nhập trước (HD POS đã có / PN live / tạo SP / khác) và liệt kê chỗ UI còn thiếu khi thử nhập.

---

## Ghi chú BOM/Combo (ranh giới sản phẩm)

- **SoT + runtime slice KV (combo phẳng cấp 1):** đã khớp — [BOM README](../BOM/README.md).
- **Hướng dài:** chỉnh BOM trên dòng POS (`Không lưu` / `Lưu Combo mới`), deep-scan nhiều cấp — chưa runtime đầy đủ.

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
| Số âm / thu live | Owner 2026-07-21: được hiện âm khi đối soát; thu live không trả thừa — [POS-CUSTOMER-DEBT BR-DEBT-06](./POS-CUSTOMER-DEBT.md) |
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
