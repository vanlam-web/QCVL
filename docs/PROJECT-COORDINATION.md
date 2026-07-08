# PROJECT-COORDINATION — Board Điều Phối

> **Vai trò:** Board cho việc đang mở giữa các luồng Spec / Implement / Review.
> **Cập nhật:** 2026-07-08.

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
- Luồng đang giữ: Implement
- Luồng nhận tiếp: Implement
- Tình trạng: Implementing
- Branch / PR / commit: current `main`; historical branch `codex/products-inventory-pos-completion` không có trong checkout hiện tại.
- Source of Truth:
  - [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md)
  - [2026-07-07-products-inventory-pos-completion.md](./superpowers/plans/2026-07-07-products-inventory-pos-completion.md)
  - [Inventory layout](./02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md)
  - [Stocktake](./02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md)
  - [Khui vật tư](./02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)
- Báo cáo gần nhất: Task 8 đã tick đủ trong plan: DB test `supabase/tests/database/015_material_opening_normal.test.sql` chứng minh `open_normal_material_tx` tạo `inventory_material_openings`, ghi `stock_movements.material_opening_id` khi cần và không tạo `stocktakes`; function/UI test đã phủ normal, roll, sheet material opening. Task 9 đã xong normal checkout `sale_deduction` và combo BOM component deduction. Owner chốt ngày 2026-07-08 rằng roll/sheet POS không chặn checkout khi chưa biết object vật lý hoặc tồn âm; dòng chưa gán object phải được lưu để đối soát sau sản xuất. Review cũng ghi drift `REV-2026-07-08-001`: frontend/docs có `/api/v1/pos/cart/validate` nhưng Supabase router chưa route endpoint này.
- Bước tiếp theo: Implement Task 9 Step 3 theo hướng bán trước, đối soát vật tư sau: checkout roll/sheet không chặn thiếu object/tồn âm, ghi trạng thái hoặc warning cần đối soát, và xử lý `REV-2026-07-08-001`.
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
