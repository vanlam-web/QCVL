# PROJECT-COORDINATION — Board Điều Phối

> **Vai trò:** Board cho việc đang mở giữa các luồng Spec / Implement / Review.
> **Cập nhật:** 2026-07-07.

File này chỉ dùng khi có item đang cần nhiều luồng phối hợp. Nếu không có item đang mở, xem queue sống ở [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) và issue review ở [REVIEW-ISSUES.md](./REVIEW-ISSUES.md).

---

## Mục Đích

Board này giúp Owner không phải tự chuyển lời giữa các luồng.

Mỗi việc đang mở phải trả lời được:

- mục tiêu nghiệp vụ là gì
- luồng nào đang giữ việc
- luồng nào nhận bước tiếp theo
- branch / PR / commit liên quan
- có cần Owner quyết định hay không

---

## Mẫu Item

```text
Việc:
- ID:
- Mục tiêu nghiệp vụ:
- Luồng đang giữ: Spec / Implement / Review / Owner
- Luồng nhận tiếp: Spec / Implement / Review / Owner
- Tình trạng: Drafting / Implementing / Waiting Spec / Waiting Review / Must Fix / Ready to Merge / Merged / Blocked / Deferred
- Branch / PR / commit:
- Source of Truth:
- Báo cáo gần nhất:
- Bước tiếp theo:
- Cần Owner quyết định: Có / Không
- Rủi ro:
```

Không xem là đã handoff nếu thiếu `Luồng đang giữ`, `Luồng nhận tiếp`, hoặc `Bước tiếp theo`.

---

## Board Đang Mở

Việc:
- ID: `COORD-2026-07-07-PRODUCT-INVENTORY-POS`
- Mục tiêu nghiệp vụ: Hoàn tất luồng Hàng hóa, Kiểm kho và POS theo thứ tự đã chốt: Hàng hóa → Kiểm kho hàng thường → Cuộn/tấm/khui object-level → POS trừ kho thật.
- Luồng đang giữ: Spec
- Luồng nhận tiếp: Implement
- Tình trạng: Implementing
- Branch / PR / commit: branch `codex/products-inventory-pos-completion`; chưa mở PR riêng cho plan này.
- Source of Truth:
  - [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md)
  - [2026-07-07-products-inventory-pos-completion.md](./superpowers/plans/2026-07-07-products-inventory-pos-completion.md)
  - [Inventory layout](./02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md)
  - [Stocktake](./02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md)
  - [Khui vật tư](./02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)
- Báo cáo gần nhất: Task 8 gần xong nhưng chưa tick toàn bộ vì còn thiếu integration/database test chứng minh RPC khui không tạo `stocktakes`. Đã thêm migration `202607070904_material_opening_movements.sql` để `stock_movements` có `material_opening_id`; normal khui ghi movement âm đưa phần cũ về `0` và movement dương cho lượng khui mới; roll/sheet backend cập nhật object cũ theo phần còn lại/bỏ; module Kho có modal `Khui vật tư` cho `normal`, `roll`, `sheet`; POS quick khui vẫn prefill từ dòng thiếu vật tư; POS topbar đã mở modal khui thủ công cho `normal`. Verification pass: `npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts`, `npx vitest run src/features/inventory/InventoryPage.test.tsx src/features/inventory/inventory-service.test.ts src/features/pos/PosShell.test.tsx --exclude '.worktrees/**'`, `npm run typecheck`, `npm run lint`, `git diff --check`.
- Bước tiếp theo: Viết test DB/RPC no-stocktake cho Task 8 Step 1 nếu test harness hiện tại cho phép; nếu không, ghi rõ limitation và chuyển Task 9 POS snapshot/deduction.
- Cần Owner quyết định: Không ở bước hiện tại. Chưa deploy cloud theo quyết định gom batch.
- Rủi ro: Kho/stock movement/POS là vùng dữ liệu lâu dài; mọi slice schema/API/stock movement cần Spec gate và verification trước merge.

---

## Mẫu Báo Cáo Giữa Luồng

```text
Tình trạng:
- ...

Luồng đang giữ:
- Spec / Implement / Review / Owner

Luồng nhận tiếp:
- Spec / Implement / Review / Owner

Bước tiếp theo:
- ...

Cần Owner quyết định:
- Có / Không
```

Nếu cần Owner quyết định, chỉ hỏi một câu nghiệp vụ ngắn và kèm đề xuất mặc định.

---

## Khi Nào Xoá Khỏi Board

Một item rời board khi:

- đã merge và đã report lại đúng luồng
- đã defer có lý do và trigger quay lại
- bị block bởi quyết định Owner và đã báo rõ
- được thay bằng item mới có link/reference
