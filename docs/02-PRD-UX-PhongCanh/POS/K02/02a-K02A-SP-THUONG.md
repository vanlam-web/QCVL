# 02a-K02A-SP-THUONG.md — K02-A: 3 TRƯỜNG HỢP HIỂN THỊ DÒNG SẢN PHẨM

> **Thuộc khối:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) — Phần II
>
> **Trở về:** [02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)

---

Khi một mặt hàng được chọn vào giỏ, cấu trúc giao diện ngoài của dòng hàng đó phải lập tức thay đổi để hiển thị đúng 1 trong 3 trường hợp sau.

---

## TRƯỜNG HỢP 1: HÀNG THƯỜNG KHÔNG TÍNH DIỆN TÍCH (ĐVT khác m²)

**Áp dụng:** Các sản phẩm bán lẻ, đếm chiếc, hoặc vật tư phụ tính theo cái/bộ/cuộn.

*Ví dụ:* Standee chữ X, Chân cuốn, Cuộn băng keo, Nguồn 12V...

**Wireframe:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ [X] | 01 | Standee A2 Chữ X      | [  1  ] | 80,000 | 80,000         │
│         • [Ghi chú quy cách...]                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Giao diện hiển thị ngoài:**

- **Ẩn hoàn toàn** các trường `[Dài]`, `[Rộng]` và ô diện tích.
- Chỉ hiển thị duy nhất 1 ô nhập liệu: `[ Số lượng ]`.
- Nếu sản phẩm có đơn vị bán phụ trong `unit_conversions`, cột `ĐV` hiển thị dropdown để chọn đơn vị bán; nếu không có quy đổi thì hiển thị ĐVT cố định. Khi F5/reload hoặc mở lại tab nháp, POS hydrate lại dòng hàng từ catalog hiện tại để lấy `unit_conversions` mới nhất, không dùng snapshot đơn vị cũ trong localStorage.
- **Hành vi:** Con trỏ tự động focus vào ô `[SL]` khi dòng vừa nhảy ra.

**Cấu trúc cột:**


| Ô              | Vai trò           | Mặc định |
| -------------- | ----------------- | -------- |
| `[X]`          | Nút xóa dòng      | —        |
| `STT`          | Số thứ tự tự động | —        |
| `Tên sản phẩm` | Tên + Mã hàng     | —        |
| `[SL]`         | Số lượng          | `1`      |
| `Đơn giá`      | Lấy từ bảng giá   | —        |
| `Thành tiền`   | `SL × Đơn giá`    | —        |

**Quy tắc giá trên dòng:**

- Đơn giá mặc định lấy theo bảng giá đang áp dụng của khách hàng; nếu khách không gán nhóm/bảng giá thì dùng Giá chung.
- Thu ngân được sửa đơn giá trực tiếp trên dòng hàng.
- Dòng đã sửa giá thủ công phải có dấu hiệu nhận biết để khi đổi khách hoặc đổi bảng giá không bị tự tính đè.
- Có nút nhỏ cạnh ô đơn giá để mở danh sách **5 giá gần đây** của đúng cặp khách hàng + sản phẩm.
- Danh sách giá gần đây chỉ là gợi ý chọn nhanh; giá mặc định của dòng mới vẫn luôn lấy từ bảng giá hiện hành.
- Ô **Đơn giá** trên dòng giỏ hàng phải đủ rộng cho số tiền có dấu cách phân nhóm nghìn, ví dụ `600 000`; khi focus không được cắt hoặc che mất chữ số cuối cùng.
- Ô tiền trên dòng giỏ hàng căn phải, không hiển thị nút tăng/giảm số của trình duyệt, và giữ padding phải đủ để viền focus không đè lên số.

**Quy tắc cộng dồn:** Nếu sản phẩm **đã có** trong giỏ, chọn lại sẽ **tự cộng +1** vào SL dòng cũ.

**Công thức:**

```
Thành tiền = Số lượng × Đơn giá
```

---

## TRƯỜNG HỢP 2: HÀNG CÓ ĐƠN VỊ TÍNH LÀ MÉT VUÔNG (m²)

**Áp dụng:** Các mặt hàng in ấn quảng cáo sản xuất theo kích thước tùy biến.

*Ví dụ:* In bạt Hiflex, In Decal ngoài trời, In Canvas, PP cán mờ...

**Wireframe:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [X] | 01 | In bạt Hiflex 480g    | [1.2] × [2.5] × [2] = 6.0 m² | 40,000/m² | 240,000    │
│         • [Ghi chú quy cách...]                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Giao diện hiển thị ngoài:**

- Mở rộng dòng và hiển thị rõ bộ 3 ô nhập thông số độc lập: `[ Rộng ] × [ Dài ] × [ Số lượng ]`.
- Hiển thị chuỗi kết quả Realtime ngay kế bên: `= [ Tổng số m² ] [ĐV]`.
- Nếu sản phẩm m² có đơn vị bán phụ trong `unit_conversions`, phần `[ĐV]` là dropdown chọn đơn vị bán; đổi ĐV không đổi công thức tính diện tích, chỉ đổi đơn vị hiển thị/lưu khi chốt hóa đơn. Tab nháp khôi phục sau F5 vẫn lấy danh sách đơn vị từ catalog hiện tại.
- **Hành vi:** Con trỏ tự động focus vào ô `[Rộng (m)]` khi dòng vừa nhảy ra.

**Cấu trúc cột:**


| Ô              | Vai trò                        | Mặc định |
| -------------- | ------------------------------ | -------- |
| `[X]`          | Nút xóa dòng                   | —        |
| `STT`          | Số thứ tự tự động              | —        |
| `Tên sản phẩm` | Tên + Mã hàng                  | —        |
| `[Rộng (m)]`   | Chiều rộng (mét)               | `1`      |
| `[Dài (m)]`    | Chiều dài (mét)                | `1`      |
| `[SL (Tấm)]`   | Số tấm                         | `1`      |
| `Tổng m²`      | Máy tự tính: `R × D × SL`      | `1.0`    |
| `Đơn giá`      | Lấy từ bảng giá (hiển thị /m²) | —        |
| `Thành tiền`   | `Tổng m² × Đơn giá`            | —        |

**Quy tắc giá trên dòng:**

- Đơn giá mặc định lấy theo bảng giá đang áp dụng của khách hàng; nếu khách không gán nhóm/bảng giá thì dùng Giá chung.
- Thu ngân được sửa đơn giá trực tiếp trên dòng hàng.
- Dòng đã sửa giá thủ công phải có dấu hiệu nhận biết để khi đổi khách hoặc đổi bảng giá không bị tự tính đè.
- Có nút nhỏ cạnh ô đơn giá để mở danh sách **5 giá gần đây** của đúng cặp khách hàng + sản phẩm.
- Danh sách giá gần đây chỉ là gợi ý chọn nhanh; giá mặc định của dòng mới vẫn luôn lấy từ bảng giá hiện hành.

> **Quy tắc:** Ô `[Tổng m²]` là **chỉ đọc (khóa chết)**. Không cho phép gõ đè thủ công để tránh thợ tính nhầm sai lệch với kích thước file in.

> **Quy tắc cộng dồn:** Sản phẩm m² **không cộng dồn**. Mỗi lần chọn lại luôn tạo một dòng mới độc lập để giữ nguyên thông tin kích thước từng tấm/bức in.

**Công thức:**

```
Thành tiền = (Rộng × Dài × Số lượng) × Đơn giá
```

---

## TRƯỜNG HỢP 3: HÀNG COMBO / ĐỊNH MỨC VẬT TƯ (BOM)

> **Ranh giới MVP:** BOM được thêm/sửa trong POS là định mức của dòng combo đó. Chọn `Không lưu — Chỉ trừ kho` thì vẫn trừ kho theo BOM này nhưng không tạo combo mới; chọn `Lưu Combo mới` thì lưu thành combo mới trong danh mục. Combo lồng nhau/deep-scan nhiều cấp để sau phase BOM.

**Áp dụng:** Cụm thành phẩm gia công phức tạp — Biển bảng quảng cáo, Standee in UV, Bảng điện...

Khi dòng hàng là Combo, giao diện ngoài xuất hiện thêm nút **[🛠️ Sửa BOM]** và cụm nút chuyển đổi trạng thái.

**Wireframe cơ bản:**

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [X] | 01 | Biển Alu PNJ Hưng Đạo  | [3] | 450,000 | 450,000    [🛠️ Sửa BOM]           │
│         • [Ghi chú quy cách...]                                                        │
│         ──── (BUNG RỘNG KHI CLICK SỬA BOM) ────                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Kịch bản A: Chọn Combo ĐÃ CÓ SẴN trong danh mục

**Hành vi:** Thu ngân click chọn một mặt hàng Combo từ danh mục.

**Giao diện hiển thị:**

- Dòng hiển thị tên Combo gốc (VD: "Biển Alu 1m² PNJ Hưng Đạo").
- Bên cạnh hiển thị nút **[🛠️ Sửa BOM]**.

**Khi click [🛠️ Sửa BOM]:**

- Bung rộng khoang cấu hình mini phía dưới dòng.
- Cho phép thay đổi nhanh số lượng vật tư phụ cho riêng đơn hàng này.
*Ví dụ:* Tăng số mét led, đổi loại nguồn, thêm keo chết...

**Wireframe — Bung rộng [🛠️ Sửa BOM] (Kịch bản A):**

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▼ [X] | 01 | Biển Alu PNJ Hưng Đạo  | [1] | 450,000 | 450,000    [🔒 Đóng BOM]                        │
│         ──── BOM CỦA COMBO ────                                                                       │
│         Combo gốc: "Biển Alu 1m² PNJ Hưng Đạo" (chỉ đọc)                                              │
│         ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│         │ 🔩 VẬT TƯ CHÍNH (BOM Core)                                              [Ẩn/Hiện]  │        │
│         │  [Tấm Alu 1m² PNJ   ]  [1.0 m²] [±] [1] tấm ──→ trừ: 1.0 m² Alu    [✏️]            │       │
│         │  [Thanh nẹp viền 2.5m] [2.5 m  ] [±] [1] cây ──→ trừ: 2.5 m nẹp    [✏️]            │       │
│         │  [Trụ đỡ Inox       ] [1 bộ  ] [±] [1] bộ  ──→ trừ: 1 bộ trụ      [✏️]             │       │
│         │                                                                                    │        │
│         │ 🔧 VẬT TƯ PHỤ (Accessories)                                 [+ Thêm vật tư phụ]    │      │
│         │  [Keo trung thủy    ] [1 chai] [±] [1] ──→ trừ: 1 chai keo          [✏️]           │      │
│         │  [Vít Inox M4      ] [8 con ] [±] [8] ──→ trừ: 8 con              [✏️]            │       │
│         │  [Nguồn 12V 5A     ] [1 cái] [±] [1] ──→ trừ: 1 cái               [✏️]            │       │
│         │  [Led dán 12V 1m   ] [2 mét ] [±] [2] ──→ trừ: 2 m led             [✏️]           │       │
│         └────────────────────────────────────────────────────────────────────────────────────┘      │
│         📦 Tổng vật tư: Alu 1.0m² | Nẹp 2.5m | Nguồn 1 cái | Led 2m | ...                          │
│         💰 Tổng giá vật tư kho: 125,000đ  (chi phí gốc = tổng ĐG vật tư × SL)                      │
│         ──── CƠ CHẾ LƯU ────                                                                        │
│         (•) Không lưu — Chỉ trừ kho      ( ) Lưu Combo mới: [ Nhập tên biến thể... ]                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Cấu trúc BOM mini khi Bung rộng:**


| Thành phần                   | Mô tả                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Tên Combo gốc**            | Hiển thị chỉ đọc — tên từ danh mục                                                                                                     |
| **Vật tư chính (BOM Core)**  | Danh sách vật tư gốc — `[±]` chỉnh số lượng từng dòng, mỗi dòng hiển thị số lượng trừ kho tương ứng                                    |
| **Vật tư phụ (Accessories)** | Danh sách phụ kiện — `[+ Thêm vật tư phụ]` → bộ lọc khóa cứng chỉ hiện nhóm: Keo, Vít, Led, Nguồn...                                   |
| **💰 Tổng giá vật tư kho**   | Máy tự tính realtime = tổng (Đơn giá vật tư × SL từng dòng). Hiển thị chi phí gốc để thu ngân đối chiếu biên lợi nhuận ngay trên dòng. |
| **Checkbox trừ kho**         | `(•) Không lưu — Chỉ trừ kho`                                                                                                          |


**Cơ chế lưu — Kịch bản A:**


| Tùy chọn                                 | Hành vi                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `[Không lưu — Chỉ trừ kho]` *(Mặc định)* | Lưu snapshot cấu trúc BOM trong chứng từ và dùng BOM này để trừ kho cho hóa đơn đó. Không làm ảnh hưởng định mức chuẩn của mã Combo gốc trong danh mục. |
| `[Lưu Combo mới]`                        | Lưu cấu trúc BOM đang chỉnh thành một mã Combo mới trong danh mục để lần sau chọn lại.                                      |


---

### Kịch bản B: Tạo COMBO MỚI HOÀN TOÀN từ đầu

**Hành vi kích hoạt:** Thu ngân click chọn một mặt hàng hệ thống định danh mặc định tên là **"COMBO"** (Mã hàng trống ban đầu).

**Giao diện hiển thị ban đầu:**

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ [X] | 01 | COMBO (mới)    | [  1  ] |   —    |    —     |     [🛠️ Sửa BOM]                │
│         ──── BOM ĐANG TRỐNG — NHẬP TỪ ĐẦU ────                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Wireframe — Bung rộng khi click [🛠️ Sửa BOM] (Kịch bản B):**

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▼ [X] | 01 | COMBO (mới)   | [ 1 ] |   —    |   —      |     [🔒 Đóng BOM]                             │
│         ──── TẠO COMBO MỚI TỪ ĐẦU ────                                                                 │
│         Tên Combo: [ Biển Alu PNJ Trần Hưng Đạo                              ]                         │
│         ┌────────────────────────────────────────────────────────────────────────────────────┐         │
│         │ 🔩 VẬT TƯ CHÍNH (BOM Core)                                          [+ Thêm vật tư]│         │
│         │  (trống — chưa có vật tư nào)                                                      │         │
│         │   → Click [+ Thêm vật tư] → mở popup chọn vật tư chính từ danh mục                 │        │
│         │                                                                                    │        │
│         │  [Tấm Alu 1m² PNJ   ] [1.0 m²] [±] [1] tấm ──→ trừ: 1.0 m² Alu   [🗑️] │           │         │
│         │  [Thanh nẹp viền 2.5m] [2.5 m  ] [±] [1] cây ──→ trừ: 2.5 m nẹp   [🗑️] │          │         │
│         │                                                                                    │        │
│         │ 🔧 VẬT TƯ PHỤ (Accessories)                                 [+ Thêm vật tư phụ]   │         │
│         │  (trống — chưa có vật tư phụ nào)                                                  │        │
│         │   → Click [+ Thêm vật tư phụ] → bộ lọc khóa cứng: Keo, Vít, Led, Nguồn...         │         │
│         │                                                                                    │        │
│         │  [Keo trung thủy    ] [1 chai] [±] [1] ──→ trừ: 1 chai keo          [🗑️] │        │        │
│         │  [Vít Inox M4      ] [8 con ] [±] [8] ──→ trừ: 8 con              [🗑️] │          │        │
│         └────────────────────────────────────────────────────────────────────────────────────┘       │
│         📦 Tổng vật tư: Alu 1.0m² | Nẹp 2.5m | Keo 1 chai | Vít 8 con | ...                          │
│         💰 Tổng giá vật tư kho: 125,000đ  (chi phí gốc = tổng ĐG vật tư × SL)                        │
│         ──── CƠ CHẾ LƯU ────                                                                         │
│         (•) Không lưu — Chỉ trừ kho      ( ) Lưu Combo mới: [ Nhập tên biến thể... ]                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Cấu trúc BOM khi Tạo mới:**


| Thành phần                   | Mô tả                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Tên Combo**                | Ô nhập tùy biến — VD: "Biển Alu PNJ Hưng Đạo"                                                                                          |
| **Vật tư chính (BOM Core)**  | `[+ Thêm vật tư]` → mở popup chọn từ danh mục vật tư chính — mỗi dòng hiển thị `[±]` số lượng + số lượng trừ kho + nút `[🗑️]` xóa     |
| **Vật tư phụ (Accessories)** | `[+ Thêm vật tư phụ]` → bộ lọc khóa cứng chỉ hiện nhóm phụ kiện: Keo, Vít, Led, Nguồn...                                               |
| **💰 Tổng giá vật tư kho**   | Máy tự tính realtime = tổng (Đơn giá vật tư × SL từng dòng). Hiển thị chi phí gốc để thu ngân đối chiếu biên lợi nhuận ngay trên dòng. |
| **Checkbox trừ kho**         | `(•) Không lưu — Chỉ trừ kho`                                                                                                          |


**Logic xử lý khi BẤM LƯU ĐƠN / CHỐT THANH TOÁN — Kịch bản B:**


| Tùy chọn                    | Hành vi                                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[Lưu Combo mới]`           | Lưu đóng gói cụm cấu trúc vật tư thành một mặt hàng Combo mới trong danh mục sản phẩm. Lần sau khách đặt lại, chỉ cần gõ tìm đúng tên → ra ngay, không phải bóc tách lại. |
| `[Không lưu — Chỉ trừ kho]` | Sản phẩm gia công phát sinh **1 lần duy nhất**. Chốt đơn → trừ kho theo BOM vừa nhập, nhưng **không sinh mã sản phẩm Combo mới** nào trong danh mục, tránh làm rác dữ liệu. |


---

← [Quay về 02-K02A-DONG-SP.md](./02-K02A-DONG-SP.md) | [01-K02-GIO-HANG.md](./01-K02-GIO-HANG.md)
