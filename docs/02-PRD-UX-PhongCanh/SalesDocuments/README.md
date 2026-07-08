# SalesDocuments — Chứng từ bán hàng

> Index cho đặc tả UI SalesDocuments. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
>
> Phạm vi dài hạn: danh sách và chi tiết báo giá/hóa đơn sau khi rời màn hình POS.

---

## 1. Mục đích

Module này dùng để tra cứu và kiểm tra lịch sử chứng từ bán hàng.

POS là nơi tạo/chốt đơn. SalesDocuments là nơi quản lý chứng từ đã lưu.

Phạm vi bán hàng là **bán đứt**. Báo giá nếu có chỉ là bản giá trước khi bán, không phải đơn đặt hàng, không giữ hàng, không giao hàng và không tạo công nợ/kho/tiền.

## 1.1. Năng Lực Và Ranh Giới

| Nhóm năng lực | Ghi chú |
|---|---|
| Danh sách chứng từ | List cho hóa đơn `HD...` và báo giá `BG...`, có tìm kiếm mã chứng từ |
| Chi tiết chứng từ | Readonly detail, hiển thị snapshot dòng hàng, lịch sử thanh toán từ phiếu thu liên quan, công nợ và stock movements nếu có |
| Mở lại báo giá | Mở `BG...` active vào POS draft local, giữ snapshot và cảnh báo lệch |
| In/xem báo giá | Mẫu báo giá mặc định, frontend-only print view |
| In lại bill hóa đơn | Ngoài phạm vi hiện tại; chỉ bật sau khi Bill Preview/print flow được chốt và implement |
| Sửa hóa đơn | Chỉ bật sau khi có transaction an toàn và rule đảo dữ liệu rõ |
| Hủy hóa đơn | Chỉ bật sau khi có transaction an toàn và rule đảo kho/tiền/công nợ rõ |
| Đảo kho/tiền/công nợ | Không làm bằng thao tác UI rời rạc; phải đi qua nghiệp vụ sửa/hủy an toàn |

SalesDocuments hiện vẫn không phải module quản lý đầy đủ. Nó giúp tra cứu chứng từ đã phát sinh và mở lại báo giá; sửa/hủy hóa đơn, đảo kho/tiền/công nợ và in bill nâng cao nằm ngoài phạm vi hiện tại.

---

## 2. Entry Chính

| File | Nội dung |
|---|---|
| [01-SALES-DOCUMENT-LIST.md](./01-SALES-DOCUMENT-LIST.md) | Danh sách báo giá/hóa đơn, bộ lọc, cột, thao tác nhanh |
| [02-SALES-DOCUMENT-DETAIL.md](./02-SALES-DOCUMENT-DETAIL.md) | Chi tiết chứng từ readonly hiện tại; mô tả sửa/hủy/in lại là ngoài phạm vi hiện tại |
| [04-QUOTE-PRINT-PHASE-3B.md](./04-QUOTE-PRINT-PHASE-3B.md) | Source of Truth cho in/xem báo giá đơn giản đã merge |

---

## 3. Tham Chiếu

| Nguồn | File |
|---|---|
| Business vòng đời đơn | [POS-ORDER-LIFECYCLE.md](../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md) |
| Business checkout | [POS-CHECKOUT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md) |
| Business công nợ | [POS-CUSTOMER-DEBT.md](../../03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md) |
| Database Sales | [POS-TABLES.md](../../04-DATABASE/Sales/POS-TABLES.md) |
| Backend Order API | [ORDER-API.md](../../05-BACKEND-MayChu/POS/ORDER-API.md) |

---

## 4. Ngoài phạm vi MVP

- Trả hàng.
- Đặt hàng kiểu KiotViet.
- Đối tác giao hàng, vận đơn, COD.
- Bán hàng online/kênh bán.
- Hóa đơn điện tử.
- Đơn đa điểm, Ahamove/KShip.
- Gộp đơn nhiều chứng từ.

← [Quay về PRD/UX README](../README.md)
