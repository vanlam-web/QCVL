# Phase 1C Order Checkout Inventory Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1C backend and minimal POS flow for quote/invoice checkout as one business transaction that writes sales orders, inventory movements, payment/debt records, and cashbook entries.

**Architecture:** Keep the current Edge Function route/use-case/repository pattern, but put transaction-critical writes in Postgres RPC functions so checkout cannot create partial data. The Edge API validates permissions, normalizes request payloads, calls typed repository methods, and maps repository errors to the existing standard API envelope. Frontend work stays minimal: POS cart lines, payment input, checkout submit, and receipt summary, while full Inventory and Finance admin screens are deferred after the backend ledger is stable.

**Tech Stack:** Supabase/Postgres migrations, pgTAP, Deno Edge Functions, React/Vite/TypeScript, Vitest, Playwright, shared Windows Supabase server verification.

---

## Source Of Truth

Read these files before implementing any task in this plan:

- `docs/superpowers/specs/2026-06-30-implementation-sync-sales-inventory-finance.md`
- `docs/superpowers/specs/2026-07-01-kv-web-qc-oms-audit.md`
- `docs/02-PRD-UX-PhongCanh/POS/K02/02-K02A-DONG-SP.md`
- `docs/02-PRD-UX-PhongCanh/POS/K02/02a-K02A-SP-THUONG.md`
- `docs/02-PRD-UX-PhongCanh/POS/K03/01-K03A-DOI-TAC.md`
- `docs/02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md`
- `docs/02-PRD-UX-PhongCanh/SalesDocuments/README.md`
- `docs/02-PRD-UX-PhongCanh/SalesDocuments/01-SALES-DOCUMENT-LIST.md`
- `docs/02-PRD-UX-PhongCanh/SalesDocuments/02-SALES-DOCUMENT-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/Customers/README.md`
- `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
- `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/README.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/01-PRICE-LIST.md`
- `docs/02-PRD-UX-PhongCanh/PriceBook/02-PRICE-LIST-DETAIL.md`
- `docs/02-PRD-UX-PhongCanh/Inventory/04-STOCKTAKE.md`
- `docs/02-PRD-UX-PhongCanh/Finance/01-FINANCE-LAYOUT.md`
- `docs/02-PRD-UX-PhongCanh/Finance/02-CASHBOOK.md`
- `docs/02-PRD-UX-PhongCanh/Finance/03-CUSTOMER-DEBT.md`
- `docs/02-PRD-UX-PhongCanh/Finance/04-RECONCILIATION.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/UNIT-CONVERSION.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/STOCKTAKE.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/PRODUCTION-RECONCILIATION.md`
- `docs/03-BUSINESS-NghiepVu/Finance/CASHBOOK.md`
- `docs/04-DATABASE/Sales/POS-TABLES.md`
- `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
- `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
- `docs/04-DATABASE/Finance/CASHBOOK-TABLES.md`
- `docs/05-BACKEND-MayChu/POS/ORDER-API.md`
- `docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md`
- `docs/05-BACKEND-MayChu/Finance/FINANCE-API.md`

If any older plan says checkout only saves an order, or inventory can be edited as a single total for every product, that older assumption is wrong. Use the Source of Truth files above.

---

## Plan Corrections From New Specs

- Checkout must be one business transaction: `orders`, `order_items`, `stock_movements`, `payment_receipts`, `payment_receipt_methods`, `customer_debt_entries`, optional `customer_debt_allocations`, and `cashbook_entries`.
- Final invoice revision never overwrites the old invoice. A revision creates a new code such as `HD000123.01`, cancels the previous document with reason `revised`, and keeps revision links.
- Inventory is deducted when an official invoice is created or saved. Production/machine data is reconciliation-only in MVP and must not create stock movements.
- Insufficient stock produces warnings but does not block checkout; stock can go negative.
- `roll` and `sheet` products are managed by physical inventory objects. Only `normal` products can use total quantity adjustment.
- Stocktake is a core MVP inventory workflow, not an optional/backlog KiotViet feature.
- Editing stock for a `normal` product from Product admin must create an automatic balanced stocktake with note `Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa: <Tên hàng> (<Mã hàng>)`.
- Stocktake list UI/API must support widening the date range when the default filter is empty, because real KiotViet data only appeared after checking `01/07/2016 - 01/07/2026`.
- Roll/sheet total stock adjustment is forbidden; roll/sheet stocktake must reference the physical roll/sheet object.
- Debt is invoice-level. Old debt collection allocates to oldest unpaid invoices first. MVP has no customer prepayment or negative debt balance.
- Cashbook is split by cash and bank account. A POS payment can use cash, one bank account, or mixed cash plus one bank account.
- POS customer phone is optional. Customer code and name are required for a saved profile; customer code can be auto-generated when omitted.
- Changing customer or price list recalculates only automatic-price cart lines. Manual edited prices must remain unchanged and visibly marked.
- Manual edited line prices do not update price lists. POS must expose a button or affordance to view up to five recent manual prices for the current customer and product.
- If a selected customer has old debt and pays more than the current invoice requires, checkout must ask whether to return change or apply the surplus to old debt. Applying surplus allocates oldest unpaid invoice first; returning change must not create negative debt/prepayment.
- Finance vouchers generated by POS checkout or debt collection are source-linked read-only records in Cashbook. Any correction must go through the source business flow, not independent cashbook editing.
- Finance reconciliation is per cash/bank account. Chốt đối soát does not auto-create adjustment vouchers in MVP.
- Cashbook lookup must include `GET /finance/cashbook` with search by voucher code/counterparty/note, `is_business_accounted`, and summary fields `opening_balance`, `total_in`, `total_out`, `ending_balance` for the current filter.
- Exact voucher-code search must find all history or ignore default `from/to` filters that would hide the matching voucher.
- Cashbook and payment receipt details must expose source document and invoice allocation snapshots; POS/debt generated vouchers remain read-only through Finance API.
- Manual cashbook vouchers must store `is_business_accounted`, `counterparty_type`, `counterparty_name`, and `counterparty_phone`; manual create/revise UI stays outside the immediate checkout slice unless a later task opens it.
- Navigation and module boundaries must include first-class MVP entries for Sales Documents, Customers, PriceBook, Inventory, and Finance, even if some screens start as permission-gated placeholders while backend ledger work lands.
- Sales Documents owns saved `BG...`, `HD...`, revised `MaCu.01`, and cancelled document lookup/reprint/revise flows after the operator leaves POS. POS owns creation/checkout.
- Customers owns customer profile management outside POS: customer code/name, optional unique phone, group/price list, sales history, and invoice-level debt. Do not add gender, birthday, points, CRM automation, or Zalo shop to MVP.
- PriceBook owns default and customer-group price lists as separate list/detail screens. Do not implement KiotViet-style `BG1`-`BG5` horizontal price columns, promotions, separate discount programs, bulk price formulas, or detailed price-change history in MVP.
- Do not add KiotViet out-of-scope modules to navigation or data model in Phase 1: returns, shipping partners, waybills, COD, e-invoice issuance, purchase/supplier flows, payroll, analytics reports, online sales channels, or tax/accounting modules.
- Seed and expose `perm.manage_finance`.

---

## Phase 1C Scope Lock

Included:

- Sync the new Sales/Inventory/Finance Source of Truth docs into the implementation branch.
- Sync POS and Finance PRD-UX Source of Truth docs into the implementation branch.
- Sync SalesDocuments, Customers, PriceBook, and KiotViet audit docs into the implementation branch so navigation decisions are grounded in current PRD-UX.
- Add database schema for order lifecycle, inventory ledger, payment/debt, and cashbook MVP.
- Add transaction RPC functions for checkout and debt allocation where atomicity matters.
- Add backend APIs for cart validation, quotes, checkout, and read-only order retrieval.
- Add backend APIs needed by checkout: finance accounts list, customer debt lookup, and inventory warnings.
- Add inventory API support for normal-product stock adjustment that creates a balanced stocktake voucher, plus stocktake list lookup with configurable date range.
- Add minimal POS checkout UI: cart quantities, manual price preservation marker, recent price affordance, payment input, one bank account selector, return-change/apply-old-debt choice, retail debt note, checkout submit, receipt summary.
- Add navigation/module placeholders for Sales Documents, Customers, PriceBook, Inventory, and Finance with permission gates matching existing app patterns; only deep screens needed by checkout are implemented in this phase.
- Add tests and seeds proving `perm.manage_finance`, default cash account, one bank account, invoice/debt/cashbook writes, and stock movements.

Deferred:

- Full Inventory object editing UI for roll/sheet physical objects.
- Advanced stocktake UI polish such as column customization; core stocktake list/history and normal-product auto-balanced stocktake stay in MVP.
- Full Finance admin UI for vouchers/reconciliation.
- Full Sales Documents list/detail beyond checkout smoke read/reprint/revise entry points.
- Full Customers admin screens beyond existing customer selection/creation needs.
- Full PriceBook admin screens beyond existing product/price API needs.
- Full bill image rendering/sending flow.
- Returns, delivery partners, waybills, COD, e-invoice issuance, purchase/supplier flows, payroll, analytics reports, online sales channels, tax/accounting modules.
- Purchase/inbound inventory.
- Production machine event ingestion and automatic file-to-bill matching.
- Multiple bank accounts in one payment.
- Customer prepayment or negative debt balance.

---

## File Structure

Create:

- `supabase/migrations/202606300003_sales_orders_inventory_finance.sql` - orders, order items, order status history, inventory units/settings/objects/movements/stocktakes, finance accounts/payment/debt/cashbook, code generators, transaction RPCs.
- `supabase/tests/database/006_order_inventory_finance_schema.test.sql` - pgTAP coverage for the new tables, permissions, constraints, and seed accounts.
- `supabase/tests/database/007_checkout_transaction.test.sql` - pgTAP integration for checkout RPC rollback/success, stock deduction, debt allocation, and cashbook split.
- `supabase/functions/api/use-cases/orders.ts` - cart validation, quote, checkout, order read, invoice revision orchestration.
- `supabase/functions/api/routes/orders.ts` - `/pos/cart/validate`, `/orders/quotes`, `/orders/checkout`, `/orders/{id}`, `/orders/{id}/revise`.
- `supabase/functions/api/use-cases/inventory.ts` - inventory summary, stock warnings, stocktake history, and normal-product adjustment helpers used by checkout/admin.
- `supabase/functions/api/routes/inventory.ts` - minimal read routes required by POS, stock adjustment, stocktake history, and smoke tests.
- `supabase/functions/api/use-cases/finance.ts` - finance accounts and customer debt lookups used by POS checkout.
- `supabase/functions/api/routes/finance.ts` - minimal finance read/debt collection routes.
- `supabase/tests/functions/orders_test.ts` - Edge Function tests for cart validation, quotes, checkout, and invoice revision guards.
- `supabase/tests/functions/inventory_finance_test.ts` - Edge Function tests for inventory/finance permissions and validation.
- `src/features/orders/order-service.ts` - browser service for validate/checkout/order calls.
- `src/features/orders/types.ts` - frontend order, payment, checkout, warning, and receipt DTOs.
- `src/features/navigation/module-boundaries.ts` - central module metadata for Sales Documents, Customers, PriceBook, Inventory, and Finance visibility.
- `src/features/pos/CheckoutPanel.tsx` - minimal POS checkout form and receipt summary.
- `src/features/pos/CheckoutPanel.test.tsx` - checkout form tests.
- `src/features/pos/RecentPricesButton.tsx` - small POS affordance for opening up to five recent prices for a customer/product.

Modify:

- `supabase/functions/api/contracts.ts` - add order, inventory, finance DTOs and repository methods.
- `supabase/functions/api/repositories/foundation-repository.ts` - add repository reads and RPC calls.
- `supabase/functions/api/routes/router.ts` - mount order, inventory, and finance routes.
- `supabase/functions/api/use-cases/catalog.ts` - keep product search active-only for POS; do not mix inventory object editing here.
- `supabase/seed.sql` - seed `perm.manage_finance`, default cash account, one bank account, inventory units/settings for existing products, and enough stock data for tests.
- `src/features/catalog/types.ts` - add inventory shape/settings summary if Product admin needs to display stock status.
- `src/features/pos/PosShell.tsx` - maintain cart line quantities, preserve manual line prices when customer/price list changes, and wire checkout panel.
- `src/features/pos/PosShell.test.tsx` - cover adding product, customer change preserving manual prices, payment input, checkout success summary.
- `src/app/router.tsx` and `src/features/dashboard/DashboardPage.tsx` - expose Sales Documents, Customers, PriceBook, Inventory, and Finance entries only when useful and permission-gated.
- `docs/PHASE-CHECKLIST.md` - mark Phase 1B merged and track Phase 1C.

---

## Task 1: Sync Specs And Update Phase Checklist

**Files:**

- Modify: `docs/02-PRD-UX-PhongCanh/POS/**`
- Create: `docs/02-PRD-UX-PhongCanh/SalesDocuments/**`
- Create: `docs/02-PRD-UX-PhongCanh/Customers/**`
- Create: `docs/02-PRD-UX-PhongCanh/PriceBook/**`
- Create: `docs/02-PRD-UX-PhongCanh/Finance/**`
- Modify: `docs/03-BUSINESS-NghiepVu/**`
- Modify: `docs/04-DATABASE/**`
- Modify: `docs/05-BACKEND-MayChu/**`
- Create: `docs/superpowers/specs/2026-06-30-implementation-sync-sales-inventory-finance.md`
- Create: `docs/superpowers/specs/2026-07-01-kv-web-qc-oms-audit.md`
- Modify: `docs/PHASE-CHECKLIST.md`

- [ ] **Step 1: Confirm docs are present**

Run:

```bash
test -f docs/superpowers/specs/2026-06-30-implementation-sync-sales-inventory-finance.md
test -f docs/superpowers/specs/2026-07-01-kv-web-qc-oms-audit.md
test -f docs/02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md
test -f docs/02-PRD-UX-PhongCanh/SalesDocuments/01-SALES-DOCUMENT-LIST.md
test -f docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md
test -f docs/02-PRD-UX-PhongCanh/PriceBook/01-PRICE-LIST.md
test -f docs/02-PRD-UX-PhongCanh/Finance/02-CASHBOOK.md
test -f docs/02-PRD-UX-PhongCanh/Finance/03-CUSTOMER-DEBT.md
test -f docs/05-BACKEND-MayChu/POS/ORDER-API.md
test -f docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md
test -f docs/05-BACKEND-MayChu/Finance/FINANCE-API.md
```

Expected: all commands exit `0`.

- [ ] **Step 2: Update checklist status**

Set Phase 1B to merged/PASS and add Phase 1C status with this plan file, the current branch, and server verification requirements.

- [ ] **Step 3: Verify docs formatting**

Run:

```bash
git diff --check
rg -n "TBD|TODO|FIXME|discount_items|discount_rate" docs
```

Expected: `git diff --check` exits `0`; `rg` only reports intentional historical notes that explicitly say not to use legacy discount models or out-of-scope KiotViet features.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: sync sales inventory finance implementation specs"
```

---

## Task 2: Database Schema And Seeds

**Files:**

- Create: `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
- Create: `supabase/tests/database/006_order_inventory_finance_schema.test.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write failing schema tests**

Create `supabase/tests/database/006_order_inventory_finance_schema.test.sql` with checks for:

```sql
select has_table('public', 'orders');
select has_table('public', 'order_items');
select has_table('public', 'order_status_history');
select has_table('public', 'inventory_units');
select has_table('public', 'product_inventory_settings');
select has_table('public', 'product_unit_conversions');
select has_table('public', 'inventory_rolls');
select has_table('public', 'inventory_sheets');
select has_table('public', 'stock_movements');
select has_table('public', 'stocktakes');
select has_table('public', 'stocktake_items');
select has_table('public', 'finance_accounts');
select has_table('public', 'payment_receipts');
select has_table('public', 'payment_receipt_methods');
select has_table('public', 'customer_debt_entries');
select has_table('public', 'customer_debt_allocations');
select has_table('public', 'cashbook_vouchers');
select has_table('public', 'cashbook_entries');
select has_table('public', 'cash_reconciliations');
select has_table('public', 'cash_reconciliation_items');
select results_eq(
  $$ select count(*)::integer from public.permissions where code = 'perm.manage_finance' $$,
  array[1],
  'manage finance permission is seeded'
);
```

Also check these constraints by inserts:

```sql
-- invoice revision code must be base_code || '.01'
-- bank payment method must point to a bank finance account
-- normal product can have null inventory_object_type
-- roll movement requires inventory_roll_id
-- sheet movement requires inventory_sheet_id
```

- [ ] **Step 2: Run schema test to verify RED**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: `006_order_inventory_finance_schema.test.sql` fails because tables do not exist.

- [ ] **Step 3: Create migration**

Implement tables exactly from:

- `docs/04-DATABASE/Sales/POS-TABLES.md` sections `orders`, `order_items`, `order_status_history`
- `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
- `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
- `docs/04-DATABASE/Finance/CASHBOOK-TABLES.md`

Add code generator functions:

```sql
public.next_order_code(p_organization_id uuid, p_prefix text)
public.next_stocktake_code(p_organization_id uuid)
public.next_payment_receipt_code(p_organization_id uuid)
public.next_cashbook_voucher_code(p_organization_id uuid, p_direction text)
public.next_cash_reconciliation_code(p_organization_id uuid)
```

Add service role grants for every new table and function.

- [ ] **Step 4: Seed finance/inventory basics**

Update `supabase/seed.sql`:

```sql
-- permissions
insert into public.permissions (code, module, description, status)
values ('perm.manage_finance', 'finance', 'Manage finance accounts, debts, cashbook and reconciliation', 'active')
on conflict (code) do update
set module = excluded.module,
    description = excluded.description,
    status = excluded.status;

-- finance accounts
insert into public.finance_accounts (... code, name, account_type, is_default_cash, is_active ...)
values (... 'CASH', 'Quỹ tiền mặt', 'cash', true, true ...),
       (... 'MB01', 'MB Bank', 'bank', false, true ...);
```

Seed inventory units `M2`, `M`, `CAI`, `TAM`, product inventory settings for existing seed products, and enough stock movement/object rows for checkout tests.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: all database tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202606300003_sales_orders_inventory_finance.sql supabase/tests/database/006_order_inventory_finance_schema.test.sql supabase/seed.sql
git commit -m "feat: add order inventory finance schema"
```

---

## Task 3: Transaction RPCs For Checkout And Debt

**Files:**

- Modify: `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
- Create: `supabase/tests/database/007_checkout_transaction.test.sql`

- [ ] **Step 1: Write failing transaction tests**

Create tests for:

```sql
-- checkout full paid cash creates one order, one order item, one sale_deduction stock movement,
-- one payment receipt, one payment method, and one cashbook entry.

-- checkout partial paid creates invoice_debt customer_debt_entries with invoice-level balance.

-- mixed cash + bank creates two payment_receipt_methods and two cashbook_entries.

-- old debt payment allocates to oldest unpaid invoice first.

-- checkout overpayment with return_change creates change_returned but no negative debt.

-- checkout overpayment with apply_to_old_debt allocates surplus to oldest unpaid old invoice first.

-- invalid bank account rolls back; no order remains.
```

- [ ] **Step 2: Implement RPCs**

Add RPC functions with `security definer`, `set search_path = ''`, organization checks, and explicit row locks where needed:

```sql
public.checkout_order_tx(p_actor_user_id uuid, p_organization_id uuid, p_payload jsonb)
public.collect_customer_debt_tx(p_actor_user_id uuid, p_organization_id uuid, p_payload jsonb)
public.revise_invoice_tx(p_actor_user_id uuid, p_organization_id uuid, p_order_id uuid, p_payload jsonb)
```

The checkout RPC must perform all mandatory workflow steps from `ORDER-API.md` section 6 in one database transaction. Do not implement checkout as many independent Supabase client writes in Edge code.

- [ ] **Step 3: Verify transaction behavior**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: `007_checkout_transaction.test.sql` passes and rollback test proves no partial `orders` row remains after a payment validation failure.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202606300003_sales_orders_inventory_finance.sql supabase/tests/database/007_checkout_transaction.test.sql
git commit -m "feat: add checkout transaction rpc"
```

---

## Task 4: Order API

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/functions/api/use-cases/orders.ts`
- Create: `supabase/functions/api/routes/orders.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Create: `supabase/tests/functions/orders_test.ts`

- [x] **Step 1: Write failing function tests**

Cover:

```ts
Deno.test("cart validation rejects inactive products", async () => {});
Deno.test("checkout requires create_order and validates bank account", async () => {});
Deno.test("checkout returns inventory warnings but does not block negative stock", async () => {});
Deno.test("invoice revise requires edit_order_locked and revision_reason", async () => {});
```

- [ ] **Step 2: Add contracts**

Add DTOs for:

```ts
export interface CartValidationRequest {}
export interface CartValidationResponse {}
export interface CheckoutRequest {}
export interface CheckoutResponse {}
export interface OrderData {}
export interface OrderItemData {}
export interface InventoryWarningData {}
```

Use snake_case JSON field names at API boundaries and camelCase repository input names.

- [ ] **Step 3: Implement use cases**

`orders.ts` must:

- require `perm.create_order` for validate/quote/checkout/read
- require `perm.edit_order_locked` for revise
- validate item quantity, dimensions, unit price, price source, customer snapshot, retail debt note, and payment split
- reject bank payment without `bank_account_id`
- reject more than one bank account in one POS payment
- accept an explicit `overpayment_handling` value of `return_change` or `apply_old_debt` when selected customer surplus is present
- allow negative stock warning from repository without blocking checkout
- call repository RPC methods for writes

- [ ] **Step 4: Mount routes**

Mount:

```text
POST /api/v1/pos/cart/validate
POST /api/v1/orders/quotes
GET  /api/v1/orders/quotes
GET  /api/v1/orders/{id}
PUT  /api/v1/orders/quotes/{id}
POST /api/v1/orders/quotes/{id}/cancel
POST /api/v1/orders/checkout
POST /api/v1/orders/{id}/revise
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test:functions
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/orders_test.ts
git commit -m "feat: add order checkout api"
```

---

## Task 5: Inventory And Finance API Minimum For Checkout

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/functions/api/use-cases/inventory.ts`
- Create: `supabase/functions/api/routes/inventory.ts`
- Create: `supabase/functions/api/use-cases/finance.ts`
- Create: `supabase/functions/api/routes/finance.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Create: `supabase/tests/functions/inventory_finance_test.ts`

- [x] **Step 1: Write failing function tests**

Cover:

```ts
Deno.test("finance accounts require view_shift_report or manage_finance", async () => {});
Deno.test("debt collection rejects overpayment", async () => {});
Deno.test("source-linked cashbook vouchers cannot be edited independently", async () => {});
Deno.test("inventory products hide inactive rows for create_order-only actor", async () => {});
Deno.test("normal product stock adjustment creates balanced stocktake", async () => {});
Deno.test("stocktake list accepts long date ranges when default period is empty", async () => {});
Deno.test("roll and sheet products reject total stock adjustment", async () => {});
```

- [x] **Step 2: Implement finance minimum**

Mount:

```text
GET  /api/v1/finance/accounts
GET  /api/v1/finance/customer-debts
GET  /api/v1/finance/customers/{customer_id}/debt
POST /api/v1/finance/debt-collections
GET  /api/v1/finance/cashbook/balances
GET  /api/v1/finance/cashbook/vouchers
GET  /api/v1/finance/reconciliations
```

Use `perm.manage_finance` for debt collection and `perm.create_order` or `perm.manage_finance` for customer debt reads.
Manual cashbook voucher editing belongs to a later Finance admin phase. Source-linked POS/debt vouchers must be read-only through the Finance API.

- [x] **Step 3: Implement inventory minimum**

Mount:

```text
GET  /api/v1/inventory/products
GET  /api/v1/inventory/products/{product_id}
GET  /api/v1/inventory/stock-movements
GET  /api/v1/inventory/stocktakes
POST /api/v1/inventory/products/{product_id}/adjust-stock
```

Keep roll/sheet object editing routes deferred unless checkout tests need them. The adjust-stock route must only accept `inventory_shape = normal` and must create a `stocktakes.status = balanced` voucher plus `stock_movements.movement_type = stocktake_adjustment`. Stocktake listing must accept explicit `created_from` and `created_to` filters so operators can search long history when the default period has no rows.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/inventory_finance_test.ts
git commit -m "feat: add inventory finance api minimum"
```

---

## Task 5A: Cashbook Lookup And Receipt Details Spec Follow-Up

**Source update:** Spec commit `3ccb40e docs: refine cashbook lookup and receipt details`.

**Files:**

- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/finance.ts`
- Modify: `supabase/functions/api/routes/finance.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
- Modify: `supabase/tests/database/006_order_inventory_finance_schema.test.sql`
- Modify: `supabase/tests/functions/inventory_finance_test.ts`

- [ ] **Step 1: Write failing function tests**

Cover:

```ts
Deno.test("cashbook exact voucher search ignores default date filters", async () => {});
Deno.test("cashbook entry detail includes source and allocation snapshot", async () => {});
Deno.test("payment receipt detail includes methods and invoice allocations", async () => {});
```

- [x] **Step 2: Add API surface**

Mount:

```text
GET /api/v1/finance/cashbook
GET /api/v1/finance/cashbook/{entry_id}
GET /api/v1/finance/payment-receipts/{id}
```

`GET /finance/cashbook` must accept `search`, `finance_account_id`, `direction`, `source_type`, `is_business_accounted`, `from`, `to`, `page`, and `page_size`; response must include `summary.opening_balance`, `summary.total_in`, `summary.total_out`, and `summary.ending_balance`.

- [x] **Step 3: Align database fields**

Add cashbook metadata needed by manual voucher/detail specs:

```sql
is_business_accounted boolean
counterparty_type text
counterparty_name text
counterparty_phone text
```

Generated POS/debt rows can default `is_business_accounted = true` and use source/payment receipt data for detail.

- [x] **Step 4: Verify**

Run:

```bash
npm run test:functions
npx deno check supabase/functions/api/index.ts
npm run lint
npm test
npm run typecheck
npm run build
```

Expected: all pass. Server DB verification remains batched with the next milestone.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-phase-1c-order-checkout-inventory-finance.md supabase/functions/api supabase/tests/functions/inventory_finance_test.ts supabase/migrations/202606300003_sales_orders_inventory_finance.sql supabase/tests/database/006_order_inventory_finance_schema.test.sql
git commit -m "feat: refine cashbook finance api"
```

---

## Task 6: Minimal POS Checkout UI

**Files:**

- Create: `src/features/orders/types.ts`
- Create: `src/features/orders/order-service.ts`
- Create: `src/features/navigation/module-boundaries.ts`
- Create: `src/features/pos/CheckoutPanel.tsx`
- Create: `src/features/pos/CheckoutPanel.test.tsx`
- Create: `src/features/navigation/module-boundaries.test.ts`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/styles/index.css`

- [x] **Step 1: Write failing UI tests**

Cover:

```ts
it("calculates cart total and submits cash checkout", async () => {});
it("requires a bank account when bank amount is entered", async () => {});
it("keeps manual line prices when the selected customer changes", async () => {});
it("offers recent prices for the selected customer and product", async () => {});
it("shows checkout inventory warnings without blocking success", async () => {});
it("requires retail debt note when no customer is selected and invoice has debt", async () => {});
it("asks whether customer surplus is returned or applied to old debt", async () => {});
it("shows only MVP module entries for sales documents customers price book inventory and finance", async () => {});
it("does not expose returns delivery cod e-invoice purchasing payroll reports online sales or tax modules", async () => {});
```

- [x] **Step 2: Add order service**

Expose:

```ts
validateCart(input)
checkout(input)
listFinanceAccounts()
getCustomerDebt(customerId)
listRecentCustomerProductPrices(customerId, productId)
```

- [x] **Step 3: Extend POS cart lines**

Each cart line must hold:

```ts
{
  id: string
  product: Product
  quantity: number
  width_m?: number
  height_m?: number
  linear_m?: number
  unitPrice: number
  priceSource: string
  isManualPrice: boolean
  recentPrices?: Array<{ unitPrice: number; soldAt: string; orderCode: string }>
  note?: string
}
```

- [x] **Step 4: Add checkout panel**

The panel must collect:

- cash amount
- bank amount
- one bank account if bank amount is greater than zero
- old debt payment amount when a customer is selected
- return-change versus apply-old-debt choice when selected customer surplus exists
- retail debt note if no customer is selected and debt remains

On success it displays invoice code, paid amount, debt amount, change returned, and inventory warnings.
When customer or price list changes, keep `isManualPrice` lines unchanged and recalculate only automatic-price lines.

- [x] **Step 5: Verify frontend**

Add `src/features/navigation/module-boundaries.ts` with only these Phase 1 module entries:

```ts
export const phaseOneModules = [
  { id: "pos", label: "POS", path: "/pos", permissions: ["perm.create_order"] },
  { id: "sales-documents", label: "Chứng từ bán hàng", path: "/sales-documents", permissions: ["perm.create_order"] },
  { id: "customers", label: "Khách hàng", path: "/customers", permissions: ["perm.create_order"] },
  { id: "price-book", label: "Bảng giá", path: "/price-book", permissions: ["perm.edit_price_book"] },
  { id: "inventory", label: "Kho", path: "/inventory", permissions: ["perm.manage_inventory"] },
  { id: "finance", label: "Tài chính", path: "/finance", permissions: ["perm.manage_finance"] },
] as const;
```

Do not add module ids for `returns`, `shipping`, `cod`, `e-invoice`, `purchase`, `supplier`, `payroll`, `reports`, `online-sales`, or `tax-accounting` in Phase 1.

- [x] **Step 6: Verify frontend**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add src/features/orders src/features/navigation src/features/pos src/features/dashboard/DashboardPage.tsx src/app/router.tsx src/styles/index.css
git commit -m "feat: add pos checkout flow"
```

---

## Task 7: End-To-End Verification And Server Smoke

**Files:**

- Modify: `tests/e2e/auth-pos.spec.ts`
- Modify: `docs/PHASE-CHECKLIST.md`

- [x] **Step 1: Add e2e happy path**

Extend the existing POS e2e to:

- login as admin
- open POS
- select customer
- add MICA seed product
- enter cash payment
- submit checkout
- assert invoice code starts with `HD`

- [x] **Step 2: Run local verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
```

Expected: all pass locally.

- [x] **Step 3: Run server verification**

On the Windows shared server:

```powershell
cd D:\AI\QC-OMS
git fetch origin
git checkout codex/phase-1c-order-checkout
git pull origin codex/phase-1c-order-checkout
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:functions
npm.cmd run supabase:reset
npm.cmd run test:db
npm.cmd run test:functions
```

Expected: all pass. If the Edge Runtime uses `C:\QC-OMS-runtime`, sync from `D:\AI\QC-OMS` to the mirror and restart Supabase with `--workdir C:\QC-OMS-runtime`.

- [x] **Step 4: Smoke API**

Smoke through `100.123.122.45`:

```text
/api/v1/health -> 200
login admin@qc.local / 123456 -> OK
/api/v1/me -> 200 and includes perm.manage_finance
GET /api/v1/finance/accounts -> 200 and includes CASH + MB01
POST /api/v1/orders/checkout cash full-paid -> 200/201 and returns HD...
GET /api/v1/orders/{id} -> 200
GET /api/v1/inventory/stock-movements?order_id=... -> 200 and includes sale_deduction
GET /api/v1/finance/cashbook/balances -> 200
```

- [ ] **Step 5: Update checklist and create PR**

Update `docs/PHASE-CHECKLIST.md` with the exact PASS/FAIL output, push the branch, and create a PR to `main`.

---

## Risk Notes

- Do not perform checkout writes as separate Edge/Supabase calls. Use Postgres RPCs for atomicity.
- Do not create stock movements from production/machine data.
- Do not block checkout because stock is insufficient; return warning data and allow negative stock.
- Do not edit finalized invoice, payment, debt, stock, or cashbook history in place. Create reversal/version rows.
- Do not bring back `discount_items jsonb` or `discount_rate`; current pricing remains normalized.
- Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend `.env.local`.
