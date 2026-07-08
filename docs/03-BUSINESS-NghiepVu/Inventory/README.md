# INVENTORY — Nghiệp vụ kho vật tư

> Index nghiệp vụ kho vật tư. Việc đang làm / queue hiện tại nằm ở [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
> Nguồn: phân tích KiotViet export và trao đổi Owner ngày 2026-06-30.

---

## Cấu trúc

| File | Mô tả | Nguồn gốc |
|---|---|---|
| [STOCK-RULES.md](./STOCK-RULES.md) | Chính sách tồn kho, trừ kho, tồn âm, hàng thường/cuộn/tấm và tấm lỡ | Draft KV Inventory 2026-06-30 |
| [UNIT-CONVERSION.md](./UNIT-CONVERSION.md) | Đơn vị tồn chính, đơn vị bán phụ, quy đổi đơn giản, cuộn và tấm | Draft KV Inventory 2026-06-30 |
| [STOCKTAKE.md](./STOCKTAKE.md) | Nghiệp vụ kiểm kho, cân bằng kho, phiếu tự động khi sửa tồn | Đặc tả Kiểm kho KV + chốt Owner |
| [PRODUCTION-RECONCILIATION.md](./PRODUCTION-RECONCILIATION.md) | Đối soát OMS/bill với dữ liệu máy sản xuất, chưa tự động trừ kho | Chốt Owner 2026-06-30 |

---

## Nguyên tắc MVP

- Tạo/lưu đơn bán chính thức là mốc trừ kho trong MVP.
- Dữ liệu máy sản xuất chỉ dùng để giám sát và đối soát, chưa tự sinh bút toán kho.
- Hàng thường được quản lý theo một đơn vị tồn chính.
- Hàng dạng cuộn được quản lý theo từng cuộn vật lý.
- Hàng dạng tấm được quản lý theo tấm nguyên, tấm dở và tấm lỡ.
- Kiểm kho/cân bằng kho luôn tạo bút toán điều chỉnh để truy vết.

---

## Tham chiếu

- [Sales Pricing](../Sales/POS-PRICING.md)
- [Sales Checkout](../Sales/POS-CHECKOUT.md)
- [PRD-UX Khui vật tư](../../02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)
- [Draft phân tích KV](../../superpowers/specs/2026-06-30-kv-product-export-inventory-draft.md)
- [Database](../../04-DATABASE/)
- [Backend](../../05-BACKEND-MayChu/)

---

← [Quay về 03-BUSINESS README](../README.md)
