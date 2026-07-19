# TeamAI Shared Status

Updated: 2026-07-18

`Y:\TeamAI` is a shared status notebook for the two QCVL Codex workers. It is not a task assignment board.

Use it so each worker knows:

- what the other worker already changed
- which files are currently being touched
- which commit needs to be pulled
- whether NAS/runtime was restarted or only copied
- what must be checked before editing the same area

Live status file:

```text
Y:\TeamAI\WORKER-NOW.md
```

## Before Editing Repo

1. Read `Y:\TeamAI\WORKER-NOW.md`.
2. Run `git pull --ff-only`.
3. Run `npm run preflight`.
4. Update `WORKER-NOW.md` with your active scope before editing files.
5. If another worker has an active file/module, avoid that area.
6. If `WORKER-NOW.md` says a commit was pushed, pull it before editing.
7. When you finish a task, read `Y:\TeamAI\WORKER-NOW.md` again before starting the next one.

`preflight` fails outside CI if `WORKER-NOW.md` is missing or malformed.

Required board markers:

- `# TeamAI Worker Now`
- `## Shared Repo State`
- `Latest pushed commit to pull`
- `## Worker Status`
- `| outside-LAN |`
- `| inside-LAN |`

## While Working

Update `WORKER-NOW.md` only as status:

- worker name
- module/page/API being touched
- files being touched
- current state: active, completed, blocked, or idle
- latest commit/hash if pushed
- pull/restart/smoke note for the other worker

Do not use this folder to assign work to the other worker. Owner decides scope. Workers use this folder to avoid overlap and keep shared context.

## After Finishing

1. Run focused verification.
2. If code was pushed, write the commit hash.
3. If NAS was deployed/copied/restarted, write that fact.
4. Mark status idle when no file is being held.
5. Leave a short note if the other worker must pull before touching repo.

## Git Still Wins

`Y:\TeamAI` is a live coordination notebook only. Git remains the source of truth for code, docs, history, and merge safety.

## Status Template

```markdown
# TeamAI Worker Now

Updated: YYYY-MM-DD HH:mm

## Shared Repo State

- Latest pushed commit to pull:
- NAS/runtime note:
- DB note:

## Worker Status

| Worker | Current state | Area | Files being touched | Last pushed commit | Other worker must know |
| --- | --- | --- | --- | --- | --- |
| outside-LAN | idle | - | - | - | pull before editing |
| inside-LAN | idle | - | - | - | pull before editing |

## Rules

- This is status, not task assignment.
- Read before editing.
- Pull listed commits before editing repo.
- Do not touch files another worker marks active.
- If conflict appears, stop and ask Owner.
```
