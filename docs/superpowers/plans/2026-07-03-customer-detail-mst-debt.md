# Customer Detail MST And Debt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the `/customers` management page to the approved MVP: MST in customer profile, applied price list rule visible, and readonly customer debt in inline detail.

**Architecture:** Keep customer profile data in Catalog and customer debt in Finance. The page composes `CatalogService` for customer list/create and `OrderService.getCustomerDebt(customerId)` for readonly debt. Do not add KiotViet-only fields beyond MST in this slice.

**Tech Stack:** React, TypeScript, Vitest Testing Library, Supabase migrations/tests, Supabase Edge Function API contracts.

---

## Source Of Truth

- `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
- `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/System/00-UI-SHELL-V1.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md`

## Scope

In scope:

- Add customer `tax_code` / `MST`.
- Show `MST` in create form and inline customer detail.
- Show applied price list label in inline detail:
  - customer group exists: show `Theo nhóm: <group name>`
  - no customer group: show `Bảng giá chung`
- Load readonly customer debt when a row detail opens.
- Show total debt, open invoice count, and open invoice rows.
- Update focused tests and docs.

Out of scope:

- Email, Facebook, gender, birthday, CCCD/CMND, passport, bank account, delivery address.
- Independent debt collection, debt adjustment, QR payment.
- Customer sales history if `/api/v1/sales-documents` does not yet support `customer_id` filtering.
- POS customer quick-create MST unless Owner asks for it after management page MVP.

---

### Task 1: Database Customer MST

**Files:**

- Create: `supabase/migrations/202607030001_customer_tax_code.sql`
- Modify: `supabase/tests/database/005_sales_customers.test.sql`

- [ ] **Step 1: Write the failing database test**

Update the plan count and add the column assertion:

```sql
select plan(34);

select has_column('public', 'customers', 'tax_code', 'customers.tax_code exists');
```

Add a persistence assertion after inserting `KH900001`:

```sql
update public.customers
set tax_code = '0312345678'
where code = 'KH900001';

select is(
  (select tax_code from public.customers where code = 'KH900001'),
  '0312345678',
  'customer tax_code is stored'
);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:db -- supabase/tests/database/005_sales_customers.test.sql
```

Expected: FAIL because `customers.tax_code` does not exist.

- [ ] **Step 3: Add migration**

Create `supabase/migrations/202607030001_customer_tax_code.sql`:

```sql
alter table public.customers
  add column tax_code text;

alter table public.customers
  add constraint customers_tax_code_check
  check (tax_code is null or char_length(btrim(tax_code)) between 1 and 50);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:db -- supabase/tests/database/005_sales_customers.test.sql
```

Expected: PASS.

---

### Task 2: Catalog API Carries MST

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/catalog.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/tests/functions/catalog_test.ts`

- [ ] **Step 1: Write failing function tests**

In `supabase/tests/functions/catalog_test.ts`, extend the customer create/list path so the fake repository captures `taxCode` and returns `tax_code`.

Expected create payload assertion:

```ts
assertEquals(lastCreatedCustomer?.taxCode, "0312345678");
```

Expected response assertion:

```ts
assertEquals(responseBody.tax_code, "0312345678");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:functions -- supabase/tests/functions/catalog_test.ts
```

Expected: FAIL because catalog customer create/list does not parse or return `tax_code`.

- [ ] **Step 3: Update API contracts**

Add to `CustomerData`:

```ts
tax_code: string | null;
```

Add to create/update repository input:

```ts
taxCode?: string;
taxCode?: string | null;
```

- [ ] **Step 4: Parse customer body**

In `parseCustomerCreate`, include:

```ts
taxCode?: string;
```

and parse:

```ts
if ("tax_code" in body && body.tax_code !== null && body.tax_code !== undefined && String(body.tax_code).trim() !== "") {
  input.taxCode = normalizeText(body.tax_code, 50);
}
```

In `parseCustomerUpdate`, include:

```ts
taxCode?: string | null;
```

and parse:

```ts
if ("tax_code" in body) input.taxCode = body.tax_code === null ? null : normalizeText(body.tax_code, 50);
```

- [ ] **Step 5: Update repository select/insert/update**

Change customer selects from:

```ts
.select("id, code, name, phone, customer_group_id, customer_groups(id, code, name)")
```

to:

```ts
.select("id, code, name, phone, tax_code, customer_group_id, customer_groups(id, code, name)")
```

Insert:

```ts
tax_code: input.taxCode ?? null,
```

Patch type:

```ts
const patch: { code?: string; name?: string; phone?: string | null; tax_code?: string | null; customer_group_id?: string | null } = {};
```

Patch assignment:

```ts
if (input.taxCode !== undefined) patch.tax_code = input.taxCode;
```

Return in `toCustomerData`:

```ts
tax_code: row.tax_code,
```

- [ ] **Step 6: Run function test to verify it passes**

Run:

```bash
npm run test:functions -- supabase/tests/functions/catalog_test.ts
```

Expected: PASS.

---

### Task 3: Frontend Types And Service

**Files:**

- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/CustomersPage.test.tsx`

- [ ] **Step 1: Write failing page test for MST create/detail**

In `CustomersPage.test.tsx`, add `tax_code` to fixture customers:

```ts
tax_code: "0312345678",
```

Add assertion in the detail test:

```ts
expect(within(detail).getByText("0312345678")).toBeInTheDocument();
```

Add create form interaction:

```ts
await userEvent.type(within(createForm).getByLabelText("MST"), "0312345678");
```

Expected create payload:

```ts
expect(service.createCustomer).toHaveBeenCalledWith({
  code: "KH000124",
  name: "Nguyễn Văn A",
  phone: "0911000000",
  tax_code: "0312345678",
  customer_group_id: null,
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/features/catalog/CustomersPage.test.tsx
```

Expected: FAIL because the page has no MST input/detail.

- [ ] **Step 3: Update frontend type/service**

In `Customer`:

```ts
tax_code: string | null;
```

In `createCustomer` input:

```ts
tax_code?: string;
```

- [ ] **Step 4: Do not update POS quick-create in this task**

Keep `src/features/pos/CustomerPanel.tsx` unchanged. It can continue creating customers without `tax_code` because the API treats MST as optional.

---

### Task 4: Customer Detail Debt And Price Rule

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`

- [ ] **Step 1: Write failing debt/price test**

Create a minimal order service stub in `CustomersPage.test.tsx`:

```ts
const orderService = {
  getCustomerDebt: vi.fn(async () => ({
    customer_id: "customer-1",
    total_debt: 44800,
    invoices: [
      {
        order_id: "order-1",
        order_code: "HD011004",
        total_amount: 44800,
        paid_amount: 0,
        debt_amount: 44800,
        remaining_debt: 44800,
      },
    ],
  })),
};
```

Render with:

```tsx
render(<CustomersPage service={service} orderService={orderService} />);
```

After opening detail:

```ts
expect(orderService.getCustomerDebt).toHaveBeenCalledWith("customer-1");
expect(within(detail).getByText("Bảng giá áp dụng")).toBeInTheDocument();
expect(within(detail).getByText("Theo nhóm: Khách VIP")).toBeInTheDocument();
expect(within(detail).getByText("Tổng nợ hiện tại")).toBeInTheDocument();
expect(within(detail).getByText("44,800")).toBeInTheDocument();
expect(within(detail).getByText("HD011004")).toBeInTheDocument();
```

Add a separate fixture with `customer_group: null` and assert:

```ts
expect(within(detail).getByText("Bảng giá chung")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/features/catalog/CustomersPage.test.tsx
```

Expected: FAIL because `CustomersPage` does not accept `orderService` and does not load debt.

- [ ] **Step 3: Pass order service from router**

In `CustomersRoute`, create:

```ts
const orderService = useMemo(() => createBrowserOrderService(getAccessToken), [getAccessToken]);
```

Render:

```tsx
<CustomersPage service={service} orderService={orderService} />
```

- [ ] **Step 4: Update CustomersPage props and state**

Use this prop type:

```ts
import type { OrderService, CustomerDebtDetail } from '../orders/order-service';

export function CustomersPage({ service, orderService }: { service: CatalogService; orderService: Pick<OrderService, 'getCustomerDebt'> }) {
```

Add debt state:

```ts
const [customerDebts, setCustomerDebts] = useState<Record<string, CustomerDebtDetail | 'loading' | 'error'>>({});
```

When opening a row:

```ts
function toggleCustomerDetail(customer: Customer) {
  setSelectedCustomerId((current) => {
    const next = current === customer.id ? null : customer.id;
    if (next !== null && customerDebts[customer.id] === undefined) {
      setCustomerDebts((debts) => ({ ...debts, [customer.id]: 'loading' }));
      orderService
        .getCustomerDebt(customer.id)
        .then((debt) => setCustomerDebts((debts) => ({ ...debts, [customer.id]: debt })))
        .catch(() => setCustomerDebts((debts) => ({ ...debts, [customer.id]: 'error' })));
    }
    return next;
  });
}
```

- [ ] **Step 5: Render MVP detail fields**

Inside inline detail, render:

```tsx
<div>
  <dt>MST</dt>
  <dd>{customer.tax_code ?? '-'}</dd>
</div>
<div>
  <dt>Bảng giá áp dụng</dt>
  <dd>{customer.customer_group ? `Theo nhóm: ${customer.customer_group.name}` : 'Bảng giá chung'}</dd>
</div>
```

Render debt:

```tsx
const debt = customerDebts[customer.id];
```

Use these states:

```tsx
{debt === 'loading' ? <p>Đang tải công nợ...</p> : null}
{debt === 'error' ? <p role="alert">Không tải được công nợ khách hàng.</p> : null}
{debt && debt !== 'loading' && debt !== 'error' ? (
  <section aria-label={`Công nợ khách hàng ${customer.code}`}>
    <p>Tổng nợ hiện tại: {formatMoney(debt.total_debt)}</p>
    <p>{debt.invoices.length} hóa đơn còn nợ</p>
    <table aria-label={`Hóa đơn còn nợ ${customer.code}`}>
      <thead>
        <tr>
          <th>Mã hóa đơn</th>
          <th>Tổng tiền</th>
          <th>Đã trả</th>
          <th>Còn nợ</th>
        </tr>
      </thead>
      <tbody>
        {debt.invoices.map((invoice) => (
          <tr key={invoice.order_id}>
            <td>{invoice.order_code}</td>
            <td>{formatMoney(invoice.total_amount)}</td>
            <td>{formatMoney(invoice.paid_amount)}</td>
            <td>{formatMoney(invoice.remaining_debt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
) : null}
```

Use the existing money formatting helper if one exists in the page; otherwise add a small local formatter:

```ts
function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
npx vitest run src/features/catalog/CustomersPage.test.tsx
```

Expected: PASS.

---

### Task 5: Verification And Handoff

**Files:**

- No additional file changes unless tests reveal type drift.

- [ ] **Step 1: Run focused verification**

Run:

```bash
git diff --check
npm run typecheck
npm run lint
npm run test:db -- supabase/tests/database/005_sales_customers.test.sql
npm run test:functions -- supabase/tests/functions/catalog_test.ts
npx vitest run src/features/catalog/CustomersPage.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run broader verification**

Run:

```bash
npm test
npm run build
```

Expected: all PASS; existing Vite chunk-size warning is acceptable if build succeeds.

- [ ] **Step 3: Browser smoke**

On the local dev server:

```text
/customers
```

Verify:

- initial page has no blank detail panel
- row click opens inline detail under that row
- second click closes the detail
- MST appears when present
- no group shows `Bảng giá chung`
- customer with debt shows total debt and invoice row
- no horizontal overflow on desktop and mobile viewport

- [ ] **Step 4: Handoff to Spec/Review**

Use this report shape:

```text
[Implement -> Spec review request]

Branch/PR/commit:
- ...

Scope implemented:
- Customer MST in DB/API/frontend.
- Customer detail shows applied price rule and readonly customer debt.

SoT followed:
- docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md
- docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md
- docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md

Verification:
- ...

Known gaps:
- Sales history remains follow-up until Sales Documents supports customer_id filter.
- No debt collection/adjustment in this slice.
- No KiotViet extra personal/legal/bank fields except MST.
```

---

## Self-Review

- Spec coverage: MST, price-list fallback, and readonly debt are covered. KiotViet extra fields are explicitly out of scope.
- Placeholder scan: no task depends on unspecified behavior.
- Type consistency: API uses `tax_code` in JSON and frontend types; repository parser maps it to `taxCode` internally.
