# Product, Inventory, Stocktake, POS Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất luồng Hàng hóa, Kiểm kho và Bán hàng theo hướng đã chốt: danh mục hàng hóa rõ, tồn kho truy vết được, khui vật tư không lẫn phiếu kiểm kho, POS bán thật dựa trên snapshot và stock movement đúng.

**Architecture:** Làm theo thứ tự phụ thuộc dữ liệu: Hàng hóa/nhóm/đơn vị quy đổi trước, kiểm kho hàng thường sau, rồi cuộn/tấm object-level + khui vật tư, cuối cùng mới nối POS trừ kho thật cho combo/cuộn/tấm. UI dùng layout quản lý hiện có, không tạo CSS riêng nếu style chung đáp ứng được.

**Tech Stack:** React, TypeScript, Vitest, Supabase Edge Functions, PostgreSQL migrations/RPC, existing `management-layout` UI primitives.

---

## Source Of Truth

- `docs/02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md`
- `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
- `docs/02-PRD-UX-PhongCanh/Inventory/03-ROLL-SHEET-OBJECTS.md`
- `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`
- `docs/02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md`
- `docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md`
- `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`

## Chốt Nghiệp Vụ

1. Toàn bộ hàng/dịch vụ `active` mặc định bán trực tiếp. Không hiện checkbox/tag `Bán trực tiếp`.
2. Danh sách hàng hóa không có cột/filter `Cách tính bán`; field này chỉ nằm trong chi tiết/modal/tab `Đơn vị & quy đổi`.
3. Không dùng ảnh, vị trí kho, mô tả dài, thương hiệu, trọng lượng, tồn nhỏ nhất/lớn nhất trong scope hiện tại. Tab `Ghi chú` đơn giản được giữ nếu không ảnh hưởng luồng chính.
4. Nhóm hàng phải làm thật để phục vụ import KiotViet và lọc; nếu chưa có nhóm thì dùng nhóm mặc định.
5. Nhiều đơn vị/quy đổi là nghiệp vụ lõi: mua cuộn/ram/bao nhưng bán m2/tờ/con.
6. Combo dùng thuật ngữ `Vật tư cấu thành`, không dùng `Hàng thành phần`.
7. Combo không trừ tồn mã combo; POS trừ vật tư cấu thành theo BOM snapshot tại thời điểm chốt chứng từ.
8. Vật tư phụ là `product_kind = auxiliary_material`; vật tư chính là các vật tư còn lại.
9. Vật tư phụ không bắt nhập định mức mới; định mức cũ từ import chỉ giữ tham khảo. Tự hiệu chỉnh định mức làm phase sau.
10. Sửa tồn hàng thường tạo phiếu kiểm kho tự động `balanced`.
11. Khui vật tư không tạo phiếu kiểm kho. Khui ghi `inventory_material_openings` + `stock_movements.material_opening`.
12. Cuộn/tấm object-level phải làm trước khi POS bán thật hàng cuộn/tấm.

## Phase Order

| Phase | Kết quả chạy được |
|---|---|
| 1 | Hàng hóa UI/API sạch, nhóm hàng, đơn vị quy đổi, combo/BOM, import KiotViet đủ trường lõi |
| 2 | Kiểm kho hàng thường: danh sách phiếu, chi tiết, tạo/cân bằng, sửa tồn tự sinh phiếu |
| 3 | Cuộn/tấm object-level và khui vật tư: object, tồn tạm KiotViet, movement/log, thẻ kho |
| 4 | POS bán thật: snapshot giá/đơn vị/BOM, trừ kho hàng thường/combo/cuộn/tấm, cảnh báo thiếu và khui nhanh |

---

### Task 1: Lock Docs And Tests Around Current Product UI

**Files:**
- Modify: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/01-INVENTORY-LAYOUT.md`
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`

- [x] **Step 1: Write/keep failing tests for product table columns**

Add expectations that the product list shows only:

```ts
expect(screen.getByRole('columnheader', { name: 'Mã hàng' })).toBeInTheDocument()
expect(screen.getByRole('columnheader', { name: 'Tên hàng' })).toBeInTheDocument()
expect(screen.getByRole('columnheader', { name: 'Giá vốn' })).toBeInTheDocument()
expect(screen.getByRole('columnheader', { name: 'Giá bán' })).toBeInTheDocument()
expect(screen.getByRole('columnheader', { name: 'Tồn kho' })).toBeInTheDocument()
expect(screen.queryByRole('columnheader', { name: 'Cách tính bán' })).not.toBeInTheDocument()
expect(screen.queryByRole('columnheader', { name: 'Thời gian tạo' })).not.toBeInTheDocument()
expect(screen.queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
```

- [x] **Step 2: Run catalog tests**

Run:

```bash
npx vitest run src/features/catalog/CatalogPage.test.tsx --exclude '.worktrees/**'
```

Expected: PASS after current product UI direction is preserved.

- [x] **Step 3: Fix UI drift only if tests fail**

Use existing `management-layout` classes and existing catalog styles. Do not add a new CSS file. Remove any visible product image/direct-sale/status-created-time/sell-method list UI that reappears. Do not remove the simple `Ghi chú` detail tab.

- [x] **Step 4: Verify**

Run:

```bash
npx vitest run src/features/catalog/CatalogPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
git diff --check
```

Expected: all pass.

---

### Task 2: Product Groups And Default General Group

**Files:**
- Create migration: `supabase/migrations/202607070901_product_groups.sql`
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `supabase/functions/api/routes/catalog.ts`
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Test: `supabase/tests/functions/catalog_test.ts`
- Test: `src/features/catalog/CatalogPage.test.tsx`

- [x] **Step 1: Write backend tests**

Add tests proving:

```ts
Deno.test("catalog product groups include default general group", async () => {
  const groups = await api.get("/api/v1/catalog/product-groups")
  assertEquals(groups.items.some((group) => group.name === "Giá chung" && group.is_default === true), true)
})

Deno.test("catalog product without group uses default general group", async () => {
  const product = await api.post("/api/v1/catalog/products", { code: "TEST-GROUP", name: "Hàng test nhóm" })
  assertEquals(product.product_group.name, "Giá chung")
})

Deno.test("catalog product list filters by group", async () => {
  const group = await api.post("/api/v1/catalog/product-groups", { name: "Nhóm test lọc" })
  await api.post("/api/v1/catalog/products", { code: "TEST-GROUP-FILTER", name: "Hàng theo nhóm", product_group_id: group.id })
  const result = await api.get(`/api/v1/catalog/products?product_group_id=${group.id}`)
  assertEquals(result.items.every((item) => item.product_group.id === group.id), true)
})
```

- [x] **Step 2: Add schema**

Add `product_groups` with `organization_id`, `code`, `name`, `is_default`, `is_active`. Add nullable `products.product_group_id`. Seed/create default `Giá chung` per organization.

- [x] **Step 3: Add API**

Add:

```text
GET /api/v1/catalog/product-groups
POST /api/v1/catalog/product-groups
```

List products must hydrate `product_group`.

- [x] **Step 4: Add UI**

Add group filter in sidebar and group field in create/edit modal. If no group selected, send no group and backend resolves default `Giá chung`.

- [x] **Step 5: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/catalog_test.ts
npx vitest run src/features/catalog/CatalogPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 3: Multi-Unit Conversion

**Files:**
- Create migration: `supabase/migrations/202607070902_product_unit_conversions_complete.sql`
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Test: `supabase/tests/functions/catalog_test.ts`
- Test: `src/features/catalog/CatalogPage.test.tsx`

- [x] **Step 1: Write tests for KV-style units**

Cover examples from `DanhSachSanPham_KV07072026-121648-951.xlsx`:

```text
Ram -> base unit with conversion 100
m tới -> base unit with conversion 0.5
Tấc -> base unit with conversion 0.042
```

- [x] **Step 2: Complete API contract**

Product detail must return:

```ts
unit_conversions: Array<{
  unit_id: string
  unit_name: string
  stock_qty_per_unit: number
  is_default_purchase_unit: boolean
  is_default_sale_unit: boolean
}>
```

- [x] **Step 3: Add UI tab**

Implement tab `Đơn vị & quy đổi`: base unit, sale/purchase units, conversion factor. Keep `Cách tính bán` here, not in list table.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/catalog_test.ts
npx vitest run src/features/catalog/CatalogPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 4: Combo BOM / Vật Tư Cấu Thành

**Files:**
- Create/modify migration for BOM tables if missing
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `supabase/functions/api/routes/catalog.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Test: `supabase/tests/functions/catalog_test.ts`
- Test: `src/features/catalog/CatalogPage.test.tsx`

- [x] **Step 1: Write tests**

Cover:

```text
Combo product has product_kind/sell_method combo.
Combo detail returns BOM lines as "Vật tư cấu thành".
BOM line role derives from component product_kind, not manual main/sub flag.
```

- [x] **Step 2: Add/complete BOM API**

Add:

```text
GET /api/v1/products/{id}/bom
POST /api/v1/products/{id}/bom
PUT /api/v1/products/{id}/bom
```

Store BOM version/snapshot-ready data. Do not trừ kho here.

- [x] **Step 3: Add UI**

Show combo summary in `Thông tin`; edit source in tab `BOM/Vật tư cấu thành`. Columns: mã vật tư, tên vật tư, số lượng/định mức, đơn vị, giá vốn tạm, trạng thái dòng. Because this task includes the BOM endpoint, BOM UI must read/write real data after this task is complete.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/catalog_test.ts
npx vitest run src/features/catalog/CatalogPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 5: Stocktake List And Detail For Normal Goods

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/use-cases/inventory.ts`
- Modify: `supabase/functions/api/routes/inventory.ts`
- Modify: `src/features/inventory/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Test: `supabase/tests/functions/inventory_finance_test.ts`
- Test: `src/features/inventory/InventoryPage.test.tsx`

- [x] **Step 1: Write API tests for list aggregates**

Expected list fields:

```ts
{
  code: 'KK000333',
  status: 'balanced',
  created_at: '...',
  balanced_at: '...',
  total_actual_qty: 10,
  total_actual_value: 100000,
  total_difference_value: -5000,
  increased_qty: 2,
  decreased_qty: 3,
  note: 'Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa...'
}
```

- [x] **Step 2: Implement list aggregates**

Hydrate from `stocktake_items` and product cost fields. If value cannot be calculated because cost missing, return `null` and UI shows `Chưa có`.

- [x] **Step 3: Add routes**

Open routes promised by docs:

```text
GET /api/v1/inventory/stocktakes/{id}
POST /api/v1/inventory/stocktakes
PUT /api/v1/inventory/stocktakes/{id}
POST /api/v1/inventory/stocktakes/{id}/balance
POST /api/v1/inventory/stocktakes/{id}/cancel
```

Phase 1 can support `normal` goods only; reject roll/sheet with clear validation until Task 7.

Current implementation opens promised manual stocktake mutation routes and returns clear `VALIDATION_ERROR` instead of fake success; manual create/update/balance/cancel body handling comes after list/detail foundation.

- [x] **Step 4: Add UI**

Create KiotViet-style view under module `Hàng hóa`: filter sidebar, title `Phiếu kiểm kho`, buttons `+ Kiểm kho`, `Xuất file`, list table and pagination.

- [x] **Step 5: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts
npx vitest run src/features/inventory/InventoryPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 6: Product Stock Edit Creates Auto Stocktake Link

**Files:**
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/inventory/inventory-service.ts`
- Test: `src/features/catalog/CatalogPage.test.tsx`
- Test: `supabase/tests/functions/inventory_finance_test.ts`

- [x] **Step 1: Write UI test**

When editing stock for `normal` product, after save:

```ts
expect(await screen.findByText(/Đã tạo phiếu kiểm kho/)).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Xem phiếu/ })).toBeInTheDocument()
```

- [x] **Step 2: Use existing endpoint**

Call:

```text
POST /api/v1/inventory/products/{product_id}/adjust-stock
```

Do not allow roll/sheet total stock edit in product modal.

- [x] **Step 3: Verify**

Run:

```bash
npx vitest run src/features/catalog/CatalogPage.test.tsx src/features/inventory/InventoryPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 7: Roll/Sheet Object-Level Inventory

**Files:**
- Modify/create migrations for `inventory_rolls`, `inventory_sheets`, `inventory_provisional_balances` if cloud schema differs from docs
- Modify: `supabase/functions/api/use-cases/inventory.ts`
- Modify: `supabase/functions/api/routes/inventory.ts`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Test: `supabase/tests/functions/inventory_finance_test.ts`
- Test: `src/features/inventory/InventoryPage.test.tsx`

- [x] **Step 1: Write backend tests**

Cover:

```text
Roll list returns width, initial length, remaining length, status.
Sheet list returns width, length, area, status.
Editing roll/sheet remaining quantity requires reason and creates stock movement.
Total stock edit rejects roll/sheet.
```

- [x] **Step 2: Add API**

Add:

```text
GET /api/v1/inventory/rolls
POST /api/v1/inventory/rolls
PATCH /api/v1/inventory/rolls/{id}
GET /api/v1/inventory/sheets
POST /api/v1/inventory/sheets
PATCH /api/v1/inventory/sheets/{id}
```

- [x] **Step 3: Add UI**

Add `Tồn theo cuộn/tấm` view and product detail tab object list. Show provisional KiotViet stock separately from standardized objects.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts
npx vitest run src/features/inventory/InventoryPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 8: Material Opening / Khui Vật Tư

**Files:**
- Modify: `supabase/functions/api/use-cases/inventory.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/inventory/InventoryPage.tsx`
- Test: `supabase/tests/functions/inventory_test.ts`
- Test: `src/features/pos/PosShell.test.tsx`
- Test: `src/features/inventory/InventoryPage.test.tsx`

- [x] **Step 1: Write tests for no stocktake**

Assert khui creates `inventory_material_openings` and `stock_movements.material_opening`, but does not create `stocktakes`.

**Status 2026-07-07:** đã bổ sung database test trong `supabase/tests/database/015_material_opening_normal.test.sql`: RPC `open_normal_material_tx` tạo `inventory_material_openings`, tạo stock movement khi cần, và không tạo `stocktakes`.

- [x] **Step 2: Implement old part to zero**

For normal auxiliary material with old remaining quantity:

```text
movement A: old remaining delta negative to bring old part to 0
movement B: opened unit converted into stock unit, delta positive
```

For roll/sheet, update old object to `0`/discarded or keep it if user enters remaining > 0.

- [x] **Step 3: Add UI**

Topbar/manual khui and POS quick khui reuse one modal. If opened from POS shortage, prefill material.

**Status 2026-07-07:** POS quick khui đã có modal theo dòng thiếu vật tư `normal`; POS topbar đã có modal thủ công cho `normal`; module Kho có modal thủ công cho `normal`, `roll`, `sheet`. Roll/sheet đang nhập ID object cũ thủ công vì options API chưa trả danh sách object để chọn dropdown.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/inventory_test.ts
npx vitest run src/features/pos/PosShell.test.tsx src/features/inventory/InventoryPage.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

---

### Task 9: POS Snapshot And Stock Deduction

**Files:**
- Modify: `supabase/functions/api/use-cases/orders.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `src/features/pos/PosShell.tsx`
- Test: `supabase/tests/functions/orders_test.ts`
- Test: `src/features/pos/PosShell.test.tsx`

- [x] **Step 1: Write tests**

Cover:

```text
Normal product checkout stores unit/price snapshot and creates sale_deduction.
Combo checkout stores BOM snapshot and deducts component stock, not combo stock.
Roll/sheet checkout requires object deduction or explicit accepted fallback.
Old invoices keep old snapshot after product/BOM price changes.
```

**Status 2026-07-07:** đã bổ sung DB test cho normal checkout và combo checkout: product snapshot, BOM snapshot, component `sale_deduction`, không trừ tồn mã combo. Roll/sheet object deduction chưa có UI/payload POS nên vẫn pending ở Step 3.

- [x] **Step 2: Implement snapshot fields**

Ensure order items store enough snapshot data: product name/code, unit, conversion factor, price source, BOM version/components for combo.

**Status 2026-07-07:** order item snapshot đang lưu `id`, `code`, `name`, `unit_name`, `sell_method`, `unit_price`, `price_source`; combo lưu thêm `order_item_bom_snapshots` gồm BOM id/version và component snapshot. Conversion factor theo đơn vị bán tùy chỉnh vẫn là follow-up vì POS chưa gửi `unit_id`/conversion cụ thể.

- [ ] **Step 3: Implement deduction**

Use `stock_movements.sale_deduction` for all official stock changes. Do not write raw stock numbers directly.

**Status 2026-07-07:** normal checkout ghi `stock_movements.sale_deduction`; combo checkout trừ vật tư cấu thành theo BOM snapshot và không trừ mã combo. Roll/sheet checkout object-level deduction chưa hoàn tất; trước khi bật bán thật cuộn/tấm cần POS gửi object được chọn hoặc backend từ chối rõ nếu thiếu object.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions -- supabase/tests/functions/orders_test.ts
npx vitest run src/features/pos/PosShell.test.tsx --exclude '.worktrees/**'
npm run typecheck
npm run lint
```

**Status 2026-07-07:** dry-run trên `/Users/vanlam/Downloads/DanhSachSanPham_KV07072026-121648-951.xlsx` pass, đọc được `657` dòng, `646` dòng hợp lệ, `11` dòng thiếu `ĐVT`, `35` nhóm hàng, `140` quy đổi. `npm run typecheck`, `npm run lint` pass.

---

### Task 10: Import KiotViet Product Excel

**Files:**
- Create: `scripts/import-kiotviet-products.ts` or `scripts/import-kiotviet-products.mjs`
- Modify: package script if needed
- Test: script fixture under `scripts/__fixtures__` or unit test if project has pattern
- Docs: `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`

- [x] **Step 1: Map columns**

Map at minimum:

```text
Mã hàng, Tên hàng, Loại hàng, Nhóm hàng, ĐVT, Mã ĐVT Cơ bản, Quy đổi, Giá vốn, Giá bán, Tồn kho, Hàng thành phần
```

Convert `Hàng thành phần` to `Vật tư cấu thành`.

- [x] **Step 2: Dry-run mode**

Script must support:

```bash
npm run import:kiotviet-products -- --file /Users/vanlam/Downloads/DanhSachSanPham_KV07072026-121648-951.xlsx --dry-run
```

Expected: prints counts for normal/combo/service, unit conversions, BOM rows, invalid rows.

- [x] **Step 3: Import mode**

Import groups, products and unit conversions through current public API. Dry-run reports prices, provisional inventory balances and BOM rows so Owner can review; BOM/provisional bulk write remains follow-up until public API supports those write endpoints. Do not invent roll/sheet objects from aggregate stock.

- [ ] **Step 4: Verify**

Run:

```bash
npm run import:kiotviet-products -- --file /Users/vanlam/Downloads/DanhSachSanPham_KV07072026-121648-951.xlsx --dry-run
npm run typecheck
npm run lint
```

---

## Final Verification

After the last implementation phase:

```bash
npm test
npm run test:functions
npm run typecheck
npm run lint
npm run build
git diff --check
```

Manual browser smoke:

1. `/products`: product table columns match docs; no image/direct-sale/status-created-time/sell-method list column.
2. `/products`: create normal/service/combo; combo shows `Vật tư cấu thành`.
3. Inventory stocktake view: list/filter/detail `Phiếu kiểm kho`; normal stock edit creates linked auto stocktake.
4. Roll/sheet view: object list and provisional stock visible separately.
5. POS: normal product checkout deducts stock; combo checkout deducts components; khui material records movement but no stocktake.

## Risk Notes

- Do not import KiotViet Excel into production until dry-run counts and invalid rows are reviewed.
- Do not enable real POS checkout for roll/sheet before object-level deduction is implemented or an explicit fallback rule is accepted.
- Do not use `stocktakes` for khui vật tư; use `inventory_material_openings`.
- If backend cannot return a field yet, UI may show `Chưa có` only with matching doc note and no fake data.
