# Phần 5 — Máy chủ và API

Nguồn sự thật cho route/API, validation, permission, transaction và server workflow.

## Đọc trước khi sửa

| Mục đích | Tài liệu |
|---|---|
| Quy tắc tầng backend | [_RULES.md](./_RULES.md) |
| Quy ước chung | [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md) |
| Điều phối scope | [PROJECT-COORDINATION.md](../PROJECT-COORDINATION.md) |
| Nghiệp vụ nguồn | [03-BUSINESS-NghiepVu](../03-BUSINESS-NghiepVu/README.md) |
| Schema nguồn | [04-DATABASE](../04-DATABASE/README.md) |

## Nền tảng

| Tài liệu | Vai trò |
|---|---|
| [FOUNDATION-API.md](./FOUNDATION-API.md) | Health, người dùng hiện tại và máy trạm. |
| [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md) | Quy ước API, lỗi, transaction và observability. |

## Domain API

| Domain | Điểm vào |
|---|---|
| POS/Bán hàng | [POS](./POS/README.md) |
| Kho | [Inventory](./Inventory/README.md) |
| Tài chính | [Finance](./Finance/README.md) |
| Nhập hàng | [Purchase](./Purchase/PURCHASE-API.md) |
| Sản xuất | [Production](./Production/PRODUCTION-RECONCILIATION-API.md) |
| BOM | [BOM](./BOM/BOM-API.md) |

Không đưa vision, UI spec, business rule gốc, schema đầy đủ hoặc deployment detail vào lớp này.

← [Quay về tài liệu chính](../README.md)
