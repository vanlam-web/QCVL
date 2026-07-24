# Schema xác thực và quyền QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [schema.sql](../../../database/schema.sql), [auth-routes.ts](../../../server/modules/auth/auth-routes.ts).

## Nguồn sự thật

Node API và PostgreSQL QCVL là runtime. Không dùng Supabase, `auth.users`, Realtime hoặc profile client làm nguồn xác thực/quyền.

## Bảng runtime

| Bảng | Vai trò |
|---|---|
| `organizations` | Organization/tenant. |
| `users` | Login (`email`/`username`), password hash scrypt, display name, `active`/`inactive`. |
| `workstations` | Máy/quầy POS theo organization, `active`/`inactive`. |
| `permissions` | Danh mục mã `perm.*`, module, mô tả, trạng thái. |
| `user_permissions` | Quan hệ nhiều-nhiều user/quyền; khóa `(user_id, permission_code)`. |
| `sessions` | Token đăng nhập, user sở hữu, expiry UTC. |

## Ràng buộc chính

- `users`: email unique không phân biệt hoa/thường; username unique trong organization nếu có giá trị.
- `workstations`: code unique trong organization.
- `permissions.code` phải khớp `perm.[a-z0-9_]+`.
- Session bị xóa khi user bị xóa; `expires_at` là instant UTC.
- Mọi lookup/route protected cần user session hợp lệ; workstation được truyền qua `X-Workstation-Id` khi endpoint yêu cầu context máy/quầy.

## Seed và quản trị

- Bootstrap cần organization, tối thiểu một workstation active, permission runtime và admin active.
- Password bootstrap không được ghi vào repository/tài liệu active.
- Cấp/thu quyền đi qua admin flow/repository có audit khi mở rộng production; không ghi mảng quyền vào profile/client state.
- Preset Owner/Admin, nhân viên nội bộ, restricted chỉ là cách cấp nhanh; không thay role cứng hoặc quan hệ `user_permissions`.

## Tham chiếu

- [Auth API](../../05-BACKEND-MayChu/POS/AUTH.md)
- [Schema runtime](../../../database/schema.sql)
- [Quy ước backend](../../05-BACKEND-MayChu/BACKEND_CONVENTIONS.md)
