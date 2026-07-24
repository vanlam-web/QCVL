# Quy tắc nguồn dữ liệu hiện hành QCVL

Cập nhật: `2026-07-24`

## Đọc nhanh

- Runtime source of truth: Node API và PostgreSQL trên NAS.
- Local dev UI: `http://127.0.0.1:3202`; local API dev: `http://127.0.0.1:3100`.
- NAS release target duy nhất: `http://100.84.228.125:3200`.
- Không có staging/preview promotion target. `3202` không là bằng chứng runtime NAS.
- KiotViet là nguồn đối chiếu/import lịch sử khi scope nêu rõ; không thay PostgreSQL runtime.
- Không khôi phục Supabase, RAM-only runtime hoặc fixture demo làm nguồn dữ liệu vận hành.
- Không copy `logs/dev-memory-state.json` lên NAS.

## Trước khi sửa hoặc đối soát

1. Với lỗi local, xác định đúng process `3100` và `3202` đang chạy từ repository nào.
2. Với release, chỉ audit `3200`: active image/commit, health PostgreSQL, migration và smoke page/API đã chạm.
3. Đọc tài liệu domain liên quan trước khi sửa tiền, công nợ, hóa đơn, kho, import, quyền hoặc người dùng.
4. Kiểm tra PostgreSQL persistence; không chấp nhận flow báo thành công nhưng refresh mất dữ liệu.
5. Với KiotViet, xác định file nguồn, khoảng thời gian, filter và quy tắc business date `Asia/Ho_Chi_Minh`.

## Ranh giới dữ liệu

| Dữ liệu | Nguồn runtime | Ghi chú |
|---|---|---|
| Checkout POS, báo giá, hóa đơn | PostgreSQL qua API | Không dùng local storage/RAM làm nguồn ghi. |
| Công nợ, thu nợ, sổ quỹ, phân bổ | PostgreSQL qua API | Không suy diễn allocation từ tổng chênh lệch. |
| Tồn kho, điều chỉnh, kiểm kho | PostgreSQL và `stock_movements` | Snapshot/provisional chỉ dùng khi contract ghi rõ. |
| Import KiotViet | File nguồn + parser + PostgreSQL | Import phải có preview/evidence và không ghi đè dữ liệu không thuộc scope. |
| State browser | local storage/cache | Chỉ phục hồi trải nghiệm, không thay dữ liệu server. |

## Quy tắc tiền, nợ và import

- Không tự gán allocation theo FIFO hoặc theo tổng tiền nếu chưa có ownership/evidence từ nguồn.
- Không mass-delete hoặc mutation chứng từ trước khi chứng minh phạm vi và quan hệ thanh toán.
- `Timestamptz` lưu UTC; ngày nghiệp vụ/filter/hiển thị dùng `Asia/Ho_Chi_Minh`.
- UI hiển thị ngày `DD-MM-YYYY`; key nội bộ/API có thể chuẩn hóa nhưng không được lộ sai format UI.
- Sau `11/07/2026`, dữ liệu cần đối chiếu KiotViet theo scope Owner; dữ liệu trước mốc này chỉ sửa/xóa khi evidence đủ.

## Kiểm tra bắt buộc

- Sau migration/release `3200`: kiểm tra active image/commit, health, persistence PostgreSQL, route smoke và invariant domain liên quan.
- Release chỉ chạy khi commit sạch, typecheck/focused tests/preflight pass; deploy script rollback image khi health/smoke fail.
- Khi kết quả không rõ: dừng mutation, tạo audit/plan con để xác minh nguồn.

## Tài liệu liên quan

- [Quy tắc làm việc](../AI_TEAM_RULES.md)
- [Điều phối hiện hành](./PROJECT-COORDINATION.md)
- [Quy tắc tài liệu](./DOCUMENT_RULES.md)
- [Runbook NAS](./07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md)
