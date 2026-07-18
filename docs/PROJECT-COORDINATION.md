# Project Coordination

Updated: 2026-07-18

Use this board to avoid overlap between the two active Codex workers.

## Workers

| Worker | Role now | Default surface |
| --- | --- | --- |
| Outside LAN | Current thread. Owns docs/preflight coordination slice. | `100.84.228.125:3200` for observation, repo edits local |
| Inside LAN | Direct LAN/NAS worker. Owns runtime checks unless Owner assigns otherwise. | `192.168.1.188:3200` / NAS LAN |

No other Codex workers are active.

## Start Rule

Before editing:

```powershell
git pull --ff-only
npm run preflight
```

Then state scope in chat:

- worker: outside LAN or inside LAN
- module/files
- page/API
- target environment

Also read and update `Y:\TeamAI\WORKER-NOW.md` with the scope you took before changing files.

## Conflict Rule

- Do not edit the same module/file from both workers at once.
- If `git pull --ff-only` fails, stop and report.
- If local changes appear in files you did not touch, stop and report.
- If Owner assigns a handoff, write the new owner and next step here.

## Active Board

### DOC-GATE-2026-07-18

- Owner: outside-LAN worker.
- Scope: `scripts/preflight.mjs`, `scripts/preflight.test.mjs`, `package.json`, `AI_TEAM_RULES.md`, `docs/WORKER-START-HERE.md`, `docs/PROJECT-COORDINATION.md`, `docs/DOCUMENT_RULES.md`, `docs/README.md`.
- Goal: force a light preflight and make AI docs short/current-first.
- Status: completed; waiting for commit/push.
- Next: inside-LAN worker pulls after push.
- Risk: low; docs/scripts only.

### RUNTIME-PERF-3200

- Owner: unassigned until Owner gives scope.
- Current fact: `2179dc8 perf: cut 3200 route hot paths` is on `main`.
- Known hotspots from LAN scan: `/sales-documents`, `/products`, `/inventory`, some detail routes.
- Rule: do not continue runtime perf edits from this docs slice without new scope.

## Handoff Template

```text
Worker:
Scope:
Files:
Page/API:
Status:
Next:
Commit:
Blocked:
```
