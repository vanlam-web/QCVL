# QCVL Codex Working Rules

Version: 2026-07-10

Read this file before working in this repo. These are the active rules for QCVL now.

## 1. Current Project

- Project name: QCVL.
- Owner tests mainly on `127.0.0.1:3202`.
- NAS test/deploy surface is `http://100.84.228.125:3200`.
- Main local workspace is `D:\Phần mềm\QCVL`.
- Runtime stack: React/Vite frontend, Node API in `server/`, PostgreSQL on NAS.
- QCVL does not use Supabase for runtime.

## 2. Source Of Truth

Use this order when chat, docs, code, and old plans differ:

1. Latest Owner decision in the current chat.
2. Current docs that were updated for that decision.
3. Current code.
4. Older plans/history only for context.

If code and Owner decision differ, treat it as drift and fix or report it.

## 3. Dev And NAS Parity

Keep `3202` and `3200` aligned.

- Treat `127.0.0.1:3202` as dev test surface.
- Treat `100.84.228.125:3200` as NAS deploy surface.
- If `3202` runs against NAS PostgreSQL, writes/import/delete on `3202` also change `3200` data.
- This shared-DB setup is acceptable while real data is still replaceable/importable.
- If later data becomes important, split dev DB from NAS DB before risky testing.

Required deploy path:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
```

`deploy:nas` must:

- build NAS bundle
- verify bundle does not call wrong port
- copy runtime files
- run `db:migrate`
- run `health:nas`

After deploy, run or report environment status. NAS must show:

```text
pending: []
in_sync: true
```

If `3200` fails but `3202` works, check DB migration/schema parity before changing UI or adding workaround code.

## 4. Database Rules

PostgreSQL is source of truth for runtime data.

For any DB-affecting change:

- Add a SQL migration in `database/migrations`.
- Keep runtime schema guards in code if useful, but do not rely on guards alone.
- Do not run schema guards from read/list API hot paths. Read APIs assume migrations have already made schema ready.
- Run migration dry-run or status check before deploy.
- Do not silently change money, debt, inventory, document, or import semantics without docs/test.

Important command:

```powershell
npm run db:migrate:dry-run
```

## 5. Import And Data Rules

- KiotViet import data is real evidence, not fake UI data.
- Product import owns catalog, groups, units, prices if present, provisional stock, and draft BOM.
- Stocktake import owns KiotViet stocktake history only.
- KiotViet stocktake history must not overwrite QCVL operating stock.
- If import UI has delete/reset, make the scope explicit: delete old import data for that page, not unrelated business data.
- If `3202` uses NAS DB, import/delete on `3202` changes `3200` immediately.

## 6. Docs Rules

When a decision changes future work, write it down so Owner does not need to repeat it.

Common docs:

- `docs/07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md` for dev/NAS/deploy rules.
- `docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md` for operating checklist.
- `docs/superpowers/plans/` for multi-step implementation plans.
- Feature-specific docs under `docs/02-PRD-UX-PhongCanh`, `docs/04-DATABASE`, and `docs/05-BACKEND-MayChu`.

Do not copy docs to NAS unless explicitly needed. NAS runtime needs app/build/source/config/database/scripts, not docs.

## 7. Work Style

- Read relevant files before changing code.
- Keep changes scoped to the request.
- Prefer existing patterns and shared CSS/components.
- Separate UI shell from business/data logic.
- Do not refactor unrelated code.
- Do not revert user changes unless explicitly requested.
- When uncertain but safe to proceed, choose the simplest defensible option and record the tradeoff.
- Ask Owner before changing business behavior that affects money, debt, inventory, invoices, or imports.

## 8. Verification

Before saying work is done, run relevant verification and report exact result.

Common commands:

```powershell
npm run api:build
npx vitest run <focused tests>
npm run env:status
npm run health:nas
```

For frontend/UI changes, test in browser when feasible.

For deploy-related work, verify:

- build passes
- migration applies or status is in sync
- health endpoint returns OK
- touched APIs/pages return data

## 9. Git

- Do not commit or push unless Owner asks.
- Do not include secrets, database dumps, or backup data in Git.
- Keep temporary logs/files out of commits unless intentionally tracked.

## 10. Current Standing Rule

Build and test on `3202`. When Owner approves, deploy to `3200` using the script. Any DB change must go through migration so NAS does not lag behind dev.
