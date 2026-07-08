# Quy ước phát triển Integration QC-OMS

Tuân theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) và [_RULES.md](./_RULES.md).

## 1. Phạm vi

Integration chỉ giao tiếp với hệ thống hoặc thiết bị bên ngoài. Business thuộc 03-BUSINESS; workflow nội bộ thuộc 05-BACKEND.

Luồng chuẩn: `Business -> Backend -> Integration -> External System`. UI không gọi trực tiếp Integration.

## 2. Protocol

Mỗi Integration phải ghi rõ protocol và version sử dụng. Có thể dùng:

- HTTPS/REST, Webhook hoặc WebSocket
- SFTP
- Serial hoặc TCP cho thiết bị
- queue/message broker kết nối hệ thống ngoài

Queue nghiệp vụ nội bộ không thuộc Integration.

## 3. Authentication và Secret

- Không hardcode API key, password, token hoặc secret.
- Lấy thông tin xác thực từ environment variable hoặc secret manager.
- Xác định rõ cơ chế cấp mới, hết hạn và thu hồi credential.

## 4. Timeout, Retry và Idempotency

- Mọi kết nối phải có timeout; không chờ vô hạn.
- Chỉ retry lỗi tạm thời, có giới hạn số lần và khoảng nghỉ phù hợp.
- Không retry lỗi nghiệp vụ hoặc input không hợp lệ.
- Thao tác có thể gửi lại phải idempotent để không tạo dữ liệu trùng.

## 5. Error và Logging

- Lỗi phải có code, message và trace ID khi có thể.
- Không hiển thị lỗi kỹ thuật trực tiếp cho người dùng.
- Ghi log request, response, error, retry và timeout ở mức cần thiết.
- Không ghi credential hoặc dữ liệu nhạy cảm không cần thiết.
- Integration định nghĩa log/metric phát ra; Deployment sở hữu thu thập, lưu giữ, dashboard và cảnh báo.

## 6. Queue bên ngoài

Nếu dùng queue để kết nối hệ thống ngoài:

- message phải có ID và trạng thái xử lý
- có retry và chống xử lý trùng
- có Dead Letter Queue khi phù hợp
- cấu hình broker và vận hành hạ tầng thuộc 07-DEPLOYMENT

## 7. Webhook

- Xác thực nguồn gửi và kiểm tra signature khi dịch vụ hỗ trợ.
- Xử lý idempotent.
- Trả HTTP status đúng theo kết quả nhận/xử lý.
- Không dùng response webhook để thực hiện workflow kéo dài.

## 8. Đồng bộ dữ liệu

Phải xác định:

- một chiều hay hai chiều
- realtime hay theo lịch
- hệ thống nào là Source of Truth cho từng dữ liệu
- cách giải quyết xung đột và dữ liệu đến trễ

Không để hai hệ thống cùng ghi đè dữ liệu khi chưa có quy tắc.

## 9. Version và thay đổi nhà cung cấp

- Ghi rõ version API ngoài và ngày kiểm tra tài liệu gần nhất.
- Đánh giá ảnh hưởng trước khi nâng version.
- Cô lập logic nhà cung cấp để có thể thay thế mà không làm thay đổi Business Rule.

## 10. Security và Observability

- Ưu tiên HTTPS và kiểm tra chứng chỉ.
- Chỉ truyền dữ liệu cần thiết.
- Integration nên phát health status, success rate, error rate, retry count và timeout count.
- Dashboard, alert threshold và retention thuộc 07-DEPLOYMENT.

## 11. Cấu trúc tài liệu

Mỗi hệ thống ngoài có thư mục riêng. Tùy độ phức tạp có thể gồm:

- `README.md`
- `API.md`
- `CONFIG.md`
- `ERRORS.md`

Khi có mâu thuẫn, áp dụng thứ tự tại [DOCUMENT_RULES.md](../DOCUMENT_RULES.md).
