# Phần 4 — Cơ sở dữ liệu QCVL

Nguồn sự thật cho schema PostgreSQL, quan hệ, constraint, migration và invariant dữ liệu.

## Đọc trước khi sửa

| Mục đích | Tài liệu |
|---|---|
| Quy tắc tầng dữ liệu | [_RULES.md](./_RULES.md) |
| Nghiệp vụ nguồn | [03-BUSINESS-NghiepVu](../03-BUSINESS-NghiepVu/README.md) |
| API sử dụng schema | [05-BACKEND-MayChu](../05-BACKEND-MayChu/README.md) |
| Source runtime | [CURRENT-DATA-SOURCE.md](../CURRENT-DATA-SOURCE.md) |

## Runtime

QCVL dùng PostgreSQL qua Node API. Schema runtime: [database/schema.sql](../../database/schema.sql); container NAS:
[docker-compose.nas.yml](../../docker-compose.nas.yml). Không tạo migration/test cho backend đã bỏ.

## Điểm vào schema

| Domain | Tài liệu |
|---|---|
| Tổng quan | [01-ERD.md](./01-ERD.md) |
| Sales | [Sales](./Sales/README.md) |
| Kho | [Inventory](./Inventory/README.md) |
| Tài chính | [Finance](./Finance/README.md) |
| Nhập hàng | [Purchase](./Purchase/PURCHASE-TABLES.md) |
| BOM | [BOM](./BOM/BOM-TABLES.md) |
| Hệ thống/quyền | [System](./System/README.md) |

Schema chỉ mô tả dữ liệu; nghiệp vụ/API link về lớp sở hữu.

← [Quay về tài liệu chính](../README.md)
