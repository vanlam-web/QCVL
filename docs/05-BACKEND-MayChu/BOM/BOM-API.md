# BOM API — Backend contract mức khung

> **Vai trò:** Draft kỹ thuật từ Source of Truth nghiệp vụ.
> **Business:** [BOM-RULES.md](../../03-BUSINESS-NghiepVu/BOM/BOM-RULES.md)

---

## 1. Endpoints tối thiểu

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/v1/products/{product_id}/bom` | Lấy BOM active của sản phẩm |
| `POST` | `/v1/products/{product_id}/bom` | Tạo BOM/version mới |
| `PUT` | `/v1/products/{product_id}/bom` | Lưu/thay thế BOM hiện hành, alias của `POST` trong MVP |
| `GET` | `/v1/boms/{bom_id}` | Chi tiết BOM/version |
| `POST` | `/v1/boms/{bom_id}/activate` | Đặt version làm active |
| `POST` | `/v1/boms/preview` | Deep-scan BOM để xem vật tư lá/chi phí tham khảo |
| `POST` | `/v1/boms/validate` | Kiểm tra vòng lặp, thiếu cấu hình, độ sâu |

Trong QC-OMS hiện tại, modal `+ Tạo hàng hóa` tạo combo theo 2 bước: `POST /products` để tạo sản phẩm `sell_method = combo`, sau đó `POST /products/{product_id}/bom` để lưu vật tư cấu thành cho combo vừa tạo. `PUT /products/{product_id}/bom` cũng được hỗ trợ như alias lưu/thay thế BOM hiện hành. Sau khi tạo, người dùng mở chi tiết hàng hóa để sửa BOM/version hiện hành. Khi bán combo, hệ thống trừ tồn vào vật tư cấu thành theo BOM active, không trừ tồn theo chính mã combo.

**Owner 2026-07-20:** BOM import từ KiotViet được đặt `active` và dùng ngay khi bán. Endpoint `POST /v1/boms/{bom_id}/activate` vẫn có thể giữ cho BOM tạo/sửa tay trong app, nhưng **không** còn là bước bắt buộc sau import KiotViet.

BOM không lưu `component_type`/`component_role` trên từng dòng và API từ chối các flag chính/phụ thủ công. `Vật tư phụ` là loại hàng/metadata của chính vật tư (`product_kind = auxiliary_material`); mọi vật tư còn lại được xem là vật tư chính. API lưu dòng BOM chỉ cần `component_product_id`, `quantity` và `notes`. API đọc BOM trả thêm metadata component gồm `product_kind` và `latest_purchase_cost` để UI hiển thị trạng thái dòng và giá vốn tạm. Logic tự hiệu chỉnh định mức từ kiểm kho, sửa tồn, khui vật tư và lịch sử sản xuất là phase sau.

---

## 2. Checkout contract

Checkout/POS cần gửi hoặc tham chiếu BOM theo 2 cách:

| Trường hợp | Contract |
|---|---|
| Dùng BOM chuẩn | Gửi `bom_id`/`version` hoặc backend resolve active BOM tại thời điểm checkout |
| BOM phát sinh trên dòng | Gửi `line_bom_snapshot` trong order item payload |

Backend phải lưu snapshot BOM đã dùng vào chứng từ trước khi tạo stock movement.

---

## 3. Deep-scan

Backend deep-scan BOM:

1. bắt đầu từ BOM của dòng bán
2. nhân định mức theo số lượng dòng
3. nếu component có BOM con, tiếp tục mở rộng
4. dừng ở vật tư lá cuối cùng
5. gom các vật tư cùng sản phẩm/đơn vị nếu hợp lệ
6. trả về danh sách tiêu hao để checkout tạo stock movement

Combo con dùng BOM chuẩn đang active tại thời điểm chốt đơn, trừ khi chứng từ đang xem lại đã có BOM version/snapshot cũ. Khi lưu chứng từ, backend phải lưu đủ tham chiếu/snapshot để chứng từ cũ không đổi nếu BOM của combo con bị sửa sau này.

Khi `Lưu Combo mới`, combo mới giữ combo con là component tham chiếu. API không tự flatten combo con thành toàn bộ vật tư lá trong BOM chuẩn mới.

Combo không trừ tồn kho theo chính mã combo. Tồn kho được tính theo vật tư lá sau deep-scan. Nếu combo con thiếu vật tư, response cảnh báo phải trả theo vật tư thành phần để POS có thể hiện cảnh báo và nút `Khui vật tư` khi được hỗ trợ.

Validation:

- chặn vòng lặp
- tối đa 5 cấp mặc định
- thiếu BOM con thì trả warning/flag; không chặn checkout trong MVP nếu nghiệp vụ cho phép bán tiếp
- vòng lặp hoặc vượt quá 5 cấp thì trả lỗi cấu hình; không tự bỏ qua nhánh lỗi

---

## 4. Inventory integration

BOM API chỉ tính vật tư cần trừ. Việc chọn cuộn/tấm nào và ghi stock movement vẫn theo Inventory service/rules.

Không được trừ tổng `m2` trực tiếp cho hàng `roll` hoặc `sheet`.
