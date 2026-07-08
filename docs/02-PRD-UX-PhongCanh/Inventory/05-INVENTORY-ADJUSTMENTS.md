# 05-INVENTORY-ADJUSTMENTS — Hủy/điều chỉnh vật tư tối giản

> **Nguồn:** Chốt từ draft Git history

---

## 1. Mục tiêu

Màn/luồng này giúp ghi nhận vật tư bị bỏ, hỏng, dùng nội bộ hoặc tấm lỡ cần giữ lại/sửa/xóa mà không tạo một module phiếu phức tạp như KiotViet.

QC-OMS ưu tiên thao tác nhanh:

- không làm Xuất dùng nội bộ riêng
- không làm Xuất hủy riêng
- không làm Trả hàng bán/Trả hàng nhập
- ghi lịch sử đủ để kiểm tra tồn kho

---

## 2. Phạm vi

Áp dụng cho:

- cuộn vật tư
- tấm nguyên
- tấm dở
- tấm lỡ/tấm thừa
- hàng thường khi cần điều chỉnh giảm/tăng thủ công

Không áp dụng để sửa hóa đơn bán sai. Hóa đơn sai xử lý bằng sửa chứng từ `MaCu.01` và hủy chứng từ cũ.

---

## 3. Điểm Mở Thao Tác

Người dùng thao tác từ các nơi sẵn có:

- chi tiết cuộn/tấm trong `03-ROLL-SHEET-OBJECTS.md`
- lịch sử kho của sản phẩm
- phiếu kiểm kho nếu đang cân bằng tồn
- danh sách hàng hóa với hàng `normal`

Không tạo menu chính riêng cho `Xuất hủy` hoặc `Xuất dùng nội bộ` trong MVP/current scope.

---

## 4. Tấm Lỡ Dưới 0.3m2

Quy tắc UI:

- Khi hệ thống tính phần dư của hàng `sheet`, mảnh dưới `0.3m2` mặc định bỏ và không tạo tấm lỡ mới.
- Nếu nhân viên thấy mảnh nhỏ vẫn tận dụng được, có nút **Giữ lại tấm lỡ** trong lịch sử hoặc chi tiết vật tư vừa xử lý.
- Khi giữ lại, nhân viên nhập kích thước thực tế, ghi chú nếu cần, rồi hệ thống tạo tấm lỡ trạng thái `available`.
- Nếu hệ thống tạo tấm lỡ nhưng thực tế không dùng được, nhân viên có thể **Bỏ tấm lỡ**.
- Nhân viên có thể sửa kích thước tấm lỡ nếu nhập sai.
- Mảnh dưới `0.3m2` bị bỏ không tạo phiếu hủy riêng; hệ thống chỉ lưu log/audit nhẹ gắn với thao tác nguồn nếu đã có chứng từ nguồn.
- Nếu sau đó nhân viên giữ lại mảnh nhỏ, hệ thống ghi sự kiện phục hồi/tạo tấm lỡ thủ công để tồn kho không bị mất vết.

Không bắt nhân viên xác nhận tấm lỡ sau mỗi lần bán/cắt vì thao tác này rườm rà.

---

## 5. Lý Do Điều Chỉnh

Danh sách lý do ban đầu:

| Lý do | Khi dùng |
|---|---|
| `tam_lo_bo` | Mảnh thừa/tấm lỡ không giữ lại |
| `huy_hong` | Vật tư hỏng, rách, bẩn, sai quy cách |
| `khac` | Trường hợp khác, bắt buộc ghi chú |

UI hiển thị bằng tiếng Việt dễ hiểu:

- Tấm lỡ bỏ
- Hủy hỏng
- Khác

`Dùng nội bộ` không hiển thị như module/lý do mặc định trong QC-OMS hiện tại vì KiotViet không có dữ liệu thực tế và Owner chưa có nhu cầu rõ. Nếu sau này phát sinh, dùng `Khác` kèm ghi chú trước khi mở reason riêng.

---

## 6. Form Điều Chỉnh Nhanh

```text
┌────────────────────────────────────────────────────────────────────┐
│ Điều chỉnh vật tư                                                  │
├────────────────────────────────────────────────────────────────────┤
│ Đối tượng: Tấm ALU01-00012                                         │
│ Hiện tại: 1.22m x 0.45m = 0.549m2                                  │
│                                                                    │
│ Lý do        [Tấm lỡ bỏ v]                                         │
│ Số lượng/DT  [0.549] m2                                            │
│ Ghi chú      [.................................................]    │
│                                                                    │
│                                   [Bỏ qua] [Xác nhận]              │
└────────────────────────────────────────────────────────────────────┘
```

Quy tắc:

- Hàng `roll/sheet` hiển thị đối tượng vật lý cụ thể.
- Hàng `normal` hiển thị số tồn hiện tại và số điều chỉnh.
- Nếu lý do là `khac`, ghi chú bắt buộc.
- Nếu điều chỉnh làm tồn âm, UI cảnh báo nhưng vẫn cho lưu nếu người dùng có quyền.
- Sau khi xác nhận, hệ thống ghi lịch sử tồn ngay.

---

## 7. Lịch Sử

Mỗi thao tác phải lưu tối thiểu:

- thời gian
- người thao tác
- sản phẩm/vật tư
- đối tượng vật lý nếu có
- lý do
- giá trị trước
- giá trị sau
- ghi chú
- chứng từ gốc nếu phát sinh từ bán hàng/kiểm kho

Lịch sử xem tại:

- tab `Lịch sử kho` của sản phẩm
- chi tiết cuộn/tấm/tấm lỡ
- báo cáo tồn kho sau này

---

## 8. Không Làm Trong Scope Hiện Tại

- Không có danh sách phiếu `Xuất hủy` riêng.
- Không có danh sách phiếu `Xuất dùng nội bộ` riêng.
- Không có lý do `Dùng nội bộ` mặc định nếu chưa phát sinh nhu cầu thật.
- Không có duyệt nhiều bước.
- Không có trả hàng bán.
- Không có trả hàng nhập.
- Không tự tạo phiếu chi/thu khi điều chỉnh tồn.

Nếu cần hoàn tiền cho khách trong trường hợp đặc biệt, dùng phiếu chi thủ công ở Sổ quỹ và ghi chú rõ lý do.

---

## 9. Acceptance Criteria UX

1. Tấm lỡ dưới `0.3m2` mặc định bị bỏ, không tạo dữ liệu rác.
2. Nhân viên có thể giữ lại tấm lỡ nhỏ nếu thực tế tận dụng được.
3. Nhân viên có thể sửa hoặc bỏ tấm lỡ đã tạo.
4. Mọi điều chỉnh tồn ghi lịch sử đủ người, thời gian, lý do và giá trị trước/sau.
5. Không xuất hiện menu/module riêng cho Xuất hủy, Xuất dùng nội bộ hoặc Trả hàng trong MVP/current scope.
6. Điều chỉnh tồn không tự tạo phiếu thu/chi.
7. Mảnh dưới `0.3m2` bị bỏ chỉ ghi audit nhẹ theo thao tác nguồn, không sinh phiếu hủy riêng.

---

← [Quay về Inventory README](./README.md)
