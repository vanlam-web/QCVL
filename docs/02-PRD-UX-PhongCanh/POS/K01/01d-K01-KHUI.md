# 01d-K01-KHUI — Khui vật tư thủ công

> **Phạm vi:** UX khui vật tư phụ, cuộn và tấm.
> **Trở về:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
> **Business:** [STOCK-RULES.md](../../../03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md)

---

## 1. Mục tiêu

Khui vật tư dùng khi nhân viên bắt đầu dùng một cuộn/tấm mới hoặc cần ghi nhận phần cũ còn lại.

Mục tiêu là vận hành nhanh và chuẩn hóa kho dần:

- mỗi lần khui chỉ xử lý **một vật tư**
- không bắt kiểm toàn bộ kho
- không bắt chọn lô/ngày mua nếu nhiều cuộn cùng loại/cùng khổ
- nếu chưa đủ dữ liệu vật lý thì vẫn cho ghi nhận từ tồn tạm
- phần cũ còn lại do hệ thống gợi ý, nhân viên được sửa theo thực tế

Vật tư phụ vẫn đi qua popup khui trong MVP khi sản phẩm có quy đổi đơn vị lớn sang đơn vị nhỏ. Ví dụ: `1 ram = 500 tờ`, `1 bao LED = 100 con`, `1 cuộn decal = n mét`. Khi khui, phần đang dùng dở/cũ được đưa về `0`, rồi ghi nhận lần khui mới.

---

## 2. Vị trí

Nút `Khui vật tư` có 2 nơi mở:

- **Top Bar:** mở thủ công khi nhân viên cần chuẩn hóa tồn hoặc chủ động khui vật tư.
- **Dòng hàng POS:** chỉ hiện khi dòng đang nhập kích thước/số lượng bị thiếu vật tư; dùng để khui nhanh đúng vật tư thiếu.
- **Module Kho:** nút `Khui vật tư` mở modal thủ công cho hàng `normal` có quy đổi đơn vị.

```text
[Tìm hàng...] [Hóa đơn 1] [+] [Khui vật tư] [Tiện ích...]
```

Tên nút trong UI không cần icon chai nếu làm giao diện quản trị gọn hơn; chỉ cần nhất quán với bộ icon chung.

Nút khui trên dòng chỉ là gợi ý, không phải bước bắt buộc. Nếu nhân viên không bấm, POS vẫn cho tiếp tục theo rule cảnh báo/tồn âm hiện tại và vẫn cho lưu báo giá.

Nếu nhân viên chưa biết cuộn/tấm thực tế trước checkout, không bắt buộc khui hoặc gán object tại POS. Dòng hàng sẽ được để trạng thái cần đối soát vật tư sau.

---

## 3. Luồng chung

```text
Chọn vật tư
-> hệ thống nhận dạng normal/roll/sheet
-> chọn khổ/kích thước cần khui
-> nhập phần cũ còn lại nếu có
-> xác nhận
-> ghi stock movement/log; riêng roll/sheet tạo hoặc cập nhật object vật lý
```

Không có bước chọn nhà cung cấp, ngày mua, số lô trong MVP.

Khui vật tư không tạo phiếu kiểm kho. Khui ghi `inventory_material_openings` và `stock_movements` để Thẻ kho truy vết được. Phiếu kiểm kho chỉ dùng cho kiểm/cân bằng kho hoặc sửa tồn trực tiếp ở Hàng hóa.

Trạng thái triển khai hiện tại cho hàng `normal`: backend ghi một movement âm để đưa phần cũ về `0` khi `old_remaining_qty > 0`, rồi ghi một movement dương cho lượng khui mới đã quy đổi về đơn vị tồn chính. Cả hai movement gắn `material_opening_id`, không tạo `stocktakes`.

UI hiện tại đã có:

- POS topbar: modal `Khui vật tư thủ công` cho hàng `normal` đang có trong danh sách POS hiện tải; chọn đơn vị khui, số lượng khui, phần cũ còn lại.
- POS dòng hàng: modal `Khui vật tư nhanh` khi preview thiếu vật tư `normal` có quy đổi đơn vị; có thể chọn một hoặc nhiều vật tư thiếu.
- Module Kho: modal khui thủ công cho `normal`, `roll`, `sheet`.

Chi tiết module Kho:

- `normal`: chọn vật tư, chọn đơn vị khui, nhập số lượng khui mới, nhập phần cũ còn lại và ghi chú.
- `roll`: chọn vật tư cuộn, nhập ID cuộn cũ và chiều dài cũ còn lại.
- `sheet`: chọn vật tư tấm, nhập ID tấm cũ; chọn bỏ phần tấm cũ hoặc nhập rộng/dài còn lại.

Roll/sheet UI hiện là MVP kỹ thuật vì `material-openings/options` chưa trả danh sách object cũ để chọn bằng dropdown. Phase sau cần trả `roll_options`/`sheet_options` có `id`, `code`, kích thước còn lại để người dùng không phải nhập ID thủ công và để POS topbar dùng cùng trải nghiệm chọn object như module Kho.

---

## 3.1. Khui nhanh từ dòng POS

Khi POS tính toán thấy dòng hàng thiếu vật tư, nút `Khui vật tư` hiện ngay trên dòng đó.

| Tình huống | Hành vi |
|---|---|
| Thiếu một vật tư | Popup mở sẵn vật tư đó |
| Thiếu nhiều vật tư | Popup hiện danh sách vật tư thiếu; nhân viên chọn một hoặc nhiều vật tư cần khui |
| Dòng là combo/BOM | Danh sách thiếu lấy từ vật tư thành phần sau khi tính BOM/snapshot của dòng |
| Dòng chỉ là báo giá | Vẫn chỉ cảnh báo và hiện nút khui; không bắt buộc khui |
| Nhân viên bỏ qua | Không thay đổi dữ liệu dòng; checkout/báo giá tiếp tục theo rule tồn âm/cảnh báo |
| Chưa biết cuộn/tấm khi bán | Dòng được lưu và cần đối soát sau, không chặn thanh toán |

Sau khi xác nhận khui, POS quay lại đúng dòng hàng vừa mở popup, giữ dữ liệu đã nhập và kiểm tra tồn/cảnh báo lại.

Khui nhanh không tự sửa BOM, không tự lưu combo mới và không đổi giá bán. Nếu cần sửa cấu trúc combo, nhân viên dùng luồng `Sửa BOM` riêng.

---

## 4. Khui vật tư phụ

Áp dụng cho hàng `normal` có nhiều đơn vị hoặc có quy đổi bao bì: ram giấy ra tờ, bao LED ra con, hộp/bao vật tư ra đơn vị nhỏ.

Không áp dụng cho hàng `normal` chỉ bán nguyên đơn vị và không có quy đổi mở bao bì, ví dụ standee bán cái hoặc dịch vụ không quản lý tồn.

### 4.1. Trường nhập

| Trường | Quy tắc |
|---|---|
| Vật tư | Chỉ chọn sản phẩm `inventory_shape = normal` và có cấu hình quy đổi đơn vị |
| Số lượng khui mới | Theo đơn vị lớn hoặc đơn vị nhỏ đang cấu hình, ví dụ `1 bao`, `1 ram`, `1 cuộn` |
| Phần dở/cũ còn lại | MVP mặc định `0` |
| Ghi chú | Nên nhập khi bỏ phần cũ do hỏng, khô, rơi vãi hoặc không dùng tiếp |

### 4.2. Quy tắc xử lý

- Khi khui vật tư phụ, phần dở/cũ về `0`.
- Số lượng khui mới được quy đổi về đơn vị tồn chính để ghi nhận tồn.
- Hệ thống ghi log thao tác khui, lý do nếu có, và movement đưa phần cũ về `0` khi phần cũ đang còn số lượng hệ thống.
- Hệ thống ghi thêm movement dương cho lượng khui mới; `stock_movement_id` trong response trỏ về movement dương này.
- Không tạo cuộn/tấm vật lý cho vật tư phụ.
- Nếu tồn không đủ, chỉ cảnh báo nhẹ theo rule tồn âm, vẫn cho ghi nhận nếu người dùng có quyền.

---

## 5. Khui cuộn

### 5.1. Trường nhập

| Trường | Quy tắc |
|---|---|
| Vật tư | Chỉ chọn sản phẩm `inventory_shape = roll` |
| Khổ rộng | Dropdown từ cấu hình sản phẩm / cuộn đã nhập; ví dụ `1.6m`, `2.2m`, `3.2m` |
| Cuộn mới | Mặc định khui `1` cuộn cùng loại/cùng khổ |
| Dài cuộn mới | Tự điền từ dữ liệu nhập vật tư/phiếu nhập nếu có; cho sửa nếu cần |
| Cuộn cũ còn lại | Hệ thống gợi ý, nhân viên được sửa |
| Ghi chú | Không bắt buộc, nhưng nên nhập khi số thực tế khác số hệ thống |

### 5.2. Gợi ý `cuộn cũ còn lại`

| Tình huống | Giá trị mặc định |
|---|---|
| Cuộn cũ đã chuẩn hóa | Chiều dài còn lại hệ thống đang tính |
| Cuộn cũ chưa chuẩn hóa | `0` |
| Nhân viên biết còn dùng được | Nhập số mét còn lại |
| Còn ít, bỏ luôn | Nhập `0` |

Nhập `0` nghĩa là phần cũ hết hoặc bỏ, không tạo object còn dùng.

Nhập lớn hơn `0` nghĩa là phần cũ còn dùng được. Hệ thống giữ lại để sau này gợi ý khổ/cắt và phân tích hao hụt.

Nếu chênh lệch giữa hệ thống và thực tế lớn, vẫn cho lưu nhưng phải ghi log giá trị cũ/mới.

### 5.3. Nguồn cuộn mới

Nếu đã có object cuộn `available` cùng vật tư/khổ:

- chọn khui 1 cuộn bất kỳ cùng loại/cùng khổ
- không bắt nhân viên chọn đúng lô/ngày mua
- backend chọn object phù hợp theo quy tắc đơn giản, ví dụ cuộn chưa dùng cũ nhất

Nếu chưa có object cuộn nhưng còn tồn tạm KiotViet:

- cho khui từ tồn tạm
- tạo object cuộn chuẩn hóa mới theo khổ/dài đã nhập
- giảm phần tồn tạm tương ứng nếu backend đã có cơ chế tách tồn tạm
- nếu chưa có cơ chế giảm tồn tạm, ghi log chuẩn hóa để đối soát, không bịa thêm cuộn khác

---

## 6. Khui tấm

### 6.1. Trường nhập

| Trường | Quy tắc |
|---|---|
| Vật tư | Chỉ chọn sản phẩm `inventory_shape = sheet` |
| Khổ thao tác | Mặc định theo cấu hình, ví dụ `1.2m x 2.4m` |
| Số tấm khui | MVP mặc định `1` |
| Phần tấm cũ còn lại | Có thể nhập kích thước nếu còn dùng |
| Ghi chú | Nên nhập khi bỏ phần cũ hoặc kích thước thực tế khác hệ thống |

QC-OMS dùng khổ thao tác để nhập bán, tính tiền, tính phần còn lại và gợi ý vật tư. Khổ thật như `1.22m x 2.44m` chỉ là thông tin tham khảo nếu có.

### 6.2. Phần tấm cũ còn lại

Nếu phần cũ còn dùng được, nhân viên nhập kích thước thực tế. Ví dụ:

```text
1.2m x 1.9m
0.5m x 0.5m
```

Nếu phần cũ còn quá nhỏ hoặc bỏ đi, nhân viên chọn bỏ phần cũ.

Ngưỡng gợi ý:

- phần còn lại dạng mét tới dưới `0.2m` thì hệ thống đề xuất bỏ
- rẻo nhỏ dưới ngưỡng cấu hình thì hệ thống đề xuất bỏ
- không bỏ âm thầm; nhân viên có thể giữ lại nếu thực tế còn dùng được

---

## 7. Kết quả sau khi xác nhận

### Vật tư phụ

- phần dở/cũ được ghi nhận về `0`
- lần khui mới được ghi log theo vật tư, số lượng, người thao tác và ghi chú
- không tạo dữ liệu cuộn/tấm

### Cuộn

- cuộn mới chuyển sang trạng thái đang dùng / available theo cách backend đang quản lý
- cuộn cũ được cập nhật còn lại hoặc kết thúc
- ghi stock movement/log cho thao tác khui và phần chênh lệch nếu có

### Tấm

- tấm mới hoặc tấm đang dùng được ghi nhận
- phần tấm cũ còn dùng được tạo/cập nhật thành tấm lỡ/tấm dở
- phần bị bỏ ghi log, không tạo dữ liệu rác

### Tồn tạm

Nếu thao tác khui dùng dữ liệu tồn tạm KiotViet, UI phải hiển thị rõ:

```text
Đang chuẩn hóa từ tồn tạm KiotViet
```

Không hiển thị như thể toàn bộ kho đã chuẩn hóa.

---

## 8. Lỗi và cảnh báo

| Tình huống | Hành vi |
|---|---|
| Chưa chọn vật tư | Không cho xác nhận |
| Vật tư không thuộc nhóm khui | Gợi ý dùng điều chỉnh tồn |
| Khổ/kích thước thiếu | Không cho xác nhận |
| Số mét hoặc kích thước <= 0 | Báo lỗi ngay tại ô nhập |
| Không còn object chuẩn hóa để khui | Cho khui từ tồn tạm nếu còn tồn tạm; nếu không có thì cảnh báo thiếu tồn |
| Thiếu tồn hoặc tồn âm | Cảnh báo nhẹ, vẫn cho ghi nhận nếu Owner cho tồn âm theo rule kho |

---

## 9. Không làm trong MVP

- Không chọn lô/ngày mua/nhà cung cấp khi khui.
- Không bắt quản lý mã từng cuộn/tấm trên UI.
- Không tự tối ưu cắt nhiều bước trong popup khui.
- Không tính báo cáo hao hụt đầy đủ ngay trong popup.
- Không dùng khui vật tư để sửa giá vốn kế toán.

---

## 10. Acceptance Criteria

1. Khui vật tư phụ đưa phần dở/cũ về `0` và ghi log.
2. Khui cuộn chỉ cần chọn vật tư, khổ, dài cuộn mới và phần cũ còn lại.
3. Nếu cuộn cũ đã chuẩn hóa, UI gợi ý số còn lại nhưng cho sửa.
4. Nếu cuộn cũ chưa chuẩn hóa, UI mặc định phần cũ còn lại là `0`.
5. Nhập phần cũ còn lại lớn hơn `0` giữ lại object để dùng tiếp.
6. Nhập `0` kết thúc/bỏ phần cũ, không tạo object rác.
7. Khui tấm dùng khổ thao tác như `1.2m x 2.4m`.
8. Rẻo nhỏ hoặc phần m tới dưới `0.2m` chỉ được đề xuất bỏ, không bị bỏ âm thầm.
9. Tất cả thao tác khui ghi log tối thiểu: ai, lúc nào, vật tư, khổ/kích thước, giá trị cũ/mới nếu có.
10. Khi mở khui từ dòng POS, popup prefill vật tư thiếu nếu chỉ thiếu một vật tư.
11. Khi một dòng thiếu nhiều vật tư, popup cho chọn một hoặc nhiều vật tư để khui trong cùng lần xử lý.
12. Không bấm `Khui vật tư` thì hệ thống không tự khui và không chặn lưu báo giá.

---

← [Quay về K01 Top Bar](./01-K01-TOPBAR.md)
