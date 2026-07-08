# RULES — 06-INTEGRATION-KetHop

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [INTEGRATION_CONVENTIONS.md](./INTEGRATION_CONVENTIONS.md).

## Mục đích

Source of Truth cho cách QC-OMS giao tiếp với hệ thống hoặc thiết bị bên ngoài.

## Được ghi

- Printer, QR, Email, SMS, Zalo, Banking và AI/LLM
- External API, Webhook và đồng bộ dữ liệu
- File Import/Export
- protocol, authentication và lỗi tích hợp
- queue/message broker dùng để kết nối hệ thống ngoài
- log và metric do Integration phát ra

## Không được ghi

- Vision, UI, Wireframe hoặc Feature Specification đầy đủ
- Business Rule gốc
- Database Schema
- Backend Workflow nội bộ
- Frontend code hoặc hạ tầng triển khai

## Ranh giới

- Mỗi hệ thống bên ngoài có một Source of Truth riêng.
- Integration chỉ giao tiếp; Business thuộc 03, xử lý nội bộ thuộc 05.
- Queue nghiệp vụ nội bộ thuộc Backend; cấu hình hạ tầng queue thuộc Deployment.
- Integration định nghĩa log/metric phát ra; thu thập, dashboard và cảnh báo thuộc Deployment.
- Không thiết kế Integration trước Business và Backend workflow liên quan.
