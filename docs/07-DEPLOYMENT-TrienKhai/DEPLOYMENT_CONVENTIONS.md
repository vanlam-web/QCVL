# Quy ước triển khai và vận hành QC-OMS

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [_RULES.md](./_RULES.md).

## 1. Phạm vi

Deployment quyết định kiến trúc triển khai và vận hành, không quyết định Business Rule, kiến trúc ứng dụng, API hoặc Database Schema.

## 2. Môi trường

- Tách biệt `dev`, `staging` và `prod`.
- Không dùng chung Database, secret hoặc tài nguyên nhạy cảm giữa các môi trường.
- Mọi cấu hình khác nhau theo môi trường phải được tài liệu hóa.

## 3. Secret và Security

- Không hardcode password, API key, token, secret hoặc connection string.
- Sử dụng environment variable hoặc secret manager.
- Chỉ mở cổng cần thiết, dùng HTTPS cho dịch vụ công khai và áp dụng quyền tối thiểu.
- Không lưu secret trong source code, image hoặc log.

## 4. Container

- Ưu tiên container hóa; mỗi service có Dockerfile phù hợp.
- Docker Compose dùng cho môi trường phát triển hoặc trường hợp được phê duyệt rõ.
- Image phải có version; không phụ thuộc duy nhất vào tag `latest` trong production.

## 5. CI/CD

- Production deployment phải qua pipeline và bước phê duyệt phù hợp.
- Pipeline tối thiểu gồm build, test, security check và deploy.
- Mỗi lần deploy phải ghi version, thời gian, người thực hiện và thay đổi chính.
- Phải có phương án rollback trước khi deploy.

## 6. Backup, Restore và Disaster Recovery

- Database và dữ liệu quan trọng phải được backup tự động.
- Theo dõi kết quả backup và cảnh báo khi thất bại.
- Restore phải được kiểm tra định kỳ, không chỉ dựa vào việc backup thành công.
- Có kế hoạch xử lý mất Database, server, storage hoặc network.
- Mục tiêu khôi phục và mức mất dữ liệu chấp nhận được phải được xác định khi hệ thống sẵn sàng production.

## 7. Logging, Monitoring và Alerting

Backend và Integration định nghĩa log/metric phát ra. Deployment sở hữu:

- thu thập và lưu giữ log/metric
- retention và quyền truy cập
- dashboard
- health check
- alert threshold và kênh cảnh báo

Theo dõi tối thiểu:

- uptime, CPU, memory, disk và network
- error rate và response time
- backup failure và SSL expiration
- health của service, Database, cache và queue

Log vận hành nên có timestamp, service, level, trace ID và message; không chứa secret hoặc dữ liệu nhạy cảm không cần thiết.

## 8. Hạ tầng Database, Cache và Queue

- Deployment quản lý cấu hình, tài nguyên, bảo mật, backup và monitoring của hạ tầng.
- Backend quyết định workflow queue nội bộ.
- Integration quyết định giao thức queue kết nối hệ thống ngoài.
- Deployment không tự thay đổi semantics của message hoặc Business Rule.

## 9. Naming

```text
Environment: dev, staging, prod
Image:       qc-oms-api, qc-oms-web, qc-oms-worker
Container:   api, web, worker, redis, postgres
```

Tên thực tế phải ổn định và phản ánh đúng service.

## 10. Tài liệu vận hành

Tùy môi trường có thể gồm:

- `README.md`
- `DEPLOY.md`
- `BACKUP.md`
- `RESTORE.md`
- `MONITORING.md`
- `CHANGELOG.md`

Tài liệu restore phải đủ rõ để người không viết hệ thống vẫn thực hiện được theo quyền hạn cho phép.

Khi có mâu thuẫn, áp dụng thứ tự tại [DOCUMENT_RULES.md](../DOCUMENT_RULES.md).
