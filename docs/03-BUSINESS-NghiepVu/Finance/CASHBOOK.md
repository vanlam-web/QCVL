# CASHBOOK — Nghiệp vụ sổ quỹ, phiếu thu và phiếu chi

> **Nguồn:** Chốt từ trao đổi Owner 2026-06-30

---

## 0. Căn cứ KiotViet

Quan sát bổ sung ngày `05/07/2026`:

- KiotViet có 4 nhóm quỹ hiển thị: `Tiền mặt`, `Ngân hàng`, `Ví điện tử`, `Tổng quỹ`.
- QC-OMS MVP vẫn chốt `cash` và `bank`; `Ví điện tử` là khả năng mở rộng, chưa làm nếu chưa có nghiệp vụ riêng.
- Sổ quỹ cần lọc được theo `Công nợ đối tác`: tính vào công nợ, không tính vào công nợ, không có công nợ.
- Phiếu thu/chi có cờ `Hạch toán kết quả kinh doanh`; dòng không hạch toán vẫn vào sổ quỹ nhưng không tính vào báo cáo kinh doanh.
- Phiếu thu tự động từ hóa đơn có bảng gắn hóa đơn/phân bổ.
- Phiếu chi thủ công có đối tượng nhận là khách hàng, nhà cung cấp, nhân viên hoặc khác.
- File xuất tháng 06/2026 có các loại thực tế: tiền khách trả, lương nhân viên, vận chuyển, vật tư, tiền trả nhà cung cấp, chuyển/rút, chi phí khác, điện/nước/nhà/rác/thuế/hoa hồng/VAT cho khách.

Quan sát ngày `01/07/2026`:

- Sổ quỹ mặc định `Tháng này` có thể trống vì đầu tháng mới; phải kiểm tra `Toàn thời gian` hoặc tìm theo mã phiếu trước khi kết luận.
- Quỹ `Tiền mặt` toàn thời gian có `4,161 phiếu thu chi`.
- Phiếu thu tự động từ hóa đơn hiển thị liên kết hóa đơn và bảng phân bổ thu vào hóa đơn.
- Phiếu chi thủ công có thông tin có/không hạch toán kết quả kinh doanh, người chi, người nhận, phương thức thanh toán và ghi chú.

Kết luận nghiệp vụ cho QC-OMS:

- Sổ quỹ là nghiệp vụ lõi, phục vụ thu/chi, công nợ và đối soát cuối ngày.
- Tìm phiếu theo mã phải tìm được lịch sử dài hạn, không bị bộ lọc tháng hiện tại che mất.
- Phiếu thu/chi cần phân biệt dòng có tính vào báo cáo kinh doanh và dòng không tính.
- Phiếu thu tự động từ hóa đơn/thu nợ phải truy vết được phân bổ vào hóa đơn nào.

---

## 1. Mục đích

Tài liệu này là Source of Truth cho nghiệp vụ sổ quỹ của QC-OMS:

- quỹ tiền mặt và tài khoản ngân hàng
- phiếu thu và phiếu chi
- đối soát cuối ngày
- quy tắc sửa phiếu bằng phiên bản mới

Hiện trạng triển khai sau PR #83:

- Màn `/finance` đã ưu tiên bảng sổ quỹ làm bề mặt chính.
- Summary `Quỹ đầu kỳ`, `Tổng thu`, `Tổng chi`, `Tồn quỹ` được lấy theo filter sổ quỹ; `Tồn quỹ` dùng số `ending_balance` của summary, không dùng tổng số dư tài khoản tĩnh.
- Bộ lọc hiện có gồm thời gian, quỹ tiền, loại chứng từ, trạng thái và hạch toán KQKD; đổi filter là tự áp dụng.
- Form phiếu thu/chi thủ công đã có công nợ đối tác mode, đối tượng nộp/nhận, số điện thoại, ghi chú và hạch toán KQKD.
- Filter theo loại thu chi, người tạo, nhân viên, người nộp/nhận, công nợ đối tác và search sổ quỹ nâng cao vẫn là slice sau.

---

## 2. Quỹ và tài khoản

### BR-FIN-01: Mỗi dòng tiền thuộc một quỹ/tài khoản

Mọi khoản thu/chi phải ghi vào đúng quỹ hoặc tài khoản.

Các loại quỹ/tài khoản tối thiểu:

- `cash`: tiền mặt/két
- `bank`: tài khoản ngân hàng

Với chuyển khoản, hệ thống bắt buộc biết tiền vào hoặc ra từ tài khoản ngân hàng nào.

### BR-FIN-02: Đối soát theo từng quỹ/tài khoản

Cuối ngày, đối soát được thực hiện theo từng quỹ/tài khoản:

- tiền mặt trong hệ thống phải khớp tiền mặt trong két
- tiền chuyển khoản phải khớp từng tài khoản ngân hàng

Không đối soát chuyển khoản bằng một tổng chung không phân biệt tài khoản.

---

## 3. Phiếu thu và phiếu chi

### BR-FIN-03: Có cả thu và chi trong MVP

MVP quản lý rõ cả phiếu thu và phiếu chi.

Nhóm phiếu thu gồm:

- thu bán hàng
- thu nợ khách
- thu khác
- chuyển/rút tiền
- góp vốn nếu Owner dùng cho tăng tiền không phải doanh thu

Nhóm phiếu chi gồm:

- chi mua vật tư
- chi hoàn tiền
- chi phí vận hành
- chi khác
- chi lương nhân viên
- chi vận chuyển
- chi trả nhà cung cấp
- chuyển/rút tiền

Danh mục loại thu/chi phải cho phép cấu hình thêm tên hiển thị, nhưng hệ thống vẫn cần phân nhóm nội bộ để báo cáo:

| Nhóm nội bộ | Hướng | Ví dụ tên hiển thị |
|---|---|---|
| `sale_payment` | Thu | Tiền khách trả |
| `debt_collection` | Thu | Khách trả nợ |
| `other_income` | Thu | Thu nhập khác |
| `capital_contribution` | Thu | Góp vốn |
| `transfer` | Thu/Chi | Chuyển/Rút |
| `material_purchase` | Chi | Vật tư |
| `supplier_payment` | Chi | Tiền trả NCC |
| `staff_salary` | Chi | Lương NV |
| `shipping_expense` | Chi | Vận chuyển |
| `operating_expense` | Chi | Điện, nước, nhà, rác, phần mềm, quảng cáo |
| `tax_or_vat` | Chi | Nộp thuế, chuyển VAT cho khách |
| `commission` | Chi | Hoa hồng khách |
| `other_expense` | Chi | Chi phí khác |

Thu bán hàng/thu nợ sinh từ hóa đơn hoặc công nợ không nhập thủ công ở `cashbook_vouchers`.

### BR-FIN-04: Không duyệt nhiều bước trong MVP

MVP không yêu cầu duyệt nhiều bước cho phiếu thu/chi.

Người có quyền tài chính tạo phiếu thì phiếu được ghi sổ ngay.

Phiếu phải lưu tối thiểu:

- mã phiếu
- loại thu/chi
- quỹ/tài khoản
- số tiền
- có tính vào báo cáo kinh doanh hay không
- người tạo
- người thu/chi nếu khác người tạo
- thời điểm tạo
- đối tượng nộp/nhận nếu có
- ghi chú/lý do nếu có
- chứng từ liên quan nếu có
- đối tượng nộp/nhận loại gì: khách hàng, nhà cung cấp, nhân viên, khác hoặc không có
- mã/tên/số điện thoại người nộp/nhận nếu có
- cờ có tính vào công nợ đối tác hay không nếu dòng liên quan đối tác

---

## 4. Sửa phiếu thu/chi

### BR-FIN-05: Không ghi đè phiếu cũ khi sửa

Mọi phiếu thu/chi đều được phép sửa, nhưng hệ thống không ghi đè dữ liệu phiếu cũ.

Khi sửa:

1. Phiếu cũ chuyển sang trạng thái `cancelled`.
2. Hệ thống tạo phiếu mới với mã dựa trên mã cũ.
3. Phiếu mới liên kết về phiếu cũ hoặc phiếu gốc để truy vết.
4. Sổ quỹ chỉ tính phiếu còn hiệu lực.

Ví dụ phiếu thu:

```text
PT000123      bản gốc
PT000123.01   sửa lần 1
PT000123.02   sửa lần 2
```

Ví dụ phiếu chi:

```text
PC000045      bản gốc
PC000045.01   sửa lần 1
PC000045.02   sửa lần 2
```

Phiếu đã bị hủy do sửa vẫn được giữ để kiểm tra, không xóa vật lý.

### BR-FIN-06: Phiếu sinh từ nghiệp vụ gốc không được sửa lệch nghiệp vụ gốc

Quy tắc sửa phiên bản áp dụng cho tất cả phiếu thu/chi, gồm cả phiếu sinh từ bán hàng hoặc thu nợ.

Tuy nhiên, phiếu sinh từ hóa đơn, thanh toán hoặc công nợ không được sửa rời để làm lệch chứng từ gốc.

Nếu muốn đổi số tiền thanh toán của hóa đơn hoặc thu nợ, phải đi qua luồng sửa/hủy nghiệp vụ gốc tương ứng để hóa đơn, công nợ và sổ quỹ cùng khớp.

### BR-FIN-07: Tìm phiếu theo mã không bị che bởi filter thời gian

Khi người dùng tìm đúng mã phiếu thu/chi, hệ thống phải tìm trên toàn bộ lịch sử hoặc tự mở rộng/bỏ bộ lọc thời gian hiện tại.

Không được trả empty state chỉ vì filter mặc định đang là tháng hiện tại.

### BR-FIN-07A: Hạch toán KQKD độc lập với ghi sổ quỹ

Một phiếu thu/chi có thể:

- có hạch toán kết quả kinh doanh
- không hạch toán kết quả kinh doanh

Cả hai loại đều làm thay đổi tồn quỹ nếu phiếu đang hiệu lực.

Báo cáo kinh doanh chỉ lấy các dòng có hạch toán theo rule báo cáo.

Ví dụ:

- tiền khách trả hóa đơn: thường không hạch toán lại trong sổ quỹ nếu doanh thu đã nằm ở hóa đơn
- chi vận chuyển/vật tư/lương: thường có hạch toán
- chuyển/rút giữa quỹ/tài khoản: không hạch toán kết quả kinh doanh

### BR-FIN-07B: Công nợ đối tác là filter riêng

Phiếu thu/chi có thể thuộc một trong ba nhóm công nợ:

- `affects_partner_debt`: tính vào công nợ đối tác
- `not_affect_partner_debt`: có đối tác nhưng không tính công nợ
- `no_partner_debt`: không có công nợ đối tác

MVP phải hiển thị/lọc được nhóm này trước khi làm báo cáo tài chính sâu.

### BR-FIN-07C: Chuyển/Rút không được làm lệch tổng tiền

`Chuyển/Rút` là nghiệp vụ điều chuyển giữa quỹ/tài khoản.

Khi làm đủ:

1. Dòng ra khỏi quỹ nguồn là phiếu chi.
2. Dòng vào quỹ đích là phiếu thu.
3. Hai dòng liên kết cùng một mã giao dịch điều chuyển.
4. Tổng quỹ toàn hệ thống không đổi, chỉ đổi vị trí tiền.

MVP có thể ghi thủ công hai phiếu nếu chưa có luồng điều chuyển riêng, nhưng plan hoàn chỉnh nên có transaction tạo cặp thu/chi để tránh lệch.

---

## 5. Thanh toán POS và sổ quỹ

### BR-FIN-08: Một lần thanh toán chỉ có tối đa một tài khoản chuyển khoản

Trong MVP, một lần thanh toán POS có thể gồm:

- chỉ tiền mặt
- chỉ chuyển khoản vào một tài khoản ngân hàng
- kết hợp tiền mặt và chuyển khoản vào một tài khoản ngân hàng

Không hỗ trợ một lần thanh toán chuyển vào nhiều tài khoản ngân hàng khác nhau.

Nếu có chuyển khoản, bắt buộc chọn tài khoản ngân hàng nhận tiền.

### BR-FIN-09: Sổ quỹ tách dòng theo tiền mặt và tài khoản ngân hàng

Khi thanh toán kết hợp tiền mặt và chuyển khoản, hệ thống ghi sổ quỹ thành các dòng riêng:

- phần tiền mặt vào quỹ tiền mặt
- phần chuyển khoản vào đúng tài khoản ngân hàng đã chọn

Ví dụ:

```text
Tổng thu: 1.000.000
Tiền mặt: 300.000
Chuyển khoản MB Bank: 700.000
```

Sổ quỹ ghi:

```text
+300.000 Quỹ tiền mặt
+700.000 MB Bank
```

### BR-FIN-10: Phiếu thu tự động phải truy vết phân bổ hóa đơn

Phiếu thu sinh từ checkout hoặc thu nợ phải hiển thị được:

- chứng từ gốc hoặc hóa đơn liên quan
- số tiền phiếu
- số đã thu trước nếu có
- số tiền thu phân bổ vào từng hóa đơn
- trạng thái hóa đơn sau phân bổ

Điều này giúp kiểm tra công nợ theo hóa đơn và đối soát sổ quỹ.

---

## 6. Acceptance Criteria nghiệp vụ

1. Mọi phiếu thu/chi phải gắn với một quỹ hoặc tài khoản.
2. Chuyển khoản bắt buộc chọn tài khoản ngân hàng.
3. Đối soát cuối ngày xem được theo tiền mặt và từng tài khoản ngân hàng.
4. Người có quyền tài chính tạo phiếu thu/chi thì phiếu được ghi sổ ngay, không qua duyệt nhiều bước.
5. Sửa phiếu tạo mã phiên bản mới dạng `MaCu.01`, không ghi đè phiếu cũ.
6. Phiếu cũ sau khi sửa chuyển trạng thái `cancelled` và không được tính vào số dư hiệu lực.
7. Phiếu sinh từ hóa đơn/công nợ không được sửa rời để làm lệch chứng từ gốc.
8. Một lần thanh toán POS chỉ được chọn tối đa một tài khoản ngân hàng cho phần chuyển khoản.
9. Tìm phiếu theo mã không bị filter thời gian mặc định che mất.
10. Phiếu thu tự động hiển thị được hóa đơn và phân bổ công nợ liên quan.
11. Có thể lọc theo có/không hạch toán KQKD.
12. Có thể lọc theo công nợ đối tác.
13. Phiếu thu/chi thủ công lưu được đối tượng nộp/nhận và số điện thoại nếu có.
14. Chuyển/rút giữa quỹ không làm thay đổi tổng quỹ toàn hệ thống khi làm theo luồng điều chuyển.

---

← [Quay về Finance README](./README.md)
