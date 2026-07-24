# 02-SYSTEM-SETTINGS — Thiết lập hệ thống

> **Nguồn tham khảo:** KiotViet `Settings` audit ngày `2026-07-01`

---

## 1. Mục tiêu

Trang Thiết lập gom các cấu hình nền cần cho vận hành QCVL.

Mục tiêu là đủ dùng cho xưởng quảng cáo Văn Lâm, không bê nguyên toàn bộ thiết lập retail của KiotViet.

---

## 2. Runtime V1 đang có

| Nhóm | Nội dung đang có | Guard server |
|---|---|---|
| Thông tin cửa hàng | Tên, điện thoại, địa chỉ, địa danh in, logo | `perm.access_admin_panel` |
| Mẫu in/bill | Chọn mẫu mặc định và quản lý mẫu in | `perm.access_admin_panel` |
| Người dùng & quyền | Danh sách/tìm/lọc/tạo/sửa/active-inactive/tick permission | `perm.manage_users` |

- Settings route cần `perm.access_admin_panel`.
- Session có Settings nhưng thiếu `perm.manage_users` không render control user/role và không gọi API user/permission.
- Server trả `403 PERMISSION_DENIED` cho direct API khi thiếu permission; UI hide không phải authorization.

## 3. Roadmap, chưa là capability V1

- Chi nhánh và liên chi nhánh.
- Workstation management UI.
- Audit log/lịch sử thao tác.
- Xác thực lại khi xuất file nhạy cảm, cảnh báo đăng nhập lạ, 2FA.
- Khóa sổ, xóa/reset dữ liệu và lịch sử thao tác.

## 4. Nhóm Thiết Lập Loại Khỏi QCVL Hiện Tại

| KiotViet | Quyết định QCVL |
|---|---|
| Giao hàng, đối tác vận chuyển, COD | Bỏ. QCVL chỉ bán đứt tại xưởng |
| Thanh toán QR ting ting, đăng ký bank partner, NAPAS, ví MoMo/ZaloPay | Bỏ khỏi MVP. QCVL chỉ ghi nhận tiền mặt/chuyển khoản vào tài khoản ngân hàng đã khai báo |
| Gửi SMS/Zalo theo nhà cung cấp marketing | Bỏ. QCVL chỉ hỗ trợ mở/copy/gửi ảnh bill theo cấu hình khách đã chốt trong POS |
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

- KiotViet `Thông tin cửa hàng` có cả địa chỉ truy cập và hạn sử dụng tài khoản. QCVL không đưa các trường này vào Settings vận hành.
- KiotViet `Quản lý chi nhánh` có địa chỉ lấy hàng, số người dùng, múi giờ và trạng thái. QCVL có thể giữ `branch_id` nội bộ để phòng hờ, nhưng MVP chỉ vận hành một chi nhánh ngầm nên UI không hiện `Chi nhánh trung tâm`, bộ chọn chi nhánh hoặc tab quản lý chi nhánh.

---

## 4. Thiết Lập Hàng Hóa

KiotViet có nhiều toggle hàng hóa. QCVL chỉ giữ phần phục vụ vận hành xưởng:

| KiotViet Settings | QCVL |
|---|---|
| Đơn vị tính | Giữ. Dùng danh mục đơn vị gọn, không tạo tràn lan quy cách thành đơn vị |
| Nhóm hàng | Giữ. Dùng cho lọc, báo cáo, bảng giá/công thức giá và cấu hình sản xuất sau này |
| Phương pháp giá vốn | Giữ dưới dạng cấu hình tham khảo cho phase Purchase/PriceBook; MVP chưa gọi là giá vốn kế toán chuẩn |
| Sản xuất hàng hóa | Không copy nguyên KiotViet. QCVL dùng hướng BOM/định mức vật tư riêng khi phase BOM bắt đầu |
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

- Trang Settings chỉ hiển thị nhóm cấu hình có trong scope QCVL.
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

## 7. Acceptance Criteria UX

- [x] Settings hiện thông tin cửa hàng và mẫu in cho session có `perm.access_admin_panel`.
- [x] User management chỉ hiện/gọi API khi session có `perm.manage_users`; direct API vẫn server-deny khi thiếu quyền.
- [x] Không hiện giao hàng/COD/online/VAT/HĐĐT/QR partner/ví điện tử/ngoại tệ.
- [x] Không có thao tác xóa dữ liệu hàng loạt, đặt lịch xóa dữ liệu hoặc lịch sử xóa trong UI vận hành thường ngày.
- [x] Settings không hiện barcode/POS scan, tự gợi ý hàng hóa, thuộc tính retail, thương hiệu, bảo hành hoặc cân điện tử trong V1.
- [ ] Roadmap: audit log, re-auth, 2FA, chi nhánh, workstation UI, khóa sổ; cần plan con/runtime evidence trước khi đổi thành `[x]`.

---

← [Quay về System README](./README.md)
