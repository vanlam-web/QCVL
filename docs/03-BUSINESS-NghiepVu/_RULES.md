# Quy tắc lớp nghiệp vụ

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md) và [kiến trúc tài liệu](../ARCHITECTURE.md).

Giữ business rule, policy, transition, ngoại lệ, công thức, domain event và acceptance criteria nghiệp vụ. Không giữ UI/wireframe, schema/SQL, API implementation, code/framework/hạ tầng. Mỗi rule có một source-of-truth; thay đổi nghiệp vụ phải cập nhật lớp này trước, rồi rà các lớp phụ thuộc.
