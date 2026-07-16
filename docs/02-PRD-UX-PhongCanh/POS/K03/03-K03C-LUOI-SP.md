# 03-K03C-LUOI-SP.md — K03-C: LƯỚI SẢN PHẨM NHANH

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. GIAO DIỆN

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                                              │
│  │  [Ảnh SP]       │  │  [Ảnh SP]       │  │  [Ảnh SP]       │                                              │
│  │  Tên sản phẩm   │  │  Tên sản phẩm   │  │  Tên sản phẩm   │                                              │
│  │  40,000/m²      │  │  65,000/m²      │  │  80,000/cái     │                                              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                                              │
│  │  ...             │  │  ...             │  │  ...             │                                              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                                              │
│                                                                                            [< 1 / 13 >]  [‹] [›] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## II. THÀNH PHẦN

| Thành phần | Mô tả |
|---|---|
| **Lưới sản phẩm co giãn** | Hiển thị sản phẩm/dịch vụ đang bật bán trên POS; số cột tự co giãn theo chiều rộng màn hình và nội dung ô |
| **Ô sản phẩm** | Hiển thị 3 hàng cố định: mã hàng, tên sản phẩm, đơn giá/ĐVT. Dòng dài tự cắt bằng `...`. Ảnh sản phẩm không bắt buộc |
| **Phân trang** | `[< 1 / 13 >]` = Trang hiện tại / Tổng số trang |
| **Nút điều hướng trang** | `[‹]` trang trước, `[›]` trang sau |

---

## III. HÀNH VI CLICK

- Click vào ô bất kỳ → thêm sản phẩm vào K02-A theo đúng loại dòng:
  - **SP thường / ĐVT cái:** thêm ngay 1 dòng, số lượng mặc định `1`.
  - **SP m²:** thêm dòng và focus vào ô dài/rộng để nhập nhanh kích thước.
  - **Combo:** thêm dòng combo; chi tiết combo có thể bung tại K02-A nếu cần.
- Nếu đang ở trang khác, click vẫn thêm bình thường.
- Không có nút sửa sản phẩm trong POS; sửa thông tin sản phẩm tại trang Hàng hóa.
- Nếu sản phẩm thiếu vật tư hoặc hết tồn, K03-C không chặn thao tác thêm vào giỏ. Cảnh báo và xử lý tồn kho diễn ra ở bước kiểm tra/thanh toán/trừ kho.

---

## IV. THANH PHÂN TRANG

| Thành phần | Chi tiết |
|---|---|
| **Format** | `[< 1 / 13 >]` |
| **Nút `[‹]`** | Quay về trang trước (disabled nếu đang trang 1) |
| **Nút `[›]`** | Tiến đến trang sau (disabled nếu đang trang cuối) |
| **Mỗi trang** | Hiển thị số thẻ theo kích thước lưới thực; màn hẹp về 2 cột, màn rộng lên 3 cột, card tự giãn theo nội dung và không khóa cố định 3 cột |

---

## V. GIÁ HIỂN THỊ VÀ SẮP XẾP

- K03-C chỉ hiển thị sản phẩm/dịch vụ đang bật bán trên POS.
- Sắp xếp mặc định: sản phẩm hay dùng lên trước.
- "Hay dùng" lấy từ bảng server `pos_product_usage`, không lấy từ cache trình duyệt hay `localStorage`, nên đổi máy POS vẫn giữ đúng thứ tự.
- Riêng local `3202` chạy dev-memory: thứ tự "hay dùng" derive từ `salesDocuments.items` đã lưu/import, để khớp lịch sử bán/báo giá trong `logs/dev-memory-state.json`.
- Khi lưu báo giá hoặc tạo hóa đơn thành công, backend cộng lượt dùng cho từng `product_id` xuất hiện trong dòng hàng.
- POS gọi `GET /api/v1/products?status=active&sort=pos_usage` để lấy danh sách nhanh; server sắp theo `usage_count desc`, sau đó fallback theo dữ liệu sản phẩm.
- Lưới `Sản phẩm nhanh` không khóa 12 thẻ hay 3 cột cố định; số thẻ mỗi trang phụ thuộc chiều cao lưới còn lại sau topbar/khách hàng/queue, và số cột đổi giữa 2 hoặc 3 theo bề rộng vùng hiển thị.
- Mỗi thẻ sản phẩm nhanh có 3 dòng hiển thị: mã hàng ở dòng 1, tên hàng ở dòng 2, giá/ĐVT ở dòng 3; nếu mã hoặc tên dài hơn bề rộng thẻ thì dùng ellipsis.
- Không có tùy chọn sắp xếp khác trong POS để giữ thao tác nhanh và đơn giản.
- Nếu đã chọn khách ở K03-A, giá hiển thị theo bảng giá đang áp dụng của khách.
- Nếu chưa chọn khách, giá hiển thị theo Giá chung.
- Nếu sản phẩm không có giá trong bảng giá của khách, dùng giá từ Giá chung.
- Ô tìm kiếm sản phẩm dùng chung với `F3` tại K01; K03-C chỉ đóng vai trò lưới chọn nhanh.

---

← [Quay về Master Map](../01-POS-LAYOUT.md)
