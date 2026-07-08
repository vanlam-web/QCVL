# System — Tài Khoản, Quyền Và Máy Trạm

> Index cho đặc tả UI System. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
>
> Nguồn: [POS/AUTH.md](../../05-BACKEND-MayChu/POS/AUTH.md), [AUTH-PERMISSIONS.md](../../04-DATABASE/System/AUTH-PERMISSIONS.md).

---

## 1. Phạm vi

System trong QC-OMS chỉ làm phần cần để vận hành:

- thông tin cửa hàng/xưởng
- tài khoản nhân viên
- phân quyền theo permission
- trạng thái active/inactive
- máy trạm/quầy POS
- cấu hình bảo mật cơ bản
- cấu hình nền tảng liên quan tới quỹ/tài khoản ngân hàng, mẫu in và tích hợp nội bộ

Không làm các module nhân sự KiotViet:

- chấm công
- lịch làm việc
- bảng lương
- hoa hồng
- KPI nhân viên

Không copy các thiết lập KiotViet không dùng trong xưởng:

- giao hàng/COD/đối tác vận chuyển
- QR ting ting/payment partner/ví điện tử
- ngoại tệ/tỷ giá
- VAT/thuế/HĐĐT
- xóa dữ liệu gian hàng theo lịch
- cân điện tử

---

## 2. Tài liệu con

- [01-USERS-PERMISSIONS.md](./01-USERS-PERMISSIONS.md)
- [02-SYSTEM-SETTINGS.md](./02-SYSTEM-SETTINGS.md)

← [Quay về PRD/UX README](../README.md)
