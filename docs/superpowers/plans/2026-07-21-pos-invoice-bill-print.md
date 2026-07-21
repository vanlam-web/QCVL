# Plan — Bill Preview / in hóa đơn HD (Tầng A)

Updated: 2026-07-21  
Branch: `cursor/pos-invoice-bill-print-0482`  
SoT: `POS-BILL-PRINT-MESSAGING.md` · `POS-CHECKOUT` BR-CHK-07 · K03D §V–VI · Phase 3B pattern

## Chốt hướng (Owner: làm theo)

| Quyết định | Chọn |
|---|---|
| Phạm vi | **Tầng A** — 1 bill mặc định, chưa trang quản lý mẫu |
| Khổ | **A4** + CSS print (K80 sau) |
| Mở sau thanh toán | Có — sau tạo HD thành công |
| In lại | Có — từ chi tiết Sales Documents `HD…` |
| Gửi Zalo / nhiều mẫu / Settings | **Không** (Phase 7) |
| Đụng tiền/nợ/kho/API checkout | **Không** — chỉ UI đọc snapshot |

Tham khảo KV: có trang Quản lý mẫu in — QCVL **chưa** làm ở lát cắt này.  
Module ngoài: không cần lib mới; reuse `window.print()` + print CSS như `QuotePrintPage`.

## Deliverables

1. `InvoicePrintPage` — route `/sales-documents/:id/invoice-print`
2. Render snapshot HD: cửa hàng, mã, ngày, NV, KH, dòng (kích thước/m²/mét tới), tổng / đã trả / còn nợ / thừa, ghi chú
3. POS: sau checkout HD → navigate mở bill (không chỉ đóng panel)
4. Sales Documents detail: nút `Xem/In hóa đơn` cho `HD…`
5. Tests + docs sync ngắn (Sales README / DOC-CLEANUP nếu cần)

## Ngoài scope

- Template CRUD, preference theo khách, nhiệt K80, html2canvas/Zalo, HĐĐT
- Sửa `CheckoutPanel` payment math / finance / inventory
