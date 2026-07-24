# K01 — Kiến trúc và an toàn dữ liệu POS

## Mục đích

Khối thanh đỉnh POS chỉ hiển thị/truy cập dữ liệu qua API và state client đã được xác thực.
Không gọi trực tiếp database, không tự suy luận quyền từ UI.

## Ranh giới dữ liệu

| Dữ liệu | Nguồn sử dụng |
|---|---|
| Người dùng đăng nhập | Auth state và API `/me` |
| Danh mục sản phẩm | API catalog/POS |
| Hàng đợi sản xuất | API/realtime event sau khi dữ liệu đã persist |

Schema và contract backend là nguồn chi tiết:

- [POS-TABLES.md](../../../04-DATABASE/Sales/POS-TABLES.md)
- [POS architecture](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md)

## An toàn state client

- Draft/tab POS lưu local browser bằng key technical allow-list; không coi local storage là nguồn dữ liệu thật.
- State local chỉ phục hồi trải nghiệm. Checkout, giá, tồn kho, quyền và trạng thái hóa đơn phải được backend xác nhận.
- Không lưu token, password hoặc dữ liệu nhạy cảm vào log/UI state không cần thiết.
- Không lưu scroll position như contract nghiệp vụ.

## Đồng thời

Khi nhiều người cùng sửa/chốt chứng từ, backend là nơi quyết định conflict và trạng thái cuối.
Client phải hiển thị lỗi/refresh state từ API, không tự ghi đè dữ liệu server.

← [K01 — Thanh đỉnh](./01-K01-TOPBAR.md) · [POS README](../README.md)
