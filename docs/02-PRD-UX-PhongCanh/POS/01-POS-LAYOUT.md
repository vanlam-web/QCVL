# 01-POS-LAYOUT.md - POS Master Blueprint

> Source of Truth tổng thể cho màn hình bán hàng POS.
> Cập nhật: 2026-07-08.

## 1. Mặt bằng tổng thể

POS khóa vào một luồng bán chính, không dùng dải chế độ bán ở đáy.

```text
K01 Topbar: tìm hàng, tab hóa đơn, tiện ích, tài khoản
---------------------------------------------------------
K02 Giỏ hàng và hàng đợi máy              K03 Khách, sản phẩm, thanh toán
K02-A Dòng sản phẩm                       K03-A Tìm/chọn khách
K02-B Ghi chú đơn                         K03-C Chọn nhanh sản phẩm
K02-C Tổng tiền                           K03-D Báo giá / Thanh toán
K02-D Hàng đợi máy sản xuất
```

Tỷ lệ desktop định hướng:

- K02: vùng làm việc chính, rộng hơn.
- K03: vùng chọn khách/sản phẩm và mở thanh toán.
- Khi bấm `Thanh toán`, drawer thanh toán mở bên phải, nội dung còn lại không được bị giãn đều khó đọc.

## 2. K01 - Topbar

K01 có 3 khu:

- Khu 1: tìm hàng F3.
- Khu 2: tab hóa đơn.
- Khu 3: tiện ích và tài khoản.

`Khui vật tư` thuộc K01 tiện ích, không có khu topbar riêng.

Chi tiết: [K01/01-K01-TOPBAR.md](./K01/01-K01-TOPBAR.md)

## 3. K02 - Giỏ hàng và điều phối máy

K02 gồm:

- Dòng sản phẩm, số lượng, đơn vị, đơn giá, thành tiền.
- Ghi chú tổng đơn.
- Tổng tiền hàng realtime.
- Hàng đợi máy sản xuất: in bạt, in decal, CNC.

Yêu cầu layout:

- Footer ghi chú/tổng tiền canh đáy với panel phải.
- Input tiền trong dòng hàng không bị cắt số cuối.
- Hàng đợi máy dùng icon máy rõ, chữ hiện khi đủ rộng và ẩn khi không đủ ngang.

Chi tiết:

- [K02/02-K02A-DONG-SP.md](./K02/02-K02A-DONG-SP.md)
- [K02/03-K02B-GHI-CHU.md](./K02/03-K02B-GHI-CHU.md)
- [K02/04-K02D-HANG-DOI.md](./K02/04-K02D-HANG-DOI.md)

## 4. K03 - Khách, sản phẩm, thanh toán

K03 gồm:

- Tìm/chọn khách hàng.
- Lưới sản phẩm nhanh.
- Nút `Báo giá` và `Thanh toán`.

Quy định:

- Không chọn khách thì mặc định backend dùng `khachle - Khách lẻ`.
- Không ghi nợ vào customer null.
- `Báo giá` và `Tạo hóa đơn`/`Thanh toán` giữ vai trò riêng theo K03-D.
- Tìm khách phải truy vấn được khách demo và khách thật.

Chi tiết:

- [K03/01-K03A-DOI-TAC.md](./K03/01-K03A-DOI-TAC.md)
- [K03/03-K03C-LUOI-SP.md](./K03/03-K03C-LUOI-SP.md)
- [K03/04-K03D-THANH-TOAN.md](./K03/04-K03D-THANH-TOAN.md)

## 5. Luồng bán

1. Thu ngân tìm/chọn hàng bằng F3 hoặc lưới sản phẩm.
2. Thu ngân chọn khách nếu có. Nếu bỏ trống, đơn gắn `khachle - Khách lẻ`.
3. Hàng đợi máy có thể đưa file vào hóa đơn nháp.
4. `Báo giá` tạo chứng từ báo giá.
5. `Thanh toán` mở drawer thanh toán, chọn tiền mặt/chuyển khoản/kết hợp.
6. Khi tạo hóa đơn thành công: ghi chứng từ, ghi sổ quỹ nếu có tiền thu, cập nhật công nợ và tồn kho theo backend.

## 6. Quy chuẩn CSS POS

- Tìm hàng F3 dùng `.management-compact-search` làm nền visual chung.
- Menu tài khoản POS dùng `.account-menu-popover` giống AppShell.
- K01 tiện ích gom icon thao tác nhanh, không tách thêm vùng mới nếu không cần.
- CSS riêng POS nằm trong `src/styles/pos.css`, chỉ xử lý grid/flex/trạng thái đặc thù của POS.
- CSS dùng chung phải nằm trong `src/styles/shared.css` hoặc `src/styles/base.css`; POS không tự định nghĩa lại button, menu tài khoản, modal, table, hoặc search chung.
- Không tạo selector rác trùng với shared CSS.
