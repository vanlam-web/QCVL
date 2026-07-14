# Shared Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa các trang quản trị theo một khung chung, bắt đầu từ `Customers`, để các trang sau chỉ đổi dữ liệu/cột/field thay vì viết UI riêng.

**Architecture:** Giữ `management-layout.tsx` và CSS `management-*` làm nền. Thêm helper/component nhỏ theo đúng pattern hiện có: search toolbar, filter sidebar, table row selection, detail shell, detail action footer. Không tạo theme mới lớn, không sửa POS.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS hiện có trong `management-*`.

---

## Reality Update 2026-07-12: Filter Summary KPI

- Management KPI totals must represent the whole current filtered result set, not only the visible page.
- Applied to /sales-documents, /customers, /suppliers, /purchase/receipts, and /inventory/products.
- API list responses now may include summary; UI must prefer the response summary and only fall back to summing current page items when talking to an older response shape.
- Keep POS outside this shared management cleanup.

---

## Files

- Modify: `src/components/ui-shell/management-layout.tsx`
  - Nơi đặt component dùng chung nhỏ cho detail header/footer, empty text, action state nếu pattern đã lặp.
- Modify: `src/features/catalog/CustomersPage.tsx`
  - Trang đầu tiên áp dụng chuẩn chung.
  - Giữ dữ liệu riêng của khách hàng, giảm UI riêng bị lặp.
- Modify: `src/features/catalog/CustomersPage.test.tsx`
  - Test hành vi sau refactor: search, filter, mở chi tiết bằng row, detail note, action buttons.
- Modify: `src/features/catalog/types.ts`
  - Giữ field dữ liệu cần hiển thị, ví dụ `source_creator_name`.
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
  - Ghi chuẩn UI khách hàng sau khi áp dụng.
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
  - Ghi chuẩn detail panel và trạng thái nút.
- Modify: `docs/CURRENT-DATA-SOURCE.md`
  - Ghi rule dữ liệu import khách và creator mapping nếu chưa đủ.

## Scope

- Làm trước `Customers`.
- Không sửa `POS`.
- Không làm lại toàn bộ Hàng hóa/Kiểm kho, chỉ đọc làm mẫu.
- Không đổi API nếu không cần.
- Không tạo CSS page-specific mới, trừ khi thiếu class chung thật sự.
- Sau khi `Customers` ổn, mới nhân sang `Suppliers`, `PriceBook`, `Finance`, `SalesDocuments`, `Purchase`.

---

### Task 1: Lock Customer Creator And Import State

**Files:**
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`
- Modify: `server/dev-memory-repository.ts`
- Modify: `server/dev-memory-repository.test.ts`
- Modify: `server/http.ts`
- Modify: `docs/CURRENT-DATA-SOURCE.md`

- [ ] **Step 1: Keep regression tests for imported customer persistence**

Run:

```powershell
npx vitest run server/dev-memory-repository.test.ts -t "keeps imported customers"
```

Expected:

```text
1 passed
```

- [ ] **Step 2: Keep regression tests for unmatched creator UI**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx -t "unmatched creator"
```

Expected:

```text
1 passed
```

- [ ] **Step 3: Verify real imported customers are persisted**

Run:

```powershell
$json = Get-Content -LiteralPath 'logs/dev-memory-state.json' -Raw | ConvertFrom-Json
($json.customers | Measure-Object).Count
```

Expected after customer KV import:

```text
531
```

- [ ] **Step 4: Verify typecheck**

Run:

```powershell
npm run typecheck
```

Expected:

```text
tsc -b --pretty false
```

No TypeScript errors.

---

### Task 2: Extract Shared Detail Helpers From Customers

**Files:**
- Modify: `src/components/ui-shell/management-layout.tsx`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`

- [ ] **Step 1: Write failing test for customer detail action footer**

Add test to `src/features/catalog/CustomersPage.test.tsx`:

```tsx
it('renders customer detail actions through the shared management action footer', async () => {
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000123' })

  expect(within(detail).getByRole('button', { name: 'Xóa' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Ngừng hoạt động' })).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify current behavior before refactor**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx -t "shared management action footer"
```

Expected:

```text
PASS
```

This guards against breaking the current detail action UI during extraction.

- [ ] **Step 3: Extract only missing shared primitives**

In `src/components/ui-shell/management-layout.tsx`, add helpers only if existing primitives are not enough:

```tsx
export function ManagementDetailEmptyText({ children = 'Chưa có dữ liệu' }: { children?: ReactNode }) {
  return <span className="management-detail-empty">{children}</span>
}
```

If CSS class is not already styled, do not add new CSS yet. Use it as semantic wrapper only.

- [ ] **Step 4: Replace Customers inline fallback text where useful**

In `src/features/catalog/CustomersPage.tsx`, keep `customerCreatorLabel(customer)` because creator state is domain-specific. Use shared empty text only for generic fields if it reduces duplication.

- [ ] **Step 5: Run customer tests**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx
```

Expected:

```text
all tests pass
```

---

### Task 3: Normalize Customer Toolbar With Existing Compact Search

**Files:**
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`

- [ ] **Step 1: Write test for shared search behavior**

Keep or add test:

```tsx
it('filters customers by code, name, or phone without a suggestion dropdown', async () => {
  const service = makeService({
    listCustomers: vi.fn(async (input = {}) => ({
      items: input.search === 'KH000123' ? [baseCustomer] : [],
      page: 1,
      page_size: 15,
      total: input.search === 'KH000123' ? 1 : 0,
    })),
  })
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  const search = await screen.findByPlaceholderText('Tìm khách hàng')
  await userEvent.clear(search)
  await userEvent.type(search, 'KH000123')

  await waitFor(() => expect(service.listCustomers).toHaveBeenCalledWith(expect.objectContaining({ search: 'KH000123' })))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx -t "without a suggestion dropdown"
```

Expected:

```text
PASS
```

- [ ] **Step 3: Keep using `ManagementCompactSearch`**

Do not create a customer-specific search component. `CustomersPage.tsx` should keep:

```tsx
<ManagementCompactSearch
  label="Tìm khách hàng"
  placeholder="Tìm khách hàng"
  value={search}
  leadingIcon={<Search aria-hidden="true" size={18} />}
  trailingAction={<ManagementCompactCreateAction ariaLabel="Thêm khách hàng" onClick={() => setCreateOpen(true)} />}
  onChange={changeCustomerSearch}
/>
```

- [ ] **Step 4: Verify no suggestions remain**

Run:

```powershell
rg -n "management-search-suggestions|suggestionsLabel|onSuggestionSelect" src/features/catalog/CustomersPage.tsx
```

Expected:

```text
no matches
```

---

### Task 4: Normalize Customer Detail Layout Against Products And Stocktakes

**Files:**
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`

- [ ] **Step 1: Write test for row opens detail**

Use existing pattern:

```tsx
it('opens customer detail by clicking the row', async () => {
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} />)

  const row = await screen.findByRole('row', { name: /KH000123/ })
  await userEvent.click(row)

  expect(screen.getByRole('region', { name: 'Chi tiết khách hàng KH000123' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx -t "opens customer detail by clicking the row"
```

Expected:

```text
PASS
```

- [ ] **Step 3: Keep detail tabs domain-specific**

Customers keeps:

```tsx
type CustomerDetailTab = 'info' | 'debt' | 'history'
```

Do not replace with a generic tab engine yet. Current duplicated tab markup is acceptable until a second page needs the same shape.

- [ ] **Step 4: Update detail doc**

Add to `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`:

```markdown
## Shared Management Layout Rule

Customer detail follows the shared `management-*` layout used by Products and Inventory:

- row click opens detail
- detail uses shared tabs/actions styling
- disabled action buttons may stay visible for functions planned later
- generic empty values use `Chưa có dữ liệu`
- imported creator with raw KV value but no QCVL account match shows `Chưa khớp tài khoản`
```

---

### Task 5: Make Customers The Template For Later Pages

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
- Modify: `docs/superpowers/plans/2026-07-12-shared-management-ui.md`

- [ ] **Step 1: Document the page template**

Add to `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`:

```markdown
## Shared Page Template

Customers is the template for later management pages except POS:

- Use `ManagementPage`
- Use `ManagementCompactToolbar`
- Use `ManagementCompactSearch`
- Use `ManagementFilterSidebar`
- Use `ManagementTableViewport`
- Use `ManagementDataTable`
- Use row click for detail
- Keep page-specific code limited to columns, filters, detail fields, and API calls
- Do not reintroduce suggestion dropdown tables in search
```

- [ ] **Step 2: Add rollout order**

Append to this plan:

```markdown
## Rollout After Customers

1. Suppliers
2. PriceBook
3. SalesDocuments
4. Purchase
5. Finance

POS is excluded.
```

- [ ] **Step 3: Verify docs contain rule**

Run:

```powershell
rg -n "Shared Page Template|POS is excluded|Không sửa POS|Do not reintroduce suggestion" docs/02-PRD-UX-PhongCanh docs/superpowers/plans/2026-07-12-shared-management-ui.md
```

Expected:

```text
matches in customer docs and this plan
```

---

### Task 6: Full Verification

**Files:**
- Test only.

- [ ] **Step 1: Run focused customer tests**

Run:

```powershell
npx vitest run src/features/catalog/CustomersPage.test.tsx src/features/catalog/customer-presenter.test.ts
```

Expected:

```text
all tests pass
```

- [ ] **Step 2: Run server customer/import tests**

Run:

```powershell
npx vitest run server/dev-memory-repository.test.ts server/http.test.ts -t "customer|customers|dev-memory"
```

Expected:

```text
all selected tests pass
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 4: Browser check**

Open:

```text
http://127.0.0.1:3202/customers
```

Check:

- search works without suggestion dropdown
- row click opens detail
- `Người tạo` shows account name when mapped
- imported raw creator with no QCVL account match shows `Chưa khớp tài khoản`
- note/actions visible in detail

---

## Rollout After Customers

1. Suppliers
2. PriceBook
3. SalesDocuments
4. Purchase
5. Finance

POS is excluded.

## Current Scope 2026-07-12

Shared management UI is a foundation, not the main product goal right now.

Current main goal: finish `Hang hoa` by making operating stock correct.

Priority order now:

1. Keep shared UI already done for Customers, Products, Stocktake, Suppliers, PurchaseReceipts, PriceBook, SalesDocuments, Reports, Finance cashbook, and Admin.
2. Do not spend more time on broad UI cleanup unless a page blocks Customer, Supplier, Purchase, Sales/POS, Stocktake, or Product stock correctness.
3. Supplier/Purchase work should continue because purchase receipts are the official stock-in source.
4. Sales/POS stock-out and Stocktake adjustment come after the required customer/supplier foundations.
5. POS remains excluded from this shared management layout rollout.

## Rollout Status 2026-07-12

- [x] Customers: dùng shared compact search, filter sidebar, `ManagementDataTable`, row detail, shared detail tabs/info/note/action footer; select/date/range filter dùng helper chung.
- [x] Products: dùng `ManagementDataTable`; checkbox và sao ưu tiên đi qua helper chung `ManagementTableCheckboxControl` và `ManagementTableFavoriteButton`.
- [x] Stocktake: đã có checkbox, sao ưu tiên, sort cột, tìm kiếm chung, lọc người tạo đúng nguồn `created_by`, row click mở chi tiết; `+ Kiểm kho`, `Sao chép`, `Xuất file`, `In` là phần để sau/placeholder, không tính là chức năng vận hành MVP.
- [x] Suppliers: dùng `ManagementDataTable`, bỏ suggestion dropdown, giữ detail/payment theo nghiệp vụ Supplier.
- [x] PriceBook: dùng `ManagementDataTable`; cột riêng chỉ còn cấu hình column/cell, gồm cột giá động theo `priceLists` và công thức preview/apply.
- [x] SalesDocuments: dùng `ManagementDataTable`, giữ sort header, row detail, reopen quote/print quote và logic chống đóng detail khi click trong detail.
- [x] Sort cột danh sách: đã dùng chung `ManagementSortableHeader` + `useManagementTableSort` cho Customers, Products, Stocktake, Suppliers, PurchaseReceipts, PriceBook, SalesDocuments, Reports, Finance cashbook và Admin; POS loại trừ.
- [x] Shared field filter primitives: đã có `ManagementFilterSelectField`, `ManagementFilterNumberField`, `ManagementFilterNumberRange`; Customers đã áp dụng.
- [ ] Table chung toàn bộ trang: còn khác với sort chung. Một số trang đã có sort nhưng chưa chuyển hết sang `ManagementDataTable`/detail shell chung, nhất là Finance, Reports và Admin.
- [ ] Shared field filter rollout: Products/Purchase/Finance còn cần chuyển dần từ filter input riêng sang helper chung.
- [x] Purchase: đã chuyển danh sách phiếu nhập sang `ManagementDataTable`, giữ sort header, row click, detail shell và form nghiệp vụ nhập hàng.
- [ ] Finance: chưa chuyển sang layout/table chung.
- [ ] POS: loại trừ, không đồng bộ theo management layout.
