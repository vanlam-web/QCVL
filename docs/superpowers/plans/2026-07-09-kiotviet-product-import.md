# KiotViet Product Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable KiotViet Excel import flow for the Hàng hóa page that can preview and safely import the same KV product export many times without creating duplicates or silently deleting real data.

**Architecture:** Extract the existing CLI mapper into a shared parser so CLI, server tests, and UI import use one mapping contract. Add a server preview/import endpoint that validates rows, optionally clears only demo products, and upserts product groups/products by organization + product code. Add a shared top-right import action to the Catalog toolbar and a modal that uploads `.xlsx`, shows a preview summary, and only writes after confirmation.

**Tech Stack:** React 19, TypeScript, Vite, Node HTTP server, PostgreSQL repository, Vitest, existing QCVL API envelope/error handling, existing `ManagementCompactToolbar` and shared CSS.

---

## Current Product Completion Roadmap 2026-07-11

Final objective: finish the `Hang hoa` module as usable real data, not only finish the Excel import button. Work that appears outside `/products` still belongs to this objective when it is required for product correctness.

Current path:

1. Product import and product list foundation: done.
   - Re-import KiotViet product files safely.
   - Store product master data, price, source created time, unit conversion, provisional stock, and draft BOM.
   - Default `/products` list and filters use real imported fields.

2. Stocktake import: done as a supporting dependency.
   - Reason: product stock could not be trusted without KV stocktake evidence.
   - Current rule: KV stocktake import is history/evidence only, not operating stock.
   - Linked plan: `docs/superpowers/plans/2026-07-10-kiotviet-stocktake-import.md`.

3. User management / creator data: in progress as a supporting dependency.
   - Reason: KV inventory and stocktake screens use `Nguoi tao`; QCVL must have real users before creator filters and imports can be accurate.
   - Current rule: create QCVL users first where possible, then import/map creator fields.
   - If a KV creator does not match a QCVL user, store a source snapshot instead of forcing a wrong `users.id`.
   - Recent foundation: `/admin` user creation now persists real users; required-field validation was added before saving.

4. Next product-module work after user foundation:
   - Add creator snapshot/mapping for KiotViet stocktake import.
   - Add `Nguoi tao` filter to `/inventory` only after imported creator data exists.
   - Return to `/products` stock display: show provisional KV stock clearly, and prepare a separate operating-stock path.
   - Do not start `Du kien het hang` until stock movement history is reliable.

Scope guard:

- The goal is still `Hoan thien Hang hoa`.
- `Kiem kho`, `Nguoi tao`, and user management are side dependencies because product stock, product history, and product filters need them.
- Do not expand into unrelated admin/settings work unless it blocks product completion.

---

## Current Status 2026-07-10

This plan is no longer the active task checklist. The implementation was completed, deployed to NAS, and merged through commit `38b8c9d`, with the later read-performance fix merged through commit `5efc3a6`.

Use this file as the product import design record only. Do not treat the older unchecked task boxes below as active work unless Owner explicitly reopens product import implementation.

Accepted current behavior:

- KiotViet product import can be run repeatedly by `Ma hang` upsert.
- Product import writes real catalog fields, source `created_at`, default sale price, provisional stock, and draft BOM.
- Product import does not create official stock movements.
- Product import delete/reset is a separate explicit action, not an import checkbox.
- `3202` and `3200` promotion must go through migrations and `npm run deploy:nas`.

Still deferred:

- `Nha cung cap`: derive from purchase/import receipt history, because one product can have many suppliers.
- `Du kien het hang`: compute after enough sales/purchase/stock history exists; do not copy KiotViet text.
- Official operating stock conversion: requires explicit review/balance flow from provisional stock/history into stock movements.
- Draft BOM activation: requires human review before POS uses BOM.

---

## Scope Locked For Current Import Phase

Import from `DanhSachSanPham_KV09072026-215404-812.xlsx` and later KV files with the same columns.

**Columns written now:**

| KV column | QCVL field/action |
|---|---|
| `Loại hàng` | `product_kind`, with combo override when `Hàng thành phần` exists |
| `Nhóm hàng(3 Cấp)` | `product_groups.name`; keep full path text such as `Alu>>Vật tư` |
| `Mã hàng` | product unique key within organization |
| `Tên hàng` | `products.name` |
| `Giá vốn` | `products.latest_purchase_cost` |
| `ĐVT` | `products.unit_name` |
| `Mã ĐVT Cơ bản` + `Quy đổi` | `unit_conversions` payload when different from `ĐVT` and factor > 0 |
| `Đang kinh doanh` | `status = active` when `1`, otherwise `inactive` |
| `Giá bán` | `price_list_items` of default active price list; not written to `products` |
| `Tồn kho` | `inventory_provisional_balances` with `source_type = kiotviet_import`; not written to `stock_movements` |
| `Hàng thành phần` | draft BOM in `product_boms`/`product_bom_items`; never auto-active |
| `Thời gian tạo` | `products.created_at`; accepts KiotViet Excel serial date or `dd/MM/yyyy HH:mm`; repeated import updates old wrong import-time timestamps to the KiotViet source time |

**Columns deferred by decision:**

| KV column | Reason |
|---|---|
| `Dự kiến hết hàng` | Must be computed from real stock + purchase/sales usage history, not copied from KV text |

**Columns ignored by decision:**

`Thương hiệu`, `KH đặt`, `Tồn nhỏ nhất`, `Tồn lớn nhất`, `Hình ảnh (url1,url2...)`, `Trọng lượng`, `Được bán trực tiếp`, `Mô tả`, `Mẫu ghi chú`, `Vị trí`.

**Deletion rule:** The UI may offer `Xóa dữ liệu mẫu trước khi import`, but the server only deletes known demo products that have no real linked documents. Phase 1 demo patterns are `DEV20-SP-%`, `MICA-3MM`, `DECAL-PP`, and `CUT-CNC`. The server must refuse deletion for any matched product that appears in sales documents, purchase receipts, stock movements, BOM, price list items, or other real linked tables.

**Out of scope for this plan:** NAS deploy, Git push, supplier relationship import, expected-out-of-stock calculation, activating BOM, and converting KiotViet total stock into real roll/sheet stock movements.

---

## Open Gaps After Current Phase

1. `Dự kiến hết hàng`: chưa làm. Phải có lịch sử bán/tiêu thụ thật và tồn kho chuẩn hóa trước, sau đó mới tính tốc độ dùng hàng. Không copy chuỗi dự kiến từ KiotViet.
2. `Nhà cung cấp`: chưa làm ở import Hàng hóa. Nguồn đúng là phiếu nhập, vì một mã hàng có thể có nhiều nhà cung cấp.
3. Tồn tạm KiotViet: đã lưu vào `inventory_provisional_balances`, nhưng chưa chuyển thành tồn kho thật/stock movements. Bước sau cần màn đối soát và quy trình khui cuộn/tấm nếu muốn dùng làm tồn vận hành.
4. BOM nháp: đã lưu draft BOM, nhưng chưa có quy trình duyệt/kích hoạt. POS chỉ được dùng BOM sau khi người dùng rà định mức và active.
5. Import nhiều file KV mới: upsert theo `Mã hàng` đã sẵn sàng. Khi KV đổi dữ liệu, import lại file mới để cập nhật; hệ thống không tự xóa mã vắng trong file mới.

## Reality Update 2026-07-10: Product Source Created Time

KiotViet product exports can store `Thời gian tạo` as an Excel serial number, for example `46204.42164644676`, not as visible text. QCVL must normalize this value on the server before writing products.

Rules:

- `Thời gian tạo` is the source product creation time from KiotViet and is stored in `products.created_at`.
- `GET /api/v1/products?created_from=...&created_to=...` filters against this normalized `products.created_at`.
- Importing again by the same `Mã hàng` may update `products.created_at` when the file contains a valid source time. This is intentional so old rows imported with `now()` can be corrected without deleting all data first.
- If the source time is missing or invalid, keep existing `products.created_at`; for a brand-new product fallback to import time.
- Do not create a separate UI-only date field for this. The filter, service, backend repository, and import mapper all use the same `created_at` contract.

---

## Reality Update 2026-07-10: Stocktake Import Moved To Inventory Plan

Owner provided KiotViet stocktake detail export `DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx`.

Observed relationship:

- Product export `Tồn kho` is the current KiotViet stock snapshot and remains the source for `inventory_provisional_balances`.
- Stocktake detail export is historical audit data. It explains past adjustments but does not equal current stock after later sales/purchases/stocktakes.
- Formula is stable: `SL lệch = Kiểm thực tế - Tồn kho`.
- Latest stocktake actual quantity must not overwrite product provisional stock. Example: `HDA5` product export stock is `60 Cuốn`, but latest stocktake actual is `0 Cuốn`.

Decision:

- Do not add stocktake history into the Product Import plan.
- Implement KiotViet stocktake import under Inventory/Kiểm kho.
- New implementation plan: `docs/superpowers/plans/2026-07-10-kiotviet-stocktake-import.md`.
- Official QCVL stock still requires explicit review/balance flow after imported history is available.

---
## File Structure

**Create**

- `src/features/catalog/kiotviet-product-import.ts`
  - Shared TypeScript parser/mapper for KV headers and rows.
  - Exports `parseKiotVietProductWorkbook`, `mapKiotVietProductRows`, `buildKiotVietProductImportSummary`.
  - Browser-safe: accepts `ArrayBuffer`, does not use Node `unzip`.

- `src/features/catalog/kiotviet-product-import.test.ts`
  - Unit tests for header normalization, row mapping, invalid rows, repeated import keys, ignored columns.

- `server/modules/catalog/product-import.ts`
  - Server-side import validation and repository orchestration.
  - Exports `previewKiotVietProductImport` and `applyKiotVietProductImport`.

- `server/modules/catalog/product-import.test.ts`
  - Tests import preview/apply behavior with fake repository.

- `src/features/catalog/ProductImportDialog.tsx`
  - Dialog UI for selecting a file, previewing summary, optional demo cleanup, and importing.

- `src/features/catalog/ProductImportDialog.test.tsx`
  - Tests modal behavior, preview summary, import confirmation, and error states.

**Modify**

- `src/features/catalog/CatalogPage.tsx`
  - Add right-side `Import` action in the highlighted toolbar area.
  - Open `ProductImportDialog`.
  - Reload product list after successful import.

- `src/features/catalog/CatalogPage.test.tsx`
  - Assert import action location/behavior and that list reloads after import success.

- `src/features/catalog/catalog-service.ts`
  - Add `previewKiotVietProductImport(file)` and `importKiotVietProducts(input)`.

- `src/features/catalog/types.ts`
  - Add import request/response types.

- `src/components/ui-shell/management-layout.tsx`
  - Add a shared toolbar trailing slot if current toolbar cannot place fixed right actions cleanly.

- `src/styles/shared.css`
  - Add minimal shared toolbar action CSS only if existing classes cannot align the import button.

- `server/modules/catalog/catalog-routes.ts`
  - Add `POST /api/v1/products/import/kiotviet/preview`.
  - Add `POST /api/v1/products/import/kiotviet`.

- `server/http.ts`
  - Wire handlers and fake in-memory behavior for tests/dev without DB repository support.

- `server/db.ts`
  - Add repository methods for upserting product groups/products and safe demo cleanup.

- `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
  - Add import UX and multi-import rules.

- `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`
  - Document import endpoints and response schema.

- `docs/04-DATABASE/Sales/POS-TABLES.md`
  - Document upsert key and demo cleanup guard.

---

### Task 1: Shared KiotViet Product Parser

**Files:**
- Create: `src/features/catalog/kiotviet-product-import.ts`
- Create: `src/features/catalog/kiotviet-product-import.test.ts`

- [ ] **Step 1: Write failing tests for row mapping**

Create `src/features/catalog/kiotviet-product-import.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapKiotVietProductRows } from './kiotviet-product-import'

describe('mapKiotVietProductRows', () => {
  it('maps KV product columns into QCVL import rows and ignores removed fields', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 2,
        'Loại hàng': 'Hàng hóa',
        'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
        'Mã hàng': 'A10T',
        'Tên hàng': 'Alu 3li 0.1 Trắng',
        'Thương hiệu': 'Acores',
        'Giá bán': 0,
        'Giá vốn': 200000,
        'Tồn kho': 4,
        'Tồn nhỏ nhất': 0,
        'Tồn lớn nhất': 999999999,
        'ĐVT': 'Tấm',
        'Mã ĐVT Cơ bản': null,
        'Quy đổi': 1,
        'Đang kinh doanh': 1,
        'Được bán trực tiếp': 1,
        'Vị trí': null,
      },
    ])

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(0)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      code: 'A10T',
      name: 'Alu 3li 0.1 Trắng',
      product_group_name: 'Alu>>Vật tư',
      product_kind: 'goods',
      inventory_shape: 'normal',
      sell_method: 'quantity',
      unit_name: 'Tấm',
      latest_purchase_cost: 200000,
      status: 'active',
      ignored: {
        brand: 'Acores',
        min_stock: 0,
        max_stock: 999999999,
        direct_sale: 1,
        location: null,
      },
    })
  })

  it('marks missing code, name, or unit as invalid', () => {
    const result = mapKiotVietProductRows([
      { rowNumber: 3, 'Mã hàng': '', 'Tên hàng': 'Thiếu mã', 'ĐVT': 'Cái' },
      { rowNumber: 4, 'Mã hàng': 'NO-NAME', 'Tên hàng': '', 'ĐVT': 'Cái' },
      { rowNumber: 5, 'Mã hàng': 'NO-UNIT', 'Tên hàng': 'Thiếu đơn vị', 'ĐVT': '' },
    ])

    expect(result.valid).toHaveLength(0)
    expect(result.invalid.map((item) => item.rowNumber)).toEqual([3, 4, 5])
    expect(result.invalid[0].errors).toContain('missing_code')
    expect(result.invalid[1].errors).toContain('missing_name')
    expect(result.invalid[2].errors).toContain('missing_unit')
  })

  it('maps combo rows from Hàng thành phần and keeps BOM for later phases', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 8,
        'Loại hàng': 'Combo - đóng gói',
        'Nhóm hàng(3 Cấp)': 'Thành phẩm',
        'Mã hàng': 'HH',
        'Tên hàng': 'Hộp hoa',
        'ĐVT': 'Cái',
        'Hàng thành phần': 'DCS:0.6|F5:0.3',
        'Đang kinh doanh': 1,
      },
    ])

    expect(result.valid[0]).toMatchObject({
      product_kind: 'combo',
      inventory_shape: 'normal',
      sell_method: 'combo',
      track_inventory: false,
      bom_text: 'DCS:0.6|F5:0.3',
    })
  })
})
```

- [ ] **Step 2: Run parser tests and confirm RED**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts
```

Expected: fail because `src/features/catalog/kiotviet-product-import.ts` does not exist.

- [ ] **Step 3: Implement mapper**

Create `src/features/catalog/kiotviet-product-import.ts` with:

```ts
import type { Product, ProductKind, ProductStatus, SellMethod } from './types'

export interface KiotVietRawProductRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietImportProductRow {
  rowNumber: number
  code: string
  name: string
  product_group_name: string
  product_kind: ProductKind
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
  unit_name: string
  latest_purchase_cost: number | null
  status: ProductStatus
  unit_conversions: Array<{
    unit_name: string
    stock_qty_per_unit: number
    is_default_purchase_unit: boolean
    is_default_sale_unit: boolean
  }>
  sale_price: number | null
  provisional_stock: number | null
  bom_text: string | null
  source_created_at: string | null
  ignored: {
    brand: unknown
    min_stock: unknown
    max_stock: unknown
    direct_sale: unknown
    location: unknown
  }
}

export interface KiotVietInvalidProductRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: Array<'missing_code' | 'missing_name' | 'missing_unit'>
}

export function mapKiotVietProductRows(rows: KiotVietRawProductRow[]) {
  const valid: KiotVietImportProductRow[] = []
  const invalid: KiotVietInvalidProductRow[] = []

  for (const row of rows) {
    const code = text(valueByHeader(row, 'Mã hàng', 'Mã sản phẩm', 'SKU'))
    const name = text(valueByHeader(row, 'Tên hàng', 'Tên sản phẩm'))
    const unitName = text(valueByHeader(row, 'ĐVT', 'Đơn vị tính', 'Mã ĐVT Cơ bản'))
    const errors: KiotVietInvalidProductRow['errors'] = []
    if (!code) errors.push('missing_code')
    if (!name) errors.push('missing_name')
    if (!unitName) errors.push('missing_unit')
    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, code, name, errors })
      continue
    }

    const bomText = text(valueByHeader(row, 'Hàng thành phần', 'Vật tư cấu thành'))
    const productKind = mapProductKind(text(valueByHeader(row, 'Loại hàng')), bomText)
    const shapeAndMethod = shapeAndMethodForKind(productKind)
    const conversionUnitName = text(valueByHeader(row, 'Mã ĐVT Cơ bản', 'Đơn vị quy đổi'))
    const conversionFactor = number(valueByHeader(row, 'Quy đổi'))

    valid.push({
      rowNumber: row.rowNumber,
      code,
      name,
      product_group_name: text(valueByPrefix(row, 'Nhóm hàng')) ?? 'Giá chung',
      product_kind: productKind,
      inventory_shape: shapeAndMethod.inventory_shape,
      sell_method: shapeAndMethod.sell_method,
      track_inventory: shapeAndMethod.track_inventory,
      unit_name: unitName,
      latest_purchase_cost: number(valueByHeader(row, 'Giá vốn')),
      status: number(valueByHeader(row, 'Đang kinh doanh')) === 0 ? 'inactive' : 'active',
      unit_conversions:
        conversionUnitName && conversionUnitName !== unitName && conversionFactor !== null && conversionFactor > 0
          ? [{ unit_name: conversionUnitName, stock_qty_per_unit: conversionFactor, is_default_purchase_unit: true, is_default_sale_unit: false }]
          : [],
      sale_price: number(valueByHeader(row, 'Giá bán')),
      provisional_stock: number(valueByHeader(row, 'Tồn kho')),
      bom_text: bomText,
      source_created_at: text(valueByHeader(row, 'Thời gian tạo')),
      ignored: {
        brand: valueByHeader(row, 'Thương hiệu'),
        min_stock: valueByHeader(row, 'Tồn nhỏ nhất'),
        max_stock: valueByHeader(row, 'Tồn lớn nhất'),
        direct_sale: valueByHeader(row, 'Được bán trực tiếp'),
        location: valueByHeader(row, 'Vị trí'),
      },
    })
  }

  return { valid, invalid }
}

function mapProductKind(value: string | null, bomText: string | null): ProductKind {
  const normalized = normalizeHeader(value)
  if (bomText) return 'combo'
  if (normalized.includes('dich vu')) return 'service'
  if (normalized.includes('combo')) return 'combo'
  if (normalized.includes('vat tu phu')) return 'auxiliary_material'
  if (normalized.includes('cuon')) return 'roll'
  if (normalized.includes('tam')) return 'sheet'
  return 'goods'
}

function shapeAndMethodForKind(productKind: ProductKind): {
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
} {
  if (productKind === 'service') return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: false }
  if (productKind === 'roll') return { inventory_shape: 'roll', sell_method: 'linear_m', track_inventory: true }
  if (productKind === 'sheet') return { inventory_shape: 'sheet', sell_method: 'sheet', track_inventory: true }
  if (productKind === 'combo') return { inventory_shape: 'normal', sell_method: 'combo', track_inventory: false }
  return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true }
}

function valueByHeader(row: KiotVietRawProductRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  return undefined
}

function valueByPrefix(row: KiotVietRawProductRow, prefix: string) {
  const key = Object.keys(row).find((candidate) => candidate === prefix || candidate.startsWith(`${prefix}(`))
  return key ? row[key] : undefined
}

export function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

function text(value: unknown) {
  const result = String(value ?? '').trim()
  return result.length > 0 ? result : null
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(result) ? result : null
}
```

- [ ] **Step 4: Run parser tests and confirm GREEN**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit parser**

```powershell
git add src/features/catalog/kiotviet-product-import.ts src/features/catalog/kiotviet-product-import.test.ts
git commit -m "feat: map kiotviet product import rows"
```

---

### Task 2: Server Preview And Import Contracts

**Files:**
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `server/modules/catalog/catalog-routes.ts`
- Create: `server/modules/catalog/product-import.ts`
- Create: `server/modules/catalog/product-import.test.ts`
- Modify: `server/http.ts`

- [ ] **Step 1: Add failing server tests for preview and import**

Create `server/modules/catalog/product-import.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { applyKiotVietProductImport, previewKiotVietProductImport } from './product-import'

const rows = [
  {
    rowNumber: 2,
    code: 'A10T',
    name: 'Alu 3li 0.1 Trắng',
    product_group_name: 'Alu>>Vật tư',
    product_kind: 'goods' as const,
    inventory_shape: 'normal' as const,
    sell_method: 'quantity' as const,
    track_inventory: true,
    unit_name: 'Tấm',
    latest_purchase_cost: 200000,
    status: 'active' as const,
    unit_conversions: [],
    sale_price: 0,
    provisional_stock: 4,
    bom_text: null,
    source_created_at: null,
    ignored: { brand: null, min_stock: 0, max_stock: 999999999, direct_sale: 1, location: null },
  },
]

describe('product import server flow', () => {
  it('previews create/update counts without writing', async () => {
    const repository = {
      findProductsByCodes: vi.fn(async () => new Set(['A10T'])),
    }

    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(repository.findProductsByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['A10T'] })
    expect(result.summary).toMatchObject({ total_rows: 1, valid_rows: 1, invalid_rows: 0, create_rows: 0, update_rows: 1 })
  })

  it('applies import by upserting groups and products by code', async () => {
    const repository = {
      deleteDemoProductsForImport: vi.fn(),
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: true,
    })

    expect(repository.deleteDemoProductsForImport).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(repository.upsertProductGroupsByName).toHaveBeenCalledWith({ organizationId: 'org-1', names: ['Alu>>Vật tư'] })
    expect(repository.upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({
          code: 'A10T',
          product_group_id: 'group-1',
          latest_purchase_cost: 200000,
        }),
      ],
    })
    expect(result.summary).toMatchObject({ created_rows: 1, updated_rows: 0 })
  })
})
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
npm test -- server/modules/catalog/product-import.test.ts
```

Expected: fail because `product-import.ts` does not exist.

- [ ] **Step 3: Implement server import orchestration**

Create `server/modules/catalog/product-import.ts`:

```ts
import type { ProductStatus } from '../../../src/features/catalog/types'
import type { KiotVietImportProductRow, KiotVietInvalidProductRow } from '../../../src/features/catalog/kiotviet-product-import'

export interface ProductImportRepository {
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
}

export interface ProductImportUpsertRow {
  code: string
  name: string
  status: ProductStatus
  product_kind: KiotVietImportProductRow['product_kind']
  inventory_shape: KiotVietImportProductRow['inventory_shape']
  sell_method: KiotVietImportProductRow['sell_method']
  track_inventory: boolean
  unit_name: string
  product_group_id: string
  latest_purchase_cost: number | null
  unit_conversions: KiotVietImportProductRow['unit_conversions']
}

export async function previewKiotVietProductImport(input: {
  organizationId: string
  repository: ProductImportRepository
  rows: KiotVietImportProductRow[]
  invalidRows: KiotVietInvalidProductRow[]
  cleanupDemo: boolean
}) {
  const codes = input.rows.map((row) => row.code)
  const existingCodes = await input.repository.findProductsByCodes?.({ organizationId: input.organizationId, codes }) ?? new Set<string>()
  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      create_rows: input.rows.filter((row) => !existingCodes.has(row.code)).length,
      update_rows: input.rows.filter((row) => existingCodes.has(row.code)).length,
      cleanup_demo_requested: input.cleanupDemo,
      ignored_columns: ['Thương hiệu', 'KH đặt', 'Tồn nhỏ nhất', 'Tồn lớn nhất', 'Hình ảnh', 'Trọng lượng', 'Được bán trực tiếp', 'Mô tả', 'Mẫu ghi chú', 'Vị trí'],
      deferred_columns: ['Dự kiến hết hàng'],
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietProductImport(input: {
  organizationId: string
  repository: ProductImportRepository
  rows: KiotVietImportProductRow[]
  invalidRows: KiotVietInvalidProductRow[]
  cleanupDemo: boolean
}) {
  if (input.invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
        invalid_rows: input.invalidRows.length,
        created_rows: 0,
        updated_rows: 0,
        skipped_rows: input.rows.length,
        cleanup_deleted_rows: 0,
        cleanup_blocked_rows: 0,
      },
      invalid_rows: input.invalidRows,
    }
  }

  const cleanup = input.cleanupDemo
    ? await input.repository.deleteDemoProductsForImport?.({ organizationId: input.organizationId }) ?? { deleted: 0, blocked: 0 }
    : { deleted: 0, blocked: 0 }
  const groupNames = [...new Set(input.rows.map((row) => row.product_group_name))]
  const groups = await input.repository.upsertProductGroupsByName?.({ organizationId: input.organizationId, names: groupNames }) ?? new Map<string, string>()
  const rows = input.rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    product_kind: row.product_kind,
    inventory_shape: row.inventory_shape,
    sell_method: row.sell_method,
    track_inventory: row.track_inventory,
    unit_name: row.unit_name,
    latest_purchase_cost: row.latest_purchase_cost,
    product_group_id: groups.get(row.product_group_name) ?? groups.get('Giá chung') ?? '',
    unit_conversions: row.unit_conversions,
  }))
  const upsert = await input.repository.upsertProductsByCode?.({ organizationId: input.organizationId, rows }) ?? {
    created: 0,
    updated: 0,
    skipped: rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.created,
      updated_rows: upsert.updated,
      skipped_rows: upsert.skipped,
      cleanup_deleted_rows: cleanup.deleted,
      cleanup_blocked_rows: cleanup.blocked,
    },
    invalid_rows: [],
  }
}
```

- [ ] **Step 4: Wire routes**

Modify `server/modules/catalog/catalog-routes.ts`:

```ts
export interface CatalogRouteHandlers {
  productGroups(): RouteResult
  listProducts(): RouteResult
  previewKiotVietProductImport(): RouteResult
  importKiotVietProducts(): RouteResult
  getProductBom(): RouteResult
  createProduct(): RouteResult
  updateProduct(): RouteResult
  upsertProductBom(): RouteResult
  customerGroups(): RouteResult
  listCustomers(): RouteResult
  createCustomer(): RouteResult
  customerRecentPrices(): RouteResult
  resolvePricing(): RouteResult
  priceLists(): RouteResult
  previewPriceFormula(): RouteResult
  applyPriceFormula(): RouteResult
}
```

Add before product detail routes:

```ts
if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet/preview') return handlers.previewKiotVietProductImport()
if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet') return handlers.importKiotVietProducts()
```

- [ ] **Step 5: Run server tests**

Run:

```powershell
npm test -- server/modules/catalog/product-import.test.ts server/http.test.ts
```

Expected: pass after handlers are wired in `server/http.ts`.

- [ ] **Step 6: Commit server import contract**

```powershell
git add server/modules/catalog/catalog-routes.ts server/modules/catalog/product-import.ts server/modules/catalog/product-import.test.ts server/http.ts src/features/catalog/types.ts src/features/catalog/catalog-service.ts
git commit -m "feat: add kiotviet product import API contract"
```

---

### Task 3: PostgreSQL Upsert And Safe Demo Cleanup

**Files:**
- Modify: `server/http.ts`
- Modify: `server/db.ts`
- Modify: `server/http.test.ts`

- [ ] **Step 1: Add failing HTTP tests**

Add to `server/http.test.ts`:

```ts
test('previews KiotViet product import without writing products', async () => {
  const repository = makeRepository()
  const handler = createHttpHandler({ repository })
  const response = await handler(
    new Request('http://api.local/api/v1/products/import/kiotviet/preview', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        cleanup_demo: false,
        rows: [
          {
            rowNumber: 2,
            'Loại hàng': 'Hàng hóa',
            'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
            'Mã hàng': 'A10T',
            'Tên hàng': 'Alu 3li 0.1 Trắng',
            'Giá vốn': 200000,
            'ĐVT': 'Tấm',
            'Đang kinh doanh': 1,
          },
        ],
      }),
    }),
  )
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.data.summary).toMatchObject({ valid_rows: 1, invalid_rows: 0 })
})

test('imports KiotViet products by upserting product codes', async () => {
  const upsertProductsByCode = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
  const repository = makeRepository({
    upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'pg-alu']])),
    upsertProductsByCode,
  })
  const handler = createHttpHandler({ repository })
  const response = await handler(
    new Request('http://api.local/api/v1/products/import/kiotviet', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        cleanup_demo: true,
        rows: [
          {
            rowNumber: 2,
            'Loại hàng': 'Hàng hóa',
            'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
            'Mã hàng': 'A10T',
            'Tên hàng': 'Alu 3li 0.1 Trắng',
            'Giá vốn': 200000,
            'ĐVT': 'Tấm',
            'Đang kinh doanh': 1,
          },
        ],
      }),
    }),
  )
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.data.summary).toMatchObject({ created_rows: 1, updated_rows: 0 })
  expect(upsertProductsByCode).toHaveBeenCalledWith({
    organizationId: 'org-1',
    rows: [expect.objectContaining({ code: 'A10T', product_group_id: 'pg-alu' })],
  })
})
```

- [ ] **Step 2: Run HTTP tests and confirm RED**

Run:

```powershell
npm test -- server/http.test.ts
```

Expected: fail because handlers/repository methods are not wired yet.

- [ ] **Step 3: Implement fake handler and repository interface**

Modify `ServerRepository` in `server/http.ts`:

```ts
findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
```

Wire catalog handlers in `server/http.ts` by reading JSON:

```ts
previewKiotVietProductImport: async () => {
  const body = await readJson(request)
  const mapped = mapKiotVietProductRows(body.rows ?? [])
  return {
    found: true,
    data: await previewKiotVietProductImport({
      organizationId: currentUser.organization.id,
      repository,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      cleanupDemo: Boolean(body.cleanup_demo),
    }),
  }
},
importKiotVietProducts: async () => {
  const body = await readJson(request)
  const mapped = mapKiotVietProductRows(body.rows ?? [])
  return {
    found: true,
    data: await applyKiotVietProductImport({
      organizationId: currentUser.organization.id,
      repository,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      cleanupDemo: Boolean(body.cleanup_demo),
    }),
  }
},
```

- [ ] **Step 4: Implement PostgreSQL methods**

In `server/db.ts`, add methods:

```ts
async findProductsByCodes(input) {
  const result = await pool.query(
    `
      select code
      from products
      where organization_id = $1
        and code = any($2::text[])
    `,
    [input.organizationId, input.codes],
  )
  return new Set(result.rows.map((row) => row.code))
},
```

Add `upsertProductGroupsByName`, `upsertProductsByCode`, and `deleteDemoProductsForImport` with a transaction. `upsertProductsByCode` must use:

```sql
insert into products (
  id, organization_id, code, name, status, product_group_id, unit_name,
  sell_method, product_kind, inventory_shape, track_inventory,
  latest_purchase_cost, latest_purchase_cost_at, updated_at
)
values (...)
on conflict (organization_id, code)
do update set
  name = excluded.name,
  status = excluded.status,
  product_group_id = excluded.product_group_id,
  unit_name = excluded.unit_name,
  sell_method = excluded.sell_method,
  product_kind = excluded.product_kind,
  inventory_shape = excluded.inventory_shape,
  track_inventory = excluded.track_inventory,
  latest_purchase_cost = excluded.latest_purchase_cost,
  latest_purchase_cost_at = case
    when excluded.latest_purchase_cost is distinct from products.latest_purchase_cost then now()
    else products.latest_purchase_cost_at
  end,
  updated_at = now()
```

`deleteDemoProductsForImport` must delete only product rows matching known demo codes and not referenced by `order_items`, `price_list_items`, `stock_movements`, product BOM tables, or purchase receipt items. If a reference table does not exist in the current DB, catch the missing-table error only for that guard query and continue with other guards.

- [ ] **Step 5: Run tests and typecheck**

Run:

```powershell
npm test -- server/http.test.ts server/modules/catalog/product-import.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit repository upsert**

```powershell
git add server/http.ts server/db.ts server/http.test.ts
git commit -m "feat: upsert products from kiotviet import"
```

---

### Task 4: Product Import Dialog UI

**Files:**
- Create: `src/features/catalog/ProductImportDialog.tsx`
- Create: `src/features/catalog/ProductImportDialog.test.tsx`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/CatalogPage.tsx`
- Modify: `src/features/catalog/CatalogPage.test.tsx`
- Modify: `src/components/ui-shell/management-layout.tsx`
- Modify: `src/styles/shared.css`

- [ ] **Step 1: Add failing dialog tests**

Create `src/features/catalog/ProductImportDialog.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductImportDialog } from './ProductImportDialog'

it('previews a KiotViet product file before importing', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 657,
        valid_rows: 657,
        invalid_rows: 0,
        create_rows: 640,
        update_rows: 17,
        cleanup_demo_requested: false,
        ignored_columns: ['Thương hiệu', 'Vị trí'],
        deferred_columns: ['Dự kiến hết hàng'],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(),
  }

  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={vi.fn()} />)
  const file = new File(['fake-xlsx'], 'DanhSachSanPham_KV09072026-215404-812.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(service.previewKiotVietProductImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(await screen.findByText('657 dòng hợp lệ')).toBeInTheDocument()
  expect(screen.getByText('640 tạo mới')).toBeInTheDocument()
  expect(screen.getByText('17 cập nhật')).toBeInTheDocument()
  expect(screen.getByText('Bỏ qua: Thương hiệu, Vị trí')).toBeInTheDocument()
})

it('requires preview before import and supports demo cleanup option', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: { total_rows: 1, valid_rows: 1, invalid_rows: 0, create_rows: 1, update_rows: 0, cleanup_demo_requested: true, ignored_columns: [], deferred_columns: [] },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, cleanup_deleted_rows: 3, cleanup_blocked_rows: 0 },
      invalid_rows: [],
    })),
  }
  const onImported = vi.fn()
  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)
  const file = new File(['fake-xlsx'], 'products.xlsx')

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByLabelText('Xóa dữ liệu mẫu trước khi import lần đầu'))
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Import' }))

  expect(service.importKiotVietProducts).toHaveBeenCalledWith({ file, cleanup_demo: true })
  expect(onImported).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run dialog tests and confirm RED**

Run:

```powershell
npm test -- src/features/catalog/ProductImportDialog.test.tsx
```

Expected: fail because component does not exist.

- [ ] **Step 3: Add service methods**

Modify `src/features/catalog/catalog-service.ts`:

```ts
previewKiotVietProductImport: (input: { file: File; cleanup_demo: boolean }) =>
  api.request<KiotVietProductImportPreview>('/api/v1/products/import/kiotviet/preview', {
    method: 'POST',
    body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows: [] }),
  }),
importKiotVietProducts: (input: { file: File; cleanup_demo: boolean }) =>
  api.request<KiotVietProductImportResult>('/api/v1/products/import/kiotviet', {
    method: 'POST',
    body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows: [] }),
  }),
```

Replace `rows: []` after Step 4 adds browser workbook parsing. Keep the method shape now so tests can mock it.

- [ ] **Step 4: Implement dialog**

Create `ProductImportDialog.tsx` with file input, preview button, checkbox, summary, import button, and errors. Use existing `.dialog-*`, `.button`, `.management-detail-summary-box`, and `.management-filter-choice` classes where possible.

The dialog must not auto-import on file select. It must require:

1. Select `.xlsx`.
2. Click `Xem trước`.
3. Review summary.
4. Click `Import`.

- [ ] **Step 5: Wire CatalogPage action**

In `CatalogPage.tsx`:

```tsx
const [productImportOpen, setProductImportOpen] = useState(false)
```

Add action in toolbar right area:

```tsx
<button className="button button-secondary" type="button" onClick={() => setProductImportOpen(true)}>
  Import
</button>
```

Render:

```tsx
<ProductImportDialog
  open={productImportOpen}
  service={service}
  onClose={() => setProductImportOpen(false)}
  onImported={() => {
    setProductImportOpen(false)
    void load({ page: 1 })
  }}
/>
```

- [ ] **Step 6: Run UI tests**

Run:

```powershell
npm test -- src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit UI dialog**

```powershell
git add src/features/catalog/ProductImportDialog.tsx src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.tsx src/features/catalog/CatalogPage.test.tsx src/features/catalog/catalog-service.ts src/features/catalog/types.ts src/components/ui-shell/management-layout.tsx src/styles/shared.css
git commit -m "feat: add product import dialog"
```

---

### Task 5: Browser-Safe Workbook Parsing

**Files:**
- Modify: `src/features/catalog/kiotviet-product-import.ts`
- Modify: `src/features/catalog/kiotviet-product-import.test.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/ProductImportDialog.tsx`

- [ ] **Step 1: Add failing test for workbook parsing**

Add to `kiotviet-product-import.test.ts`:

```ts
it('parses an xlsx ArrayBuffer into raw rows with row numbers', async () => {
  const workbook = await buildMinimalWorkbook([
    ['Mã hàng', 'Tên hàng', 'ĐVT'],
    ['A10T', 'Alu 3li 0.1 Trắng', 'Tấm'],
  ])

  const rows = await parseKiotVietProductWorkbook(workbook)

  expect(rows).toEqual([
    { rowNumber: 2, 'Mã hàng': 'A10T', 'Tên hàng': 'Alu 3li 0.1 Trắng', 'ĐVT': 'Tấm' },
  ])
})
```

Use a tiny zipped XLSX fixture builder in the test through `CompressionStream` if available in jsdom; if not available, store a minimal base64 xlsx fixture string inside the test file and decode it to `ArrayBuffer`.

- [ ] **Step 2: Implement browser parser**

Implement `parseKiotVietProductWorkbook(fileBuffer: ArrayBuffer)` using browser `DecompressionStream` when available or use a small internal ZIP reader for stored/deflated entries. If this becomes too large, use the existing CLI parser only as a reference and add a very small dependency only after explicit review. Preferred path: write a tiny ZIP XML reader focused on KV `.xlsx`.

- [ ] **Step 3: Replace service row payload**

In `catalog-service.ts`, parse file before sending:

```ts
const rows = await parseKiotVietProductWorkbook(await input.file.arrayBuffer())
return api.request<KiotVietProductImportPreview>('/api/v1/products/import/kiotviet/preview', {
  method: 'POST',
  body: JSON.stringify({ cleanup_demo: input.cleanup_demo, rows }),
})
```

Do the same for import.

- [ ] **Step 4: Run parser/service tests**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/ProductImportDialog.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit workbook parser**

```powershell
git add src/features/catalog/kiotviet-product-import.ts src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/catalog-service.ts src/features/catalog/ProductImportDialog.tsx
git commit -m "feat: parse kiotviet workbook in browser"
```

---

### Task 6: Documentation And QA

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md`
- Modify: `docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md`
- Modify: `docs/04-DATABASE/Sales/POS-TABLES.md`

- [ ] **Step 1: Update docs**

Add a section to product UX docs:

```md
## Import KiotViet nhiều lần

Import Hàng hóa dùng file Excel export từ KiotViet. Luồng chuẩn:

1. Chọn file `.xlsx`.
2. Xem trước.
3. Nếu là lần import thật đầu tiên, có thể chọn `Xóa dữ liệu mẫu trước khi import`.
4. Bấm `Import`.

Import dùng `Mã hàng` làm khóa upsert trong cùng organization. Lần import sau cập nhật lại tên, nhóm, loại, đơn vị, trạng thái và giá vốn. Không tự xóa hàng không còn trong file.

Phase hiện tại đã ghi `Giá bán`, `Tồn kho` tạm và `Hàng thành phần` BOM nháp. Chỉ còn `Dự kiến hết hàng` làm sau bằng luồng có truy vết riêng.
```

- [ ] **Step 2: Full verification**

Run:

```powershell
npm test -- src/features/catalog/kiotviet-product-import.test.ts src/features/catalog/ProductImportDialog.test.tsx src/features/catalog/CatalogPage.test.tsx server/modules/catalog/product-import.test.ts server/http.test.ts
npm run typecheck
npm run lint
npm run build:nas
```

Expected: all pass.

- [ ] **Step 3: Browser QA on dev**

Open:

```text
http://127.0.0.1:3202/products
```

Verify:

- Import button is on the right side of the toolbar area marked by the user.
- Clicking Import opens dialog.
- Selecting `DanhSachSanPham_KV09072026-215404-812.xlsx` enables `Xem trước`.
- Preview shows total rows, valid/invalid rows, create/update counts, ignored columns, deferred columns.
- Import button is disabled when invalid rows exist.
- After import success, product list reloads.
- Console has no relevant app error.

- [ ] **Step 4: Commit docs and QA fixes**

```powershell
git add docs/02-PRD-UX-PhongCanh/Inventory/02-PRODUCT-STOCK-LIST.md docs/05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md docs/04-DATABASE/Sales/POS-TABLES.md
git commit -m "docs: document kiotviet product import"
```

---

## Self-Review

**Spec coverage:** This plan covers fixed toolbar position, repeat import by upsert, selected KV columns, ignored columns, demo cleanup guard, preview before write, docs, tests, and browser QA. It explicitly excludes NAS deploy, price import, stock import, BOM import, supplier import, and expected-out-of-stock until later phases.

**Placeholder scan:** No step relies on "TBD" or "handle later" for Phase 1. Deferred phases are listed as out of scope with explicit non-writing behavior.

**Type consistency:** The import row fields match the existing `ProductKind`, `SellMethod`, `ProductStatus`, and `inventory_shape` type names. Server orchestration uses the same import row names as the frontend mapper.

---

## Execution Choice

Plan complete. Recommended execution is subagent-driven because parser, server upsert, and UI dialog can be reviewed task by task. Inline execution is also possible if the user wants fewer context switches.

