# Dev NAS Environment Parity Implementation Plan


> **Historical plan (2026-07 docs cleanup):** File này là lịch sử triển khai. SoT hiện hành + runtime: `docs/DOC-CLEANUP-CHECKLIST.md`, `docs/03-BUSINESS-NghiepVu/Inventory/README.md`, `docs/03-BUSINESS-NghiepVu/Sales/README.md`, `docs/03-BUSINESS-NghiepVu/BOM/`. Owner 2026-07-20: **không mở đợt import KiotViet mới**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dev `3202` and NAS `3200` deploy through the same code/schema path so accepted dev changes can be promoted to NAS without repeated production-only fixes.

**Architecture:** Keep source changes local first, record DB changes as migrations, and make NAS deploy run migrations before health checks. Treat code copy alone as incomplete deploy. Use environment status scripts to compare migration state before and after deploy.

**Tech Stack:** React/Vite frontend, Node API, PostgreSQL, SQL migrations in `database/migrations`, PowerShell/Node deploy scripts.

---

## Standing Rule Added 2026-07-11

Dev `3202` must not lose imported test data on every API restart.

- If dev API `3100` has `DATABASE_URL`, it uses PostgreSQL.
- If dev API `3100` has no `DATABASE_URL`, it must use dev-memory state file `logs/dev-memory-state.json`.
- Restarting `3100` with a blank memory repository is not acceptable during product/import testing.
- `logs/dev-memory-state.json` is local-only and must not be deployed to NAS.
- NAS `3200` remains PostgreSQL-only; health must report `persistence: "postgres"`.

Reason: Owner imports KiotViet files on `3202` to verify Hang hoa/Kiem kho. Losing that data after each code restart forces repeated import and hides real regressions.

---

### Task 1: Catalog/Inventory Migration

**Files:**
- Create: `database/migrations/0003_catalog_inventory_import.sql`
- Test: `scripts/db-migrate.test.mjs`

- [x] Add idempotent SQL for product catalog, inventory units, price lists, KiotViet provisional stock, stocktakes, and draft BOM tables.
- [x] Include `alter table ... add column if not exists` for old NAS tables.
- [x] Include unique indexes used by import `on conflict`.
- [x] Run: `npm run db:migrate:dry-run`

Expected: migration list includes `0003_catalog_inventory_import.sql` when target DB has not applied it.

### Task 2: Deploy Must Migrate

**Files:**
- Modify: `scripts/deploy-nas.mjs`
- Modify: `package.json`

- [x] Read NAS `.env` from `\\100.84.228.125\docker\QCVL\.env` unless `QCVL_NAS_DATABASE_URL`/`DATABASE_URL` already supplied.
- [x] After copying code/database files, run `npm run db:migrate` against NAS DB before `health:nas`.
- [x] Keep deploy dry-run non-destructive: print intended migration step instead of connecting.
- [x] Run: `$env:QCVL_NAS_DEPLOY_CONFIRM='true'; npm run deploy:nas`

Expected: deploy output shows migration result before health check.

### Task 3: Environment Status

**Files:**
- Create: `scripts/env-status.mjs`
- Modify: `package.json`

- [x] Report base URL health and DB migration state for a target environment.
- [x] Support `QCVL_ENV_BASE_URL`, `DATABASE_URL`, and optional `QCVL_ENV_NAME`.
- [x] Run against NAS:

```powershell
$env:QCVL_ENV_NAME='nas'
$env:QCVL_ENV_BASE_URL='http://100.84.228.125:3200'
npm run env:status
Remove-Item Env:\QCVL_ENV_NAME
Remove-Item Env:\QCVL_ENV_BASE_URL
```

Expected: JSON shows health `ok`, applied migrations, and pending migrations.

### Task 4: Documentation Contract

**Files:**
- Modify: `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md`

- [x] Add rule: every DB-affecting change done on `3202` must create a migration.
- [x] Add promotion checklist: local test, migration dry-run, NAS deploy, status check, smoke/import check.
- [x] Add incident lesson: code parity without schema parity is not parity.

### Task 5: Verification

**Files:**
- Modify only if failures expose missing coverage.

- [x] Run: `npm run api:build`
- [x] Run: `npx vitest run scripts/db-migrate.test.mjs server/db.test.ts server/http.test.ts`
- [x] Run NAS deploy when owner approves.
- [x] Verify `http://100.84.228.125:3200/api/v1/health`.
- [x] Verify products and inventory APIs return 200.

---

## Self-Review

Spec coverage: plan covers same schema, deploy promotion, migration logging, and avoiding code-only NAS deploy.

Placeholder scan: no TBD/TODO placeholders.

Type consistency: script/env names are stable: `QCVL_NAS_DATABASE_URL`, `QCVL_ENV_BASE_URL`, `QCVL_ENV_NAME`.
