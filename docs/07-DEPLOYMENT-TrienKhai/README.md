# PHAN 7: TRIEN KHAI (DEPLOYMENT)

> Source of Truth cho moi truong, build/deploy, van hanh, backup/restore va rollback.

## Doc Truoc Khi Sua Deployment

| Can biet | File |
|---|---|
| Quy tac tang Deployment | [_RULES.md](./_RULES.md) |
| Quy uoc trien khai chung | [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) |
| NAS dev hien tai | [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md) |

## Runtime QCVL

QCVL runtime hien tai la Node API + PostgreSQL tren NAS.

- Docker duoc giu cho NAS app/PostgreSQL containers.
- Khong dung Supabase cho auth, API, realtime, seed data, test, hoac local dev.
- Khong dung Docker local de chay Supabase.
- Neu can demo/test data, ghi vao PostgreSQL/API runtime cua QCVL.
- Docs chi giu o workspace local/git. NAS chi giu runtime app, build output, source/config can cho container build/start, PostgreSQL data va env runtime.

## Entry Chinh

| File | Vai tro |
|---|---|
| [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md) | Trang thai trien khai NAS dev hien tai cua QCVL |
| [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) | Quy uoc Docker NAS, CI/CD, backup, monitoring |
| [PRODUCTION.md](./PRODUCTION.md) | Van hanh production, smoke test, rollback, monitoring |
| [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) | Chinh sach backup, RPO/RTO va restore drill |

## Pham Vi Tang

| Loai | Ghi o Deployment |
|---|---|
| Chi ghi | Deployment architecture, environment, CI/CD, monitoring, logging, backup/restore, rollback |
| Chi tham chieu | Business, database, backend/API, integration |
| Khong ghi | Vision, feature spec, UI/wireframe, business rule, schema chi tiet, frontend/backend source code |

<- [Quay ve README chinh](../README.md)
