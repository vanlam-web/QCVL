# Bảo vệ truy cập dữ liệu QCVL

Cập nhật: `2026-07-24`

## Runtime hiện hành

QCVL dùng Node API và PostgreSQL. Client không đọc/ghi trực tiếp database; không có PostgreSQL RLS/policy runtime được khai báo trong migration hiện hành.

## Quy tắc bắt buộc

- Frontend chỉ gọi Node API.
- `organization_id` lấy từ session/current user ở server; không tin `organization_id` do client tự gửi.
- Mỗi query/mutation dữ liệu tenant phải scope `organization_id`.
- Endpoint protected phải xác thực session, workstation khi cần và permission phù hợp trước khi truy cập repository.
- Database constraint/index hỗ trợ toàn vẹn nhưng không thay validation/authorization của use case.
- Client không được tạo/sửa session, permission, user permission hoặc organization bằng đường ghi database trực tiếp.

## Test tối thiểu

1. User chỉ nhận dữ liệu organization của session.
2. Request cross-organization bị từ chối hoặc không trả dữ liệu.
3. User thiếu quyền không mutation được dữ liệu protected.
4. Client payload không thể đổi tenant scope/permission source.
5. Repository mutation luôn nhận organization scope từ server context.

## Tham chiếu

- [Schema auth và quyền](./System/AUTH-PERMISSIONS.md)
- [Auth API](../05-BACKEND-MayChu/POS/AUTH.md)
- [Quy ước backend](../05-BACKEND-MayChu/BACKEND_CONVENTIONS.md)
