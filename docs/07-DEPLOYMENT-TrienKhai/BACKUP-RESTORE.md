# BACKUP-RESTORE — Sao lưu và khôi phục

> **Vai trò:** Baseline trước production.
> **Phạm vi:** Chính sách backup/restore cho dữ liệu QC-OMS.

---

## 1. Mục tiêu

QC-OMS quản lý dữ liệu bán hàng, tồn kho, công nợ và sổ quỹ. Mất dữ liệu hoặc restore sai có thể làm lệch tiền/kho.

Backup chỉ có giá trị khi restore được kiểm tra định kỳ.

---

## 2. Dữ liệu cần backup

| Nhóm | Bắt buộc |
|---|---|
| Database production | Có |
| Supabase Auth users/config liên quan | Có nếu nhà cung cấp hỗ trợ export/restore |
| File/storage bill hoặc attachment nếu sau này có | Có |
| Environment/secrets | Không backup vào repo; lưu trong secret manager/quy trình riêng |
| Logs vận hành | Lưu theo retention phù hợp, không thay thế database backup |

---

## 3. RPO/RTO baseline

Trước khi production thật, dùng baseline tạm:

| Chỉ số | Baseline |
|---|---|
| RPO | Tối đa mất dữ liệu 24 giờ |
| RTO | Khôi phục service trong 4 giờ làm việc |

Khi hệ thống dùng hàng ngày, cần xem lại:

- doanh thu/ngày
- số hóa đơn/ngày
- mức chấp nhận nhập lại thủ công
- khả năng Supabase/project hiện tại hỗ trợ PITR hay backup lịch

Nếu doanh thu hoặc số chứng từ tăng, cần giảm RPO xuống mức thấp hơn.

---

## 4. Backup schedule

Baseline đề xuất:

- Backup database tự động hằng ngày.
- Giữ backup tối thiểu 14 ngày.
- Trước migration lớn: tạo backup/snapshot thủ công nếu hạ tầng hỗ trợ.
- Theo dõi backup fail và cảnh báo.

Không chỉ tin vào thông báo backup thành công; phải có restore drill.

---

## 5. Restore drill

Tối thiểu mỗi tháng hoặc trước production milestone lớn:

1. Chọn một backup gần nhất.
2. Restore vào môi trường riêng, không đè production.
3. Chạy migration/cấu hình cần thiết nếu có.
4. Kiểm tra đăng nhập test.
5. Kiểm tra dữ liệu mẫu:
   - khách hàng
   - sản phẩm
   - hóa đơn
   - payment receipts
   - cashbook
   - stock movements
6. Ghi lại thời gian restore, lỗi gặp phải và kết quả.

Restore drill không được dùng production database đích.

---

## 6. Quy trình khi cần restore production

Chỉ restore production khi:

- production database hỏng/mất dữ liệu nghiêm trọng
- corrective migration không đủ
- đã xác định backup cần restore
- đã thông báo người vận hành/Owner

Quy trình:

1. Dừng hoặc khóa ghi production nếu cần để tránh dữ liệu tiếp tục lệch.
2. Ghi nhận thời điểm sự cố.
3. Chọn backup phù hợp theo RPO.
4. Restore vào môi trường tạm để kiểm tra nhanh.
5. Nếu hợp lệ, thực hiện restore production theo quy trình hạ tầng.
6. Chạy smoke test production.
7. Ghi nhận dữ liệu có thể bị mất từ thời điểm backup đến sự cố.
8. Nếu cần, nhập bù thủ công các hóa đơn/thu chi/tồn kho bị mất.

---

## 7. Dữ liệu sau restore cần đối soát

Sau restore, kiểm tra tối thiểu:

- số hóa đơn mới nhất
- công nợ khách lớn
- sổ quỹ tiền mặt/ngân hàng
- tồn kho mặt hàng chính
- phiếu thu/chi ngày hiện tại
- user đăng nhập và quyền

Nếu restore mất dữ liệu trong ngày, phải có danh sách chứng từ cần nhập lại từ giấy/in bill/chat/bank.

---

## 8. Không được làm

- Không restore đè production chỉ để thử.
- Không dùng backup production cho dev cá nhân nếu chứa dữ liệu nhạy cảm mà chưa có quy trình ẩn danh.
- Không commit dump database, file backup, `.env`, service role key hoặc credential vào repo.
- Không xóa backup cũ trước khi backup mới được xác nhận.

---

## 9. Tham chiếu

- [PRODUCTION.md](./PRODUCTION.md)
- [ENVIRONMENTS-CI.md](./ENVIRONMENTS-CI.md)
- [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md)
