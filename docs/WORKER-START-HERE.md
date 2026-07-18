# QCVL Worker Start Here

Updated: 2026-07-18

This is the first file for any Codex worker. Keep it short and current.

## Current Reality

- Only two Codex workers are active:
  - outside-LAN worker: this thread
  - inside-LAN worker: direct LAN/NAS work
- Shared branch: `main`.
- Shared Source of Truth: `origin/main`.
- Dev surface: `http://127.0.0.1:3202`.
- NAS surface: `http://100.84.228.125:3200`.
- Runtime data source: PostgreSQL on NAS.
- Runtime does not use Supabase.

## Start Every Task

```powershell
npm run preflight
git pull --ff-only
```

Then state:

- worker location: outside LAN or inside LAN
- scope: module, files, page/API
- target: `3202`, `3200`, docs only, or deploy

## Read Order

1. `AI_TEAM_RULES.md`
2. `docs/PROJECT-COORDINATION.md`
3. `docs/CURRENT-DATA-SOURCE.md`
4. feature docs for touched page/API
5. current code

Old plans under `docs/superpowers/plans/` are historical context only unless Owner explicitly says to follow one.

## Current Work Split

- Outside-LAN worker owns this slice: preflight gate and concise worker docs.
- Inside-LAN worker owns direct LAN/NAS runtime checks unless Owner hands off another scope.
- Do not edit the same module/file from both machines at the same time.

## Stop Before Changing

Stop and ask Owner before changing:

- money, debt, invoice lifecycle, inventory, import semantics, permissions
- NAS deploy behavior
- DB schema without migration
- files already changed by the other worker

## Good Finish

Before final report:

- run focused tests
- run `git status --short`
- commit and push only if Owner asked
- report commit hash when pushed
