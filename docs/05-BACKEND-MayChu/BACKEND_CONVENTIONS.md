# Quy ước phát triển backend QCVL

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md), [kiến trúc](../ARCHITECTURE.md) và [_RULES.md](./_RULES.md).

## Phạm vi

Backend hiện thực nghiệp vụ đã chốt ở `03-BUSINESS` trên schema/migration hiện hành ở `04-DATABASE`.
Không tự tạo business rule hoặc schema mới để vá UI.

## API và dữ liệu

- API version hiện hành dùng prefix `/api/v1`.
- Resource dùng danh từ số nhiều khi phù hợp; thay đổi phá tương thích cần version/migration rõ ràng.
- UI gọi API; không gọi database trực tiếp, không tin quyền/trạng thái do client tự gửi.
- Backend kiểm tra toàn bộ input, organization scope, quyền và trạng thái transition.
- Realtime chỉ phát sau khi transaction đã thành công; không thay API command bằng event client-side.

## Response và lỗi

Response thành công:

```json
{"success": true, "data": {}, "message": "", "trace_id": ""}
```

Response lỗi:

```json
{"success": false, "code": "", "message": "", "trace_id": ""}
```

- Không trả stack trace, SQL, token hoặc secret cho client.
- Lỗi nghiệp vụ cần `code` ổn định và `trace_id` để truy vết.
- Validation UI chỉ hỗ trợ trải nghiệm; validation backend là bắt buộc.

## Ghi dữ liệu và đồng thời

- Một use case có workflow rõ, không gộp nghiệp vụ độc lập để tái dùng endpoint.
- Ghi nhiều bảng liên quan phải atomic bằng transaction phù hợp.
- Không để dữ liệu trung gian quan sát được.
- Retry/event phải idempotent hoặc có cơ chế chống trùng tương đương.
- Không dùng fallback im lặng để che lỗi dữ liệu, permission hoặc persistence.

## Bảo mật và log

- Backend kiểm tra xác thực/phân quyền; UI ẩn nút không thay thế kiểm tra server.
- Log thao tác quan trọng đủ để audit nhưng không chứa password, token, secret hay dữ liệu nhạy cảm dư thừa.
- Hạ tầng thu thập/cảnh báo log thuộc `07-DEPLOYMENT`.

## Nguồn sự thật

| Nội dung | Lớp sở hữu |
|---|---|
| Quy tắc nghiệp vụ | `03-BUSINESS` |
| Schema và migration | `04-DATABASE` |
| API/workflow server | `05-BACKEND` |
| Kết nối hệ thống ngoài | `06-INTEGRATION` |
| Hạ tầng và vận hành | `07-DEPLOYMENT` |
