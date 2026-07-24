# Trạng thái dùng chung TeamAI

Cập nhật: `2026-07-24`

`Y:\TeamAI\WORKER-NOW.md` là sổ trạng thái phối hợp, không phải nơi giao việc. Owner quyết scope;
worker dùng board để tránh overlap, biết commit cần pull và trạng thái NAS/runtime.

## Trước khi sửa repository

1. Đọc `Y:\TeamAI\WORKER-NOW.md` khi truy cập được.
2. Chạy `git pull --ff-only` và `npm run preflight`.
3. Claim scope/file/module đang chạm.
4. Tránh scope có active claim; có conflict thì dừng và điều phối lại.
5. Đọc board lần nữa khi xong task trước task tiếp theo.

Ngoài CI, `preflight` kiểm tra board tồn tại và đúng marker.

## Ghi lên board

Chỉ ghi trạng thái cần cho người khác:

- owner/worker;
- module, page/API, file đang chạm;
- trạng thái `active`, `completed`, `blocked` hoặc `idle`;
- commit/hash đã push (nếu có);
- ghi chú pull/restart/smoke/NAS;
- blocker cần Owner quyết.

Không dùng board giao task. Git vẫn là nguồn sự thật cho code, docs, history và merge safety.

## Mẫu board tương thích preflight

```markdown
# TeamAI Worker Now

Cập nhật: YYYY-MM-DD HH:mm

## Shared Repo State

- Latest pushed commit to pull:
- NAS/runtime note:
- DB note:

## Worker Status

| Worker | Trạng thái | Scope | Files being touched | Last pushed commit | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| worker-a | idle | - | - | - | pull before editing |
| worker-b | idle | - | - | - | pull before editing |

## Quy tắc

- Đây là trạng thái, không phải giao việc.
- Đọc trước khi sửa.
- Pull commit được ghi trước khi sửa repository.
- Không chạm file/module có active claim.
- Có conflict: dừng và hỏi Owner.
```
