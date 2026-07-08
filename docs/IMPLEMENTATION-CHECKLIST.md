# QC-OMS Implementation Checklist

> **Vai trò:** Log baseline implement gần nhất, không phải roadmap sống dài hạn.
> **Nguồn trạng thái sống:** [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).
> **Cập nhật:** 2026-07-05.

---

## Baseline Đã Kiểm

| Nhóm | Kết quả |
|---|---|
| Lint | Pass |
| Typecheck | Pass |
| Frontend unit tests | Pass |
| Function tests | Pass |
| DB tests | Pass |
| E2E | Pass |
| Build | Pass, route-level chunks dưới ngưỡng cảnh báo Vite |

---

## Module UI Đã Có Trong Baseline

| Module | Nội dung chính |
|---|---|
| Inventory | Route `/inventory`, danh sách tồn, detail sản phẩm, stock movement, chỉnh tồn hàng thường |
| Finance | Route `/finance`, tài khoản/quỹ, sổ quỹ, công nợ khách hàng, thu nợ, danh sách voucher readonly |
| Reports | Route `/reports`, báo cáo cuối ngày, bán hàng, công nợ, kho |
| BOM | BOM v1 một cấp cho normal inventory components, lưu active BOM, snapshot/trừ component khi checkout |

---

## Lệnh Kiểm Khi Chạm Baseline

```bash
npm run lint
npm run typecheck
npm test
npm run test:functions
npm run test:db
npm run test:e2e
npm run build
```
