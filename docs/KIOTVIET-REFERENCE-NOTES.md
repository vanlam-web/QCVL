# KiotViet Reference Notes

> **Vai trò:** Ghi chú ý tưởng UX tham khảo từ KiotViet phù hợp QCVL, không copy module retail không liên quan.
> **Cập nhật:** 2026-07-05.

---

## Lượt Xem UI Trực Tiếp

- Đã xem KiotViet bằng tài khoản Owner cung cấp trong browser.
- URL: `https://quangcaoinvanlam.kiotviet.vn/man/#/DashBoard`
- Ngày xem: 2026-07-05
- Chế độ: chỉ quan sát, không tạo/sửa/xoá dữ liệu.

---

## Phần Phù Hợp QCVL

Nguồn tham khảo public đã xem:

- Inventory/warehouse management: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-kho-hang/
- Product list: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-hang-hoa/danh-sach-hang-hoa/
- Stocktake: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-hang-hoa/kiem-kho/
- Cashbook: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-so-quy/so-quy/
- Debt report: https://www.kiotviet.vn/wiki-ki-ot-viet/bao-cao-wiki/wiki-bao-cao-cong-no/
- Combo/BOM-like goods: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/huong-dan-bar-cafe-nha-hang/danh-muc-hang-hoa-web-fnb/

QCVL nên giữ các nhóm báo cáo đã có:

- báo cáo cuối ngày
- báo cáo bán hàng
- báo cáo công nợ khách hàng
- báo cáo hàng hóa/tồn kho

Sổ quỹ nên là trung tâm tra cứu:

- sau này có thể tách view tiền mặt / ngân hàng
- giữ dòng tự động từ bán hàng, thu nợ, thanh toán NCC
- phiếu thu/chi thủ công chỉ mở khi workflow hiện tại ổn định

Nhập hàng nên luôn nối với:

- nhà cung cấp
- tăng tồn kho
- công nợ phải trả NCC
- thanh toán ngay nếu có

Công nợ khách hàng nên dễ drill-down:

- danh sách nợ theo khách
- chi tiết theo hóa đơn
- lịch sử thu tiền
- sau này có top khách nợ nhiều và tuổi nợ

Bộ lọc báo cáo nên ưu tiên:

- thời gian
- phương thức thanh toán
- khách hàng / nhà cung cấp
- hàng hóa / nhóm hàng sau này

---

## Ý Tưởng UI Có Thể Áp Dụng

- Trang hàng hóa/kho nên table-first:
  - tìm nhanh mã/tên
  - bộ lọc trạng thái/tồn kho gần bảng
  - detail panel cho item được chọn
- Kho nên có thao tác thực tế:
  - danh sách kiểm kho
  - chi tiết kiểm kho
  - điều chỉnh tồn có lý do
- Sổ quỹ nên có:
  - filter thời gian rõ
  - filter loại thu/chi
  - detail phiếu thu/chi
- Báo cáo nên ưu tiên số tổng và bảng drill-down, tránh dashboard quá trang trí.

---

## Không Copy Từ KiotViet Nếu Chưa Chốt

- Đặt hàng/giao hàng/COD/kênh online.
- HĐĐT/VAT/thuế kế toán.
- Loyalty/campaign.
- HR/payroll/commission.
- Retail barcode/đổi trả nâng cao.
- Module quá sâu nếu QCVL chưa có dữ liệu hoặc workflow tương ứng.
