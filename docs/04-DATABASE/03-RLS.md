# RLS — Row Level Security QC-OMS

> **Mốc chốt:** Foundation/System Giai đoạn 0.
> **Các domain khác:** Chốt trước giai đoạn triển khai tương ứng

---

## 1. NGUYÊN TẮC

- Bật RLS cho mọi bảng ứng dụng trong schema `public`.
- Client không được tự cung cấp organization làm nguồn tin cậy.
- User thông thường chỉ đọc dữ liệu cần thiết của chính mình và organization của mình.
- Mọi thao tác quản trị ghi dữ liệu đi qua Backend API sau khi kiểm tra permission.
- Service Role Key chỉ tồn tại ở Backend và không chịu RLS; Backend phải tự áp dụng tenant filter và permission guard.
- Policy không thay thế validation và authorization trong Use Case.

---

## 2. HELPER FUNCTION

Migration Giai đoạn 0 tạo helper function ổn định để lấy `organization_id` của `auth.uid()` từ `public.profiles`.

Yêu cầu:

- Không nhận organization ID từ Client.
- Chỉ trả organization của profile đang active.
- Dùng `SECURITY DEFINER` chỉ khi thật sự cần và phải cố định `search_path`.
- Có test chống truy cập chéo organization.

---

## 3. POLICY FOUNDATION/SYSTEM

| Bảng | SELECT trực tiếp từ client | INSERT/UPDATE/DELETE trực tiếp |
|---|---|---|
| `organizations` | Chỉ organization của user hiện tại | Không cho phép |
| `profiles` | Chỉ profile của chính user | Không cho phép |
| `workstations` | Workstation active cùng organization | Không cho phép |
| `permissions` | Permission đang active | Không cho phép |
| `user_permissions` | Chỉ permission của chính user | Không cho phép |
| `permission_audit_logs` | Không cho phép trong Giai đoạn 0 | Không cho phép |

Trang quản trị tài khoản không đọc/ghi trực tiếp các bảng trên; nó gọi `/api/v1/users` và Backend kiểm tra `perm.manage_users`.

---

## 4. REALTIME

- Chỉ publish thay đổi cần thiết của `profiles` và `user_permissions`.
- Subscription phải filter theo user ID hiện tại khi Supabase Realtime hỗ trợ filter tương ứng.
- Event chỉ báo cho FE refetch `/api/v1/me`; không dùng payload Realtime để cấp quyền.
- Không publish `permission_audit_logs` cho client.

---

## 5. TEST BẮT BUỘC

1. User đọc được profile và permissions của chính mình.
2. User không đọc được profile/permissions của user khác.
3. User không đọc được organization khác.
4. Client không thể tự INSERT/UPDATE/DELETE permission.
5. Profile inactive không được helper function trả organization active.
6. Service Role path chỉ được gọi sau permission guard trong integration test Backend.
