# Nhà cung cấp, phiếu nhập và trả NCC QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [purchase-routes.ts](../../../server/modules/purchase/purchase-routes.ts), [purchase-transaction-handlers.ts](../../../server/modules/purchase/purchase-transaction-handlers.ts), [purchase-receipt-transactions.ts](../../../server/modules/purchase/purchase-receipt-transactions.ts).

## Route và vòng đời

| Nghiệp vụ | Route |
|---|---|
| Supplier CRUD | `GET/POST /api/v1/suppliers`, `GET/PATCH /api/v1/suppliers/{id}` |
| Phiếu nhập | `GET/POST /api/v1/purchase/receipts`, `GET/PATCH /api/v1/purchase/receipts/{id}` |
| Post/hủy phiếu | `POST /api/v1/purchase/receipts/{id}/post`, `POST /api/v1/purchase/receipts/{id}/cancel` |
| Danh sách phải trả/trả NCC | `GET /api/v1/suppliers/{id}/payable-receipts`, `POST /api/v1/suppliers/{id}/payments` |

Phiếu nhập lưu snapshot theo `organization_id`. Chỉ `draft` được `PATCH`; post/cancel dùng transaction PostgreSQL và advisory lock theo receipt.

## Post phiếu nhập

Post chỉ xử lý `draft`; gọi lặp lại receipt đã post trả kết quả idempotent, không post lần hai.

Trong một transaction, runtime:

1. Thay stock movement theo receipt.
2. Cập nhật purchase cost catalog.
3. Nếu `paid_amount > 0`, tạo cashbook entry theo `cash` hoặc `bank_transfer` và finance account đã chọn.
4. Đổi snapshot thành `posted`.
5. Recompute product balance và supplier total.

Không tự suy diễn object tồn cuộn/tấm, nhiều kho, delivery, purchase order hay PriceBook formula ngoài schema/repository hiện hành.

## Hủy phiếu nhập

Cancel receipt chạy transaction và advisory lock:

- Mark receipt `cancelled`, đặt `paid_amount`/`remaining_amount` bằng `0`, cancel payment rows trong snapshot.
- Cancel cashbook payment gắn trực tiếp receipt.
- Nếu receipt từng `posted`, reverse stock movement.
- Recompute product balance và supplier total.

Nếu payment đã phân bổ chung cho nhiều receipt, handler trả `PURCHASE_RECEIPT_SHARED_PAYMENT_REQUIRES_ALLOCATION_REVERSAL`; không được hủy để che lỗi hoặc xóa chứng từ.

## Trả nhà cung cấp

Request cần `operation_id` UUID, payment method, finance account tùy method và allocation `{ purchase_receipt_id, amount }`.

Runtime bảo vệ:

- Không có allocation dương: reject.
- Receipt phải thuộc supplier đã chọn.
- Allocation không vượt `remaining_amount` receipt.
- `operation_id` có payload hash: retry cùng nội dung trả response cũ; dùng lại ID với nội dung khác trả conflict.
- Transaction tạo cashbook entry, cập nhật `paid_amount`/`remaining_amount` và thêm posted supplier-payment cho từng receipt, rồi recompute supplier total.

Không FIFO tự động, không mass allocation từ chênh tổng. Allocation cần evidence hoặc input user rõ ràng.

## Supplier và công nợ

Supplier/customer là ID nghiệp vụ riêng. Chỉ liên kết qua `linked_customer_id` khi dữ liệu đã xác minh; không map tự động bằng tên/điện thoại. Tổng payable/supplier phải do backend recompute từ receipt/payment runtime, không nhập tay hoặc dùng snapshot KV làm anchor.

## Import KiotViet

Route preview/import/delete có tồn tại. Không dùng delete importer broad làm workflow repair. Repair historical cần evidence từng receipt/payment/allocation, child plan và invariant audit trước mutation.

## Quy tắc an toàn

- Mọi read/mutation scope `organization_id`.
- Không sửa trực tiếp snapshot, cashbook hoặc movement trong production.
- Timestamp lưu UTC; UI hiển thị ngày `DD-MM-YYYY` theo `Asia/Ho_Chi_Minh`.
- Sau post/cancel/payment repair: kiểm receipt status, payment allocation, cashbook, stock balance và supplier total.

## Tham chiếu

- [Purchase schema](../../04-DATABASE/Purchase/PURCHASE-TABLES.md)
- [Purchase API](../../05-BACKEND-MayChu/Purchase/PURCHASE-API.md)
- [Purchase transactions](../../../server/modules/purchase/purchase-receipt-transactions.ts)
