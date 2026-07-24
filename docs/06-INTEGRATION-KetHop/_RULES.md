# Quy tắc lớp tích hợp

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md) và [kiến trúc tài liệu](../ARCHITECTURE.md).

Giữ contract hệ thống ngoài: KiotViet import/export, webhook, printer, messaging, mapping và failure/retry boundary. Không đưa business rule nội bộ, UI, schema chi tiết hay deployment runbook vào đây. Contract ngoài thay đổi phải có evidence nguồn và cập nhật consumer.
