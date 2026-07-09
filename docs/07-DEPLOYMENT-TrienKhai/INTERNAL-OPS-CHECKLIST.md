# QCVL Internal Ops Checklist

> Cap nhat: 2026-07-09. Dung cho van hanh noi bo qua NAS/Tailscale.

## Hang Ngay

- Mo `http://100.84.228.125:3200/api/v1/health` hoac chay `npm run health:nas`.
- Kiem tra POS tao hoa don duoc.
- Kiem tra trang Hoa don co hoa don moi.
- Kiem tra So quy co phieu thu khi hoa don co thanh toan.
- Kiem tra Khach hang co no can thu neu hoa don con no.

## Truoc Khi Deploy NAS

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build:nas`
- `npm run verify:nas-bundle`
- Neu co doi DB: `npm run db:migrate:dry-run`

## Sau Khi Deploy NAS

- `npm run health:nas`
- Neu co password smoke trong env: `npm run smoke:nas`
- Mo `/pos`, `/sales-documents`, `/finance`, `/customers`.
- Neu co thay doi DB/sales/finance: chay `npm run verify:sales-finance-persistence` truoc va sau restart.

## Hang Tuan

- Backup PostgreSQL NAS.
- Kiem tra dung luong volume NAS.
- Kiem tra Git `main` da push sau khi deploy.
- Quet secret trong repo bang `rg`; tim cac mau password, token, database URL that, va password cu neu dang audit.

## Ranh Gioi Luu Tru

- Dua len NAS: source runtime can chay app, `dist`, `dist-server`, `server`, `src`, `public`, `database`, `package*.json`, config build, script migrate/seed/build can cho container.
- Dua len Git: source code, migration, script, docs, test. Khong dua password, token, database dump, file backup co du lieu that.
- Giu o may local: ghi chu tam, credential tam trong environment variable, log/debug rieng, file export/backup chua duyet.
- Khong can dua len NAS: docs, plan, test-only artifacts, screenshot, report tam, file clipboard.
