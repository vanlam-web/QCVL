# RULES — 05-BACKEND-MayChu

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md).

## Mục đích

Source of Truth cho cách hệ thống thực thi nghiệp vụ.

## Được ghi

- API Specification và Request/Response Model
- Application Service, Use Case và workflow thực thi
- Validation và Error Handling
- Authentication, Authorization và Permission
- Event Handler
- log và metric do Backend phát ra
- queue xử lý nghiệp vụ nội bộ

## Không được ghi

- Vision, UI, Wireframe hoặc Feature Specification đầy đủ
- Business Rule gốc
- Database Schema hoặc SQL chi tiết
- Frontend code hoặc hạ tầng triển khai

## Ranh giới

- Mỗi API và Use Case có một Source of Truth.
- Backend hiện thực Business Rule và tham chiếu cấu trúc tại 04-DATABASE; không sao chép lại.
- Backend sở hữu queue nghiệp vụ nội bộ, không sở hữu queue kết nối hệ thống ngoài.
- Backend định nghĩa log/metric phát ra; việc thu thập, lưu giữ và cảnh báo thuộc 07-DEPLOYMENT.
- Không thiết kế Backend trước Business.
