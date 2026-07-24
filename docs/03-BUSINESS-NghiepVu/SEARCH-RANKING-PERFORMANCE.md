# Quy tắc tìm kiếm, chọn nhanh và sắp xếp QCVL

Cập nhật: `2026-07-24`
Nguồn runtime: [use-quick-pick-search.ts](../../src/lib/use-quick-pick-search.ts), [use-management-search.ts](../../src/lib/use-management-search.ts), [pos-usage-repository.ts](../../server/modules/catalog/pos-usage-repository.ts).

## Hai loại tìm kiếm

| Ngữ cảnh | Shared owner | Hành vi hiện hành |
|---|---|---|
| Chọn nhanh POS/dropdown | `useQuickPickSearch` | Debounce, chỉ search khi đạt `minLength`, giữ kết quả request mới nhất, clear hủy request/state. |
| Danh sách quản trị | `useManagementSearch` | Gõ chỉ đổi `draftSearch`; submit/Enter mới đổi `appliedSearch` và gọi `onApply`; clear áp dụng rỗng ngay. |

Không tự viết debounce, request-id, stale-response guard hoặc draft/applied state riêng khi shared hook đáp ứng được.

## Search context và sort

- Request quick-pick gửi `search_context=quick_pick` khi module cần giữ thứ tự suggestion do repository/ranking trả về.
- `sortCustomersForRequest`, `sortProductsForRequest`, `sortSuppliersForRequest` không áp management sort khi context là quick-pick.
- Management list chỉ sort theo `sort_key` và `sort_direction`; thiếu sort key dùng fallback newest-first.
- Date sort dùng `parseManagementDateTimeValue` cho sort text/date, không phải importer/business wall-clock parser.

## Usage ranking runtime

- `pos_product_usage` giữ `usage_count` theo `(organization_id, product_id)`.
- Khi flow POS gọi `recordPosProductUsage`, repository upsert và tăng count transactionally.
- `search_selection_stats` giữ selection count/last-selected theo organization, user, entity type/id; repository upsert khi route/flow gọi `recordSearchSelection`.
- Không khẳng định mọi quick-pick đã dùng rank này nếu chưa có caller/route verification. Không tạo localStorage ranking song song.

## Quy tắc dữ liệu

- Query/search luôn scope organization.
- Status/filter do repository/handler của từng entity quyết định; không dùng suffix `{DEL}` làm rule duy nhất.
- Không preload toàn bộ bảng lớn vào client chỉ để lọc nếu API/repository đã có search/paging.
- Nếu cần thêm ranking/index/cache: đo trước, tạo plan con có source/query evidence; không ghi endpoint/table đề xuất thành contract active.

## Kiểm thử khi sửa search

- Quick-pick: debounce, min length, stale response không ghi đè request mới, clear reset loading/results/error.
- Management: typing không apply; submit apply trim; clear apply search rỗng.
- API/list: filter/sort/scope organization đúng, không đổi default ordering ngoài context.

## Tham chiếu

- [Quick-pick hook](../../src/lib/use-quick-pick-search.ts)
- [Management search hook](../../src/lib/use-management-search.ts)
- [POS usage repository](../../server/modules/catalog/pos-usage-repository.ts)
- [Catalog API](../05-BACKEND-MayChu/POS/CUSTOMER-PRODUCT-PRICING-API.md)
