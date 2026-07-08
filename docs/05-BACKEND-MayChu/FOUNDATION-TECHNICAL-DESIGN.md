# FOUNDATION TECHNICAL DESIGN — Nền tảng QC-OMS

> **Ngày chốt:** 2026-06-28
> **Phạm vi:** Kiến trúc ứng dụng, ranh giới FE–BE và cấu trúc source code nền tảng.

---

## 1. MỤC TIÊU

Thiết kế này đủ để bắt đầu Giai đoạn 0 của [DEVELOPMENT-PLAN.md](../DEVELOPMENT-PLAN.md): đăng nhập, hồ sơ người dùng, permission, máy trạm, POS Shell và triển khai staging.

Thiết kế không chốt trước workflow của Sales, Checkout, Inventory, BOM hoặc Workstation Queue. Các domain đó phải có thiết kế kỹ thuật riêng trước giai đoạn tương ứng.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC

| Chủ đề | Quyết định |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Supabase Edge Functions cung cấp REST API `/api/v1` |
| Database | Supabase PostgreSQL, quản lý bằng migration |
| Authentication | Supabase Auth, email + password trong Giai đoạn 0 |
| Authorization | Permission-based; Backend kiểm tra mọi request được bảo vệ |
| Realtime | Supabase Realtime, chỉ dùng cho subscription/event |
| Business data | FE đọc/ghi qua `/api/v1`, không gọi trực tiếp bảng bằng `supabase.from()` |
| Frontend deploy | Vercel |
| Backend deploy | Supabase Edge Functions |
| Package manager | `npm` |
| Repository | Một repository, chưa tách monorepo/package dùng chung |

### 2.1. Ranh giới sử dụng Supabase SDK trên FE

Frontend chỉ được dùng Supabase SDK trực tiếp cho:

- tạo, phục hồi và kết thúc phiên Auth;
- đổi mật khẩu của chính người dùng đang đăng nhập;
- đăng ký hoặc hủy đăng ký Realtime channel đã được Backend cho phép.

Frontend không được dùng `supabase.from()`, RPC hoặc Admin API để đọc/ghi dữ liệu nghiệp vụ. Mọi thao tác dữ liệu đi qua API Client và `/api/v1`.

### 2.2. Lý do chọn Edge Functions + REST API

- Tuân thủ `BACKEND_CONVENTIONS.md` về prefix `/api/v1`.
- Giữ transaction, validation và permission ở phía máy chủ.
- Tránh để Service Role Key hoặc logic nhạy cảm trong trình duyệt.
- Vẫn dùng được Auth và Realtime của Supabase mà không cần vận hành server riêng ở giai đoạn đầu.

Nếu Edge Functions không đáp ứng hiệu năng hoặc runtime của một use case tương lai, use case đó có thể tách thành service riêng mà không thay đổi API contract công khai.

---

## 3. LUỒNG REQUEST CHUẨN

```text
React Component
    ↓ gọi hook/action
Feature Service hoặc POS Store
    ↓
API Client
    ↓ Authorization: Bearer <access_token>
Supabase Edge Function /api/v1
    ↓ xác thực JWT
    ↓ tải profile + permissions
    ↓ validate input
Application Use Case
    ↓ transaction/repository
PostgreSQL
    ↓
Response envelope + trace_id
```

Realtime không thay thế API ghi dữ liệu. Một thay đổi luôn được ghi thành công qua API trước; Realtime chỉ thông báo trạng thái mới cho các client liên quan.

---

## 4. CẤU TRÚC SOURCE CODE

```text
QC-OMS/
├── src/
│   ├── app/                 # Router, providers, app shell
│   ├── components/          # Component dùng chung, không chứa nghiệp vụ
│   ├── features/
│   │   ├── auth/
│   │   ├── users/
│   │   └── pos/
│   ├── lib/
│   │   ├── api/             # API client, response/error types
│   │   ├── auth/            # Supabase Auth client
│   │   ├── realtime/        # Realtime subscriptions
│   │   └── validation/      # Validation phục vụ UX
│   ├── stores/              # Client working state, gồm POS Store
│   ├── styles/
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   └── api/
│   │       ├── routes/
│   │       ├── use-cases/
│   │       ├── repositories/
│   │       ├── middleware/
│   │       └── index.ts
│   ├── migrations/
│   ├── tests/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   └── e2e/
├── docs/
├── .env.example
├── package.json
└── vite.config.ts
```

Không tạo `packages/`, microservice hoặc abstraction dùng chung trước khi có ít nhất hai consumer thật.

---

## 5. FRONTEND STATE

Frontend phân state thành ba nhóm:

| Nhóm | Cách quản lý | Ví dụ |
|---|---|---|
| Server state | Query/cache layer | Hồ sơ người dùng, permissions, danh mục máy trạm |
| Working state | Store tập trung | Tab POS, giỏ hàng, ghi chú, khách đang chọn |
| UI state cục bộ | Component state | Modal mở/đóng, tab đang hiển thị, input tạm |

Quy tắc:

- Không sao chép server state vào Store nếu không cần chỉnh sửa tạm thời.
- Component không gọi API trực tiếp; gọi feature service, hook hoặc Store action.
- Store không chứa Supabase Service Role Key hoặc logic authorization.
- Validation FE chỉ hỗ trợ UX; Backend luôn validate lại.
- Dữ liệu Auth không được ghi vào LocalStorage thủ công; Supabase Auth quản lý session.

---

## 6. AUTHENTICATION VÀ WORKSTATION

### 6.1. Đăng nhập

Giai đoạn 0 sử dụng email + password qua Supabase Auth. Tên hiển thị và mã máy trạm không phải thông tin đăng nhập.

Sau khi Auth thành công:

1. FE lấy access token từ Supabase Auth.
2. FE gọi `GET /api/v1/me`.
3. Backend kiểm tra profile đang `active` và trả permissions.
4. Nếu trình duyệt chưa có máy trạm hợp lệ, FE yêu cầu chọn một máy trạm active.
5. ID máy trạm được lưu cục bộ bằng key `qc_oms.workstation_id` và gửi trong header `X-Workstation-Id`.

Máy trạm là định danh thiết bị/quầy, không gắn cứng vào một người dùng. Một người có thể đăng nhập ở máy khác nếu có quyền sử dụng hệ thống.

### 6.1.1. Hồ sơ tài khoản tự sửa

Trang `/account` đọc dữ liệu từ `GET /api/v1/me` và lưu bằng `PATCH /api/v1/me/profile`.

Backend lưu các field tự sửa vào `public.profiles`: `display_name`, `username`, `phone`, `email`, `birthday`, `region`, `ward`, `address`, `note`. `profiles.email` là email liên hệ/hiển thị trong app, không đổi email đăng nhập Supabase Auth. Chuỗi rỗng được chuẩn hóa thành `null`.

`Vai trò` không lưu qua popup tài khoản. Quyền hệ thống vẫn lấy từ `user_permissions`; thay đổi quyền phải đi qua luồng quản trị user.

### 6.1.2. Thiết bị đã đăng nhập

Mỗi lần `GET /api/v1/me` thành công, frontend gửi `x-client-device-id` lưu trong `localStorage` của từng browser; backend dùng mã này để tách thiết bị, fallback về `User-Agent` + IP nếu header thiếu. Nhờ vậy Chrome ngoài, browser Codex và browser khác không bị gộp nếu cùng IP/UA. Backend ghi/upsert thiết bị hiện tại vào `public.account_devices`; tên thiết bị ưu tiên dạng `Chrome trên macOS` khi nhận diện được cả trình duyệt và hệ điều hành. Response `/me` trả `devices` gồm tối đa 10 thiết bị active mới nhất, đánh dấu `is_current_device` cho thiết bị đang dùng.

Migration tạo `account_devices` phải grant `SELECT`, `INSERT`, `UPDATE` cho `service_role`; nếu thiếu grant, Edge Function không ghi được thiết bị và `/me` sẽ trả `INTERNAL_ERROR`.

Trang `/account` hiển thị tên thiết bị, loại thiết bị, trình duyệt, hệ điều hành, IP và `last_seen_at`. Nút `Đăng xuất` thiết bị khác gọi `PATCH /api/v1/me/devices/:id/sign-out`. Backend dùng Supabase Auth Admin `signOut(accessToken, "others")`, vì vậy thao tác này thu hồi tất cả session khác của cùng user, không thu hồi đúng 1 session remote riêng lẻ. Sau đó backend đánh dấu mọi thiết bị active khác thiết bị hiện tại là `signed_out` để danh sách chỉ còn thiết bị đang dùng.

### 6.2. Mất hoặc thu hồi quyền

- FE subscribe thay đổi permission của user đang đăng nhập.
- Khi nhận event, FE gọi lại `GET /api/v1/me`.
- Nếu quyền của route hiện tại bị thu hồi, FE điều hướng về trang hợp lệ gần nhất.
- Backend kiểm tra permission trên từng request; việc FE ẩn nút không phải biện pháp bảo mật.

### 6.3. Tài khoản bị vô hiệu hóa

Backend trả `ACCOUNT_INACTIVE` cho tài khoản có profile không active. FE xóa session cục bộ và đưa người dùng về màn hình đăng nhập.

---

## 7. TENANCY

Giai đoạn đầu chỉ vận hành một tổ chức là Xưởng Văn Lâm, nhưng các bảng ứng dụng nền tảng có `organization_id` ngay từ đầu.

Ràng buộc:

- Một user thuộc đúng một organization trong MVP.
- Mọi API chỉ thao tác dữ liệu cùng organization với user hiện tại.
- Client không được tự quyết định `organization_id`; Backend lấy từ profile.
- Chưa xây giao diện chuyển organization hoặc quản trị nhiều tenant.

---

## 8. SECURITY VÀ ERROR HANDLING

- Service Role Key chỉ tồn tại trong secret của Backend.
- Access token được xác thực ở mọi endpoint được bảo vệ.
- Permission được kiểm tra trước khi chạy use case.
- Không nhận `organization_id`, `actor_id` hoặc permission từ Client làm nguồn tin cậy.
- Response không chứa stack trace, SQL hoặc secret.
- Mỗi request có `trace_id`; ưu tiên nhận `X-Request-Id`, nếu thiếu thì Backend tự sinh.
- Log tối thiểu gồm thời gian, route, status, latency, user ID, workstation ID và trace ID; không log password/token.

---

## 9. TRANSACTION VÀ IDEMPOTENCY

- Giai đoạn 0 dùng transaction khi tạo user kèm profile và permissions.
- Nếu tạo Auth user thành công nhưng ghi profile thất bại, Backend phải thực hiện cleanup hoặc đánh dấu lỗi để retry an toàn.
- Endpoint thay permission ghi trạng thái mới và audit log trong cùng transaction Database.
- Checkout và các use case tài chính ghi nhiều bảng bắt buộc có idempotency key; contract cụ thể chốt trong slice liên quan.

---

## 10. KIỂM THỬ

| Lớp | Công cụ/Phạm vi |
|---|---|
| Unit | Hàm validation, permission guard, mapper |
| Component | Login form, route guard, profile menu |
| Integration | Edge Function + PostgreSQL local, RLS và permission |
| E2E | Đăng nhập → chọn máy trạm → vào POS → đăng xuất |
| Security | User không có quyền, user khác organization, account inactive |

Mọi test phải chạy được không phụ thuộc Database production.

---

## 11. NỘI DUNG CHƯA CHỐT TRONG FILE NÀY

Các quyết định sau được chốt just-in-time tại giai đoạn tương ứng:

- schema bảng giá và API danh mục;
- cơ chế lưu hóa đơn nháp;
- schema Order/Payment/Debt/Inventory;
- transaction Checkout;
- protocol máy in/CNC;
- render và gửi bill.

Không được suy ra thiết kế của các domain trên chỉ từ tài liệu nền tảng này.
