# Quy tắc quản lý tài liệu QC-OMS

## 1. Phạm vi

File này quy định cách tổ chức, tạo, sửa, audit và bảo trì tài liệu trong `docs/`.

Quyền hạn AI và workflow được quy định tại [AI_TEAM_RULES.md](../AI_TEAM_RULES.md). Phân loại nội dung theo tầng được quy định tại [ARCHITECTURE.md](./ARCHITECTURE.md).

## 2. Thứ tự ưu tiên

Khi có mâu thuẫn, áp dụng theo thứ tự:

1. Quyết định nghiệp vụ mới nhất của Owner.
2. [AI_TEAM_RULES.md](../AI_TEAM_RULES.md) — quyền hạn và workflow AI.
3. [DOCUMENT_RULES.md](./DOCUMENT_RULES.md) — quản trị tài liệu chung.
4. [ARCHITECTURE.md](./ARCHITECTURE.md) — phân tầng nội dung.
5. `_RULES.md` của tầng — phạm vi cục bộ.
6. `*_CONVENTIONS.md` — tiêu chuẩn kỹ thuật của tầng.
7. `README.md` và tài liệu cụ thể.

Luật cấp dưới không được ghi đè luật cấp trên.

## 3. Quy trình làm việc

Trước khi sửa tài liệu, Codex phải:

1. Đọc các luật liên quan và file hiện tại.
2. Xác định loại thông tin và Source of Truth.
3. Kiểm tra liên kết, nội dung trùng và ảnh hưởng liên tầng.
4. Chỉ thay đổi trong phạm vi yêu cầu.
5. Kiểm tra `git diff`, file tạm và lỗi định dạng sau khi sửa.

Các luồng Codex phải làm việc theo vai trò hiện tại trong `AI_TEAM_RULES.md`: Spec giữ Source of Truth, Implement thi công code/test/PR, Review kiểm tra và ghi nhận issue.

## 4. Source of Truth

- Một thông tin chỉ có một nơi gốc.
- Tài liệu khác chỉ tóm tắt ở mức cần thiết và liên kết đến nơi gốc.
- Không sao chép nguyên khối quy tắc giữa nhiều tầng.
- Khi nội dung vừa thuộc UI vừa thuộc nghiệp vụ, PRD mô tả hành vi người dùng và tham chiếu Business cho quy tắc cốt lõi.

## 5. Phạm vi chỉnh sửa

- Sửa đúng yêu cầu, tránh refactor không liên quan.
- Codex được tạo, sửa, đổi tên hoặc di chuyển file khi yêu cầu đã được Owner chấp thuận và việc đó cần thiết để hoàn thành task.
- Thay đổi Business Rule, phạm vi sản phẩm hoặc workflow vận hành phải được Owner quyết định.
- Thay đổi kỹ thuật và cách tổ chức tài liệu do Codex quyết định, nhưng phải báo rủi ro quan trọng.
- Không tự tách file chỉ vì vượt ngưỡng dòng nếu việc tách làm thay đổi Source of Truth hoặc điều hướng; phải đánh giá ảnh hưởng trước.

## 6. Audit và xử lý lỗi

- Nếu Owner chỉ yêu cầu audit/review: chỉ báo cáo, không sửa.
- Nếu Owner yêu cầu xử lý/fix: Codex được sửa các lỗi đã xác nhận trong phạm vi.
- Mỗi issue phải có file, vị trí, mức độ, tác động và khuyến nghị.
- Mâu thuẫn nghiệp vụ phải chuyển Owner quyết định.
- Mâu thuẫn kỹ thuật hoặc tài liệu do Codex quyết định.

## 7. Độ dài và cấu trúc

- Khuyến nghị 150–300 dòng cho tài liệu thông thường.
- Trên 400 dòng: đánh giá khả năng tách, không bắt buộc tách.
- File luật nên ngắn, ưu tiên liên kết thay vì lặp nội dung.
- `_RULES.md` chỉ nên chứa: mục đích, được ghi, không được ghi và ranh giới đặc biệt.
- `*_CONVENTIONS.md` chỉ chứa tiêu chuẩn kỹ thuật riêng của tầng.

## 8. Ranh giới nội dung dùng chung

- Backend và Integration định nghĩa log/metric mà thành phần của mình phát ra.
- Deployment định nghĩa thu thập, lưu giữ, dashboard, cảnh báo và vận hành log/metric.
- Queue kết nối hệ thống ngoài thuộc Integration.
- Queue xử lý nghiệp vụ nội bộ thuộc Backend.
- Cấu hình hạ tầng queue thuộc Deployment.

## 9. Liên kết

- Dùng đường dẫn Markdown tương đối thật cho file tồn tại.
- Không dùng link giả dạng `http://FILENAME.md`.
- Tên file mang tính ví dụ phải dùng code inline, ví dụ `README.md`.
- Sau khi đổi tên hoặc di chuyển file phải kiểm tra liên kết đến file đó.
