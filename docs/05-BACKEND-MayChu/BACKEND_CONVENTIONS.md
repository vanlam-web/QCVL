# Quy ước phát triển Backend QC-OMS

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [_RULES.md](./_RULES.md).

## 1. Phạm vi

Backend chỉ hiện thực nghiệp vụ đã được xác định tại 03-BUSINESS và cấu trúc dữ liệu tại 04-DATABASE. Không tự tạo Business Rule hoặc Database Schema mới.

## 2. API

- Dùng REST API với prefix `/api/v1/`.
- Resource dùng danh từ số nhiều, ví dụ `/api/v1/orders`.
- API thay đổi không tương thích phải dùng version mới; không phá API cũ khi chưa có kế hoạch ngừng hỗ trợ.
- Frontend chỉ dùng Supabase SDK trực tiếp cho Auth và Realtime subscription.
- Dữ liệu nghiệp vụ phải đọc/ghi qua `/api/v1`; UI không gọi trực tiếp `supabase.from()`, RPC hoặc Admin API.
- Realtime chỉ phát tín hiệu/trạng thái sau khi dữ liệu đã được ghi thành công; không thay thế API command.

Ví dụ:

```text
GET    /api/v1/orders
POST   /api/v1/orders
PUT    /api/v1/orders/{id}
DELETE /api/v1/orders/{id}
```

## 3. Request và Response

- Backend phải validate toàn bộ input; validation Frontend chỉ phục vụ UX.
- Không tin dữ liệu, quyền hoặc trạng thái do Client gửi lên.

Response thành công:

```json
{"success": true, "data": {}, "message": "", "trace_id": ""}
```

Response lỗi:

```json
{"success": false, "code": "", "message": "", "trace_id": ""}
```

Không trả stack trace hoặc lỗi hệ thống trực tiếp cho Client.

## 4. Authentication và Permission

- Mọi API cần xác định rõ yêu cầu Authentication, Authorization và Permission.
- Quyền phải được kiểm tra tại Backend, không phụ thuộc việc Frontend có ẩn nút hay không.
- Áp dụng nguyên tắc quyền tối thiểu.

## 5. Use Case và Transaction

- Một Use Case nghiệp vụ tương ứng một workflow thực thi rõ ràng.
- Không gộp các nghiệp vụ độc lập chỉ để tái sử dụng endpoint.
- Thao tác ghi nhiều bảng liên quan phải dùng transaction phù hợp.
- Không để dữ liệu ở trạng thái trung gian có thể quan sát được.

## 6. Event và Idempotency

- Event Handler phải chạy lại an toàn khi có khả năng nhận lại sự kiện.
- Các thao tác retry phải có idempotency key hoặc cơ chế chống trùng tương đương.
- Tên event dùng quá khứ, ví dụ `OrderCreated`.

## 7. Error và Logging

- Lỗi nghiệp vụ phải có error code ổn định, message phù hợp và trace ID.
- Ghi log các thao tác quan trọng như đăng nhập, tạo/sửa/hủy đơn và thanh toán.
- Không ghi password, token, secret hoặc dữ liệu nhạy cảm không cần thiết.
- Backend định nghĩa log và metric phát ra; 07-DEPLOYMENT sở hữu thu thập, lưu giữ, dashboard và cảnh báo.

## 8. Naming

```text
Service:    OrderService
Use Case:   CreateOrder
Permission: order.create
Event:      OrderCreated
```

Tên phải phản ánh đúng domain và hành động, tránh viết tắt không có quy ước.

## 9. Source of Truth

- Business Rule: 03-BUSINESS.
- Database Structure: 04-DATABASE.
- Backend workflow và API: 05-BACKEND.
- Kết nối hệ thống ngoài: 06-INTEGRATION.
- Hạ tầng và vận hành: 07-DEPLOYMENT.

Khi có mâu thuẫn, áp dụng thứ tự tại [DOCUMENT_RULES.md](../DOCUMENT_RULES.md).
