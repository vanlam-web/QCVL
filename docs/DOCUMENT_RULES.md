# Quy tắc tài liệu QCVL

Cập nhật: `2026-07-24`

Tài liệu phải tiếng Việt UTF-8, ngắn, current-first và dẫn tới source sâu hơn thay vì chép timeline.

## Thứ tự ưu tiên

1. Quyết định mới nhất của Owner.
2. `AI_TEAM_RULES.md`.
3. `WORKER-START-HERE.md`.
4. File này.
5. `ARCHITECTURE.md`, layer `_RULES.md`, feature docs.
6. Git history chỉ làm evidence.

## Hình dạng bắt buộc

Tài liệu active cần có mục đích, ngày cập nhật, rule/fact hiện hành trước, link source sâu hơn. README chỉ điều
hướng. Xóa stale doc không còn evidence; evidence ở Git history hoặc archive ghi rõ. Không để tracker/plan/log
superseded chỉ dẫn workflow active.

## Trước khi sửa

```powershell
npm run preflight
```

Đọc file hiện tại và source link trực tiếp, giữ một source-of-truth cho mỗi fact, kiểm link và `git diff`.

## Phân lớp

| Nội dung | Nơi sở hữu |
|---|---|
| Quy tắc làm việc | `AI_TEAM_RULES.md` |
| Điểm vào worker | `WORKER-START-HERE.md` |
| Điều phối scope | `PROJECT-COORDINATION.md` |
| Nguồn dữ liệu runtime | `CURRENT-DATA-SOURCE.md` |
| UI/UX | `02-PRD-UX-PhongCanh/` |
| Nghiệp vụ | `03-BUSINESS-NghiepVu/` |
| Schema/migration | `04-DATABASE/`, `database/migrations/` |
| API/server | `05-BACKEND-MayChu/` |
| Triển khai/vận hành | `07-DEPLOYMENT-TrienKhai/` |

## Cấm

- Không chép log/timeline dài vào first-read docs.
- Không link giả, secret, dump DB, backup hoặc log tạm.
- Không mô tả hành vi code chưa hỗ trợ như đã triển khai.
- Không để tài liệu tầng dưới override Owner/rule active.

## Checklist quy trình bắt buộc

Tài liệu active có workflow/operation phải dùng checklist Markdown, không chỉ mô tả bằng prose.

- `[ ]` chưa làm; `[~]` đang làm; `[x]` hoàn tất kèm evidence; `[!] Blocked` chỉ khi có evidence exact và quyết định Owner cần thiết.
- Mỗi checklist workflow phải có source input, thao tác, guard/allow-list, verification, post-audit khi chạm runtime/data, update tài liệu/plan và điều kiện đóng.
- Không publish một quy trình khi checklist còn item mở; không thay checklist bằng heading “Phase”, “MVP”, “Proposed Changes” hoặc paragraph.
- Khi rule/tài liệu không tuân: sửa checklist/rule trước khi dùng quy trình đó.

## Xác minh

```powershell
npm run preflight
npx vitest run scripts/preflight.test.mjs scripts/test-script-scope.test.mjs
```

Sau khi sửa tiếng Việt, quét mojibake. Khi xóa/đổi tên tài liệu, chạy link audit toàn repo. Checklist scope chỉ được đánh `[x]` sau verification đã ghi evidence.
