# PHẦN 1: TẦM NHÌN & MỤC TIÊU CHIẾN LƯỢC

---

## 🎯 1. TẦM NHÌN PHÁT TRIỂN (VISION)

**Hiện tại:** Hệ thống quản lý vận hành nội bộ (OMS) chuyên biệt cho xưởng quảng cáo Văn Lâm, đồng bộ Realtime từ máy sản xuất đến quầy thu ngân.

**Tương lai:** Kiến trúc chuẩn chỉnh, sẵn sàng đóng gói thành giải pháp thương mại (SaaS) độc lập để bán cho các xưởng quảng cáo khác.

---

## 👥 2. PHÂN QUYỀN BỘ MÁY (ROLES)

> **Cập nhật MVP 2026-07-01:** QC-OMS vẫn giữ nền tảng permission-based access control để an toàn kỹ thuật và mở rộng sau này. Tuy nhiên trong MVP xưởng nhỏ/nội bộ, nhân viên nội bộ mặc định nên có đủ quyền thao tác chính để tránh vận hành bị chia cắt quá sớm. Chỉ tách quyền mạnh cho quản lý user/quyền, cấu hình hệ thống, hủy/sửa chứng từ đã chốt nếu cần, và các thao tác tài chính nhạy cảm nếu Owner chốt sau.

### Bảng vai trò mặc định (Default Roles)

| Vai trò | Quyền hạn cốt lõi | Mô tả chi tiết |
|---------|---------------------|----------------|
| 👑 **Chủ xưởng** | Full Access | Toàn quyền hệ thống, cấu hình máy in, xem báo cáo tài chính tổng |
| 💰 **Nhân viên nội bộ / Thu ngân / Kế toán nội bộ** | Operational Access | Mặc định dùng được POS, khách hàng, bảng giá, kho cơ bản, thu tiền/công nợ và chứng từ trong phạm vi MVP |
| 🔧 **Thợ máy** | Execute / Internal Access | Vận hành máy in/CNC, theo dõi hàng đợi máy sản xuất; nếu dùng chung QC-OMS nội bộ có thể được cấp preset vận hành rộng như nhân viên nội bộ |

### ⚙️ Cơ chế mở rộng: Vai trò tùy chỉnh (Custom Roles)

Hệ thống hỗ trợ **Ma trận phân quyền động** (Dynamic Permissions Matrix) ở nền kỹ thuật, nhưng MVP không tối ưu theo kiểu SaaS enterprise với quá nhiều role/permission nhỏ.

Nguyên tắc MVP:

- Permission nhỏ vẫn có thể tồn tại trong DB/API để bảo vệ backend.
- Tài khoản nội bộ mặc định dùng preset đủ quyền thao tác chính.
- UI không nên ẩn/chặn quá nhiều thao tác thường ngày chỉ vì thiếu một quyền nhỏ.
- Quyền quản lý user/quyền, cấu hình hệ thống và hủy/sửa chứng từ đã chốt nếu cần phải tách riêng.
- Quyền tài chính nhạy cảm có thể tách riêng nếu Owner chốt, nhưng chưa làm phức tạp ở MVP.

**Use case:** Tài khoản tùy biến phục vụ riêng cho nhân sự đặc thù như Kế toán thuê ngoài, Cộng tác viên thiết kế, hoặc Thợ học việc.

#### Ví dụ cấu hình: Kế toán thuê ngoài

| Phân hệ | ✅ Xem / Khóa | Chi tiết |
|----------|---------------|----------|
| Báo cáo doanh thu | ✅ Xem | Truy cập báo cáo, sổ quỹ hóa đơn, danh sách công nợ KH |
| POS tạo đơn | ❌ Khóa | Không được tạo, sửa, xóa đơn hàng |
| Kho vật tư | ❌ Khóa | Không được xem thông tin kho |
| Lệnh in ấn | ❌ Khóa | Không được can thiệp lệnh in dưới xưởng |
| Cấu hình hệ thống | ❌ Khóa | Không được thay đổi cài đặt |
| Audit log tài khoản khác | ❌ Khóa | Không được xem lịch sử thao tác của user khác |

---

## 📊 3. 5 MỤC TIÊU CHIẾN LƯỢC (KPI CORES)

| Mục tiêu (Goal) | Giải pháp thực hiện | Chỉ số đo lường (KPI) |
|-----------------|---------------------|----------------------|
| 🛡️ **Chống thất thoát** | Máy in tự đẩy diện tích thực tế về để Thu ngân đối chiếu | 0% sai lệch số liệu mét vuông ($m^2$) |
| ⚡ **Tốc độ vận hành** | Cơ chế "Tất cả trong một", tự gộp đơn, nạp Clipboard gửi Zalo | Thao tác chốt đơn dưới 3 giây |
| 📊 **Tài chính sạch** | Đơn hủy (báo giá xịt) được bóc tách riêng hoàn toàn | 100% dòng tiền sổ quỹ là tiền thật |
| 📦 **Kho tự động** | Đơn chuyển trạng thái sản xuất tự động trừ kho vật tư | Không bị động thiếu hụt vật tư |
| 🔗 **Đồng bộ Realtime** | Toàn bộ các bộ phận chạy chung trên một nền tảng Cloud | 100% dữ liệu nhất quán qua Supabase |

---

## ⚙️ 4. TRIẾT LÝ THIẾT KẾ CỐT LÕI (PRODUCT PHILOSOPHY)

### Tùy biến động cao (High Customization)

Hệ thống **không fix cứng** luồng vận hành. Mọi thông số đều được thiết kế dưới dạng **"Cấu hình mở"** (Dynamic Configuration):

- Định mức giá theo từng nhóm khách VIP (VD: PNJ)
- Định mức vật tư tiêu hao theo từng máy in/CNC
- Ma trận phân quyền nhân sự tùy chỉnh ở nền kỹ thuật; MVP vận hành bằng preset nội bộ đơn giản
- Ngưỡng cảnh báo hao hụt vật tư

### Thực chiến và Linh hoạt (Practicality)

Phần mềm phải **thích ứng** với các tình huống phát sinh thực tế tại xưởng.

> **Ví dụ:** Kho hết trên phần mềm nhưng thực tế vẫn còn bạt lẻ → Hệ thống **chỉ cảnh báo**, không khóa cứng lệnh in. Tránh làm đình trệ tiến độ sản xuất của thợ dưới xưởng.

---

> **Lưu ý:**
> - Mục 4 định hình Triết lý thiết kế → Các Phần 2-6 sẽ chi tiết hóa cụ thể từng mục tùy biến.
> - Phần 2: Tính năng & UX (kịch bản UX tùy biến)
> - Phần 3: Database Schema (cấu hình động, settings table)
> - Phần 4: Backend Logic (ngưỡng cảnh báo, hao hụt)

---

*Phần 1 - Đã chốt ✅*
