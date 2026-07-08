# PRODUCTION-RECONCILIATION-API — API đối soát máy sản xuất

> **Vai trò:** Source of Truth Backend cho lát cắt read-only đầu tiên.
> **Business:** [PRODUCTION-RECONCILIATION.md](../../03-BUSINESS-NghiepVu/Inventory/PRODUCTION-RECONCILIATION.md)
> **UI:** [06-PRODUCTION-RECONCILIATION.md](../../02-PRD-UX-PhongCanh/Inventory/06-PRODUCTION-RECONCILIATION.md)

---

## 1. Mục đích

API này trả dữ liệu đối soát giữa:

- `production_queue_items` / `production_queue_events`
- `orders` / `order_items` loại hóa đơn `invoice`

API chỉ đọc. Không endpoint nào trong lát cắt đầu được tạo stock movement, sửa queue item, sửa hóa đơn, sửa công nợ hoặc ghi sổ quỹ.

---

## 2. Endpoint tối thiểu

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/v1/production/reconciliation` | Danh sách nhóm đối soát tổng hợp |
| `GET` | `/v1/production/reconciliation/{group_key}` | Chi tiết thông báo máy và hóa đơn trong một nhóm |

`group_key` có thể là key do backend sinh từ các trường nhóm, ví dụ hash của `date + machine + customer_code + product_code + dimensions`. Frontend không tự parse key.

---

## 3. Query

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `date_from` | Có | Ngày bắt đầu |
| `date_to` | Có | Ngày kết thúc |
| `machine_id` | Không | Lọc máy sản xuất |
| `q` | Không | Tìm mã/tên khách, mã/tên hàng, tên file gốc, mã hóa đơn |
| `status` | Không | `all`, `delta`, `missing_bill`, `missing_machine`, `parse_error` |
| `page`, `page_size` | Không | Phân trang |

Validation:

- `date_from <= date_to`
- khoảng ngày mặc định của UI là hôm nay, nhưng API cho phép khoảng dài hạn
- `page_size` tối đa 100

---

## 4. Nguồn dữ liệu và cách nhóm

### 4.1. Production side

Đọc từ `production_queue_items`:

- `received_at`
- `production_machine_id`
- `raw_file_name`
- `status`
- `parse_status`
- `parse_error`
- `parsed_payload`

Backend tính `machine_m2` khi `parsed_payload` có đủ kích thước và số lượng:

```text
machine_m2 = width_m * height_m * quantity
```

Nếu payload dùng cm từ parser cũ, backend normalize về mét trước khi tính.

### 4.2. OMS/bill side

Đọc từ `orders` và `order_items`:

- chỉ `orders.order_type = 'invoice'`
- chỉ hóa đơn chưa hủy trong lát cắt đầu
- dùng snapshot dòng hàng để lấy mã/tên/kích thước/số lượng/m2

Backend không dựa vào giá bán để đối soát sản xuất.

### 4.3. Grouping

Nhóm mặc định:

```text
local_date + machine_id + customer_code + product_code + width_m + height_m
```

Nếu thiếu customer/product/dimensions ở một phía, backend vẫn tạo nhóm riêng với giá trị null và status tương ứng:

- thiếu dữ liệu máy hợp lệ -> `parse_error`
- có máy không có bill cùng nhóm -> `missing_bill`
- có bill không có máy cùng nhóm -> `missing_machine`
- có cả hai nhưng m2 lệch -> `delta`

Đây là đối soát tổng hợp, không phải match chắc từng file với từng dòng hóa đơn.

---

## 5. Response list

```json
{
  "items": [
    {
      "group_key": "2026-07-01|IN-BAT|TTP|BAT-32|2.000|3.000",
      "date": "2026-07-01",
      "machine": {
        "id": "uuid",
        "code": "IN-BAT",
        "name": "In bạt"
      },
      "customer": {
        "code": "TTP",
        "name": "TTP"
      },
      "product": {
        "code": "BAT-32",
        "name": "Bạt Hiflex 3.2m"
      },
      "dimensions": {
        "width_m": 2,
        "height_m": 3
      },
      "machine_quantity": 1,
      "machine_m2": 6,
      "invoice_quantity": 1,
      "invoice_m2": 6.2,
      "delta_m2": -0.2,
      "parse_error_count": 0,
      "status": "delta",
      "hint": "Lệch m2"
    }
  ],
  "summary": {
    "machine_m2": 125.5,
    "invoice_m2": 123,
    "delta_m2": 2.5,
    "missing_bill_count": 3,
    "missing_machine_count": 1,
    "parse_error_count": 2
  },
  "page": 1,
  "page_size": 50,
  "total": 1
}
```

---

## 6. Response detail

```json
{
  "group_key": "2026-07-01|IN-BAT|TTP|BAT-32|2.000|3.000",
  "production_items": [
    {
      "id": "uuid",
      "received_at": "2026-07-01T09:00:00+07:00",
      "raw_file_name": "TTP_BAT-32_200x300",
      "status": "added_to_draft",
      "parse_status": "ok",
      "parse_error": null,
      "parsed_payload": {
        "customer_code": "TTP",
        "product_code": "BAT-32",
        "width_m": 2,
        "height_m": 3,
        "quantity": 1
      }
    }
  ],
  "invoice_items": [
    {
      "order_id": "uuid",
      "order_code": "HD000123",
      "checked_out_at": "2026-07-01T09:10:00+07:00",
      "customer_code": "TTP",
      "product_code": "BAT-32",
      "product_name": "Bạt Hiflex 3.2m",
      "width_m": 2.1,
      "height_m": 3.1,
      "quantity": 1,
      "area_m2": 6.51
    }
  ]
}
```

---

## 7. Permission

MVP dùng một trong các quyền:

- `perm.manage_inventory`
- hoặc internal staff preset có quyền xem kho/báo cáo nội bộ

Không cần permission riêng cho từng trạng thái đối soát trong MVP.

---

## 8. Không làm trong API đầu tiên

- không endpoint `confirm-match`
- không endpoint `create-invoice-from-production`
- không endpoint `create-stock-movement-from-production`
- không ghi audit event khi chỉ xem báo cáo
- không tự suy luận một file nhiều chi tiết nếu parser chưa tách được chi tiết
- không sửa ngược `raw_file_name`

---

## 9. Acceptance Criteria

- API trả được list tổng hợp theo date range.
- Search exact mã hóa đơn hoặc tên file gốc không bị mất do filter mặc định quá hẹp.
- Detail trả hai danh sách: thông báo máy và dòng hóa đơn.
- Dữ liệu parse lỗi vẫn có mặt trong kết quả nếu nằm trong khoảng lọc.
- Không có mutation database khi gọi các endpoint đối soát.
