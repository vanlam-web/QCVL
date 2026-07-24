# 02-PRICE-LIST-DETAIL — Chi tiết bảng giá


---

## 1. Mục tiêu

Trang chi tiết bảng giá cho phép xem và sửa giá bán của từng sản phẩm trong một bảng giá.

---

## 2. Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bảng giá: Đại lý                       [Lưu] [Ngừng dùng] [Thêm sản phẩm]   │
│ Mã: BG_DAILY                           Nhóm dùng: Đại lý, Khách quen        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Theo mã/tên hàng...] [Nhóm hàng] [Trạng thái hàng]                         │
│                                                                              │
│ Mã hàng | Tên hàng | Đơn vị bán | Giá vốn | Giá chung | Giá bảng này│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cột bảng

| Cột | Mô tả |
|---|---|
| Mã hàng | Mã sản phẩm |
| Tên hàng | Tên sản phẩm |
| Đơn vị bán | m2, m tới, tấm, cái, bộ... |
| Cách tính bán | Theo số lượng, m2, m tới, tấm, combo |
| Giá vốn | Chỉ đọc nếu có dữ liệu |
| Giá chung | Chỉ đọc để đối chiếu nếu đang sửa bảng giá nhóm |
| Giá bảng này | Ô nhập giá áp dụng cho bảng hiện tại |
| Trạng thái hàng | Đang bán hoặc ngưng bán |

Gợi ý từ KiotViet: có thể cho nhập giá trực tiếp trên lưới để thao tác nhanh, nhưng mỗi màn chỉ nên tập trung một bảng giá đang sửa. Không trải nhiều bảng giá nhóm thành nhiều cột ngang trong QCVL MVP.

Giá vốn là dữ liệu tham khảo lấy từ Purchase/Supplier hoặc tồn vật lý khi module đó đã có. Người dùng không sửa giá vốn tại màn bảng giá.

---

## 4. Quy tắc nhập giá

- Giá phải là số không âm.
- Với sản phẩm bán theo `m tới`, giá là giá cho `1 m tới`.
- Với sản phẩm bán theo `m2`, giá là giá cho `1 m2`.
- Với sản phẩm bán theo số lượng, giá là giá cho một đơn vị bán.
- Nếu bảng giá nhóm không có giá cho sản phẩm, POS fallback về giá chung.
- Sản phẩm ngưng bán vẫn có thể thấy trong bảng giá khi bật bộ lọc trạng thái, nhưng không xuất hiện trong POS.

---

## 5. Thêm sản phẩm vào bảng giá

Khi bấm **Thêm sản phẩm**:

- Tìm theo mã hoặc tên sản phẩm.
- Mặc định chỉ hiện sản phẩm đang bán.
- Có tùy chọn hiện sản phẩm ngưng bán để chỉnh dữ liệu cũ.
- Nếu sản phẩm đã có trong bảng giá, không thêm trùng; focus về dòng hiện có.

---

## 6. Lưu thay đổi

Khi bấm **Lưu**:

- Kiểm tra giá hợp lệ.
- Lưu toàn bộ dòng thay đổi.
- Hiển thị thông báo số dòng đã cập nhật.
- Không tự ghi vào lịch sử giá theo khách + sản phẩm.

Lịch sử giá theo khách + sản phẩm chỉ phát sinh khi POS lưu chứng từ bán có giá sửa tay.

Nếu người dùng thoát trang khi còn dòng giá chưa lưu, UI phải cảnh báo mất thay đổi.

Nếu một sản phẩm có giá bằng `0`, POS vẫn dùng đúng giá `0` nếu đó là giá được khai báo. Trường hợp muốn fallback về giá chung phải để dòng giá trống/không khai báo, không dùng `0` làm tín hiệu fallback.

Sau khi có dữ liệu giá vốn, màn này có thể có thao tác cập nhật/gợi ý giá từ công thức theo nhóm hàng. Công thức có thể lấy `giá vốn bình quân` hoặc `giá nhập cuối`, sau đó tính qua nhiều bước chi phí, hao hụt và lợi nhuận riêng cho từng bảng giá. Công thức lưu được làm mặc định lâu dài theo nhóm hàng/sản phẩm.

Ví dụ hướng công thức:

```text
Giá nền = Giá nhập cuối + vận chuyển + thuế/phí + hao hụt
Giá bảng 40 = Giá nền + lợi nhuận bảng 40
Giá bảng 35 = Giá nền + lợi nhuận bảng 35
```

Ví dụ:

```text
Fomex 5mm:
Giá nền = Giá nhập cuối * (1 + 10% vận chuyển + 8% thuế/phí + 10% hao hụt)
Giá 40 = Giá nền + 40,000/tấm
Giá 35 = Giá nền + 35,000/tấm
```

Khi giá nhập cuối hoặc giá vốn bình quân thay đổi, hệ thống tính lại giá theo công thức và hiển thị chênh lệch. Mặc định người dùng phải bấm áp dụng thì giá đã lưu trong bảng giá mới thay đổi; POS chỉ dùng giá đã lưu.

Vì Owner đã xác nhận cách giá của KiotViet chưa đúng mong muốn, màn chi tiết bảng giá không được khóa thiết kế theo lưới export KiotViet. KiotViet chỉ dùng để import dữ liệu ban đầu và đối chiếu nhóm giá hiện có. Luồng chuẩn của QCVL cần ưu tiên:

- sửa giá chính thức nhanh cho từng bảng giá
- thấy giá vốn/giá nhập cuối để tham khảo
- có nút tính/gợi ý lại giá theo công thức khi Owner chủ động dùng
- phân biệt rõ giá đã lưu và giá đề xuất chưa áp dụng
- giữ lịch sử thay đổi giá để biết ai sửa và sửa lúc nào
- xem được công thức nào đang áp dụng cho dòng/nhóm hàng và giá mới sinh ra từ nguồn giá nào

---

## 7. Tác động tới POS

- Dòng hàng mới trên POS dùng giá mới sau khi bảng giá được lưu.
- Dòng hàng đang mở trong POS và chưa sửa giá thủ công có thể được tính lại khi đổi khách/bảng giá hoặc reload dữ liệu.
- Dòng đã sửa giá thủ công trong POS không bị đè bởi thay đổi bảng giá.
