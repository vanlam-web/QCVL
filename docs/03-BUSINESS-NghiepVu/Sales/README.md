# SALES — Nghiệp vụ Bán hàng

> Index nghiệp vụ bán hàng. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).

---

## Cấu trúc

| File | Mô tả | Nguồn gốc |
|---|---|---|
| [POS-CUSTOMER.md](./POS-CUSTOMER.md) | Nghiệp vụ khách hàng POS — SĐT, mã khách, tên khách và nhóm khách | Chốt từ draft 2026-06-30 |
| [POS-PRICING.md](./POS-PRICING.md) | Nghiệp vụ giá bán POS — bảng giá, giá sửa tay, lịch sử giá và đơn vị bán hàng | Chốt từ draft 2026-06-30 |
| [POS-ORDER-CALC.md](./POS-ORDER-CALC.md) | Quy tắc tính giỏ hàng — phân loại ĐVT, cộng dồn dòng trùng | Di chuyển từ PRD-UX 2026-06-26 |
| [POS-ORDER-LIFECYCLE.md](./POS-ORDER-LIFECYCLE.md) | Vòng đời đơn hàng POS — nháp, báo giá, hóa đơn bán hàng | Bổ sung 2026-06-27 |
| [POS-CHECKOUT.md](./POS-CHECKOUT.md) | Nghiệp vụ thanh toán — trừ kho, sổ quỹ, tiền thừa/nợ | Di chuyển từ PRD-UX 2026-06-26 |
| [POS-CUSTOMER-DEBT.md](./POS-CUSTOMER-DEBT.md) | Nghiệp vụ công nợ khách hàng — phát sinh nợ, thu tiền, số dư lũy kế | Tách từ PRD-UX 2026-06-27 |
| [POS-BILL-PRINT-MESSAGING.md](./POS-BILL-PRINT-MESSAGING.md) | Bill, in và gửi bill sau báo giá/hóa đơn | Chốt từ draft bill 2026-07-01 và Owner 2026-07-05 |

---

## Ghi chú BOM/Combo

BOM/Combo chưa phải nghiệp vụ đã chốt sâu trong MVP. Hiện tại chỉ giữ ranh giới:

- Combo là dòng bán hàng có snapshot.
- Nhân viên có thể thêm/sửa BOM ngay trong POS.
- Nếu chọn **Không lưu — Chỉ trừ kho**, BOM vừa nhập là định mức của dòng hàng đó và vẫn dùng để trừ kho khi chốt hóa đơn.
- Nếu chọn **Lưu Combo mới**, cấu trúc đó được lưu thành combo mới trong danh mục để dùng lại sau.
- Combo lồng nhau/deep-scan phức tạp để phase sau.

Draft điều phối: Git history.

---

## Tham chiếu

- [PRD-UX POS](../../02-PRD-UX-PhongCanh/POS/)
- [Database Sales](../../04-DATABASE/Sales/)
- [Backend POS](../../05-BACKEND-MayChu/POS/)

---

← [Quay về 03-BUSINESS README](../README.md)
