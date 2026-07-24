# Purchase/Supplier — Nghiệp vụ nhà cung cấp và nhập hàng

> Nguồn sự thật nghiệp vụ nhập hàng. Điều phối công việc: [PROJECT-COORDINATION.md](../../PROJECT-COORDINATION.md).
> Tiến độ chỉnh lý tài liệu: [Quy tắc tài liệu](../../DOCUMENT_RULES.md).
>
> Cách đọc: **SoT** ≠ **runtime** (bảng dưới). “Đã merge” trong slice cũ có thể chỉ là UI/import — không đồng nghĩa live create/post đã persist.

---

## Tài liệu trong nhóm

| File | Nội dung |
|---|---|
| [SUPPLIER-PURCHASE.md](./SUPPLIER-PURCHASE.md) | Quy tắc NCC, phiếu nhập, công nợ NCC, giá vốn, lát cắt P1–P5 |

---

## 1. Quyết định Owner (SoT)

| # | Chốt |
|---|---|
| A | Có NCC, phiếu nhập trực tiếp, công nợ phải trả, giá vốn từ phiếu nhập |
| B | Không đặt hàng nhập / trả hàng nhập / HĐĐT-VAT trong MVP hiện tại |
| C | Hàng thường: post phiếu → tăng tồn + công nợ + sổ quỹ (nếu trả tiền) |
| D | Cuộn/tấm: nhập theo object vật lý (P4) — hướng dài; không mua bằng tổng m² gộp |
| E | Trả NCC (P5): chọn **phiếu nhập cụ thể**, không FIFO cứng; không trả thừa trong P5 |
| F | Combo: không nhập/tăng tồn theo mã combo (Owner 2026-07-20 BOM) |
| G | Owner 2026-07-20: **đã import hết** PN/NCC KV — không mở đợt import mới |

---

## 2. Hiện trạng code (2026-07-21)

| Slice / hạng mục | Runtime | Khớp SoT? |
|---|---|---|
| P1 Supplier list/detail/import/link | Có — dùng được trên dữ liệu đã import | Phần lớn |
| **`POST /suppliers` tạo NCC tay** | Có — persist `supplier_snapshots` (`source_type=manual`); mã trống → `NCC000001…`; trùng mã → 409 | Có |
| List/detail phiếu nhập từ **import KV** (`purchase_receipt_snapshots`) | Có; PN posted import ghi `stock_movements.purchase_receipt` | Phần lớn (đọc lịch sử) |
| P2 Live `POST/PATCH` tạo/sửa draft phiếu nhập | Có — lưu `purchase_receipt_snapshots` Postgres cho phiếu manual | Phần lớn |
| P3 Live `POST .../post` hàng thường | Có — post phiếu manual, tăng `stock_movements`, cập nhật `latest_purchase_cost`, ghi công nợ/NCC total; nếu trả ngay thì ghi sổ quỹ | Phần lớn |
| P4 Post object roll/sheet từ phiếu nhập | Chưa | **Không** (candidate) |
| P5 Live trả NCC / `paySupplier` | Có đường repository Postgres, nhưng cần nghiệm thu thêm UI trả NCC nhiều case | Một phần |
| UI form draft / payload roll-sheet / form trả NCC | Có bề mặt UI | UI ahead of persist |
| Import thêm file KV PN/NCC | **Đóng** theo Owner | — |

**Đọc đúng:** vận hành hiện tại dùng cả PN import và PN manual. P2/P3 hàng thường đã test tạo thật trên `3202` với `PN000688` ngày 2026-07-21; P4 object cuộn/tấm và P5 trả NCC vẫn cần nghiệm thu sâu.

---

## 3. Hướng dài / chưa làm

> Owner 2026-07-21: **P4 đóng băng** — bản V1 dùng được tạm trên dữ liệu PN đã import; persist live + object cuộn/tấm = nâng cấp sau.

- P4 object cuộn/tấm khi post phiếu nhập
- Nghiệm thu sâu P5 thanh toán NCC từ detail phiếu/NCC
- Trả hàng nhập, đặt hàng nhập, báo cáo NCC nâng cao
- Không mở lại queue “import KV PN”

---

## Ranh giới MVP (rút gọn)

Giữ: NCC, phiếu nhập, công nợ NCC, giá vốn phục vụ tồn/PriceBook.  
Không: đặt hàng nhập, trả hàng nhập, HĐĐT/VAT, mua dịch vụ module riêng nếu phiếu chi đủ.

---

← [Quay về 03-BUSINESS README](../README.md)
