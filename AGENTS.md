# AGENTS.md

Project-wide agent guidance. See also `AI_TEAM_RULES.md` and `docs/WORKER-START-HERE.md` for the human/worker workflow.

## Cursor Cloud specific instructions

QCVL / QC-OMS is a Vietnamese POS/ERP: a React + Vite frontend (`src/`), a Node HTTP API (`server/`, entry `server/index.ts`), and PostgreSQL as the production runtime data source. Node 22 is required (see `.nvmrc`). Dependencies are installed automatically by the startup update script (`npm ci`).

Non-obvious caveats (the standard commands themselves live in `package.json` `scripts` and CI in `.github/workflows/ci.yml`):

- Preflight gate blocks most scripts. `lint`, `typecheck`, `test`, and `build`/`build:all` run `scripts/preflight.mjs` (via `prebuild`/`pretest`), which requires the shared TeamAI board at `Y:\TeamAI\WORKER-NOW.md` — a Windows path that does not exist here. Preflight skips that check only when `CI=true`. Run these commands with `CI=true`, e.g. `CI=true npm test`. (Alternatively point `QCVL_TEAMAI_DIR` at a directory containing a valid `WORKER-NOW.md`.)
- Tests assume the Vietnam timezone. Several date/time tests hard-code `Asia/Ho_Chi_Minh` (UTC+7) expectations. Run the suite as `CI=true TZ=Asia/Ho_Chi_Minh npm test`, otherwise date-format / POS clock tests fail with a 7-hour offset.
- Running the app in dev needs two processes: `npm run api:dev` (API on port 3100, `tsx watch`) and `npm run dev` (Vite; start with `-- --host 127.0.0.1 --port 5173`). In dev the frontend calls `/api` and Vite proxies it to `127.0.0.1:3100` (see `vite.config.ts`); do not set `VITE_API_BASE_URL` for local dev.
- API storage backend is chosen by env. With no `DATABASE_URL` (and no `POSTGRES_*`), the API uses an in-memory repository that persists to `logs/dev-memory-state.json` (health reports `"persistence":"memory"`). With `DATABASE_URL` set it uses PostgreSQL and you must run `npm run db:migrate` first (needs `ADMIN_PASSWORD`; seeds the `VAN-LAM` org + admin). No local Postgres is provisioned by default; in-memory mode is the simplest way to run.
- Dev login: POST `login` (username, e.g. `admin`) + `password` — the JSON field is `login`, not `username`. In in-memory mode the admin password comes from `QCVL_DEV_PASSWORD` (default `ChangeMe123!`). Auth returns a Bearer `access_token`; there is no cookie session.
- A fresh in-memory (or freshly migrated) database has no products/customers; create them through the UI/API. `scripts/seed-dev20-data.mjs` is stale (it targets Supabase-era tables like `profiles`/`production_machines`/`finance_accounts` that current migrations do not create) and will not seed a fresh DB.
- e2e (`npm run test:e2e`, Playwright) is not runnable from a clean checkout: it requires a populated PostgreSQL (specific fixtures like customer `KH000001` / product "Standee chữ X"). CI only runs `test:e2e:list`.
- Known pre-existing red state (not an environment problem): `npm run lint` reports errors and ~6 `src/features/pos/CheckoutPanel.test.tsx` tests fail; `main` CI is red on `lint` as well. `typecheck` and `build:all` pass.
