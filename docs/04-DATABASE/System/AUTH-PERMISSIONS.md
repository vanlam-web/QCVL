# AUTH & PERMISSIONS — Schema nền tảng hệ thống

> **Ngày chốt:** 2026-06-28
> **Phạm vi:** Organization, hồ sơ người dùng, máy trạm và permission.

---

## 1. NGUYÊN TẮC

- `auth.users` do Supabase Auth quản lý, không thêm cột ứng dụng.
- Dữ liệu ứng dụng nằm trong schema `public`.
- Một user thuộc đúng một organization trong MVP.
- Permission lưu theo quan hệ nhiều-nhiều, không lưu mảng permission trong profile.
- Thay đổi permission phải có audit log append-only.
- Không dùng role cứng làm nguồn authorization.
- MVP vận hành theo hướng đơn giản: permission system vẫn tồn tại, nhưng tài khoản nội bộ mặc định nên được seed/cấp preset đủ quyền thao tác chính.
- Không dùng permission nhỏ để tạo rào cản vận hành quá nhiều trong MVP; chỉ tách mạnh cho quản lý user/quyền, cấu hình hệ thống, hủy/sửa chứng từ đã chốt nếu cần và tài chính nhạy cảm nếu Owner chốt.

---

## 2. ENUM/CHECK VALUE

| Trường | Giá trị hợp lệ |
|---|---|
| Organization status | `active`, `inactive` |
| Profile status | `active`, `inactive` |
| Workstation status | `active`, `inactive` |
| Permission status | `active`, `deprecated` |
| Permission audit action | `grant`, `revoke`, `replace` |

Giai đoạn 0 dùng `text + CHECK` để migration đơn giản. Chỉ chuyển sang PostgreSQL enum khi có nhu cầu rõ ràng.

---

## 3. BẢNG `public.organizations`

Lưu tenant của hệ thống. Giai đoạn đầu seed một bản ghi cho Xưởng Văn Lâm.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `id` | `uuid` | Không | PK, mặc định `gen_random_uuid()` |
| `code` | `text` | Không | Mã duy nhất, viết hoa |
| `name` | `text` | Không | Tên tổ chức |
| `status` | `text` | Không | CHECK theo §2, mặc định `active` |
| `created_at` | `timestamptz` | Không | Mặc định `now()` |
| `updated_at` | `timestamptz` | Không | Mặc định `now()` |

Ràng buộc và index:

- `UNIQUE (code)`.
- CHECK `code` chỉ gồm chữ hoa, số và dấu gạch ngang.
- Index `status` chỉ cần bổ sung khi số tenant tăng đáng kể.

---

## 4. BẢNG `public.profiles`

Mở rộng định danh `auth.users` bằng dữ liệu ứng dụng.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `user_id` | `uuid` | Không | PK, FK → `auth.users.id`, `ON DELETE RESTRICT` |
| `organization_id` | `uuid` | Không | FK → `organizations.id`, `ON DELETE RESTRICT` |
| `display_name` | `text` | Không | Tên hiển thị trong POS |
| `username` | `text` | Có | Tên đăng nhập hiển thị trong app, tối đa 100 ký tự; không phải Supabase Auth login |
| `phone` | `text` | Có | Điện thoại liên hệ, CHECK số/khoảng trắng/`+().-`, 8-20 ký tự |
| `email` | `text` | Có | Email liên hệ hiển thị trong app; không thay email đăng nhập Supabase Auth |
| `birthday` | `date` | Có | Sinh nhật người dùng |
| `region` | `text` | Có | Khu vực/tỉnh thành, tối đa 100 ký tự |
| `ward` | `text` | Có | Phường/xã, tối đa 100 ký tự |
| `address` | `text` | Có | Địa chỉ, tối đa 255 ký tự |
| `note` | `text` | Có | Ghi chú hồ sơ, tối đa 500 ký tự |
| `status` | `text` | Không | CHECK theo §2, mặc định `active` |
| `created_at` | `timestamptz` | Không | Mặc định `now()` |
| `updated_at` | `timestamptz` | Không | Mặc định `now()` |

Index:

- `idx_profiles_organization_id` trên `organization_id`.
- `idx_profiles_org_status` trên `(organization_id, status)`.

Email đăng nhập và mật khẩu không lặp lại ở bảng này; đọc từ Supabase Auth trong Backend khi thật sự cần. Cột `profiles.email` chỉ là email liên hệ/hiển thị cho trang tài khoản và có thể khác email đăng nhập.

---

## 5. BẢNG `public.account_devices`

Lưu các thiết bị/phiên đã thấy của từng user để trang `/account` hiển thị “Các thiết bị đã đăng nhập”.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `id` | `uuid` | Không | PK, mặc định `gen_random_uuid()` |
| `user_id` | `uuid` | Không | FK → `profiles.user_id`, `ON DELETE CASCADE` |
| `device_key` | `text` | Không | Hash nội bộ theo user + `x-client-device-id`; fallback user + user agent + IP nếu header thiếu; unique theo user |
| `device_name` | `text` | Không | Tên hiển thị, ưu tiên dạng `Chrome trên macOS` khi nhận diện được |
| `device_type` | `text` | Không | `desktop`, `mobile`, `tablet`, `unknown` |
| `browser_name` | `text` | Có | Chrome, Safari, Firefox, Edge nếu nhận diện được |
| `os_name` | `text` | Có | macOS, Windows, Android, iOS, Linux nếu nhận diện được |
| `ip_address` | `text` | Có | IP gần nhất backend thấy |
| `status` | `text` | Không | `active` hoặc `signed_out` |
| `last_seen_at` | `timestamptz` | Không | Lần gần nhất request `/me` ghi nhận thiết bị |
| `created_at` | `timestamptz` | Không | Lần đầu thấy thiết bị |
| `updated_at` | `timestamptz` | Không | Trigger `set_updated_at` |

Index:

- `idx_account_devices_user_last_seen` trên `(user_id, last_seen_at desc)`.

Quyền backend:

- `service_role` cần `SELECT`, `INSERT`, `UPDATE` trên `public.account_devices` vì Edge Function `/api/v1/me` ghi/upsert thiết bị hiện tại và đọc danh sách thiết bị cho trang `/account`.

Logout thiết bị khác hiện dùng Supabase Auth Admin `signOut(accessToken, "others")`, nên thu hồi tất cả session khác của cùng user rồi đánh dấu các thiết bị active khác thiết bị hiện tại là `signed_out`. Supabase không expose chắc chắn thao tác “xóa đúng một session remote” theo từng dòng `account_devices`; nếu cần mức đó phải thiết kế thêm session binding riêng.

---

## 6. BẢNG `public.workstations`

Lưu định danh máy/quầy sử dụng QC-OMS.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `id` | `uuid` | Không | PK, mặc định `gen_random_uuid()` |
| `organization_id` | `uuid` | Không | FK → `organizations.id`, `ON DELETE RESTRICT` |
| `code` | `text` | Không | Mã máy trạm trong organization |
| `name` | `text` | Không | Tên gợi nhớ, ví dụ `Quầy thu ngân 1` |
| `status` | `text` | Không | CHECK theo §2, mặc định `active` |
| `last_seen_at` | `timestamptz` | Có | Thời điểm gần nhất Backend nhận request từ máy |
| `created_at` | `timestamptz` | Không | Mặc định `now()` |
| `updated_at` | `timestamptz` | Không | Mặc định `now()` |

Ràng buộc và index:

- `UNIQUE (organization_id, code)`.
- Index `idx_workstations_org_status` trên `(organization_id, status)`.

Máy trạm không gắn cứng vào user. Trình duyệt lưu workstation đang chọn và gửi ID trong request.

---

## 7. BẢNG `public.permissions`

Danh mục mã quyền do hệ thống cung cấp.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `code` | `text` | Không | PK, ví dụ `perm.create_order` |
| `module` | `text` | Không | Nhóm hiển thị/quản lý |
| `description` | `text` | Không | Mô tả quyền |
| `status` | `text` | Không | CHECK theo §2, mặc định `active` |
| `created_at` | `timestamptz` | Không | Mặc định `now()` |

Mã quyền chỉ được thêm bằng migration/seed có review. Không cho người dùng tự tạo permission code tùy ý.

---

## 8. BẢNG `public.user_permissions`

Gán permission cho từng user.

MVP chưa có bảng `roles` riêng. Màn `/admin` hiển thị cột `Vai trò` bằng nhãn suy ra từ tập permission hiện tại để operator dễ đọc, nhưng nguồn dữ liệu thật vẫn là `user_permissions`. Khi cần phân quyền theo vai trò đầy đủ, tạo schema role/role_permissions mới thay vì nhét role text vào profile.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `user_id` | `uuid` | Không | FK → `profiles.user_id`, `ON DELETE CASCADE` |
| `permission_code` | `text` | Không | FK → `permissions.code`, `ON DELETE RESTRICT` |
| `granted_by` | `uuid` | Không | FK → `profiles.user_id`, `ON DELETE RESTRICT` |
| `granted_at` | `timestamptz` | Không | Mặc định `now()` |

Ràng buộc và index:

- PK `(user_id, permission_code)`.
- Index `idx_user_permissions_code` trên `permission_code`.
- Trigger/Backend phải từ chối gán quyền giữa hai user khác organization.

---

## 9. BẢNG `public.permission_audit_logs`

Lưu lịch sử thay đổi permission, không update hoặc delete qua ứng dụng.

| Cột | Kiểu | Null | Ràng buộc/Mô tả |
|---|---|---|---|
| `id` | `uuid` | Không | PK, mặc định `gen_random_uuid()` |
| `organization_id` | `uuid` | Không | FK → `organizations.id`, `ON DELETE RESTRICT` |
| `actor_user_id` | `uuid` | Không | FK → `profiles.user_id`, `ON DELETE RESTRICT` |
| `target_user_id` | `uuid` | Không | FK → `profiles.user_id`, `ON DELETE RESTRICT` |
| `action` | `text` | Không | CHECK theo §2 |
| `permissions_before` | `jsonb` | Không | Mảng code trước thay đổi |
| `permissions_after` | `jsonb` | Không | Mảng code sau thay đổi |
| `trace_id` | `text` | Không | Liên kết request log |
| `created_at` | `timestamptz` | Không | Mặc định `now()` |

Index:

- `idx_permission_audit_target_time` trên `(target_user_id, created_at DESC)`.
- `idx_permission_audit_actor_time` trên `(actor_user_id, created_at DESC)`.
- `idx_permission_audit_org_time` trên `(organization_id, created_at DESC)`.

---

## 9. TRIGGER VÀ REALTIME

- Dùng một trigger chuẩn để cập nhật `updated_at` cho `organizations`, `profiles`, `workstations`.
- Bật Realtime cho `user_permissions` và `profiles` để client hiện tại biết khi quyền hoặc trạng thái tài khoản thay đổi.
- Payload Realtime chỉ dùng làm tín hiệu refetch; FE không dùng payload làm nguồn authorization cuối cùng.

---

## 10. SEED TỐI THIỂU

Migration/seed Giai đoạn 0 phải tạo:

1. Một organization `VAN-LAM`.
2. Danh mục permission theo [Backend AUTH](../../05-BACKEND-MayChu/POS/AUTH.md).
3. Ít nhất một workstation active cho môi trường local/staging.
4. Tài khoản bootstrap Owner được tạo bằng quy trình quản trị Supabase, sau đó gắn profile và toàn bộ permission cần thiết bằng script có kiểm soát.
5. Preset/seed vận hành MVP cho nhân viên nội bộ nên cấp đủ quyền thao tác chính, thay vì bắt admin tick từng permission nhỏ cho mỗi tài khoản.

Không ghi password bootstrap vào repository.

Gợi ý preset dữ liệu:

| Preset | Cách lưu MVP | Ghi chú |
|---|---|---|
| Owner/Admin | Gán toàn bộ active permissions | Bắt buộc có `perm.manage_users`; không được gỡ khỏi admin cuối cùng |
| Internal Staff | Gán các quyền vận hành MVP chính | POS, khách hàng, bảng giá, kho/kiểm kho, tài chính/công nợ/sổ quỹ, chứng từ |
| Restricted | Gán thủ công theo ngoại lệ | Dùng cho tài khoản thuê ngoài/thử việc nếu phát sinh |

Không bắt buộc tạo bảng `roles` trong MVP nếu preset chỉ là thao tác tick nhanh ở seed/UI. Authorization cuối cùng vẫn đọc từ `user_permissions`.
