# Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver authentication, account-based module routing, permission-gated POS Shell, Foundation administration APIs, local Supabase setup, automated tests, and CI for QC-OMS Phase 0.

**Plan correction 2026-06-30:** POS is a sales module inside QC-OMS, not a physical workstation selection step. Frontend login now routes to an account dashboard, and permissions are account-based. Workstation database/API artifacts from earlier Foundation work remain backend-compatible for now, but they are not part of the login flow, POS route guard, or administration UI in this phase.

**Infrastructure correction 2026-06-30:** Supabase and Docker run on the shared server for multiple developer machines. Developer laptops run the frontend and connect to the shared Supabase server through Tailscale. Default GitHub CI must not depend on that private server until an approved CI-to-Tailscale path exists; database and shared-server E2E checks are operator/server gates for now.

**Architecture:** Build one vertical slice with React/Vite on the client and one Deno Supabase Edge Function exposing `/api/v1`. PostgreSQL migrations own Foundation schema, transactional permission operations, RLS, and seed data; the client uses Supabase directly only for Auth and Realtime invalidation.

**Tech Stack:** Node.js 22 LTS, npm, React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, Supabase JS 2, Supabase CLI 2, Deno, Vitest 4, Testing Library, pgTAP, Playwright 1.61, GitHub Actions.

---

## File structure and responsibilities

```text
src/
├── app/                         # providers, router, protected routes
├── components/                  # reusable presentation-only components
├── features/auth/               # login, session bootstrap, logout
├── features/dashboard/          # account-based module landing page
├── features/users/              # Foundation API types/services
├── features/pos/                # Phase 0 POS shell and profile menu
├── lib/api/                     # authenticated REST client and API errors
├── lib/auth/                    # Supabase browser client
├── lib/realtime/                # profile/permission invalidation channel
├── styles/                      # Tailwind entry and global tokens
└── test/                        # Vitest setup and shared test builders
supabase/
├── functions/api/
│   ├── middleware/              # trace, auth, workstation, permission
│   ├── repositories/            # organization-scoped persistence
│   ├── routes/                  # HTTP route dispatch and parsing
│   ├── use-cases/               # Foundation workflows and validation
│   ├── app.ts                   # injectable request handler
│   └── index.ts                 # Deno.serve entry point
├── migrations/                  # schema, transactional functions, RLS
├── tests/database/              # pgTAP schema/RLS/function tests
├── tests/functions/             # Deno unit/integration tests
├── config.toml
└── seed.sql
tests/e2e/                        # browser smoke and permission paths
.github/workflows/ci.yml          # mandatory quality gates
```

Keep the Owner's existing uncommitted documentation changes out of implementation commits. Stage exact paths; never use `git add .`.

### Task 1: Scaffold the frontend and quality commands

**Files:**
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles/index.css`

- [ ] **Step 1: Pin the runtime and install exact current dependencies**

Create `.nvmrc` with `22`, then initialize npm and install the package versions verified on 2026-06-28:

```bash
npm init -y
npm install react@19.2.7 react-dom@19.2.7 react-router-dom@7.18.0 @supabase/supabase-js@2.108.2 @tanstack/react-query@5.101.2 zod@4.4.3
npm install --save-dev vite@8.1.0 @vitejs/plugin-react@6.0.3 typescript@6.0.3 tailwindcss@4.3.1 @tailwindcss/vite@4.3.1 vitest@4.1.9 jsdom@29.1.1 @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 @testing-library/jest-dom eslint@10.6.0 typescript-eslint@8.62.0 eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.3 globals@17.7.0 @types/react@19.2.17 @types/react-dom@19.2.3 @types/node@22 supabase@2.108.0 @playwright/test@1.61.1
```

Expected: `package-lock.json` is generated and `npm audit` reports no unresolved critical vulnerability.

- [ ] **Step 2: Add deterministic scripts and tool configuration**

Set these `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:db": "supabase test db",
    "test:functions": "deno test supabase/tests/functions --allow-env --allow-net",
    "test:e2e": "playwright test",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:functions": "supabase functions serve api --env-file supabase/.env.local"
  }
}
```

Configure Vite with React, Tailwind, and Vitest `jsdom`; configure ESLint for TypeScript/React; include `src/test/setup.ts` with:

```ts
import '@testing-library/jest-dom/vitest'
```

`.env.example` must contain names only:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=
VITE_APP_ENV=local
```

- [ ] **Step 3: Write the failing application smoke test**

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('renders the QC-OMS application name', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'QC-OMS' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test and verify RED**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 5: Add the minimal app entry and global stylesheet**

```tsx
export function App() {
  return <h1>QC-OMS</h1>
}
```

`src/main.tsx` mounts `<App />` into `#root`; `src/styles/index.css` starts with `@import "tailwindcss";`.

- [ ] **Step 6: Verify GREEN and all scaffold gates**

Run: `npm test -- src/app/App.test.tsx && npm run lint && npm run typecheck && npm run build`

Expected: one passing test and all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add .nvmrc .gitignore .env.example package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js src
git commit -m "chore: scaffold phase 0 application"
```

### Task 2: Create the Foundation database schema and seed

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/tests/database/001_foundation_schema.test.sql`
- Create: `supabase/migrations/202606280001_foundation_schema.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Initialize Supabase configuration**

Run: `npx supabase init`

Set `project_id = "qc-oms"`, enable the `api` function, and keep local services bound to localhost defaults.

- [ ] **Step 2: Write failing pgTAP schema tests**

The test begins a transaction, plans assertions, and checks all six tables plus critical constraints:

```sql
begin;
select plan(14);
select has_table('public', 'organizations');
select has_table('public', 'profiles');
select has_table('public', 'workstations');
select has_table('public', 'permissions');
select has_table('public', 'user_permissions');
select has_table('public', 'permission_audit_logs');
select col_is_pk('public', 'organizations', 'id');
select col_is_pk('public', 'profiles', 'user_id');
select has_index('public', 'profiles', 'idx_profiles_organization_id');
select has_index('public', 'profiles', 'idx_profiles_org_status');
select has_index('public', 'workstations', 'idx_workstations_org_status');
select has_index('public', 'permission_audit_logs', 'idx_permission_audit_org_time');
select fk_ok('public', 'profiles', 'organization_id', 'public', 'organizations', 'id');
select fk_ok('public', 'user_permissions', 'permission_code', 'public', 'permissions', 'code');
select * from finish();
rollback;
```

- [ ] **Step 3: Run the database test and verify RED**

Run: `npx supabase start && npx supabase test db supabase/tests/database/001_foundation_schema.test.sql`

Expected: FAIL because the Foundation tables do not exist.

- [ ] **Step 4: Implement the schema migration**

Create the six tables with the columns, checks, foreign keys, unique constraints, and indexes defined in `docs/04-DATABASE/System/AUTH-PERMISSIONS.md`. Include this reusable trigger:

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Attach it before update to `organizations`, `profiles`, and `workstations`. Enable RLS on every Foundation table immediately; policies arrive in Task 3, so the safe default is deny.

- [ ] **Step 5: Add deterministic non-secret seed data**

Use fixed UUIDs for local references and `ON CONFLICT` for repeatability:

```sql
insert into public.organizations (id, code, name)
values ('00000000-0000-4000-8000-000000000001', 'VAN-LAM', 'Xưởng Văn Lâm')
on conflict (code) do update set name = excluded.name;

insert into public.workstations (id, organization_id, code, name)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'POS-01',
  'Quầy thu ngân 1'
)
on conflict (organization_id, code) do update set name = excluded.name;
```

Seed all nine permission codes from `docs/05-BACKEND-MayChu/POS/AUTH.md`; do not seed an Auth password.

- [ ] **Step 6: Verify GREEN on a clean database**

Run: `npx supabase db reset && npx supabase test db supabase/tests/database/001_foundation_schema.test.sql`

Expected: `Result: PASS` with 14 successful assertions.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml supabase/seed.sql supabase/migrations/202606280001_foundation_schema.sql supabase/tests/database/001_foundation_schema.test.sql
git commit -m "feat: add foundation database schema"
```

### Task 3: Add RLS and transactional permission functions

**Files:**
- Create: `supabase/tests/database/002_foundation_rls.test.sql`
- Create: `supabase/tests/database/003_permission_transactions.test.sql`
- Create: `supabase/migrations/202606280002_foundation_security.sql`

- [ ] **Step 1: Write failing RLS tests**

Create two organizations and two Auth users inside a rolled-back pgTAP transaction. Set authenticated JWT claims with:

```sql
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
```

Assert that the active user can select their organization, own profile, own permissions, and active workstations in their organization; assert zero rows for the other organization and all direct writes.

- [ ] **Step 2: Write failing transaction tests**

Assert `public.replace_user_permissions(actor, target, codes, trace)`:

- replaces the complete permission set;
- writes one `replace` audit row with sorted before/after JSON arrays;
- rejects cross-organization targets;
- rejects inactive/deprecated permission codes;
- rejects removing `perm.manage_users` from the final active administrator.

- [ ] **Step 3: Run both tests and verify RED**

Run: `npx supabase test db supabase/tests/database/002_foundation_rls.test.sql supabase/tests/database/003_permission_transactions.test.sql`

Expected: FAIL because helper functions, policies, and transaction functions do not exist.

- [ ] **Step 4: Implement organization helper and policies**

The helper must not accept a client-supplied tenant:

```sql
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.user_id = auth.uid() and p.status = 'active'
$$;
```

Grant authenticated SELECT exactly as specified in `docs/04-DATABASE/03-RLS.md`; create no client INSERT, UPDATE, or DELETE policies. Revoke execute on administrative transaction functions from `anon` and `authenticated`; grant only to `service_role`.

- [ ] **Step 5: Implement atomic administrative functions**

Implement these security-definer functions with fixed empty `search_path`, explicit `public.` qualification, tenant checks, row locks, and stable error tokens:

```sql
public.create_profile_with_permissions(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_permission_codes text[],
  p_trace_id text
) returns void

public.replace_user_permissions(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_permission_codes text[],
  p_trace_id text
) returns void

public.update_profile_status(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_display_name text,
  p_status text
) returns void
```

Use `raise exception using errcode = 'P0001', message = 'LAST_ADMIN_REQUIRED'` for final-admin protection and similarly stable messages for cross-tenant and invalid-permission failures.

- [ ] **Step 6: Verify GREEN**

Run: `npx supabase db reset && npx supabase test db`

Expected: all schema, RLS, and transaction tests pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202606280002_foundation_security.sql supabase/tests/database/002_foundation_rls.test.sql supabase/tests/database/003_permission_transactions.test.sql
git commit -m "feat: enforce foundation RLS and permission transactions"
```

### Task 4: Build the API response core and health route

**Files:**
- Create: `supabase/deno.json`
- Create: `supabase/functions/api/http.ts`
- Create: `supabase/functions/api/routes/router.ts`
- Create: `supabase/functions/api/app.ts`
- Create: `supabase/functions/api/index.ts`
- Create: `supabase/tests/functions/health_test.ts`

- [ ] **Step 1: Configure Deno imports and tasks**

`supabase/deno.json` pins `@supabase/supabase-js` to `npm:@supabase/supabase-js@2.108.2` and defines `check`, `lint`, and `test` tasks for `functions/` and `tests/functions/`.

- [ ] **Step 2: Write the failing health test**

```ts
import { assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { createApp } from '../../functions/api/app.ts'

Deno.test('GET /api/v1/health returns the standard success envelope', async () => {
  const response = await createApp({ version: 'test-sha' })(
    new Request('http://local/api/v1/health'),
  )
  const body = await response.json()
  assertEquals(response.status, 200)
  assertEquals(body.success, true)
  assertEquals(body.data, { status: 'ok', service: 'qc-oms-api', version: 'test-sha' })
  assertMatch(body.trace_id, /^[0-9a-f-]{36}$/)
})
```

- [ ] **Step 3: Verify RED**

Run: `deno test supabase/tests/functions/health_test.ts --allow-env`

Expected: FAIL because `app.ts` does not exist.

- [ ] **Step 4: Implement response helpers and route dispatch**

Define `ApiError`, `successResponse`, and `errorResponse` in `http.ts`. `createApp` must:

1. take or generate `X-Request-Id` as `trace_id`;
2. answer CORS preflight only for configured origins;
3. route `GET /api/v1/health`;
4. map unknown routes to `RESOURCE_NOT_FOUND`;
5. catch unknown failures as `INTERNAL_ERROR` without serializing the cause.

`index.ts` reads environment variables, creates dependencies, and calls `Deno.serve(handler)`; it contains no use-case logic.

- [ ] **Step 5: Verify GREEN and Deno checks**

Run: `deno test supabase/tests/functions/health_test.ts --allow-env && deno check supabase/functions/api/index.ts && deno lint supabase/functions`

Expected: one passing test and zero check/lint errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/deno.json supabase/functions/api supabase/tests/functions/health_test.ts
git commit -m "feat: add foundation API health route"
```

### Task 5: Add authenticated context and `GET /me`

**Files:**
- Create: `supabase/functions/api/contracts.ts`
- Create: `supabase/functions/api/middleware/auth.ts`
- Create: `supabase/functions/api/repositories/foundation-repository.ts`
- Create: `supabase/functions/api/use-cases/get-current-user.ts`
- Create: `supabase/functions/api/routes/me.ts`
- Create: `supabase/tests/functions/me_test.ts`

- [ ] **Step 1: Write failing `/me` behavior tests**

Use an in-memory fake implementing the repository interface. Cover:

```ts
Deno.test('GET /api/v1/me returns profile, organization and permissions')
Deno.test('GET /api/v1/me rejects a missing bearer token with AUTH_REQUIRED')
Deno.test('GET /api/v1/me rejects an inactive profile with ACCOUNT_INACTIVE')
Deno.test('GET /api/v1/me returns no workstation requirement for account dashboard flow')
```

Assert exact status, code, safe message, and the incoming `X-Request-Id` echoed as `trace_id`.

- [ ] **Step 2: Verify RED**

Run: `deno test supabase/tests/functions/me_test.ts --allow-env`

Expected: FAIL because auth middleware and `/me` route are missing.

- [ ] **Step 3: Define stable contracts**

```ts
export type PermissionCode = `perm.${string}`

export interface RequestContext {
  traceId: string
  userId: string
  email: string
  organizationId: string
  workstationId: string | null
  permissions: ReadonlySet<PermissionCode>
}

export interface CurrentUserData {
  user: { id: string; email: string; display_name: string }
  organization: { id: string; code: string; name: string }
  workstation: { id: string; code: string; name: string } | null
  permissions: PermissionCode[]
}
```

- [ ] **Step 4: Implement auth context and `/me`**

Auth middleware calls `supabase.auth.getUser(token)` rather than trusting decoded client claims. The repository loads active profile, organization, sorted active permissions, and optional active same-organization workstation. `getCurrentUser` maps repository rows into `CurrentUserData` without exposing internal fields.

- [ ] **Step 5: Verify GREEN and the full function suite**

Run: `deno test supabase/tests/functions --allow-env --allow-net`

Expected: health and `/me` tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/me_test.ts
git commit -m "feat: add authenticated current-user API"
```

### Task 6: Add workstation routes

**Files:**
- Create: `supabase/functions/api/use-cases/workstations.ts`
- Create: `supabase/functions/api/routes/workstations.ts`
- Create: `supabase/tests/functions/workstations_test.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/routes/router.ts`

- [ ] **Step 1: Write failing workstation route tests**

Cover exact contracts:

```text
GET   /api/v1/workstations       authenticated; returns active same-org rows sorted by code
POST  /api/v1/workstations       requires perm.manage_users; trims/uppercases code
PATCH /api/v1/workstations/{id}  requires perm.manage_users; allows code/name/status only
```

Tests must prove another organization's workstation returns `RESOURCE_NOT_FOUND`, duplicate code returns `RESOURCE_CONFLICT`, and invalid status returns `VALIDATION_ERROR`.

- [ ] **Step 2: Verify RED**

Run: `deno test supabase/tests/functions/workstations_test.ts --allow-env`

Expected: FAIL with unmatched workstation routes.

- [ ] **Step 3: Implement validation, use cases, and repository methods**

Use Zod schemas equivalent to:

```ts
const workstationCode = z.string().trim().min(1).max(30)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9-]+$/.test(value))

const createWorkstationInput = z.object({
  code: workstationCode,
  name: z.string().trim().min(1).max(100),
}).strict()
```

Every repository mutation includes `.eq('organization_id', context.organizationId)`. Map unique violation `23505` to `RESOURCE_CONFLICT`; do not expose database messages.

- [ ] **Step 4: Verify GREEN**

Run: `deno test supabase/tests/functions --allow-env --allow-net && deno check supabase/functions/api/index.ts`

Expected: all function tests pass and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/workstations_test.ts
git commit -m "feat: add workstation foundation API"
```

### Task 7: Add user and permission administration APIs

**Files:**
- Create: `supabase/functions/api/use-cases/users.ts`
- Create: `supabase/functions/api/routes/users.ts`
- Create: `supabase/functions/api/use-cases/permissions.ts`
- Create: `supabase/functions/api/routes/permissions.ts`
- Create: `supabase/functions/api/middleware/rate-limit.ts`
- Create: `supabase/tests/functions/users_test.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Modify: `supabase/functions/api/routes/router.ts`

- [ ] **Step 1: Write failing route and use-case tests**

Cover the full route matrix from `FOUNDATION-API.md`:

```text
GET   /api/v1/users
GET   /api/v1/users/{id}
POST  /api/v1/users
PATCH /api/v1/users/{id}
PUT   /api/v1/users/{id}/permissions
GET   /api/v1/permissions
```

Tests must cover pagination bounds, search/status filters, invalid email, empty display name, invalid permission, cross-organization access, missing `perm.manage_users`, duplicate Auth email cleanup, idempotent permission replacement, permission audit creation, final-admin protection, and `RATE_LIMITED` after the configured write threshold.

- [ ] **Step 2: Verify RED**

Run: `deno test supabase/tests/functions/users_test.ts --allow-env`

Expected: FAIL because user and permission routes are absent.

- [ ] **Step 3: Implement request schemas and route behavior**

Use these limits:

```ts
const listUsersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

const createUserInput = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  display_name: z.string().trim().min(1).max(100),
  permissions: z.array(z.string().regex(/^perm\.[a-z0-9_]+$/)).max(100),
}).strict()
```

`POST /users` creates the Auth user, calls `create_profile_with_permissions`, and deletes the newly created Auth user if the database transaction fails. Never return or log the password.

- [ ] **Step 4: Implement repository and transaction mapping**

All list/detail reads begin from same-organization profiles. Resolve Auth emails server-side through Admin API only for those user IDs. Permission replacement calls the database function from Task 3 and maps `LAST_ADMIN_REQUIRED` to `RESOURCE_CONFLICT`.

Write request logs as one JSON object containing `timestamp`, `route`, `method`, `status`, `latency_ms`, `user_id`, `workstation_id`, and `trace_id`; omit request bodies.

Add an injected fixed-window limiter keyed by `user_id + route group`. The default Phase 0 thresholds are 30 read requests/minute and 10 administrative write requests/minute per user. Return HTTP 429 with `RATE_LIMITED`; do not use IP address as an authorization identity. The limiter interface keeps the middleware replaceable by a distributed store before multi-instance production traffic; the Phase 0 runbook must record this staging limitation.

- [ ] **Step 5: Verify GREEN**

Run: `deno test supabase/tests/functions --allow-env --allow-net && deno check supabase/functions/api/index.ts && deno lint supabase/functions`

Expected: all API tests pass with no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/api supabase/tests/functions/users_test.ts
git commit -m "feat: add user and permission administration API"
```

### Task 8: Build the browser Auth bootstrap and API client

**Files:**
- Create: `src/lib/auth/supabase.ts`
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/client.test.ts`
- Create: `src/features/auth/auth-service.ts`
- Create: `src/features/auth/AuthProvider.tsx`
- Create: `src/features/auth/LoginPage.tsx`
- Create: `src/features/auth/LoginPage.test.tsx`
- Create: `src/app/providers.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing API client tests**

Test a fetch spy to prove the client sends bearer token and `X-Request-Id`, does not send workstation headers in Phase 0, parses the success envelope, and throws a typed `ApiError` preserving `status`, `code`, `message`, `traceId`, and optional field details.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/api/client.test.ts`

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the API client**

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly traceId: string,
    readonly details?: { fields?: Record<string, string> },
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

The client obtains the current access token from a callback, never LocalStorage directly. The frontend does not send workstation headers or store workstation IDs in Phase 0 because module access is account-based.

- [ ] **Step 4: Write failing login tests**

Cover empty fields, invalid credentials, disabled submit while pending, successful sign-in followed by `/me`, and safe generic handling of unknown Auth errors.

- [ ] **Step 5: Verify RED**

Run: `npm test -- src/features/auth/LoginPage.test.tsx`

Expected: FAIL because login components do not exist.

- [ ] **Step 6: Implement Supabase Auth and providers**

`AuthProvider` subscribes to `onAuthStateChange`, restores the initial session once, fetches `/me` only after a session exists, exposes `signIn`/`signOut`/`refreshMe`, and clears query cache on logout. Do not copy access or refresh tokens into application storage.

- [ ] **Step 7: Verify GREEN**

Run: `npm test -- src/lib/api/client.test.ts src/features/auth/LoginPage.test.tsx && npm run typecheck`

Expected: all focused tests pass and typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib src/features/auth src/app/providers.tsx src/main.tsx
git commit -m "feat: add browser authentication foundation"
```

### Task 9: Add account dashboard and permission routing

**Files:**
- Create: `src/features/users/types.ts`
- Create: `src/features/users/foundation-service.ts`
- Create: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/dashboard/DashboardPage.test.tsx`
- Create: `src/app/RequireSession.tsx`
- Create: `src/app/RequirePermission.tsx`
- Create: `src/app/RequirePermission.test.tsx`
- Create: `src/app/ForbiddenPage.tsx`
- Create: `src/app/router.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing dashboard module tests**

Assert authenticated users land on an account dashboard, available modules are enabled by account permissions, unavailable future modules render disabled, and no POS machine/workstation selection is shown.

- [ ] **Step 2: Write failing permission-route tests**

Assert unauthenticated users go to `/login`, authenticated users without `perm.create_order` go to `/forbidden`, and authorized users reach the child route. Assert protected content never renders before the decision is known.

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/features/dashboard/DashboardPage.test.tsx src/app/RequirePermission.test.tsx`

Expected: FAIL because the dashboard and guards do not exist.

- [ ] **Step 4: Implement service, dashboard, guards, and router**

Use routes:

```text
/login        public; authenticated users redirect through bootstrap
/dashboard    authenticated; account-based module landing page
/pos          authenticated + perm.create_order
/admin        authenticated + perm.access_admin_panel
/forbidden    authenticated; no POS DOM
*             redirect based on session/bootstrap state
```

On `ACCOUNT_INACTIVE`, sign out and route to `/login`. The frontend does not route through workstation selection.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/features/dashboard/DashboardPage.test.tsx src/app/RequirePermission.test.tsx && npm run typecheck`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/users src/features/dashboard src/app
git commit -m "feat: add account module dashboard"
```

### Task 10: Build the Phase 0 POS Shell and profile menu

**Files:**
- Create: `src/features/pos/PosShell.tsx`
- Create: `src/features/pos/PosShell.test.tsx`
- Create: `src/features/pos/ProfileMenu.tsx`
- Create: `src/features/pos/ProfileMenu.test.tsx`
- Create: `src/components/ConnectionStatus.tsx`
- Modify: `src/styles/index.css`
- Modify: `src/app/router.tsx`

- [ ] **Step 1: Write failing shell and menu tests**

Assert the shell renders K01, K02, and K03 landmarks; displays `👤 {display_name}`; displays connection state; shows only permission-allowed profile items; closes the menu on outside click and Escape; and signs out from every active account.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/pos/PosShell.test.tsx src/features/pos/ProfileMenu.test.tsx`

Expected: FAIL because POS components do not exist.

- [ ] **Step 3: Implement the shell without future business behavior**

Use semantic regions and the approved 65/35 desktop grid. K01 contains the app mark, connection status, disabled future controls, and profile menu. K02 and K03 show labeled unavailable panels; they do not create tabs, carts, products, customers, quotes, or payments.

Responsive behavior below the desktop breakpoint stacks K02 and K03 so login/access controls remain usable; it does not redesign later POS workflows.

- [ ] **Step 4: Implement accessible profile interactions**

Use a real button with `aria-expanded`/`aria-controls`; render report/admin items only when their permissions exist; always render logout. Add Escape and outside-pointer listeners only while open and clean both up on close/unmount.

- [ ] **Step 5: Verify GREEN and production build**

Run: `npm test -- src/features/pos && npm run lint && npm run typecheck && npm run build`

Expected: focused tests and all frontend quality gates pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/pos src/components/ConnectionStatus.tsx src/styles/index.css src/app/router.tsx
git commit -m "feat: add permission-aware POS shell"
```

### Task 11: Add Realtime invalidation for access changes

**Files:**
- Create: `src/lib/realtime/access-channel.ts`
- Create: `src/lib/realtime/access-channel.test.ts`
- Create: `src/features/auth/AccessSync.tsx`
- Create: `src/features/auth/AccessSync.test.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Write failing Realtime tests**

Assert one filtered channel subscribes to `profiles.user_id=eq.{userId}` and `user_permissions.user_id=eq.{userId}`, either event calls `refreshMe`, duplicate event bursts are coalesced into one in-flight refresh, and unmount removes the channel.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/realtime/access-channel.test.ts src/features/auth/AccessSync.test.tsx`

Expected: FAIL because access synchronization does not exist.

- [ ] **Step 3: Implement invalidation-only subscription**

The event callback must ignore payload authorization data and call `/me`. After refresh:

- inactive account signs out;
- missing current-route permission redirects to `/forbidden`;
- route permission loss redirects to `/forbidden`.

Track connection state as `connecting | connected | disconnected` for `ConnectionStatus`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/realtime/access-channel.test.ts src/features/auth/AccessSync.test.tsx && npm run typecheck`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/realtime src/features/auth/AccessSync.tsx src/features/auth/AccessSync.test.tsx src/app/providers.tsx
git commit -m "feat: refresh access state from realtime signals"
```

### Task 12: Add local integration, E2E, CI, and operator documentation

**Files:**
- Create: `supabase/tests/functions/foundation_integration_test.ts`
- Create: `tests/e2e/auth-pos.spec.ts`
- Create: `tests/e2e/global-setup.ts`
- Create: `playwright.config.ts`
- Create: `.github/workflows/ci.yml`
- Create: `docs/07-DEPLOYMENT-TrienKhai/PHASE-0-RUNBOOK.md`
- Modify: `package.json`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/README.md`

- [x] **Step 1: Write API integration tests against Supabase environment**

Use unique UUID/email values per run and Admin API cleanup. Verify active `/me`, inactive account rejection, wrong-organization workstation rejection, missing manage permission, cross-tenant user lookup, permission audit row, and final-admin protection through the real handler/repository.

- [x] **Step 2: Verify RED**

Run: `npm run supabase:reset && npm run test:functions`

Expected: the new integration suite fails until local test environment loading and repository wiring are complete.

- [x] **Step 3: Complete environment wiring and verify integration GREEN where server env is available**

Load Supabase URL, anon key, and service-role key from server/operator environment, never committed files. Use an externally supplied `E2E_ADMIN_PASSWORD`; do not place a password in seed SQL, tests, workflow YAML, or documentation.

Run on the shared server or trusted operator shell: `npm run supabase:reset && npm run test:db && npm run test:functions`

Expected: all Deno unit, pgTAP, and integration tests pass when server-side Supabase credentials are available. On ordinary dev machines without service-role access, the integration test reports a skip and unit tests still run.

- [x] **Step 4: Write the browser E2E smoke test**

```ts
test('login, open dashboard modules, refresh POS shell, and logout', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Tài khoản').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Mật khẩu').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page.getByRole('heading', { name: 'QC-OMS' })).toBeVisible()
  await page.getByRole('button', { name: 'Bán hàng' }).click()
  await expect(page.getByRole('main', { name: 'Màn hình POS' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('main', { name: 'Màn hình POS' })).toBeVisible()
  await page.getByRole('button', { name: /E2E Admin/ }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
```

Global setup creates the E2E Auth user when service-role access is available. On shared-server dev machines without service-role access, it uses the existing server admin user.

- [x] **Step 5: Run E2E and verify GREEN against shared server**

Connect Tailscale, point `.env.local` to the shared server, and run: `npm run test:e2e`

Expected: the smoke path passes against the shared Supabase server. Broader account-state E2E remains a server/operator gate where test users can be created safely.

- [x] **Step 6: Add CI quality gates**

The GitHub Actions workflow must:

1. check out the repository;
2. set up Node 22 and `npm ci`;
3. set up Deno;
4. run lint, typecheck, unit/component tests, and build;
5. run Edge Function unit tests;
6. run `npm audit --audit-level=high` and a repository secret scan.

Default pull-request CI does not connect to the private Tailscale Supabase server. Database pgTAP and browser E2E are server/operator gates until an approved CI-to-Tailscale path exists.

- [x] **Step 7: Add the Phase 0 runbook**

Document developer prerequisites, shared-server Supabase connection, server-side reset/test procedure, Vite start, all verification commands, bootstrap Owner procedure without a committed password, staging environment variables, deploy order, smoke test, rollback, and known external prerequisites.

Update the Deployment README with one relative link to the runbook; do not duplicate its contents.

- [x] **Step 8: Run the complete verification suite**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:functions
npm run test:e2e
git diff --check
```

Expected on a dev machine connected to the shared server: frontend checks, function unit tests, and E2E smoke pass; `git diff --check` prints nothing. Server-side `npm run supabase:reset`, `npm run test:db`, and integration function checks are recorded separately by the operator/server.

Verified 2026-06-30 on dev machine: `npm audit --audit-level=high`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:functions`, `npm run test:e2e`, `git diff --check`, and secret scan passed. Function integration requiring service-role access was skipped on the dev machine by design.

- [x] **Step 9: Review scope and secrets before commit**

Run: `git status --short && git diff --stat && git grep -nE '(service_role|E2E_ADMIN_PASSWORD)=.+' -- ':!package-lock.json'`

Expected: only Phase 0 implementation/documentation paths are changed and the secret search returns no assigned value.

- [x] **Step 10: Commit**

```bash
git add supabase/tests/functions/foundation_integration_test.ts tests/e2e playwright.config.ts .github/workflows/ci.yml docs/07-DEPLOYMENT-TrienKhai/PHASE-0-RUNBOOK.md docs/07-DEPLOYMENT-TrienKhai/README.md package.json package-lock.json
git commit -m "ci: verify phase 0 foundation end to end"
```

Committed as `61245a7 docs: align phase 0 verification with shared supabase`.

### Task 13: Deploy and verify the staging vertical slice

**Files:**
- Verify: `.env.example`
- Verify: `supabase/config.toml`
- Verify: `docs/07-DEPLOYMENT-TrienKhai/PHASE-0-RUNBOOK.md`

- [ ] **Step 1: Confirm external access without exposing secrets**

Run: `npx supabase projects list && npx vercel whoami`

Expected: the authorized staging Supabase project is listed and Vercel returns the authenticated account. If either command lacks access, stop only this task and report staging as an open acceptance item; do not weaken local/CI gates.

Attempted 2026-06-30 on dev machine: `npx supabase projects list` failed because no Supabase access token is configured. `npx vercel whoami` could not complete because the local npm cache blocked installing the Vercel CLI. Staging deployment remains an open acceptance item until the operator provides Supabase/Vercel access or performs these steps on the server/deployment machine.

- [ ] **Step 2: Link and migrate the staging database**

Set `SUPABASE_PROJECT_REF` in the shell from the approved staging project, then run:

```bash
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Expected: the dry run lists only the two reviewed Phase 0 migrations, then the real push applies them successfully. Do not run `seed.sql` against production.

- [ ] **Step 3: Configure secrets and deploy the API**

Configure `ALLOWED_ORIGINS` and the runtime secrets through Supabase secret management, then run:

```bash
npx supabase functions deploy api --project-ref "$SUPABASE_PROJECT_REF"
```

Expected: deployment succeeds and the public health request returns HTTP 200 with service `qc-oms-api` and the deployed Git SHA.

- [ ] **Step 4: Deploy the staging Frontend**

Set only the approved staging values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, and `VITE_APP_ENV=staging` in the Vercel staging project. Run:

```bash
npx vercel deploy --yes
```

Expected: Vercel returns a preview/staging URL built from the same verified Git SHA; the browser bundle contains no service-role key.

- [ ] **Step 5: Run staging smoke and security checks**

Set `PLAYWRIGHT_BASE_URL`, `E2E_ADMIN_EMAIL`, and `E2E_ADMIN_PASSWORD` in the shell or CI secret store, then run: `npm run test:e2e`

Expected: login, `/me`, dashboard module routing, POS Shell, refresh, forbidden-user, inactive-account, forbidden-module, and logout paths pass against staging.

- [ ] **Step 6: Record acceptance evidence**

Record the Git SHA, Supabase function version, Vercel deployment URL, E2E result, and Owner acceptance date in the deployment system or release notes. Do not commit URLs containing tokens or credentials.

## Final Phase 0 acceptance gate

After Task 13, compare the implementation line-by-line with:

- `docs/superpowers/specs/2026-06-28-phase-0-foundation-design.md`;
- `docs/DEVELOPMENT-PLAN.md` Phase 0 and common Definition of Done;
- `docs/05-BACKEND-MayChu/FOUNDATION-API.md` acceptance tests;
- `docs/04-DATABASE/03-RLS.md` mandatory tests;
- `docs/07-DEPLOYMENT-TrienKhai/ENVIRONMENTS-CI.md` readiness conditions.

Do not claim Phase 0 complete until the full local suite passes, staging deploy succeeds, staging E2E passes, and Owner accepts the user flow. If Supabase/Vercel access is unavailable, report local/CI completion and staging as an explicit open acceptance item.
