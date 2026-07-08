# Data Access Guard

> QCVL hien tai dung Node API + PostgreSQL. Khong co client ghi truc tiep vao database.

## Nguyen Tac

- Frontend chi goi Node API.
- Client khong duoc tu cung cap `organization_id` lam nguon tin cay.
- Moi thao tac ghi di qua Backend API sau khi kiem tra permission.
- Tenant filter va permission guard nam o Backend.
- Policy database khong thay the validation va authorization trong use case.

## Foundation/System

| Bang | Client doc truc tiep | Ghi truc tiep |
|---|---|---|
| `organizations` | Khong | Khong |
| `users` | Khong | Khong |
| `workstations` | Khong | Khong |
| `permissions` | Khong | Khong |
| `user_permissions` | Khong | Khong |

Trang quan tri tai khoan goi `/api/v1/users`; Backend kiem tra `perm.manage_users`.

## Test Bat Buoc

1. User chi nhan du lieu dung organization.
2. User khong doc duoc du lieu organization khac.
3. User khong tu ghi permission.
4. Backend chi cho thao tac sau permission guard.
