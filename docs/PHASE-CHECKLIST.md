# QC-OMS Phase Checklist

> **Vai trò:** Checklist sống cho trạng thái hiện tại, queue tiếp theo và handoff giữa các luồng Codex.
> **Cập nhật:** 2026-07-08.

File này chỉ giữ tình trạng hiện tại và tóm tắt các mốc đã merge. Log triển khai chi tiết nằm trong git history và các plan lịch sử ở [superpowers/plans](./superpowers/plans/).

Quy trình phối hợp:

- [WORKFLOW-SPEC-IMPLEMENT.md](./WORKFLOW-SPEC-IMPLEMENT.md)
- [WORKFLOW-AUTO-SPEC-IMPLEMENT.md](./WORKFLOW-AUTO-SPEC-IMPLEMENT.md)
- [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md)
- [REVIEW-ISSUES.md](./REVIEW-ISSUES.md)

---

## Hiện tại

| Mục | Tình trạng |
|---|---|
| Branch chính | `main` |
| Backend dev/staging | Supabase Cloud |
| Local Supabase | Chỉ dùng khi cần isolated DB/test |
| Active coordination board | Có item `COORD-2026-07-07-PRODUCT-INVENTORY-POS` đang mở trong [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md) |
| Review issue còn mở | Có `REV-2026-07-08-001` trong [REVIEW-ISSUES.md](./REVIEW-ISSUES.md) |
| Docs cleanup | Đã chuẩn hoá index/metadata; checklist này là nguồn xem trạng thái sống |
| Current product/inventory/POS direction | Đang hoàn tất Hàng hóa → Kiểm kho hàng thường → Cuộn/tấm/khui object-level → POS bán trước và đối soát vật tư sau; normal/combo checkout đã có `sale_deduction`, roll/sheet POS cần trạng thái/warning đối soát khi chưa gán object |

---

## Đã Merge Vào `main`

| Mốc | PR / commit | Ghi chú |
|---|---|---|
| Phase 0 — Foundation | history trước PR #1 | Auth/profile/workstation/permission, API core, POS shell nền |
| Phase 1A — Catalog/Pricing | PR #1, `b503e98` | Product catalog, price list, pricing resolve |
| Phase 1B — Customer/Pricing | PR #2 | Customer/customer group, chọn khách trong POS, giá theo nhóm khách |
| Phase 1C — Checkout/Inventory/Finance foundation | PR #4, `2b83df7` | Checkout transaction, order/items, stock movement, payment/debt/cashbook |
| Phase 2A — POS direct checkout UI | PR #5, `cf82542` | Cart editable, payment fields, customer debt, receipt summary |
| Phase 2B — Production queue foundation | PR #6, `80b521e` | K02-D queue, claim/add-to-draft/dismiss/restore |
| Phase 2C — Line discount | PR #7, `1d7a6f5` | Discount UI/backend persistence |
| Phase 2D — Sales Documents readonly | PR #8, `552db05` | List/detail hóa đơn `HD...` |
| Phase 3A — Quote/reopen | PR #15, `f6df941` | Lưu báo giá `BG...`, mở lại vào POS draft |
| PriceBook zero-price correction | PR #16, `75ebc89` | Không fallback sai khi giá bằng `0` |
| PriceBook formula MVP | PR #17, `c72ab46` | Structured formula, preview/apply, rounding |
| POS checkout data integrity | PR #18, `5544421` | Củng cố dữ liệu checkout |
| Sales Documents dimensions detail | PR #19, `e34bc61` | Chi tiết kích thước/m2/mét tới |
| PriceBook UI refinement | PR #20, `3374312` | Grid-first UI, cột Chi phí/Lợi nhuận |
| Docs/spec sync | PR #21, `b8c1af7` | Đồng bộ SoT và bridge docs |
| Quote print Phase 3B | PR #22, `2c5e067` | In/xem báo giá đơn giản |
| Sales Documents payment history | Commit `ec23e1b` | Nối tab lịch sử thanh toán từ `payment_receipts`, fallback dữ liệu thiếu để không sập detail |
| Purchase P1 — Supplier foundation | PR #23, `ad19559` | Danh sách/chi tiết NCC, linked customer |
| Purchase P2 — Receipt draft/list/detail | PR #24, `0239061` | Phiếu nhập draft/list/detail cho hàng thường |
| Purchase P3 — Post normal receipt | PR #26, `2c87a6e` | Hoàn thành phiếu nhập hàng thường, tăng tồn/công nợ/cashbook |
| Purchase P5 — Supplier payments | PR #30 | Chi tiền/thanh toán NCC sau phiếu nhập |

---

## Queue Có Thể Mở Tiếp

Chỉ mở khi Owner chọn và Spec xác nhận Source of Truth còn đúng với hiện trạng code.

| Việc | Mức sẵn sàng | Ghi chú |
|---|---|---|
| Purchase P4 — nhập cuộn/tấm vật lý | Trung bình | Cần khớp với model kho cuộn/tấm hiện tại trước khi implement |
| Product/Inventory/POS completion | Đang mở | Theo dõi ở `COORD-2026-07-07-PRODUCT-INVENTORY-POS`; phần còn lại chính là POS roll/sheet pending material reconciliation và drift `/pos/cart/validate` |
| PriceBook product groups/filter | Trung bình | Cần schema/UI filter nhóm hàng nếu Owner cần |
| Sales Documents edit/cancel/reversal | Cần chốt thêm | Chạm kho/tiền/công nợ, phải có spec đảo nghiệp vụ |
| Production reconciliation mở rộng | Cần review hiện trạng | Chỉ làm khi đã xác nhận phần read-only hiện tại và dữ liệu máy sản xuất |
| Realtime module updates | Trung bình | Chỉ mở cho module có lợi rõ như production queue hoặc stock/user lock |

---

## Chưa Nên Mở Nếu Chưa Chốt Thêm

- Sửa/hủy hóa đơn có đảo kho/tiền/công nợ.
- Purchase return/trả hàng nhập.
- Máy sản xuất tự động trừ kho hoặc tự match file với bill.
- HĐĐT/VAT, delivery/COD, kênh online.
- Loyalty/campaign, HR/payroll/timesheet/commission.
- Công thức PriceBook kiểu Excel/free-form.

---

## Lệnh Thường Dùng

```bash
cd /Users/vanlam/Documents/project/QC-OMS

git switch main
git status --short --branch

npm ci
npm run dev

npm test
npm run typecheck
npm run lint
npm run build

# Optional local isolated Supabase
npm run supabase:start
npm run supabase:reset
npm run test:db
npm run test:functions
```
