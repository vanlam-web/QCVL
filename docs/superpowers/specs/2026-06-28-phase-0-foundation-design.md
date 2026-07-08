# Thiết kế triển khai Giai đoạn 0 — Nền tảng và đăng nhập

> **Mốc duyệt:** Owner duyệt ngày 2026-06-28.
> **Roadmap:** [DEVELOPMENT-PLAN.md](../../DEVELOPMENT-PLAN.md)
> **Thiết kế kỹ thuật nguồn:** [FOUNDATION-TECHNICAL-DESIGN.md](../../05-BACKEND-MayChu/FOUNDATION-TECHNICAL-DESIGN.md)

## 1. Mục tiêu

Triển khai Giai đoạn 0 thành một vertical slice chạy trên Frontend và Backend thật:

1. User đăng nhập bằng email và password qua Supabase Auth.
2. Frontend tải hồ sơ và permission hiện tại từ `GET /api/v1/me`.
3. User chọn một workstation active nếu thiết bị chưa có lựa chọn hợp lệ.
4. User có `perm.create_order` vào được POS Shell; user thiếu quyền nhận trang từ chối truy cập.
5. Refresh giữ lại session hợp lệ và workstation đã chọn.
6. User đăng xuất an toàn.
7. Backend cung cấp đầy đủ API Foundation để quản trị user, permission và workstation.

Giai đoạn này không triển khai sản phẩm, khách hàng, giỏ hàng, báo giá, thanh toán, kho, BOM hoặc hàng đợi máy trạm.

## 2. Phương án triển khai

Chọn **vertical slice tăng dần**. Mỗi mốc kết nối Database, Backend và Frontend thật trước khi chuyển sang mốc tiếp theo:

1. Scaffold và quality gates.
2. Schema Foundation, seed và RLS.
3. API health, auth context và `/me`.
4. Đăng nhập, chọn workstation và POS Shell.
5. API quản trị user, permission và workstation.
6. Realtime refetch, integration test, E2E và CI/CD.

Cách này tạo được luồng sử dụng sớm mà không dùng mock data để nghiệm thu. Không chọn Backend-first vì trì hoãn phản hồi từ luồng thật; không chọn Frontend-first vì vi phạm Definition of Done của roadmap.

## 3. Kiến trúc và ranh giới

Luồng chuẩn:

```text
React component
    -> feature hook/service
    -> API client + Supabase access token + workstation header
    -> Supabase Edge Function /api/v1
    -> auth/workstation/permission middleware
    -> use case
    -> repository
    -> PostgreSQL
```

- Frontend dùng Supabase SDK trực tiếp chỉ cho Auth và Realtime.
- Frontend không dùng `supabase.from()`, RPC hoặc Admin API để đọc/ghi dữ liệu Foundation.
- Backend lấy `organization_id` và actor từ profile đã xác thực, không tin dữ liệu tenant từ Client.
- Backend kiểm tra permission cho mọi endpoint được bảo vệ.
- Service Role Key chỉ tồn tại trong Backend secret.
- POS Shell chỉ dựng khung K01/K02/K03 và trạng thái placeholder; logic bán hàng thuộc các giai đoạn sau.

## 4. Thành phần Frontend

### 4.1. App shell và routing

- Router phân tách route công khai, route yêu cầu session và route yêu cầu permission.
- Auth bootstrap phục hồi Supabase session rồi tải `/me`.
- Route POS yêu cầu `perm.create_order`.
- Route từ chối truy cập không cố gắng render nội dung POS bị khóa.

### 4.2. Auth feature

- Login form nhận email và password, hiển thị lỗi xác thực an toàn.
- Session do Supabase Auth quản lý; ứng dụng không tự lưu token vào LocalStorage.
- Logout gọi Supabase Auth sign-out, xóa cache hồ sơ trong bộ nhớ, rồi điều hướng về login.

### 4.3. Account dashboard

- Sau khi `/me` trả profile và permission hợp lệ, Frontend mở dashboard tài khoản.
- Dashboard hiển thị các module theo permission của tài khoản.
- Frontend không lưu POS machine/workstation ID và không gửi workstation header trong luồng đăng nhập.

### 4.4. POS Shell

- Hiển thị tên tài khoản và trạng thái kết nối.
- Khung K01/K02/K03 tuân theo POS master blueprint nhưng các chức năng ngoài Giai đoạn 0 ở trạng thái chưa khả dụng.
- Profile menu cung cấp thao tác đăng xuất.

## 5. Thành phần Backend và Database

### 5.1. Database Foundation

Migration tạo đúng schema trong [AUTH-PERMISSIONS.md](../../04-DATABASE/System/AUTH-PERMISSIONS.md):

- `organizations`;
- `profiles`;
- `workstations`;
- `permissions`;
- `user_permissions`;
- `permission_audit_logs`;
- trigger cập nhật `updated_at`;
- RLS và helper lấy organization của user active.

Seed tạo organization `VAN-LAM`, permission catalog và ít nhất một workstation. Bootstrap Auth user dùng script/quy trình quản trị có kiểm soát và không commit password.

### 5.2. Edge Function API

Edge Function phục vụ REST `/api/v1` theo [FOUNDATION-API.md](../../05-BACKEND-MayChu/FOUNDATION-API.md):

- health check;
- `/me`;
- danh sách và quản trị workstation;
- danh sách, chi tiết, tạo và cập nhật user;
- thay thế permission;
- permission catalog.

Middleware chịu trách nhiệm riêng cho trace ID, CORS, xác thực access token, active profile, workstation và permission. Route chỉ parse request và gọi use case; use case giữ validation và transaction; repository luôn giới hạn theo organization.

### 5.3. Audit

- Mọi lần thay permission ghi `permission_audit_logs` trong cùng transaction với thay đổi quyền.
- Thay đổi user và workstation phát structured request log chứa actor, resource, action, status và trace ID.
- Đăng nhập đi trực tiếp qua Supabase Auth SDK, vì vậy audit đăng nhập dùng log của Supabase Auth thay vì tạo REST wrapper hoặc bảng ứng dụng trùng lặp.
- Không log password, access token, refresh token hoặc Service Role Key.

## 6. Luồng dữ liệu

### 6.1. Đăng nhập và bootstrap

1. User gửi email/password cho Supabase Auth.
2. Frontend nhận session và gọi `/me` với bearer token.
3. Backend xác thực token, active profile và permission.
4. Nếu có workstation ID cục bộ, Backend xác thực workstation cùng organization và active.
5. Frontend lưu server state trong query cache.
6. Nếu chưa có workstation hợp lệ, Frontend yêu cầu chọn máy rồi gọi lại `/me`.
7. Route guard điều hướng vào POS hoặc trang từ chối quyền.

### 6.2. Permission và trạng thái tài khoản thay đổi

1. Frontend subscribe Realtime có filter cho user hiện tại.
2. Event từ `profiles` hoặc `user_permissions` chỉ là tín hiệu invalidation.
3. Frontend gọi lại `/me`; không dùng payload Realtime làm nguồn authorization.
4. Nếu route hiện tại không còn hợp lệ, Frontend điều hướng tới route hợp lệ gần nhất.
5. Nếu account inactive, Frontend sign-out và trở về login.

## 7. Xử lý lỗi

Mọi API response có `trace_id` và dùng error code trong Foundation API.

| Lỗi | Hành vi Frontend |
|---|---|
| `AUTH_REQUIRED` | Xóa state phiên ứng dụng và về login |
| `ACCOUNT_INACTIVE` | Sign-out, thông báo tài khoản bị vô hiệu hóa và về login |
| `PERMISSION_DENIED` | Điều hướng tới trang không có quyền |
| `VALIDATION_ERROR` | Hiển thị lỗi trường hoặc thông báo an toàn từ Backend |
| Mất kết nối | Giữ session, hiển thị trạng thái disconnected và cung cấp thử lại |
| `INTERNAL_ERROR` | Hiển thị thông báo chung kèm trace ID để hỗ trợ truy vết |

Backend không trả stack trace, SQL, secret hoặc thông tin tenant ngoài phạm vi user hiện tại.

## 8. Kiểm thử

### 8.1. Unit và component

- Permission guard và route decision.
- API response/error mapping.
- Login form, workstation selector, route guard và profile menu.
- Workstation storage và xử lý lỗi invalid workstation.

### 8.2. Database và integration

- Migration chạy được trên Database local sạch.
- User chỉ đọc được profile, organization và permission được RLS cho phép.
- Cross-organization access bị từ chối.
- Client không thể tự ghi permission.
- API từ chối account inactive, workstation sai organization và thiếu permission.
- Thay permission là transaction nguyên tử, tạo audit log và bảo vệ admin cuối cùng.

### 8.3. E2E

Luồng smoke bắt buộc:

```text
Đăng nhập -> gọi /me -> chọn workstation -> mở POS Shell -> đăng xuất
```

Các nhánh E2E bổ sung gồm đăng nhập sai, refresh giữ phiên, user thiếu `perm.create_order`, account inactive và workstation cũ bị vô hiệu hóa.

## 9. CI/CD và môi trường

- `npm` là package manager và lockfile được commit.
- Node.js LTS được pin cho local và CI.
- CI chạy lint, typecheck, unit/component test, production build, migration sạch, RLS/API integration và kiểm tra secret phù hợp.
- Staging dùng Vercel project và Supabase project riêng; không dùng production secrets.
- E2E smoke chạy sau deploy staging.
- Nếu máy phát triển chưa đăng nhập Supabase/Vercel hoặc chưa có project staging, việc triển khai code, local verification và CI vẫn tiếp tục; deploy staging được thực hiện ngay khi Owner cung cấp hoặc kết nối quyền truy cập tương ứng.

## 10. Tiêu chí hoàn thành

Giai đoạn 0 hoàn thành khi:

1. Repository sạch có thể dựng local bằng các lệnh đã tài liệu hóa.
2. Migration, seed, RLS và API integration chạy trên Supabase local sạch.
3. Luồng E2E smoke chạy với Backend thật, không dùng mock để nghiệm thu.
4. Lint, typecheck, test và production build đều thành công.
5. CI chặn merge khi quality gate bắt buộc thất bại.
6. Staging Frontend gọi đúng staging API và Supabase project.
7. Owner chạy thử và chấp nhận luồng đăng nhập, chọn workstation, POS Shell và đăng xuất.

Việc deploy staging thực tế và Owner nghiệm thu cần quyền truy cập hạ tầng ngoài repository; nếu chưa có, chúng được ghi rõ là điều kiện còn mở thay vì báo Giai đoạn 0 đã hoàn thành.
