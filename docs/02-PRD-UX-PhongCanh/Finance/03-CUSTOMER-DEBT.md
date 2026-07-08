# CUSTOMER-DEBT — UX công nợ và thu nợ khách hàng


---

## 1. Mục đích

Màn Công nợ giúp nhân viên xem nợ theo khách hàng và thu nợ ngoài checkout POS.

QC-OMS quản lý công nợ theo từng hóa đơn còn nợ, không chỉ theo một số tổng.

`KH000001 - Khách lẻ` là hồ sơ khách mặc định của tổ chức. Hóa đơn POS chưa chọn khách nhưng còn nợ vẫn được ghi vào `KH000001`; ghi chú khách lẻ nếu có dùng để nhận diện người nợ, không tạo bucket công nợ `customer_id = null`.

---

## 2. Bố cục danh sách công nợ

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Công nợ khách hàng                              [Tìm khách/mã hóa đơn] [+ Thu nợ] │
├───────────────────────┬────────────────────────────────────────────────────────────┤
│ Bộ lọc                │ Khách hàng | Tổng nợ | Hóa đơn nợ cũ nhất | Số hóa đơn nợ │
│ Nhóm khách            │ Công ty A  | 500,000| HD000123           | 3             │
│ Trạng thái            │ Khách lẻ   | 120,000| HD000145           | 1             │
│ Khách lẻ nợ           │                                                            │
└───────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết công nợ khách

Chi tiết khách gồm:

- tổng nợ hiện tại
- danh sách hóa đơn còn nợ, sắp xếp cũ nhất trước
- lịch sử phát sinh nợ/trả nợ
- các phiếu thu liên quan

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Công nợ: Công ty A                                      [Thu nợ] [Xuất]   │
├────────────────────────────────────────────────────────────────────────────┤
│ Tổng nợ: 500,000                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│ Hóa đơn | Ngày | Tổng tiền | Đã trả | Còn nợ | Ghi chú                  │
│ HD001   | ...  | 300,000   | 100,000| 200,000|                          │
│ HD002   | ...  | 300,000   | 0      | 300,000|                          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Thu nợ

Form thu nợ:

- khách hàng
- số tiền thu
- phương thức: tiền mặt, chuyển khoản, hoặc kết hợp
- tài khoản ngân hàng nếu có chuyển khoản
- ghi chú

Sau khi nhập số tiền, UI hiển thị preview phân bổ:

```text
Số tiền thu: 500,000

Phân bổ dự kiến:
1. HD000123 còn nợ 200,000 -> trả 200,000 -> còn 0
2. HD000124 còn nợ 300,000 -> trả 300,000 -> còn 0
```

Phân bổ mặc định vào hóa đơn cũ nhất trước. MVP không cho thu vượt tổng nợ để tạo trả trước.

---

## 5. Khách lẻ nợ

Khách lẻ nợ nằm dưới khách mặc định `KH000001 - Khách lẻ`. Có thể có bộ lọc nhanh để xem riêng các hóa đơn `KH000001` có ghi chú nhận diện khách lẻ.

Mỗi dòng phải hiển thị:

- mã hóa đơn
- ghi chú nhận diện khách
- số còn nợ
- ngày phát sinh

Nếu sau này chuyển một khoản nợ từ `KH000001` sang hồ sơ khách cụ thể, cần spec riêng vì đây là thao tác đổi chủ công nợ/chứng từ.

---

## 6. Acceptance Criteria UX

1. Người dùng xem được tổng nợ theo khách.
2. Người dùng mở được danh sách hóa đơn còn nợ của một khách.
3. Thu nợ hiển thị preview phân bổ vào hóa đơn cũ nhất trước.
4. Không cho nhập số tiền thu vượt tổng nợ trong MVP.
5. Khách lẻ nợ thuộc `KH000001`, có ghi chú nhận diện khi cần và không bị rơi vào bucket không khách.

---

← [Quay về Finance README](./README.md)
