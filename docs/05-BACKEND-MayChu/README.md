# PHẦN 5: MÁY CHỦ & API (BACKEND)

> Source of Truth cho API, use case, validation, permission, workflow thực thi và request/response model.
>
> File này chỉ là index. Việc đang làm / queue hiện tại nằm ở [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md).

## Đọc Trước Khi Sửa Backend

| Cần biết | File |
|---|---|
| Quy tắc tầng Backend | [_RULES.md](./_RULES.md) |
| Quy ước backend chung | [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md) |
| Việc đang làm / queue hiện tại | [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md) |
| Nghiệp vụ nguồn | [../03-BUSINESS-NghiepVu/README.md](../03-BUSINESS-NghiepVu/README.md) |
| Schema nguồn | [../04-DATABASE/README.md](../04-DATABASE/README.md) |

## Nền Tảng Chung

| File | Vai trò |
|---|---|
| [FOUNDATION-TECHNICAL-DESIGN.md](./FOUNDATION-TECHNICAL-DESIGN.md) | Kiến trúc FE-BE, source layout, security baseline |
| [FOUNDATION-API.md](./FOUNDATION-API.md) | Auth, profile, permission, workstation |
| [BACKEND_CONVENTIONS.md](./BACKEND_CONVENTIONS.md) | Naming, validation, error handling, API style |

## Domain API

| Domain | Điểm vào | Nội dung |
|---|---|---|
| POS | [POS/README.md](./POS/README.md) | Pricing, customer/product lookup, order/quote/checkout, toast, POS auth |
| Inventory | [Inventory/README.md](./Inventory/README.md) | Tồn kho, cuộn/tấm, stock movement, kiểm kho |
| Finance | [Finance/README.md](./Finance/README.md) | Tài khoản quỹ, công nợ, thu nợ, sổ quỹ, phiếu thu/chi, đối soát |
| Purchase | [Purchase/PURCHASE-API.md](./Purchase/PURCHASE-API.md) | Supplier, purchase receipt draft/post, supplier payment |
| Production | [Production/PRODUCTION-RECONCILIATION-API.md](./Production/PRODUCTION-RECONCILIATION-API.md) | Đối soát sản xuất / hàng đợi máy |
| BOM | [BOM/BOM-API.md](./BOM/BOM-API.md) | BOM/combo vật tư |

## Phạm Vi Tầng

| Loại | Ghi ở Backend |
|---|---|
| Chỉ ghi | API spec, use case, validation, permission, auth, error handling, request/response model |
| Chỉ tham chiếu | PRD/UX, business rule, database schema, integration |
| Không ghi | Vision, wireframe, business rule đầy đủ, schema đầy đủ, frontend code, hạ tầng |

## Quy Ước

- Khi nghiệp vụ thay đổi, cập nhật tầng Business trước, rồi Database, rồi Backend.
- Backend không copy schema đầy đủ; link sang tầng 04 khi cần.
- Backend không copy UI/wireframe; link sang tầng 02 khi cần.
- Không dùng README này làm bảng trạng thái từng file.

## Cấu Trúc Gợi Ý Cho API / Use Case

1. Mục đích
2. Input
3. Validation
4. Workflow
5. Permission
6. Output
7. Error Handling
8. Business Rule liên quan

← [Quay về README chính](../README.md)
