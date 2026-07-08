# RECONCILIATION — UX đối soát cuối ngày


---

## 1. Mục đích

Màn Đối soát giúp kiểm tra số tiền hệ thống với thực tế:

- tiền mặt trong két
- từng tài khoản ngân hàng

Không đối soát chuyển khoản bằng một tổng chung.

---

## 2. Danh sách phiên đối soát

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Đối soát cuối ngày                                      [+ Đối soát]      │
├───────────────────────┬────────────────────────────────────────────────────┤
│ Thời gian             │ Mã phiên | Khoảng thời gian | Trạng thái | Lệch    │
│ Trạng thái            │ DS00001  | 30/06/2026       | Đã chốt    | 0       │
│ Người tạo             │ DS00002  | 29/06/2026       | Phiếu tạm  | -50,000 │
└───────────────────────┴────────────────────────────────────────────────────┘
```

---

## 3. Tạo phiên đối soát

Khi tạo phiên, người dùng chọn:

- khoảng thời gian
- ghi chú nếu có

Hệ thống tạo các dòng đối soát cho:

- quỹ tiền mặt
- từng tài khoản ngân hàng active

---

## 4. Màn chi tiết đối soát

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Đối soát DS00001                                      [Lưu tạm] [Chốt]    │
├────────────────────────────────────────────────────────────────────────────┤
│ Tài khoản       | Số hệ thống | Số thực tế | Chênh lệch | Ghi chú         │
│ Tiền mặt        | 10,000,000  | [10,000,000] | 0         |                 │
│ MB Bank         | 25,000,000  | [25,000,000] | 0         |                 │
│ Vietcombank     | 5,000,000   | [4,950,000]  | -50,000   | Phí chưa ghi    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Chốt đối soát

- Nút `Chốt` mở confirm.
- Confirm hiển thị các dòng có chênh lệch.
- Chốt đối soát không tự tạo phiếu điều chỉnh tiền trong MVP.
- Nếu có lệch, nhân viên xử lý bằng phiếu thu/chi thủ công có lý do.

---

## 6. Hủy phiên

- Chỉ phiên tạm có nút hủy.
- Phiên đã chốt không hủy trong MVP.
- Phiên hủy vẫn xem lại được.

---

## 7. Acceptance Criteria UX

1. Đối soát hiển thị tiền mặt và từng tài khoản ngân hàng thành các dòng riêng.
2. Người dùng nhập số thực tế và thấy chênh lệch ngay.
3. Chốt đối soát có confirm nếu còn chênh lệch.
4. Chốt đối soát không tự sinh phiếu điều chỉnh.
5. Phiên đã chốt không có nút hủy trong MVP.

---

← [Quay về Finance README](./README.md)
