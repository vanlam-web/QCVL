# UI Shell v1 — Quy tắc giao diện nền QC-OMS

> **Vai trò:** Source of Truth cho UI Shell v1.
> **Mục tiêu:** Làm giao diện nhanh nhưng không lệch quỹ đạo; sau này đổi theme/layout không ảnh hưởng nghiệp vụ.
> **Tham khảo:** KiotViet cho logic vận hành; Material Design, IBM Carbon, Shopify Polaris cho design token/component discipline; WCAG 2.2 cho accessibility.

---

## 1. Mục tiêu thiết kế

QC-OMS không copy giao diện KiotViet. QC-OMS bám logic vận hành quen thuộc của KiotViet nhưng dùng giao diện hiện đại, gọn, rõ và thích nghi thiết bị.

Mục tiêu UI Shell v1:

- kiểm tra nghiệp vụ nhanh bằng giao diện thật
- dùng tốt trên desktop, tablet và điện thoại
- có light/dark mode ngay từ đầu
- màu sắc, spacing, radius, shadow, typography đi qua design tokens
- không nhét business logic vào UI
- mỗi màn nghiệp vụ có cùng ngôn ngữ: danh sách, filter, detail panel, form, action, trạng thái
- CSS phải tách `vỏ` và `ruột`: vỏ dùng chung cho modal, table, filter, tab, button, form field, KPI compact, detail panel; ruột từng trang chỉ render nội dung và giữ layout thật sự riêng.

Không làm trong UI Shell v1:

- thiết kế marketing/landing page
- animation phức tạp
- custom theme theo từng module
- rải lại CSS gần giống nhau theo từng trang khi đã có class/rule dùng chung
- đổi backend/API chỉ để phục vụ trang trí
- tối ưu mobile sâu như native app

---

## 2. Nguyên tắc kiến trúc UI

UI chỉ là lớp thao tác và hiển thị.

```text
Database / RPC
  -> API / Use-case
  -> Service client
  -> Page / Component UI
```

UI không tự quyết định:

- post phiếu nhập
- tăng/trừ tồn
- tạo cuộn/tấm vật lý
- tính công nợ thật
- thanh toán NCC
- ghi sổ quỹ

UI chỉ gọi service/API đã có contract. Nếu sau này đổi từ desktop layout sang tablet/mobile layout, nghiệp vụ không đổi.

---

## 3. Adaptive layout

### Desktop / laptop

Mục tiêu: quản lý nhiều dữ liệu và thao tác sâu.

- không dùng sidebar trái rộng làm mặc định vì các màn quản lý cần chiều ngang
- top navigation là module bar ngang: brand/logo nhỏ bên trái link về `/dashboard`, module ở giữa, cụm thao tác nhanh bên phải
- không hiển thị mục chữ `Tổng quan` trong module bar; dashboard đi qua brand/logo để tiết kiệm chiều ngang
- module bar chính chỉ chứa các khu vực vận hành thường dùng như `Chứng từ`, `Khách hàng`, `Hàng hóa`, `Bảng giá`, `Nhà cung cấp`, `Nhập hàng`; route nội bộ vẫn là `/sales-documents`
- `Quản trị` không đứng trong module bar chính; đưa vào menu xổ xuống của icon tài khoản để giảm nhiễu cho vận hành hằng ngày. Route `/admin` và quyền `perm.access_admin_panel` giữ nguyên.
- không có top-level tab `Kho`: tồn kho, kiểm kho, tồn cuộn/tấm và biến động tồn nằm trong module `Hàng hóa` như nhóm nghiệp vụ KiotViet. Route/màn kiểm kho nội bộ có thể giữ để chưa mất luồng, nhưng không xuất hiện thành mục topbar riêng.
- POS là thao tác bán hàng nhanh nên đứng ở cụm thao tác nhanh bên phải, không chen vào module bar quản lý; quy tắc này supersede quy tắc PR #52 sau feedback preview của Owner trong PR #53
- Dashboard không có nav con `Tổng quan / Hàng hóa / Mua hàng...`; các module đi qua top navigation chung. Trạng thái chọn/chưa chọn của module bar, inline tab chi tiết và tab biểu đồ phải đi qua cùng một rule CSS chung. Item thường dùng `background: transparent`, `color-text`, `font-size: 0.875rem`, `font-weight: 600`; item đang chọn dùng `surface`, `primary`, `font-weight: 800` và line primary dưới chân. CSS theo trang chỉ được giữ layout như padding, gap, border-radius; không định nghĩa riêng màu, font-weight, nền hoặc active underline cho tab.
- thông báo, cài đặt, theme toggle và tài khoản/đăng xuất dùng control compact/icon trên topbar chung, không đặt riêng trong Dashboard body và không hiển thị block mô tả lớn kiểu `Xưởng Văn Lâm / Cloud Admin`
- menu xổ xuống từ tài khoản dùng item dạng text/icon không viền quanh từng dòng; chỉ popover có khung ngoài, item trong menu có cùng bo góc, cùng chiều cao/padding và hover nền nhẹ.
- dòng đầu trong menu tài khoản là identity row dạng link mở `/account`: avatar/icon + tên hiển thị tài khoản (ưu tiên `display_name`, fallback email), không có chevron/dấu `>` ở cuối. Popover co theo nội dung, không đặt min-width cứng lớn; tên dài phải cắt `...` trong popover, không làm vỡ topbar/menu. MVP không hiển thị dòng cảnh báo `xác minh 2 lớp`/`xác thực 2 lớp`; khi làm bảo mật sau sẽ thêm entry riêng theo flow xác thực.
- trang `/account` dùng AppShell hiện tại, không copy topbar/nav màu cam của KiotViet. Nội dung chính giới hạn rộng khoảng `56rem`, gồm 3 card trên shared `management-list-surface`: `Thông tin người dùng`, `Đăng nhập và bảo mật`, `Các thiết bị đã đăng nhập`. Chỉ hiển thị dữ liệu thật từ `/api/v1/me`: `user.display_name`, email đăng nhập, quyền, `profile` mở rộng (`username`, `phone`, `email`, `birthday`, `region`, `ward`, `address`, `note`) và `devices`. Field trống hiện `Chưa có`, không lấy user id/tổ chức/workstation thế chỗ. 2FA chưa có API thì hiện `Chưa có dữ liệu`.
- layout `/account`: khoảng cách giữa card dùng `--space-6` (`1.5rem`/24px), padding trong card dùng `--space-6`, card radius `--radius-md` (8px), border mảnh `color-border-muted` + shadow nhẹ. Grid thông tin người dùng chia 3 cột đều; mỗi giá trị `dd` có underline `1px color-border-muted`. Các hàng bảo mật/thiết bị dùng divider `1px color-border-muted` và padding dọc `--space-4`. Nút phụ trong card dùng nền surface, viền token chung, radius 4px và padding `--space-2 --space-3`.
- vì `/account` card dùng thêm class `management-list-surface`, phải có selector cụ thể `.management-list-surface.account-card` giữ padding `--space-6`; không để padding mặc định của list surface (`--space-1`) làm nội dung sát mép.
- popup sửa thông tin `/account` phải dùng vỏ modal chung: `management-modal-backdrop` nền đen 50%, `management-modal-dialog`, `management-modal-header`, `management-modal-form`, `management-modal-footer`. Dialog riêng `account-edit-dialog` rộng `min(53rem, calc(100vw - var(--space-4)))`, padding `--space-6`, radius `--radius-lg` (12px). Form riêng chỉ định layout 3 cột đều, gap `--space-4` (16px), field `Ghi chú` span full width và textarea cao khoảng `5.5rem`. Popup lưu bằng `PATCH /api/v1/me/profile`; chuỗi rỗng gửi `null`; khi API lỗi phải giữ popup mở và hiện lỗi `Không lưu được...` trong footer. `Vai trò` vẫn readonly vì quyền nằm trong `user_permissions`, không lưu qua popup tài khoản.
- hướng tài khoản thật đã chốt nhưng tạm hoãn: sau này cần flow quản lý tài khoản nhân viên, đổi mật khẩu thật, reset mật khẩu, khóa/mở tài khoản và đăng nhập bằng `username`/số điện thoại thay vì cơ chế dev `admin -> admin@qc.local`. Trước khi làm các flow này, ưu tiên kế tiếp trên `/account` là khối `Các thiết bị đã đăng nhập`.
- khối `Các thiết bị đã đăng nhập` dùng dữ liệu thật từ `/me.devices`. UI giữ trong card account hiện tại, mỗi thiết bị là một dòng có icon loại thiết bị, tên thiết bị ưu tiên dạng `Chrome trên macOS`, badge `Đang dùng` nếu là thiết bị hiện tại, trình duyệt/hệ điều hành/IP và thời gian hoạt động gần nhất. Frontend gửi `x-client-device-id` lưu riêng trong từng browser để Chrome ngoài không bị gộp với browser Codex khi cùng IP/UA. Nút thiết bị hiện tại disabled với text `Thiết bị này`; thiết bị khác có nút `Đăng xuất` gọi backend thu hồi tất cả session khác của cùng user bằng Supabase `signOut(..., "others")`, đồng thời đổi trạng thái các thiết bị khác sang `signed_out` và ẩn khỏi danh sách. Supabase chưa hỗ trợ chắc chắn việc chọn đúng một session remote theo một dòng thiết bị; nếu cần chi tiết từng session sau này phải thiết kế thêm session binding riêng.
- trang `/admin` dùng layout thiết lập quen thuộc kiểu KiotViet: header `Thiết lập`, sidebar trái là menu nhóm (`Tiện ích`, `Cửa hàng`, `Dữ liệu`, `Thiết bị`) có ô `Tìm kiếm thiết lập`, mục `Quản lý người dùng` active trong nhóm `Cửa hàng`. Tab compact `Tài khoản người dùng` / `Quản lý vai trò` nằm trên cùng hàng header `Thiết lập`, không có header mô tả riêng phía trên. Tab tài khoản giữ thanh tìm/lọc trong workspace: ô `Tìm người dùng`, bộ lọc `Trạng thái`, nút `Lọc`; tạo tài khoản tích hợp vào nút `+` trong ô tìm (`aria-label="Tạo người dùng"`), không dùng nút chữ `Tạo tài khoản` rời. Modal tạo tài khoản gồm field chính (`Tên hiển thị`, `Điện thoại`, `Email`, `Tên đăng nhập`, `Mật khẩu`, `Nhập lại mật khẩu`, `Vai trò`) và 2 khối mở sẵn: `Thông tin khác` (`Sinh nhật`, `Địa chỉ`, `Khu vực`, `Phường/Xã`) + `Ghi chú`; các field mở rộng lưu thật vào profile nhân viên qua `POST /api/v1/users`. Bảng tài khoản dùng cột `Tên hiển thị`, `Tên đăng nhập`, `Điện thoại`, `Vai trò`, `Trạng thái`, `Thao tác`. Tab `Quản lý vai trò` trong MVP hiển thị danh sách vai trò suy ra từ permission (`Tên vai trò`, `Mô tả`, `Số tài khoản`, `Trạng thái`, `Thao tác`) và detail row quyền group theo module. Permission trong UI phải hiển thị nhãn nghiệp vụ tiếng Việt (`Thiết lập`, `Bán hàng`, `Quản lý người dùng`, `Tạo đơn bán hàng`...), không dùng mã `perm.*` hoặc mô tả tiếng Anh làm nội dung chính; mã kỹ thuật chỉ giữ ở tầng dữ liệu. Nút `Tạo vai trò` mở modal dùng vỏ modal chung: field `Tên vai trò`, `Mô tả`, danh sách permission group theo module, nav gợi ý bên phải và footer `Bỏ qua` / `Lưu`; bản hiện tại lưu tạm trong state UI, chưa ghi DB, chưa phải role schema thật.
- danh sách dạng table hoặc dense list
- filter bar luôn nhìn thấy với các trang quản lý cần lọc liên tục; riêng `/admin` đặt filter trong workspace của tab tài khoản, còn tab vai trò chỉ có toolbar thao tác
- detail panel/drawer bên phải
- action chính có chữ + icon
- bảng có nhiều cột nhưng phải scan được

### Tablet

Mục tiêu: thao tác nhanh tại xưởng/quầy.

- navigation rút thành icon + tooltip/label khi cần
- list/card lớn hơn desktop
- filter mở bằng drawer
- action ưu tiên icon + chữ ngắn
- vùng bấm đủ lớn

### Mobile

Mục tiêu: kiểm tra nhanh và thao tác tối giản.

- bottom navigation bằng icon
- search + filter icon ở đầu màn
- filter sheet từ dưới lên
- item dạng card
- action phụ dùng icon-only nhưng phải có `aria-label`
- chữ chỉ giữ ở tiêu đề, dữ liệu chính và trạng thái quan trọng

---

## 4. Design tokens

Không hardcode màu, spacing, radius, shadow, font trong từng màn. Component phải dùng token.

Nhóm token bắt buộc:

- `color.surface`
- `color.surfaceMuted`
- `color.text`
- `color.textMuted`
- `color.border`
- `color.primary`
- `color.info`
- `color.success`
- `color.warning`
- `color.danger`
- `color.neutral`
- `space.*`
- `radius.*`
- `shadow.*`
- `font.*`
- `zIndex.*`

Light/dark mode là hai bộ token khác nhau nhưng component dùng cùng tên token.

Sau này muốn đổi màu chủ đạo, chỉ sửa token như `color.primary`, không sửa từng button/chip/table. Màu chữ trên nền primary/danger dùng token `color.onPrimary` (`--color-on-primary` trong CSS), không dùng `white` rải rác trong từng nút.

### Shared CSS policy

- modal form dùng `management-modal-backdrop`, `management-modal-dialog`, `management-modal-header`, `management-modal-form`, `management-modal-footer`
- form field dùng rule chung cho label/input/select/textarea; page riêng chỉ giữ grid, section, fieldset hoặc nghiệp vụ đặc thù
- KPI/filter summary compact dùng cùng rule cho `.management-kpis .metric-card` và `.finance-cashbook-filter-summary .metric-card`
- tab/menu chọn/chưa chọn dùng chung rule đã nêu ở phần Desktop
- table/detail/action button dùng class `management-*` chung trước, chỉ thêm class riêng khi nội dung cần layout khác
- ngoại lệ hợp lệ: `quote-print-*` vì phục vụ bản in; POS invoice tab có cấu trúc tab hóa đơn kèm nút đóng nên chưa ép vào inline tab chung. Dashboard/chart cũng phải dùng token chung (`primary`, `success`, `warning`), không tạo bảng màu riêng.

---

## 5. Semantic color rules

Màu không đặt theo cảm tính. Màu đi theo ý nghĩa nghiệp vụ.

| Token | Dùng cho |
|---|---|
| `primary` | hành động chính, preset đang chọn |
| `info` | draft, đang xử lý, thông tin |
| `success` | đã nhập, hoàn tất, đã thanh toán |
| `warning` | còn nợ, cần chú ý, cảnh báo nhẹ |
| `danger` | lỗi nặng, hủy, hành động nguy hiểm |
| `neutral` | tất cả, đã trả, phụ, trạng thái không nổi bật |

Không dùng nhiều màu cho nút thao tác. Trạng thái có thể dùng chip màu riêng, nhưng button giữ theo role.

---

## 6. Button rules

Button intent chuẩn chỉ có 3 loại:

- `primary`: hành động chính như tạo phiếu, hoàn thành, lưu
- `secondary`: hành động phụ như mở, lọc, in, lưu draft
- `danger`: hủy/xóa hoặc hành động nguy hiểm

Nút chỉ icon không phải intent riêng. Icon-only phải dùng primitive chung (`management-icon-button` hoặc wrapper tương đương trong shared shell), bắt buộc có `aria-label`/tooltip, nền trong suốt, không tự định nghĩa màu/border theo từng trang. Khi icon-only là hành động nguy hiểm thì mới thêm intent `danger`; còn lại giữ secondary/neutral visual chung.

Không tạo biến thể `ghost` riêng. Các nút phụ, bỏ qua, in, sao chép, xuất file, chuyển trang, tài khoản/giao diện đều dùng shared secondary hoặc shared icon-only. Chỉ xóa, hủy chứng từ, thao tác phá dữ liệu hoặc cảnh báo nguy hiểm mới dùng `danger`.

`Sửa` là nhãn chuẩn cho hành động chỉnh sửa trong button. Nếu có chữ thì dùng `.button.button-secondary` qua `ManagementDetailActionFooter`/`ManagementRowActionButton`; nếu chỉ icon thì dùng `.management-icon-button` và aria-label dạng `Sửa ...`. Không tạo CSS riêng cho từng màn chỉ để đổi nền, viền, radius, font hoặc kích thước của nút sửa.

Hover của button chung phải nhìn thấy rõ trên cả light/dark: secondary và icon-only đổi nền theo `primary` nhẹ, đổi viền/box-shadow hoặc màu icon; không chỉ đổi sang `surface-muted` nếu mắt thường khó phân biệt.

Desktop:

- action quan trọng dùng icon + chữ
- action phụ có thể icon-only nếu quen thuộc

Tablet/mobile:

- ưu tiên icon hoặc icon + chữ ngắn
- icon-only bắt buộc có `aria-label`

Không dùng button màu theo trạng thái phiếu. Ví dụ phiếu draft không làm nút màu xanh dương; trạng thái draft nằm ở chip.

---

## 7. Filter system

Mỗi màn danh sách nên dùng chung cấu trúc:

- search chính
- preset nhanh theo nghiệp vụ
- chip filter đang áp dụng
- nút reset
- advanced filter drawer/sheet

Desktop:

- filter bar luôn nhìn thấy
- preset nằm ngay dưới search hoặc cùng hàng

Tablet:

- search luôn nhìn thấy
- nút filter mở drawer
- chip filter đang áp dụng nằm dưới search

Mobile:

- search + filter icon
- filter mở bottom sheet
- chip filter đang áp dụng nằm đầu danh sách

### Preset nhanh

Preset không thay thế filter nâng cao. Preset là đường tắt cho thao tác thường dùng.

Phiếu nhập:

- Draft cần xử lý
- Đã nhập hôm nay
- Còn nợ NCC
- Cuộn/tấm
- Tháng này
- Tất cả

Nhà cung cấp:

- Đang nợ
- Mua tháng này
- NCC mới
- Ngừng hoạt động
- Có liên kết khách hàng

Sổ quỹ:

- Hôm nay
- Tháng này
- Phiếu chi NCC
- Tiền mặt
- Ngân hàng
- Đã hủy

Hàng hóa:

- Đang bán
- Ngưng bán
- Hàng cuộn
- Hàng tấm
- Có giá nhập cuối
- Chưa có giá nhập

### Exact code search

Nếu người dùng nhập mã rõ như `PN000123`, `PCPN000001`, `HD010985`, hệ thống ưu tiên tìm chính xác và không để filter ngày/trạng thái làm mất kết quả.

---

## 8. Component contract

UI Shell v1 nên chuẩn hóa các component nền trước khi polish sâu:

- `AppShell`
- `SidebarNav`
- `TopBar`
- `ThemeToggle`
- `ResponsiveActionBar`
- `DataToolbar`
- `FilterPresetBar`
- `ActiveFilterChips`
- `DataTable`
- `EntityListCard`
- `DetailPanel`
- `FormDrawer`
- `ConfirmDialog`
- `StatusChip`
- `MoneyText`
- `EmptyState`
- `LoadingState`
- `ErrorState`

Component không chứa nghiệp vụ thật. Component nhận props và callback từ page/service.

---

## 9. Icon rules

Ưu tiên icon quen thuộc và nhất quán.

- Dùng icon thư viện nếu project có sẵn hoặc thêm có kiểm soát.
- Không tự vẽ icon rời rạc nếu có icon thư viện.
- Icon-only phải có `aria-label`.
- Icon lạ phải có tooltip.
- Action nguy hiểm không chỉ dùng icon; cần text hoặc confirm rõ.

Quy tắc theo thiết bị:

- desktop: icon + chữ cho việc chính
- tablet: icon + chữ ngắn hoặc icon-only có tooltip
- mobile: icon-only cho action phụ, chữ cho action chính nếu đủ chỗ

---

## 10. Density rules

QC-OMS là app vận hành, không phải landing page.

Desktop:

- dense nhưng rõ
- table/list ưu tiên scan nhanh
- không dùng card quá to
- không tạo hero section

Tablet/mobile:

- tăng khoảng bấm
- chuyển table thành card khi không đủ chiều ngang
- giữ dữ liệu chính: mã, đối tác, trạng thái, tiền, việc cần làm

---

## 11. Accessibility rules

Tối thiểu:

- focus visible rõ
- contrast đủ ở light/dark
- keyboard dùng được với form/filter/modal
- input có label thật
- icon-only có `aria-label`
- modal/drawer có title và close rõ
- lỗi form hiển thị cạnh vùng liên quan hoặc alert dễ thấy

Không để màu là cách duy nhất truyền đạt trạng thái. Ví dụ chip `Còn nợ` phải có chữ, không chỉ màu vàng.

---

## 12. UI review checklist

Mỗi PR UI phải tự kiểm:

- dùng design tokens, không hardcode màu lẻ
- light/dark mode không vỡ
- desktop/tablet/mobile không tràn chữ
- action chính/phụ đúng button role
- filter dùng preset/chip/drawer đúng chuẩn
- icon-only có `aria-label`
- trạng thái dùng semantic chip
- không đưa business logic vào component UI
- workflow chính thao tác được bằng browser
- không làm landing/hero cho màn nghiệp vụ

Với màn có nhiều dữ liệu, cần kiểm tra ít nhất:

- desktop khoảng 1280px
- tablet khoảng 768px
- mobile khoảng 390px

---

## 13. Slice triển khai đề xuất

Không làm toàn bộ app trong một PR lớn.

### UI-1: Tokens + shell nền

- token màu/spacing/radius/shadow
- light/dark toggle
- app shell responsive
- top module bar/bottom nav theo breakpoint, không dùng wide left sidebar mặc định
- button/chip/status component nền

### UI-2: Filter system

- `DataToolbar`
- preset nhanh
- active filter chips
- filter drawer/sheet responsive
- exact code search behavior giữ nguyên theo API hiện có

### UI-3: Purchase/Supplier UI validation

- phiếu nhập list/detail
- NCC list/payment
- roll/sheet P4 form nếu P4 đã merge
- browser smoke workflow cho Owner kiểm tra

### UI-4: Catalog/PriceBook polish

- hàng hóa
- bảng giá
- formula grid

---

## 14. Nguồn tham khảo

- KiotViet: logic vận hành Việt Nam, không copy giao diện cũ.
- Material Design: design tokens và component discipline.
- IBM Carbon: token hóa màu, layout, component system.
- Shopify Polaris: token và UI commerce/admin.
- WCAG 2.2: focus, contrast, accessibility.
