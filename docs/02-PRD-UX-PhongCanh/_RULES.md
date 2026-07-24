# Quy tắc lớp yêu cầu và UX

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md) và [kiến trúc tài liệu](../ARCHITECTURE.md).

## Giữ ở đây
- Luồng người dùng, trạng thái màn hình, điều kiện hiển thị và tương tác.
- Màn hình, popup/modal, shortcut, empty/loading/error/success state.
- Acceptance criteria nhìn từ người dùng.

## Không giữ ở đây
- Business rule/công thức gốc, schema/SQL, API implementation, React/JSX/CSS/TypeScript.

## Ranh giới
PRD chỉ mô tả business/permission/API đủ để hiểu UX; chi tiết link tới lớp sở hữu. Feature thay đổi phải rà tác động Business, Database, Backend và Integration.
