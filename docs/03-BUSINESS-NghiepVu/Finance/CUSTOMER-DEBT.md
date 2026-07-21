# CUSTOMER-DEBT — Công thức chuẩn công nợ khách hàng

> Source of Truth nghiệp vụ cho tổng công nợ khách hàng.

---

## 1. Quyết định Owner

Import KiotViet không phải là mốc khóa công thức.

Import KiotViet chỉ là cách đưa dữ liệu cũ vào QCVL để khỏi nhập tay lại. Sau import, chứng từ KV phải được chuẩn hóa thành chứng từ/ledger QCVL và đi theo cùng rule vận hành:

- hóa đơn KV còn nợ là hóa đơn còn nợ trong QCVL
- phiếu thu KV là phiếu thu trong QCVL
- phiếu cân bằng/điều chỉnh KV là phiếu điều chỉnh công nợ trong QCVL
- chiết khấu thanh toán KV là chứng từ giảm công nợ trong QCVL
- chứng từ import có thể được xem, thanh toán, sửa bằng bản mới, hủy theo quyền và audit giống chứng từ QCVL

Không dùng `customer_debt_adjustments.balance_after` làm mốc bất biến để tính toàn bộ công nợ về sau.

---

## 2. Mục tiêu

Cùng một khách phải có cùng một số công nợ trên:

- danh sách Khách hàng
- chi tiết Khách hàng tab Công nợ
- danh sách Finance Công nợ
- POS selected customer / checkout debt badge
- API `GET /finance/customer-debts`
- API `GET /finance/customers/{customer_id}/debt`

Không màn nào tự lấy `customer_snapshots.total_debt_amount`, không tự cộng theo cách riêng, không tự trừ phiếu thu theo cách riêng.

---

## 3. Công thức chuẩn

Runtime status: code đã chuyển sang canonical partner debt ledger cho khách hàng thuần, NCC thuần, và KH liên kết NCC. `balance_after` KV chỉ còn là metadata đối soát, không tham gia công thức tổng.

Tổng công nợ khách hàng là tổng dấu của các chứng từ công nợ đang hiệu lực:

```text
total_debt =
  sum(HD/HDO)
  - sum(TT/TTHD/TTHDO/TTM/TTMHD/TNH/TNHHD)
  - sum(CKKH)
  +/- sum(CB theo amount_delta)
```

Thu nợ làm giảm các chứng từ công nợ theo thứ tự cũ nhất trước, trừ khi người dùng nhập phân bổ cụ thể theo hóa đơn/chứng từ.

Nếu một chứng từ đã trả hết, hủy, hoặc đã được thay bằng bản sửa mới thì không còn tính vào số dư hiệu lực.

Không có công thức riêng theo từng khách. Mọi khách thuần dùng cùng bảng dấu ở mục 5; khách liên kết NCC dùng cùng bảng dấu nhưng có thêm view đảo dấu ở mục "Khách hàng liên kết nhà cung cấp".

---

## 4. Vai trò của dữ liệu KiotViet

`customer_snapshots.total_debt_amount` chỉ là số tham chiếu từ file khách hàng KV tại thời điểm import.

Không dùng số này làm tổng runtime.

Dữ liệu KV phải đi vào các nhóm chứng từ chuẩn. Quy tắc đọc là:

```text
mã phiếu + loại giao dịch + khách liên kết + trạng thái hiệu lực
```

Không chỉ nhìn prefix mã phiếu rồi cộng/trừ toàn cục. Một phiếu chỉ được tính cho khách khi phiếu đó có `customer_id`, mã khách, hoặc đối tượng nộp/nhận khớp khách đang tính.

| Nguồn KV | QCVL lưu như | Ảnh hưởng công nợ |
|---|---|---|
| `HD...` còn nợ | hóa đơn bán hàng | tăng nợ theo `debt_amount` |
| `TT...`, `TTM...`, `TNHHD...` | phiếu thu / payment receipt | giảm nợ theo phân bổ |
| `CB...` | phiếu điều chỉnh công nợ | tăng/giảm theo `amount_delta`, còn mở thì còn tính |
| `CKKH...` | chiết khấu thanh toán / giảm công nợ | giảm nợ |
| `PN...` liên quan khách-NCC | phiếu nhập NCC / chứng từ liên kết | chỉ ảnh hưởng sổ KH nếu khách đó được liên kết NCC; xem bảng đảo dấu |

Nếu import thiếu phân bổ chi tiết của phiếu thu KV, QCVL được phép phân bổ tạm vào chứng từ nợ cũ nhất trước. Khi sau này có phân bổ thật từ KV/detail/API, phân bổ thật thắng và thay thế phân bổ tạm.

---

## 5. Quy ước mã phiếu công nợ khách hàng

Nguồn đối chiếu là file KiotViet đã xuất:

- `SoQuy_KV*.xlsx`: mã phiếu, loại thu chi, mã người nộp/nhận.
- `BaoCaoCongNoTheoKhachHang_KV*.xlsx`: mã giao dịch, loại giao dịch, ghi nợ, ghi có, nợ cuối kỳ.
- `DanhSachChiTietHoaDon_KV*.xlsx`: hóa đơn bán, khách, tổng tiền, khách đã trả tại thời điểm export.

Quy ước cho sổ khách hàng:

#### Khách hàng thuần

| Mã phiếu | Nguồn KV đã thấy | Điều kiện thuộc khách | Tác động nợ KH | Ghi chú |
|---|---|---|---:|---|
| `HD...` | Báo cáo công nợ, chi tiết hóa đơn | hóa đơn thuộc khách | `+` | Hóa đơn bán làm tăng nợ theo số còn phải thu |
| `HDO...` | Báo cáo công nợ | hóa đơn online/import thuộc khách | `+` | Xử lý như `HD...` nếu có dữ liệu nguồn |
| `TTHD...` / `TTHDO...` | Sổ quỹ, báo cáo công nợ | link trực tiếp tới `HD...` / `HDO...` cùng mã hoặc khách khớp | `-` | Cùng nhóm thanh toán hóa đơn; `TTHD011149` thanh toán `HD011149`, `TTHDO...` thanh toán `HDO...` |
| `TT...` | Sổ quỹ, báo cáo công nợ | mã người nộp/nhận là khách hoặc báo cáo công nợ của khách | `-` | Phiếu thu khách trả nợ, có thể phân bổ nhiều hóa đơn |
| `TTMHD...` | Sổ quỹ, báo cáo công nợ | loại giao dịch là khách trả nợ và khách khớp | `-` | Thu tiền mặt trả nợ |
| `TNHHD...` | Sổ quỹ, báo cáo công nợ | loại giao dịch là khách trả nợ và khách khớp | `-` | Thu ngân hàng trả nợ |
| `TTM...` | Sổ quỹ, báo cáo công nợ | chỉ khi loại là `Phiếu thu Khách trả nợ` / `Thu Khách trả nợ` và khách khớp | `-` | Nếu là thu nhập khác/chuyển rút thì không tính công nợ |
| `TNH...` | Sổ quỹ | chỉ khi loại là khách trả nợ và khách khớp | `-` | Nếu là thu nhập khác/chuyển rút thì không tính công nợ |
| `CKKH...` | Báo cáo công nợ | chứng từ thuộc khách | `-` | Chiết khấu thanh toán, giảm nợ nhưng không phải tiền thu |
| `CB...` | Báo cáo công nợ | chứng từ thuộc khách | `+/-` | Điều chỉnh; đọc theo `Ghi nợ/Ghi có` hoặc `amount_delta` đã chuẩn hóa |
| `PN...` | Báo cáo công nợ / nhập hàng | không tính trực tiếp vào khách thuần | `0` | Phiếu nhập thuộc sổ NCC; chỉ ảnh hưởng KH khi khách được liên kết NCC theo bảng bên dưới |
| `CTM...`, `CNH...` | Sổ quỹ | chi thường/chi phí | `0` | Không thuộc công nợ KH |
| `PCPN...`, `PC...` | Sổ quỹ | trả NCC | `0` | Thuộc sổ NCC |
| `TTD_*`, `CTD_*`, `CVDT`, `TVDT` | Sổ quỹ | chuyển/rút quỹ | `0` | Không công nợ KH |

Trạng thái:

- Chỉ tính phiếu `posted`/đã thanh toán/đang hiệu lực.
- Không tính phiếu đã hủy hoặc đã được thay bằng bản sửa mới.
- Nếu có cả dòng hóa đơn và dòng thanh toán từ export, không cộng `Khách đã trả` thêm lần nữa sau khi đã áp phiếu thu, vì sẽ double-count.

Quy ước chữ/số:

- `HDO` là chữ `O`, không phải số `0`.
- `TTHDO = TT + HDO`; xử lý cùng nhóm thanh toán hóa đơn với `TTHD`.

### Khách hàng liên kết nhà cung cấp

Khách hàng và nhà cung cấp liên kết vẫn là hai sổ riêng:

- sổ khách hàng: số phải thu khách
- sổ nhà cung cấp: số phải trả NCC

Không tự gộp theo tên/số điện thoại và không tự cấn trừ nếu không có chứng từ rõ.

KiotViet hiển thị đối tác liên kết theo hai view đảo dấu. Cùng một giao dịch xuất hiện ở sổ khách và sổ NCC với dấu ngược nhau.

Evidence đã kiểm trên trình duyệt KiotViet:

- khách `UT - Út Tèo` có nợ hiện tại `+16,021,746`
- NCC liên kết `NCC000035 - Út Tèo` có nợ cần trả hiện tại `-16,021,746`
- dòng `HD011293` ở sổ KH là `+107,352`, ở sổ NCC là `-107,352`
- dòng `TT001869` ở sổ KH là `-3,000,000`, ở sổ NCC là `+3,000,000`

Quy tắc chốt:

| Mã phiếu / nghiệp vụ | Sổ KH liên kết | Sổ NCC liên kết | Ghi chú |
|---|---:|---:|---|
| `HD...`, `HDO...` bán cho khách | `+` | `-` | KH phải trả mình; ở view NCC là khoản ngược lại |
| `TT...`, `TTHD...`, `TTHDO...`, `TTM...`, `TTMHD...`, `TNH...`, `TNHHD...` khách trả tiền | `-` | `+` | Thu tiền giảm nợ KH, đảo dấu ở view NCC |
| `CKKH...` chiết khấu thanh toán cho khách | `-` | `+` | Giảm nợ KH, không phải tiền thu |
| `CB...` điều chỉnh/cân bằng công nợ KH | `+/-` theo phiếu | đảo dấu | Phiếu điều chỉnh cân bằng phải đảo chiều dấu với sổ NCC liên kết |
| `PN...` nhập hàng từ NCC liên kết | `-` | `+` | Mình phải trả NCC nên giảm phải thu thuần ở view KH liên kết, tăng phải trả ở view NCC |
| `PCPN...`, `PC...` trả tiền NCC liên kết | `+` | `-` | Trả NCC làm giảm phải trả NCC, đảo dấu ở view KH |

Nguyên tắc không double-count:

- Một chứng từ chỉ ghi một lần vào ledger quan hệ đối tác.
- Sổ KH và sổ NCC là hai cách nhìn cùng quan hệ liên kết, không phải hai khoản độc lập để cộng chồng.
- Khi hiển thị ở view còn lại, hệ thống đảo dấu theo bảng trên.
- Nếu chứng từ thuộc NCC không liên kết khách nào thì không đưa vào sổ KH.

---

## 6. Thanh toán và sửa chứng từ import

Chứng từ import không phải dữ liệu chết.

Người dùng có thể:

- thu nợ cho hóa đơn/điều chỉnh import còn mở
- sửa phiếu import bằng bản mới `MaCu.01` hoặc cơ chế revision tương đương
- hủy chứng từ import nếu có quyền và có lý do
- xem lịch sử sửa/hủy/thu liên quan

Không sửa đè mất dấu vết. Mọi sửa/hủy phải giữ audit và tạo bản hiệu lực mới hoặc trạng thái `cancelled`.

---

## 7. Quy tắc hiển thị

- Tổng chính là số theo công thức chuẩn, không phải snapshot KV.
- Bảng chi tiết phải giải thích được số tổng bằng các chứng từ còn hiệu lực.
- Được hiện số âm để đối soát lịch sử/import.
- Thu nợ live không cho thu vượt số nợ còn lại; không tạo module khách trả trước trong MVP.
- Nếu khách vừa là khách hàng vừa là nhà cung cấp, không tự bù trừ nợ khách với nợ NCC nếu chưa có chứng từ điều chỉnh rõ.

---

## 8. Quy tắc triển khai

Mọi read path phải dùng chung công thức trong backend Finance:

- customer list totals
- customer detail debt
- Finance customer debts
- POS customer debt badge/detail

Nếu thêm màn hình mới có số công nợ, dùng API trả số chuẩn, không tự tính ở frontend.

Plan sửa runtime đã chốt: [2026-07-21 Partner Debt Ledger Rebuild](../../superpowers/plans/2026-07-21-partner-debt-ledger-rebuild.md).

---

## 9. Cách kiểm tra khi báo sai

1. Lấy danh sách chứng từ công nợ còn hiệu lực của khách.
2. Tách theo loại: hóa đơn còn nợ, phiếu điều chỉnh, chiết khấu, phiếu thu đã phân bổ.
3. Tính lại số còn mở từng chứng từ.
4. So với số tổng đang hiển thị trên Customers/Finance/POS.
5. Nếu các màn khác nhau, bug nằm ở read path chưa dùng chung backend.
6. Nếu tổng backend sai, kiểm chứng dữ liệu import/thu/sửa/hủy của từng chứng từ, không dùng snapshot KV để ép số.

---

← [Quay về Finance README](./README.md)
