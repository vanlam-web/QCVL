# 00-OVERVIEW — TỔNG QUAN DỰ ÁN QC-OMS

> Điểm vào ngữ cảnh sản phẩm. Trạng thái sống / queue hiện tại nằm ở [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md).

## 1. Giới Thiệu

**QC-OMS** là hệ thống quản lý vận hành nội bộ cho **Xưởng Quảng Cáo Văn Lâm**.

- Hiện tại: quản lý bán hàng, sản xuất, kho, tài chính và báo cáo theo nhu cầu xưởng.
- Mục tiêu dài hạn: thay thế hệ QuanLyXuong cũ và có thể chuẩn hoá thành sản phẩm SaaS cho xưởng quảng cáo.

## 2. Người Dùng Chính

| Vai trò | Nhu cầu chính |
|---|---|
| Chủ xưởng | Xem vận hành, tài chính, báo cáo, cấu hình quan trọng |
| Nhân viên bán hàng / thu ngân | POS, khách hàng, báo giá, hóa đơn, thanh toán |
| Nhân viên kho / vật tư | Tồn kho, nhập hàng, kiểm kho, cuộn/tấm |
| Thợ máy / sản xuất | Theo dõi hàng đợi và đối soát sản xuất |

## 3. Cách Đọc Tài Liệu

| Mục đích | Đọc |
|---|---|
| Hiểu hệ thống tài liệu | [../README.md](../README.md) |
| Biết việc đang làm / queue | [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md) |
| Hiểu vision và MVP | [../01-VISION-TamNhin/README.md](../01-VISION-TamNhin/README.md) |
| Sửa màn hình / UX | [../02-PRD-UX-PhongCanh/README.md](../02-PRD-UX-PhongCanh/README.md) |
| Sửa nghiệp vụ | [../03-BUSINESS-NghiepVu/README.md](../03-BUSINESS-NghiepVu/README.md) |
| Sửa schema | [../04-DATABASE/README.md](../04-DATABASE/README.md) |
| Sửa API / backend | [../05-BACKEND-MayChu/README.md](../05-BACKEND-MayChu/README.md) |
| Sửa triển khai | [../07-DEPLOYMENT-TrienKhai/README.md](../07-DEPLOYMENT-TrienKhai/README.md) |

## 4. Thứ Tự Source Of Truth

```text
01 Vision
  -> 02 PRD/UX
  -> 03 Business
  -> 04 Database
  -> 05 Backend/API
  -> 06 Integration
  -> 07 Deployment
```

Khi có thay đổi nghiệp vụ hoặc chức năng, cập nhật đúng tầng Source of Truth trước. Không copy nội dung đầy đủ qua nhiều tầng.

## 5. Quy Tắc Cốt Lõi

- Mỗi thông tin chỉ có một nơi gốc.
- README dùng để điều hướng, không dùng làm bảng trạng thái chi tiết.
- Bridge/spec trong [../superpowers/](../superpowers/) dùng để đối chiếu hoặc bàn giao, không thay thế Source of Truth đã promote.
- Live status và next queue nằm ở [../PHASE-CHECKLIST.md](../PHASE-CHECKLIST.md).

← [Quay về README chính](../README.md)
