# BOM — Định mức vật tư và combo

> Index nghiệp vụ BOM/combo. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
> Nguồn: cột `Hàng thành phần` KiotViet, PRD K02-A.
> Owner chốt ngày 2026-07-01 (BOM nhiều cấp / snapshot).
> **Owner chốt lại ngày 2026-07-20:** BOM import từ KiotViet dùng ngay khi bán; không nháp/duyệt lại; không sản xuất sẵn; bán combo chỉ trừ hàng thành phần.

---

## Tài liệu trong nhóm này

| File | Nội dung |
|---|---|
| [BOM-RULES.md](./BOM-RULES.md) | Quy tắc BOM nhiều cấp, snapshot, trừ kho |

---

## Nguyên tắc chính

BOM trong QC-OMS là **định mức vật tư để trừ kho**, không phải công thức giá bán.

Giá bán vẫn đến từ bảng giá hoặc giá nhân viên sửa trên dòng bán. BOM chỉ giúp biết khi bán một sản phẩm/combo thì cần trừ những vật tư nào.

### Quyết định Owner 2026-07-20 (hiện hành)

- Cột `Hàng thành phần` từ KiotViet import xong là **BOM đang dùng**, không còn trạng thái “nháp chờ duyệt”.
- **Không** làm luồng duyệt/kích hoạt lại cho dữ liệu KV đã import.
- **Không** làm sản xuất sẵn trong giai đoạn này.
- Khi **bán combo**: trừ **hàng thành phần** theo định mức; **không** trừ tồn theo chính mã combo.

---

← [Quay về Business README](../README.md)
