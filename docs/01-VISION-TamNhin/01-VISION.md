# Phần 1 — Tầm nhìn QCVL

Cập nhật: `2026-07-24`

## Mục đích

QCVL là hệ thống vận hành nội bộ của Xưởng Quảng Cáo Văn Lâm. Hệ thống phục vụ luồng thực tế:

```text
Bán hàng/POS → báo giá hoặc hóa đơn → kho → thu tiền/công nợ → sổ quỹ → đối soát → báo cáo
```

QCVL ưu tiên dữ liệu đúng, luồng vận hành rõ và có thể đối soát. Không mở rộng tính năng chỉ vì
mô hình phần mềm quản trị chung khi chưa có nhu cầu xưởng và quyết định Owner.

## Người dùng và quyền

| Vai trò | Phạm vi chính |
|---|---|
| Chủ xưởng | Theo dõi vận hành, tài chính, báo cáo và cấu hình quan trọng. |
| Nhân viên bán hàng/thu ngân | POS, khách hàng, báo giá, hóa đơn, thu tiền và chứng từ được cấp quyền. |
| Nhân viên kho/vật tư | Hàng hóa, nhập hàng, kiểm kho và tồn kho. |
| Nhân viên sản xuất | Theo dõi công việc sản xuất trong phạm vi được cấp quyền. |

Quyền là lớp bảo vệ dữ liệu và thao tác nhạy cảm. Không dùng nhiều quyền nhỏ để cắt vụn luồng
vận hành nội bộ nếu nghiệp vụ chưa yêu cầu. Các thao tác như quản lý người dùng/quyền, cấu hình,
hủy hoặc sửa chứng từ đã chốt phải có kiểm soát rõ.

## Nguyên tắc sản phẩm

1. **Dữ liệu có nguồn:** PostgreSQL trên NAS là nguồn dữ liệu runtime; KiotViet là nguồn đối chiếu
   cho dữ liệu import/lịch sử khi scope yêu cầu.
2. **Tiền và tồn kho phải đối soát được:** không che chênh lệch bằng số giả hoặc fallback im lặng.
3. **Thao tác vận hành phải nhanh nhưng có kiểm soát:** kiểm tra dữ liệu ở backend, mutation có audit
   và rollback/checkpoint khi ảnh hưởng dữ liệu quan trọng.
4. **Một contract cho một nghiệp vụ:** không duy trì hai cách tính/lưu cùng business rule.
5. **Phạm vi do Owner quyết:** chi tiết phạm vi hiện hành ở [03-MVP-SCOPE.md](./03-MVP-SCOPE.md).

## Ranh giới

- Tài liệu này chỉ giữ định hướng sản phẩm.
- Quy tắc nghiệp vụ ở `docs/03-BUSINESS-NghiepVu/`.
- Schema ở `docs/04-DATABASE/`.
- API/server ở `docs/05-BACKEND-MayChu/`.
