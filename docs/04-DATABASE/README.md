# PHAN 4: CO SO DU LIEU (DATABASE)

> Source of Truth cho schema, quan he bang, constraint va du lieu luu tru tren PostgreSQL cua QCVL.

## Doc Truoc Khi Sua Database

| Can biet | File |
|---|---|
| Quy tac tang Database | [_RULES.md](./_RULES.md) |
| Nghiep vu nguon | [../03-BUSINESS-NghiepVu/README.md](../03-BUSINESS-NghiepVu/README.md) |
| Backend/API dung schema | [../05-BACKEND-MayChu/README.md](../05-BACKEND-MayChu/README.md) |

## Runtime QCVL

QCVL dung PostgreSQL qua Node API.

- Khong ghi seed/demo data vao backend cu da go.
- Khong tao migration/test cho backend cu.
- Schema runtime toi thieu hien nam o [../../database/schema.sql](../../database/schema.sql).
- NAS PostgreSQL container duoc cau hinh trong [../../docker-compose.nas.yml](../../docker-compose.nas.yml).

## Nen Tang Chung

| File | Vai tro |
|---|---|
| [01-ERD.md](./01-ERD.md) | ERD tong quan va quan he theo giai doan |
| [03-RLS.md](./03-RLS.md) | Nguyen tac bao ve du lieu neu can ap dung o PostgreSQL |
| [System/AUTH-PERMISSIONS.md](./System/AUTH-PERMISSIONS.md) | Organization, user, workstation, permission |

## Domain Schema

| Domain | Diem vao | Noi dung |
|---|---|---|
| Sales | [Sales/README.md](./Sales/README.md) | Customers, pricing, products, quotes/orders, order snapshots |
| Inventory | [Inventory/README.md](./Inventory/README.md) | Units, stock settings, conversions, movements, rolls, sheets, stocktakes |
| Finance | [Finance/README.md](./Finance/README.md) | Payment receipts, debt allocations, cashbook, reconciliation |
| Purchase | [Purchase/PURCHASE-TABLES.md](./Purchase/PURCHASE-TABLES.md) | Suppliers, purchase receipts, supplier payments, purchase roll/sheet objects |
| BOM | [BOM/BOM-TABLES.md](./BOM/BOM-TABLES.md) | BOM/combo vat tu |
| System | [System/README.md](./System/README.md) | Auth, profile, workstation, permission |

## Quy Uoc

- Database chi mo ta schema, quan he, constraint va du lieu luu.
- Khong copy nghiep vu day du; link sang tang 03 khi can.
- Khong copy API workflow; link sang tang 05 khi can.

<- [Quay ve README chinh](../README.md)
