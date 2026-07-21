# Plan — Bill templates Tầng B

Updated: 2026-07-21  
Branch: `cursor/bill-templates-tier-b-0482`

## Chốt (Owner: theo gợi ý)

| Quyết định | Chọn |
|---|---|
| Mức độ | **B1** — mẫu cố định A4 + K80, không editor HTML |
| Thông tin cửa hàng | Sửa được: tên, địa chỉ, SĐT |
| Khi in | Toolbar chọn **A4 / K80**; mặc định theo Thiết lập |
| Nhớ theo khách | **Không** (sau) |
| Quyền | Chỉ vào được Thiết lập (`accessAdminPanel`) |
| Lưu trữ B1 | **localStorage** máy/trình duyệt (`qcvl.organizationBillSettings`) — chưa Postgres |

## Deliverables

1. `bill-settings.ts` — đọc/ghi shop + `default_bill_template` (`a4`|`k80`)
2. Thiết lập menu: **Thông tin cửa hàng** + **Mẫu in**
3. `InvoicePrintPage` / `QuotePrintPage`: shop header; class `bill-template-a4` / `bill-template-k80`; toolbar chọn mẫu; `?template=`
4. Tests + docs ngắn (Sales README / DOC-CLEANUP)

## Ngoài scope

- Editor mẫu tùy biến, logo upload, preference theo khách, Zalo, ESC/POS raw, sync Postgres org settings
