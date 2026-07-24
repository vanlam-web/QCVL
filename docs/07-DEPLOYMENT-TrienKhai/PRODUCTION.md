# PRODUCTION — Vận hành môi trường thật

> **Vai trò:** Baseline trước production.
> **Phạm vi:** Nguyên tắc vận hành production QCVL, không thay thế checklist deploy chi tiết.

---

## 1. Mục tiêu

Production là môi trường vận hành thật của xưởng, dùng dữ liệu thật và ảnh hưởng trực tiếp tới bán hàng, tồn kho, sổ quỹ, công nợ và báo cáo.

Nguyên tắc:

- Production tách biệt hoàn toàn với local, shared-dev, preview và staging.
- Không dùng production để thử migration, test dữ liệu hoặc demo tính năng chưa nghiệm thu.
- Mỗi lần deploy production phải truy vết được commit, người thực hiện, thời gian và kết quả kiểm tra.

---

## 2. Điều kiện trước khi promote production

Một commit được release `3200` khi:

1. Scope checklist đã đóng và thay đổi đã commit vào `main`.
2. Git working tree sạch.
3. Typecheck, focused tests và preflight pass.
4. Migration đã review; destructive data/migration có checkpoint Owner riêng.
5. Image deploy có rollback path.

Không release code local chưa commit hoặc working tree dirty. `3202` không là staging/promotion environment.

---

## 3. Smoke test tối thiểu

Trước production hoặc ngay sau production deploy, kiểm tra tối thiểu:

- Đăng nhập được bằng tài khoản admin/thu ngân test hợp lệ.
- POS mở được.
- Tìm sản phẩm active.
- Tìm/tạo khách hợp lệ.
- Checkout tạo hóa đơn test nếu môi trường cho phép dữ liệu test có kiểm soát.
- Sổ quỹ hiển thị phiếu thu tương ứng nếu có checkout test.
- Báo cáo/cuối ngày không lỗi tải.
- Realtime/connection indicator không báo mất kết nối kéo dài.

Với production thật, nếu không được tạo hóa đơn test, dùng smoke read-only:

- mở POS
- tìm sản phẩm/khách
- mở chứng từ mới nhất
- mở sổ quỹ mới nhất
- mở báo cáo cuối ngày

---

## 4. Rollback

Rollback app:

- Rollback về Git SHA production ổn định gần nhất.
- Không rollback bằng code chưa từng chạy staging.
- Ghi lại lý do rollback và commit bị rollback.

Database:

- Không dùng destructive rollback migration trực tiếp trên production nếu chưa có kế hoạch dữ liệu.
- Nếu migration đã ghi dữ liệu, ưu tiên corrective migration.
- Nếu cần restore backup, theo `BACKUP-RESTORE.md`.

---

## 5. Monitoring tối thiểu

Production cần theo dõi:

| Nhóm | Tín hiệu |
|---|---|
| App/API | uptime, response time, error rate, failed requests |
| Auth | login failures bất thường, token/config lỗi |
| Database | connection errors, migration errors, slow query nếu có |
| Checkout | checkout fail, duplicate/idempotency error, stock movement fail |
| Finance | payment receipt/cashbook write fail |
| Realtime | disconnect kéo dài, production queue lag sau này |
| Backup | backup fail, restore drill quá hạn |

Không log secret, access token, service role key, password hoặc dữ liệu nhạy cảm không cần thiết.

---

## 6. Alert tối thiểu

Các lỗi cần cảnh báo sớm:

- API production down.
- Login toàn hệ thống lỗi.
- Checkout lỗi liên tục.
- Database không kết nối được.
- Migration/deploy fail.
- Backup fail.
- SSL/domain hết hạn hoặc sắp hết hạn.
- Queue/realtime lag kéo dài khi production queue được triển khai.

Kênh cảnh báo cụ thể sẽ chốt theo hạ tầng thật; có thể bắt đầu bằng email/Zalo nội bộ/manual monitor nếu chưa có hệ thống chuyên dụng.

---

## 7. Quyền truy cập production

- Chỉ người được giao vận hành mới có quyền production secrets.
- Không dùng chung tài khoản admin production cho nhiều người.
- Không đưa service role key vào máy không cần thiết.
- Khi nhân sự thay đổi, phải thu hồi quyền production liên quan.

---

## 8. Nhật ký vận hành

Mỗi lần production deploy/rollback/sự cố cần ghi tối thiểu:

- thời gian
- người thực hiện
- Git SHA
- thay đổi chính
- kết quả smoke test
- lỗi/sự cố nếu có
- hành động khắc phục

Nhật ký có thể bắt đầu trong issue/PR/release note, sau này tách runbook vận hành riêng.

---

## 9. Tham chiếu

- [BACKUP-RESTORE.md](./BACKUP-RESTORE.md)
- [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md)
