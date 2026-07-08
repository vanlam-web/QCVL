# PHẦN 7: TRIỂN KHAI (DEPLOYMENT)

> Source of Truth cho môi trường, build/deploy, vận hành production, monitoring, backup/restore và rollback.
>
> File này chỉ là index. Việc đang làm / queue hiện tại nằm ở [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md).

## Đọc Trước Khi Sửa Deployment

| Cần biết | File |
|---|---|
| Quy tắc tầng Deployment | [_RULES.md](./_RULES.md) |
| Quy ước triển khai chung | [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) |
| Việc đang làm / queue hiện tại | [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md) |
| Backend/API liên quan | [../05-BACKEND-MayChu/README.md](../05-BACKEND-MayChu/README.md) |
| Integration liên quan | [../06-INTEGRATION-KetHop/README.md](../06-INTEGRATION-KetHop/README.md) |

## Entry Chính

| File | Vai trò |
|---|---|
| [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md) | Quy ước Docker, CI/CD, backup, monitoring, disaster recovery |
| [ENVIRONMENTS-CI.md](./ENVIRONMENTS-CI.md) | Local, dev cloud, staging, production baseline và CI/CD |
| [PHASE-0-RUNBOOK.md](./PHASE-0-RUNBOOK.md) | Runbook kiểm thử/vận hành Phase 0 |
| [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md) | Trạng thái triển khai NAS dev hiện tại của dự án QCVL |
| [SHARED-DEV-SERVER.md](./SHARED-DEV-SERVER.md) | Shared-dev LAN/Tailscale fallback khi cần |
| [PRODUCTION.md](./PRODUCTION.md) | Vận hành production, smoke test, rollback, monitoring tối thiểu |
| [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) | Chính sách backup, RPO/RTO và restore drill |

## Phạm Vi Tầng

| Loại | Ghi ở Deployment |
|---|---|
| Chỉ ghi | Deployment architecture, environment, CI/CD, monitoring, logging, backup/restore, rollback, disaster recovery |
| Chỉ tham chiếu | Business, database, backend/API, integration |
| Không ghi | Vision, feature spec, UI/wireframe, business rule, schema, API spec đầy đủ, frontend/backend source code |

## Quy Ước

- Deployment domain chỉ chi tiết khi Backend/Integration liên quan đã đủ rõ.
- Không dùng README này làm bảng trạng thái môi trường.
- Khi thêm môi trường hoặc runbook mới, thêm file riêng và link vào index này.

← [Quay về README chính](../README.md)
