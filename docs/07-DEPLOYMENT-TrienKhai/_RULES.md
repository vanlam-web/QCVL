# RULES — 07-DEPLOYMENT-TrienKhai

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md).

## Mục đích

Source of Truth cho kiến trúc triển khai và vận hành QC-OMS.

## Được ghi

- môi trường Dev, Staging và Production
- Docker, Container, VPS và Server
- Domain, DNS và SSL
- CI/CD Pipeline
- cấu hình hạ tầng Database, cache và queue
- thu thập/lưu giữ log và metric
- Monitoring, Alerting, Backup, Restore và Disaster Recovery

## Không được ghi

- Vision, Feature, UI hoặc Wireframe
- Business Rule
- Database Schema
- API Specification hoặc Backend Workflow
- Source Code

## Ranh giới

- Deployment được quyết định kiến trúc triển khai, không quyết định kiến trúc ứng dụng hoặc nghiệp vụ.
- Backend/Integration định nghĩa log và metric phát ra; Deployment sở hữu thu thập, lưu giữ, dashboard và cảnh báo.
- Deployment cấu hình hạ tầng queue nhưng không định nghĩa workflow nghiệp vụ hoặc giao thức tích hợp.
- Mỗi môi trường có một Source of Truth và không dùng chung bí mật hoặc Database.
