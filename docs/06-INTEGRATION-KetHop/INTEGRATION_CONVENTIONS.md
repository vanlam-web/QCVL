# Quy ước tích hợp QCVL

Tuân theo [quy tắc tài liệu](../DOCUMENT_RULES.md), [kiến trúc tài liệu](../ARCHITECTURE.md) và [_RULES.md](./_RULES.md).

## Ranh giới

Tích hợp chỉ giao tiếp hệ thống/thiết bị ngoài. Luồng: `Nghiệp vụ → Backend → Tích hợp → Hệ thống ngoài`.
UI không gọi trực tiếp adapter tích hợp.

## Contract bắt buộc

- Ghi protocol/version, dữ liệu vào-ra, source-of-truth, direction sync và conflict policy.
- Không hardcode API key/password/token; lấy từ environment hoặc secret manager.
- Có timeout; retry chỉ lỗi tạm thời, giới hạn lần và backoff.
- Mutation gửi lại phải idempotent; message/webhook có ID, trạng thái và chống trùng.
- Xác thực webhook/signature khi nhà cung cấp hỗ trợ; không chạy workflow dài trong HTTP response webhook.
- Log đủ request/response/error/retry/timeout nhưng không lộ secret/dữ liệu nhạy cảm.
- Adapter phát health/success/error/retry/timeout metric; hạ tầng thu thập/cảnh báo thuộc Deployment.

## Import và đồng bộ

- KiotViet import phải có parser, preview, source scope và evidence.
- Không để hai hệ thống ghi đè cùng dữ liệu khi chưa có ownership rule.
- Không tự retry lỗi business/input hoặc suy diễn mapping/allocation từ tổng chênh lệch.
- Thay đổi provider/version phải đánh giá impact và cập nhật consumer contract.

## Cấu trúc

Mỗi provider có thư mục riêng, dùng `README.md`, `API.md`, `CONFIG.md`, `ERRORS.md` khi cần.
