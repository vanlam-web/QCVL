# Quy tắc lớp dữ liệu

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md), [kiến trúc tài liệu](../ARCHITECTURE.md) và migration trong `database/migrations/`.

Giữ bảng, cột, type, constraint, index, quan hệ, migration và invariant dữ liệu. Không giữ UX, business narrative dài hoặc API implementation. Schema change cần migration, rollback/impact rõ và cập nhật mọi consumer contract.
