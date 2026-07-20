# 02-SYSTEM-SETTINGS — Thiết lập hệ thống

> **Nguồn tham khảo:** KiotViet `Settings` audit ngày `2026-07-01`

---

## 1. Mục tiêu

Trang Thiết lập gom các cấu hình nền cần cho vận hành QC-OMS.

Mục tiêu là đủ dùng cho xưởng quảng cáo Văn Lâm, không bê nguyên toàn bộ thiết lập retail của KiotViet.

---

## 2. Nhóm Thiết Lập Giữ Lại

| Nhóm | Nội dung giữ | Ghi chú |
|---|---|---|
| Thông tin cửa hàng | Tên cửa hàng/xưởng, điện thoại, địa chỉ, logo nếu cần | Dùng cho bill, báo cáo và thông tin nội bộ; không cần URL/hạn dùng kiểu KiotViet |
| Người dùng & quyền | Tài khoản, trạng thái, permission, lịch sử đổi quyền | Chi tiết ở `01-USERS-PERMISSIONS.md` |
| Chi nhánh | Giữ nền tảng nội bộ để phòng hờ, nhưng MVP chỉ có một chi nhánh ngầm | Không hiển thị chọn/nhãn chi nhánh và không thiết kế luồng chuyển hàng/liên chi nhánh trong MVP |
| Bảo mật | Xác thực khi xuất file, cảnh báo đăng nhập lạ, 2FA nếu triển khai được | Không hiển thị token/mật khẩu/key trong UI/log |
| Tài khoản quỹ | Tiền mặt và từng tài khoản ngân hàng | Nằm trong Finance/Sổ quỹ; không dùng ví điện tử MVP |
| Mẫu in/bill | Mẫu bill thường, chọn/in lại bill | Không phải HĐĐT |
| Hàng hóa nền | Đơn vị tính, nhóm hàng, phương pháp giá vốn tham khảo; BOM định mức từ KiotViet đã dùng khi bán combo (Owner 2026-07-20); cấu hình sản xuất kiểu KiotViet không copy | Chi tiết nằm ở Inventory/PriceBook/BOM |
| Lịch sử thao tác | Xem audit log thao tác quan trọng | Không cho sửa/xóa log từ UI thường |

Nguyên tắc phân quyền MVP:

- Settings là nhóm nhạy cảm, chỉ `Chủ xưởng/Quản trị` hoặc tài khoản được cấp rõ mới vào.
- Preset nhân viên nội bộ đủ quyền thao tác POS/kho/tài chính thường ngày không đồng nghĩa được sửa cấu hình hệ thống.
- Các permission nhỏ vẫn có thể tồn tại ở nền kỹ thuật, nhưng UI Settings không nên khuyến khích chia quá nhiều vai nếu xưởng chưa cần.

---

## 3. Nhóm Thiết Lập Loại Khỏi QC-OMS Hiện Tại

| KiotViet | Quyết định QC-OMS |
|---|---|
| Giao hàng, đối tác vận chuyển, COD | Bỏ. QC-OMS chỉ bán đứt tại xưởng |
| Thanh toán QR ting ting, đăng ký bank partner, NAPAS, ví MoMo/ZaloPay | Bỏ khỏi MVP. QC-OMS chỉ ghi nhận tiền mặt/chuyển khoản vào tài khoản ngân hàng đã khai báo |
| Gửi SMS/Zalo theo nhà cung cấp marketing | Bỏ. QC-OMS chỉ hỗ trợ mở/copy/gửi ảnh bill theo cấu hình khách đã chốt trong POS |
| Thuế & Kế toán, VAT | Bỏ |
| Hóa đơn điện tử | Bỏ |
| Ngoại tệ và tỷ giá | Bỏ. Mặc định dùng VND |
| Đặt hàng, trả hàng, thu khác kiểu retail, chặn HĐĐT | Bỏ theo scope bán đứt/no-HĐĐT |
| Tích điểm, voucher, coupon, khuyến mại campaign | Bỏ khỏi MVP |
| Bảo hành/bảo trì/sửa chữa retail | Bỏ |
| Thương hiệu/thuộc tính retail | Không tạo module riêng; nếu cần ghi trong tên/mã/nhóm hàng |
| Xóa dữ liệu gian hàng theo lịch | Không làm UI thường. Không có lịch xóa/lịch sử xóa/thêm lịch trong sản phẩm vận hành |
| Khóa sổ giao dịch kiểu KiotViet | Để sau. MVP ưu tiên báo cáo động và sửa chứng từ có lịch sử `MaCu.01` |
| Cân điện tử | Bỏ hiện tại, vì xưởng không bán/nhập/chuyển hàng theo cân |

Ghi chú đơn giản hóa:

- KiotViet `Thông tin cửa hàng` có cả địa chỉ truy cập và hạn sử dụng tài khoản. QC-OMS không đưa các trường này vào Settings vận hành.
- KiotViet `Quản lý chi nhánh` có địa chỉ lấy hàng, số người dùng, múi giờ và trạng thái. QC-OMS có thể giữ `branch_id` nội bộ để phòng hờ, nhưng MVP chỉ vận hành một chi nhánh ngầm nên UI không hiện `Chi nhánh trung tâm`, bộ chọn chi nhánh hoặc tab quản lý chi nhánh.

---

## 4. Thiết Lập Hàng Hóa

KiotViet có nhiều toggle hàng hóa. QC-OMS chỉ giữ phần phục vụ vận hành xưởng:

| KiotViet Settings | QC-OMS |
|---|---|
| Đơn vị tính | Giữ. Dùng danh mục đơn vị gọn, không tạo tràn lan quy cách thành đơn vị |
| Nhóm hàng | Giữ. Dùng cho lọc, báo cáo, bảng giá/công thức giá và cấu hình sản xuất sau này |
| Phương pháp giá vốn | Giữ dưới dạng cấu hình tham khảo cho phase Purchase/PriceBook; MVP chưa gọi là giá vốn kế toán chuẩn |
| Sản xuất hàng hóa | Không copy nguyên KiotViet. QC-OMS dùng BOM/định mức vật tư: import KV dùng ngay khi bán combo trừ thành phần (Owner 2026-07-20); không làm sản xuất sẵn trong phạm vi đó. Deep-scan/BOM nhiều cấp và UI cấu hình sâu vẫn mở rộng theo phase |
| Phân quyền theo nhóm hàng | Để sau. MVP dùng permission theo module; chỉ bổ sung quyền theo nhóm hàng nếu vận hành thật sự cần |
| Mã vạch hàng hóa | Không làm trong MVP/POS hiện tại |
| Tự động gợi ý thông tin hàng hóa từ KiotViet | Bỏ |
| Thuộc tính màu/kích cỡ/chất liệu kiểu retail | Bỏ; nếu cần ghi vào tên/mã/nhóm hàng hoặc quy cách sản phẩm |
| Thương hiệu | Bỏ module riêng; nếu cần ghi trong tên/mã/nhóm hàng |
| Vị trí giá/kệ/tủ | Để sau Warehouse Location; không làm trong MVP |
| Bảo hành/bảo trì/yêu cầu sửa chữa | Bỏ |

Quy tắc đơn giản hóa:

- Product Settings không phải nơi sửa tồn cuộn/tấm trực tiếp.
- Cấu hình ảnh hưởng trừ kho, giá vốn hoặc bảng giá phải nằm ở đúng module Inventory/PriceBook/Purchase, không ẩn sâu trong một trang Settings chung.
- Nếu một setting chưa có nghiệp vụ xưởng rõ, mặc định không hiện trên UI.

---

## 5. Quy Tắc UX

- Trang Settings chỉ hiển thị nhóm cấu hình có trong scope QC-OMS.
- Không hiện các menu đã loại để tránh người dùng tưởng hệ thống có nghiệp vụ đó.
- Cấu hình ảnh hưởng tiền/kho/quyền phải ghi audit log.
- Thao tác nguy hiểm như vô hiệu hóa tài khoản quản trị cuối cùng, xóa dữ liệu, hoặc xóa tài khoản ngân hàng đang có giao dịch phải bị chặn.
- Nếu cấu hình đang được chứng từ sử dụng, UI cho đổi trạng thái `inactive` thay vì xóa vật lý.
- Xuất file nhạy cảm có thể yêu cầu xác thực lại nếu người dùng có quyền cấu hình bật.
- 2FA nếu làm thì ưu tiên tài khoản quản trị và đăng nhập từ thiết bị lạ, không biến MVP thành luồng đăng nhập rườm rà.
- Audit log tối thiểu cần lọc theo nhân viên, tính năng và thời gian.
- Audit log phải ghi rõ hành động chính như tạo/sửa/hủy hóa đơn, tạo phiếu thu/chi, nhập hàng, kiểm kho, xuất file và đổi cấu hình quan trọng.
- MVP không khóa báo cáo cuối ngày thành số bất biến; nếu sau này cần khóa sổ, phải mở spec riêng để xử lý sửa chứng từ, kho, sổ quỹ và công nợ sau ngày khóa.
- Nếu cần xóa/reset dữ liệu, xử lý bằng runbook kỹ thuật có backup và quyền đặc biệt, không phải tính năng người dùng bấm trong Settings.

---

## 6. Acceptance Criteria UX

1. Admin xem và sửa được thông tin cửa hàng cơ bản.
2. Admin quản lý được tài khoản/quyền từ nhóm System.
3. Admin quản lý được danh sách tài khoản ngân hàng từ Finance hoặc link nhanh trong Settings.
4. Settings không hiển thị giao hàng/COD/online/VAT/HĐĐT/QR partner/ví điện tử/ngoại tệ.
5. Các thay đổi cấu hình quan trọng có audit log.
6. Không có thao tác xóa dữ liệu hàng loạt, đặt lịch xóa dữ liệu hoặc lịch sử xóa trong UI vận hành thường ngày.
7. Settings hàng hóa không hiển thị barcode/POS scan, tự gợi ý hàng hóa, thuộc tính retail, thương hiệu, bảo hành hoặc cân điện tử trong MVP.
8. Vai trò/preset nếu có chỉ là tick quyền nhanh, không thay permission cụ thể.
9. Lịch sử thao tác xem được các hành động quan trọng và không cho sửa/xóa từ UI.

---

← [Quay về System README](./README.md)
