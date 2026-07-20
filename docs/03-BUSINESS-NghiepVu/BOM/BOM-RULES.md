# BOM-RULES — Định mức vật tư, combo và trừ kho nhiều cấp

> **Vai trò:** Source of Truth nghiệp vụ.
> **Tham khảo:** PRD POS K02-A, export KiotViet `Hàng thành phần`
> **Quyết định Owner 2026-07-01:** Có BOM nhiều cấp; có thể sửa BOM; POS có thể dùng BOM phát sinh để trừ kho hoặc lưu thành combo mới
> **Quyết định Owner 2026-07-20 (chốt lại):** BOM từ KiotViet dùng ngay khi bán; không nháp/duyệt lại; không sản xuất sẵn; bán combo chỉ trừ hàng thành phần

---

## 1. Mục tiêu

BOM giúp QC-OMS biết một sản phẩm/combo cần tiêu hao những vật tư nào khi bán hàng.

Ví dụ:

```text
In bạt = bạt + mực in + keo dán + khuy bạt
Khung sắt bắn bạt = In bạt + khung sắt
Khung sắt bắn bạt + tôn = Khung sắt bắn bạt + tôn
```

BOM có thể lồng nhiều cấp, nhưng thao tác POS phải giữ gọn. Nhân viên không bị ép khai báo toàn bộ cấu trúc nếu đang cần bán nhanh.

---

## 2. BOM không phải công thức giá bán

### BR-BOM-01: Giá bán độc lập với BOM

Giá bán của combo/sản phẩm vẫn theo:

- bảng giá
- nhóm khách
- giá nhân viên sửa trên dòng bán
- lịch sử giá theo khách + sản phẩm nếu có

BOM chỉ tạo định mức vật tư và dữ liệu giá vốn/chi phí tham khảo. Không tự ép giá bán bằng tổng giá vật tư.

### BR-BOM-02: Tổng chi phí BOM chỉ là tham khảo nếu hiển thị

Nếu UI hiển thị tổng chi phí vật tư theo BOM, đó là số tham khảo quản trị, không phải lợi nhuận kế toán chuẩn khi Purchase/phương pháp giá vốn chưa đầy đủ.

---

## 3. Loại BOM

### BR-BOM-03: BOM chuẩn trên sản phẩm/combo

Sản phẩm/combo có thể có BOM hiện hành để dùng lại nhiều lần.

Mỗi lần sửa BOM chuẩn phải tạo version mới. Chứng từ cũ vẫn giữ snapshot/version đã dùng tại thời điểm bán.

### BR-BOM-04: BOM phát sinh trên dòng POS

Trong POS, nhân viên có thể thêm/sửa BOM cho riêng một dòng bán.

Có 2 chế độ:

| Chế độ | Quy tắc |
|---|---|
| Không lưu - Chỉ trừ kho | Mặc định. BOM chỉ lưu trong snapshot chứng từ và dùng để trừ kho cho hóa đơn hiện tại |
| Lưu Combo mới | Tạo sản phẩm/combo mới kèm BOM chuẩn để lần sau chọn lại |

Không tự tạo combo mới nếu nhân viên không chọn `Lưu Combo mới`.

---

## 4. BOM nhiều cấp

### BR-BOM-05: Thành phần BOM có thể là vật tư hoặc sản phẩm có BOM con

Một dòng BOM có thể tham chiếu:

- vật tư lá cuối cùng
- sản phẩm/combo khác có BOM

Khi checkout, hệ thống deep-scan để quy đổi về vật tư lá cuối cùng trước khi tạo stock movement.

Khi một combo cha chứa combo con:

- dòng BOM của combo cha lưu combo con như một thành phần tham chiếu
- chứng từ lưu lại combo con và BOM version/snapshot của combo con tại thời điểm bán
- với chế độ `Không lưu - Chỉ trừ kho`, combo con dùng BOM chuẩn đang active tại thời điểm chốt đơn
- với chế độ `Lưu Combo mới`, combo mới vẫn giữ combo con là thành phần tham chiếu, không tự bung phẳng thành vật tư lá
- chứng từ cũ không đổi khi BOM của combo con bị sửa sau này

### BR-BOM-06: Chống vòng lặp và giới hạn độ sâu

Hệ thống phải chặn vòng lặp BOM, ví dụ:

```text
A -> B -> A
```

Độ sâu mặc định tối đa: 5 cấp. Nếu vượt quá, backend báo lỗi cấu hình BOM để người dùng sửa.

Nếu checkout/deep-scan gặp vòng lặp hoặc vượt quá 5 cấp, hệ thống chặn phần trừ kho BOM và báo lỗi cấu hình. Hệ thống không được tự đoán, không được âm thầm bỏ nhánh lỗi.

### BR-BOM-07: POS chỉ chỉnh cấp đang mở

Để thao tác gọn:

- Combo cấp 1 trong dòng POS được mở khoang sửa BOM.
- Combo con lồng bên trong hiển thị phẳng như một dòng thành phần, chỉ sửa số lượng.
- Không bắt nhân viên mở sâu nhiều cấp ngay trong POS.

Backend vẫn deep-scan khi chốt hóa đơn nếu phase BOM đã có đủ DB/API.

---

## 5. Trừ kho theo BOM

### BR-BOM-08: Có BOM thì trừ theo BOM

Khi hóa đơn được chốt:

```text
Dòng combo/sản phẩm có BOM
  -> lấy BOM snapshot/version của dòng
  -> deep-scan nếu có BOM lồng
  -> quy đổi ra vật tư lá
  -> tạo stock movement theo từng vật tư
```

Vật tư `normal`, `roll`, `sheet` vẫn trừ theo rule Inventory tương ứng. BOM không được trừ tổng `m2` gộp nếu vật tư là cuộn/tấm vật lý.

**Owner 2026-07-20:** Combo không tính tồn kho riêng. Khi bán combo, hệ thống **chỉ trừ hàng thành phần** theo định mức; **không** trừ tồn theo chính mã combo. Không dùng phiếu sản xuất sẵn trong phạm vi quyết định này.

Nếu combo con thiếu vật tư, hệ thống xử lý như thiếu vật tư của một hàng thường: cảnh báo theo vật tư thành phần, cho đi tiếp theo rule tồn âm/cảnh báo, và hiện gợi ý `Khui vật tư` nếu vật tư thiếu có thể khui.

### BR-BOM-09: Thiếu BOM không chặn bán trong MVP

Nếu sản phẩm được bán như combo nhưng chưa có BOM, hệ thống cho checkout và flag/cảnh báo để quản lý bổ sung sau.

Thông điệp gợi ý:

```text
Sản phẩm này chưa có BOM để trừ vật tư con. Hóa đơn vẫn được lưu; vui lòng kiểm tra tồn kho hoặc bổ sung BOM sau.
```

### BR-BOM-10: Tồn âm vật tư vẫn theo rule Inventory

Nếu BOM làm vật tư thành phần âm tồn, hệ thống cảnh báo nhưng vẫn cho tiếp tục theo nguyên tắc tồn âm MVP đã chốt.

Cảnh báo nên chỉ rõ vật tư nào thiếu để nhân viên biết cần kiểm tra hoặc khui vật tư.

Nếu thiếu vật tư phát sinh khi đang thao tác trong POS, hệ thống có thể hiện nút `Khui vật tư` ngay trên dòng hàng. Nút này chỉ mở luồng Inventory để khui vật tư thiếu; không tự sửa BOM, không tự lưu combo mới và không bắt buộc dùng. Nếu một dòng thiếu nhiều vật tư, nhân viên được chọn một hoặc nhiều vật tư cần khui. Nếu bỏ qua, chứng từ vẫn đi tiếp theo rule cảnh báo/tồn âm.

---

## 6. Snapshot chứng từ

### BR-BOM-11: Hóa đơn phải lưu snapshot BOM đã dùng

Mỗi dòng hóa đơn có BOM phải lưu tối thiểu:

- BOM source: chuẩn hay phát sinh trên dòng POS
- BOM version nếu dùng BOM chuẩn
- danh sách thành phần tại thời điểm bán
- số lượng/định mức đã nhân theo số lượng dòng bán
- kích thước/diện tích/mét tới nếu thành phần cần tính theo cấu trúc
- lựa chọn vật lý nếu đã chọn cuộn/tấm cụ thể

Mục tiêu: sửa BOM chuẩn sau này không làm thay đổi hóa đơn cũ.

---

## 7. Import từ KiotViet

Export KiotViet có cột `Hàng thành phần` dạng text, ví dụ:

```text
DCS:0.6|F5:0.3
```

QC-OMS parse cột này thành `product_bom_items`. Không dùng text gốc làm schema chính.

### Quyết định Owner 2026-07-20 (thay quyết định nháp cũ)

- Import `Hàng thành phần` xong → BOM **đang dùng ngay** (`active`), không còn “nháp chờ duyệt”.
- **Không** bắt quản lý duyệt/kích hoạt lại trước khi trừ kho.
- Khi bán combo có BOM import từ KV → trừ thành phần theo định mức đã import.
- Nếu thiếu mã thành phần trong catalog lúc import → bỏ qua BOM đó (ghi skipped), không tạo BOM nửa vời.
- Import lại cùng mã hàng → archive BOM KiotViet cũ của mã đó, tạo version mới và đặt `active`.

> Ghi chú lịch sử: trước 2026-07-20, doc cũ yêu cầu import vào `draft` rồi rà soát mới `active`. Quyết định đó **đã bị thay**.

---

## 8. Acceptance Criteria

- BOM chuẩn có version; sửa BOM tạo version mới.
- POS có thể dùng BOM phát sinh ở chế độ `Không lưu - Chỉ trừ kho`.
- POS có thể lưu BOM phát sinh thành combo mới khi người dùng chọn rõ.
- Hóa đơn lưu snapshot BOM đã dùng.
- Backend chặn vòng lặp BOM.
- Backend giới hạn deep-scan mặc định tối đa 5 cấp.
- BOM thiếu cấu hình không chặn checkout trong MVP, nhưng phải có cảnh báo/flag.
- BOM không tự tính hoặc ép giá bán.
- Vật tư cuộn/tấm trong BOM trừ kho theo tồn vật lý, không trừ tổng `m2`.
- BOM import từ KiotViet ở trạng thái dùng ngay; bán combo chỉ trừ thành phần, không trừ mã combo; không yêu cầu duyệt lại và không yêu cầu sản xuất sẵn.