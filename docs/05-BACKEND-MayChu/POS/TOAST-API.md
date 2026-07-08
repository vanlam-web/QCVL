# TOAST-API — API Xử lý Toast SĐT (K03-B)

> **Nguồn:** Di chuyển từ `02-PRD-UX-PhongCanh/POS/K03/02-K03B-TOAST.md` (Section II + IV)
> **PRD-UX reference:** `02-PRD-UX-PhongCanh/POS/K03/02-K03B-TOAST.md`

---

## 1. KIỂM TRA SĐT KHÁCH HÀNG

### 1.1. Input

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `customer_id` | `uuid` | ID khách hàng đang chọn tại K03-A |

### 1.2. Validation

1. Khách hàng phải đang được chọn tại K03-A (không phải khách lẻ).
2. Khách hàng phải tồn tại trong `public.customers`.

### 1.3. Workflow

```
1. POS gọi API checkPhone(customer_id)
2. Server quét hồ sơ trong public.customers
3. Nếu trường phone rỗng hoặc null → trả { needs_phone: true }
   Nếu có phone → trả { needs_phone: false }
4. POS nhận response → kích hoạt hoặc bỏ qua Toast
```

### 1.4. Output

```json
{
  "needs_phone": true | false,
  "customer_id": "uuid",
  "customer_name": "string"
}
```

### 1.5. Error Handling

| Error | Phản hồi |
|---|---|
| Customer not found | HTTP 404 + `{ error: "CUSTOMER_NOT_FOUND" }` |
| Database error | HTTP 500 + `{ error: "INTERNAL_ERROR" }` |

---

## 2. LƯU SĐT KHÁCH HÀNG

### 2.1. Input

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `customer_id` | `uuid` | ID khách hàng |
| `phone` | `string` | Số điện thoại mới |

### 2.2. Validation

1. `phone` phải hợp lệ (đủ số, đúng định dạng Việt Nam).
2. `phone` sau chuẩn hóa chưa tồn tại cho khách hàng khác trong cùng organization.
3. Customer phải tồn tại.

### 2.3. Workflow

```
1. Nhân viên gõ SĐT vào Pop-over + Enter
2. POS gọi API savePhone({ customer_id, phone })
3. Server validate + ghi vào public.customers.phone
4. Trả success → POS đóng Pop-over, ẩn Toast
5. Nếu validation fail → trả lỗi, Toast vẫn hiển thị
```

### 2.4. Output

```json
{
  "success": true,
  "customer_id": "uuid",
  "phone": "string"
}
```

### 2.5. Error Handling

| Error | Phản hồi |
|---|---|
| Invalid phone format | HTTP 400 + `{ error: "INVALID_PHONE_FORMAT" }` |
| Customer not found | HTTP 404 + `{ error: "CUSTOMER_NOT_FOUND" }` |
| Phone already taken | HTTP 409 + `{ error: "PHONE_ALREADY_EXISTS" }` |
| Database error | HTTP 500 + `{ error: "INTERNAL_ERROR" }` |

### 2.6. Permission

Cần quyền `perm.create_order` hoặc `perm.edit_order_locked` để lưu SĐT.

---

← [Quay về POS README](./README.md)
