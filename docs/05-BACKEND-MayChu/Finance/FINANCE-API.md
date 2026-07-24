# API tài chính QCVL

Cập nhật: `2026-07-24`

## Nguồn thực thi

Nguồn chính xác là [finance-routes.ts](../../../server/modules/finance/finance-routes.ts), handlers và repository
Finance. Quy tắc tiền, công nợ, ownership chứng từ ở `docs/03-BUSINESS-NghiepVu/Finance/`.

## Route hiện hành

| Method | Route | Mục đích |
|---|---|---|
| `GET` | `/api/v1/finance/accounts` | Danh sách quỹ/tài khoản. |
| `POST` | `/api/v1/finance/accounts` | Tạo quỹ/tài khoản khi quyền cho phép. |
| `PATCH` | `/api/v1/finance/accounts/{id}` | Cập nhật quỹ/tài khoản. |
| `GET` | `/api/v1/finance/customer-debts` | Danh sách công nợ khách. |
| `GET` | `/api/v1/finance/customers/{id}/open-debts` | Chứng từ nợ còn mở của khách. |
| `GET` | `/api/v1/finance/customers/{id}/debt` | Tổng/chi tiết công nợ khách. |
| `POST` | `/api/v1/finance/debt-collections` | Thu nợ theo validation/allocation server. |
| `PATCH` | `/api/v1/finance/customer-debt-adjustments/{id}` | Sửa điều chỉnh công nợ theo quyền. |
| `GET` | `/api/v1/finance/cashbook/balances` | Số dư quỹ/tài khoản. |
| `GET` | `/api/v1/finance/cashbook/vouchers` | Danh sách chứng từ sổ quỹ. |
| `GET` | `/api/v1/finance/cashbook` | Danh sách sổ quỹ có filter/paging/summary. |
| `GET` | `/api/v1/finance/cashbook/{id}` | Chi tiết dòng sổ quỹ. |
| `PATCH` | `/api/v1/finance/cashbook/{id}` | Cập nhật dòng được phép sửa. |
| `POST` | `/api/v1/finance/cashbook-vouchers` | Tạo phiếu thu/chi. |
| `POST` | `/api/v1/finance/cashbook-vouchers/{id}/cancel` | Hủy mềm phiếu. |
| `POST` | `/api/v1/finance/cashbook-vouchers/{id}/revise` | Tạo bản sửa phiếu theo contract server. |
| `POST` | `/api/v1/finance/cashbook/import/kiotviet/preview` | Xem trước import sổ quỹ KiotViet. |
| `POST` | `/api/v1/finance/cashbook/import/kiotviet` | Import sổ quỹ KiotViet. |
| `DELETE` | `/api/v1/finance/cashbook/import/kiotviet` | Xóa phạm vi import KiotViet theo server. |
| `POST` | `/api/v1/finance/customer-debt-adjustments/import/kiotviet/preview` | Xem trước import điều chỉnh nợ. |
| `POST` | `/api/v1/finance/customer-debt-adjustments/import/kiotviet` | Import điều chỉnh nợ. |

## Quy tắc bắt buộc

- Server kiểm tra quyền, organization scope, trạng thái chứng từ và toàn bộ input.
- Không tự suy diễn allocation/FIFO từ aggregate mismatch. Mutation cần ownership/evidence nguồn.
- Import phải qua preview; chỉ xóa row thuộc đúng source/scope import, không xóa POS/manual data.
- Tiền, nợ, allocation và sổ quỹ phải đọc lại được từ PostgreSQL sau mutation.
- Ngày nghiệp vụ dùng `Asia/Ho_Chi_Minh`; UI hiển thị `DD-MM-YYYY`.

## Tham chiếu

- [Nghiệp vụ Finance](../../03-BUSINESS-NghiepVu/Finance/README.md)
- [Schema Finance](../../04-DATABASE/Finance/README.md)
- [Quy ước backend](../BACKEND_CONVENTIONS.md)
