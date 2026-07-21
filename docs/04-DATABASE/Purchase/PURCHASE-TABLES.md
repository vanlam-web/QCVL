# Purchase Tables — Phác thảo dữ liệu nhà cung cấp/nhập hàng

> **Vai trò:** Source of Truth mức thiết kế dữ liệu; tên bảng/cột có thể tinh chỉnh khi implement.
> **Business:** [SUPPLIER-PURCHASE.md](../../03-BUSINESS-NghiepVu/Purchase/SUPPLIER-PURCHASE.md)

---

## 1. Bảng chính

### `suppliers`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `code` | Unique, tự sinh nếu trống |
| `name` | Bắt buộc |
| `phone` | Nullable, không unique cứng trong MVP |
| `email` | Nullable |
| `address` | Nullable |
| `tax_code` | Nullable, text nội bộ |
| `linked_customer_id` | Nullable FK `customers.id`; dùng khi NCC cũng là khách hàng |
| `notes` | Nullable |
| `status` | `active`, `inactive` |
| `created_at`, `updated_at` | Audit |

`linked_customer_id` không được tự suy luận cứng theo số điện thoại. Người dùng hoặc migration chỉ gắn khi chắc chắn cùng một đối tác.

### `purchase_receipts`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `code` | Unique, ví dụ `PN000001` |
| `supplier_id` | FK `suppliers` |
| `warehouse_id` | FK nếu có nhiều kho; MVP có thể mặc định một kho |
| `received_at` | Thời gian nhập |
| `status` | `draft`, `posted`, `cancelled` |
| `supplier_document_no` | Số chứng từ/hóa đơn NCC dạng text |
| `subtotal_amount` | Tổng tiền hàng |
| `discount_amount` | Giảm giá phiếu nếu có |
| `payable_amount` | Cần trả NCC |
| `paid_amount` | Đã trả |
| `remaining_amount` | Còn phải trả |
| `notes` | Nullable |
| `created_by`, `posted_by`, `cancelled_by` | Audit |
| `created_at`, `posted_at`, `cancelled_at` | Audit |

Quy tắc cấp mã `code`:

- Mã phiếu nhập chuẩn là `PN` + 6 số, ví dụ `PN000689`.
- KV import không tạo mốc riêng; phiếu import và phiếu QCVL tạo mới cùng nằm trong một dãy `PN`.
- Khi tạo phiếu mới, backend/DB lấy max tất cả mã `PN######` hiện có trong organization, gồm `source_type=kiotviet_import` và `source_type=manual`, rồi cấp `max + 1`.
- DB phải giữ lock theo organization trong lúc cấp mã và insert để 2 máy cùng tạo phiếu không trùng mã.
- Nếu API gửi mã đã stale do máy khác vừa tạo trước, DB phải cấp lại mã kế tiếp trước khi insert, không overwrite phiếu đã có cùng `code`.
- Mã revision dạng `PN000001.01` giữ liên kết với phiếu gốc; phần `.01` không làm tăng dãy chính.

### `purchase_receipt_items`

| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `purchase_receipt_id` | FK |
| `product_id` | FK |
| `inventory_shape` | Snapshot tại thời điểm nhập: `normal`, `roll`, `sheet` |
| `unit_id` | Đơn vị mua |
| `unit_name_snapshot` | Text đơn vị mua tại thời điểm nhập nếu chưa có unit table |
| `quantity` | Số lượng dòng nhập |
| `unit_cost` | Đơn giá nhập |
| `discount_amount` | Giảm giá dòng nếu có |
| `line_amount` | Thành tiền |
| `physical_payload` | JSON snapshot cho roll/sheet nếu cần |

P2 có thể dùng `unit_name_snapshot` để tránh phải hoàn tất unit conversion schema trước. Khi unit table/quy đổi đã sẵn sàng, có thể bổ sung FK đầy đủ.

Không cho trùng `product_id` trong cùng một draft P2 nếu backend chưa có merge-line rõ ràng. Điều này giúp `latest_purchase_cost` khi post đơn giản và dễ kiểm tra.

P4 dùng `physical_payload` cho roll/sheet thay vì mở bảng lot mới:

```json
{
  "rolls": {
    "width_m": 3.2,
    "lengths_m": [50, 50, 45]
  },
  "sheet_groups": [
    { "width_m": 1.22, "length_m": 2.44, "quantity": 10 }
  ]
}
```

Backend có thể tinh chỉnh shape JSON miễn giữ được các ý chính:

- roll có khổ rộng và chiều dài từng cuộn sau khi bung batch
- sheet có danh sách nhóm kích thước và số lượng tấm
- người dùng không nhập mã roll/sheet; mã kỹ thuật do backend tự sinh
- không dùng tổng `m2` làm nguồn tồn vật lý

---

## 2. Liên kết tồn vật lý

Khi `purchase_receipts.status = posted`:

- hàng `normal`: tạo stock movement tăng tồn
- hàng `roll`: tạo row trong `inventory_rolls` cho từng cuộn vật lý và stock movement gắn `inventory_object_type = roll`
- hàng `sheet`: MVP tạo row trong `inventory_sheets` cho từng tấm vật lý và stock movement gắn `inventory_object_type = sheet`

Các object vật lý cần lưu `purchase_receipt_item_id` để truy xuất nguồn giá vốn/NCC.

Schema hiện tại chưa có FK trực tiếp từ `inventory_rolls`/`inventory_sheets` về `purchase_receipt_items`, nên P4 có thể truy xuất nguồn qua `stock_movements.purchase_receipt_item_id` và object id. Nếu cần truy vấn nhanh hơn, implement có thể bổ sung FK nguồn nhập vào object trong cùng PR, nhưng không bắt buộc nếu stock movement đã đủ audit.

Không cập nhật tổng tồn cuộn/tấm bằng tay trong bảng sản phẩm.

---

## 3. Công nợ NCC và sổ quỹ

Thiết kế có thể dùng chung hạ tầng Finance hiện có:

- phiếu nhập posted chưa trả đủ tạo payable entry cho NCC
- trả tiền NCC tạo cashbook outflow/payment record
- payment allocation gắn vào phiếu nhập cụ thể do người dùng chọn; UI có thể gợi ý phiếu nợ cũ nhất nhưng không tự phân bổ cứng

Nếu sau này có bảng riêng, tên đề xuất:

- `supplier_payables`
- `supplier_payments`
- `supplier_payment_allocations`

---

## 4. Giá vốn

Giá vốn nên lưu tại:

- `purchase_receipt_items.unit_cost`
- object/lô vật lý đối với roll/sheet
- bảng tổng hợp cost nếu cần tối ưu báo cáo

Không dùng PriceBook làm nơi sửa giá vốn kế toán. PriceBook MVP chỉ đọc `giá nhập cuối` (`products.latest_purchase_cost`) để tính giá bán theo công thức. Phiếu nhập `posted` là nguồn chính cập nhật; dữ liệu import/KiotViet hoặc thao tác admin có kiểm soát chỉ là nguồn nền/đối soát.

Khi post phiếu nhập:

- với mỗi sản phẩm trong phiếu, cập nhật `products.latest_purchase_cost = purchase_receipt_items.unit_cost`
- cập nhật `products.latest_purchase_cost_at = purchase_receipts.posted_at`
- cập nhật actor theo người post nếu schema sản phẩm có `latest_purchase_cost_updated_by`
- nếu cùng sản phẩm bị trùng dòng, backend phải reject hoặc merge trước khi post; P2/P3 ưu tiên reject để đơn giản
