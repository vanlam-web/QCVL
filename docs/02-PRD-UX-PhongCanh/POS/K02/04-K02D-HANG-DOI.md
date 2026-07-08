# 04-K02D-HANG-DOI.md — K02-D: HÀNG ĐỢI MÁY SẢN XUẤT

> **Phần:** 2.1
> **Trở về:** [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

## 0. Phạm vi đã chốt

K02-D là hàng đợi thông báo từ máy sản xuất vào POS để nhân viên tạo hoặc bổ sung hóa đơn nháp.

Ranh giới quan trọng:

- Bấm `[+]` chỉ đưa dữ liệu vào hóa đơn nháp.
- Hóa đơn nháp chưa trừ kho, chưa ghi tiền, chưa tạo doanh thu và chưa tạo công nợ.
- Kho chỉ trừ khi nhân viên chốt/lưu hóa đơn chính thức ở POS.
- Dữ liệu máy sản xuất dùng thêm cho đối soát giữa OMS/bill và thực tế máy chạy, không tự sửa tồn kho.

---

## I. GIAO DIỆN

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🖨️ IN BẠT (x)    │    🖨️ IN DECAL (x)    │    ✂️ CẮT CNC (x)                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```


| Block    | Icon | Màu nền    | Badge `(x)`      |
| -------- | ---- | ---------- | ---------------- |
| IN BẠT   | 🖨️  | Xanh dương | Số file đang đợi |
| IN DECAL | 🖨️  | Xanh lá    | Số file đang đợi |
| CẮT CNC  | ✂️   | Đỏ / Cam   | Số file đang đợi |


- Nằm dưới đáy K02, thay cho thanh điều hướng cũ
- Danh sách block máy là cấu hình động theo máy sản xuất đang được bật trong hệ thống; `IN BẠT`, `IN DECAL`, `CẮT CNC` là ví dụ mặc định.
- Badge `(x)` = số thông báo đang chờ của máy đó, bao gồm cả thông báo lỗi cần sửa, cập nhật realtime; chi tiết cơ chế dữ liệu để phát triển sau
- Nếu một máy mất kết nối hoặc không nhận được tín hiệu realtime, block máy hiển thị chấm vàng nhỏ để thu ngân biết trạng thái cần chú ý.

---

## II. LUỒNG TƯƠNG TÁC

```
Click Khối máy có badge > 0
  → Xổ danh sách tên file chờ
      → Rê chuột vào 1 dòng
          → Bấm [+] hoặc [🗑]

Ctrl + Click Khối máy
  → Xổ lịch sử thông báo đã xử lý của máy đó

Nhấn giữ Khối máy
  → Xổ lịch sử thông báo đã xử lý của máy đó
```

**Mô tả chi tiết từng bước:**

1. **Click vào block** (VD: `🖨️ IN BẠT`) → Mở danh sách file đang chờ của máy in bạt. Nếu badge là `(0)`, không mở danh sách.
   - `Ctrl + Click` vào block máy → Mở lịch sử thông báo đã xử lý của máy đó, hiển thị dạng danh sách xổ lên giống danh sách hàng đợi.
   - Trên màn cảm ứng hoặc khi không tiện dùng bàn phím, nhấn giữ block máy 2 giây để mở lịch sử.
   - Click nhanh vẫn mở danh sách hàng đợi như bình thường.
   - Nếu trong lúc nhấn giữ mà tay/chuột di chuyển khỏi block, hủy thao tác mở lịch sử.
2. **Danh sách chỉ hiển thị tên file gốc** từ máy in/máy cắt kèm thời gian nhận, sắp xếp mới nhất ở trên, ví dụ:
   - `TTP_2D_120x50_x5` — `14:32`
   - `ABC_120x80` — `14:25`
   - `TTP_2D_200x100_x2_cat-gap` — `14:10`
   - Nếu có nhiều thông báo trùng tên file, vẫn hiển thị thành nhiều dòng riêng.
   - Nếu tên file quá dài, hiển thị rút gọn trên 1 dòng bằng dấu `...`; khi rê chuột hoặc chọn dòng thì xem được tên đầy đủ.

Quy chuẩn sắp xếp mặc định cho toàn hệ thống sẽ được đặc tả sau; trong phạm vi K02-D hiện tại, danh sách thông báo máy sản xuất mặc định sắp xếp theo thời điểm nhận mới nhất ở trên.

Thời gian nhận chỉ để thu ngân phân biệt thông báo mới/cũ, không đưa vào hóa đơn nháp và không ảnh hưởng tính tiền.
3. **Rê chuột vào 1 dòng** → Hiển thị 2 icon thao tác trên cùng dòng
   - `[+]` — thêm vào hóa đơn nháp phù hợp
   - `[🗑]` — bỏ thông báo
4. **Hành động:**
  - `[🗑]` → Bỏ thông báo khỏi hàng đợi, không ảnh hưởng hóa đơn/kho/tiền/sản xuất
  - `[+]` → Lúc này hệ thống mới parse tên file và thêm vào hóa đơn nháp phù hợp

Không có màn xem chi tiết đơn, không preview thông số, không bung dữ liệu đã parse trước khi thu ngân bấm `[+]`.

**Đóng danh sách xổ lên:**

- Danh sách hàng đợi và lịch sử đều xổ lên phía trên block máy.
- Hiển thị tối đa 8 dòng; nếu nhiều hơn thì cuộn nội bộ trong danh sách.
- Cuộn danh sách không làm kéo/trượt toàn bộ màn hình POS.
- Bấm ra ngoài danh sách → đóng.
- Nhấn `Esc` → đóng.
- Sau khi bấm `[+]`, `[🗑]`, hoặc `[↩]` thành công, danh sách đang mở vẫn giữ mở; chỉ dòng vừa xử lý biến mất hoặc cập nhật để thu ngân xử lý tiếp các dòng khác.

**Quy tắc UI nhỏ:**

- Tên file nằm bên trái, thời gian nằm nhỏ bên phải, icon `[+] [🗑]` nằm sát phải và chỉ hiện khi rê chuột vào dòng.
- Dòng lỗi kích thước có màu cam/đỏ nhẹ nhưng không nhấp nháy.
- Dòng vừa khôi phục có màu nền vàng nhạt trong vài giây, sau đó trở về bình thường.
- Nếu xử lý hết tất cả dòng trong danh sách đang mở, danh sách vẫn mở và hiển thị `Không còn thông báo`.
- Nếu mở lịch sử nhưng chưa có dữ liệu, hiển thị `Chưa có lịch sử`.
- Tooltip icon:
  - `[+]`: `Thêm vào hóa đơn nháp`
  - `[🗑]`: `Bỏ thông báo`
  - `[↩]`: `Khôi phục về hàng đợi`
- Không dùng màu làm tín hiệu duy nhất; lỗi, khôi phục hoặc trạng thái đặc biệt phải có text hoặc icon đi kèm.
- Định dạng thời gian: trong ngày hiển thị `HH:mm`, khác ngày hiển thị `dd/MM HH:mm`.
- Không có phân trang số; danh sách chỉ cuộn.
- Không có ô tìm kiếm/lọc trong hàng đợi hoặc lịch sử K02-D ở phạm vi hiện tại.
- Click vào tên file chỉ chọn dòng/hiện icon thao tác, không mở màn chi tiết.
- Không cho sửa trực tiếp tên file gốc; chỉ sửa các trường lỗi được hệ thống cho phép, hiện tại là kích thước.

---

## III. QUY TẮC NHẬP THÔNG BÁO VÀO HÓA ĐƠN NHÁP

### 3.1. Format tên file

Máy in/máy cắt gửi thông báo theo format:

```
KH_[HH_]daixrong(_xSL)?(_ghichu)?
```

Ví dụ:

```
TTP_2D_120x50_x5
TTP_2D_120x50_x5_in-gap
TTP_120x50_x5
ABC_120x80
```

### 3.2. Quy tắc parse

| Thành phần | Ý nghĩa | Quy tắc |
|---|---|---|
| `KH` | Mã khách hàng | Bắt buộc. Chỉ khách hàng thuộc nhóm được phép nhận thông báo máy sản xuất mới hiển thị trong K02-D. Nếu `KH` không hợp lệ hoặc không thuộc nhóm được phép thì bỏ qua âm thầm, không hiển thị cảnh báo cho thu ngân. |
| `HH` | Mã hàng hóa | Nếu có thì phải là mã hàng hóa chính thức và thuộc nhóm hàng được phép nhận thông báo máy sản xuất. Nếu `HH` không hợp lệ hoặc không thuộc nhóm được phép thì bỏ qua âm thầm. Nếu thiếu thì dùng hàng hóa mặc định của máy đó. |
| `daixrong` | Kích thước | Bắt buộc. Ví dụ `120x50` hiểu là 120cm x 50cm và khi nhập hóa đơn nháp sẽ quy đổi thành 1.2m x 0.5m. |
| `xsl` | Số lượng | Không bắt buộc. Nếu có thì viết theo định dạng `_xSL`, ví dụ `_x5` = số lượng 5. Số lượng là số nguyên. Nếu thiếu thì mặc định 1. |
| `ghichu` | Ghi chú máy | Không bắt buộc. Chỉ dành cho nhân viên in/cắt, bỏ hoàn toàn khi đưa lên hóa đơn nháp. |

Danh sách/nhóm khách hàng được phép nhận thông báo từ máy sản xuất thuộc module Khách hàng hoặc Backend và sẽ được đặc tả sau. Cơ chế cấu hình có thể là danh sách khách hàng riêng hoặc cờ bật/tắt trên khách hàng; trong phạm vi POS hiện tại chỉ kiểm tra kết quả cấu hình này, chưa đặc tả màn hình/quy trình cấu hình khách hàng.

Danh sách/nhóm hàng hóa được phép nhận thông báo từ máy sản xuất và hàng hóa mặc định theo từng máy sẽ được đặc tả sau, dự kiến thuộc trang/module Danh mục hàng hóa. Mỗi máy sản xuất bắt buộc phải được cấu hình 1 hàng hóa mặc định. Trong phạm vi POS hiện tại, nếu thiếu `HH` thì dùng kết quả cấu hình hàng hóa mặc định của máy.

Máy in/máy cắt trong phạm vi K02-D luôn tạo thông báo cho hàng tính theo m², không có trường hợp hàng tính theo cái.

Quy tắc parse phần tùy chọn:

```
KH_[HH_]daixrong(_xSL)?(_ghichu)?
```

- Hệ thống nhận diện `daixrong` bằng đoạn đầu tiên có định dạng `sốx số`, ví dụ `120x50`.
- Nếu có một đoạn trước `daixrong` sau `KH` thì đoạn đó là `HH`.
- Nếu không có đoạn nào trước `daixrong` sau `KH` thì xem như thiếu `HH` và dùng hàng hóa mặc định của máy.
- Mã hàng hóa không được đặt theo định dạng kích thước `sốx số`, ví dụ không đặt mã hàng là `120x50`.
- `_xSL` có thể có hoặc không; nếu không có thì số lượng mặc định là 1.
- `_xSL` chỉ được nhận là số lượng khi đúng định dạng `_x` + số nguyên, ví dụ `_x5`.
- Nếu phần sau `daixrong` giống số lượng nhưng sai định dạng hoặc không phải số nguyên hợp lệ, hệ thống xem phần đó là `ghichu`; số lượng mặc định là 1.
- `_ghichu` là toàn bộ phần còn lại sau `daixrong` hoặc sau `_xSL`.
- Khi bấm `[+]`, `ghichu` bị bỏ hoàn toàn: không đưa vào ghi chú đơn, không đưa vào ghi chú dòng hàng, không ảnh hưởng tính tiền.

Nếu thiếu `daixrong` hoặc sai định dạng kích thước (ví dụ `120-50`, `abcx50`, `120x`):

- Dòng thông báo vẫn hiển thị trong danh sách K02-D.
- Hệ thống nhắc ngay dưới dòng file: `Kích thước sai, sửa theo dạng 120x50`.
- Nhân viên có quyền sử dụng POS được sửa giá trị kích thước dùng để nhập vào hóa đơn nháp.
- Chỉ khi kích thước đã hợp lệ mới cho bấm `[+]`.
- `[🗑]` vẫn dùng được nếu nhân viên không muốn xử lý thông báo đó.
- Không sửa ngược tên file gốc từ máy sản xuất; tên file gốc được giữ để đối chiếu.
- Nếu mở tầng lưu trữ/DB cho hàng đợi, có thể lưu cả tên file gốc và giá trị đã sửa. Cơ chế lưu này nằm ngoài phạm vi POS hiện tại.

Tạm thời chưa đặc tả Database cho luồng này: không tạo bảng mới, không chốt schema hàng đợi, không chốt schema cấu hình khách hàng/hàng hóa được phép.

### 3.3. Khi bấm `[+]`

- Nếu khách có 1 hóa đơn nháp → thêm dòng vào nháp đó.
- Nếu khách chưa có hóa đơn nháp → tự tạo nháp mới cho khách, tên tab theo số nhỏ nhất đang trống (`Hóa đơn 1`, `Hóa đơn 2`, ...).
- Nếu khách có nhiều hóa đơn nháp → mở popup/drawer nhỏ để thu ngân chọn nháp cần thêm vào.
  - Danh sách hiển thị các nháp của khách đó, ví dụ `Hóa đơn 2`, `Hóa đơn 5`, hoặc nháp sửa đơn dạng `HDxxxx.stt` sau này.
  - Có nút `[+]` ngắn gọn để tạo nháp mới cho khách nếu thu ngân không muốn thêm vào nháp hiện có.
- Sau khi nhập thành công → thông báo biến mất khỏi hàng đợi trên **tất cả máy POS** và không được dùng lại.
- Thông báo không phải hóa đơn thật, không trừ kho, không ghi tiền, không tạo doanh thu.
- Nếu sau đó nháp được chốt thành hóa đơn, việc trừ kho đi theo hóa đơn đã lưu, không đi theo thời điểm máy gửi thông báo.
- Không cần hiện toast thành công; dòng thông báo biến mất là phản hồi chính.

### 3.4. Khi bấm `[🗑]`

- `[🗑]` chỉ bỏ thông báo khỏi hàng đợi, không ảnh hưởng hóa đơn/kho/tiền/sản xuất.
- Sau khi hủy thành công → thông báo biến mất khỏi hàng đợi trên **tất cả máy POS**.
- Không cần hiện toast thành công; dòng thông báo biến mất âm thầm.
- Thông báo đã hủy được đưa vào lịch sử của máy tương ứng. Từ lịch sử, thu ngân có thể khôi phục để đưa thông báo về trạng thái chờ và xử lý lại bằng `[+]`.

### 3.5. Xử lý khi nhiều máy bấm cùng lúc

- Cùng một thông báo chỉ được xử lý **một lần duy nhất**.
- Nếu 2 máy POS cùng bấm `[+]` hoặc `[🗑]` gần như cùng lúc:
  - Máy xử lý thành công trước sẽ nhận kết quả thành công.
  - Máy còn lại thấy nhắc nhở: `Thông báo đã được xử lý bởi máy khác` và không được nhập/hủy lại.
- Không được tạo trùng dòng hóa đơn nháp từ cùng một thông báo máy sản xuất.
- Nếu nhiều thông báo khác nhau có cùng tên file, thu ngân quyết định xử lý từng dòng; POS không tự gộp và không tự loại trùng theo tên file.

---

## IV. LỊCH SỬ THÔNG BÁO ĐÃ XỬ LÝ

Mỗi block máy có lịch sử riêng và tất cả máy POS đều xem được lịch sử này.

Lịch sử dùng để xem lại các thông báo của máy đó đã được xử lý trong 10 ngày gần nhất.

Mở lịch sử bằng `Ctrl + Click` hoặc nhấn giữ block máy 2 giây. Lịch sử xổ lên cùng kiểu hiển thị với danh sách hàng đợi thông báo máy sản xuất.

| Trạng thái | Ý nghĩa |
|---|---|
| `Đã thêm` | Thông báo đã được đưa vào hóa đơn nháp bằng `[+]`. |
| `Đã hủy` | Thông báo đã bị bỏ khỏi hàng đợi bằng `[🗑]`. |
| `Đã khôi phục` | Thông báo đã được khôi phục từ lịch sử về hàng đợi chờ bằng `[↩]`. |

Quy tắc hiển thị:

- Lịch sử hiển thị theo từng block máy sản xuất, không gộp chung các máy sản xuất.
- Tất cả máy POS đều xem được cùng một lịch sử của từng block máy sản xuất.
- Mặc định hiển thị khoảng 10 kết quả mới nhất.
- Cuộn xuống để tải/hiển thị thêm kết quả cũ hơn.
- Mặc định mỗi dòng lịch sử chỉ hiển thị tên file, thời gian và trạng thái.
- Khi rê chuột vào một dòng lịch sử, hiển thị thêm máy POS và user đã xử lý dòng đó.
- Dòng `Đã hủy` hiển thị icon khôi phục `[↩]` khi rê chuột.
- Dòng `Đã thêm` không hiển thị icon khôi phục.
- Lịch sử chỉ lưu/hiển thị trong 10 ngày gần nhất, tính theo thời gian nhận thông báo; cơ chế lưu trữ cụ thể thuộc tầng Database/Backend và chưa đặc tả tại đây.

Quy tắc khôi phục:

- Chỉ trạng thái `Đã hủy` được phép khôi phục.
- User có quyền sử dụng POS được phép khôi phục thông báo `Đã hủy`.
- Bấm `[↩]` khôi phục ngay, không cần popup xác nhận, vì thao tác chỉ đưa thông báo về hàng đợi chờ.
- Khi khôi phục, thông báo quay lại hàng đợi chờ của máy tương ứng trên **tất cả máy POS** và có thể xử lý lại bằng `[+]` hoặc `[🗑]`.
- Thông báo vừa khôi phục được đưa lên đầu danh sách chờ và có màu/trạng thái nổi bật hơn để thu ngân biết đây là dòng vừa khôi phục.
- Khi khôi phục thành công, lịch sử ghi thêm trạng thái `Đã khôi phục`.
- Nếu thông báo khôi phục tiếp tục được `[+]` hoặc `[🗑]`, lịch sử ghi thêm một bản ghi mới để giữ vết xử lý.
- Trạng thái `Đã thêm` không được khôi phục để tránh tạo trùng dòng hóa đơn nháp.

---

## V. TRẠNG THÁI REALTIME

| Trạng thái block  | Mô tả                                                |
| ----------------- | ---------------------------------------------------- |
| **Bình thường**   | Hiển thị số badge `(x)`                              |
| **Có file mới**   | Nhấp nháy nhẹ (Pulse animation), không phát âm thanh |
| **Không có file** | Badge hiển thị `(0)`, không nhấp nháy                |


> Hàng đợi cập nhật realtime — không cần reload thủ công. Chi tiết cơ chế dữ liệu thuộc tầng Database/Backend và chưa đặc tả trong phạm vi POS hiện tại.

---

## VI. LƯU Ý VỀ CẢNH BÁO KHUI ĐỘNG

> **Lưu ý về cảnh báo khui động (`[⚠️ 🍾 Khui cuộn mới]` / `[⚠️ 🍾 Khui tấm mới]`):**
> Icon động này hiển thị tại dòng file trong K02-D khi cuộn dở / tấm lỡ không đủ cho lệnh in/CNC.
> Chi tiết trigger và xử lý xem [01d-K01-KHUI.md](../K01/01d-K01-KHUI.md) và [02c-K02A-M2-KHUI.md §3](./02c-K02A-M2-KHUI.md#3-canh-bao-thieu-vat-tu-va-goi-y-khui).

---

← [Quay về K02 Tổng quan](./01-K02-GIO-HANG.md)
