# QCVL Codex Working Rules

Version: 2026-07-18

Read [docs/WORKER-START-HERE.md](docs/WORKER-START-HERE.md) first, then this file before working in this repo.

## 1. Preflight Gate

Run this before editing, testing, building, or deploying:

```powershell
npm run preflight
git pull --ff-only
```

`preflight` checks the required current docs:

- `docs/WORKER-START-HERE.md`
- `AI_TEAM_RULES.md`
- `docs/PROJECT-COORDINATION.md`
- `docs/DOCUMENT_RULES.md`
- `docs/CURRENT-DATA-SOURCE.md`

After reading them, state the scope you are taking in chat: module, files, page/API, and environment.

## 2. Current Project

- Project: QCVL.
- Dev UI: `http://127.0.0.1:3202`.
- Dev API: `http://127.0.0.1:3100`.
- NAS runtime: `http://100.84.228.125:3200`.
- Stack: React/Vite frontend, Node API in `server/`, PostgreSQL on NAS.
- Runtime does not use Supabase.

## 3. Source Of Truth Order

Use this order when chat, docs, code, and old plans differ:

1. Latest Owner decision in the current chat.
2. Current docs updated for that decision.
3. Current code.
4. Old plans/history only for context.

If code and Owner decision differ, treat it as drift and fix or report it.

## 4. Two-Machine Rule

Owner works with exactly two Codex workers:

- outside-LAN worker: this thread
- inside-LAN worker: direct LAN/NAS work

Every worker must:

- run `git pull --ff-only` before edits
- read `docs/PROJECT-COORDINATION.md`
- state scope before touching files
- avoid editing the same feature/module/files as the other worker
- stop and report if overlap appears
- commit and push only when Owner asks

`main` on `origin` is the shared Source of Truth unless Owner explicitly assigns a branch.

## 5. Dev And NAS Parity

- Keep `3202` and `3200` aligned.
- Build/test on `3202` first.
- Deploy to `3200` only through `npm run deploy:nas`.
- If `3200` fails but `3202` works, check migration/schema/data parity before UI workaround.
- If `3202` points to NAS PostgreSQL, writes on `3202` also affect `3200`.
- `logs/dev-memory-state.json` is local test state only. Do not copy it to NAS.

Deploy command:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
```

## 6. Data And DB Rules

PostgreSQL is runtime source of truth for sales, finance, customer debt, stock, import state, and users.

For DB-affecting work:

- add SQL migration in `database/migrations`
- keep read/list APIs free of schema guard work
- run migration dry-run/status before deploy
- do not change money, debt, inventory, invoice, or import behavior without doc/test

Useful command:

```powershell
npm run db:migrate:dry-run
```

## 7. Work Style

- Read relevant feature docs before code.
- Keep changes scoped.
- Prefer existing patterns and shared components.
- Separate UI shell from business/data logic.
- Do not refactor unrelated code.
- Do not revert user changes unless explicitly requested.
- Ask Owner before changing business behavior that affects money, debt, inventory, invoices, imports, or permissions.

Vietnamese encoding:

- Do not copy Vietnamese text from terminal output into source files.
- Type real UTF-8 text directly in patches.
- After touching Vietnamese text, scan changed files for mojibake markers such as broken `C`/`A` accented sequences from PowerShell output.

## 8. Verification

Before saying work is done, run focused verification and report exact result.

Common commands:

```powershell
npm run api:build
npx vitest run <focused tests>
npm run env:status
npm run health:nas
```

For UI changes, verify in browser when feasible. For deploy work, verify build, migration, health, and touched pages/APIs.

## 9. Git

- Do not commit or push unless Owner asks.
- Do not include secrets, DB dumps, backups, or temp logs.
- After pushing, report commit hash so the other machine can pull.

## 10. Standing Rule

Build and test on `3202`. Deploy to `3200` only after Owner approval. Any DB change must go through migration so NAS does not lag behind dev.
