# Plan — Organization bill settings on Postgres

Updated: 2026-07-21  
Branch: `cursor/bill-settings-postgres-0482`

## Goal

Cấu hình bill (shop + mẫu A4/K80) dùng chung mọi máy POS / NAS — không chỉ localStorage.

## Deliverables

1. Migration `0009_organization_bill_settings.sql` trên `organizations`
2. `GET/PATCH /api/v1/organization/bill-settings` (PATCH cần `perm.access_admin_panel`)
3. Thiết lập + bill print đọc/ghi API; localStorage chỉ còn cache

## Ngoài scope

Logo, preference theo khách, Zalo, editor KV
