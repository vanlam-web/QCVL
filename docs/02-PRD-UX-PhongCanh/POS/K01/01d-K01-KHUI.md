# 01d-K01-KHUI - Khui vật tư thủ công

> **Phạm vi:** UX khui vật tư phụ, cuộn và tấm.
> **Trở về:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
> **Business:** [STOCK-RULES.md](../../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md)

---

## 1. Mục tiêu

Khui vật tư dùng khi nhân viên bắt đầu dùng cuộn/tấm mới hoặc cần ghi nhận phần cũ còn lại.

Mục tiêu:

- mỗi lần khui chỉ xử lý một vật tư
- không bắt kiểm toàn bộ kho
- không bắt chọn lô/ngày mua trong MVP
- nếu chưa đủ dữ liệu vật lý thì vẫn cho ghi nhận từ tồn tạm
- phần cũ còn lại do hệ thống gợi ý, nhân viên được sửa theo thực tế

Vật tư phụ vẫn đi qua popup khui khi sản phẩm có quy đổi đơn vị lớn sang đơn vị nhỏ, ví dụ `1 ram = 500 tờ`, `1 bao LED = 100 con`, `1 cuộn decal = n mét`.

---

## 2. Vị trí mở

Nút `Khui vật tư` có 3 nơi mở:

- **POS Top Bar:** nằm trong cụm `K01 tiện ích` góc phải, mở modal `Khui vật tư thủ công`.
- **Dòng hàng POS:** chỉ hiện khi dòng đang nhập kích thước/số lượng bị thiếu vật tư, dùng để khui nhanh đúng vật tư thiếu.
- **Module Kho:** mở modal thủ công cho hàng `normal`, `roll`, `sheet`.

```text
[Tìm hàng...] [Hóa đơn 1] [+] [Khui VT] [Lịch sử] [Trạng thái] [Theme] [Profile]
```

Không có khu vực Top Bar riêng cho `Khui vật tư`. Nút khui nằm chung cụm tiện ích để tiết kiệm chiều ngang.

---

## 3. Luồng chung

```text
Chọn vật tư
-> hệ thống nhận dạng normal/roll/sheet
-> chọn khổ/kích thước cần khui
-> nhập phần cũ còn lại nếu có
-> xác nhận
-> ghi stock movement/log; roll/sheet tạo hoặc cập nhật object vật lý
```

Khui vật tư không tạo phiếu kiểm kho. Khui ghi `inventory_material_openings` và `stock_movements` để Thẻ kho truy vết được. Phiếu kiểm kho chỉ dùng cho kiểm/cân bằng kho hoặc sửa tồn trực tiếp ở Hàng hóa.

---

## 4. POS topbar

Modal `Khui vật tư thủ công` dùng cho hàng đang có trong danh sách POS hiện tải.

Trường chính:

- vật tư
- đơn vị khui
- số lượng khui mới
- phần cũ còn lại
- ghi chú

Với hàng `normal`, backend ghi movement âm để đưa phần cũ về `0` khi `old_remaining_qty > 0`, rồi ghi movement dương cho lượng khui mới đã quy đổi về đơn vị tồn chính. Cả hai movement gắn `material_opening_id`, không tạo `stocktakes`.

---

## 5. Khui nhanh từ dòng POS

Khi POS tính thấy dòng hàng thiếu vật tư, nút `Khui vật tư` hiện ngay trên dòng đó.

| Tình huống | Hành vi |
| --- | --- |
| Thiếu một vật tư | Popup mở sẵn vật tư đó |
| Thiếu nhiều vật tư | Popup hiện danh sách vật tư thiếu, nhân viên chọn một hoặc nhiều vật tư |
| Dòng là combo/BOM | Danh sách thiếu lấy từ vật tư thành phần sau khi tính BOM/snapshot |
| Dòng chỉ là báo giá | Vẫn chỉ cảnh báo và hiện nút khui; không bắt buộc khui |
| Nhân viên bỏ qua | Không thay đổi dữ liệu dòng; checkout/báo giá tiếp tục theo rule tồn âm/cảnh báo |

Khui nhanh không tự sửa BOM, không tự lưu combo mới và không đổi giá bán.

---

## 6. Quy tắc theo loại vật tư

### `normal`

- Áp dụng cho vật tư phụ có quy đổi bao bì hoặc đơn vị lớn sang nhỏ.
- Phần dở/cũ được đưa về `0`.
- Lượng khui mới quy đổi về đơn vị tồn chính.
- Không tạo cuộn/tấm vật lý.

### `roll`

- Chọn vật tư cuộn, khổ rộng, chiều dài cuộn mới và phần cuộn cũ còn lại.
- Nếu đã có object cuộn `available`, backend chọn object phù hợp theo rule đơn giản.
- Nếu chưa có object nhưng còn tồn tạm, cho khui từ tồn tạm và ghi log chuẩn hóa.

### `sheet`

- Chọn vật tư tấm và khổ thao tác, ví dụ `1.2m x 2.4m`.
- Nhập hoặc bỏ phần tấm cũ còn lại.
- Phần còn lại quá nhỏ chỉ được đề xuất bỏ, không tự bỏ âm thầm.

---

## 7. Lỗi và cảnh báo

| Tình huống | Hành vi |
| --- | --- |
| Chưa chọn vật tư | Không cho xác nhận |
| Vật tư không thuộc nhóm khui | Gợi ý dùng điều chỉnh tồn |
| Khổ/kích thước thiếu | Không cho xác nhận |
| Số mét hoặc kích thước <= 0 | Báo lỗi ngay tại ô nhập |
| Không còn object chuẩn hóa để khui | Cho khui từ tồn tạm nếu còn; nếu không có thì cảnh báo thiếu tồn |
| Thiếu tồn hoặc tồn âm | Cảnh báo nhẹ, vẫn cho ghi nhận nếu owner cho tồn âm theo rule kho |

---

## 8. Acceptance Criteria

1. `Khui vật tư` trên POS nằm trong cụm `K01 tiện ích`, không có khu vực riêng.
2. Khui vật tư phụ đưa phần dở/cũ về `0` và ghi log.
3. Khui cuộn chỉ cần chọn vật tư, khổ, dài cuộn mới và phần cũ còn lại.
4. Nếu cuộn cũ đã chuẩn hóa, UI gợi ý số còn lại nhưng cho sửa.
5. Nếu cuộn cũ chưa chuẩn hóa, UI mặc định phần cũ còn lại là `0`.
6. Nhập phần cũ còn lại lớn hơn `0` giữ lại object để dùng tiếp.
7. Nhập `0` kết thúc/bỏ phần cũ, không tạo object rác.
8. Khui tấm dùng khổ thao tác như `1.2m x 2.4m`.
9. Tất cả thao tác khui ghi log tối thiểu: ai, lúc nào, vật tư, khổ/kích thước, giá trị cũ/mới nếu có.
10. Khi mở khui từ dòng POS, popup prefill vật tư thiếu nếu chỉ thiếu một vật tư.
11. Khi một dòng thiếu nhiều vật tư, popup cho chọn một hoặc nhiều vật tư để khui.
12. Không bấm `Khui vật tư` thì hệ thống không tự khui và không chặn lưu báo giá.

---

← [Quay về K01 Top Bar](./01-K01-TOPBAR.md)
