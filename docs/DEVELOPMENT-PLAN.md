# KẾ HOẠCH PHÁT TRIỂN QC-OMS — FE + BE THEO TỪNG GIAI ĐOẠN

> **Vai trò:** Roadmap logic dài hạn; trạng thái sống và queue hiện tại nằm ở [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).
> **Ngày lập:** 2026-06-28
> **Cập nhật:** 2026-07-05 theo checklist sống hiện tại
> **Mục tiêu:** Sau mỗi giai đoạn phải có một luồng người dùng hoàn chỉnh, chạy bằng Frontend và Backend thật trên môi trường staging.

---

## 1. PHẠM VI VÀ NGUYÊN TẮC

Tài liệu này là roadmap điều phối phát triển liên tầng. Nó không thay thế Source of Truth của từng tầng:

- Hành vi giao diện: `02-PRD-UX-PhongCanh/`.
- Quy tắc nghiệp vụ: `03-BUSINESS-NghiepVu/`.
- Schema dữ liệu: `04-DATABASE/`.
- API và workflow thực thi: `05-BACKEND-MayChu/`.
- Hệ thống bên ngoài: `06-INTEGRATION-KetHop/`.
- Hạ tầng và vận hành: `07-DEPLOYMENT-TrienKhai/`.

Nguyên tắc triển khai:

1. Phát triển theo **vertical slice**: FE, BE, Database và kiểm thử được làm trong cùng giai đoạn.
2. Không nghiệm thu màn hình chỉ dùng mock data hoặc API giả.
3. Backend là nguồn validation và tính toán cuối cùng cho dữ liệu nghiệp vụ.
4. Mỗi giai đoạn phải deploy được lên staging và có kịch bản demo hoàn chỉnh.
5. Business Rule chưa rõ phải được Owner chốt trước khi triển khai.
6. Chức năng chưa hoàn thiện phải được ẩn bằng feature flag hoặc permission kỹ thuật, không để trạng thái nửa hoạt động; riêng nghiệp vụ MVP đã mở thì preset nhân viên nội bộ phải đủ quyền thao tác chính, không chia cắt luồng hằng ngày bằng quá nhiều permission nhỏ.
7. Không mở scope ngoài [MVP-SCOPE](./01-VISION-TamNhin/03-MVP-SCOPE.md) nếu Owner chưa chốt lại.
8. Có thể làm sớm foundation của giai đoạn sau nếu cần để hoàn tất luồng POS bán đứt, miễn là không mở thêm nghiệp vụ ngoài MVP.

Giả định thời gian trong kế hoạch dành cho nhóm 2–3 developer. Nếu chỉ có một người phát triển, thời gian có thể tăng khoảng 1,5–2 lần.

---

## 2. KIẾN TRÚC TRIỂN KHAI ĐỀ XUẤT

```text
React + TypeScript + Vite
        ↓
Application Service / API Client
        ↓
Supabase Edge Functions hoặc API /api/v1
        ↓
PostgreSQL + Auth + Realtime + RLS
```

- Frontend triển khai trên Vercel.
- Supabase quản lý Authentication, PostgreSQL và Realtime.
- FE không trực tiếp thực hiện các workflow quan trọng như checkout, trừ kho hoặc phân bổ công nợ.
- Mọi workflow ghi nhiều bảng phải chạy trong transaction phù hợp.
- Các thao tác có thể gửi lại phải có idempotency key hoặc cơ chế chống trùng tương đương.
- Mỗi giai đoạn có migration, seed data và cấu hình staging tương ứng.

---

## 3. TỔNG QUAN ROADMAP

### 3.1. Cách đọc roadmap sau khi chốt MVP ngày 2026-07-01

Roadmap Phase 0-8 bên dưới là **roadmap logic dài hạn theo nhóm năng lực**, không còn là thứ tự commit/branch cứng.

Từ Phase 1 trở đi, dự án đang thực thi theo các lát cắt nhỏ hơn:

```text
1A -> 1B -> 1C -> 2A -> 2B -> 2C -> 2D -> ...
```

Mỗi lát cắt vẫn theo nguyên tắc vertical slice: có UI/API/DB/test đủ để chạy một phần nghiệp vụ thật. Vì vậy một số foundation của Phase 4 hoặc Phase 6 trong roadmap logic đã được làm sớm để phục vụ POS bán đứt:

- checkout transaction
- inventory/finance foundation
- production queue foundation
- Sales Documents readonly

Điều này không có nghĩa dự án bị "nhảy phase". Đây là điều chỉnh đúng theo MVP scope hiện tại:

```text
POS bán đứt -> hóa đơn -> trừ kho -> thu tiền/công nợ -> sổ quỹ -> đối soát -> báo cáo quản trị
```

Không mở scope ngoài MVP như Đặt hàng KiotViet, vận đơn/COD, kênh online, VAT/HĐĐT, HR/payroll hoặc campaign retail.

### 3.2. Trạng thái main hiện tại

Nguồn theo dõi chi tiết: [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).

| Lát cắt thực thi | Trạng thái | Ghi chú |
|---|---|---|
| Phase 1A | Đã merge | Foundation UI + catalog/pricing |
| Phase 1B | Đã merge | Customer selection và customer pricing |
| Phase 1C | Đã merge | Checkout transaction, inventory/finance foundation |
| Phase 2A | Đã merge | POS direct checkout UI |
| Phase 2B | Đã merge | Production queue/K02-D foundation |
| Phase 2C | Đã merge | POS line discount handling UI/backend persistence |
| Phase 2D | Đã merge | Sales Documents readonly list/detail |
| Phase 3A | Đã merge | Báo giá `BG...` và mở lại vào POS draft |
| Quote print Phase 3B | Đã merge | In/xem báo giá đơn giản |
| PriceBook formula MVP | Đã merge | Structured formula, preview/apply, rounding |
| Purchase P1/P2/P3/P5 | Đã merge | NCC, phiếu nhập hàng thường, post receipt, thanh toán NCC |

### 3.3. Mapping giữa roadmap logic và lát cắt đã làm

| Roadmap logic | Nội dung roadmap gốc | Trạng thái/lát cắt thực tế |
|---|---|---|
| Phase 0 | Đăng nhập, phân quyền, POS Shell | Đã merge |
| Phase 1 | Hàng hóa, khách hàng, bảng giá | Đã có foundation 1A/1B và PriceBook formula MVP |
| Phase 2 | Giỏ hàng và hóa đơn nháp | Đã có POS direct checkout UI; nháp production queue ở 2B |
| Phase 3 | Báo giá và Bill Preview | Báo giá, mở lại báo giá, Sales Documents readonly và quote print đơn giản đã merge |
| Phase 4 | Thanh toán, kho cơ bản và công nợ | Checkout transaction, inventory/finance foundation đã làm sớm ở 1C/2A |
| Phase 5 | Combo/BOM và quản lý vật tư | Purchase hàng thường đã merge; cuộn/tấm vật lý và BOM sâu còn phase riêng |
| Phase 6 | Hàng đợi máy sản xuất realtime | Production queue foundation đã làm sớm ở 2B; ingestion/realtime đầy đủ còn phase sau |
| Phase 7 | Bill nâng cao và hỗ trợ gửi khách | Quote print đơn giản đã có; gửi tự động/nhiều mẫu còn sau |
| Phase 8 | Production và vận hành | Supabase Cloud/dev-staging đã có; production hardening còn sau |

### 3.4. Roadmap logic dài hạn

| Giai đoạn | Kết quả sử dụng được | Thời gian dự kiến |
|---|---|---|
| 0 | Đăng nhập, phân quyền và POS Shell | 1–2 tuần |
| 1 | Tìm hàng, khách hàng và bảng giá | 2 tuần |
| 2 | Giỏ hàng và hóa đơn nháp | 2–3 tuần |
| 3 | Báo giá và Bill Preview cơ bản | 1–2 tuần |
| 4 | Thanh toán, kho cơ bản và công nợ | 3 tuần |
| 5 | Combo/BOM và quản lý vật tư | 2–3 tuần |
| 6 | Hàng đợi máy sản xuất Realtime | 2–3 tuần |
| 7 | Bill nâng cao và hỗ trợ gửi khách | 2 tuần |
| 8 | Production, giám sát và khôi phục | 2 tuần |

Mốc phát hành logic ban đầu:

- **MVP nội bộ:** Giai đoạn 0–4, khoảng 9–12 tuần.
- **Pilot tại xưởng:** Giai đoạn 5–7, thêm khoảng 6–8 tuần.
- **Production ổn định:** Giai đoạn 8, tổng khoảng 17–22 tuần.
- **SaaS đa xưởng:** Chỉ bắt đầu sau khi bản nội bộ vận hành ổn định.

---

## 4. CHI TIẾT TỪNG GIAI ĐOẠN

### Giai đoạn 0 — Nền tảng và đăng nhập

**Tính năng bàn giao:** Người dùng đăng nhập, vào màn hình POS theo preset quyền MVP và đăng xuất an toàn.

**Frontend**

- Khởi tạo React, TypeScript, Vite và Tailwind CSS.
- Trang đăng nhập, POS Shell và routing.
- Route guard và trang `Không có quyền truy cập` cho tài khoản hạn chế đặc biệt hoặc truy cập nhầm vùng quản trị.
- Hiển thị tài khoản, mã máy trạm và trạng thái kết nối.

**Backend và Database**

- Supabase Auth.
- Hồ sơ người dùng, permissions và máy trạm.
- API lấy hồ sơ người dùng hiện tại.
- RLS và kiểm tra permission phía Backend.
- Audit đăng nhập và thay đổi quyền.

**Điều kiện nghiệm thu**

- Đăng nhập thành công và thất bại đúng hành vi.
- Tài khoản nội bộ mặc định truy cập được POS; tài khoản hạn chế đặc biệt thiếu quyền thì không truy cập được POS.
- Refresh không làm mất phiên hợp lệ.
- Có staging URL và pipeline build/test/deploy.

### Giai đoạn 1 — Hàng hóa, khách hàng và bảng giá

**Tính năng bàn giao:** Thu ngân tìm sản phẩm bằng `F3`, tạo/chọn khách bằng `F4` và nhận đúng giá bán.

**Frontend**

- Tìm sản phẩm không dấu và lưới sản phẩm K03-C.
- Tìm, thêm và sửa khách hàng K03-A.
- Chọn bảng giá và hiển thị chiết khấu.
- Nhắc bổ sung SĐT K03-B.
- Back-office tối thiểu để quản lý sản phẩm và bảng giá.

**Backend và Database**

- Schema sản phẩm, khách hàng, bảng giá và chi tiết bảng giá.
- API tìm kiếm sản phẩm và khách hàng.
- API CRUD khách hàng.
- API xác định giá theo khách hàng.
- Chuẩn hóa và kiểm tra trùng SĐT, mã khách hàng.

**Điều kiện nghiệm thu**

- Tạo khách mới và tự động chọn vào hóa đơn hiện tại.
- Đổi khách làm cập nhật các dòng dùng giá tự động.
- Dòng đã sửa giá thủ công được giữ nguyên.
- Không tạo trùng SĐT hoặc mã khách hàng.

### Giai đoạn 2 — Giỏ hàng và hóa đơn nháp

**Tính năng bàn giao:** Thu ngân tạo nhiều hóa đơn nháp, thêm sản phẩm và tính tiền chính xác.

**Frontend**

- K01 đa tab, tối đa 10 tab.
- Dòng hàng thường và dòng hàng m².
- Ghi chú dòng hàng và ghi chú đơn.
- Tổng m² và tổng tiền cập nhật realtime.
- Khôi phục tab sau reload hoặc khởi động lại máy.
- Cảnh báo khi đóng tab có dữ liệu.

**Backend**

- Endpoint tính và validation giỏ hàng.
- Phân loại sản phẩm theo đơn vị tính.
- Tính hàng thường và hàng m² theo Business Rule hiện hành.
- Kiểm tra giá, kích thước và permission kỹ thuật; preset nội bộ MVP mặc định có quyền giảm giá/sửa giá thủ công nếu Owner chưa chốt kiểm soát riêng.

**Điều kiện nghiệm thu**

- FE và BE cho cùng kết quả tính tiền.
- Hàng thường chọn lại được cộng số lượng.
- Hàng m² luôn tạo dòng riêng.
- Dữ liệu giữa các tab độc lập.
- Reload không làm mất hóa đơn nháp.

### Giai đoạn 3 — Báo giá và Bill Preview

**Tính năng bàn giao:** Thu ngân lưu báo giá, mở lại để sửa và xem/in bill báo giá.

**Frontend**

- Nút `BÁO GIÁ`.
- Danh sách và tìm kiếm báo giá.
- Mở lại báo giá thành hóa đơn nháp.
- Bill Preview và in bill cơ bản.

**Backend và Database**

- Schema đơn hàng, dòng hàng và lịch sử trạng thái.
- Sinh mã `BG...`.
- API tạo, đọc và cập nhật báo giá.
- Lưu snapshot giá và thông tin hàng tại thời điểm báo giá.
- Không phát sinh kho, tiền, công nợ hoặc doanh thu.

**Điều kiện nghiệm thu**

- Báo giá được lưu và mở lại chính xác.
- Có thể sửa rồi lưu lại.
- Không xuất hiện stock movement hoặc cash transaction.

### Giai đoạn 4 — Thanh toán, kho cơ bản và công nợ

**Tính năng bàn giao:** Thu ngân thanh toán bằng tiền mặt, chuyển khoản hoặc kết hợp; kho, sổ quỹ và công nợ được cập nhật đồng thời.

**Frontend**

- Dialog thanh toán K03-D.
- Trả đủ, nợ toàn bộ và trả một phần.
- Khách lẻ nợ với ghi chú bắt buộc.
- Thanh toán nợ cũ.
- Xem lịch sử hóa đơn và công nợ.

**Backend và Database**

- Schema payment, sổ quỹ, công nợ và phân bổ trả nợ.
- Kho cơ bản, số dư tồn và lịch sử biến động kho.
- Transaction checkout nguyên tử.
- Idempotency chống thanh toán hai lần.
- Cấn trừ nợ vào hóa đơn cũ nhất trước.
- Sinh mã `HD...` và giữ liên kết với báo giá nguồn.

**Điều kiện nghiệm thu**

- Một lần xác nhận chỉ tạo một hóa đơn.
- Lỗi giữa chừng rollback toàn bộ transaction.
- Tiền thực thu khớp sổ quỹ.
- Công nợ khớp từng hóa đơn.
- Kho được trừ đúng.
- Báo giá chuyển thành hóa đơn và vẫn truy vết được.

> Hoàn thành giai đoạn này đạt mốc **MVP nội bộ**.

### Giai đoạn 5 — Combo/BOM và quản lý vật tư

**Tính năng bàn giao:** Thu ngân bán Combo, chỉnh BOM và hệ thống trừ đúng từng vật tư thành phần.

**Frontend**

- Dòng Combo/BOM và chỉnh BOM cấp 1.
- Combo cấp 2 hiển thị dạng khóa.
- Tổng chi phí vật tư.
- Popup khui vật tư tự do.
- Cảnh báo khui cuộn hoặc tấm.

**Backend và Database**

- Schema BOM và thành phần BOM.
- Deep-scan BOM khi checkout.
- Quy đổi m² sang mét dài hoặc tấm.
- Quản lý lô, phiên vật tư dở và hao hụt.
- Nhật ký người khui, vật tư, lý do và thời điểm.

**Điều kiện nghiệm thu**

- Combo checkout thành công và trừ đủ vật tư con.
- Không cho tạo vòng lặp BOM.
- Thiếu tồn xử lý đúng chính sách cảnh báo.
- Mọi thao tác khui đều truy vết được.

### Giai đoạn 6 — Hàng đợi máy sản xuất Realtime

**Tính năng bàn giao:** Máy sản xuất hoặc trình mô phỏng gửi file; POS nhận realtime và đưa file vào đúng hóa đơn nháp.

**Frontend**

- Các block máy sản xuất và badge realtime.
- Danh sách chờ và lịch sử.
- Thêm, hủy và khôi phục thông báo.
- Sửa kích thước sai.
- Phản hồi xung đột khi nhiều POS cùng xử lý.

**Backend, Database và Integration**

- Schema máy sản xuất, sự kiện và lịch sử hàng đợi.
- Endpoint nhận thông báo từ máy.
- Parser tên file theo đặc tả K02-D.
- Atomic claim chống xử lý trùng.
- Realtime broadcast và lưu lịch sử 10 ngày.

**Điều kiện nghiệm thu**

- Sự kiện từ máy xuất hiện trên mọi POS.
- Hai POS không xử lý được cùng một thông báo.
- Parse đúng khách, hàng, kích thước và số lượng.
- Thông báo khôi phục trở lại toàn bộ POS.

### Giai đoạn 7 — Bill nâng cao và hỗ trợ gửi khách

**Tính năng bàn giao:** Người dùng quản lý nhiều mẫu bill, in và chuẩn bị ảnh bill để gửi qua kênh khách đã cấu hình.

**Frontend**

- Quản lý tab bill và máy in.
- Nhớ cấu hình theo khách hàng.
- Sinh và xem trước ảnh bill.
- Copy ảnh vào Clipboard.
- Mở nơi gửi đã cấu hình.

**Backend và Database**

- Schema mẫu bill và cấu hình bill theo khách.
- API lấy và lưu cấu hình bill.
- Thống kê mẫu bill được sử dụng.
- Backend rendering dự phòng nếu Frontend không đảm bảo layout.

**Điều kiện nghiệm thu**

- In được một hoặc nhiều bill.
- Cấu hình được nhớ theo khách.
- Không tự gửi khi nhân viên chưa xác nhận.
- Lỗi mở ứng dụng không làm mất bill.

### Giai đoạn 8 — Production và vận hành

**Tính năng bàn giao:** Hệ thống đủ an toàn để chạy thật tại xưởng và có thể khôi phục khi gặp sự cố.

- Hoàn thiện RLS và permission.
- Audit log cho các thao tác quan trọng.
- Backup tự động và diễn tập restore.
- Monitoring, tracing và cảnh báo lỗi.
- Kiểm thử E2E toàn bộ luồng bán hàng.
- Kiểm thử đồng thời nhiều POS.
- Kiểm thử hiệu năng tìm kiếm và checkout.
- Quy trình rollback.
- Hướng dẫn vận hành cho thu ngân và quản trị viên.

**Điều kiện nghiệm thu**

- Có dashboard sức khỏe hệ thống và cảnh báo hoạt động.
- Backup được tạo tự động và restore thử thành công.
- Có thể rollback một phiên bản lỗi.
- Các luồng E2E trọng yếu chạy ổn định trên production-like environment.

---

## 5. DEFINITION OF DONE CHUNG

Một giai đoạn chỉ hoàn thành khi đáp ứng toàn bộ điều kiện sau:

- FE sử dụng Backend thật, không dùng mock để nghiệm thu.
- Có migration và seed data tái lập được môi trường.
- Backend kiểm tra authentication, permission và validation.
- Có unit test cho Business Rule được triển khai.
- Có integration test cho API và Database.
- Có ít nhất một luồng E2E chạy trên trình duyệt.
- Deploy thành công lên staging.
- Log và lỗi đủ để truy vết sự cố.
- Owner chạy thử và chấp nhận kết quả.
- Tài liệu liên quan ở các tầng 02–07 được cập nhật.

---

## 6. RỦI RO VÀ ĐIỀU KIỆN PHẢI CHỐT

Các nội dung sau phải được giải quyết trước hoặc trong giai đoạn tương ứng:

| Nội dung | Quyết định / thời điểm xem lại |
|---|---|
| Cách tổ chức Backend | ✅ Chốt: Supabase Edge Functions + REST `/api/v1`; FE chỉ dùng SDK trực tiếp cho Auth/Realtime |
| Schema bảng giá | ✅ Đã có PriceBook formula MVP; mở rộng nhóm hàng/filter cần slice riêng |
| Cơ chế lưu nháp | ✅ Chốt hiện tại: LocalStorage theo máy tại `POS/ARCHITECTURE.md`; server draft chỉ mở khi có SoT mới |
| ERD Sales, Inventory và Finance | ✅ Đã có foundation; mỗi slice mới phải rà lại schema liên quan |
| Chính sách tồn âm và cảnh báo thiếu kho | ✅ MVP cho bán thiếu/tồn âm có cảnh báo nhẹ; quy chuẩn cuộn/tấm làm dần |
| Hợp đồng dữ liệu thực tế với máy in/CNC | Production queue foundation đã có; ingestion/match tự động là phạm vi mở rộng cần spec riêng |
| Khả năng mở Zalo/Facebook theo môi trường máy POS | Ngoài MVP hiện tại; chỉ xem lại khi Owner chốt gửi khách tự động |
| RPO, RTO và chính sách lưu backup | Xem lại trước production thật |

---

## 7. THỨ TỰ THỰC HIỆN

```text
Nền tảng
   ↓
Danh mục + Khách hàng
   ↓
Giỏ hàng + Nháp
   ↓
Báo giá
   ↓
Thanh toán + Kho + Công nợ        ← MVP nội bộ
   ↓
BOM + Vật tư
   ↓
Máy trạm Realtime
   ↓
Bill nâng cao
   ↓
Production
```

Không bắt đầu giai đoạn kế tiếp nếu tiêu chí nghiệm thu cốt lõi của giai đoạn hiện tại chưa đạt, trừ khi phần công việc chạy song song không phụ thuộc và không làm thay đổi Source of Truth đang chờ chốt.
