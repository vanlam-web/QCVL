# 01-USERS-PERMISSIONS — Quản lý tài khoản và quyền

> **Nguồn kỹ thuật:** `05-BACKEND-MayChu/POS/AUTH.md`, `05-BACKEND-MayChu/FOUNDATION-API.md`

---

## 1. Mục tiêu

Trang này giúp chủ xưởng/quản trị tạo tài khoản nhân viên và cấp quyền đúng phần việc.

QC-OMS dùng permission-based access control:

- không dùng role cứng làm nguồn authorization
- mỗi tài khoản được tick các quyền cụ thể
- backend vẫn kiểm tra quyền trên mọi API

Quyết định MVP 2026-07-01:

- Permission system vẫn giữ làm nền tảng kỹ thuật.
- Vận hành xưởng nhỏ/nội bộ không chia nhỏ quyền quá mức.
- Nhân viên nội bộ mặc định nên được cấp preset đủ quyền thao tác chính của MVP.
- UI không nên làm trải nghiệm bị chia cắt bởi thiếu các quyền nhỏ như `perm.apply_discount`, trừ khi Owner đã chốt kiểm soát riêng.
- Chỉ tách quyền mạnh cho quản lý user/quyền, cấu hình hệ thống, hủy/sửa chứng từ đã chốt nếu cần, và có thể là tài chính nhạy cảm nếu Owner chốt riêng.
- Trạng thái "không có quyền" không phải luồng bình thường của nhân viên nội bộ MVP; chủ yếu dành cho tài khoản hạn chế đặc biệt hoặc truy cập nhầm vùng quản trị.

Ghi chú từ KiotViet audit ngày `2026-07-01`:

- KiotViet `Settings > Quản lý người dùng` có 2 tab chính: `Tài khoản người dùng` và `Quản lý vai trò`.
- Bảng tài khoản gồm tên hiển thị, tên đăng nhập, điện thoại, vai trò và trạng thái.
- KiotViet có gợi ý thiết lập quyền mặc định theo vai trò để phân quyền nhanh.
- KiotViet có `Danh sách nhân viên` với 5 nhân viên thật trong tài khoản đang rà.
- Các cột chính gồm mã nhân viên, mã chấm công, tên nhân viên, SĐT, CMND/CCCD, nợ và tạm ứng, ghi chú.
- Có bộ lọc trạng thái đang làm việc/đã nghỉ, phòng ban, chức danh.
- KiotViet còn có `Bảng chấm công`, `Bảng lương`, `Bảng hoa hồng` và `Thiết lập nhân viên`.
- `Bảng chấm công` có ca làm, lịch tuần, trạng thái đúng giờ/đi muộn/chấm công thiếu/nghỉ làm.
- `Bảng lương` có 23 bảng lương nhưng tổng lương/đã trả/còn cần trả đang là `0`, chủ yếu trạng thái tạm tính.
- `Bảng hoa hồng` có cấu hình theo hàng hóa/nhân viên áp dụng nhưng không có kết quả phù hợp trong lượt rà.
- `Thiết lập nhân viên` gồm khởi tạo, chấm công, tính lương, ngày làm/nghỉ, Zalo mini app và máy chấm công.
- QC-OMS chỉ lấy phần cần cho đăng nhập, quyền và ghi nhận người thao tác. Không copy các trường HR/kế toán nhân sự như mã chấm công, CMND/CCCD, nợ/tạm ứng, phòng ban/chức danh nếu chưa có nghiệp vụ rõ.
- QC-OMS có thể dùng preset/vai trò để tick quyền nhanh, nhưng authorization vẫn dựa trên permission cụ thể.

---

## 2. Bố cục

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tài khoản & quyền                                      [+ Tài khoản]         │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Bộ lọc               │ Email | Tên hiển thị | Trạng thái | Quyền chính       │
│ - Trạng thái         │ ...                                                   │
│ - Quyền              │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Danh sách tài khoản

### Bộ lọc

| Bộ lọc | Quy tắc |
|---|---|
| Tìm kiếm | Email hoặc tên hiển thị |
| Trạng thái | Active, inactive, tất cả |
| Quyền | Lọc tài khoản có một quyền cụ thể |

### Cột bảng

| Cột | Mô tả |
|---|---|
| Email | Email đăng nhập |
| Tên hiển thị | Tên hiện trên POS/báo cáo |
| Trạng thái | Active hoặc inactive |
| Quyền chính | Tóm tắt nhóm quyền được tick |
| Cập nhật gần nhất | Nếu có |
| Thao tác | Mở chi tiết |

Không hiển thị mật khẩu hoặc token.

---

## 4. Tạo tài khoản

Form tạo mới:

- email
- tên đăng nhập
- điện thoại
- tên hiển thị
- mật khẩu tạm
- preset quyền hoặc danh sách quyền tick chọn
- nhóm mở rộng `Thông tin khác`: sinh nhật, địa chỉ, khu vực, phường/xã
- nhóm mở rộng `Ghi chú`: textarea ghi chú nội bộ

Quy tắc:

- Tài khoản mới trong MVP nên mặc định chọn preset `Nhân viên nội bộ` với đủ quyền thao tác chính, để tránh admin phải tick nhiều quyền lặt vặt.
- Nếu tạo tài khoản quản trị, admin chọn preset `Chủ xưởng/Quản trị` có thêm quyền quản lý user/quyền và cấu hình hệ thống.
- Nếu cần tài khoản hạn chế đặc biệt, admin có thể bỏ tick thủ công.
- Email phải hợp lệ và chưa tồn tại.
- Thông tin khác và ghi chú là không bắt buộc; nếu nhập thì lưu thật vào profile nhân viên khi tạo tài khoản.
- Mật khẩu tạm không hiển thị lại sau khi lưu.
- Sau khi tạo, admin gửi mật khẩu tạm cho nhân viên bằng kênh nội bộ; QC-OMS không tự gửi email trong MVP/current scope.

---

## 5. Chi tiết tài khoản

Chi tiết gồm các tab:

- Thông tin
- Quyền
- Lịch sử đổi quyền

### Tab Thông tin

- email chỉ đọc
- tên hiển thị
- trạng thái active/inactive

Không xóa vật lý tài khoản đã có lịch sử. Khi nhân viên nghỉ hoặc không dùng nữa, chuyển inactive.

### Tab Quyền

Hiển thị permission theo nhóm:

| Nhóm | Ví dụ quyền |
|---|---|
| POS | tạo hóa đơn, áp bảng giá/chiết khấu, sửa/hủy chứng từ đã chốt nếu Owner tách quyền riêng |
| Hàng hóa/Kho | quản lý hàng hóa, kiểm kho, điều chỉnh vật tư |
| Tài chính | sổ quỹ, thu nợ, phiếu thu/chi, đối soát |
| Bảng giá | sửa bảng giá |
| Báo cáo | xem báo cáo |
| Hệ thống | quản lý tài khoản và máy trạm |

UI có thể có preset gợi ý như `Thu ngân`, `Kho`, `Quản lý`, nhưng preset chỉ là thao tác tick nhanh. Nguồn quyền cuối cùng vẫn là danh sách permission cụ thể.

Trong MVP, preset khuyến nghị đơn giản hơn:

| Preset | Mục đích | Quy tắc |
|---|---|---|
| Chủ xưởng/Quản trị | Toàn quyền, quản lý user/quyền/cấu hình | Có toàn bộ quyền active |
| Nhân viên nội bộ | Dùng hằng ngày tại xưởng | Có đủ quyền POS, giảm giá thủ công, xem chứng từ, khách hàng, bảng giá, hàng hóa/kho, kiểm kho, công nợ cơ bản, sổ quỹ và thao tác finance/inventory thường ngày trong MVP |
| Kế toán/Kho | Chỉ tạo nếu vận hành thật sự cần tách | Preset tùy chọn, gom nhanh quyền finance/inventory; không bắt buộc trong MVP |
| Hạn chế đặc biệt | Tài khoản thuê ngoài/thử việc | Admin tự bỏ tick quyền không muốn cấp |

Các permission nhỏ như `perm.apply_discount`, `perm.manage_inventory`, `perm.edit_price_book` vẫn có thể tồn tại để backend kiểm soát và mở rộng sau này, nhưng MVP không dùng chúng để tạo trải nghiệm vận hành quá rời rạc cho nhân viên nội bộ.

### Tab Lịch sử đổi quyền

Mỗi dòng hiển thị:

- thời gian
- người thay đổi
- quyền trước
- quyền sau
- hành động: grant, revoke, replace

Không cho sửa/xóa lịch sử.

---

## 6. Máy trạm

Máy trạm/quầy POS quản lý riêng với tài khoản:

- mã máy trạm
- tên máy trạm
- trạng thái active/inactive
- lần hoạt động gần nhất nếu có

Một nhân viên có thể đăng nhập ở máy khác nếu có quyền. Máy trạm không gắn cứng vào user.

---

## 7. Quy Tắc Bảo Mật UX

- Với tài khoản nội bộ mặc định đủ quyền, các nút/tính năng MVP chính nên hiển thị đầy đủ để thao tác liền mạch.
- Với tài khoản hạn chế đặc biệt, nút/tính năng không có quyền thì không render DOM.
- Phím tắt không có quyền phải bị chặn và hiện toast `Không có quyền truy cập`.
- Khi quyền bị thu hồi realtime, UI refetch `/me` và thoát khỏi màn không còn quyền.
- Không hiện service role key, token hoặc mật khẩu trong UI/log.
- Không cho vô hiệu hóa tài khoản quản trị cuối cùng hoặc gỡ quyền `perm.manage_users` khỏi quản trị cuối cùng.
- Có thể yêu cầu xác thực lại trước khi xuất file nhạy cảm như khách hàng, hàng hóa, hóa đơn hoặc sổ quỹ.
- Nếu triển khai 2FA, ưu tiên tình huống đăng nhập thiết bị lạ hoặc tài khoản có quyền quản trị; không bắt buộc làm trong MVP đầu.

---

## 8. Ngoài Scope Hiện Tại

- Chấm công.
- Mã chấm công.
- Lịch làm việc.
- Ca làm việc.
- Bảng lương.
- Hoa hồng.
- Thiết lập lương/thưởng/phụ cấp.
- KPI/hiệu suất nhân sự sâu.
- Phân ca nhân viên.
- Máy chấm công.
- Zalo mini app cho nhân viên.
- CMND/CCCD nhân viên.
- Nợ/tạm ứng nhân viên.
- Phòng ban/chức danh như module HR riêng.
- Role cứng làm nguồn authorization.

Doanh thu theo nhân viên nếu cần nằm trong Reports, không phải module lương/hoa hồng.

---

## 9. Acceptance Criteria UX

1. Admin tạo được tài khoản mới với email, tên hiển thị, mật khẩu tạm và permission.
2. Tài khoản mới mặc định có preset quyền phù hợp với vận hành nội bộ MVP, không bắt admin tick từng quyền nhỏ nếu không cần.
3. Admin sửa được tên hiển thị, trạng thái và permission.
4. Tài khoản inactive không truy cập được ứng dụng.
5. Lịch sử đổi quyền hiển thị trước/sau và người thay đổi.
6. UI không hiển thị module chấm công/lương/hoa hồng.
7. Máy trạm được quản lý riêng, không gắn cứng với user.

---

← [Quay về System README](./README.md)
