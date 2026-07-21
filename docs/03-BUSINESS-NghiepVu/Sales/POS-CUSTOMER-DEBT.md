# POS-CUSTOMER-DEBT — Nghiệp vụ công nợ khách hàng

> **Nguồn:** Tách khỏi `02-PRD-UX-PhongCanh/POS/K03/01-K03A-DOI-TAC.md`  
> **Runtime:** tổng nợ UI Customers/Finance/POS đọc canonical `server/modules/finance/customer-debt.ts`. Công thức chuẩn: [Finance CUSTOMER-DEBT.md](../Finance/CUSTOMER-DEBT.md). Trạng thái ngắn: [Sales README](./README.md) · [Finance README](../Finance/README.md).

---

## 1. MỤC ĐÍCH

Tài liệu này là Source of Truth cho cách ghi nhận và tính số dư công nợ khách hàng trong POS.

---

## 2. QUY TẮC CÔNG NỢ

### BR-DEBT-00: Quản lý theo hóa đơn và tổng canonical

Công nợ được quản lý theo từng hóa đơn còn nợ, không chỉ theo một số tổng.

Tổng nợ khách hàng hiển thị chính phải lấy từ công thức canonical ở [Finance CUSTOMER-DEBT.md](../Finance/CUSTOMER-DEBT.md).

Với dữ liệu import KiotViet, import chỉ tạo chứng từ ban đầu để khỏi nhập tay lại. Hóa đơn, phiếu thu, điều chỉnh và chiết khấu import phải được tính/sửa/thu/hủy như chứng từ QCVL, không dùng import làm mốc khóa công thức.

### BR-DEBT-01: Phát sinh từ bán hàng

Giao dịch **Bán hàng** chỉ làm tăng công nợ theo số tiền khách còn nợ của hóa đơn.

Nếu khách đã thanh toán một phần, công nợ chỉ tăng phần còn thiếu, không tăng theo toàn bộ tổng hóa đơn.

Nếu hóa đơn còn nợ nhưng chưa chọn khách cụ thể, phần còn nợ được ghi nhận vào `khachle - Khách lẻ` dưới dạng **Khách lẻ nợ** và phải có ghi chú nhận diện. Không tạo công nợ với `customer_id = null`.

### BR-DEBT-02: Hóa đơn thanh toán đủ

Hóa đơn đã thanh toán đủ không tạo biến động công nợ.

### BR-DEBT-03: Thu tiền khách

Giao dịch **Thu tiền khách** làm giảm công nợ.

Tiền trả bớt nợ cũ nhập trong dialog thanh toán POS cũng được ghi nhận là giao dịch **Thu tiền khách** và không làm thay đổi số tiền còn nợ của hóa đơn mới.

Khi khách trả bớt công nợ một số tiền nhất định, hệ thống mặc định cấn trừ vào các hóa đơn còn nợ cũ nhất trước.

Nếu số tiền trả không đủ hết hóa đơn cũ nhất, hóa đơn đó được giảm nợ một phần và vẫn còn trạng thái chưa thu đủ.

Nếu số tiền trả vượt số nợ của một hóa đơn, phần dư tiếp tục được cấn vào hóa đơn còn nợ kế tiếp.

### BR-DEBT-04: Hủy hóa đơn còn nợ

Khi hủy hóa đơn đang còn nợ, hệ thống tạo một giao dịch đảo để giảm công nợ tương ứng.

Không xóa hoặc sửa giao dịch lịch sử ban đầu.

### BR-DEBT-05: Số dư lũy kế

Mỗi giao dịch công nợ có số dư sau giao dịch.

Số dư sau giao dịch là số dư lũy kế ngay sau khi ghi nhận giao dịch đó.

### BR-DEBT-06: Hiển thị âm đối soát vs thu live (Owner 2026-07-21)

- **Hiển thị:** được phép hiện **số âm** trên báo cáo / tab nợ / đối soát lịch sử để đối chiếu dữ liệu import KV hoặc lệch chứng từ.
- **Thu nợ live:** không cho trả nhiều hơn số nợ còn lại — **không** tạo trả trước / không sinh âm vận hành mới từ thao tác thu.
- MVP vẫn **không** quản lý module “khách trả trước” như số dư có lợi riêng.

Nếu khách trả dư khi thanh toán đơn mới:

- mặc định phần dư là tiền thừa trả lại khách
- nếu khách còn nợ cũ và nhân viên chọn cấn nợ, phần dư được cấn vào các hóa đơn còn nợ cũ nhất trước
- nếu sau khi cấn hết nợ cũ vẫn còn dư, phần còn lại trả lại khách

Không lưu phần dư thành khoản trả trước trong MVP.

---

← [Quay về Sales README](./README.md)
