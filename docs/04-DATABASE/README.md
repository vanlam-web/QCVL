# PHẦN 4: CƠ SỞ DỮ LIỆU (DATABASE)

> Source of Truth cho schema, quan hệ bảng, RLS và dữ liệu lưu trữ trên Supabase/PostgreSQL.
>
> File này chỉ là index. Việc đang làm / queue hiện tại nằm ở [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md).

## Đọc Trước Khi Sửa Database

| Cần biết | File |
|---|---|
| Quy tắc tầng Database | [_RULES.md](./_RULES.md) |
| Việc đang làm / queue hiện tại | [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md) |
| Nghiệp vụ nguồn | [../03-BUSINESS-NghiepVu/README.md](../03-BUSINESS-NghiepVu/README.md) |
| Backend/API dùng schema | [../05-BACKEND-MayChu/README.md](../05-BACKEND-MayChu/README.md) |

## Nền Tảng Chung

| File | Vai trò |
|---|---|
| [01-ERD.md](./01-ERD.md) | ERD tổng quan và quan hệ theo giai đoạn |
| [03-RLS.md](./03-RLS.md) | Nguyên tắc RLS chung |
| [System/AUTH-PERMISSIONS.md](./System/AUTH-PERMISSIONS.md) | Organization, profile, workstation, permission |

## Domain Schema

| Domain | Điểm vào | Nội dung |
|---|---|---|
| Sales | [Sales/README.md](./Sales/README.md) | Customers, pricing, products, quotes/orders, order snapshots |
| Inventory | [Inventory/README.md](./Inventory/README.md) | Units, stock settings, conversions, movements, rolls, sheets, stocktakes |
| Finance | [Finance/README.md](./Finance/README.md) | Payment receipts, debt allocations, cashbook, reconciliation |
| Purchase | [Purchase/PURCHASE-TABLES.md](./Purchase/PURCHASE-TABLES.md) | Suppliers, purchase receipts, supplier payments, purchase roll/sheet objects |
| BOM | [BOM/BOM-TABLES.md](./BOM/BOM-TABLES.md) | BOM/combo vật tư |
| System | [System/README.md](./System/README.md) | Auth, profile, workstation, permission |

## Quy Ước

- Database chỉ mô tả schema, quan hệ, constraint, RLS và dữ liệu lưu.
- Không copy nghiệp vụ đầy đủ; link sang tầng 03 khi cần.
- Không copy API workflow; link sang tầng 05 khi cần.
- Không dùng README này làm bảng trạng thái từng file.

← [Quay về README chính](../README.md)
