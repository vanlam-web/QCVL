# PHẦN 6: TÍCH HỢP (INTEGRATION)

> Source of Truth cho kết nối với hệ thống bên ngoài, import/export, webhook, printer, QR, banking, Zalo/SMS/email và AI/LLM.
>
> File này chỉ là index. Việc đang làm / queue hiện tại nằm ở [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md).

## Đọc Trước Khi Sửa Integration

| Cần biết | File |
|---|---|
| Quy tắc tầng Integration | [_RULES.md](./_RULES.md) |
| Quy ước integration chung | [INTEGRATION_CONVENTIONS.md](./INTEGRATION_CONVENTIONS.md) |
| Việc đang làm / queue hiện tại | [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md) |
| Nghiệp vụ nguồn | [../03-BUSINESS-NghiepVu/README.md](../03-BUSINESS-NghiepVu/README.md) |
| Backend/API nguồn | [../05-BACKEND-MayChu/README.md](../05-BACKEND-MayChu/README.md) |

## Entry Chính

| File | Vai trò |
|---|---|
| [INTEGRATION_CONVENTIONS.md](./INTEGRATION_CONVENTIONS.md) | Quy ước chung cho Zalo, printer, QR, email, webhook, AI/LLM |
| [Legacy-QuanLyXuong/README.md](./Legacy-QuanLyXuong/README.md) | Ngữ cảnh hệ QuanLyXuong cũ để học luồng và di trú |

## Phạm Vi Tầng

| Loại | Ghi ở Integration |
|---|---|
| Chỉ ghi | Printer, QR, email, SMS/Zalo, banking, AI/LLM, webhook, external API, đồng bộ dữ liệu, queue/message broker, file import/export |
| Chỉ tham chiếu | PRD/UX, business rule, database, backend/API |
| Không ghi | Vision, feature spec đầy đủ, UI/wireframe, business rule đầy đủ, schema, backend workflow nội bộ, frontend code, hạ tầng |

## Quy Ước

- Chỉ đặc tả integration khi nghiệp vụ và API nội bộ liên quan đã đủ rõ.
- Không dùng README này làm danh sách planned integration.
- Khi cần mở integration mới, thêm file/subfolder riêng và link vào index này.

← [Quay về README chính](../README.md)
