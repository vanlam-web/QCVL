# QCVL Worker Start Here

Updated: 2026-07-18

This is the first file for any Codex worker. Keep it short and current.

## Current Reality

- Only two Codex workers are active:
  - outside-LAN worker: this thread
  - inside-LAN worker: direct LAN/NAS work
- Shared branch: `main`.
- Shared Source of Truth: `origin/main`.
- Shared live coordination board: `Y:\TeamAI\WORKER-NOW.md`.
- Dev surface: `http://127.0.0.1:3202`.
- NAS surface: `http://100.84.228.125:3200`.
- Runtime data source: PostgreSQL on NAS.
- Runtime does not use Supabase.
- For local `3202` bugs, verify actual `3100`/`3202` process command lines before editing; API and UI can be running from different repo folders.

## Start Every Task

```powershell
git pull --ff-only
npm run preflight
```

Then state:

- worker location: outside LAN or inside LAN
- scope: module, files, page/API
- target: `3202`, `3200`, docs only, or deploy

If target is `3202`, run:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '3100|3202|server/index|vite|tsx' } | Select-Object ProcessId,CommandLine
```

Patch/pull/restart the repo that is actually serving `3100`; do not assume it matches the current shell folder.

Before editing files, read and update `Y:\TeamAI\WORKER-NOW.md` with your active scope. After finishing a task, read it again before starting the next task so new pull / restart / overlap notes are not missed. `preflight` also validates this board so a missing or malformed shared status file blocks local test/build/deploy scripts.

## Read Order

1. `AI_TEAM_RULES.md`
2. `docs/AI/README.md`
3. `docs/PROJECT-COORDINATION.md`
4. `docs/CURRENT-DATA-SOURCE.md`
5. feature docs for touched page/API
6. current code

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
