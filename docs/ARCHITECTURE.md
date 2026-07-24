# Kiến trúc tài liệu QCVL

Cập nhật: `2026-07-24`

## Mục đích

Tài liệu này quy định nơi sở hữu từng loại thông tin. Không thay thế code, schema, API hoặc runbook.

## Thứ tự nguồn sự thật

```text
Tầm nhìn và phạm vi
  → Yêu cầu/UX
  → Nghiệp vụ
  → Schema và migration
  → API/server
  → Tích hợp
  → Triển khai và vận hành
```

Không thiết kế hoặc thay đổi tầng dưới khi contract tầng trên chưa rõ. Khi runtime/code và tài liệu
mâu thuẫn, xác minh source hiện hành rồi sửa cả contract bị lệch; không tạo workaround song song.

## Ranh giới từng lớp

| Lớp | Sở hữu | Không sở hữu |
|---|---|---|
| `01-VISION` | Mục tiêu sản phẩm, phạm vi, người dùng | UI, schema, API, code |
| `02-PRD-UX` | Luồng người dùng, trạng thái màn hình, hành vi UX | Business rule gốc, schema, API implementation |
| `03-BUSINESS` | Quy tắc, công thức, transition, chính sách nghiệp vụ | UI chi tiết, schema/API/code |
| `04-DATABASE` | Bảng, cột, constraint, index, migration | UX, business narrative dài, API |
| `05-BACKEND` | API, validation, permission, transaction, server workflow | Vision, UI wireframe, business rule gốc |
| `06-INTEGRATION` | External API, import/export, webhook, printer, messaging | Domain workflow nội bộ |
| `07-DEPLOYMENT` | Môi trường, deploy, observability, backup/rollback | Feature spec, UI, schema chi tiết |

## Quy tắc cập nhật

1. Một fact/rule chỉ có một source-of-truth active.
2. README chỉ điều hướng; không chứa queue, tracker hoặc timeline dài.
3. Historical evidence ở Git history, trừ archive được đánh dấu rõ.
4. Khi thay đổi API/schema/business rule, cập nhật đúng tầng sở hữu và tất cả consumer reference.
5. Kết thúc công việc phải quét link, stale docs/rules/scripts và code duplicate/dead path của module đã chạm.

## Điều phối

- Quy tắc làm việc: [AI_TEAM_RULES.md](../AI_TEAM_RULES.md).
- Điều phối scope: [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md).
- Quy tắc tài liệu: [DOCUMENT_RULES.md](./DOCUMENT_RULES.md).
