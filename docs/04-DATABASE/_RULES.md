# RULES — 04-DATABASE

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md) và [ARCHITECTURE.md](../ARCHITECTURE.md).

## Mục đích

Source of Truth cho cấu trúc và ràng buộc dữ liệu của QC-OMS.

## Được ghi

- Table, Column, Data Type
- Constraint, Relationship, Index
- Enum, View, Function, Trigger
- Migration, ERD và Data Dictionary

## Không được ghi

- UI, Wireframe hoặc User Flow
- Feature Specification hoặc Business Workflow đầy đủ
- API Specification hoặc Backend Workflow
- code ứng dụng hoặc hạ tầng triển khai

## Ranh giới

- Mỗi cấu trúc dữ liệu chỉ có một Source of Truth.
- Chỉ mô tả dữ liệu và ràng buộc; nghiệp vụ phải liên kết sang 03-BUSINESS.
- Không thiết kế Database trước Business.
- Khi cấu trúc thay đổi, rà soát Backend, Integration, migration và dữ liệu hiện có.
