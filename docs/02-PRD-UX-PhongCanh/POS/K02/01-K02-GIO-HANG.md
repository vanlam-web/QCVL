# 01-K02-GIO-HANG.md — K02: TỔNG QUAN GIỎ HÀNG & ĐIỀU PHỐI MÁY TRẠM

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. SƠ ĐỒ MẶT BẰNG SƠ LƯỢC TRONG KHỐI K02

Khối K02 (Chiếm **65%** bên trái màn hình) được xếp chồng theo chiều dọc từ trên xuống dưới:

```
+-------------------------------------------------------------------------+
| [K02-A] Dải các Dòng sản phẩm trong Giỏ hàng (Tự động kéo dài xuống)    |
|   - Dòng loại 1: Hàng tính m² [Rộng x Dài x SL]                         |
|   - Dòng loại 2: Hàng tính Cái [SL thuần]                               |
|   - Dòng loại 3: Hàng Combo/BOM [Nút bung rộng cấu hình vật tư phụ]     |
+-------------------------------------------------------------------------+
| [K02-B] Ô nhập Ghi chú tổng toàn đơn (Textarea rộng)                    |
+-------------------------------------------------------------------------+
| [K02-C] Thanh hiển thị: Tổng m² in: ... | TỔNG TIỀN HÀNG: ...           |
+-------------------------------------------------------------------------+
| [K02-D] Khối Hàng đợi Máy sản xuất dưới đáy [IN BẠT] [IN DECAL] [CẮT CNC] |
+-------------------------------------------------------------------------+
```

Chi tiết từng khối con:


| Khối                                           | File                                         |
| ---------------------------------------------- | -------------------------------------------- |
| K02-A: Dòng sản phẩm động + BOM              | [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md)   |
| K02-B: Ghi chú đơn hàng tổng                  | [03-K02B-GHI-CHU.md](./03-K02B-GHI-CHU.md)  |
| K02-D: Hàng đợi máy sản xuất                  | [04-K02D-HANG-DOI.md](./04-K02D-HANG-DOI.md) |


---

## II. LOGIC TIẾP NHẬN: KHI CLICK CHỌN SẢN PHẨM THÌ HIỆN RA CÁI GÌ?


| Nội dung                        | Chi tiết                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phân loại sản phẩm theo ĐVT     | [→ POS-ORDER-CALC.md §1](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#1-phân-loại-sản-phẩm-theo-đơn-vị-tính) |
| Loại 1 (m²): công thức `R×D×SL` | [→ POS-ORDER-CALC.md §2](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#2-loại-1--sản-phẩm-tính-theo-m²) |
| Loại 2 (Cái/Bộ): cộng dồn SL    | [→ POS-ORDER-CALC.md §3](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#3-loại-2--sản-phẩm-tính-theo-cái--bộ--cuộn--mét-dài) |
| Loại 3 (Combo/BOM)              | [→ POS-ORDER-CALC.md §4](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#4-loại-3--combo--bom) |


---

## III. QUY TẮC CỘNG DỒN DÒNG TRÙNG (REDUNDANCY CHECK)


| Loại                                  | Sản phẩm đã có → chọn lại      | Chi tiết                                                                                                                                    |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tính theo `m²`                        | Luôn sinh **dòng mới độc lập** | [→ BR-CALC-02](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#br-calc-02-không-cộng-dồn-cho-sản-phẩm-m²) |
| Tính theo `Cái / Bộ / Cuộn / Mét dài` | **Cộng +1** vào SL dòng cũ     | [→ BR-CALC-03](../../../03-BUSINESS-NghiepVu/Sales/POS-ORDER-CALC.md#br-calc-03-cộng-dồn-1-sl-khi-chọn-trùng) |


---

← [Quay về Master Map](../01-POS-LAYOUT.md)
