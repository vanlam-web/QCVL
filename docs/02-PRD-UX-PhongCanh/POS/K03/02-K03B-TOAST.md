# 02-K03B-TOAST.md — K03-B: NHẮC BỔ SUNG SĐT KHÁCH HÀNG

> **Phần:** 2.1
> **Trở về:** [01-POS-LAYOUT.md](../01-POS-LAYOUT.md)

---

## I. GIAO DIỆN

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  [K03-A: Hồ sơ đối tác]                                                                       │
│                                                                                               │
│                                    ┌────────────────────────────────────────┐                 │
│                                    │ ⚠ Bổ sung SĐT khách hàng              │                 │
│                                    │ [Bỏ qua]                         [🗑] │                 │
│                                    └────────────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Mỗi lần chỉ hiển thị một cảnh báo để không làm gián đoạn thao tác bán hàng.
- Cảnh báo hiển thị cạnh K03-A, không phát âm thanh.
- Khi rê chuột vào cảnh báo, hiển thị nút `[Bỏ qua]` và một icon thùng rác/hủy nhỏ.
- Icon thùng rác/hủy được đặt tách khỏi nút `[Bỏ qua]` và có kích thước nhỏ để hạn chế bấm nhầm.
- Khi rê vào icon, tooltip hiển thị `Không nhắc lại cảnh báo này`.
- Cảnh báo tự ẩn sau 8 giây nếu người dùng không tương tác và được xử lý như thao tác `[Bỏ qua]`.
- Khi rê chuột vào cảnh báo hoặc khi pop-over đang mở, bộ đếm tự ẩn tạm dừng; khi rời chuột và pop-over đã đóng, bộ đếm tiếp tục.

### I.1. Pop-over nhập nhanh

Nhấp vào cảnh báo mở pop-over ngay cạnh cảnh báo:

```
┌──────────────────────────────────────────┐
│ Bổ sung SĐT khách hàng                   │
│ [Ô nhập giá trị.......................]  │
│                         [Bỏ qua] [Lưu]   │
└──────────────────────────────────────────┘
```

- Pop-over chỉ dùng để nhập nhanh SĐT khách hàng.

---

## II. THỨ TỰ ƯU TIÊN

Khi chọn khách hàng đã tồn tại, hệ thống chỉ kiểm tra thiếu SĐT như một nhắc nhở mềm.

- Khách hàng mới vẫn được phép tạo khi chưa có SĐT; nếu cần nhắc bổ sung, hệ thống chỉ nhắc sau khi hồ sơ khách đã tồn tại và được chọn lại.
- Thiếu SĐT không chặn bán hàng, không chặn lưu khách và không chặn thanh toán.
- Không dùng Toast này để nhắc ID Zalo, nhóm Zalo, Facebook hoặc cấu hình gửi tin nhắn.

---

## III. GIÃN CÁCH VÀ KÍCH HOẠT CẢNH BÁO

- Hệ thống chỉ kiểm tra cảnh báo khi người dùng thực hiện hành động chọn khách hàng đã tồn tại.
- Hết 5 phút không tự động hiển thị cảnh báo; nếu không có hành động chọn khách thì không hiện gì.
- Mỗi cảnh báo được giãn cách theo khách hàng.
- Nếu người dùng chọn lại đúng khách hàng đã được cảnh báo sau ít nhất 5 phút, hệ thống mới được phép nhắc lại nếu SĐT vẫn còn thiếu.
- Nếu người dùng chọn một khách hàng khác, hệ thống kiểm tra SĐT của khách mới và hiển thị cảnh báo nếu còn thiếu.
- Không gộp nhiều cảnh báo và không hiển thị bù những cảnh báo đã bỏ qua.
- `[Bỏ qua]` chỉ đóng cảnh báo hiện tại. Cảnh báo đó chỉ có thể xuất hiện lại khi người dùng chọn lại khách hàng tương ứng và đã qua ít nhất 5 phút đối với đúng cảnh báo đó.
- Icon thùng rác/hủy tắt cảnh báo thiếu SĐT đối với khách hàng đó, được hiểu là không nhắc lại cảnh báo này nữa.
- Khi SĐT đã được bổ sung, trạng thái không nhắc lại không còn ý nghĩa.

---

## IV. NHẬP NHANH TỪ CẢNH BÁO

- Nhấp vào cảnh báo mở ô nhập nhanh SĐT.
- `[Lưu]` ghi nhận các giá trị hợp lệ và đóng pop-over.
- `[Bỏ qua]` đóng pop-over mà không lưu; cảnh báo đó vẫn tuân theo thời gian giãn cách 5 phút.
- Lỗi định dạng SĐT hiển thị ngay dưới ô nhập, không tạo thêm Toast.

---

← [Quay về Master Map](../01-POS-LAYOUT.md)
