# Superpowers Specs And Plans

> **Vai trò:** Khu trace/history/handoff cho các draft và plan do Codex tạo.
> **Source of Truth hiện tại:** tài liệu đã được promote vào `docs/02-PRD-UX-PhongCanh`, `docs/03-BUSINESS-NghiepVu`, `docs/04-DATABASE`, `docs/05-BACKEND-MayChu`, hoặc workflow docs ở root `docs/`.

---

## Mục Đích

Thư mục này giữ tài liệu làm việc trong quá trình lập kế hoạch:

- `specs/`: ghi chú phân tích, audit, discovery, draft spec.
- `plans/`: implementation plan và handoff checklist tại một thời điểm.

Các file này hữu ích để truy vết, nhưng không tự động là Source of Truth hiện tại.

---

## Quy Tắc

- File `*-draft.md` là draft nếu chưa được promote vào Source of Truth.
- File `*-bridge.md` hoặc `implementation-bridge` là tài liệu nối mạch, không thay thế SoT.
- File trong `plans/` là hướng dẫn implement tại thời điểm lập plan, không phải trạng thái dự án hiện tại.
- Cleanup plan tạm phải xoá sau khi cleanup đã commit, trừ khi Owner yêu cầu giữ.
- Nếu plan/draft mâu thuẫn với Source of Truth mới hơn hoặc quyết định Owner mới hơn, theo tài liệu/quyết định mới hơn.
- Không xoá plan/draft lịch sử nếu Owner chưa yêu cầu rõ.

---

## Promote Vào Source of Truth

Khi draft hoặc plan được chốt, Spec copy hoặc tóm tắt phần đã duyệt vào đúng tầng:

- UX behavior: `docs/02-PRD-UX-PhongCanh/`
- Business rules: `docs/03-BUSINESS-NghiepVu/`
- Database schema: `docs/04-DATABASE/`
- Backend/API contract: `docs/05-BACKEND-MayChu/`
- Workflow/governance: `AI_TEAM_RULES.md` hoặc root `docs/WORKFLOW-*.md`

Sau khi promote, file gốc trong `superpowers/` chỉ còn vai trò trace/history.
