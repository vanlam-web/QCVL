# WORKFLOW-SPEC-IMPLEMENT — Quy Ước Phối Hợp Các Luồng Codex

> **Vai trò:** Source of Truth điều phối giữa Spec / Implement / Review.
> **Người quyết định:** Owner trực tiếp quyết định thứ tự và nghiệp vụ cuối cùng.
> **Cập nhật:** 2026-07-05.

---

## Mục Tiêu

File này giúp các luồng Codex không lệch mạch sau nhiều task.

Vai trò:

- **Spec:** giữ Source of Truth nghiệp vụ, rà KiotViet khi cần, chốt scope, review implementation theo nghiệp vụ.
- **Implement:** code, test, commit/PR/deploy, báo blocker kỹ thuật/nghiệp vụ.
- **Review:** kiểm tra dự án khi Owner yêu cầu, chạy test/build/lint, phát hiện drift/rủi ro và giao lại đúng luồng.

Quy trình tự động chi tiết nằm ở [WORKFLOW-AUTO-SPEC-IMPLEMENT.md](./WORKFLOW-AUTO-SPEC-IMPLEMENT.md).

Queue sống nằm ở [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md). Board item đang mở nằm ở [PROJECT-COORDINATION.md](./PROJECT-COORDINATION.md). Issue Review nằm ở [REVIEW-ISSUES.md](./REVIEW-ISSUES.md).

Khi sửa load chậm hoặc tối ưu hiệu năng, đọc/cập nhật [PERFORMANCE-FIX-LOG.md](./PERFORMANCE-FIX-LOG.md) để không test/fix trùng.

---

## Thứ Tự Source of Truth

Khi chat, docs và code khác nhau, dùng thứ tự:

1. Quyết định mới nhất của Owner trong chat.
2. Source of Truth đã commit trên `main` hoặc branch spec.
3. Code hien tai.
4. Git history cho plan/spec cu khi can truy vet.

Nếu code lệch docs hoặc quyết định Owner, coi là implementation drift cho tới khi Spec/Owner chốt lại.

---

## Trước Khi Implement

Implement phải biết rõ:

- slice đang làm
- branch/PR hiện tại
- Source of Truth đang theo
- in scope
- out of scope
- verification cần chạy

Phải hỏi Spec/Owner trước khi code sâu nếu đụng:

- tiền/quỹ/công nợ
- kho/stock movement
- hóa đơn/báo giá/chứng từ
- dữ liệu khó sửa sau khi ghi DB
- API/schema dùng lâu dài

Wording nhỏ hoặc layout nhỏ có thể tự chọn theo pattern codebase, rồi ghi rõ khi report.

---

## Spec Review Gate

PR/slice quan trọng cần Spec review theo nghiệp vụ trước khi gọi là đúng.

Spec phân loại finding:

| Loại | Ý nghĩa |
|---|---|
| `Must fix before merge` | Sai tiền, kho, công nợ, chứng từ, dữ liệu khó sửa, hoặc trái quyết định Owner |
| `Follow-up acceptable` | Chưa đủ polish/đủ sâu nhưng không sai dữ liệu và đã ghi rõ là foundation |
| `Future scope` | Đúng là chưa làm vì ngoài slice đã chốt |

Review nghiệp vụ không thay test kỹ thuật. Implement vẫn phải chạy verification theo plan.

---

## Handoff Spec Sang Implement

```text
[Spec -> Implement]

Remote branch/commit:
- ...

Source of Truth:
- ...

In scope:
- ...

Out of scope:
- ...

Acceptance:
- ...

Verification:
- ...

Must ask Spec before:
- ...

Luồng đang giữ:
- Spec

Luồng nhận tiếp:
- Implement

Bước tiếp theo:
- ...
```

Implement phải report lại Spec khi:

- đã có commit/PR cần review
- gặp blocker/spec thiếu
- cần đổi scope
- quyết định defer

Nếu việc đến từ Review hoặc liên quan [REVIEW-ISSUES.md](./REVIEW-ISSUES.md), Implement cũng report lại Review.

---

## Handoff Implement Sang Spec/Owner

```text
[Implement -> Spec]

Branch/PR/commit:
- ...

Scope implemented:
- ...

Source of Truth followed:
- ...

Verification:
- ...

Known gaps:
- ...

Questions:
- ...

Luồng đang giữ:
- Implement

Luồng nhận tiếp:
- Spec / Review / Owner

Bước tiếp theo:
- ...

Cần Owner quyết định:
- Có / Không
```

Spec phải trả lời trực tiếp bằng `[Spec -> Implement]` sau khi review.

Nếu cần Review gate, report ghi `Luồng nhận tiếp: Review`. Nếu must-fix, report ghi `Luồng nhận tiếp: Implement`.

---

## Review Thread

Owner có thể yêu cầu Review kiểm tra toàn bộ dự án hoặc một slice cụ thể.

Review chịu trách nhiệm:

- đọc trạng thái repo hiện tại
- chạy kiểm tra phù hợp
- phân biệt lỗi code, test, cấu hình, docs/spec drift
- giải thích bằng ngôn ngữ dễ hiểu khi Owner yêu cầu
- ghi issue giao cho luồng khác vào [REVIEW-ISSUES.md](./REVIEW-ISSUES.md)
- re-check sau khi luồng phụ trách báo đã xử lý

Mẫu report:

```text
[Review -> Spec/Implement]

Scope checked:
- ...

Commands run:
- ...

Result:
- ...

Findings:
- ...

Recommended next action:
- ...

Review issue IDs:
- ...

Luồng đang giữ:
- Review

Luồng nhận tiếp:
- Spec / Implement / Owner

Bước tiếp theo:
- ...
```

---

## Không Tự Mở Scope

Không tự mở nếu Owner chưa chốt:

- auto-match file máy sản xuất với hóa đơn
- tự trừ kho từ dữ liệu máy sản xuất
- sửa/hủy hóa đơn có đảo kho/tiền/công nợ
- HĐĐT/VAT
- delivery/COD/kênh online
- loyalty/campaign, HR/payroll/commission
- schema mới lớn hoặc API nền tảng khó sửa

---

## Khi Mất Mạch

Đọc lại theo thứ tự:

1. File này.
2. [WORKFLOW-AUTO-SPEC-IMPLEMENT.md](./WORKFLOW-AUTO-SPEC-IMPLEMENT.md).
3. [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).
4. [REVIEW-ISSUES.md](./REVIEW-ISSUES.md) nếu việc đến từ Review.
5. Source of Truth theo module đang làm.
6. Git history cho plan/spec cu neu can truy vet.
