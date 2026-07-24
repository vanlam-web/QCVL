# Quy tắc lớp backend

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md), [kiến trúc tài liệu](../ARCHITECTURE.md) và [quy ước backend](./BACKEND_CONVENTIONS.md).

Giữ route/API, request/response, validation, permission, transaction, error handling, server workflow và observability phát ra. Không giữ vision, UX/wireframe, business rule gốc, schema/SQL chi tiết hoặc deploy infrastructure. Backend hiện thực business rule và tham chiếu schema; mỗi route/use case chỉ có một contract active.
