# Giá bán POS QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [resolve-prices-repository.ts](../../../server/modules/catalog/resolve-prices-repository.ts), [catalog-routes.ts](../../../server/modules/catalog/catalog-routes.ts), [catalog-product-handlers.ts](../../../server/modules/catalog/catalog-product-handlers.ts).

## Giá mặc định

POS gọi `POST /api/v1/pricing/resolve`; server là owner kết quả giá theo organization, customer và product.

Thứ tự resolver PostgreSQL:

1. Lấy bảng giá mặc định active (`is_default = true`).
2. Nếu customer có `customer_group_id` khác `cg-retail`/`cg-vip`, tìm bảng giá active có `name` bằng tên nhóm khách, không phân biệt hoa/thường.
3. Nếu bảng giá nhóm có item của product, dùng giá đó (`customer_group_price_list`).
4. Nếu bảng giá nhóm không có item, fallback item bảng giá mặc định (`fallback_default_price_list`).
5. Không có item thì giá trả `0` (`default_price_list`).

Resolver trả `unit_price`, `price_source`, `price_list_id` và giá theo source code đơn vị quy đổi khi có. Không tự tính giá ở POS client.

## Bảng giá và đơn vị quy đổi

- Chỉ bảng giá active được dùng resolve.
- Default list chọn theo `updated_at`, rồi `created_at` mới nhất nếu có nhiều record hợp lệ.
- Với alias source code của `product_unit_conversions`, resolver lấy giá item alias từ bảng giá nhóm trước, rồi bảng giá mặc định.
- Đơn giá thuộc product/alias của bảng giá; không suy diễn giá theo cuộn, tấm, mét tới hoặc diện tích ngoài item/source runtime.

## Giá sửa tay và lịch sử giá

- `GET /api/v1/customers/{customerId}/products/{productId}/recent-prices` có route.
- Handler hiện trả fixture cố định, chưa truy vấn lịch sử bán thực tế. Vì vậy không dùng endpoint này làm gợi ý giá, audit hay rule “5 giá gần nhất”.
- Không có source runtime trong module hiện hành chứng minh giá sửa tay tự ghi vào lịch sử khách-hàng/sản phẩm. Nếu mở feature, cần schema/repository, ownership chứng từ, permission và test riêng.

## Quy tắc an toàn

- Đổi customer/dòng hàng phải resolve lại qua API khi workflow yêu cầu; không tự map nhóm-bảng giá trên client.
- Không cập nhật bảng giá từ giá chứng từ hoặc edit giá tay.
- Snapshot đơn giá đã chốt thuộc order item; catalog/bảng giá đổi sau đó không rewrite chứng từ cũ.
- Mọi query/mutation scope `organization_id`.

## Tham chiếu

- [Catalog và pricing API](../../05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md)
- [Schema bán hàng/POS](../../04-DATABASE/Sales/POS-TABLES.md)
- [Pricing resolver](../../../server/modules/catalog/resolve-prices-repository.ts)
