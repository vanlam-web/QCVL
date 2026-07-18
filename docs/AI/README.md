# TeamAI Coordination

Updated: 2026-07-18

This folder documents the live coordination channel for the two QCVL Codex workers.

## Shared NAS Folder

Use:

```text
Y:\TeamAI
```

Live board:

```text
Y:\TeamAI\WORKER-NOW.md
```

## Rule

Before taking work:

1. `git pull --ff-only`
2. `npm run preflight`
3. Read `Y:\TeamAI\WORKER-NOW.md`
4. Write your worker, scope, files, page/API, and next step
5. Work only after the board shows no conflict

After finishing:

1. run focused tests
2. commit and push when Owner asks or when the slice must be shared
3. update `Y:\TeamAI\WORKER-NOW.md` with commit hash and next owner

## Roles

- outside-LAN worker: current thread unless updated on the board
- inside-LAN worker: LAN/NAS runtime work unless updated on the board

## Git Still Wins

`Y:\TeamAI` is for live coordination only. Git remains the source for history, merge, and code/doc truth.

## Board Template

```markdown
# TeamAI Worker Now

Updated: YYYY-MM-DD HH:mm

## Active Scopes

| Worker | Scope | Files | Page/API | Status | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| outside-LAN | idle | - | - | ready | pull before work | - |
| inside-LAN | idle | - | - | ready | pull before work | - |

## Rules

- Read this file before editing.
- Do not edit another worker's active files.
- If conflict appears, stop and ask Owner.
- After push, write commit hash here.
```
