# PHẦN 2: ĐẶC TẢ TÍNH NĂNG & UX

> Source of Truth cho màn hình, luồng thao tác, bố cục, trạng thái UI và hành vi người dùng.
>
> File này chỉ là index. Trạng thái sống / queue hiện tại nằm ở [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md).

## Đọc Trước Khi Sửa PRD/UX

| Cần biết | File |
|---|---|
| Quy tắc tầng PRD/UX | [_RULES.md](./_RULES.md) |
| Trạng thái sống / queue hiện tại | [Điều phối công việc hiện tại](../PROJECT-COORDINATION.md) |
| UI shell, token, layout quản lý dùng chung | [System/00-UI-SHELL-V1.md](./System/00-UI-SHELL-V1.md) |

## Module Chính

| Module | Điểm vào | Nội dung |
|---|---|---|
| Overview | [Overview/README.md](./Overview/README.md) | Dashboard và tổng quan vận hành |
| POS | [POS/README.md](./POS/README.md) | Bán hàng, giỏ hàng, khách, sản phẩm, thanh toán |
| Inventory | [Inventory/README.md](./Inventory/README.md) | Kho hàng, tồn kho, cuộn/tấm, kiểm kho |
| Sales Documents | [SalesDocuments/README.md](./SalesDocuments/README.md) | Chứng từ bán hàng, danh sách và chi tiết |
| Purchase | [Purchase/01-SUPPLIER-PURCHASE.md](./Purchase/01-SUPPLIER-PURCHASE.md) | Nhà cung cấp, phiếu nhập, thanh toán NCC |
| Customers | [Customers/README.md](./Customers/README.md) | Danh sách khách hàng, chi tiết, công nợ |
| PriceBook | [PriceBook/README.md](./PriceBook/README.md) | Bảng giá và chi tiết giá |
| Finance | [Finance/README.md](./Finance/README.md) | Sổ quỹ, công nợ, đối soát |
| Reports | [Reports/README.md](./Reports/README.md) | Báo cáo cuối ngày, bán hàng, công nợ, tồn kho |
| System | [System/README.md](./System/README.md) | UI shell, người dùng, phân quyền, cấu hình |

## POS Chi Tiết

| Khu | Điểm vào | Ghi chú |
|---|---|---|
| Tổng thể POS | [POS/01-POS-LAYOUT.md](./POS/01-POS-LAYOUT.md) | Bản đồ màn hình bán hàng |
| K01 | [POS/K01/01-K01-TOPBAR.md](./POS/K01/01-K01-TOPBAR.md) | Thanh đỉnh, tìm kiếm, tab, profile, khui vật tư |
| K02 | [POS/K02/01-K02-GIO-HANG.md](./POS/K02/01-K02-GIO-HANG.md) | Giỏ hàng, dòng sản phẩm, ghi chú, hàng đợi |
| K03 | [POS/K03/01-K03A-DOI-TAC.md](./POS/K03/01-K03A-DOI-TAC.md) | Đối tác, sản phẩm, toast, thanh toán |

## Quy Ước

- Không ghi trạng thái từng file ở README này.
- Không copy nghiệp vụ đầy đủ vào PRD/UX; link sang [../03-BUSINESS-NghiepVu/](../03-BUSINESS-NghiepVu/) khi cần.
- Không copy schema/API vào PRD/UX; link sang [../04-DATABASE/](../04-DATABASE/) hoặc [../05-BACKEND-MayChu/](../05-BACKEND-MayChu/).
- Khi thêm module hoặc trang mới, thêm link vào index này và viết chi tiết trong file module.

← [Quay về README chính](../README.md)
