# UI Shell v1 - Quy chuẩn giao diện QCVL

> Source of Truth cho khung giao diện chung: AppShell, topbar, menu tài khoản, control tìm kiếm, button, modal, table, filter và token CSS.
> Cập nhật: 2026-07-08.

## 1. Mục tiêu

QCVL là phần mềm vận hành xưởng/quầy, không phải landing page. Giao diện cần gọn, dễ scan, thao tác nhanh và dùng chung được giữa các module.

Nguyên tắc:

- UI chỉ hiển thị và gọi API/service, không tự quyết định nghiệp vụ như trừ kho, ghi nợ, ghi sổ quỹ.
- Ưu tiên CSS dùng chung trước: `management-*`, `account-menu-*`, `button`, `status-chip`, modal/table/filter shared.
- CSS riêng theo trang chỉ giữ layout đặc thù. Không tạo lại màu, font, radius, shadow, active state khi đã có rule chung.
- Không dùng Supabase trong UI/API/runtime. QCVL dùng Node API + PostgreSQL.

## 2. AppShell desktop

Topbar chung gồm:

- Brand/logo bên trái, link về `/dashboard`.
- Module bar ngang cho nghiệp vụ back-office.
- Cụm thao tác nhanh bên phải: POS, theme/tiện ích nếu có, menu tài khoản.

Quy định:

- Không đặt `Quản trị` trong module bar chính. Đưa vào menu tài khoản nếu user có quyền.
- POS là thao tác bán nhanh, đặt ở cụm thao tác nhanh bên phải.
- Dashboard đi qua brand/logo, không cần tab `Tổng quan` riêng.
- Menu nổi phải có z-index cao hơn drawer/panel nghiệp vụ để không bị che.

## 3. Menu tài khoản dùng chung

Dashboard/AppShell và POS dùng cùng ngôn ngữ giao diện menu:

```text
Admin hoặc tên hiển thị
Báo cáo ca
Quản trị
Đăng xuất
```

Quy chuẩn CSS:

- Popover dùng `.account-menu-popover`.
- Dòng thông tin tài khoản dùng `.account-menu-profile`.
- Item trong menu không có viền riêng từng dòng; chỉ popover có khung ngoài.
- Hover dùng nền nhẹ theo token chung.
- Popover co theo nội dung, không đặt min-width cứng quá lớn.
- Tên dài dùng ellipsis, không làm vỡ topbar.

Hành vi:

- `Báo cáo ca` là mục đã có trong menu, hiện tại có thể là no-op cho tới khi module báo cáo ca hoàn chỉnh.
- `Quản trị` mở `/admin` và chỉ hiện khi có quyền `perm.access_admin_panel`.
- `Đăng xuất` thoát phiên hiện tại.
- Click ra ngoài hoặc `Esc` đóng menu.

## 4. Tìm kiếm compact dùng chung

Các ô tìm kiếm chính trong trang quản lý và POS ưu tiên dùng cùng style `.management-compact-search`.

Quy chuẩn:

- Icon tìm kiếm nằm đầu ô.
- Nút tạo nhanh hoặc hành động phụ có thể nằm cuối ô bằng icon `+`.
- Input không tự tạo border/shadow/radius riêng nếu dùng shared search.
- Ô `.management-compact-search` dùng chung được dịch ngang `3px` sang phải để cân thị giác với bảng/list bên dưới; không sửa lệch riêng từng trang.
- Placeholder ngắn, trực tiếp: ví dụ `Tìm hàng (F3)`, `Tìm khách`, `Tìm chứng từ`.
- Nếu action cuối ô là icon-only thì phải có `aria-label`.
- Khi trang cần gợi ý nhanh, shared search được phép xổ danh sách ngay dưới ô nhập theo `role="listbox"`/`role="option"`.
- Dòng gợi ý dùng bố cục gọn 3 vùng: nội dung chính, mô tả phụ, số tiền/trạng thái ở mép phải nếu có.
- Dropdown gợi ý chỉ chứa dữ liệu do trang truyền vào; shell không tự quyết định API, filter, hay nghiệp vụ chọn.
- Tìm kiếm chính phải hỗ trợ bỏ dấu tiếng Việt ở client/API nơi có search text: gõ `khach le`, `nha cung cap`, `don demo` vẫn trả kết quả có dấu tương ứng nếu dữ liệu có.
- Dropdown gợi ý dùng z-index chung của shell, phải nổi trên bảng, inline detail, filter/sidebar và không bị cắt bởi vùng list.
- Nếu không có kết quả sau khi đã gọi tìm, hiển thị dòng trống ngắn như `Không có kết quả phù hợp`.

POS được phép dùng shared search nhưng vẫn giữ hành vi riêng của F3 và dropdown kết quả.

## 5. Button và icon

Button intent chuẩn:

- `primary`: hành động chính như lưu, tạo hóa đơn, thanh toán.
- `secondary`: hành động phụ như báo giá, in, lọc, mở.
- `danger`: xóa/hủy hoặc hành động phá dữ liệu.

Icon-only:

- Dùng primitive chung như `.management-icon-button` hoặc rule shared tương đương.
- Bắt buộc có `aria-label`.
- Chỉ dùng màu danger khi thao tác nguy hiểm.
- Desktop ưu tiên icon + chữ với hành động chính; mobile có thể icon-only nếu không đủ rộng.

## 6. Layout và density

Desktop:

- Dense nhưng rõ.
- Không dùng hero/card lớn cho màn vận hành.
- Table/list ưu tiên scan nhanh.
- Action chính luôn dễ thấy.

Tablet/mobile:

- Tăng vùng bấm.
- Ẩn chữ phụ khi thiếu ngang, nhưng giữ `aria-label`.
- Table có thể chuyển card nếu không đủ chiều ngang.

## 7. Token và màu

Không hardcode màu/spacing/radius/shadow trong từng màn nếu token đã có.

Nhóm token bắt buộc:

- surface, surface-muted, text, text-muted, border, primary, success, warning, danger.
- spacing, radius, shadow, z-index.

Màu theo ý nghĩa:

- `primary`: hành động chính/đang chọn.
- `success`: hoàn tất/đã thanh toán.
- `warning`: còn nợ/cần chú ý.
- `danger`: lỗi/hủy/xóa.
- `neutral`: trạng thái phụ.

## 8. Modal, table, filter

Modal dùng vỏ chung:

- `management-modal-backdrop`
- `management-modal-dialog`
- `management-modal-header`
- `management-modal-form`
- `management-modal-footer`

Danh sách quản lý dùng:

- `management-list-surface`
- `management-table`
- `management-table-footer`
- `management-filter-*`
- `management-compact-search`

Trang riêng chỉ thêm class khi cần bố cục đặc thù.

## 9. CSS Layer Hiện Hành

CSS phải chia theo lớp rõ ràng:

| File | Vai trò |
| --- | --- |
| `src/styles/tokens.css` | Token màu, spacing, radius, shadow, z-index |
| `src/styles/base.css` | Reset, body, focus, scrollbar, button/icon primitive |
| `src/styles/shared.css` | AppShell, account menu, management layout, modal, table, filter, shared search |
| `src/styles/pages.css` | Ruột page back-office: dashboard, account, catalog, finance, customer, supplier, inventory |
| `src/styles/pos.css` | Ruột POS: topbar POS, cart, production queue, checkout drawer |
| `src/styles/index.css` | Chỉ import các layer, không viết rule trực tiếp |

Quy tắc vỏ/ruột:

- Vỏ chung nằm ở `tokens.css`, `base.css`, `shared.css`.
- Ruột nghiệp vụ nằm ở `pages.css`, `pos.css`.
- Khi sửa UI page nghiệp vụ, kiểm tra có class shared trước khi thêm CSS mới.
- Không định nghĩa lại button/menu/search/modal/table trong ruột nếu vỏ đã có.
- Nếu một rule riêng được dùng lại ở 2 module, kéo lên `shared.css`.
- Test CSS phải đọc qua import tree, không chỉ đọc `index.css`.
- POS tách vỏ/ruột tại `src/features/pos/pos-core.ts`: component chỉ gọi helper/core cho tính tiền, parse số, state tab, nhãn tab và chuyển báo giá; sửa UI không viết lại nghiệp vụ trong `PosShell.tsx`.
- Quy tắc nghiệp vụ POS mới phải có test ở `pos-core.test.ts` hoặc test service/backend tương ứng trước khi nối vào UI.

## 10. Accessibility

Tối thiểu:

- Focus visible rõ.
- Icon-only có `aria-label`.
- Modal/drawer có title và close.
- Input có label thật hoặc accessible label.
- Không truyền đạt trạng thái chỉ bằng màu.
- Menu/dropdown dùng role phù hợp và đóng được bằng bàn phím.

## 11. Checklist trước khi chốt UI

- CSS dùng chung trước, CSS riêng sau.
- Không còn selector cũ trùng chức năng.
- Desktop/tablet/mobile không tràn chữ.
- Menu nổi không bị drawer/panel che.
- Search POS và search trang quản lý cùng ngôn ngữ visual khi có thể.
- Button đúng intent.
- Không đưa nghiệp vụ vào component UI.
- `npm run verify:nas-bundle` pass nếu build cho NAS.
- `npm run smoke:nas` pass trước khi báo NAS đã sẵn sàng.
