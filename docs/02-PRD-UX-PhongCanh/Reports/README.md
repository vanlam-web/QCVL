# Reports — Báo Cáo Và Phân Tích

> Index cho đặc tả UI Reports. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
>
> Tham khảo: KiotViet `Phân tích/Báo cáo`.

---

## 1. Mục tiêu

Reports giúp chủ xưởng và nhân viên quản lý nhìn nhanh tình hình bán hàng, dòng tiền, công nợ và tồn kho.

QC-OMS làm báo cáo đủ để quản trị xưởng, nhưng không copy toàn bộ chiều phân tích retail của KiotViet.

---

## 2. Phạm Vi Báo Cáo

| Báo cáo | Ghi chú |
|---|---|
| Báo cáo cuối ngày | Gắn POS, Sổ quỹ và Đối soát |
| Báo cáo bán hàng | Doanh thu, hóa đơn, nhân viên, khách hàng |
| Báo cáo công nợ | Theo khách và hóa đơn nợ |
| Báo cáo khách hàng | Khách cũ/mới/lẻ, khách quay lại, top khách |
| Báo cáo hàng hóa/tồn kho | Ưu tiên cuộn/tấm vật lý |
| Báo cáo tài chính | Dòng tiền, thu, chi, tồn quỹ |
| Báo cáo nhà cung cấp | Tổng mua, công nợ NCC, lịch sử trả NCC khi Purchase/Supplier đủ dữ liệu |

---

## 3. Không Làm Trong MVP

- Kênh bán hàng.
- Website/online/TMĐT/MXH/Zalo OA.
- VAT/HĐĐT/thuế kế toán.
- Thương hiệu/thuộc tính retail.
- Nhân khẩu học khách hàng kiểu retail: tuổi, giới tính, tỉnh thành.
- Báo cáo trả hàng bán.
- Báo cáo đặt hàng KiotViet.
- Báo cáo nhân viên riêng cho HR/KPI/hoa hồng.
- Báo cáo nhà cung cấp nâng cao.
- Lợi nhuận kế toán đầy đủ khi chưa chốt giá vốn, nhập hàng và chi phí sản xuất.
- Báo cáo khách trả trước vì MVP không tạo công nợ âm.

Thương hiệu nếu cần thì ghi trong tên hàng, mã hàng hoặc nhóm hàng.

---

## 4. Nguyên Tắc Chung

- Báo cáo phải lọc được khoảng thời gian dài, không chỉ `Tháng này`.
- Bộ lọc mặc định không được làm người dùng tưởng là không có dữ liệu khi thực tế chỉ bị lọc sai thời gian.
- Các số tiền thu theo chuyển khoản phải tách theo từng tài khoản ngân hàng.
- Báo cáo tài chính/dòng tiền phải khớp được với Sổ quỹ.
- Báo cáo công nợ phải khớp với công nợ theo từng hóa đơn.
- Hóa đơn đã sửa/hủy vẫn có lịch sử để kiểm tra, không bị xóa khỏi báo cáo audit.
- Các chỉ số lợi nhuận gộp/giá vốn chỉ là tham khảo cho tới khi Purchase, phương pháp giá vốn và chi phí sản xuất được chốt.
- Các dashboard kiểu KiotViet có thể giữ cấu trúc tổng quan/top danh sách, nhưng phải lược bỏ kênh bán, trả hàng, VAT/HĐĐT và retail demographic.
- Báo cáo theo người bán nằm trong Báo cáo bán hàng, không mở luồng nhân sự/lương/hoa hồng.

---

## 5. Entry Chính

- [01-END-OF-DAY.md](./01-END-OF-DAY.md)
- [02-SALES-REPORT.md](./02-SALES-REPORT.md)
- [03-DEBT-REPORT.md](./03-DEBT-REPORT.md)
- [04-INVENTORY-REPORT.md](./04-INVENTORY-REPORT.md)
- [05-FINANCE-REPORT.md](./05-FINANCE-REPORT.md)
- [06-CUSTOMER-REPORT.md](./06-CUSTOMER-REPORT.md)

← [Quay về PRD/UX README](../README.md)
