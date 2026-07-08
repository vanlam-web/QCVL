# WORKFLOW-AUTO-SPEC-IMPLEMENT — Vòng Lặp Tự Động Giữa Các Luồng Codex

> **Vai trò:** Quy trình vận hành để Spec / Implement / Review tự phối hợp mà Owner không phải chuyển lời.
> **Người quyết định:** Owner chốt ưu tiên nghiệp vụ lớn.
> **Cập nhật:** 2026-07-05.

---

## Mục Tiêu

Các luồng Codex được phép tự giao việc, tự báo tình trạng và tự review với nhau khi việc nằm trong Source of Truth đã chốt.

Vai trò:

- **Spec:** giữ Source of Truth, kiểm KiotViet khi cần, chốt scope, review PR theo nghiệp vụ.
- **Implement:** code, test, mở PR/commit, sửa feedback, merge khi đủ điều kiện.
- **Review:** kiểm tra dự án khi Owner yêu cầu, chạy test/build/lint, phát hiện drift/rủi ro và giao lại đúng luồng.

Owner chỉ cần chốt hướng nghiệp vụ, ưu tiên và nghiệm thu thực tế.

---

## Quy Tắc Cốt Lõi

1. **Spec không giao việc mơ hồ.**
   Handoff phải có scope, out of scope, Source of Truth, checklist nghiệm thu, verification và điều kiện phải hỏi lại.

2. **Implement không tự mở scope.**
   Gặp phần ngoài handoff thì hỏi Spec bằng câu hỏi cụ thể, kèm đề xuất mặc định.

3. **Review không sửa thay nếu Owner chỉ yêu cầu kiểm tra.**
   Review ghi issue, chỉ rõ bằng chứng, luồng phụ trách và lệnh re-check.

4. **Luồng nhận việc phải report lại luồng gửi.**
   Khi xong, bị block hoặc defer, luồng nhận việc report thẳng lại nơi giao việc. Owner không phải nhắc hoặc chuyển lời.

5. **Scope rủi ro cao cần Spec gate.**
   Tiền, quỹ, công nợ, tồn kho, chứng từ, schema/API nền tảng hoặc side effect lâu dài đều phải review kỹ trước merge.

6. **Không gọi là xong nếu chưa có verification.**
   Phải ghi rõ lệnh đã chạy và kết quả.

---

## Vòng Lặp Chuẩn

### 1. Spec Chọn Slice

Spec đọc:

- [WORKFLOW-SPEC-IMPLEMENT.md](./WORKFLOW-SPEC-IMPLEMENT.md)
- [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md)
- Source of Truth liên quan trong `02-PRD-UX`, `03-BUSINESS`, `04-DATABASE`, `05-BACKEND`
- branch/PR hiện tại nếu có
- KiotViet/reference nếu slice cần đối chiếu nghiệp vụ

Điều kiện sang bước handoff:

- slice nhỏ, test được riêng
- in scope / out of scope rõ
- rủi ro được khoanh vùng
- không cần Owner chốt thêm

### 2. Spec Giao Implement

Mẫu handoff:

```text
[Spec -> Implement]

Slice:
- ...

Base:
- branch/commit:

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

### 3. Implement Thi Công

Implement phải:

- dùng branch `codex/...` nếu tạo branch
- làm đúng scope
- viết/chạy test tương ứng rủi ro
- không revert việc không phải của mình
- report lại Spec khi cần review, bị block hoặc cần đổi scope
- report lại Review nếu việc xuất phát từ Review issue

### 4. Review / Spec Gate

Review dùng khi Owner yêu cầu hoặc slice rủi ro cao:

- đọc scope/branch/PR
- chạy verification phù hợp
- ghi pass/fail, risk, drift
- giao issue về đúng luồng nếu cần

Spec review:

- so diff với Source of Truth
- kiểm acceptance checklist
- kiểm out of scope không bị làm lan
- phân loại finding:
  - `Must fix before merge`
  - `Follow-up acceptable`
  - `Future scope`

### 5. Merge Và Báo Lại

Sau merge, Implement báo lại:

```text
[Implement -> Spec]

Merged:
- PR:
- merge commit:

Post-merge verification:
- ...

Remaining notes:
- ...

Luồng đang giữ:
- Implement

Luồng nhận tiếp:
- Spec / Review / Owner

Bước tiếp theo:
- ...
```

Spec cập nhật checklist/board nếu cần.

### 6. Chọn Việc Tiếp Theo

Queue sống nằm ở [PHASE-CHECKLIST.md](./PHASE-CHECKLIST.md).

Nếu việc tiếp theo rủi ro thấp và Source of Truth đủ rõ, Spec quay lại bước 1.

Nếu rủi ro cao hoặc thiếu quyết định nghiệp vụ, Spec hỏi Owner một câu ngắn và kèm đề xuất mặc định.

---

## Khi Phải Hỏi Owner

Hỏi Owner khi:

- có hai cách nghiệp vụ đều đúng nhưng ảnh hưởng vận hành lâu dài
- động vào tiền, quỹ, công nợ, tồn kho, chứng từ mà Source of Truth chưa rõ
- đổi schema/API nền tảng khó sửa sau này
- muốn bỏ acceptance đã chốt
- muốn mở module mới ngoài queue
- KiotViet và cách làm riêng của QC-OMS khác nhau lớn, cần Owner chọn

---

## Mẫu Báo Cáo Ngắn

Spec báo Owner:

```text
Tình trạng:
- ...

Slice:
- ...

PR/branch:
- ...

Kết quả mới nhất:
- ...

Blocker:
- ...

Bước tiếp theo:
- ...
```

Review báo kết quả:

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
```

Implement xin review:

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

Questions/blockers:
- ...
```
