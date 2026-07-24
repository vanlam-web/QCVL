# API nền tảng QCVL

Cập nhật: `2026-07-24`

## Nguồn thực thi

Nguồn chính xác là route server hiện hành trong `server/http.ts`. Tài liệu này chỉ giữ contract nền tảng
ổn định; không mô tả Supabase, Edge Function hoặc SDK cũ.

## Quy ước chung

- Base path: `/api/v1`.
- Route nghiệp vụ yêu cầu Bearer access token theo middleware hiện hành.
- Server tạo/trả `trace_id`; client dùng nó khi cần báo lỗi.
- Response lỗi không lộ stack trace, SQL, token, secret hoặc cấu hình hạ tầng.
- Validation/quyền/organization scope do backend quyết định.

## Route hiện hành

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/health` | Kiểm tra trạng thái API/persistence. Không yêu cầu đăng nhập. |
| `GET` | `/api/v1/me` | Lấy người dùng hiện tại đã xác thực. |
| `PATCH` | `/api/v1/me/profile` | Cập nhật hồ sơ người dùng hiện tại theo validation server. |
| `GET` | `/api/v1/workstations` | Danh sách máy trạm trong phạm vi organization/quyền. |
| `POST` | `/api/v1/workstations` | Tạo máy trạm khi quyền cho phép. |
| `PATCH` | `/api/v1/workstations/{id}` | Cập nhật máy trạm khi quyền cho phép. |

## Response

Payload thành công/lỗi theo envelope API đang dùng. Client phải đọc HTTP status và body; không suy luận
thành công từ UI state cũ.

```json
{"success": true, "data": {}, "message": "", "trace_id": "uuid"}
```

```json
{"success": false, "code": "ERROR_CODE", "message": "Thông báo an toàn", "trace_id": "uuid"}
```

## Ranh giới

- Schema xác thực/phân quyền: `docs/04-DATABASE/System/`.
- Quy ước backend: [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md).
- Route domain: các README/API dưới `05-BACKEND-MayChu/`.
