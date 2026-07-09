# QCVL System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuan hoa QCVL de giam loi khi sua UI, giam nham deploy NAS, tach backend lon, chuan hoa migration DB, va giu du an on dinh cho su dung noi bo qua NAS/Tailscale.

**Architecture:** Lam theo batch nho, moi batch co test va commit rieng. Khong doi stack lon, khong dua len internet public, khong rewrite Git history trong plan nay. Tiep tuc giu ranh gioi vo UI va ruot nghiep vu theo `docs/CODE_ARCHITECTURE_RULES.md`.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Node 22, PostgreSQL 16, Vitest, Playwright, Docker NAS.

---

## Execution Status

> Cap nhat: 2026-07-09. Plan da duoc thuc thi theo batch nho va commit rieng.

- Done: safe NAS build/deploy/health scripts, dry-run deploy mac dinh.
- Done: HTTP response helpers va route mapping theo module.
- Done: versioned DB migrations, dry-run, baseline mode.
- Done: Finance page tach `FinanceFiltersPanel` va `FinanceDetailPanel`.
- Done: POS shell tach `PosTopbar`, `PosCartPanel`, `PosPaymentPanel`.
- Done: internal ops checklist va ranh gioi cai nao dua NAS/Git/local.
- Rule con hieu luc: khong deploy NAS khi chua co lenh ro; `npm run deploy:nas` chi copy khi co `QCVL_NAS_DEPLOY_CONFIRM=true`.

---

## Scope Rules

- Khong doi password NAS trong plan nay. Owner se tu doi sau.
- Khong rewrite Git history trong plan nay. Neu can xoa secret khoi history, tao plan rieng vi thao tac nay anh huong remote/clone/branch.
- Khong them public internet hardening nhu cookie httpOnly, WAF, CDN, domain public.
- Khong deploy NAS khi chua co lenh ro tu owner. Script deploy phai dry-run mac dinh hoac can bien confirm.
- Moi batch phai pass `npm run lint`, `npm run typecheck`, `npm test` hoac test lien quan, va `npm run build:nas && npm run verify:nas-bundle` neu cham build/deploy.

## File Structure Target

### Deployment

- Already exists before this plan may start: `scripts/build-nas.mjs`, `npm run build:nas`, and `npm run verify:nas-bundle`.
- Create: `scripts/deploy-nas.mjs`
  - Build NAS, verify bundle, dry-run by default, copy runtime files only when confirmed, restart container optionally, health check.
- Create: `scripts/health-nas.mjs`
  - Check `http://100.84.228.125:3200/api/v1/health`.
- Modify: `package.json`
  - Add `deploy:nas`, `health:nas`.
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`
  - Replace manual copy with one-command flow.

### Backend Split

- Create: `server/http-types.ts`
  - Shared request/response/repository types.
- Create: `server/http-response.ts`
  - `success`, `failure`, `jsonResponse`, `responseHeaders`, `HttpError`.
- Create: `server/modules/auth/auth-routes.ts`
  - Login/logout/current user routes.
- Create: `server/modules/catalog/catalog-routes.ts`
  - Product, customer, price list routes.
- Create: `server/modules/sales/sales-routes.ts`
  - Checkout, quote, sales documents.
- Create: `server/modules/finance/finance-routes.ts`
  - Customer debt, debt collection, cashbook.
- Create: `server/modules/inventory/inventory-routes.ts`
  - Inventory products, movements, stocktakes, material openings.
- Create: `server/modules/purchase/purchase-routes.ts`
  - Suppliers and purchase receipts.
- Modify: `server/http.ts`
  - Keep server orchestration only.
- Modify: `server/http.test.ts`
  - Keep integration behavior tests.

### DB Migration

- Create: `database/migrations/README.md`
  - Explain migration rules and NAS safety.
- Create: `database/migrations/0001_foundation.sql`
  - Copy current foundation schema from `database/schema.sql`.
- Create: `database/migrations/0002_sales_finance.sql`
  - Copy current sales/finance schema from `database/schema.sql`.
- Modify: `database/schema.sql`
  - Keep as generated snapshot or documentation snapshot only.
- Modify: `scripts/db-migrate.mjs`
  - Apply ordered migrations through `schema_migrations`.
- Create: `scripts/db-migrate.test.mjs`
  - Unit test migration ordering and idempotency with mocked runner.
- Create: `scripts/db-migrate-dry-run.mjs`
  - Validate migration files and print pending list without touching DB.

### UI Split

- Create as needed:
  - `src/features/finance/FinanceFiltersPanel.tsx`
  - `src/features/finance/FinanceDetailPanel.tsx`
  - `src/features/pos/PosTopbar.tsx`
  - `src/features/pos/PosCartPanel.tsx`
  - `src/features/pos/PosPaymentPanel.tsx`
  - `src/features/catalog/CatalogFiltersPanel.tsx`
  - `src/features/purchase/PurchaseReceiptDetailPanel.tsx`
- Modify existing page files only to compose smaller components.

---

### Task 0: Commit Existing Groundwork Before Large Refactor

**Files:**
- Existing modified/untracked files from the quick hardening pass.

- [ ] **Step 1: Inspect current status**

Run:

```powershell
git status --short
```

Expected: only known groundwork files are changed:

```text
docs/superpowers/plans/2026-07-09-postgres-sales-finance-persistence.md
package.json
scripts/verify-nas-bundle.mjs
docs/PROJECT-IMPROVEMENT-ROADMAP.md
scripts/build-nas.mjs
docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md
```

- [ ] **Step 2: Verify current groundwork**

Run:

```powershell
npm run build:nas
npm run verify:nas-bundle
npm run lint
npm run typecheck
```

Expected: all pass.

- [ ] **Step 3: Commit groundwork**

```powershell
git add package.json scripts/build-nas.mjs scripts/verify-nas-bundle.mjs docs/PROJECT-IMPROVEMENT-ROADMAP.md docs/superpowers/plans/2026-07-09-postgres-sales-finance-persistence.md docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md
git commit -m "chore: plan QCVL hardening work"
```

---

### Task 1: Current Secret Hygiene Without History Rewrite

**Files:**
- Modify: `docs/superpowers/plans/2026-07-09-postgres-sales-finance-persistence.md`
- Modify: `docs/PROJECT-IMPROVEMENT-ROADMAP.md`

- [ ] **Step 1: Scan working tree for direct secret values**

Run:

```powershell
rg -n "L[a]m650909@1|QCVL_SMOKE_PASSWORD='[^<]|QCVL_VERIFY_PASSWORD='[^<]|DATABASE_URL=postgres://[^<]" docs scripts package.json .github --glob '!docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md'
```

Expected: no lines containing real password or direct database URL.

- [ ] **Step 2: Replace direct values with placeholders if scan finds any**

Use placeholders exactly:

```text
<admin-password>
<nas-user>
<postgres-url>
```

- [ ] **Step 3: Document security rule**

Add to `docs/PROJECT-IMPROVEMENT-ROADMAP.md` under security:

```markdown
- Khong ghi credential that vao docs, plan, commit message, terminal transcript copy, hoac script.
- Neu can chay lenh co password, dung environment variable tam thoi va xoa sau khi chay.
- Git history rewrite chi lam khi owner dong y vi co the anh huong clone/branch cu.
```

- [ ] **Step 4: Verify**

Run:

```powershell
rg -n "L[a]m650909@1|QCVL_SMOKE_PASSWORD='[^<]|QCVL_VERIFY_PASSWORD='[^<]|DATABASE_URL=postgres://[^<]" docs scripts package.json .github --glob '!docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md'
npm run lint
npm run typecheck
```

Expected: scan prints nothing; lint/typecheck exit 0.

- [ ] **Step 5: Commit**

```powershell
git add docs/PROJECT-IMPROVEMENT-ROADMAP.md docs/superpowers/plans/2026-07-09-postgres-sales-finance-persistence.md
git commit -m "docs: harden secret handling guidance"
```

---

### Task 2: One-Command NAS Health Check

**Files:**
- Create: `scripts/health-nas.mjs`
- Modify: `package.json`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [ ] **Step 1: Add failing test by running missing script**

Run:

```powershell
npm run health:nas
```

Expected: fail with missing script.

- [ ] **Step 2: Add package script**

Modify `package.json` scripts:

```json
"health:nas": "node scripts/health-nas.mjs"
```

- [ ] **Step 3: Create health script**

Create `scripts/health-nas.mjs`:

```js
const baseUrl = process.env.QCVL_NAS_BASE_URL ?? 'http://100.84.228.125:3200'
const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`

const response = await fetch(healthUrl)
let body
try {
  body = await response.json()
} catch {
  body = null
}

if (!response.ok || body?.success !== true || body?.data?.status !== 'ok') {
  console.error(JSON.stringify({ url: healthUrl, status: response.status, body }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ url: healthUrl, status: 'ok', traceId: body.trace_id }, null, 2))
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm run health:nas
npm run lint
npm run typecheck
```

Expected: health prints JSON with `status: "ok"`; lint/typecheck exit 0.

- [ ] **Step 5: Update docs**

In `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`, replace manual health check text with:

```powershell
npm run health:nas
```

- [ ] **Step 6: Commit**

```powershell
git add package.json scripts/health-nas.mjs docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md
git commit -m "chore: add NAS health check script"
```

---

### Task 3: One-Command NAS Deploy Script

**Files:**
- Create: `scripts/deploy-nas.mjs`
- Modify: `package.json`
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [ ] **Step 1: Add missing script check**

Run:

```powershell
npm run deploy:nas
```

Expected: fail with missing script.

- [ ] **Step 2: Add package script**

Modify `package.json` scripts:

```json
"deploy:nas": "node scripts/deploy-nas.mjs"
```

- [ ] **Step 3: Create deploy script**

Create `scripts/deploy-nas.mjs`:

```js
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\100.84.228.125\\docker\\QCVL\\app'
const restart = process.env.QCVL_NAS_RESTART === 'true'
const confirmed = process.env.QCVL_NAS_DEPLOY_CONFIRM === 'true'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
  }
}

function robocopy(source, target, flags) {
  if (!confirmed) {
    console.log(`[dry-run] robocopy ${source} ${target} ${flags.join(' ')}`)
    return
  }
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
  const result = spawnSync('robocopy', [source, target, ...flags], {
    cwd: root,
    shell: true,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  const code = result.status ?? 1
  if (code > 3) throw new Error(`robocopy failed with exit ${code}: ${source} -> ${target}`)
}

function copyFile(source, target) {
  if (!confirmed) {
    console.log(`[dry-run] copy ${source} ${target}`)
    return
  }
  run('powershell', ['-NoProfile', '-Command', `Copy-Item -LiteralPath '${source}' -Destination '${target}' -Force`])
}

run('npm', ['run', 'build:nas'])
run('npm', ['run', 'verify:nas-bundle'])

const quiet = ['/NFL', '/NDL', '/NJH', '/NJS', '/NP']
robocopy(join(root, 'dist'), join(nasRoot, 'dist'), ['/MIR', ...quiet])
robocopy(join(root, 'dist-server'), join(nasRoot, 'dist-server'), ['/MIR', ...quiet])
robocopy(join(root, 'server'), join(nasRoot, 'server'), ['/E', ...quiet])
robocopy(join(root, 'src'), join(nasRoot, 'src'), ['/E', ...quiet])
robocopy(join(root, 'public'), join(nasRoot, 'public'), ['/E', ...quiet])
robocopy(join(root, 'database'), join(nasRoot, 'database'), ['/E', ...quiet])

for (const file of [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tsconfig.server.json',
  'scripts/build-nas.mjs',
  'scripts/db-migrate.mjs',
  'scripts/seed-dev20-data.mjs',
]) {
  copyFile(join(root, file), join(nasRoot, file))
}

if (restart) {
  if (!confirmed) throw new Error('QCVL_NAS_DEPLOY_CONFIRM=true is required when QCVL_NAS_RESTART=true')
  const sshTarget = process.env.QCVL_NAS_SSH_TARGET
  if (!sshTarget) throw new Error('QCVL_NAS_SSH_TARGET is required when QCVL_NAS_RESTART=true')
  run('ssh', ['-tt', '-o', 'StrictHostKeyChecking=no', sshTarget, 'sudo -S /usr/local/bin/docker restart qcvl-app'])
}

run('npm', ['run', 'health:nas'])
```

- [ ] **Step 4: Verify deploy script without restart**

Run:

```powershell
npm run deploy:nas
```

Expected:

- `build:nas` pass.
- `verify:nas-bundle` pass.
- script prints `[dry-run]` copy operations.
- no NAS files are changed.
- `health:nas` pass.
- Container not restarted unless `QCVL_NAS_RESTART=true`.

- [ ] **Step 5: Verify deploy script with explicit owner approval**

Only run this step after owner says to deploy NAS.

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
```

Expected:

- `build:nas` pass.
- `verify:nas-bundle` pass.
- robocopy exits 0-3.
- `health:nas` pass.

- [ ] **Step 6: Update docs**

Replace manual deploy block in `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md` with:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
```

Restart version:

```powershell
$env:QCVL_NAS_RESTART='true'
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_SSH_TARGET='<nas-user>@100.84.228.125'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_RESTART
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_SSH_TARGET
```

- [ ] **Step 7: Verify**

Run:

```powershell
npm run lint
npm run typecheck
npm run verify:nas-bundle
```

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add package.json scripts/deploy-nas.mjs docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md
git commit -m "chore: automate NAS deploy flow"
```

---

### Task 4: Extract HTTP Response Helpers

**Files:**
- Create: `server/http-response.ts`
- Modify: `server/http.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Create response helper file**

Create `server/http-response.ts`:

```ts
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'AUTH_REQUIRED' | 'RESOURCE_NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR',
    message: string,
  ) {
    super(message)
  }
}

export function success<T>(data: T, traceId: string, status = 200) {
  return jsonResponse({ success: true, data, trace_id: traceId }, status, traceId)
}

export function failure(status: number, code: HttpError['code'], message: string, traceId: string) {
  return jsonResponse({ success: false, error: { code, message }, trace_id: traceId }, status, traceId)
}

export function emptyResponse(traceId: string) {
  return new Response(null, { status: 204, headers: responseHeaders(traceId) })
}

export function jsonResponse(data: unknown, status = 200, traceId?: string) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(traceId) })
}

export function responseHeaders(traceId?: string) {
  const headers = new Headers()
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('access-control-allow-headers', 'authorization,content-type,x-request-id,x-workstation-id')
  if (traceId) headers.set('x-request-id', traceId)
  return headers
}
```

- [ ] **Step 2: Import helpers in `server/http.ts`**

Add:

```ts
import { HttpError, emptyResponse, failure, success } from './http-response'
```

Remove duplicate definitions from bottom of `server/http.ts`.

- [ ] **Step 3: Verify**

Run:

```powershell
npm test -- server/http.test.ts
npm run typecheck
npm run lint
```

Expected: server HTTP tests pass; typecheck/lint pass.

- [ ] **Step 4: Commit**

```powershell
git add server/http.ts server/http-response.ts
git commit -m "refactor: extract HTTP response helpers"
```

---

### Task 5: Extract Auth Routes From `server/http.ts`

**Files:**
- Create: `server/http-types.ts`
- Create: `server/modules/auth/auth-routes.ts`
- Modify: `server/http.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Create shared route types**

Create `server/http-types.ts` with exported interfaces currently needed by `server/http.ts`:

```ts
import type { IncomingMessage } from 'node:http'

export interface CurrentUserData {
  id: string
  email: string
  organization: { id: string; code: string; name: string }
  display_name: string
  status: string
  permissions: string[]
}

export interface ServerRepository {
  findUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string; organization_id: string; display_name: string; status: string } | null>
  createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>
  deleteSession(token: string): Promise<void>
  getSessionUser(token: string, workstationId?: string | null): Promise<CurrentUserData | null>
}

export interface RouteContext {
  request: Request
  nodeRequest?: IncomingMessage
  repository: ServerRepository
  traceId: string
}
```

If `server/http.ts` has extra methods on `ServerRepository`, move the full existing interface into this file instead of shrinking it.

- [ ] **Step 2: Create auth route module**

Create `server/modules/auth/auth-routes.ts`:

```ts
import { randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError, success } from '../../http-response'
import type { CurrentUserData, RouteContext } from '../../http-types'

const scrypt = promisify(scryptCallback)

export async function handleAuthRoute(context: RouteContext) {
  const url = new URL(context.request.url)
  const path = url.pathname
  const method = context.request.method

  if (method === 'POST' && path === '/api/v1/auth/login') {
    const body = await context.request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const user = await context.repository.findUserByEmail(email)
    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'AUTH_REQUIRED', 'Invalid email or password.')
    }
    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12)
    await context.repository.createSession({ token, userId: user.id, expiresAt })
    return { found: true, response: success({ access_token: token, expires_at: expiresAt.toISOString() }, context.traceId) }
  }

  if (method === 'POST' && path === '/api/v1/auth/logout') {
    const token = getBearerToken(context.request)
    if (token) await context.repository.deleteSession(token)
    return { found: true, response: success({}, context.traceId) }
  }

  return { found: false }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length)
}

export async function requireCurrentUser(repository: RouteContext['repository'], request: Request, traceId: string): Promise<CurrentUserData> {
  const token = getBearerToken(request)
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  const user = await repository.getSessionUser(token, request.headers.get('x-workstation-id'))
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  if (!user.organization?.id || !Array.isArray(user.permissions)) {
    throw new HttpError(500, 'INTERNAL_ERROR', `Invalid current user for trace ${traceId}.`)
  }
  return user
}

function createSessionToken() {
  return randomUUID()
}

async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, version, n, r, p, salt, storedKey] = passwordHash.split(':')
  if (scheme !== 'scrypt' || version !== 'v1') return false
  const key = await scrypt(password, salt, Buffer.from(storedKey, 'hex').length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return Buffer.from(key).toString('hex') === storedKey
}
```

- [ ] **Step 3: Wire auth route in `server/http.ts`**

At top-level request handling, before requiring current user for protected routes:

```ts
const authRoute = await handleAuthRoute({ request, repository: options.repository, traceId })
if (authRoute.found) return authRoute.response
```

Import:

```ts
import { handleAuthRoute, requireCurrentUser } from './modules/auth/auth-routes'
```

Remove duplicate login/logout/requireCurrentUser logic from `server/http.ts`.

- [ ] **Step 4: Verify**

Run:

```powershell
npm test -- server/http.test.ts
npm run typecheck
npm run lint
```

Expected: login/logout/current user tests still pass.

- [ ] **Step 5: Commit**

```powershell
git add server/http.ts server/http-types.ts server/modules/auth/auth-routes.ts
git commit -m "refactor: extract auth HTTP routes"
```

---

### Task 6: Split Sales And Finance Routes In Small Batches

**Files:**
- Create: `server/modules/sales/sales-routes.ts`
- Create: `server/modules/finance/finance-routes.ts`
- Modify: `server/http.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Move only sales route conditions first**

Move these exact routes from `server/http.ts` into `server/modules/sales/sales-routes.ts`:

```text
POST /api/v1/orders/checkout
POST /api/v1/orders/quotes
GET /api/v1/sales-documents
```

The module function signature:

```ts
export async function handleSalesRoute(context: AuthenticatedRouteContext) {
  return { found: false as const }
}
```

`AuthenticatedRouteContext` must include:

```ts
request: Request
url: URL
repository: ServerRepository
currentUser: CurrentUserData
traceId: string
```

- [ ] **Step 2: Verify sales behavior**

Run:

```powershell
npm test -- server/http.test.ts -t "checkout"
npm test -- server/http.test.ts -t "sales"
npm run typecheck
```

Expected: checkout and sales document tests pass.

- [ ] **Step 3: Commit sales split**

```powershell
git add server/http.ts server/http-types.ts server/modules/sales/sales-routes.ts
git commit -m "refactor: extract sales HTTP routes"
```

- [ ] **Step 4: Move finance route conditions**

Move these exact routes into `server/modules/finance/finance-routes.ts`:

```text
GET /api/v1/finance/accounts
GET /api/v1/finance/customer-debts
GET /api/v1/finance/customers/:id/debt
POST /api/v1/finance/debt-collections
GET /api/v1/finance/cashbook/balances
GET /api/v1/finance/cashbook/vouchers
GET /api/v1/finance/cashbook
POST /api/v1/finance/cashbook-vouchers
```

- [ ] **Step 5: Verify finance behavior**

Run:

```powershell
npm test -- server/http.test.ts -t "finance"
npm test -- server/http.test.ts -t "debt"
npm run typecheck
npm run lint
```

Expected: finance/debt tests pass.

- [ ] **Step 6: Commit finance split**

```powershell
git add server/http.ts server/http-types.ts server/modules/finance/finance-routes.ts
git commit -m "refactor: extract finance HTTP routes"
```

---

### Task 6B: Split Remaining Backend Routes

**Files:**
- Create: `server/modules/catalog/catalog-routes.ts`
- Create: `server/modules/purchase/purchase-routes.ts`
- Create: `server/modules/inventory/inventory-routes.ts`
- Create: `server/modules/production/production-routes.ts`
- Modify: `server/http.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Extract catalog routes**

Move these route groups:

```text
GET /api/v1/product-groups
GET /api/v1/products
POST /api/v1/products
GET /api/v1/customer-groups
GET /api/v1/customers
POST /api/v1/customers
POST /api/v1/pricing/resolve
GET /api/v1/price-lists
POST /api/v1/price-lists/formulas/preview
POST /api/v1/price-lists/formulas/apply
```

Run:

```powershell
npm test -- server/http.test.ts -t "customer"
npm test -- server/http.test.ts -t "product"
npm run typecheck
```

Expected: pass.

- [ ] **Step 2: Commit catalog split**

```powershell
git add server/http.ts server/modules/catalog/catalog-routes.ts
git commit -m "refactor: extract catalog HTTP routes"
```

- [ ] **Step 3: Extract purchase routes**

Move:

```text
GET /api/v1/suppliers
POST /api/v1/suppliers
GET /api/v1/suppliers/:id/receipts
POST /api/v1/suppliers/:id/payments
GET /api/v1/purchase/receipts
POST /api/v1/purchase/receipts
```

Run:

```powershell
npm test -- server/http.test.ts -t "supplier"
npm test -- server/http.test.ts -t "purchase"
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit purchase split**

```powershell
git add server/http.ts server/modules/purchase/purchase-routes.ts
git commit -m "refactor: extract purchase HTTP routes"
```

- [ ] **Step 5: Extract inventory and production routes**

Move:

```text
GET /api/v1/inventory/products
GET /api/v1/inventory/stock-movements
GET /api/v1/inventory/stocktakes
GET /api/v1/inventory/rolls
GET /api/v1/inventory/sheets
POST /api/v1/inventory/pos-shortage-preview
GET /api/v1/inventory/material-openings/options
POST /api/v1/inventory/material-openings
GET /api/v1/production-queue
GET /api/v1/production-queue/history
POST /api/v1/production-queue/:id/add-to-draft
```

Run:

```powershell
npm test -- server/http.test.ts -t "inventory"
npm test -- server/http.test.ts -t "production"
npm run typecheck
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit inventory/production split**

```powershell
git add server/http.ts server/modules/inventory/inventory-routes.ts server/modules/production/production-routes.ts
git commit -m "refactor: extract inventory and production routes"
```

---

### Task 7: Add Versioned Migration Runner

**Files:**
- Create: `database/migrations/README.md`
- Create: `database/migrations/0001_foundation.sql`
- Create: `database/migrations/0002_sales_finance.sql`
- Modify: `scripts/db-migrate.mjs`
- Create: `scripts/db-migrate.test.mjs`
- Create: `scripts/db-migrate-dry-run.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add migration test script coverage**

Ensure `package.json` test pattern already includes `scripts/*.test.mjs`. No change needed if current test script is:

```json
"test": "vitest run src scripts/*.test.mjs tests/e2e/*.test.ts"
```

- [ ] **Step 2: Create migration runner unit test**

Create `scripts/db-migrate.test.mjs`:

```js
import { describe, expect, test } from 'vitest'
import { planMigrations } from './db-migrate.mjs'

describe('planMigrations', () => {
  test('returns migrations not yet applied in lexical order', () => {
    const files = ['0002_sales_finance.sql', '0001_foundation.sql']
    const applied = new Set(['0001_foundation.sql'])
    expect(planMigrations(files, applied)).toEqual(['0002_sales_finance.sql'])
  })

  test('does not return already applied migrations', () => {
    const files = ['0001_foundation.sql']
    const applied = new Set(['0001_foundation.sql'])
    expect(planMigrations(files, applied)).toEqual([])
  })
})
```

- [ ] **Step 3: Run test and see failure**

Run:

```powershell
npm test -- scripts/db-migrate.test.mjs
```

Expected: fail because `planMigrations` is not exported.

- [ ] **Step 4: Implement migration planning**

In `scripts/db-migrate.mjs`, export:

```js
export function planMigrations(files, applied) {
  return files
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
    .filter((file) => !applied.has(file))
}
```

- [ ] **Step 5: Implement schema_migrations**

Update migrate script to:

```js
await client.query(`
  create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )
`)
```

For each pending file:

```js
await client.query('begin')
await client.query(sql)
await client.query('insert into schema_migrations (filename) values ($1)', [filename])
await client.query('commit')
```

Rollback on error:

```js
await client.query('rollback')
throw error
```

- [ ] **Step 6: Create migration files**

Split current `database/schema.sql`:

- `0001_foundation.sql`: organizations, users, workstations, permissions, user_permissions, sessions.
- `0002_sales_finance.sql`: pos_product_usage, orders, order_items, payment_receipts, payment_receipt_methods, customer_debt_entries, cashbook_entries.

- [ ] **Step 7: Add baseline stamping for existing DB**

Existing NAS/dev databases may already have tables from old `schema.sql`. The migration runner must support:

```powershell
$env:QCVL_MIGRATION_BASELINE='true'
npm run db:migrate
Remove-Item Env:\QCVL_MIGRATION_BASELINE
```

Behavior:

- Create `schema_migrations` if missing.
- If core tables already exist, insert existing migration filenames into `schema_migrations` without re-running destructive changes.
- Do not drop or rewrite any existing table.
- Print which migrations were baseline-stamped.

- [ ] **Step 8: Create dry-run command**

Add package script:

```json
"db:migrate:dry-run": "node scripts/db-migrate-dry-run.mjs"
```

Create `scripts/db-migrate-dry-run.mjs` to:

- read files in `database/migrations`
- validate filename format
- connect to DB only if `DATABASE_URL` exists
- print pending migrations
- never execute SQL

- [ ] **Step 9: Create migration README**

Create `database/migrations/README.md`:

```markdown
# QCVL Database Migrations

- Moi thay doi schema tao file moi theo mau `0003_name.sql`.
- Khong sua migration da chay tren NAS.
- DB cu da co bang tu `schema.sql` phai baseline bang `QCVL_MIGRATION_BASELINE=true`.
- Luon chay `npm run db:migrate:dry-run` truoc `npm run db:migrate`.
- Khong drop table/cot tren NAS neu chua co backup va lenh owner ro rang.
```

- [ ] **Step 10: Verify**

Run:

```powershell
npm test -- scripts/db-migrate.test.mjs
npm run db:migrate:dry-run
npm run typecheck
npm run lint
```

Expected: test/typecheck/lint pass.

- [ ] **Step 11: Commit**

```powershell
git add database/migrations scripts/db-migrate.mjs scripts/db-migrate.test.mjs scripts/db-migrate-dry-run.mjs package.json
git commit -m "feat: add versioned database migrations"
```

---

### Task 8: Split Finance Page UI Components

**Files:**
- Create: `src/features/finance/FinanceFiltersPanel.tsx`
- Create: `src/features/finance/FinanceDetailPanel.tsx`
- Modify: `src/features/finance/FinancePage.tsx`
- Test: `src/features/finance/FinancePage.test.tsx`

- [ ] **Step 1: Baseline test**

Run:

```powershell
npm test -- src/features/finance/FinancePage.test.tsx
```

Expected: pass before refactor.

- [ ] **Step 2: Extract filter panel**

Move only JSX for finance filter sidebar/header filter controls into `FinanceFiltersPanel.tsx`.

Component props:

```ts
export interface FinanceFiltersPanelProps {
  search: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
}
```

If more props are needed, add explicit props only for UI state and event handlers. Do not move API calls into this component.

- [ ] **Step 3: Verify**

Run:

```powershell
npm test -- src/features/finance/FinancePage.test.tsx
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Extract detail panel**

Move selected cashbook/debt detail JSX into `FinanceDetailPanel.tsx`.

Component props:

```ts
export interface FinanceDetailPanelProps {
  selectedId: string | null
  onClose: () => void
}
```

Add extra display props as needed from existing `FinancePage.tsx`; keep data fetching in parent for this batch.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/features/finance/FinancePage.test.tsx
npm run typecheck
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/features/finance/FinancePage.tsx src/features/finance/FinanceFiltersPanel.tsx src/features/finance/FinanceDetailPanel.tsx
git commit -m "refactor: split finance page UI panels"
```

---

### Task 9: Split POS Shell UI Components

**Files:**
- Create: `src/features/pos/PosTopbar.tsx`
- Create: `src/features/pos/PosCartPanel.tsx`
- Create: `src/features/pos/PosPaymentPanel.tsx`
- Modify: `src/features/pos/PosShell.tsx`
- Test: `src/features/pos/PosShell.test.tsx`

- [ ] **Step 1: Baseline test**

Run:

```powershell
npm test -- src/features/pos/PosShell.test.tsx
```

Expected: pass before refactor.

- [ ] **Step 2: Extract POS topbar**

Move logo/search/tabs/profile/menu JSX into `PosTopbar.tsx`.

Rules:

- Search behavior remains controlled by parent.
- Product suggestion rendering can stay in extracted topbar.
- No checkout/cashbook/debt logic in topbar.

- [ ] **Step 3: Verify**

Run:

```powershell
npm test -- src/features/pos/PosShell.test.tsx
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Extract cart panel**

Move cart table/footer/note/totals UI into `PosCartPanel.tsx`.

Rules:

- Use existing `pos-core.ts` for totals.
- Do not duplicate line amount logic.
- Keep event handlers passed from parent.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/features/pos/PosShell.test.tsx
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Extract payment panel**

Move customer/product grid/checkout drawer composition into `PosPaymentPanel.tsx` only if props stay readable. If props exceed 25 fields, stop and split smaller subcomponents first.

- [ ] **Step 7: Verify**

Run:

```powershell
npm test -- src/features/pos/PosShell.test.tsx
npm run typecheck
npm run lint
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add src/features/pos/PosShell.tsx src/features/pos/PosTopbar.tsx src/features/pos/PosCartPanel.tsx src/features/pos/PosPaymentPanel.tsx
git commit -m "refactor: split POS shell UI"
```

---

### Task 10: Internal Operations Checklist

**Files:**
- Create: `docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md`
- Modify: `docs/PROJECT-IMPROVEMENT-ROADMAP.md`

- [ ] **Step 1: Create checklist**

Create `docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md`:

```markdown
# QCVL Internal Ops Checklist

> Cap nhat: 2026-07-09. Dung cho van hanh noi bo qua NAS/Tailscale.

## Hang Ngay

- Mo `http://100.84.228.125:3200/api/v1/health` hoac chay `npm run health:nas`.
- Kiem tra POS tao hoa don duoc.
- Kiem tra Sales Documents co hoa don moi.
- Kiem tra Finance co phieu thu khi hoa don co thanh toan.

## Truoc Khi Deploy NAS

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build:nas`
- `npm run verify:nas-bundle`

## Sau Khi Deploy NAS

- `npm run health:nas`
- Neu co password smoke trong env: `npm run smoke:nas`
- Mo `/pos`, `/sales-documents`, `/finance`, `/customers`.
- Neu co thay doi DB/sales/finance: chay `npm run verify:sales-finance-persistence` truoc va sau restart.

## Hang Tuan

- Backup PostgreSQL NAS.
- Kiem tra dung luong volume NAS.
- Kiem tra Git `main` da push sau khi deploy.
- Quet secret trong repo:

```powershell
rg -n "PASSWORD='[^<]|TOKEN='[^<]|DATABASE_URL=postgres://[^<]|L[a]m650909@1" docs scripts server src .github --glob '!docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md'
```
```

- [ ] **Step 2: Link roadmap**

Add link in `docs/PROJECT-IMPROVEMENT-ROADMAP.md`:

```markdown
Xem checklist van hanh: `docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md`.
```

- [ ] **Step 3: Verify docs do not contain real secret**

Run:

```powershell
rg -n "L[a]m650909@1|PASSWORD='[^<]|TOKEN='[^<]|DATABASE_URL=postgres://[^<]" docs scripts server src .github --glob '!docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md'
```

Expected: no real secret values.

- [ ] **Step 4: Commit**

```powershell
git add docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md docs/PROJECT-IMPROVEMENT-ROADMAP.md
git commit -m "docs: add internal operations checklist"
```

---

## Final Verification Before Merge Or Push

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build:nas
npm run verify:nas-bundle
npm run health:nas
git grep -nE "(PASSWORD='[^<]|TOKEN='[^<]|DATABASE_URL=postgres://[^<]|L[a]m650909@1)" -- docs scripts server src .github --glob '!docs/superpowers/plans/2026-07-09-qcvl-system-hardening.md'
git status --short
```

Expected:

- lint exit 0
- typecheck exit 0
- test all pass
- build NAS exit 0
- NAS bundle verify exit 0
- health NAS returns `status: "ok"`
- secret scan prints nothing except scan-command text if checked manually
- working tree clean after final commit

## Execution Order

Recommended order:

1. Task 0
2. Task 1
3. Task 2
4. Task 3
5. Task 4
6. Task 5
7. Task 6 sales split only
8. Task 6 finance split
9. Task 6B
10. Task 7
11. Task 8
12. Task 9
13. Task 10

Stop and re-run full verification after Task 3, Task 6, Task 6B, Task 7, and Task 9 because those touch deploy/backend/DB/UI core.

## Self-Review

- Spec coverage: covers secret hygiene without password change, NAS build/deploy standardization, backend split, migration versioning with baseline safety, large UI page split, and internal ops docs.
- Placeholder scan: placeholders only use angle-bracket examples for secrets/users and are intentional non-secret values. Literal leaked password is not written directly; scan pattern uses regex-safe spelling to avoid matching the plan itself.
- Type consistency: route context names stay `RouteContext` and `AuthenticatedRouteContext`; scripts use `QCVL_NAS_*` env names consistently.
