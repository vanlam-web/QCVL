# STOCK-RULES — Chính sách tồn kho và trừ kho

> **Phạm vi:** Business rule cho tồn kho MVP, hàng thường, hàng cuộn, hàng tấm, tấm lỡ và thời điểm trừ kho

---

## 1. Mục tiêu

Tài liệu này chốt cách QC-OMS quản lý tồn kho ở mức nghiệp vụ:

- khi nào tồn kho bị trừ
- có cho tồn âm hay không
- phân biệt hàng thường, hàng cuộn và hàng tấm
- cách tự động tạo tấm lỡ
- quan hệ giữa tồn kho chính thức và dữ liệu máy sản xuất

---

## 2. Phân loại hình dạng tồn kho

### BR-INV-01: Inventory shape

Mỗi sản phẩm/vật tư có một nhóm hình dạng tồn kho:

| `inventory_shape` | Ý nghĩa | Ví dụ |
|---|---|---|
| `normal` | Hàng thường, không cần quản lý theo đối tượng vật lý riêng | giấy ram/tờ, keo, mực, linh kiện |
| `roll` | Vật tư dạng cuộn, cần quản lý từng cuộn nhập kho | bạt, decal, PP, canvas |
| `sheet` | Vật tư dạng tấm, cần quản lý tấm nguyên/tấm dở/tấm lỡ | alu, fomex, mica, PVC, tấm nhựa |

Tổng tồn của `roll` và `sheet` chỉ là số tổng hợp từ các đối tượng vật lý bên dưới, không phải con số được sửa trực tiếp.

### BR-INV-01B: Import KiotViet ban đầu là tồn tạm

Khi chuyển dữ liệu ban đầu từ KiotViet, QC-OMS được phép import toàn bộ tồn kho hiện có dưới dạng tồn tạm/provisional để hệ thống vận hành sớm.

Lý do: KiotViet đang quản lý nhiều hàng cuộn/tấm bằng tổng số lượng hoặc tổng m2, chưa biết chính xác trong kho còn bao nhiêu cuộn, cuộn nào còn bao nhiêu mét tới, hoặc tấm/tấm lỡ nào đang tồn.

Quy tắc:

- Tồn import từ KiotViet phải được đánh dấu nguồn `kiotviet_import` hoặc trạng thái tương đương để biết đây là dữ liệu chuyển đổi ban đầu.
- Với hàng `normal`, tồn tạm có thể dùng như tồn chính sau khi kiểm tra.
- Với hàng `roll` và `sheet`, tồn tạm chỉ là số tổng tham khảo để bán/đối soát ban đầu, chưa thay thế quản lý vật lý theo từng cuộn/tấm.
- Sau này khi kiểm kho, nhập lại số cuộn/tấm thật hoặc dùng luồng khui vật tư, hệ thống sẽ chuẩn hóa dần tồn tạm thành cuộn/tấm vật lý.
- Không bắt buộc chuẩn hóa toàn bộ kho trong một lần trước khi dùng phần mềm.

Ví dụ với hàng cuộn:

```text
Import KV: Bạt 3.2m còn 128m2 tạm
Sau kiểm kho/khui vật tư: tạo cuộn R001 còn khoảng 20m tới, R002 còn khoảng 18m tới
Khi khui/xuất tiếp: trừ vào R001/R002 để dần đưa tồn tạm về đúng tồn vật lý
```

Nếu dữ liệu thực tế chưa đủ để tạo cuộn/tấm ngay, hệ thống vẫn giữ tồn tạm và hiển thị cảnh báo "chưa chuẩn hóa tồn vật lý".

### BR-INV-01C: Chuẩn hóa tồn kho diễn ra dần

QC-OMS không ép xưởng kiểm toàn bộ kho trước khi dùng phần mềm.

Quy tắc chuyển đổi:

- Hiện tại có thể tiếp tục quản lý tồn cuộn/tấm theo tổng m2 như KiotViet để vận hành sớm.
- Không bịa danh sách cuộn/tấm từ tổng m2 nếu dữ liệu thực tế chưa có.
- Một mặt hàng có thể vừa có phần tồn tạm m2, vừa có một số cuộn/tấm đã chuẩn hóa.
- Trang kho phải phân biệt được `tồn tạm m2` và `tồn vật lý đã chuẩn hóa`.
- Kiểm kho/sửa tồn có thể chuẩn hóa từng mặt hàng, từng cuộn hoặc từng tấm; không cần kiểm toàn bộ mặt hàng hoặc toàn bộ kho.
- Khui vật tư là một cách chuẩn hóa dần: khi bắt đầu dùng cuộn/tấm mới, nhân viên ghi nhận phần cũ còn lại nếu biết.

Ví dụ:

```text
Bạt 3.2 đang có 120m2 tạm từ KiotViet.
Sau vài lần khui/kiểm kho, hệ thống biết thêm 1 cuộn 3.2m còn 18m dài.
UI hiển thị tổng tồn kèm nguồn: tồn tạm + tồn đã chuẩn hóa.
```

---

## 3. Thời điểm trừ kho

### BR-INV-02: Mốc trừ kho MVP

Trong MVP, khi đơn bán được tạo/lưu chính thức và có dòng hàng cần trừ kho, hệ thống ghi nhận bút toán kho ngay tại thời điểm đó.

Mục tiêu là giữ thao tác đơn giản:

```text
Tạo/lưu đơn bán chính thức -> ghi stock movement -> cập nhật tồn kho
```

Không tách sổ kho thành hai lớp `dự kiến` và `thực tế` trong MVP.

### BR-INV-03: Không dùng dữ liệu máy sản xuất để tự trừ kho MVP

Dữ liệu máy sản xuất không tự sinh bút toán kho trong MVP.

Nếu máy sản xuất chạy khác với bill/đơn, phần lệch chỉ thể hiện trong báo cáo đối soát, không tự sửa tồn kho.

Sau MVP, nếu có quy trình match file máy sản xuất với bill đủ chắc, sẽ mở spec riêng để thay đổi thời điểm trừ kho.

### BR-INV-03B: Combo / BOM — trừ thành phần, không trừ mã combo

SoT (Owner 2026-07-20) — cùng [BOM-RULES.md](../BOM/BOM-RULES.md). **Hiện trạng code:** [BOM README mục 2](../BOM/README.md) (Postgres POS chưa khớp đủ).

- Combo (`product_kind = combo`, thường `track_inventory = false`) **không** trừ tồn theo mã combo khi bán.
- Chỉ tạo stock movement cho **hàng thành phần**.
- BOM KV mục tiêu: `active`, dùng ngay; không sản xuất sẵn.
- Nhập hàng / kiểm kho trên hàng tồn thật — không nhập/kiểm tồn theo mã combo như SKU tồn.

---

## 4. Tồn âm

### BR-INV-04: Cảnh báo thiếu tồn nhưng vẫn cho bán

Khi bán hàng mà tồn không đủ, hệ thống cảnh báo nhưng vẫn cho bán tiếp.

Hệ quả:

- stock movement có thể làm tồn kho âm
- trang Hàng hóa/Kho phải có filter để xem hàng tồn âm
- tồn âm là tín hiệu cần xử lý sau, không khóa quy trình bán hàng
- POS không hiển thị modal chặn hoặc cảnh báo lớn; chỉ cảnh báo nhẹ bằng màu đỏ/trạng thái trên sản phẩm hoặc dòng hàng đang thiếu/âm kho

---

## 5. Hàng thường

### BR-INV-05: Hàng thường quản lý theo tồn chính

Hàng `normal` được quản lý theo một đơn vị tồn chính.

Khi bán bằng đơn vị phụ, hệ thống quy đổi về đơn vị tồn chính để trừ kho.

Ví dụ:

```text
1 ram giấy = 500 tờ
```

Nếu tồn chính là `ram`, bán `tờ` sẽ quy đổi số tờ về ram để ghi stock movement.

### BR-INV-05B: Khui hàng normal có quy đổi đơn vị

Hàng `normal` được phép đi qua popup khui khi có quy đổi từ đơn vị lớn sang đơn vị nhỏ hoặc đơn vị dùng thực tế.

Ví dụ:

```text
1 ram giấy = 500 tờ
1 bao LED = 100 con
1 cuộn decal = n mét
```

Hàng `normal` không có quy đổi mở bao bì, hoặc là dịch vụ không quản lý tồn, không cần hiện trong popup khui.

Quy tắc MVP:

- Khui hàng `normal` không tạo cuộn/tấm vật lý.
- Phần đang dùng dở/cũ được đưa về `0`.
- Số lượng khui mới quy đổi về đơn vị tồn chính theo `product_unit_conversions`.
- Thao tác phải ghi log: ai khui, vật tư nào, số lượng khui mới nếu có, lý do/ghi chú nếu có.
- Nếu tồn không đủ hoặc tồn âm, hệ thống chỉ cảnh báo nhẹ theo rule tồn âm, không chặn.

---

## 6. Hàng dạng cuộn

### BR-INV-06: Cuộn là đối tượng tồn kho vật lý

Vật tư dạng cuộn không được quản lý bằng một tổng `m2` gộp như KiotViet.

Mục tiêu dài hạn là mỗi cuộn nhập kho được quản lý như một đối tượng tồn kho vật lý riêng. Trong giai đoạn chuyển đổi, nếu dữ liệu KiotViet chỉ có tổng m2 thì QC-OMS vẫn giữ tồn tạm và chuẩn hóa dần bằng kiểm kho/khui vật tư.

Mỗi cuộn cần biết tối thiểu:

- sản phẩm/vật tư
- khổ rộng
- chiều dài ban đầu
- diện tích ban đầu nếu cần tính nhanh
- chiều dài còn lại
- diện tích còn lại
- trạng thái: còn dùng, hết, hủy/lỗi nếu cần

Trong giai đoạn sau import KiotViet, nhân viên có thể cập nhật lại:

- số cuộn thật đang có
- mã/nhãn cuộn nếu cần
- khổ rộng
- chiều dài còn lại ước lượng theo mét tới
- ghi chú nguồn kiểm kho/khui vật tư

Các giá trị ước lượng được chấp nhận ở giai đoạn chuẩn hóa ban đầu, miễn là có lịch sử sửa để đối soát sau.

### BR-INV-06B: Khui cuộn theo hướng đơn giản

Một lần khui chỉ áp dụng cho một vật tư.

Ví dụ với bạt:

```text
Chọn Bạt -> chọn khổ -> khui 1 cuộn cùng loại/khổ
```

Thông tin cuộn mới như khổ và chiều dài mặc định lấy từ dữ liệu nhập vật tư/nhập hàng. Thao tác khui không bắt nhân viên nhập lại nhà cung cấp, ngày mua, lô hoặc giá vốn.

Nếu trong kho còn nhiều cuộn cùng loại/cùng khổ, không cần phân biệt lô/ngày mua trong thao tác khui. Chọn khui 1 cuộn cùng loại/khổ là đủ để vận hành nhanh.

Khi khui, UI có ô `cuộn cũ còn lại`:

- Nếu cuộn cũ đã được chuẩn hóa, hệ thống điền sẵn chiều dài còn lại theo tính toán.
- Nhân viên được sửa theo thực tế.
- Nếu cuộn cũ chưa chuẩn hóa, giá trị mặc định là `0`; nhân viên có thể sửa nếu biết còn bao nhiêu.
- Nhập `0` nghĩa là phần cũ hết hoặc bỏ, không dùng lại.
- Nhập lớn hơn `0` nghĩa là phần cũ còn dùng được và được giữ lại để gợi ý khổ sau này.

Chênh lệch giữa số hệ thống và số thực tế khi khui là dữ liệu phục vụ phân tích hao hụt sau này; MVP chỉ cần lưu vết, chưa cần báo cáo hao hụt đầy đủ.

Nếu chưa có object cuộn chuẩn hóa nhưng mặt hàng còn tồn tạm KiotViet, hệ thống được phép khui từ tồn tạm:

- UI phải báo rõ đây là thao tác chuẩn hóa từ tồn tạm.
- Không bịa danh sách cuộn/tấm khác từ tổng m2.
- Nếu backend đã có cơ chế tách tồn tạm, giảm phần tồn tạm tương ứng với object mới tạo.
- Nếu chưa có cơ chế tách tồn tạm, lưu log chuẩn hóa để đối soát sau, không làm mất dấu nguồn dữ liệu.

### BR-INV-07: Đề xuất cuộn/khổ khi xuất vật tư cuộn

Khi xuất vật tư dạng cuộn, nhân viên là người chọn cuộn bị trừ.

Hệ thống phải có đề xuất mặc định theo công thức tối ưu hao hụt:

1. Lọc các cuộn có khổ đủ để in/cắt kích thước tiêu hao.
2. Trong các cuộn đủ khổ, ưu tiên phương án hao hụt ngang ít nhất.
3. Nếu nhiều cuộn cùng hao hụt, ưu tiên cuộn đang dùng dở/đã khui trước.
4. Nếu vẫn bằng nhau, ưu tiên cuộn có chiều dài còn lại phù hợp để giảm mảnh lẻ.

Nhân viên được sửa đề xuất:

- chọn khổ/cuộn khác
- giảm hoặc tăng biên chừa
- chọn phương án không tối ưu nếu thực tế sản xuất cần

Khi nhân viên override, hệ thống lưu snapshot đề xuất và lựa chọn thực tế.

---

## 7. Hàng dạng tấm

### BR-INV-08: Tấm quản lý theo tấm nguyên và tấm lỡ

Hàng `sheet` được quản lý theo:

- tấm nguyên
- phần tấm còn lại theo m tới
- tấm rẻo lớn/tấm thừa còn dùng được

Không sửa tổng tồn trực tiếp cho hàng dạng tấm.

QC-OMS dùng khổ thao tác đơn giản để tính bán/trừ tồn, ví dụ `1.2m x 2.4m`. Khổ thật như `1.22m x 2.44m` có thể lưu tham khảo sau này, nhưng UI bán hàng và tồn kho trước mắt dùng khổ thao tác để tránh rườm rà.

### BR-INV-09: Tự động tạo tấm lỡ

Hệ thống hỗ trợ tính phần thừa tự động, nhưng không tự bỏ âm thầm. Nhân viên luôn có thể sửa kết quả nếu thực tế cắt khác.

Quy tắc mặc định:

1. Khi đơn hàng cắt/bán làm tồn đến hàng `sheet`, hệ thống tính phần tiêu hao theo kích thước và biên cắt hao đã áp dụng.
2. Hệ thống đề xuất phương án tiết kiệm vật tư nhất: ưu tiên tấm/rẻo vừa kích thước trước, rồi mới tới tấm nguyên.
3. Nhân viên được đổi nhanh sang phương án dễ thao tác hơn, ví dụ dùng tấm nguyên trước nếu tấm rẻo nằm khó lấy.
4. Sau khi trừ phần tiêu hao, hệ thống tính phần còn lại theo công thức chuẩn và hiển thị kích thước đã tính.
5. Nhân viên được sửa kích thước phần còn lại nếu thực tế khác.
6. Với phần tấm còn lại dạng m tới, nếu chiều dài còn lại dưới `0.2m` thì hệ thống đề xuất bỏ như rẻo nhỏ.
7. Với rẻo nhỏ, hệ thống hiển thị checkbox `Bỏ rẻo nhỏ`, mặc định được chọn nếu cạnh nhỏ nhất dưới ngưỡng cấu hình.
8. Nếu nhân viên bỏ tick, rẻo được giữ lại với kích thước đang hiển thị hoặc sau khi sửa.
9. Nếu nhân viên giữ `Bỏ rẻo nhỏ`, phần đó xem như bỏ/hết và không tạo tấm lỡ dùng lại.
10. MVP chỉ lưu các phần thừa còn dùng được, tránh tạo nhiều mảnh rác.

Mỗi tấm lỡ cần lưu:

- sản phẩm/vật tư
- kích thước dài/rộng
- diện tích
- nguồn gốc từ đơn/dòng hàng nếu có
- trạng thái: `available`, `used`, `discarded`

Nhân viên có thể sửa hoặc xóa tấm lỡ sau khi hệ thống tạo.

Mọi thao tác sửa/xóa tấm lỡ phải có log tối thiểu: ai sửa, lúc nào, giá trị cũ/mới, lý do nếu có.

Nếu nhân viên giữ lại mảnh mà hệ thống đề xuất bỏ, hệ thống tạo tấm lỡ và ghi log liên kết với thao tác nguồn nếu xác định được.

---

## 8. Hàng ngưng bán còn tồn

### BR-INV-10: Inactive product vẫn xử lý kho được

Sản phẩm ngưng bán:

- không được tìm thấy trong POS bán hàng
- vẫn hiển thị trong trang Hàng hóa/Kho qua bộ lọc trạng thái
- vẫn hiển thị trong báo cáo tồn kho
- vẫn được phép xử lý kho như điều chỉnh, kiểm kho, xuất hủy hoặc chuyển đổi nếu người dùng có quyền

---

## 9. Acceptance Criteria

- Bán thiếu tồn hiển thị cảnh báo nhưng vẫn cho tiếp tục.
- Tạo/lưu đơn bán chính thức có dòng cần trừ kho tạo stock movement.
- Dữ liệu máy sản xuất không tự tạo stock movement trong MVP.
- Combo có BOM: **SoT** bán chỉ trừ thành phần; không trừ mã combo; không sản xuất sẵn (Owner 2026-07-20). **Runtime chưa khớp đủ** — [BOM README mục 2](../BOM/README.md).
- Import tồn KiotViet ban đầu được phép là tồn tạm, nhưng hàng cuộn/tấm phải có trạng thái/chỉ dấu chưa chuẩn hóa vật lý.
- Hàng `normal` cho sửa tổng tồn.
- Hàng `roll` không cho sửa tổng tồn, phải sửa theo từng cuộn.
- Hàng `sheet` không cho sửa tổng tồn, phải sửa theo tấm nguyên/tấm lỡ/tấm dở.
- Tấm rẻo nhỏ theo ngưỡng cạnh nhỏ nhất không tự tạo nếu nhân viên giữ tùy chọn bỏ rẻo.
- Rẻo nhỏ không bị bỏ âm thầm; hệ thống đề xuất bỏ bằng checkbox và nhân viên có thể giữ lại.
- Phần m tới còn dưới `0.2m` được đề xuất bỏ như rẻo nhỏ.
- Khui hàng `normal` có quy đổi đơn vị đưa phần dở/cũ về `0`, không tạo object cuộn/tấm.
