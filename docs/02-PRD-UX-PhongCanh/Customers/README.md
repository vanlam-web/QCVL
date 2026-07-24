# Customers — Quản Lý Khách Hàng

> Index cho đặc tả UI Customers. Việc đang làm / queue hiện tại nằm ở [Điều phối công việc hiện tại](../../PROJECT-COORDINATION.md).
>
> Phạm vi: danh sách khách hàng, hồ sơ khách, nhóm khách, lịch sử bán và công nợ.

---

## 1. Mục đích

Module Customers dùng để quản lý hồ sơ khách hàng ngoài màn hình POS.

POS chỉ cần thêm nhanh/chọn khách để bán hàng. Trang Customers dùng cho việc rà soát dữ liệu, sửa nhóm khách, kiểm tra lịch sử, công nợ và cấu hình gửi bill.

---

## 2. Entry Chính

| File | Nội dung |
|---|---|
| [01-CUSTOMER-LIST.md](./01-CUSTOMER-LIST.md) | Danh sách khách hàng, bộ lọc, cột và thao tác nhanh |
| [02-CUSTOMER-DETAIL.md](./02-CUSTOMER-DETAIL.md) | Chi tiết hồ sơ khách, lịch sử bán hàng, dư nợ và cấu hình gửi bill |

---

## 3. Tham Chiếu

| Nguồn | File |
|---|---|
| Business khách hàng POS | [POS-CUSTOMER.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER.md) |
| Business giá bán POS | [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md) |
| Business công nợ | [POS-CUSTOMER-DEBT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md) |
| Finance công nợ UX | [Finance/03-CUSTOMER-DEBT.md](../Finance/03-CUSTOMER-DEBT.md) |

---

## 4. Ngoài phạm vi MVP

- Giới tính, ngày sinh, tích điểm khách hàng.
- Chăm sóc khách hàng/khuyến mại tự động.
- Hóa đơn điện tử/VAT.
- Zalo shop/website bán hàng.
- Phân công người phụ trách khách hàng.

← [Quay về PRD/UX README](../README.md)
