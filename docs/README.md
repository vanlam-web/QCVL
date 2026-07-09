# TÀI LIỆU DỰ ÁN — QC-OMS

> **Xưởng Văn Lâm** — Hệ thống Quản lý Sản xuất & Bán hàng
>
> File này chỉ để điều hướng. Trạng thái sống nằm ở [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).

## Đọc Trước Khi Làm

| Việc cần biết | File |
|---|---|
| Tổng quan hệ thống tài liệu | [00-OVERVIEW-TongQuan/README.md](./00-OVERVIEW-TongQuan/README.md) |
| Nguồn dữ liệu hiện tại / chống nhầm cách cũ | [CURRENT-DATA-SOURCE.md](./CURRENT-DATA-SOURCE.md) |
| Quy tắc tách vỏ UI và ruột nghiệp vụ/code | [CODE_ARCHITECTURE_RULES.md](./CODE_ARCHITECTURE_RULES.md) |
| Kế hoạch tách vỏ/ruột toàn dự án | [ARCHITECTURE-SEPARATION-PLAN.md](./ARCHITECTURE-SEPARATION-PLAN.md) |
| Nguồn đúng 8 tầng | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Quy tắc viết tài liệu | [DOCUMENT_RULES.md](./DOCUMENT_RULES.md) |
| Trạng thái sống / queue hiện tại | [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) |
| Trạng thái NAS dev hiện tại của QCVL | [07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md](./07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md) |
| Quy ước phối hợp Spec / Implement / Review | [WORKFLOW-SPEC-IMPLEMENT.md](./WORKFLOW-SPEC-IMPLEMENT.md) |
| Vòng lặp tự động giữa các luồng | [WORKFLOW-AUTO-SPEC-IMPLEMENT.md](./WORKFLOW-AUTO-SPEC-IMPLEMENT.md) |
| Quy ước spec/plan/draft/handoff lịch sử | [superpowers/README.md](./superpowers/README.md) |

## Nguồn Đúng Theo Tầng

| Tầng | Nội dung | Điểm vào |
|---|---|---|
| 0 | Tổng quan | [00-OVERVIEW-TongQuan/README.md](./00-OVERVIEW-TongQuan/README.md) |
| 1 | Tầm nhìn, MVP, target state | [01-VISION-TamNhin/README.md](./01-VISION-TamNhin/README.md) |
| 2 | PRD / UX / màn hình | [02-PRD-UX-PhongCanh/README.md](./02-PRD-UX-PhongCanh/README.md) |
| 3 | Nghiệp vụ | [03-BUSINESS-NghiepVu/README.md](./03-BUSINESS-NghiepVu/README.md) |
| 4 | Database / schema / RLS | [04-DATABASE/README.md](./04-DATABASE/README.md) |
| 5 | Backend / API | [05-BACKEND-MayChu/README.md](./05-BACKEND-MayChu/README.md) |
| 6 | Tích hợp | [06-INTEGRATION-KetHop/README.md](./06-INTEGRATION-KetHop/README.md) |
| 7 | Triển khai / vận hành | [07-DEPLOYMENT-TrienKhai/README.md](./07-DEPLOYMENT-TrienKhai/README.md) |

## File Điều Phối

| File | Vai trò |
|---|---|
| [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) | Bảng trạng thái sống, queue hiện tại, handoff giữa luồng |
| [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md) | Điều phối luồng đang giữ / luồng nhận tiếp khi cần |
| [REVIEW-ISSUES.md](./REVIEW-ISSUES.md) | Sổ theo dõi vấn đề do Review Thread duy trì |
| [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md) | Log mốc kiểm implement gần nhất, không phải roadmap sống |
| [PERFORMANCE-FIX-LOG.md](./PERFORMANCE-FIX-LOG.md) | Log đo và fix load chậm |
| [KIOTVIET-REFERENCE-NOTES.md](./KIOTVIET-REFERENCE-NOTES.md) | Ghi chú tham khảo KiotViet phù hợp QC-OMS |

## Ghi Chú

- Không dùng root README để đánh dấu từng file đã làm/chưa làm.
- Nếu cần biết trạng thái hiện tại, đọc [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md) trước.
- Nếu cần sửa nghiệp vụ, sửa đúng layer Source of Truth trước, bridge/spec chỉ dùng để đối chiếu.
