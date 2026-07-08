# RULES — 03-BUSINESS-NghiepVu

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md) và [ARCHITECTURE.md](../ARCHITECTURE.md).

## Mục đích

Source of Truth cho nghiệp vụ QC-OMS, độc lập với UI và công nghệ triển khai.

## Được ghi

- Business Rule và chính sách nghiệp vụ
- Business Workflow và State Machine
- điều kiện áp dụng, điều kiện biên và ngoại lệ
- công thức tính toán
- Domain Event ở mức ngữ nghĩa
- Acceptance Criteria nghiệp vụ

## Không được ghi

- UI, Wireframe hoặc Mockup
- Database Schema, Table, Column hoặc SQL
- API Specification hoặc Backend Workflow kỹ thuật
- code, framework hoặc hạ tầng

## Ranh giới

- Mỗi Business Rule chỉ có một Source of Truth.
- Feature, Database, Backend và Integration chỉ hiện thực hoặc tham chiếu Business Rule.
- Khi nghiệp vụ thay đổi, cập nhật Business trước rồi rà soát các tầng chịu ảnh hưởng.
- Không thiết kế Database, Backend hoặc Integration trước khi quy tắc nghiệp vụ liên quan được xác định.
