# STOCKTAKE — UX phiếu kiểm kho

> **Nguồn tham khảo UI:** KiotViet tính năng Kiểm kho; điều chỉnh theo object-level stocktake của QC-OMS.

---

## 0. Ghi nhận từ KiotViet

KiotViet có dữ liệu kiểm kho thực tế khi mở rộng thời gian `01/07/2016 - 01/07/2026`: `332 giao dịch`.

Các quan sát dùng cho QC-OMS:

- Màn mặc định lọc `Tháng này` có thể trống, nhưng khi bấm tìm tiếp sẽ thấy lịch sử dài hạn.
- Danh sách hiển thị các trạng thái `Phiếu tạm`, `Đã cân bằng kho`, `Đã hủy`.
- Nhiều phiếu có ghi chú dạng `Phiếu kiểm kho được tạo tự động khi cập nhật Hàng hóa:<Mã hàng>`.
- Đây là bằng chứng luồng sửa tồn trong Hàng hóa sinh phiếu kiểm kho tự động là nghiệp vụ đang dùng thực tế, nên giữ trong MVP.

---

## 1. Mục đích

Màn Kiểm kho giúp người dùng:

- tạo phiếu kiểm kho
- nhập số lượng thực tế
- xem chênh lệch
- lưu tạm
- cân bằng kho
- hủy phiếu tạm

QC-OMS phải hỗ trợ kiểm kho theo tổng cho hàng thường và theo từng cuộn/tấm cho hàng cuộn/tấm.

Kiểm kho khác với khui vật tư:

- `Kiểm kho` là nghiệp vụ cân bằng số lượng thực tế so với số hệ thống; tạo `stocktakes`, `stocktake_items` và `stock_movements.stocktake_adjustment`.
- `Khui vật tư` là nghiệp vụ mở vật tư mới hoặc kết thúc phần cũ; ghi `inventory_material_openings` và `stock_movements.material_opening`, không tạo phiếu kiểm kho.
- Cả hai đều hiện trong `Thẻ kho`, nhưng danh sách `Phiếu kiểm kho` chỉ chứa phiếu kiểm/cân bằng kho.

---

## 2. Danh sách phiếu kiểm kho

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Kiểm kho                                               [+ Kiểm kho] [Xuất file]    │
├───────────────────────┬────────────────────────────────────────────────────────────┤
│ Tìm mã phiếu          │ Mã kiểm kho | Thời gian | Ngày cân bằng | SL lệch | ...     │
│ Thời gian tạo         │ KK000123    | ...       | ...           | +2/-1   | ...     │
│ Trạng thái            │ KK000122    | ...       |               | 0       | ...     │
│ Người tạo             │                                                            │
└───────────────────────┴────────────────────────────────────────────────────────────┘
```

### Bộ lọc

| Bộ lọc | Giá trị |
|---|---|
| Mã phiếu | Search text |
| Thời gian tạo | Hôm nay, tháng này, tùy chỉnh; khi màn trống cần có cách mở rộng khoảng tìm kiếm |
| Trạng thái | Phiếu tạm, đã cân bằng kho, đã hủy |
| Người tạo | Nhân viên |

### Cột danh sách

| Cột | Ghi chú |
|---|---|
| Mã kiểm kho | Mã tự sinh, ví dụ `KK000333` |
| Thời gian | Thời điểm tạo phiếu |
| Ngày cân bằng | Thời điểm cân bằng kho nếu có |
| SL thực tế | Tổng số lượng thực tế trên phiếu |
| Tổng thực tế | Giá trị tồn thực tế |
| Tổng chênh lệch | Có thể âm hoặc dương |
| SL lệch tăng | Phần lệch tăng |
| SL lệch giảm | Phần lệch giảm |
| Ghi chú | Lý do kiểm kho hoặc nguồn tự động từ sửa hàng hóa |
| Trạng thái | Phiếu tạm, đã cân bằng kho, đã hủy |

### Trạng thái hiện tại trong app

- Màn `Phiếu kiểm kho` nằm trong module `Hàng hóa`.
- App đã có sidebar lọc mã phiếu/trạng thái, nút `+ Kiểm kho`, nút `Xuất file`, bảng danh sách và phân trang.
- Danh sách đang hiển thị các cột KiotViet-style: `Mã kiểm kho`, `Thời gian`, `Ngày cân bằng`, `SL thực tế`, `Tổng thực tế`, `Tổng chênh lệch`, `SL lệch tăng`, `SL lệch giảm`, `Ghi chú`, `Trạng thái`.
- `Tổng thực tế` và `Tổng chênh lệch` tính từ `stocktake_items.actual_qty`, `stocktake_items.difference_qty` và `products.latest_purchase_cost`.
- Nếu thiếu giá vốn để tính giá trị, UI hiển thị `Chưa có` thay vì đoán số.
- API chi tiết phiếu hiện trả đầu phiếu + số tổng hợp; bảng dòng chi tiết trong màn tạo/sửa phiếu sẽ làm ở bước manual stocktake.

---

## 3. Tạo/sửa phiếu kiểm kho

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Kiểm kho KK000123                                           [Lưu tạm] [Cân bằng]  │
├────────────────────────────────────────────────────────────────────────────────────┤
│ [Tìm hàng hóa]                                                                         │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Mã hàng | Tên hàng | Loại tồn | Đối tượng | SL hệ thống | SL thực tế | Lệch | Ghi chú │
│ BAT32   | Bạt 3.2 | Cuộn     | ROLL-001  | 120.0       | 118.0     | -2   | ...     │
│ ALU01   | Alu 01  | Tấm      | SHEET-01  | 2.98        | 2.98      | 0    | ...     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Chọn dòng kiểm kho

| Loại tồn | Hành vi UI |
|---|---|
| Hàng thường | Chọn sản phẩm, nhập `SL thực tế` theo đơn vị tồn chính |
| Cuộn | Chọn sản phẩm rồi chọn cuộn cụ thể |
| Tấm | Chọn sản phẩm rồi chọn tấm/tấm lỡ cụ thể |

Nếu người dùng chọn hàng cuộn/tấm mà chưa chọn đối tượng vật lý, dòng hiển thị lỗi inline.

---

## 5. Lưu tạm, cân bằng, hủy

### Lưu tạm

- Nút `Lưu tạm` lưu phiếu ở trạng thái `Phiếu tạm`.
- Không đổi tồn kho.
- Người dùng có thể mở lại để sửa.
- Trạng thái triển khai hiện tại: route API đã tồn tại nhưng trả `VALIDATION_ERROR` rõ ràng, chưa lưu phiếu thủ công để tránh fake success.

### Cân bằng kho

- Nút `Cân bằng kho` mở confirm.
- Confirm hiển thị tổng số dòng lệch tăng/lệch giảm.
- Sau khi xác nhận, phiếu chuyển `Đã cân bằng kho`.
- Tồn kho cập nhật theo số thực tế.
- Trạng thái triển khai hiện tại: route API đã tồn tại nhưng chưa cân bằng phiếu thủ công; sửa tồn hàng thường vẫn dùng endpoint tự sinh phiếu đã cân bằng.

### Hủy phiếu

- Chỉ phiếu tạm có nút hủy.
- Phiếu đã cân bằng không hiển thị nút hủy trong MVP.
- Phiếu hủy vẫn xem lại được trong danh sách.
- Trạng thái triển khai hiện tại: route API đã tồn tại nhưng chưa hủy phiếu thủ công.

---

## 6. Phiếu tự động khi sửa tồn hàng hóa

Khi người dùng sửa tồn hàng `normal` từ trang Hàng hóa:

- UI không mở đầy đủ màn kiểm kho.
- Sau khi xác nhận sửa tồn, hệ thống báo đã tạo phiếu kiểm kho tự động.
- Thông báo có link `Xem phiếu`.
- Phiếu có ghi chú theo mẫu nghiệp vụ.

Hàng cuộn/tấm không dùng luồng sửa tồn tổng này.

## 6.1. Quan hệ với khui vật tư

Khi khui vật tư phụ, cuộn hoặc tấm:

- Không tạo `stocktakes`.
- Nếu phần cũ về `0`, hệ thống ghi log/movement để truy vết phần cũ bị kết thúc hoặc bỏ.
- Nếu khui vật tư mới làm thay đổi tồn chính thức, hệ thống ghi `stock_movements.movement_type = material_opening`.
- Nếu nhân viên muốn kiểm lại một nhóm vật tư sau khi khui nhiều lần, dùng màn `+ Kiểm kho` thủ công riêng.

Lý do không tạo phiếu kiểm kho khi khui: nếu mỗi lần khui sinh phiếu kiểm, danh sách kiểm kho sẽ lẫn thao tác vận hành với thao tác kiểm kê, khó đối soát. `Thẻ kho` vẫn đủ vết vì movement có `document_type = material_opening`.

---

## 7. Acceptance Criteria UX

1. Danh sách phiếu lọc được theo trạng thái, thời gian và người tạo.
2. Phiếu tạm không làm thay đổi tồn kho.
3. Cân bằng kho có confirm trước khi ghi tồn.
4. Hàng cuộn/tấm bắt buộc chọn đối tượng vật lý.
5. Phiếu đã cân bằng không có thao tác hủy trong MVP.
6. Sửa tồn hàng thường từ Hàng hóa tạo phiếu kiểm kho tự động và có link xem phiếu.

---

← [Quay về Inventory README](./README.md)
