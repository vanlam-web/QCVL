# 03-K02B-GHI-CHU.md — K02-B: GHI CHÚ ĐƠN HÀNG TỔNG

> **Mốc chốt:** Đã chốt.
> **Phần:** 2.1
> **Trở về:** [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

## GIAO DIỆN

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Ghi chú đơn hàng:  [________________________________________________________________________]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CHỨC NĂNG


| Thành phần                   | Mô tả                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **Ô nhập văn bản diện rộng** | Ghi nhận yêu cầu chung của toàn đơn hàng                                                         |
| **Hiển thị lại**             | Nội dung ghi chú hiển thị trong Dialog thanh toán và bill                                       |
| **Ví dụ thực tế**            | `"Giao trước 14h ngày mai"`, `"Khách lấy hàng tự vận chuyển"`, `"In lại màu chuẩn theo file cũ"` |


---

## TRẠNG THÁI GIAO DIỆN


| Trạng thái | Hành vi                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| **Empty**  | Placeholder: `"Ghi chú đơn hàng (nếu có)"` — nét chữ mờ, không có giá trị             |
| **Focus**  | Viền ô nhấn sáng, placeholder ẩn, con trỏ nhấp nháy                                   |
| **Filled** | Nội dung hiển thị bình thường — giá trị được lưu cùng đơn hàng khi bấm THANH TOÁN |
| **Error**  | Viền đỏ nếu nhập quá giới hạn ký tự — xem Validation                                  |


---

## VALIDATION


| Quy tắc                   | Chi tiết                                                    |
| ------------------------- | ----------------------------------------------------------- |
| **Loại ký tự**            | Chữ, số, dấu câu, khoảng trắng, xuống dòng                  |
| **Ký tự bị cấm**          | Không cho phép ký tự điều khiển (ASCII 0–31)                |
| **Giới hạn chiều dài**    | Tối đa **500 ký tự**                                       |
| **Khi vượt quá giới hạn** | Cắt tại 500 ký tự, không lưu phần dư — không hiện toast lỗi |


> Cấu trúc lưu trữ ghi chú thuộc tầng Database và sẽ được đặc tả cùng bảng đơn hàng.

---

## EDGE CASES


| Tình huống                        | Hành vi                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| **Không nhập gì, bấm THANH TOÁN** | Đơn hàng không có ghi chú                                             |
| **Xóa đơn hàng (hủy)**            | Ghi chú bị xóa cùng đơn — không còn hiển thị ở đâu                    |
| **Mở lại đơn cũ (undo hủy)**      | Ghi chú được khôi phục cùng đơn                                       |
| **Copy-paste nội dung dài**       | Hệ thống tự cắt tại 500 ký tự — không throw error                     |
| **Dòng mới (Enter)**              | Cho phép xuống dòng trong ô nhập — hiển thị xuống dòng trên bill |


---

← [Quay về K02 Tổng quan](./01-K02-GIO-HANG.md)
