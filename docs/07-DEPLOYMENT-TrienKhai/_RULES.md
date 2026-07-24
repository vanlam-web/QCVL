# Quy tắc lớp triển khai

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md), [kiến trúc tài liệu](../ARCHITECTURE.md) và [runbook NAS](./QCVL-NAS-DEV.md).

Giữ môi trường, build/release direct `3200`, CI/CD, monitoring/logging, backup/restore, rollback và incident runbook. Không giữ feature spec, UI, business rule, schema chi tiết hoặc source code. Release cần commit sạch, verification, health/smoke và rollback path; destructive data/migration risk giữ checkpoint riêng.
