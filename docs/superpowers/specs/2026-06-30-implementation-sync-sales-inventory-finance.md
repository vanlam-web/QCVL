# Implementation Sync — Sales, Inventory, Finance Specs

> Ngày: 2026-06-30
> Trạng thái: Handoff note cho luồng implementation
> Phạm vi: Các đặc tả đã bổ sung sau backlog gap ban đầu. File này không thay thế Source of Truth; implement phải đọc các file SoT được liệt kê.

---

## 1. Commit cần đồng bộ vào plan implement

Theo thứ tự từ nền lên API:

| Commit | Nội dung |
|---|---|
| `6549920` | Business Inventory Source of Truth |
| `86d827b` | Database Inventory schema |
| `496b740` | Database Sales Order schema và quy tắc sửa hóa đơn `MaCu.01` |
| `4929aeb` | Database Payment/Debt schema |
| `2060d79` | Database Cashbook schema |
| `67b6ee7` | Backend POS Checkout/Revise Order API |
| `d7e22e8` | Backend Inventory API |
| `db22f61` | Backend Finance API |

---

## 2. Source of Truth đã có

### Business

- `docs/03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CHECKOUT.md`
- `docs/03-BUSINESS-NghiepVu/Sales/POS-CUSTOMER-DEBT.md`
- `docs/03-BUSINESS-NghiepVu/Finance/CASHBOOK.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/UNIT-CONVERSION.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/STOCKTAKE.md`
- `docs/03-BUSINESS-NghiepVu/Inventory/PRODUCTION-RECONCILIATION.md`

### Database

- `docs/04-DATABASE/Sales/POS-TABLES.md`
- `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`
- `docs/04-DATABASE/Finance/PAYMENT-DEBT-TABLES.md`
- `docs/04-DATABASE/Finance/CASHBOOK-TABLES.md`
- `docs/04-DATABASE/01-ERD.md`

### Backend/API

- `docs/05-BACKEND-MayChu/POS/ORDER-API.md`
- `docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md`
- `docs/05-BACKEND-MayChu/Finance/FINANCE-API.md`
- `docs/05-BACKEND-MayChu/POS/AUTH.md`

---

## 3. Điểm plan implement phải cập nhật

1. POS checkout không chỉ tạo order; phải là transaction nghiệp vụ tạo `orders`, `order_items`, `stock_movements`, payment/debt/cashbook records.
2. Sửa hóa đơn đã chốt không sửa đè. Phải tạo bản mới `HD000123.01`, hủy bản cũ với lý do `revised`, giữ liên kết revision.
3. Inventory MVP trừ kho khi tạo/lưu đơn bán chính thức. Dữ liệu máy sản xuất chỉ dùng đối soát, không tự tạo stock movement.
4. Bán thiếu tồn chỉ cảnh báo, vẫn cho bán và tồn có thể âm.
5. Hàng `roll` và `sheet` không sửa tổng tồn trực tiếp; phải quản lý theo cuộn/tấm/tấm lỡ.
6. Sửa tồn hàng `normal` từ trang Hàng hóa tự sinh phiếu kiểm kho `balanced`.
7. Phiếu kiểm kho `draft` mới có thể hủy/cân bằng. Phiếu `balanced` không hủy bằng endpoint MVP.
8. Công nợ quản lý theo từng hóa đơn. Thu nợ phân bổ vào hóa đơn cũ nhất trước.
9. Không lưu khách trả trước trong MVP. Thu vượt nợ không được tạo số dư âm.
10. Sổ quỹ tách tiền mặt và từng tài khoản ngân hàng. Một lần POS payment chỉ có tối đa một tài khoản bank.
11. Phiếu thu/chi thủ công sửa theo `MaCu.01`, không sửa đè; phiếu sinh từ POS/thu nợ không sửa rời qua cashbook API.
12. Quyền mới cần seed: `perm.manage_finance`.

---

## 4. Gap còn lại trước khi implement sâu

- API/DB mua hàng nhập kho chưa chốt; hiện chỉ có khai báo tồn/điều chỉnh tồn MVP.
- BOM/Combo chi tiết chưa chốt sâu; checkout chỉ nên xử lý theo mức Business đã có, tránh tự mở rộng.
- Workstation/máy sản xuất chưa có contract tự động match bill/file; chỉ đối soát.
- PRD-UX màn hình quản trị Finance/Inventory có thể cần bổ sung sau khi backend/API đã có hướng.

---

## 5. Khuyến nghị cho luồng implement

Trước khi tiếp tục plan implementation, hãy:

1. Kéo/đọc các commit trong mục 1.
2. Cập nhật plan migration theo schema tầng 04 mới.
3. Cập nhật plan API theo tầng 05 mới.
4. Nếu plan cũ đang giả định checkout chỉ lưu đơn hoặc inventory chỉ là tổng m2, phải sửa plan trước khi code.
5. Nếu có conflict giữa plan cũ và Source of Truth mới, ưu tiên Source of Truth mới và báo lại thread đặc tả.
