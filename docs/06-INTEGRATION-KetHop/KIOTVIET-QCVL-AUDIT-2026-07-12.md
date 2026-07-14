# Đối chiếu KiotViet và QCVL - 2026-07-12

Mục tiêu: ghi mốc QCVL sau khi đã import dữ liệu, để mở KiotViet và so cùng bộ lọc.

Phạm vi hiện tại:
- Có đối chiếu: Hóa đơn, Khách hàng, Nhà cung cấp, Nhập hàng, Hàng hóa, Tồn hàng, Kiểm kho.
- Tạm bỏ: Sổ quỹ, Bảng giá.
- POS không dùng làm mốc import trong đợt này.

Quy tắc so:
- Tổng trên QCVL là tổng của toàn bộ bộ lọc, không phải tổng 1 trang.
- So theo cùng bộ lọc trên KiotViet.
- Nếu lệch, ưu tiên kiểm tra: điều kiện lọc, trạng thái xóa `{DEL}`, mã quy đổi đơn vị, mã khách/NCC lẻ, trạng thái phiếu, ngày nguồn từ KiotViet.

## Mốc QCVL

### Hóa đơn

API filter: `/api/v1/sales-documents?from=2026-07-01&to=2026-07-31&type=invoice&status=completed&page=1&page_size=5`

Kết quả:
- Tổng dòng: 153
- Tổng tiền: 69 280 508
- Khách đã trả: 13 115 824
- Công nợ: 56 164 684
- Đối chiếu KV: khớp tổng dòng, tổng sau giảm giá, 5 dòng đầu.

5 dòng đầu:

| Mã | Thời gian | Mã khách | Khách hàng | Tổng tiền | Đã trả | Công nợ | Trạng thái |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| HD011143 | 2026-07-11T17:24:14.633Z | CT | Cường Thinh | 70 000 | 0 | 70 000 | completed |
| HD011142 | 2026-07-11T17:22:17.997Z | XD | Xuân Đức | 1 500 000 | 0 | 1 500 000 | completed |
| HD011141 | 2026-07-11T17:12:38.243Z | KH000217 | Chị Hương (Rạp Quốc Hoàng) | 1 039 385 | 0 | 1 039 385 | completed |
| HD011139 | 2026-07-11T16:24:17.513Z | KH000240 | Rạp Hội Hiếu | 1 053 695 | 0 | 1 053 695 | completed |
| HD011138 | 2026-07-11T15:13:42.747Z | KH000066 | nội thất đât quảng | 610 400 | 0 | 610 400 | completed |

### Khách hàng

API filter: `/api/v1/customers?status=active&page=1&page_size=5`

Kết quả:
- Tổng dòng QCVL: 519
- Tổng dòng KV: 518
- Tổng công nợ: 255 093 403
- Tổng bán trừ trả hàng: 4 935 920 453
- Ghi chú: QCVL có thêm `khachle` nội bộ để map hóa đơn không có mã khách; KV không tính dòng này trong danh sách khách hàng.
- Đối chiếu KV: khớp tổng công nợ, tổng bán trừ trả hàng, 5 dòng KV đầu từ KH000522 trở xuống.

5 dòng đầu:

| Mã | Tên | Điện thoại | Công nợ | Tổng bán | Trạng thái |
| --- | --- | --- | ---: | ---: | --- |
| KH000522 | Lanh Hồ |  | 336 000 | 336 000 | active |
| KH000521 | Phan Việt Toàn - TT VHTH xã Triệu Cơ |  | 44 800 | 44 800 | active |
| KH000520 | Siêu thị Thành Cổ |  | 0 | 643 200 | active |
| KH000519 | A Dũng Xóm Ga |  | 0 | 6 000 000 | active |
| KH000518 | DUY 842 |  | 0 | 250 000 | active |

### Nhà cung cấp

API filter: `/api/v1/suppliers?status=active&page=1&page_size=5`

Kết quả:
- Tổng dòng QCVL: 44
- Tổng dòng KV: 43
- Phải trả hiện tại KV: 59 450 458
- Phải trả hiện tại QCVL hiện tại: 39 129 983
- Tổng mua: 2 037 567 534
- Ghi chú: QCVL có thêm `NCC lẻ` nội bộ để map phiếu nhập không có NCC; KV không tính dòng này.
- Lệch công nợ NCC: do đối tác vừa là khách hàng vừa là nhà cung cấp. KiotViet không bù trừ nợ khách hàng vào nợ NCC trong tổng `Nợ cần trả hiện tại`. QCVL phải giữ công nợ NCC đúng theo cột NCC, không trừ công nợ khách hàng.
- Bằng chứng hiện tại: QCVL cộng thẳng active NCC đang ra 39 129 983. Nếu bỏ `NCC lẻ`, cộng các khoản dương là 59 652 228; KV hiển thị 59 450 458. Các dòng cần kiểm sâu: `NCC000035/Út Tèo = -20 520 975`, `K/Khánh QC = 200 500`, các khoản âm nhỏ `NCC000019 = -120`, `NCC000016 = -900`, `NCC000007 = -250`.

5 dòng đầu:

| Mã | Tên | Điện thoại | Phải trả | Tổng mua | Trạng thái |
| --- | --- | --- | ---: | ---: | --- |
| THN | Thịnh Hồng Nguyên | 0787583609 | 0 | 31 973 289 | active |
| NCC000038 | O Hoa | 845454864676 | 0 | 2 010 000 | active |
| NCC000037 | Trần Thị Group | 0905831313 | 0 | 11 845 160 | active |
| NCC000036 | Standee | 0545164884 | 0 | 279 000 | active |
| nd | Nguyễn Danh | 0914220576 | 0 | 14 045 200 | active |

### Nhập hàng

API filter: `/api/v1/purchase/receipts?date_from=2026-07-01&date_to=2026-07-31&page=1&page_size=5`

Kết quả:
- Tổng dòng: 16
- Tổng phải trả: 69 533 471
- Còn phải trả: 1 967 800

5 dòng đầu:

| Mã | Thời gian | Mã NCC | Nhà cung cấp | Phải trả | Đã trả | Còn lại | Trạng thái |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| PN000684 | 2026-07-11T14:51:26.597Z | NCC000026 | Chị giao | 2 880 000 | 2 880 000 | 0 | posted |
| PN000683 | 2026-07-08T10:04:33.330Z | NCC000026 | Chị giao | 2 125 000 | 2 125 000 | 0 | posted |
| PN000682 | 2026-07-08T10:03:01.553Z | NCC000008 | toàn led | 1 100 000 | 1 100 000 | 0 | posted |
| PN000681 | 2026-07-07T10:44:09.240Z | THN | Thịnh Hồng Nguyên | 6 104 075 | 6 104 075 | 0 | posted |
| PN000680 | 2026-07-06T09:09:01.037Z | NCC000012 | Quang Khải | 510 000 | 510 000 | 0 | posted |

### Hàng hóa

API filter: `/api/v1/products?status=active&page=1&page_size=5`

Kết quả:
- Tổng mã hàng gốc QCVL: 383
- Tổng gồm đơn vị quy đổi QCVL: 497
- Tổng hàng hóa KV: 383
- Tổng mã hàng KV: 497
- Đối chiếu KV: khớp tổng hàng hóa, tổng mã hàng, và thứ tự mặc định theo `Thời gian tạo` mới nhất trước.

5 dòng đầu:

| Mã | Tên | Trạng thái | Đơn vị | Loại | Cách bán | Theo dõi tồn |
| --- | --- | --- | --- | --- | --- | --- |
| F4N | Fomex 4.5mm | active | Tấm | goods | quantity | true |
| HH | Hộp hoa (fom dán decal, 85 x 60 cm) | active | Cái | goods | quantity | false |
| F5d2 | Fomex 5mm - decal (2 mặt) | active | Tấc | goods | quantity | false |
| F335x60 | Bảng 35x60 Fommex 3mm dán decal, cắt CNC | active | Cái | goods | quantity | false |
| ADC | Bảng Alu, dán decal | active | Cái | goods | quantity | false |

### Tồn hàng

API filter: `/api/v1/inventory/products?page=1&page_size=5`

Kết quả:
- Tổng dòng: 20
- Tổng tồn: 647
- Dòng âm: 0

5 dòng đầu:

| Mã | Tên | Trạng thái | Đơn vị tồn | Tồn khả dụng | Âm tồn |
| --- | --- | --- | --- | ---: | --- |
| MICA-3MM | Mica trong 3mm | active | tam | 10 | false |
| DECAL-PP | Decal PP | active | m2 | 13.5 | false |
| CUT-CNC | Cat CNC | active | lan | 0 | false |
| DEV20-SP-004 | San pham demo 004 | active | m2 | 20.5 | false |
| DEV20-SP-005 | San pham demo 005 | active | lan | 0 | false |

### Kiểm kho

API filter: `/api/v1/inventory/stocktakes?from=2026-01-01&to=2026-12-31&page=1&page_size=5`

Kết quả:
- Tổng dòng: 30

5 dòng đầu:

| Mã | Thời gian | Trạng thái | Mã hàng | Tên hàng | Tồn hệ thống | Tồn thực tế | Lệch | Giá trị thực tế |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| KK000333 | 2026-06-05T07:52:12.640Z | balanced | F8 | Fomex 8mm | 0.004999999999999671 | 1.5 | 1.4950000000000003 | 313 550 |
| KK000332 | 2026-06-05T07:51:22.960Z | balanced | F5 | Fomex 5mm | -1.782900000000001 | 18 | 19.7829 | 2 268 000 |
| KK000331 | 2026-06-05T07:50:25.490Z | balanced | F4 | Fomex 4mm | 18.25 | 2 | -16.25 | 214 000 |
| KK000330 | 2026-06-05T07:49:36.547Z | balanced | F3 | Fomex 3mm | 36.678000000000004 | 21 | -15.678000000000004 | 1 665 008 |
| KK000329 | 2026-05-28T23:16:35.170Z | balanced | SP000056 | Mực bạt | 144.373 | 35 | -109.37299999999999 | 7 348 670 |

## Cần so tiếp trên KiotViet

- Hóa đơn: lọc 01/07/2026 đến 31/07/2026, trạng thái Hoàn thành, so tổng dòng và tổng tiền.
- Khách hàng: lọc Đang hoạt động; chấp nhận QCVL dư `khachle` nội bộ nếu tổng tiền khớp.
- Nhà cung cấp: lọc Đang hoạt động; chấp nhận QCVL dư `NCC lẻ` nội bộ; cần sửa công nợ NCC theo quy tắc không bù trừ công nợ khách.
- Nhập hàng: lọc 01/07/2026 đến 31/07/2026, so tổng phiếu và tổng tiền.
- Hàng hóa: lọc Hàng đang kinh doanh, so tổng hàng hóa và tổng mã hàng; hiện khớp KV.
- Tồn hàng: chưa chốt là mốc KiotViet; chỉ dùng để phát hiện lệch công thức tồn.
- Kiểm kho: chỉ dùng làm mốc kiểm tra dữ liệu đầu kỳ/lịch sử, không dùng thay nghiệp vụ mua bán.
