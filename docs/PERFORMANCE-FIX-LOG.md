# PERFORMANCE-FIX-LOG

> **Vai trò:** Log đo tải, fix đã làm và verification để các luồng sau không làm trùng.
> **Cập nhật:** 2026-07-05.

---

## 2026-07-05 — Lượt Tối Ưu Load

Branch thực hiện: `codex/load-performance`

### Vấn Đề Đã Kiểm

- Nhiều trang list load chậm vì gọi API trùng hoặc gọi thêm theo từng dòng.
- `/sales-documents` khi bấm chi tiết có cảm giác đứng vì UI chờ payload xong mới phản hồi.
- Auth guard làm route hiển thị chậm vì phải đợi `/api/v1/me`.
- Một số endpoint list/detail trả nhiều dữ liệu UI chưa dùng.

### Fix Đã Làm

- Shared API client:
  - dedupe các `GET` chạy đồng thời
  - cache `GET` đã xong trong 1 giây
  - clear cache sau request ghi dữ liệu
- Auth:
  - cache `/api/v1/me` trong `sessionStorage`
  - cho route render ngay khi có token
  - refresh `/me` nền
- POS:
  - load ban đầu giới hạn 12 sản phẩm
  - tách load sản phẩm khỏi resolve giá
- Customers:
  - list trả `total_debt_amount`
  - bỏ gọi debt detail theo từng dòng lúc mở list
  - debt detail chỉ load khi mở tab công nợ
- Sales documents:
  - list dùng database pagination khi không search text
  - bấm chi tiết hiện `Đang tải chi tiết...` ngay
  - detail endpoint ban đầu không load mảng payment/debt/stock/history chưa dùng
  - tab lịch sử thanh toán vẫn hiện nhưng chưa gọi history API
- Purchase receipts:
  - list ban đầu không load supplier/product/finance lookup
  - lookup supplier/product chỉ load khi tạo hoặc mở chi tiết phiếu nhập
  - finance accounts chỉ load khi dùng control chuyển khoản
  - bấm chi tiết hiện loading inline ngay
- Suppliers:
  - list ban đầu không load linked-customer options hoặc finance accounts
  - customer options chỉ load khi tạo/sửa NCC
  - finance accounts chỉ load khi dùng control chuyển khoản
  - chi tiết/thanh toán NCC hiện loading inline ngay

### Kết Quả Đo

| Trang / thao tác | Trước | Sau |
|---|---:|---:|
| `/customers` initial API requests | 17 | 2 |
| `/purchase/receipts` initial API requests | 7 | 2 |
| `/price-book` initial API requests | 4 | 3 |
| `/suppliers` initial API requests | 4 | 2 |
| `/pos` initial API requests | 4 | 4 |

Ghi chú:

- `/sales-documents` list thường còn khoảng 1.09s sau auth/cache.
- `/sales-documents` detail API còn khoảng 1.3-1.4s trên local Supabase, nhưng UI đã phản hồi loading ngay.
- `/purchase/receipts` detail còn 3 API song song (`receipt`, `suppliers`, `products`), nhưng loading inline hiện trước khi API xong.
- Local Supabase vẫn là giới hạn thời gian: một số endpoint còn 0.7-1.4s trước khi frontend render xong.

### Verification Đã Chạy

```bash
npm test -- --run --reporter dot --pool forks --silent=false
npm run typecheck
/Users/vanlam/.deno/bin/deno check supabase/functions/api/index.ts
/Users/vanlam/.deno/bin/deno test --no-check supabase/tests/functions/sales_documents_test.ts
git diff --check
```

Kết quả:

- Vitest: PASS — 31 files, 178 tests.
- Typecheck: PASS.
- Deno check: PASS.
- Sales documents Deno tests: PASS — 7 tests.
- Diff whitespace check: PASS.
- Cảnh báo React `act(...)` cũ vẫn còn, không phát sinh từ lượt tối ưu này.
