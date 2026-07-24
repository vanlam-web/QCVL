# PHẦN 3: NGHIỆP VỤ (BUSINESS)

> Source of Truth cho quy tắc nghiệp vụ, workflow, điều kiện áp dụng, công thức và acceptance criteria.
>
> File này chỉ là index. Việc đang làm / queue hiện tại nằm ở [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md).

## Đọc Trước Khi Sửa Business

| Cần biết | File |
|---|---|
| Quy tắc tầng Business | [_RULES.md](./_RULES.md) |
| Việc đang làm / queue hiện tại | [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md) |
| Vision và MVP scope | [../01-VISION-TamNhin/README.md](../01-VISION-TamNhin/README.md) |
| PRD/UX liên quan | [../02-PRD-UX-PhongCanh/README.md](../02-PRD-UX-PhongCanh/README.md) |

## Phạm Vi Tầng

| Loại | Ghi ở Business |
|---|---|
| Chỉ ghi | Business rule, business workflow, state machine, điều kiện, công thức, domain event, acceptance criteria nghiệp vụ |
| Chỉ tham chiếu | UI, database, API, integration |
| Không ghi | Wireframe, schema, SQL, API spec, backend workflow, code, hạ tầng |

## Domain Chính

| Domain | Điểm vào | Nội dung |
|---|---|---|
| Sales | [Sales/README.md](./Sales/README.md) | Khách hàng POS, giá bán, tính tiền, lifecycle, checkout, công nợ |
| Inventory | [Inventory/README.md](./Inventory/README.md) | Tồn kho, đơn vị, kiểm kho, cuộn/tấm, đối soát sản xuất |
| Finance | [Finance/README.md](./Finance/README.md) | Sổ quỹ, phiếu thu/chi, đối soát, công nợ liên quan tiền |
| Purchase | [Purchase/README.md](./Purchase/README.md) | Nhà cung cấp, phiếu nhập, thanh toán NCC |
| BOM | [BOM/README.md](./BOM/README.md) | Combo vật tư, định mức, rule BOM |

## Quy Ước

- Khi nghiệp vụ thay đổi, cập nhật tầng Business trước, rồi mới cập nhật PRD/UX, Database và Backend.
- Business không copy schema/API; chỉ link sang tầng 04/05 khi cần.
- Không dùng README này làm bảng trạng thái từng file.

## Cấu Trúc Gợi Ý Cho Business Rule

1. ID
2. Mục đích
3. Mô tả
4. Điều kiện áp dụng
5. Quy trình xử lý
6. Ngoại lệ
7. Acceptance Criteria

← [Quay về README chính](../README.md)
