# Phase 2B Production Queue Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production queue foundation for POS K02-D so machine events can appear in POS, be claimed atomically, and be added to the local draft cart without creating orders, stock movements, cashbook entries, or debt.

**Architecture:** Add a small `production_queue_items` table with status/history fields and RPC-style repository methods for atomic claim. Expose `/api/v1/production-queue` routes through the existing Edge Function API and add a POS service/panel that consumes normalized `add-to-draft` payloads. Keep POS draft state local in `PosShell`; queue events never call checkout or inventory mutation paths.

**Tech Stack:** Supabase SQL migrations + pgTAP, Deno Edge Functions, TypeScript React/Vite, Vitest, Playwright.

---

## Source Of Truth Inputs

- `docs/superpowers/specs/2026-07-01-production-queue-contract-draft.md`
- `docs/02-PRD-UX-PhongCanh/POS/K02/04-K02D-HANG-DOI.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/PRODUCTION-RECONCILIATION.md`
- `docs/04-DATABASE/Sales/POS-TABLES.md`
- Handoff commits: `9a5bf2b`, `5a7bc20`, `16acc83`

## Scope Guard

- Use **máy sản xuất** and `production_queue`, not `máy trạm` or `workstation_queue`, for K02-D file/event flow.
- `[+]` only adds a normalized line to the local POS draft cart.
- Do not create `orders`, `order_items`, `stock_movements`, payment receipts, debt, or cashbook entries from production queue actions.
- Do not implement production work orders, automatic bill matching, automatic Zalo/bill messaging, Purchase/Supplier, HR, BOM deduction, or tax/e-invoice scope in this phase.
- Do not implement HR/payroll/timesheet/commission/time-clock/Zalo mini app. A future sales-by-seller report must not imply payroll or commission logic.
- Do not add channel, online marketplace, loyalty, retail campaign/promotion, VAT, or tax declaration surfaces to MVP. Future quantity-tier pricing belongs in PriceBook, not this queue phase.
- Use `perm.create_order` for cashier queue actions. Machine event ingestion is service-side and must not require a POS user token.

---

## File Structure

- Create `supabase/migrations/202607010001_production_queue.sql` for queue schema, indexes, constraints, and atomic helper functions.
- Create `supabase/tests/database/008_production_queue.test.sql` for pgTAP schema and atomic claim checks.
- Modify `supabase/functions/api/contracts.ts` to add production queue DTOs and repository methods.
- Create `supabase/functions/api/use-cases/production-queue.ts` for input validation and permission checks.
- Create `supabase/functions/api/routes/production-queue.ts` for HTTP routing.
- Modify `supabase/functions/api/routes/router.ts` to dispatch `/api/v1/production-queue`.
- Modify `supabase/functions/api/repositories/foundation-repository.ts` to implement cloud repository methods.
- Create `supabase/tests/functions/production_queue_test.ts` for route/use-case tests.
- Create `src/features/production-queue/types.ts` and `src/features/production-queue/production-queue-service.ts` for frontend API types/service.
- Create `src/features/pos/ProductionQueuePanel.tsx` and `src/features/pos/ProductionQueuePanel.test.tsx`.
- Modify `src/features/pos/PosShell.tsx` and `src/features/pos/PosShell.test.tsx` to render K02-D and add queue payloads to the cart.
- Modify `src/styles/index.css` for compact K02-D layout.
- Modify `tests/e2e/auth-pos.spec.ts` to smoke a seeded/simulated queue item after API support exists.
- Modify `docs/PHASE-CHECKLIST.md` to mark Phase 2A merged and Phase 2B status.

---

### Task 1: Database Production Queue Foundation

**Files:**
- Create: `supabase/migrations/202607010001_production_queue.sql`
- Create: `supabase/tests/database/008_production_queue.test.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the failing pgTAP schema test**

Create `supabase/tests/database/008_production_queue.test.sql`:

```sql
begin;

select plan(34);

select has_table('public', 'production_machines', 'production_machines');
select has_column('public', 'production_machines', 'organization_id', 'production_machines.organization_id');
select has_column('public', 'production_machines', 'code', 'production_machines.code');
select has_column('public', 'production_machines', 'name', 'production_machines.name');
select has_column('public', 'production_machines', 'status', 'production_machines.status');
select has_column('public', 'production_machines', 'default_product_id', 'production_machines.default_product_id');
select has_index('public', 'production_machines', 'production_machines_org_code_key', 'production_machines org/code unique');

select has_table('public', 'production_queue_items', 'production_queue_items');
select has_column('public', 'production_queue_items', 'organization_id', 'production_queue_items.organization_id');
select has_column('public', 'production_queue_items', 'production_machine_id', 'production_queue_items.production_machine_id');
select has_column('public', 'production_queue_items', 'source', 'production_queue_items.source');
select has_column('public', 'production_queue_items', 'raw_file_name', 'production_queue_items.raw_file_name');
select has_column('public', 'production_queue_items', 'status', 'production_queue_items.status');
select has_column('public', 'production_queue_items', 'parse_status', 'production_queue_items.parse_status');
select has_column('public', 'production_queue_items', 'parsed_payload', 'production_queue_items.parsed_payload');
select has_column('public', 'production_queue_items', 'claimed_by', 'production_queue_items.claimed_by');
select has_column('public', 'production_queue_items', 'claimed_at', 'production_queue_items.claimed_at');
select has_column('public', 'production_queue_items', 'handled_at', 'production_queue_items.handled_at');
select has_index('public', 'production_queue_items', 'idx_production_queue_items_org_status_received', 'queue status index');
select has_index('public', 'production_queue_items', 'idx_production_queue_items_machine_status', 'queue machine/status index');

select has_table('public', 'production_queue_events', 'production_queue_events');
select has_column('public', 'production_queue_events', 'organization_id', 'production_queue_events.organization_id');
select has_column('public', 'production_queue_events', 'queue_item_id', 'production_queue_events.queue_item_id');
select has_column('public', 'production_queue_events', 'event_type', 'production_queue_events.event_type');
select has_column('public', 'production_queue_events', 'actor_user_id', 'production_queue_events.actor_user_id');
select has_column('public', 'production_queue_events', 'created_at', 'production_queue_events.created_at');
select has_index('public', 'production_queue_events', 'idx_production_queue_events_item_time', 'queue event history index');

select has_function('public', 'claim_production_queue_item_tx', array['uuid', 'uuid', 'uuid', 'text'], 'claim function exists');
select has_function('public', 'restore_production_queue_item_tx', array['uuid', 'uuid', 'uuid'], 'restore function exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('80000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'operator@example.test', 'test', now(), now(), now());

insert into public.profiles (user_id, organization_id, display_name, status)
values (
  '80000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Operator',
  'active'
);

insert into public.production_machines (id, organization_id, code, name, status, default_product_id)
values (
  '80000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'IN-BAT',
  'In bạt',
  'active',
  '00000000-0000-4000-8000-000000000302'
);

insert into public.production_queue_items (
  id,
  organization_id,
  production_machine_id,
  source,
  raw_file_name,
  status,
  parse_status,
  parsed_payload
)
values (
  '80000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000101',
  'manual_simulator',
  'KH000001_DECAL-PP_120x50_x2',
  'queued',
  'ok',
  '{"customer_code":"KH000001","product_code":"DECAL-PP","width_cm":120,"height_cm":50,"quantity":2}'::jsonb
);

select results_eq(
  $$
    select status
    from public.claim_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001',
      'added_to_draft'
    )
  $$,
  $$ values ('added_to_draft'::text) $$,
  'claim moves queued item to added_to_draft'
);

select is(
  (
    select count(*)::integer
    from public.claim_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001',
      'dismissed'
    )
  ),
  0,
  'second claim returns no row'
);

select is(
  (
    select count(*)::integer
    from public.production_queue_events
    where queue_item_id = '80000000-0000-4000-8000-000000000201'
      and event_type = 'added_to_draft'
  ),
  1,
  'claim writes history event'
);

select results_eq(
  $$
    select status
    from public.restore_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001'
    )
  $$,
  $$ values ('queued'::text) $$,
  'restore returns item to queued'
);

select is(
  (
    select count(*)::integer
    from public.production_queue_events
    where queue_item_id = '80000000-0000-4000-8000-000000000201'
      and event_type = 'restored'
  ),
  1,
  'restore writes history event'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails before migration**

Run:

```bash
npm run test:db
```

Expected: FAIL on `008_production_queue.test.sql` because `production_machines`, `production_queue_items`, `production_queue_events`, and claim functions do not exist.

- [ ] **Step 3: Add production queue migration**

Create `supabase/migrations/202607010001_production_queue.sql`:

```sql
create table public.production_machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active',
  default_product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_machines_org_code_key unique (organization_id, code),
  constraint production_machines_id_org_key unique (id, organization_id),
  constraint production_machines_code_check check (code = upper(code) and code ~ '^[A-Z0-9-]+$'),
  constraint production_machines_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint production_machines_status_check check (status in ('active', 'inactive')),
  constraint production_machines_default_product_org_fkey foreign key (default_product_id, organization_id)
    references public.products(id, organization_id) on delete restrict
);

create index idx_production_machines_org_status on public.production_machines (organization_id, status, code);

create table public.production_queue_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  production_machine_id uuid not null,
  source text not null,
  raw_file_name text not null,
  received_at timestamptz not null default now(),
  status text not null default 'queued',
  parse_status text not null default 'pending',
  parse_error text,
  parsed_payload jsonb not null default '{}'::jsonb,
  claimed_by uuid references public.profiles(user_id) on delete restrict,
  claimed_at timestamptz,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_queue_items_machine_org_fkey foreign key (production_machine_id, organization_id)
    references public.production_machines(id, organization_id) on delete restrict,
  constraint production_queue_items_source_check check (source in ('legacy_bridge', 'production_agent', 'manual_simulator')),
  constraint production_queue_items_status_check check (status in ('queued', 'added_to_draft', 'dismissed')),
  constraint production_queue_items_parse_status_check check (parse_status in ('pending', 'ok', 'error')),
  constraint production_queue_items_raw_name_check check (char_length(btrim(raw_file_name)) between 1 and 255),
  constraint production_queue_items_payload_object_check check (jsonb_typeof(parsed_payload) = 'object'),
  constraint production_queue_items_claim_state_check check (
    (status = 'queued' and claimed_by is null and claimed_at is null and handled_at is null)
    or (status in ('added_to_draft', 'dismissed') and claimed_by is not null and claimed_at is not null and handled_at is not null)
  )
);

create index idx_production_queue_items_org_status_received
  on public.production_queue_items (organization_id, status, received_at desc);
create index idx_production_queue_items_machine_status
  on public.production_queue_items (organization_id, production_machine_id, status, received_at desc);

create table public.production_queue_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  queue_item_id uuid not null,
  event_type text not null,
  actor_user_id uuid references public.profiles(user_id) on delete restrict,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint production_queue_events_item_org_fkey foreign key (queue_item_id, organization_id)
    references public.production_queue_items(id, organization_id) on delete cascade,
  constraint production_queue_events_type_check check (event_type in ('queued', 'added_to_draft', 'dismissed', 'restored')),
  constraint production_queue_events_payload_object_check check (jsonb_typeof(event_payload) = 'object')
);

create index idx_production_queue_events_item_time
  on public.production_queue_events (organization_id, queue_item_id, created_at desc);
create index idx_production_queue_events_org_time
  on public.production_queue_events (organization_id, created_at desc);

create or replace function public.claim_production_queue_item_tx(
  p_organization_id uuid,
  p_queue_item_id uuid,
  p_actor_user_id uuid,
  p_target_status text
)
returns table (
  id uuid,
  organization_id uuid,
  production_machine_id uuid,
  source text,
  raw_file_name text,
  received_at timestamptz,
  status text,
  parse_status text,
  parse_error text,
  parsed_payload jsonb,
  claimed_by uuid,
  claimed_at timestamptz,
  handled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_status not in ('added_to_draft', 'dismissed') then
    raise exception 'Invalid target status'
      using errcode = '22023';
  end if;

  return query
  with updated as (
    update public.production_queue_items pqi
    set status = p_target_status,
        claimed_by = p_actor_user_id,
        claimed_at = now(),
        handled_at = now(),
        updated_at = now()
    where pqi.organization_id = p_organization_id
      and pqi.id = p_queue_item_id
      and pqi.status = 'queued'
    returning pqi.*
  ),
  event_insert as (
    insert into public.production_queue_events (
      organization_id,
      queue_item_id,
      event_type,
      actor_user_id
    )
    select organization_id, id, p_target_status, p_actor_user_id
    from updated
    returning 1
  )
  select
    updated.id,
    updated.organization_id,
    updated.production_machine_id,
    updated.source,
    updated.raw_file_name,
    updated.received_at,
    updated.status,
    updated.parse_status,
    updated.parse_error,
    updated.parsed_payload,
    updated.claimed_by,
    updated.claimed_at,
    updated.handled_at
  from updated;
end;
$$;

create or replace function public.restore_production_queue_item_tx(
  p_organization_id uuid,
  p_queue_item_id uuid,
  p_actor_user_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  production_machine_id uuid,
  source text,
  raw_file_name text,
  received_at timestamptz,
  status text,
  parse_status text,
  parse_error text,
  parsed_payload jsonb,
  claimed_by uuid,
  claimed_at timestamptz,
  handled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with updated as (
    update public.production_queue_items pqi
    set status = 'queued',
        claimed_by = null,
        claimed_at = null,
        handled_at = null,
        updated_at = now()
    where pqi.organization_id = p_organization_id
      and pqi.id = p_queue_item_id
      and pqi.status in ('added_to_draft', 'dismissed')
    returning pqi.*
  ),
  event_insert as (
    insert into public.production_queue_events (
      organization_id,
      queue_item_id,
      event_type,
      actor_user_id
    )
    select organization_id, id, 'restored', p_actor_user_id
    from updated
    returning 1
  )
  select
    updated.id,
    updated.organization_id,
    updated.production_machine_id,
    updated.source,
    updated.raw_file_name,
    updated.received_at,
    updated.status,
    updated.parse_status,
    updated.parse_error,
    updated.parsed_payload,
    updated.claimed_by,
    updated.claimed_at,
    updated.handled_at
  from updated;
end;
$$;
```

- [ ] **Step 4: Seed default production machines and one queue item**

Append to `supabase/seed.sql` after product and inventory seed data:

```sql
insert into public.production_machines (id, organization_id, code, name, status, default_product_id)
values
  (
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000000001',
    'IN-BAT',
    'In bạt',
    'active',
    '00000000-0000-4000-8000-000000000302'
  ),
  (
    '00000000-0000-4000-8000-000000001102',
    '00000000-0000-4000-8000-000000000001',
    'IN-DECAL',
    'In decal',
    'active',
    '00000000-0000-4000-8000-000000000302'
  ),
  (
    '00000000-0000-4000-8000-000000001103',
    '00000000-0000-4000-8000-000000000001',
    'CNC',
    'Cắt CNC',
    'active',
    '00000000-0000-4000-8000-000000000301'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    code = excluded.code,
    name = excluded.name,
    status = excluded.status,
    default_product_id = excluded.default_product_id;

insert into public.production_queue_items (
  id,
  organization_id,
  production_machine_id,
  source,
  raw_file_name,
  status,
  parse_status,
  parsed_payload
)
values (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000001102',
  'manual_simulator',
  'KH000001_DECAL-PP_120x50_x2',
  'queued',
  'ok',
  '{"customer_code":"KH000001","product_code":"DECAL-PP","width_cm":120,"height_cm":50,"quantity":2}'::jsonb
)
on conflict (id) do update
set production_machine_id = excluded.production_machine_id,
    source = excluded.source,
    raw_file_name = excluded.raw_file_name,
    status = excluded.status,
    parse_status = excluded.parse_status,
    parsed_payload = excluded.parsed_payload,
    claimed_by = null,
    claimed_at = null,
    handled_at = null;
```

- [ ] **Step 5: Run database verification**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: PASS including `008_production_queue.test.sql`.

- [ ] **Step 6: Commit database foundation**

```bash
git add supabase/migrations/202607010001_production_queue.sql supabase/tests/database/008_production_queue.test.sql supabase/seed.sql
git commit -m "feat: add production queue database foundation"
```

---

### Task 2: Edge Function Production Queue API

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Create: `supabase/functions/api/use-cases/production-queue.ts`
- Create: `supabase/functions/api/routes/production-queue.ts`
- Modify: `supabase/functions/api/routes/router.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/tests/functions/production_queue_test.ts`

- [ ] **Step 1: Write failing function route tests**

Create `supabase/tests/functions/production_queue_test.ts` with tests for:

```ts
Deno.test("production queue requires create_order permission for cashier actions", async () => {
  const response = await call("/api/v1/production-queue", { method: "GET" }, repo([]));
  assertEquals(response.status, 403);
});

Deno.test("production queue lists queued items grouped by machine context", async () => {
  const response = await call("/api/v1/production-queue", { method: "GET" }, repo(["perm.create_order"], {
    listProductionQueue: () => Promise.resolve({
      items: [{
        id: "queue-1",
        production_machine: { id: "machine-1", code: "IN-DECAL", name: "In decal" },
        raw_file_name: "KH000001_DECAL-PP_120x50_x2",
        received_at: "2026-07-01T10:30:00Z",
        status: "queued",
        parse_status: "ok",
        parse_error: null,
        parsed: { customer_code: "KH000001", product_code: "DECAL-PP", width_cm: 120, height_cm: 50, quantity: 2 },
      }],
    }),
  }));
  const data = (await body(response)).data as { items: unknown[] };
  assertEquals(response.status, 200);
  assertEquals(data.items.length, 1);
});

Deno.test("add to draft returns normalized local draft payload", async () => {
  const response = await call("/api/v1/production-queue/queue-1/add-to-draft", { method: "POST" }, repo(["perm.create_order"], {
    addProductionQueueItemToDraft: () => Promise.resolve({
      queue_item_id: "queue-1",
      customer: { id: "customer-1", code: "KH000001", name: "Khách lẻ" },
      draft_line: {
        product_id: "product-1",
        product_code: "DECAL-PP",
        product_name: "Decal PP",
        unit_name: "m²",
        sell_method: "area_m2",
        width_m: 1.2,
        height_m: 0.5,
        quantity: 2,
        source: "production_queue",
      },
    }),
  }));
  assertEquals(response.status, 200);
});

Deno.test("add to draft maps already handled queue item to resource conflict", async () => {
  const response = await call("/api/v1/production-queue/queue-1/add-to-draft", { method: "POST" }, repo(["perm.create_order"], {
    addProductionQueueItemToDraft: () => Promise.resolve(null),
  }));
  assertEquals(response.status, 409);
});
```

Use the helper style from `supabase/tests/functions/orders_test.ts`: `createApp`, fake auth, fake current user, and a `repo()` object cast as `FoundationRepository`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:functions
```

Expected: FAIL because route and repository methods are not defined.

- [ ] **Step 3: Add contracts**

In `supabase/functions/api/contracts.ts`, add:

```ts
export interface ProductionQueueItemData {
  id: string;
  production_machine: { id: string; code: string; name: string };
  raw_file_name: string;
  received_at: string;
  status: "queued" | "added_to_draft" | "dismissed";
  parse_status: "pending" | "ok" | "error";
  parse_error: string | null;
  parsed: {
    customer_code?: string;
    product_code?: string;
    width_cm?: number;
    height_cm?: number;
    quantity?: number;
  };
}

export interface ProductionQueueListData {
  items: ProductionQueueItemData[];
}

export interface ProductionQueueHistoryData {
  items: ProductionQueueItemData[];
}

export interface ProductionQueueDraftPayloadData {
  queue_item_id: string;
  customer: { id: string; code: string; name: string };
  draft_line: {
    product_id: string;
    product_code: string;
    product_name: string;
    unit_name: string;
    sell_method: SellMethod;
    width_m: number;
    height_m: number;
    quantity: number;
    source: "production_queue";
  };
}
```

Extend `FoundationRepository`:

```ts
listProductionQueue(input: {
  organizationId: string;
  machineCode?: string;
  status?: "queued" | "added_to_draft" | "dismissed";
}): Promise<ProductionQueueListData>;
listProductionQueueHistory(input: {
  organizationId: string;
  machineCode?: string;
  days: number;
}): Promise<ProductionQueueHistoryData>;
addProductionQueueItemToDraft(input: {
  organizationId: string;
  actorUserId: string;
  queueItemId: string;
}): Promise<ProductionQueueDraftPayloadData | null>;
dismissProductionQueueItem(input: {
  organizationId: string;
  actorUserId: string;
  queueItemId: string;
}): Promise<ProductionQueueItemData | null>;
restoreProductionQueueItem(input: {
  organizationId: string;
  actorUserId: string;
  queueItemId: string;
}): Promise<ProductionQueueItemData | null>;
```

- [ ] **Step 4: Add use-case validation and permission checks**

Create `supabase/functions/api/use-cases/production-queue.ts` with:

```ts
import type { FoundationRepository, PermissionCode, ProductionQueueDraftPayloadData, ProductionQueueHistoryData, ProductionQueueItemData, ProductionQueueListData } from "../contracts.ts";
import { ApiError } from "../http.ts";

interface QueueContext {
  actorUserId: string;
  organizationId: string;
  permissions: ReadonlySet<PermissionCode>;
}

export async function listProductionQueue(repository: FoundationRepository, context: QueueContext, url: URL): Promise<ProductionQueueListData> {
  requireCreateOrder(context);
  const machineCode = url.searchParams.get("machine_code")?.trim() || undefined;
  const rawStatus = url.searchParams.get("status")?.trim() || "queued";
  const status = parseStatus(rawStatus);
  return await repository.listProductionQueue({ organizationId: context.organizationId, machineCode, status });
}

export async function listProductionQueueHistory(repository: FoundationRepository, context: QueueContext, url: URL): Promise<ProductionQueueHistoryData> {
  requireCreateOrder(context);
  const machineCode = url.searchParams.get("machine_code")?.trim() || undefined;
  return await repository.listProductionQueueHistory({ organizationId: context.organizationId, machineCode, days: 10 });
}

export async function addProductionQueueItemToDraft(repository: FoundationRepository, context: QueueContext, queueItemId: string): Promise<ProductionQueueDraftPayloadData> {
  requireCreateOrder(context);
  const result = await repository.addProductionQueueItemToDraft({ organizationId: context.organizationId, actorUserId: context.actorUserId, queueItemId });
  if (result === null) throw alreadyHandled();
  return result;
}

export async function dismissProductionQueueItem(repository: FoundationRepository, context: QueueContext, queueItemId: string): Promise<ProductionQueueItemData> {
  requireCreateOrder(context);
  const result = await repository.dismissProductionQueueItem({ organizationId: context.organizationId, actorUserId: context.actorUserId, queueItemId });
  if (result === null) throw alreadyHandled();
  return result;
}

export async function restoreProductionQueueItem(repository: FoundationRepository, context: QueueContext, queueItemId: string): Promise<ProductionQueueItemData> {
  requireCreateOrder(context);
  const result = await repository.restoreProductionQueueItem({ organizationId: context.organizationId, actorUserId: context.actorUserId, queueItemId });
  if (result === null) throw alreadyHandled();
  return result;
}

function requireCreateOrder(context: QueueContext): void {
  if (!context.permissions.has("perm.create_order")) {
    throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}

function parseStatus(value: string): "queued" | "added_to_draft" | "dismissed" {
  if (value === "queued" || value === "added_to_draft" || value === "dismissed") return value;
  throw new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function alreadyHandled(): ApiError {
  return new ApiError({
    status: 409,
    code: "RESOURCE_CONFLICT",
    message: "Thông báo đã được xử lý bởi máy khác.",
  });
}
```

- [ ] **Step 5: Add route dispatch**

Create `supabase/functions/api/routes/production-queue.ts` following `orders.ts` authentication style. Match:

```ts
GET /api/v1/production-queue
GET /api/v1/production-queue/history
POST /api/v1/production-queue/{id}/add-to-draft
POST /api/v1/production-queue/{id}/dismiss
POST /api/v1/production-queue/{id}/restore
```

Modify `router.ts`:

```ts
if (url.pathname === "/api/v1/production-queue" || url.pathname === "/api/v1/production-queue/history" || url.pathname.startsWith("/api/v1/production-queue/")) {
  if (options.auth === undefined || options.repository === undefined) {
    throw new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
  }
  return handleProductionQueue(request, traceId, { auth: options.auth, repository: options.repository });
}
```

- [ ] **Step 6: Implement repository methods**

In `foundation-repository.ts`, implement:

- `listProductionQueue`: select queue rows joined to `production_machines`, filter org/status/machine code, order `received_at desc`.
- `listProductionQueueHistory`: select `added_to_draft` and `dismissed` rows from the last 10 days, optionally filtered by machine.
- `addProductionQueueItemToDraft`: call `claim_production_queue_item_tx(..., "added_to_draft")`, then resolve customer/product from `parsed_payload.customer_code` and `parsed_payload.product_code`. Convert cm to m.
- `dismissProductionQueueItem`: call `claim_production_queue_item_tx(..., "dismissed")`.
- `restoreProductionQueueItem`: call `restore_production_queue_item_tx`.

If customer or product cannot be resolved in `addProductionQueueItemToDraft`, throw `VALIDATION_ERROR` with message `Thông báo máy sản xuất chưa đủ dữ liệu để thêm vào hóa đơn nháp.`.

- [ ] **Step 7: Run function verification**

Run:

```bash
npm run test:functions
npx deno check supabase/functions/api/index.ts
```

Expected: PASS.

- [ ] **Step 8: Commit API foundation**

```bash
git add supabase/functions/api supabase/tests/functions/production_queue_test.ts
git commit -m "feat: add production queue api"
```

---

### Task 3: POS K02-D Production Queue Panel

**Files:**
- Create: `src/features/production-queue/types.ts`
- Create: `src/features/production-queue/production-queue-service.ts`
- Create: `src/features/pos/ProductionQueuePanel.tsx`
- Create: `src/features/pos/ProductionQueuePanel.test.tsx`
- Modify: `src/features/pos/PosShell.tsx`
- Modify: `src/features/pos/PosShell.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write failing component tests**

Create `src/features/pos/ProductionQueuePanel.test.tsx` with tests:

```tsx
it('lists queued production machine files and dismisses one', async () => {
  const service = makeProductionQueueService()
  render(<ProductionQueuePanel service={service} onAddToDraft={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /In decal/ }))
  expect(await screen.findByText('KH000001_DECAL-PP_120x50_x2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bỏ thông báo KH000001_DECAL-PP_120x50_x2' }))
  expect(service.dismiss).toHaveBeenCalledWith('queue-1')
})

it('adds a queue item to the POS draft', async () => {
  const onAddToDraft = vi.fn()
  render(<ProductionQueuePanel service={makeProductionQueueService()} onAddToDraft={onAddToDraft} />)
  await userEvent.click(await screen.findByRole('button', { name: /In decal/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Thêm vào hóa đơn nháp KH000001_DECAL-PP_120x50_x2' }))
  expect(onAddToDraft).toHaveBeenCalledWith(expect.objectContaining({ queue_item_id: 'queue-1' }))
})
```

Use lucide icons if already installed; if not, keep text labels with accessible names and compact styling.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/features/pos/ProductionQueuePanel.test.tsx
```

Expected: FAIL because component/service do not exist.

- [ ] **Step 3: Add frontend production queue service**

Create `src/features/production-queue/types.ts` mirroring API DTOs:

```ts
export interface ProductionQueueItem {
  id: string
  production_machine: { id: string; code: string; name: string }
  raw_file_name: string
  received_at: string
  status: 'queued' | 'added_to_draft' | 'dismissed'
  parse_status: 'pending' | 'ok' | 'error'
  parse_error: string | null
  parsed: { customer_code?: string; product_code?: string; width_cm?: number; height_cm?: number; quantity?: number }
}

export interface ProductionQueueDraftPayload {
  queue_item_id: string
  customer: { id: string; code: string; name: string }
  draft_line: {
    product_id: string
    product_code: string
    product_name: string
    unit_name: string
    sell_method: 'quantity' | 'area_m2' | 'linear_m' | 'sheet' | 'combo'
    width_m: number
    height_m: number
    quantity: number
    source: 'production_queue'
  }
}
```

Create `production-queue-service.ts`:

```ts
import { createApiClient } from '../../lib/api/client'
import type { ProductionQueueDraftPayload, ProductionQueueItem } from './types'

export interface ProductionQueueService {
  list(): Promise<{ items: ProductionQueueItem[] }>
  history(machineCode?: string): Promise<{ items: ProductionQueueItem[] }>
  addToDraft(id: string): Promise<ProductionQueueDraftPayload>
  dismiss(id: string): Promise<ProductionQueueItem>
  restore(id: string): Promise<ProductionQueueItem>
}

export function createProductionQueueService(api: { request<T>(path: string, init?: RequestInit): Promise<T> }): ProductionQueueService {
  return {
    list: () => api.request('/api/v1/production-queue'),
    history: (machineCode?: string) => api.request(`/api/v1/production-queue/history${machineCode ? `?machine_code=${encodeURIComponent(machineCode)}` : ''}`),
    addToDraft: (id: string) => api.request(`/api/v1/production-queue/${id}/add-to-draft`, { method: 'POST' }),
    dismiss: (id: string) => api.request(`/api/v1/production-queue/${id}/dismiss`, { method: 'POST' }),
    restore: (id: string) => api.request(`/api/v1/production-queue/${id}/restore`, { method: 'POST' }),
  }
}

export function createBrowserProductionQueueService(getAccessToken: () => Promise<string | null>) {
  return createProductionQueueService(createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '', getAccessToken }))
}
```

- [ ] **Step 4: Add `ProductionQueuePanel`**

Implement a compact bottom panel:

- Buttons for machine blocks from loaded items: `In bạt`, `In decal`, `Cắt CNC`.
- Badge count for queued items per machine.
- Click machine opens a small list.
- `[+]` calls `service.addToDraft(id)` and passes payload to `onAddToDraft`.
- `[Bỏ]` calls `service.dismiss(id)`.
- Keep list open after action and refresh list.
- Show `Không còn thông báo` when active machine has no rows.

- [ ] **Step 5: Wire panel into `PosShell`**

Modify `PosShell` props:

```ts
productionQueueService?: ProductionQueueService
```

When `onAddToDraft(payload)` fires:

```ts
setSelectedCustomer({
  id: payload.customer.id,
  code: payload.customer.code,
  name: payload.customer.name,
  phone: null,
  customer_group_id: null,
  customer_group: null,
})
setCartLines((current) => [
  ...current,
  {
    id: `${payload.queue_item_id}-${current.length + 1}`,
    product: {
      id: payload.draft_line.product_id,
      code: payload.draft_line.product_code,
      name: payload.draft_line.product_name,
      status: 'active',
      unit_name: payload.draft_line.unit_name,
      sell_method: payload.draft_line.sell_method,
    },
    quantity: payload.draft_line.quantity,
    unitPrice: prices[payload.draft_line.product_id]?.unit_price ?? 0,
    priceSource: prices[payload.draft_line.product_id]?.price_source ?? 'default_price_list',
    isManualPrice: false,
  },
])
```

Keep width/height display out of checkout payload until order item dimension fields are wired in a later POS calculation slice. The queue response still carries `width_m` and `height_m`; this phase only proves safe draft ingestion and no server-side checkout side effects.

- [ ] **Step 6: Wire browser service in router**

Modify `src/app/router.tsx` in `PosRoute`:

```ts
const productionQueueService = useMemo(() => createBrowserProductionQueueService(getAccessToken), [getAccessToken])
```

Pass it to `PosShell`.

- [ ] **Step 7: Add styles**

Add compact CSS classes:

```css
.production-queue {
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  padding-top: 10px;
}

.production-queue__machine {
  min-width: 120px;
}

.production-queue__list {
  max-height: 220px;
  overflow: auto;
}
```

Adapt to existing CSS variables/classes; do not create a card-inside-card layout.

- [ ] **Step 8: Run frontend tests**

```bash
npm test -- src/features/pos/ProductionQueuePanel.test.tsx src/features/pos/PosShell.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit POS panel**

```bash
git add src/features/production-queue src/features/pos src/app/router.tsx src/styles/index.css
git commit -m "feat: add production queue pos panel"
```

---

### Task 4: End-To-End Cloud Smoke And Checklist

**Files:**
- Modify: `tests/e2e/auth-pos.spec.ts`
- Modify: `docs/PHASE-CHECKLIST.md`

- [ ] **Step 1: Add E2E queue smoke**

Extend `tests/e2e/auth-pos.spec.ts` with a small check after opening POS:

```ts
await expect(page.getByLabel("K02-D hàng đợi máy sản xuất")).toBeVisible();
await page.getByRole("button", { name: /In decal/ }).click();
await expect(page.getByText("KH000001_DECAL-PP_120x50_x2")).toBeVisible();
await page.getByRole("button", { name: /Thêm vào hóa đơn nháp KH000001_DECAL-PP_120x50_x2/ }).click();
await expect(page.getByText(/Đã chọn KH000001/)).toBeVisible();
await expect(page.getByLabel("K02 giỏ hàng").getByText("Decal PP")).toBeVisible();
```

Keep the existing checkout path on manually selected `STANDEE` unless the cart dimensions are fully wired for area lines in a later task.

- [ ] **Step 2: Update checklist**

In `docs/PHASE-CHECKLIST.md`:

- Mark Phase 2A as merged.
- Add Phase 2B status and scope guard.
- Record Supabase Cloud staging as the preferred fast verification environment.
- Keep final server verification optional before production deploy, not required after every small branch.

- [ ] **Step 3: Run full verification**

Run:

```bash
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npx deno check supabase/functions/api/index.ts
npm run test:e2e
```

Expected: all PASS.

- [ ] **Step 4: Cloud staging verification**

After local verification passes, push migrations/functions to Supabase Cloud staging:

```bash
npx supabase db push --db-url "$QC_OMS_STAGING_DB_URL" --include-seed --yes
npx supabase functions deploy api --project-ref yentlbgbtmumilbzttge --no-verify-jwt
```

Then run:

```bash
npm run test:e2e
```

Expected: PASS against `qc-oms-staging`.

- [ ] **Step 5: Commit checklist/E2E updates**

```bash
git add tests/e2e/auth-pos.spec.ts docs/PHASE-CHECKLIST.md
git commit -m "test: cover production queue pos flow"
```

---

## Self-Review

- Scope coverage: DB/API/UI/E2E cover queue list, history, add-to-draft, dismiss, restore, and atomic claim.
- Boundary coverage: Plan explicitly prevents production queue from creating orders, stock movements, cashbook entries, or debt.
- Terminology coverage: Plan uses `production_queue` and **máy sản xuất**.
- Known risk: Local POS cart currently lacks full dimension-aware line rendering for `width_m`/`height_m`; this phase keeps normalized payload available but does not wire final m² calculation from queue lines into checkout. That must be handled before using queue-generated area lines for real checkout totals.
