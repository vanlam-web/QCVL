# FINANCE — Nghiệp vụ tài chính

> Index SoT tài chính. Queue: [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).  
> Checklist docs: [../../DOC-CLEANUP-CHECKLIST.md](../../DOC-CLEANUP-CHECKLIST.md).
>
> Công nợ khách chi tiết: [../Sales/POS-CUSTOMER-DEBT.md](../Sales/POS-CUSTOMER-DEBT.md) · PRD [../../02-PRD-UX-PhongCanh/Finance/03-CUSTOMER-DEBT.md](../../02-PRD-UX-PhongCanh/Finance/03-CUSTOMER-DEBT.md).

---

## Cấu trúc

| File | Mô tả |
|---|---|
| [CASHBOOK.md](./CASHBOOK.md) | Sổ quỹ, quỹ/tài khoản, phiếu thu/chi |

---

## 1. Quyết định Owner (SoT)

| # | Chốt |
|---|---|
| A | Sổ quỹ tiền mặt + tài khoản ngân hàng (không ví điện tử MVP trừ khi Owner mở) |
| B | Phiếu thu/chi; thu từ hóa đơn/thu nợ truy vết phân bổ |
| C | Lọc theo chế độ công nợ đối tác (tính / không tính / không có công nợ) khi SoT đã chốt |
| D | Công nợ khách: công thức chuẩn ở backend Finance (ledger/invoice-level) — UI Customers/Finance chỉ hiển thị |
| E | Owner 2026-07-20: **đã import hết** So quỹ KV cần dùng — không mở đợt import mới |

---

## 2. Hiện trạng code (2026-07-20)

| Hạng mục | Runtime | Khớp SoT? |
|---|---|---|
| Finance accounts (cash/bank) | Có API/list; dùng cho sổ quỹ | Phần lớn |
| Sổ quỹ list/detail + voucher UI | Có | Phần lớn |
| Import So quỹ KiotViet | Có endpoint/parser; dữ liệu đã nạp | Có (đợt import đóng) |
| Phân bổ / gắn chứng từ từ dòng KV | Có một phần (allocator) | Phần lớn |
| Công nợ khách canonical (`customer-debt` module) | Có; Customers/Finance đọc tổng từ đây | Phần lớn — rà doc cũ “không âm/không ứng trước” nếu lệch số đối soát |
| Live tạo phiếu thu/chi thủ công sâu / chuyển quỹ / đối soát cuối ngày đầy đủ | Một phần / hướng dài | Xem CASHBOOK |
| Import thêm file So quỹ KV | **Đóng** | — |

---

## 3. Hướng dài / chưa làm

> Owner 2026-07-21: nâng cấp sâu đóng băng cùng P4 chung — **trước khi code** cần chốt SoT nợ (âm đối soát vs “không trả trước”) trong mục dưới.

- Đối soát cuối ngày / chuyển quỹ sâu nếu chưa đủ
- **Chốt SoT debt trước khi code:** số âm trên báo cáo đối soát **được phép hiển thị** để đối chiếu lịch sử; rule nghiệp vụ “không trả trước / không âm vận hành” vẫn áp khi thu nợ live — không gộp hai nghĩa
- Báo cáo tài chính nâng cao
- Không xếp “import So quỹ KV nữa” vào queue

---

## Tham chiếu

- [Sales Checkout](../Sales/POS-CHECKOUT.md) · [Purchase](../Purchase/README.md) · [Inventory](../Inventory/README.md)

---

← [Quay về 03-BUSINESS README](../README.md)
