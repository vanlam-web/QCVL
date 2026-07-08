# Phase 3A Quote Reopen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 3A quote support: save `BG...`, list/detail quotes, reopen an active quote into a POS local draft, and checkout that draft into `HD...` while linking and converting the source quote.

**Architecture:** Reuse the existing `orders` / `order_items` sales document foundation. Add quote-specific transaction functions for save/revision and extend checkout transaction to atomically link `source_quote_id/source_quote_code` and mark quotes `converted`. Keep POS drafts local by passing a reopen payload through browser session storage, not by creating server drafts.

**Tech Stack:** React + TypeScript + Vite, Supabase Edge Functions, PostgreSQL migrations/RPC, pgTAP, Deno function tests, Vitest.

---

## Source Of Truth

Implementation must use spec commit `6008fe6ee6e558a41839130e895e85523a3edd7a` plus addendum commit `dd133ce docs: clarify quote reopen implementation contract` from branch `origin/codex/spec-purchase-supplier-bom`.

Before implementation, ensure one of these is true:

```bash
git branch --contains 6008fe6ee6e558a41839130e895e85523a3edd7a
git branch --remotes --contains 6008fe6ee6e558a41839130e895e85523a3edd7a
git show --stat --oneline dd133ce
```

Expected: either `origin/codex/spec-purchase-supplier-bom` is visible with both commits, or the commits have already been merged/cherry-picked into the implementation base.

Key decisions:

- Quote save creates `BG...` with `order_type = quote`, `status = active`.
- Quote alone creates no stock movement, cashbook, payment receipt, customer debt, production, delivery, COD, VAT, or e-invoice workflow.
- Reopen quote returns payload for a POS local draft; no server draft.
- Reopened draft keeps quote snapshot prices by default and warns on current price differences.
- Reopen warning codes are `CURRENT_PRICE_DIFFERS`, `PRODUCT_INACTIVE`, `PRODUCT_MISSING`, `PRICE_LIST_INACTIVE`, and `CUSTOMER_CHANGED`.
- Only unresolved `PRODUCT_INACTIVE` or `PRODUCT_MISSING` blocks checkout; warn-only codes keep snapshot data and let the operator proceed.
- Edited quote save creates revision `BG000123.01`; no overwrite.
- Checkout from quote creates `HD...`, stores `source_quote_id` and `source_quote_code`, and converts the source quote in the same transaction.
- Converted quotes cannot be checked out again.
- Quote bill preview/print/auto-send is outside Phase 3A.

## File Structure

- Modify `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
  - Keep base schema coherent for fresh resets.
  - Add `source_quote_code`.
  - Add `save_quote_tx`, `revise_quote_tx`.
  - Extend `checkout_order_tx` for quote conversion.
- Create `supabase/migrations/202607010002_quote_reopen.sql`
  - Forward migration for existing Cloud/local databases.
  - Same schema/function changes as the base migration delta.
- Modify `supabase/tests/database/006_order_inventory_finance_schema.test.sql`
  - Assert `orders.source_quote_code` exists and quote constraints/indexes are present.
- Create `supabase/tests/database/009_quote_lifecycle.test.sql`
  - pgTAP coverage for save quote, revision, checkout conversion, and no financial/inventory side effects on quote save.
- Modify `supabase/functions/api/contracts.ts`
  - Add quote summary and reopen payload data contracts.
  - Extend checkout input expectations through repository payload passthrough.
- Modify `supabase/functions/api/repositories/foundation-repository.ts`
  - Add `saveQuote`, `reviseQuote`, `getQuoteReopenPayload`.
  - Include `source_quote_code` in sales document list/detail mapping.
- Modify `supabase/functions/api/use-cases/orders.ts`
  - Add parse/validation for quote save, quote revision, and reopen payload.
  - Keep `perm.create_order` as the Phase 3A guard.
- Modify `supabase/functions/api/routes/orders.ts`
  - Add `POST /api/v1/orders/quotes`.
  - Add `GET /api/v1/orders/quotes/{id}/reopen-payload`.
  - Add `POST /api/v1/orders/quotes/{id}/revisions`.
- Modify `supabase/tests/functions/orders_test.ts`
  - Cover quote endpoints and checkout from active/converted quote.
- Modify `supabase/tests/functions/sales_documents_test.ts`
  - Cover quote list/detail and exact `BG...` lookup.
- Modify `src/features/orders/types.ts`
  - Add quote input/result/reopen payload types.
  - Add `source_quote_id` to `CheckoutInput`.
  - Add quote draft metadata to `CheckoutCartLine`.
- Modify `src/features/orders/order-service.ts`
  - Add `saveQuote`, `reviseQuote`, `getQuoteReopenPayload`.
- Create `src/features/pos/quote-draft-handoff.ts`
  - Session storage bridge between Sales Documents and POS.
- Modify `src/features/pos/PosShell.tsx`
  - Consume quote reopen payload into local cart.
  - Track `sourceQuote`.
  - Save quote / save quote revision.
  - Pass `source_quote_id` to checkout.
  - Block checkout when reopened quote contains inactive/missing product warning.
- Modify `src/features/pos/CheckoutPanel.tsx`
  - Add `Báo giá` action.
  - Show source quote and quote warnings.
  - Disable checkout with clear message when quote line is blocked.
- Modify `src/features/pos/PosShell.test.tsx` and `src/features/pos/CheckoutPanel.test.tsx`
  - Cover save quote, reopen payload consumption, source quote checkout, and blocked inactive quote line.
- Modify `src/features/sales-documents/types.ts`
  - Add `source_quote_code` and quote-friendly status/payment fields.
- Modify `src/features/sales-documents/sales-document-service.ts`
  - Add type/status filters in list call.
- Modify `src/features/sales-documents/SalesDocumentsPage.tsx`
  - Add document type/status filters.
  - Show quote rows naturally.
  - Show `Mở tại POS` only for active quotes.
  - Keep edit/cancel/print hidden.
- Modify `src/features/sales-documents/SalesDocumentsPage.test.tsx`
  - Cover quote filtering/detail/reopen action and no print/edit/cancel.
- Modify `src/app/router.tsx`
  - Wire quote reopen from Sales Documents to POS through session storage and navigation.
- Optionally modify `src/styles/index.css`
  - Add small warning/status styling for quote banners; avoid large redesign.

---

## Task 1: Database Quote Lifecycle Tests

**Files:**
- Modify: `supabase/tests/database/006_order_inventory_finance_schema.test.sql`
- Create: `supabase/tests/database/009_quote_lifecycle.test.sql`

- [ ] **Step 1: Add schema assertions**

Add assertions to `006_order_inventory_finance_schema.test.sql`:

```sql
select has_column('public', 'orders', 'source_quote_code', 'orders.source_quote_code exists');
select has_index('public', 'orders', 'idx_orders_source_quote', 'orders has source quote index');
select has_index('public', 'orders', 'idx_orders_org_base_revision', 'orders has base revision index');
```

- [ ] **Step 2: Add failing quote lifecycle pgTAP test**

Create `009_quote_lifecycle.test.sql` with these scenarios:

```sql
begin;
select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'quote-admin@example.test', 'test', now(), now(), now());

insert into public.profiles (user_id, organization_id, display_name, status)
values ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Quote Admin', 'active');

insert into public.user_permissions (user_id, permission_code, granted_by)
values ('90000000-0000-4000-8000-000000000001', 'perm.create_order', '90000000-0000-4000-8000-000000000001');

create temp table quote_results(name text primary key, result jsonb);

insert into quote_results
select 'base_quote', public.save_quote_tx(
  '90000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'customer_id', null,
    'customer_snapshot', jsonb_build_object('type', 'retail', 'name', 'Khach le'),
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '00000000-0000-4000-8000-000000000303',
      'quantity', 1,
      'unit_price', 180000,
      'discount_amount', 10000,
      'price_source', 'manual',
      'note', 'Bao gia test'
    )),
    'note', 'Bao gia phase 3A'
  )
);

select like((select result->>'order_code' from quote_results where name = 'base_quote'), 'BG%', 'save quote creates BG code');
select is((select order_type from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 'quote', 'saved order is quote');
select is((select status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 'active', 'quote starts active');
select is((select payment_status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 'not_applicable', 'quote payment status is not applicable');
select is((select count(*)::integer from public.stock_movements where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 0, 'quote creates no stock movement');
select is((select count(*)::integer from public.payment_receipts where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 0, 'quote creates no payment receipt');
select is((select count(*)::integer from public.customer_debt_entries where order_id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 0, 'quote creates no debt entry');

insert into quote_results
select 'quote_revision', public.revise_quote_tx(
  '90000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid),
  jsonb_build_object(
    'customer_id', null,
    'customer_snapshot', jsonb_build_object('type', 'retail', 'name', 'Khach le'),
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '00000000-0000-4000-8000-000000000303',
      'quantity', 2,
      'unit_price', 180000,
      'discount_amount', 0,
      'price_source', 'manual'
    )),
    'note', 'Bao gia sua'
  )
);

select like((select result->>'order_code' from quote_results where name = 'quote_revision'), 'BG%.01', 'revision creates BG .01 code');
select is((select status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 'cancelled', 'old quote is cancelled after revision');
select is((select cancel_reason_type from public.orders where id = ((select result->>'order_id' from quote_results where name = 'base_quote')::uuid)), 'revised', 'old quote cancel reason is revised');

insert into quote_results
select 'invoice_from_quote', public.checkout_order_tx(
  '90000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'source_quote_id', ((select result->>'order_id' from quote_results where name = 'quote_revision')::uuid),
    'customer_id', null,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '00000000-0000-4000-8000-000000000303',
      'quantity', 1,
      'unit_price', 180000,
      'discount_amount', 0,
      'price_source', 'manual'
    )),
    'payment', jsonb_build_object('cash_amount', 180000, 'bank_amount', 0, 'old_debt_payment_amount', 0, 'change_returned_amount', 0)
  )
);

select is((select status from public.orders where id = ((select result->>'order_id' from quote_results where name = 'quote_revision')::uuid)), 'converted', 'checkout converts quote');
select is((select source_quote_id from public.orders where id = ((select result->>'order_id' from quote_results where name = 'invoice_from_quote')::uuid)), ((select result->>'order_id' from quote_results where name = 'quote_revision')::uuid), 'invoice stores source quote id');
select is((select source_quote_code from public.orders where id = ((select result->>'order_id' from quote_results where name = 'invoice_from_quote')::uuid)), (select result->>'order_code' from quote_results where name = 'quote_revision'), 'invoice stores source quote code');

select throws_ok(
  $$ select public.checkout_order_tx(
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'source_quote_id', ((select result->>'order_id' from quote_results where name = 'quote_revision')::uuid),
      'customer_id', null,
      'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8000-000000000303', 'quantity', 1, 'unit_price', 180000, 'discount_amount', 0, 'price_source', 'manual')),
      'payment', jsonb_build_object('cash_amount', 180000, 'bank_amount', 0, 'old_debt_payment_amount', 0, 'change_returned_amount', 0)
    )
  ) $$,
  '22023',
  null,
  'converted quote cannot be checked out again'
);

select is((select count(*)::integer from public.order_status_history where order_id = ((select result->>'order_id' from quote_results where name = 'quote_revision')::uuid) and to_status = 'converted'), 1, 'quote conversion writes status history');
select finish();
rollback;
```

- [ ] **Step 3: Run failing database tests**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected before implementation: `009_quote_lifecycle.test.sql` fails because `save_quote_tx`, `revise_quote_tx`, and/or `source_quote_code` do not exist.

---

## Task 2: Database Migration And RPCs

**Files:**
- Modify: `supabase/migrations/202606300003_sales_orders_inventory_finance.sql`
- Create: `supabase/migrations/202607010002_quote_reopen.sql`
- Modify: `supabase/tests/database/006_order_inventory_finance_schema.test.sql`
- Modify: `supabase/tests/database/009_quote_lifecycle.test.sql`

- [ ] **Step 1: Add forward migration shell**

Create `202607010002_quote_reopen.sql` with:

```sql
alter table public.orders
  add column if not exists source_quote_code text;

create index if not exists idx_orders_source_quote_code
  on public.orders (organization_id, source_quote_code)
  where source_quote_code is not null;
```

- [ ] **Step 2: Add quote save RPC**

Add `public.save_quote_tx(p_actor_user_id uuid, p_organization_id uuid, p_payload jsonb)` to both the base migration and the forward migration. The function must:

```sql
-- Required behavior inside save_quote_tx:
-- 1. validate active actor profile in organization
-- 2. require p_payload.items to be a non-empty array
-- 3. validate customer_id if provided
-- 4. use customer_snapshot from payload, or build retail snapshot when absent
-- 5. validate each product is active in organization
-- 6. validate quantity > 0, unit_price >= 0, discount between 0 and line subtotal
-- 7. compute subtotal_amount, discount_amount, total_amount server-side
-- 8. generate next_order_code(p_organization_id, 'BG')
-- 9. insert orders row:
--    order_type='quote', status='active', base_code=code, revision_no=0,
--    paid_amount=0, debt_amount=0, change_returned_amount=0,
--    payment_status='not_applicable'
-- 10. insert order_items snapshots
-- 11. insert order_status_history with to_status='active'
-- 12. return jsonb with order_id, order_code, order summary
```

Use the same amount math as `checkout_order_tx`: `line_subtotal = round(quantity * unit_price)`.

- [ ] **Step 3: Add quote revision RPC**

Add `public.revise_quote_tx(p_actor_user_id uuid, p_organization_id uuid, p_quote_id uuid, p_payload jsonb)` to both migration files. It must:

```sql
-- Required behavior inside revise_quote_tx:
-- 1. lock/read p_quote_id in the same organization
-- 2. require order_type='quote' and status='active'
-- 3. find max revision_no for quote base_code
-- 4. create new code base_code || '.' || lpad(next_revision_no::text, 2, '0')
-- 5. insert new active quote with revised_from_order_id = p_quote_id
-- 6. copy validated snapshots from p_payload into order_items
-- 7. update old quote status='cancelled', cancel_reason_type='revised',
--    cancelled_at=now(), replaced_by_order_id=new_quote_id
-- 8. insert order_status_history for old cancelled and new active
-- 9. return new quote summary
```

- [ ] **Step 4: Extend checkout RPC**

Modify `checkout_order_tx` to:

```sql
-- Add declarations:
source_quote_id_value uuid;
source_quote_code_value text;
source_quote_record record;

-- Parse:
source_quote_id_value := nullif(p_payload->>'source_quote_id', '')::uuid;

-- Validate before inserting invoice:
if source_quote_id_value is not null then
  select *
    into source_quote_record
  from public.orders
  where id = source_quote_id_value
    and organization_id = p_organization_id
    and order_type = 'quote'
  for update;

  if source_quote_record.id is null or source_quote_record.status <> 'active' then
    raise exception 'source quote is not active' using errcode = '22023';
  end if;

  source_quote_code_value := source_quote_record.code;
end if;

-- Insert invoice source columns:
source_quote_id,
source_quote_code,

-- After successful invoice writes, before return:
if source_quote_id_value is not null then
  update public.orders
  set status = 'converted', updated_at = now()
  where id = source_quote_id_value;

  insert into public.order_status_history (
    organization_id, order_id, from_status, to_status, reason, changed_by
  )
  values (
    p_organization_id, source_quote_id_value, 'active', 'converted', order_code_value, p_actor_user_id
  );
end if;
```

- [ ] **Step 5: Grant execute**

Add grants in the forward migration and base migration:

```sql
grant execute on function public.save_quote_tx(uuid, uuid, jsonb) to service_role;
grant execute on function public.revise_quote_tx(uuid, uuid, uuid, jsonb) to service_role;
```

- [ ] **Step 6: Run DB verification**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: all database tests pass, including `009_quote_lifecycle.test.sql`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202606300003_sales_orders_inventory_finance.sql supabase/migrations/202607010002_quote_reopen.sql supabase/tests/database/006_order_inventory_finance_schema.test.sql supabase/tests/database/009_quote_lifecycle.test.sql
git commit -m "feat: add quote lifecycle transactions"
```

---

## Task 3: Edge Function Quote API

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/use-cases/orders.ts`
- Modify: `supabase/functions/api/routes/orders.ts`
- Modify: `supabase/tests/functions/orders_test.ts`

- [ ] **Step 1: Extend contracts**

Add:

```ts
export interface QuoteSummaryData {
  id: string;
  code: string;
  order_type: "quote";
  status: "active" | "converted" | "cancelled";
  total_amount: number;
}

export interface QuoteReopenPayloadData {
  quote: {
    id: string;
    code: string;
    status: "active" | "converted" | "cancelled";
    source_quote_id: string;
    source_quote_code: string;
  };
  customer: {
    customer_id: string | null;
    snapshot: { code: string | null; name: string; phone: string | null };
    warnings: Array<{ code: "CUSTOMER_CHANGED"; message: string }>;
  };
  price_list: {
    price_list_id: string | null;
    snapshot: { code: string | null; name: string | null };
    warnings: Array<{ code: "PRICE_LIST_INACTIVE"; message: string }>;
  };
  items: Array<{
    order_item_id: string;
    product_id: string | null;
    product_snapshot: { code: string; name: string; unit_name: string; sell_method: SellMethod };
    quantity: number;
    width_m?: number | null;
    height_m?: number | null;
    linear_m?: number | null;
    unit_price: number;
    discount_amount: number;
    price_source: string;
    note: string | null;
    warnings: Array<{ code: "PRODUCT_INACTIVE" | "PRODUCT_MISSING" | "CURRENT_PRICE_DIFFERS"; message: string }>;
  }>;
  summary: { subtotal_amount: number; discount_amount: number; total_amount: number };
  note: string | null;
}
```

Add repository methods to `FoundationRepository`:

```ts
saveQuote(input: { organizationId: string; actorUserId: string; payload: Record<string, unknown> }): Promise<QuoteSummaryData>;
reviseQuote(input: { organizationId: string; actorUserId: string; quoteId: string; payload: Record<string, unknown> }): Promise<QuoteSummaryData>;
getQuoteReopenPayload(input: { organizationId: string; quoteId: string }): Promise<QuoteReopenPayloadData | null>;
```

- [ ] **Step 2: Add repository RPC calls**

Implement `saveQuote` and `reviseQuote` via RPC:

```ts
const { data, error } = await client.rpc("save_quote_tx", {
  p_actor_user_id: input.actorUserId,
  p_organization_id: input.organizationId,
  p_payload: input.payload,
});
```

For `getQuoteReopenPayload`, load the quote and its `order_items`, then load current products and prices for comparison. Return:

- `PRODUCT_MISSING` when `product_id` is null or no current product exists.
- `PRODUCT_INACTIVE` when current product status is not `active`.
- `CURRENT_PRICE_DIFFERS` when current default/customer-group resolved price differs from snapshot. If price cannot be resolved, skip the price warning and keep snapshot price.
- `PRICE_LIST_INACTIVE` on `price_list.warnings` when the snapshot price list is no longer active.
- `CUSTOMER_CHANGED` on `customer.warnings` when the current customer profile has materially diverged from the snapshot.

- [ ] **Step 3: Add use-case parsers**

In `orders.ts`, add:

```ts
export async function saveQuote(repository: FoundationRepository, context: OrderContext, body: unknown): Promise<QuoteSummaryData>
export async function reviseQuote(repository: FoundationRepository, context: OrderContext, quoteId: string, body: unknown): Promise<QuoteSummaryData>
export async function getQuoteReopenPayload(repository: FoundationRepository, context: OrderContext, quoteId: string): Promise<QuoteReopenPayloadData>
```

Validation rules:

- `perm.create_order` required.
- Payload must have non-empty `items`.
- Every line requires `product_id`, `quantity > 0`, `unit_price >= 0`, `discount_amount >= 0`, `discount_amount <= round(quantity * unit_price)`, and non-empty `price_source`.
- If payload has any line discount > 0, require `perm.apply_discount` using the same helper as checkout.
- `customer_snapshot` may be supplied; if absent, backend RPC will fall back to retail snapshot.

- [ ] **Step 4: Wire routes**

Add route handling:

```ts
if (url.pathname === "/api/v1/orders/quotes" && request.method === "POST") { ... }

const reopenMatch = url.pathname.match(/^\/api\/v1\/orders\/quotes\/([^/]+)\/reopen-payload$/);
if (reopenMatch !== null && request.method === "GET") { ... }

const revisionMatch = url.pathname.match(/^\/api\/v1\/orders\/quotes\/([^/]+)\/revisions$/);
if (revisionMatch !== null && request.method === "POST") { ... }
```

- [ ] **Step 5: Add function tests**

In `orders_test.ts`, add tests:

```ts
Deno.test("quote routes save and reopen active quote with create_order", async () => { ... });
Deno.test("quote revision creates new quote and cancels previous snapshot", async () => { ... });
Deno.test("checkout with source quote rejects converted quote conflict", async () => { ... });
Deno.test("checkout from quote maps unresolved inactive or missing lines to QUOTE_REOPEN_BLOCKED", async () => { ... });
Deno.test("quote save with discount requires apply_discount", async () => { ... });
```

Use repository fakes that assert payload and return deterministic objects.

- [ ] **Step 6: Run targeted function tests**

Run:

```bash
npx deno test supabase/tests/functions/orders_test.ts --allow-env --allow-net
npm run test:functions
npx deno check supabase/functions/api/index.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/api/contracts.ts supabase/functions/api/repositories/foundation-repository.ts supabase/functions/api/use-cases/orders.ts supabase/functions/api/routes/orders.ts supabase/tests/functions/orders_test.ts
git commit -m "feat: expose quote order api"
```

---

## Task 4: Sales Documents Quote List, Detail, And Reopen Action

**Files:**
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/tests/functions/sales_documents_test.ts`
- Modify: `src/features/sales-documents/types.ts`
- Modify: `src/features/sales-documents/sales-document-service.ts`
- Modify: `src/features/sales-documents/SalesDocumentsPage.tsx`
- Modify: `src/features/sales-documents/SalesDocumentsPage.test.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/features/pos/quote-draft-handoff.ts`

- [ ] **Step 1: Include quote source fields in repository data**

Update list/detail selects:

```ts
"id, code, order_type, status, source_quote_id, source_quote_code, customer_snapshot, subtotal_amount, discount_amount, total_amount, paid_amount, debt_amount, payment_status, note, created_by, created_at"
```

Map `source_quote_id` and `source_quote_code` into `SalesDocumentListItemData` and `SalesDocumentDetailData`.

- [ ] **Step 2: Add sales document function tests**

Add tests:

```ts
Deno.test("sales document list can filter quotes and exact BG search ignores date filters", async () => { ... });
Deno.test("sales document quote detail is readonly and has no stock or payment side effects", async () => { ... });
```

Expected response for quote rows:

```ts
{
  order_type: "quote",
  status: "active",
  payment_status: "not_applicable",
  paid_amount: 0,
  debt_amount: 0,
}
```

- [ ] **Step 3: Add frontend handoff helper**

Create `quote-draft-handoff.ts`:

```ts
import type { QuoteReopenPayload } from '../orders/types'

const key = 'qc_oms.quote_reopen_payload'

export function saveQuoteReopenPayload(payload: QuoteReopenPayload): void {
  window.sessionStorage.setItem(key, JSON.stringify(payload))
}

export function consumeQuoteReopenPayload(): QuoteReopenPayload | null {
  const raw = window.sessionStorage.getItem(key)
  if (raw === null) return null
  window.sessionStorage.removeItem(key)
  try {
    return JSON.parse(raw) as QuoteReopenPayload
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Extend Sales Documents service**

Add filters:

```ts
listSalesDocuments(input: { search?: string; type?: 'quote' | 'invoice'; status?: string })
```

Build query params for `type` and `status`.

- [ ] **Step 5: Update Sales Documents UI**

Add filter controls:

```tsx
<select aria-label="Loại chứng từ" value={typeFilter} onChange={...}>
  <option value="">Tất cả</option>
  <option value="invoice">Hóa đơn</option>
  <option value="quote">Báo giá</option>
</select>
<select aria-label="Trạng thái" value={statusFilter} onChange={...}>
  <option value="">Tất cả</option>
  <option value="active">active</option>
  <option value="converted">converted</option>
  <option value="completed">completed</option>
  <option value="cancelled">cancelled</option>
</select>
```

For active quote rows, show only:

```tsx
<button type="button" onClick={() => void reopenQuote(document.id)}>
  Mở tại POS
</button>
```

Do not add edit/cancel/print buttons.

- [ ] **Step 6: Wire router action**

In `router.tsx`, pass an `onOpenQuoteInPos` callback into `SalesDocumentsPage`:

```tsx
onOpenQuoteInPos={(payload) => {
  saveQuoteReopenPayload(payload)
  navigate('/pos')
}}
```

- [ ] **Step 7: Frontend tests**

Add tests:

```ts
it('filters quotes and exposes reopen only for active quote rows', async () => { ... })
it('stores reopen payload and calls navigation callback', async () => { ... })
it('does not show edit cancel or print actions for quote detail', async () => { ... })
```

- [ ] **Step 8: Run verification**

Run:

```bash
npx deno test supabase/tests/functions/sales_documents_test.ts --allow-env --allow-net
npx vitest run src/features/sales-documents/SalesDocumentsPage.test.tsx
npm run test:functions
npm test
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/api/repositories/foundation-repository.ts supabase/tests/functions/sales_documents_test.ts src/features/sales-documents src/features/pos/quote-draft-handoff.ts src/app/router.tsx
git commit -m "feat: show and reopen quotes from sales documents"
```

---

## Task 5: POS Save Quote, Reopen Draft, And Checkout Link

**Files:**
- Modify: `src/features/orders/types.ts`
- Modify: `src/features/orders/order-service.ts`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/CheckoutPanel.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Modify: `src/features/pos/CheckoutPanel.test.tsx`

- [ ] **Step 1: Add order service types**

Add:

```ts
export interface QuoteSummary {
  id: string
  code: string
  order_type: 'quote'
  status: 'active' | 'converted' | 'cancelled'
  total_amount: number
}

export interface QuoteReopenPayload {
  quote: {
    id: string
    code: string
    status: 'active' | 'converted' | 'cancelled'
    source_quote_id: string
    source_quote_code: string
  }
  customer: {
    customer_id: string | null
    snapshot: { code: string | null; name: string; phone: string | null }
    warnings: Array<{ code: 'CUSTOMER_CHANGED'; message: string }>
  }
  price_list: {
    price_list_id: string | null
    snapshot: { code: string | null; name: string | null }
    warnings: Array<{ code: 'PRICE_LIST_INACTIVE'; message: string }>
  }
  items: Array<{
    order_item_id: string
    product_id: string | null
    product_snapshot: { code: string; name: string; unit_name: string; sell_method: Product['sell_method'] }
    quantity: number
    width_m?: number | null
    height_m?: number | null
    linear_m?: number | null
    unit_price: number
    discount_amount: number
    price_source: string
    note: string | null
    warnings: Array<{ code: 'PRODUCT_INACTIVE' | 'PRODUCT_MISSING' | 'CURRENT_PRICE_DIFFERS'; message: string }>
  }>
  summary: { subtotal_amount: number; discount_amount: number; total_amount: number }
  note: string | null
}
```

Extend `CheckoutInput`:

```ts
source_quote_id?: string
```

- [ ] **Step 2: Add service methods**

In `order-service.ts`:

```ts
saveQuote: (input: CheckoutInput) =>
  api.request<QuoteSummary>('/api/v1/orders/quotes', { method: 'POST', body: JSON.stringify(input) }),
reviseQuote: (quoteId: string, input: CheckoutInput) =>
  api.request<QuoteSummary>(`/api/v1/orders/quotes/${quoteId}/revisions`, { method: 'POST', body: JSON.stringify(input) }),
getQuoteReopenPayload: (quoteId: string) =>
  api.request<QuoteReopenPayload>(`/api/v1/orders/quotes/${quoteId}/reopen-payload`),
```

- [ ] **Step 3: Consume quote reopen payload in POS**

In `PosShell`, on mount:

```ts
const payload = consumeQuoteReopenPayload()
if (payload !== null) {
  setSelectedCustomer(payload.customer.customer_id === null ? null : {
    id: payload.customer.customer_id,
    code: payload.customer.snapshot.code ?? '',
    name: payload.customer.snapshot.name,
    phone: payload.customer.snapshot.phone,
    customer_group_id: null,
    customer_group: null,
  })
  setSourceQuote({ id: payload.quote.source_quote_id, code: payload.quote.source_quote_code })
  setCartLines(payload.items.map((item, index) => ({
    id: `${payload.quote.source_quote_id}-${index + 1}`,
    product: {
      id: item.product_id ?? `missing-${item.order_item_id}`,
      code: item.product_snapshot.code,
      name: item.product_snapshot.name,
      status: item.warnings.some((warning) => warning.code === 'PRODUCT_INACTIVE' || warning.code === 'PRODUCT_MISSING') ? 'inactive' : 'active',
      unit_name: item.product_snapshot.unit_name,
      sell_method: item.product_snapshot.sell_method,
    },
    quantity: item.quantity,
    width_m: item.width_m ?? undefined,
    height_m: item.height_m ?? undefined,
    linear_m: item.linear_m ?? undefined,
    unitPrice: item.unit_price,
    discountAmount: item.discount_amount,
    priceSource: item.price_source,
    isManualPrice: true,
    note: item.note ?? undefined,
    quoteWarnings: item.warnings,
  })))
}
```

If `product_id` is null, mark the line as blocked and require replacement before checkout. Preserve `CURRENT_PRICE_DIFFERS`, `PRICE_LIST_INACTIVE`, and `CUSTOMER_CHANGED` as visible warnings only; they do not block checkout by themselves.

- [ ] **Step 4: Build shared payload helper**

Add a helper inside `PosShell.tsx`:

```ts
function buildCheckoutInput(input: {
  cartLines: CheckoutCartLine[]
  selectedCustomer: Customer | null
  sourceQuoteId?: string
  payment: CheckoutInput['payment']
  retailDebtNote?: string
}): CheckoutInput {
  return {
    source_quote_id: input.sourceQuoteId,
    customer_id: input.selectedCustomer?.id,
    retail_debt_note: input.retailDebtNote,
    items: input.cartLines.map((line) => ({
      product_id: line.product.id,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      discount_amount: line.discountAmount ?? 0,
      price_source: line.isManualPrice ? 'manual' : line.priceSource,
      note: line.note,
    })),
    payment: input.payment,
  }
}
```

Use this helper for checkout and quote save so payloads stay aligned.

- [ ] **Step 5: Add quote save action**

`CheckoutPanel` receives:

```ts
onSaveQuote(input: { note?: string }): Promise<QuoteSummary>
sourceQuote?: { id: string; code: string }
quoteBlockedReason?: string | null
```

Show:

```tsx
<button type="button" disabled={cartLines.length === 0 || Boolean(quoteBlockedReason)} onClick={...}>
  Báo giá
</button>
```

Behavior:

- If no `sourceQuote`, call `orderService.saveQuote`.
- If `sourceQuote` exists, call `orderService.reviseQuote(sourceQuote.id, payload)`.
- Show created quote code in the receipt/result area.

- [ ] **Step 6: Pass source quote through checkout**

When checkout succeeds from a source quote:

- Payload includes `source_quote_id`.
- Success message still shows `HD...`.
- Clear `sourceQuote` and cart lines after checkout.

- [ ] **Step 7: Block checkout for inactive/missing quote lines**

Compute:

```ts
const blockedQuoteLine = cartLines.find((line) =>
  line.product.status !== 'active' || line.product.id.startsWith('missing-')
)
```

Pass a message to `CheckoutPanel`:

```ts
Sản phẩm trong báo giá không còn khả dụng. Hãy thay thế dòng trước khi thanh toán.
```

Quote save revision may remain enabled only if every line has a real active `product_id`; otherwise disable both save quote and checkout.

- [ ] **Step 8: POS tests**

Add tests:

```ts
it('saves the current cart as a quote and shows BG code', async () => { ... })
it('reopened quote keeps snapshot unit price and discount while showing current price warning', async () => { ... })
it('checkout from reopened quote sends source_quote_id', async () => { ... })
it('blocks checkout when reopened quote has inactive or missing product warning', async () => { ... })
it('saving a reopened quote calls quote revisions endpoint', async () => { ... })
it('does not create a quote revision from a converted quote payload', async () => { ... })
```

- [ ] **Step 9: Run targeted frontend tests**

Run:

```bash
npx vitest run src/features/pos/PosShell.test.tsx src/features/pos/CheckoutPanel.test.tsx
npm test
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/features/orders src/features/pos
git commit -m "feat: save and reopen quotes in pos"
```

---

## Task 6: Full Verification, Cloud Migration, Deploy, And Smoke

**Files:**
- No source edits unless verification reveals a bug.

- [ ] **Step 1: Run full local verification**

Run:

```bash
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npx deno check supabase/functions/api/index.ts
npm run supabase:reset
npm run test:db
```

Expected:

- Vitest all frontend tests pass.
- Deno function tests pass.
- pgTAP database tests pass.
- Build exits 0. The existing Vite chunk-size warning is acceptable if unchanged.

- [ ] **Step 2: Push branch and open PR**

```bash
git status --short --branch
git push -u origin codex/phase-3a-quote-reopen
```

Create PR title:

```text
Implement Phase 3A quote reopen
```

PR body must mention:

- Quote save/list/detail/reopen.
- Quote revision `BG...01`.
- Checkout source quote link/conversion.
- No quote print/bill preview in Phase 3A.
- Verification commands run.

- [ ] **Step 3: Wait for CI**

Expected: GitHub checks all pass before merge.

- [ ] **Step 4: Merge PR and sync local main**

```bash
git switch main
git pull --ff-only origin main
```

- [ ] **Step 5: Push Cloud DB migration**

Run:

```bash
npx supabase db push --project-ref yentlbgbtmumilbzttge
```

Expected: migration `202607010002_quote_reopen.sql` applies cleanly or reports no pending changes if already applied.

- [ ] **Step 6: Deploy Edge Function**

Run:

```bash
npx supabase functions deploy api --project-ref yentlbgbtmumilbzttge --use-api
```

Expected: `message: "Deployed Functions."`

- [ ] **Step 7: Cloud smoke API**

Using an authenticated internal staff/admin session, smoke:

```http
POST https://yentlbgbtmumilbzttge.supabase.co/functions/v1/api/v1/orders/quotes
GET  https://yentlbgbtmumilbzttge.supabase.co/functions/v1/api/v1/sales-documents?type=quote&search=BG...
GET  https://yentlbgbtmumilbzttge.supabase.co/functions/v1/api/v1/sales-documents/{quote_id}
GET  https://yentlbgbtmumilbzttge.supabase.co/functions/v1/api/v1/orders/quotes/{quote_id}/reopen-payload
POST https://yentlbgbtmumilbzttge.supabase.co/functions/v1/api/v1/orders/checkout
```

Expected:

- Quote save returns `BG...`.
- Quote does not create stock movement, payment receipt, cashbook, or debt.
- Sales Documents can find the quote with exact `BG...`.
- Reopen payload returns snapshot price and `source_quote_id`.
- Checkout from quote returns `HD...`.
- Quote status becomes `converted`.
- Second checkout using the same quote returns a conflict/validation error.
- Checkout from an unresolved inactive/missing quote line returns `QUOTE_REOPEN_BLOCKED`.

- [ ] **Step 8: Cloud smoke UI**

In browser:

1. Open POS.
2. Add product.
3. Save quote with `[Báo giá]`.
4. Open Sales Documents.
5. Filter `Báo giá`.
6. Open quote detail.
7. Click `Mở tại POS`.
8. Confirm POS cart uses snapshot price.
9. Checkout.
10. Return to Sales Documents and confirm quote is `converted` and invoice shows source quote link/code.

- [ ] **Step 9: Update checklist**

After merge/smoke, update `docs/PHASE-CHECKLIST.md`:

```markdown
## Phase 3A — Quote reopen

Status: ✅ Hoàn thành, đã merge vào `main`, cloud staging smoke PASS

- [x] Save quote `BG...`
- [x] Quote list/detail in Sales Documents
- [x] Reopen quote into POS local draft
- [x] Quote revision `BG...01`
- [x] Checkout from quote links `source_quote_id/source_quote_code`
- [x] Converted quote cannot checkout again
- [x] No quote print/bill preview in Phase 3A
```

Commit:

```bash
git add docs/PHASE-CHECKLIST.md
git commit -m "docs: mark phase 3a quote reopen complete"
```

---

## Self-Review

Spec coverage:

- Save quote `BG...`: Task 2, Task 3, Task 5.
- List/detail quote: Task 4.
- Reopen into POS local draft: Task 4 and Task 5 via session storage handoff.
- Checkout to invoice with source quote link and conversion: Task 2, Task 3, Task 5.
- Quote revision no overwrite: Task 2, Task 3, Task 5.
- No print/bill preview: Task 4 asserts no print action.
- No quote side effects on stock/cash/debt/revenue: Task 1 and Task 6 smoke.
- Converted quote cannot checkout again: Task 1 and Task 6 smoke.

Placeholder scan:

- No implementation step uses "TBD" or unspecified "add tests" without naming the tests and expected behavior.

Type consistency:

- `QuoteReopenPayloadData` backend maps to `QuoteReopenPayload` frontend.
- `source_quote_id` is accepted in `CheckoutInput` and passed through to the backend checkout RPC.
- Quote statuses are limited to `active`, `converted`, `cancelled`; invoice statuses remain `completed`, `cancelled`.
