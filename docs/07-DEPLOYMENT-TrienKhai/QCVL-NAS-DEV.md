# QCVL NAS Dev Runbook

> Last updated: 2026-07-08

This file records the current QCVL NAS setup after the clean fork was created from QC-OMS work. It is the current deployment reference for the NAS development instance.

## Current Status

| Item | Value |
|---|---|
| Project name | QCVL |
| Local workspace | `D:\Phần mềm\QCVL` |
| Git remote | `https://github.com/vanlam-web/QCVL.git` |
| Main branch | `main` |
| NAS app URL | `http://100.84.228.125:3200` |
| NAS app share | `\\100.84.228.125\docker\QCVL\app` |
| NAS container app port | container `3100`, host `3200` |
| NAS database | PostgreSQL 16 container `qcvl-postgres` |
| NAS database host port | `55433` |
| Runtime mode | `nas-dev` |

The app currently runs as a Node/Vite/React app with a lightweight Node API on the NAS. Supabase is not the runtime source for auth/API in the NAS build.

## Current User-Facing Routes

These routes are expected to load on the NAS build:

```text
/login
/dashboard
/account
/pos
/admin
/products
/price-book
/customers
/suppliers
/purchase/receipts
/inventory
/finance
/reports
/sales-documents
/sales-documents/:id/quote-print
/forbidden
```

Recent verified route/menu change:

- `/inventory` exists and is visible in the main menu as `Kiểm kho`.
- `Kiểm kho` requires `perm.manage_inventory`.

## Build And Deploy

Build locally for NAS:

```powershell
$env:VITE_API_BASE_URL='http://100.84.228.125:3200'
$env:VITE_APP_ENV='nas-dev'
Remove-Item Env:\VITE_ENABLE_PWA -ErrorAction SilentlyContinue
cmd /c npm run build
```

Deploy built frontend to NAS:

```powershell
robocopy 'D:\Phần mềm\QCVL\dist' '\\100.84.228.125\docker\QCVL\app\dist' /MIR /NFL /NDL /NJH /NJS /NP
```

When deploying source changes for the NAS container build, copy the changed source file(s) to:

```text
\\100.84.228.125\docker\QCVL\app
```

The NAS `docker-compose.nas.yml` maps:

```text
host 3200 -> container 3100
host 55433 -> postgres 5432
```

## Verification Commands

Run before claiming a UI/source change is ready:

```powershell
cmd /c npm run typecheck
cmd /c npm run test
cmd /c npm run build
```

Focused test example for menu/shell work:

```powershell
cmd /c npx vitest run src/components/ui-shell/AppShell.test.tsx
```

Browser smoke checks used for NAS:

```text
http://100.84.228.125:3200/login
http://100.84.228.125:3200/dashboard
http://100.84.228.125:3200/pos
http://100.84.228.125:3200/inventory
```

## Auth Notes

- `admin` login is normalized to the local admin account shape used by QCVL.
- Current NAS login is handled by the QCVL Node API, not by Supabase Auth.
- Do not commit passwords or NAS secrets to docs.

## Known Legacy From QC-OMS

QCVL still contains many historical docs, scripts, dependencies, and wording from the older Supabase-based QC-OMS architecture. Those files are useful context, but they are not all current runtime truth for the NAS dev instance.

Treat this file plus the actual code/config as the current NAS deployment truth until the older docs are cleaned.

Known legacy areas:

- Some docs still describe Supabase Auth, Supabase Edge Functions, Supabase Realtime, and Vercel staging.
- Some package scripts and dependencies still reference Supabase for older tests/import flows.
- The POS connection dot currently reflects the old realtime access-channel state. In the NAS app, no realtime client is wired, so that dot can show red even when the NAS API is working.

## Network Notes

- NAS Tailscale IP: `100.84.228.125`.
- Tailscale direct path was verified after forwarding UDP `41641` to the NAS LAN IP.
- SMB over Tailscale is expected to be slower than LAN because the bottleneck is mostly NAS-site internet upload and protocol overhead.

## Source Separation

There are two related local folders:

| Folder | Meaning |
|---|---|
| `D:\Phần mềm\QCVL` | Clean QCVL project, current NAS dev target |
| `D:\Phần mềm\QC-OMS` | Older migration/work branch context, not the clean QCVL mainline |

Do not merge dirty `QC-OMS` branches into `QCVL/main` unless a specific reviewed change is needed.
