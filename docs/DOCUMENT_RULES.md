# Document Rules

Updated: 2026-07-18

This file governs `docs/`. Keep docs useful for future AI work: short, current-first, linked to deeper sources.

## Priority Order

When sources disagree, use this order:

1. Latest Owner decision in chat.
2. `AI_TEAM_RULES.md`.
3. `docs/WORKER-START-HERE.md`.
4. This file.
5. `docs/ARCHITECTURE.md` and layer `_RULES.md`.
6. Feature docs.
7. Old plans/history.

Old plans under `docs/superpowers/plans/` are historical unless Owner explicitly says to follow one.

## Required Shape

Every living doc should start with:

- purpose
- updated date
- current rule/status first
- links to deeper files instead of repeated history

Keep long timelines out of first-read docs. If history matters, summarize the latest fact and link to the original evidence.

During the 2026-07 docs cleanup wave, track open cleanup items in [DOC-CLEANUP-CHECKLIST.md](./DOC-CLEANUP-CHECKLIST.md) (temporary). Prefer module README “3 lớp” over repeating status in many satellite files.

## Editing Rule

Before changing docs:

```powershell
npm run preflight
```

Then:

- read the current file
- read directly linked rule/source files
- update only the scope Owner asked for
- keep one source of truth for each fact
- check links and `git diff`

## What Goes Where

| Content | File area |
| --- | --- |
| AI working rules | `AI_TEAM_RULES.md` |
| short worker entry | `docs/WORKER-START-HERE.md` |
| two-machine coordination | `docs/PROJECT-COORDINATION.md` |
| runtime data truth | `docs/CURRENT-DATA-SOURCE.md` |
| UI/UX behavior | `docs/02-PRD-UX-PhongCanh/` |
| business rules | `docs/03-BUSINESS-NghiepVu/` |
| schema | `docs/04-DATABASE/` and `database/migrations/` |
| API/server behavior | `docs/05-BACKEND-MayChu/` |
| deploy/ops | `docs/07-DEPLOYMENT-TrienKhai/` |

## Do Not

- Do not copy huge old logs into first-read docs.
- Do not use fake links like `http://FILE.md`.
- Do not put runtime secrets, DB dumps, backups, or temp logs in docs.
- Do not document a business behavior that code does not support unless marked as planned.
- Do not let a lower-level doc override Owner decision or `AI_TEAM_RULES.md`.

## Verification

For doc-only changes, run:

```powershell
npm run preflight
npx vitest run scripts/preflight.test.mjs scripts/test-script-scope.test.mjs
```

If Vietnamese text changed, also scan changed files for mojibake.
