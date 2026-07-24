# Xác thực và phân quyền QCVL

Cập nhật: `2026-07-24`
Nguồn thực thi: [auth-routes.ts](../../../server/modules/auth/auth-routes.ts).
Schema: [AUTH-PERMISSIONS.md](../../04-DATABASE/System/AUTH-PERMISSIONS.md).

## Runtime hiện hành

- Node API xác thực bằng PostgreSQL QCVL, không dùng Supabase/Realtime.
- `users` giữ login, trạng thái và hash mật khẩu; `sessions` giữ token/hạn dùng.
- `permissions` và `user_permissions` là quan hệ nhiều-nhiều; server kiểm tra quyền cho route được bảo vệ.
- Workstation là context request độc lập, gửi qua `X-Workstation-Id` khi route cần xác định máy/quầy.

## API

| Method | Route | Input | Kết quả |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | `login` hoặc `email`, `password` | Tạo session, trả `access_token`, `expires_at`. |
| `POST` | `/api/v1/auth/logout` | `Authorization: Bearer <token>` | Xóa session nếu token tồn tại. |

Login chỉ thành công khi user tồn tại, `status = active` và password scrypt hợp lệ. Session hiện có hạn 14 ngày.

## Header và lỗi

```http
Authorization: Bearer <access_token>
X-Workstation-Id: <uuid>
```

- Thiếu/không hợp lệ token hoặc session: `401 AUTH_REQUIRED`.
- UI không được coi việc ẩn nút là authorization; route server vẫn phải kiểm tra user, organization, workstation và permission phù hợp.

## Quản trị quyền

| Capability | Server permission bắt buộc | Route |
|---|---|---|
| Xem/tạo/sửa user, thay permission | `perm.manage_users` | `/api/v1/users`, `/api/v1/permissions` |
| Xem/tạo/sửa workstation | `perm.access_admin_panel` | `/api/v1/workstations` |
| Sửa thông tin cửa hàng/mẫu in | `perm.access_admin_panel` | `PATCH /api/v1/organization/bill-settings` |

- Mọi guard trả `403 PERMISSION_DENIED` **trước** repository list/mutation.
- UI có thể ẩn control khi session thiếu quyền, nhưng không thay thế server guard.
- Không ghi permission vào profile hoặc client state.
- Không ghi trực tiếp vào database ngoài migration/admin flow có audit.
- Seed bootstrap cần ít nhất organization, workstation active, admin active và các permission runtime cần thiết.
- Preset chỉ là tiện ích cấp quyền; không là role cứng hay source-of-truth riêng.
- Không công bố mật khẩu bootstrap trong repository.

## Roadmap, chưa là capability V1

- Lịch sử thay đổi quyền có persisted audit trail.
- Xác thực lại khi xuất file nhạy cảm.
- 2FA cho đăng nhập thiết bị lạ/tài khoản quản trị.

## Tham chiếu

- [Schema auth/permission](../../04-DATABASE/System/AUTH-PERMISSIONS.md)
- [Foundation API](../FOUNDATION-API.md)
- [Quy ước backend](../BACKEND_CONVENTIONS.md)
