# Quy tắc làm việc QCVL

Cập nhật: `2026-07-24`

Đọc [WORKER-START-HERE.md](docs/WORKER-START-HERE.md) trước, rồi đọc file này trước khi làm việc.

## 1. Gate trước khi làm

Chạy trước khi sửa, test, build hoặc deploy:

```powershell
git pull --ff-only
npm run preflight
```

`preflight` kiểm tra các tài liệu bắt buộc: `WORKER-START-HERE`, `AI_TEAM_RULES`, `PROJECT-COORDINATION`,
`DOCUMENT_RULES`, `CURRENT-DATA-SOURCE`. Trước khi sửa, nêu scope: module, file, page/API, môi trường.
Cập nhật `Y:\TeamAI\WORKER-NOW.md` khi có thể trước/sau mỗi task.

## 2. Runtime hiện hành

- QCVL; local dev UI `3202`, local dev API `3100`, NAS release target duy nhất `3200`.
- React/Vite frontend, Node API ở `server/`, PostgreSQL NAS.
- Không dùng Supabase cho runtime.
- `main` trên `origin` là source chung trừ khi Owner chỉ định khác.

## 3. Thứ tự nguồn sự thật

1. Quyết định mới nhất của Owner trong chat.
2. Tài liệu active đã cập nhật theo quyết định đó.
3. Code/runtime hiện hành.
4. Git history chỉ dùng làm evidence/bối cảnh.

Code lệch quyết định Owner là drift: xác minh rồi sửa hoặc báo rõ.

## 4. Ownership và phối hợp

- Đọc `PROJECT-COORDINATION.md`, claim file/module trước khi sửa.
- Không chồng claim active. Có overlap, pull fail hoặc local change lạ: dừng và điều phối lại.
- Commit/push/deploy sau khi scope hoàn tất, checklist đóng và verification pass; không cần Owner xác nhận deploy riêng.
- NAS release target duy nhất là `3200`; dùng `npm run deploy:nas:image` từ máy có NAS access. Image deploy phải có commit sạch, migration safety, health, smoke và rollback.
- Mutation destructive, migration phá vỡ tương thích hoặc repair dữ liệu vẫn cần checklist riêng: source freeze, allow-list, checkpoint, dry-run, Owner approval, transaction, post-audit và rollback evidence.
- `3202` chỉ là local development; không là staging/promotion target. Không dùng local process để suy diễn NAS runtime.
- `logs/dev-memory-state.json` chỉ là state local, không copy lên NAS.

## 6. Dữ liệu và database

PostgreSQL là runtime source of truth cho bán hàng, tài chính, công nợ, kho, import state và người dùng.

Thay đổi DB phải có migration trong `database/migrations`, dry-run/status trước deploy, test/doc cho hành vi tiền,
nợ, kho, hóa đơn, import. Không đưa schema guard vào read/list API.

```powershell
npm run db:migrate:dry-run
```

## 7. Cách làm

- Đọc tài liệu domain trước code; dùng pattern/shared component sẵn có.
- Tách UI shell khỏi business/data logic. Không refactor ngoài scope hoặc revert thay đổi Owner.
- Hành vi ảnh hưởng tiền, nợ, kho, hóa đơn, import, quyền cần Owner quyết định khi chưa có contract rõ.
- Chữ tiếng Việt phải là UTF-8 thật; sau khi sửa quét mojibake.
- Mở plan/scope nào phải làm đến điều kiện đóng và verification pass trước khi báo xong.
  Chỉ được `Blocked` khi có evidence exact cần Owner quyết; không đổi scope để bỏ dở bước an toàn.

## 8. Dọn triệt để, không giữ rác

1. Chạm module nào audit module đó: dead code/import, helper trùng, legacy path, expired flag, fixture/script vô dụng.
2. Audit cả tài liệu/rule/plan/script liên quan: xóa nội dung stale, mâu thuẫn hoặc không còn giá trị.
3. Một business rule chỉ có một contract chung; chuyển mọi caller trong scope.
4. Rule thay thế phải cập nhật entrypoint, feature docs, board và plan liên quan.
5. Không giữ legacy path “phòng hờ”; rollback dùng Git/checkpoint/migration rollback.
6. Historical evidence dùng Git history hoặc archive đánh dấu rõ, không để chỉ dẫn workflow active.
7. Scope cleanup rộng: tạo plan con có evidence/checklist/điều kiện đóng rồi quay plan cha.
8. Không xóa code có caller, migration history, audit evidence hoặc public contract khi chưa truy nguồn/caller và có replace path.
9. Closing report nêu rõ thứ đã xóa/chuẩn hóa hoặc evidence không cần cleanup.

## 9. Checklist là gate bắt buộc

1. Mọi scope phải có checklist Markdown, item atomic, owner/evidence/điều kiện pass rõ khi cần.
2. Không dùng prose, `Proposed Changes`, `Verification Plan`, trạng thái hay câu “đã làm” để thay checklist.
3. Mỗi hành động phải đi qua trạng thái: `[ ]` chưa làm → `[~]` đang làm → `[x]` xong có evidence, hoặc `[!] Blocked` có evidence exact và quyết định Owner cần thiết.
4. Không sửa/execute item sau khi scope chưa được checklist hóa. Không báo xong, không đóng plan, không chuyển plan cha khi còn `[ ]`, `[~]`, hoặc `[!] Blocked` chưa có quyết định Owner.
5. Checklist bắt buộc có tối thiểu: scope/source, thay đổi, verification, post-audit nếu data/runtime, cập nhật docs/plan/walkthrough và điều kiện đóng.
6. Với destructive operation: checklist riêng cho source freeze, allow-list, checkpoint, dry-run, Owner approval, transaction, post-audit, rollback evidence.
7. Tài liệu active mô tả quy trình phải dùng checklist khi có bước thao tác; không diễn đạt requirement thao tác chỉ bằng đoạn văn.
8. Khi phát hiện checklist thiếu hoặc tài liệu/plan lệch rule: dừng scope liên quan, sửa checklist/rule trước, rồi tiếp tục.

## 10. Xác minh và Git

- Trước khi kết luận xong, chạy focused verification và nêu kết quả chính xác.
- UI: kiểm tra browser khi khả thi. Release `3200`: commit sạch, build/typecheck/focused test/preflight, migration safety, health và smoke route/page đã chạm.
- Commit/push verified scope rồi release direct `3200`; báo commit hash, active image, health/smoke result.
- Nếu release fail: đọc full log, xác nhận rollback image/health; không che lỗi hoặc tự deploy lại khi chưa biết nguyên nhân.
