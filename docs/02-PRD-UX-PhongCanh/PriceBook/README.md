# PriceBook — Quản Lý Bảng Giá

> Index cho đặc tả UI PriceBook. Việc đang làm / queue hiện tại nằm ở [Điều phối công việc hiện tại](../../PROJECT-COORDINATION.md).
>
> Phạm vi: giá chung, bảng giá theo nhóm khách và giá sản phẩm trong từng bảng.

---

## 1. Mục đích

Module PriceBook dùng để quản lý giá mặc định mà POS áp dụng khi bán hàng.

Giá sửa tay theo khách + sản phẩm là lịch sử gợi ý trong POS, không phải bảng giá chính thức.

---

## 2. Entry Chính

| File | Nội dung |
|---|---|
| [01-PRICE-LIST.md](./01-PRICE-LIST.md) | Danh sách bảng giá và nhóm khách sử dụng |
| [02-PRICE-LIST-DETAIL.md](./02-PRICE-LIST-DETAIL.md) | Chi tiết giá sản phẩm trong một bảng giá |

---

## 3. Tham Chiếu

| Nguồn | File |
|---|---|
| Business giá bán | [POS-PRICING.md](../../03-BUSINESS-NghiepVu/Sales/POS-PRICING.md) |
| Database Sales | [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md) |
| Backend Pricing API | [CUSTOMER-PRODUCT-PRICING-API.md](../../05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md) |

---

## 4. Ngoài phạm vi MVP

- Chương trình khuyến mại.
- Chiết khấu riêng ngoài bảng giá.
- Công thức cập nhật giá hàng loạt kiểu nâng/xả giá theo phần trăm.
- Lịch sử thay đổi giá chi tiết theo từng lần sửa.

← [Quay về PRD/UX README](../README.md)
