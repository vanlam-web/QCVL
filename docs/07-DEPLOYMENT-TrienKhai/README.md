# Phần 7 — Triển khai và vận hành

Lớp này là nguồn sự thật cho môi trường, build/deploy, backup/restore, rollback và vận hành QCVL.

## Đọc trước khi sửa hoặc deploy

| Mục đích | Tài liệu |
|---|---|
| Quy tắc tầng triển khai | [_RULES.md](./_RULES.md) |
| Quy ước triển khai | [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) |
| Runbook NAS hiện hành | [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md) |
| Nguồn dữ liệu runtime | [CURRENT-DATA-SOURCE.md](../CURRENT-DATA-SOURCE.md) |

## Runtime QCVL

- Release target duy nhất là `3200`; `3202` chỉ local development, không là staging/promotion target.
- Scope đã verified và commit sạch release qua `npm run deploy:nas:image`; image deploy có migration, health, smoke và rollback tự động.
- Destructive data/migration risk cần checklist checkpoint riêng.

## Tài liệu chính

| Tài liệu | Vai trò |
|---|---|
| [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md) | Runbook deploy NAS hiện hành. |
| [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) | Quy ước Docker NAS, CI/CD, backup và monitoring. |
| [PRODUCTION.md](./PRODUCTION.md) | Vận hành production, smoke test và rollback. |
| [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) | Backup, RPO/RTO và restore drill. |

## Ranh giới

Ghi ở lớp này: Giữ môi trường, build/release direct `3200`, CI/CD, monitoring/logging, backup/restore, rollback và incident runbook. Không giữ feature spec, UI, business rule, schema chi tiết hoặc source code. Release cần commit sạch, verification, health/smoke và rollback path; destructive data/migration risk giữ checkpoint riêng.

← [Quay về tài liệu chính](../README.md)
