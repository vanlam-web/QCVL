# RULES — 02-PRD-UX-PhongCanh

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md) và [ARCHITECTURE.md](../ARCHITECTURE.md).

## Mục đích

Source of Truth cho Feature và trải nghiệm người dùng: người dùng làm gì, giao diện hiển thị gì và hệ thống phản hồi ra sao.

## Được ghi

- Feature Specification
- User Flow
- UI, Wireframe, Mockup
- Shortcut, Popup, Modal
- trạng thái Loading, Empty, Error, Success
- điều kiện hiển thị và tương tác hợp lệ
- Acceptance Criteria về UI/UX
- hành vi hệ thống nhìn từ phía người dùng

## Không được ghi

- Business Rule đầy đủ hoặc công thức nghiệp vụ gốc
- Database Schema, Table, Column hoặc SQL
- API Specification hoặc Backend Workflow
- code React, JSX, CSS, TypeScript
- chi tiết triển khai kỹ thuật

## Ranh giới

- Mỗi Feature có một Source of Truth.
- PRD được mô tả Business, Permission, đồng bộ hoặc API ở mức đủ hiểu hành vi; chi tiết phải liên kết sang tầng gốc.
- Nếu nội dung vừa là UI vừa là Business, file PRD chỉ giữ phần tương tác và tham chiếu 03-BUSINESS cho quy tắc cốt lõi.
- Khi Feature thay đổi, rà soát ảnh hưởng tới Business, Database, Backend và Integration.
