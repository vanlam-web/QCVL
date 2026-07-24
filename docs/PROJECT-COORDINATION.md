# Điều phối dự án QCVL

Cập nhật: `2026-07-24`

Dùng board này để tránh overlap. Claim theo scope, không theo vị trí máy.

## Claim scope

Claim active phải nêu owner, file/module, môi trường, trạng thái, bước tiếp, blocker. Release `3200` chạy sau khi scope có commit sạch và verification pass; destructive data/migration risk vẫn cần checklist checkpoint riêng.

Trước khi sửa:

```powershell
git pull --ff-only
npm run preflight
```

Nêu scope trong chat và cập nhật `Y:\TeamAI\WORKER-NOW.md` khi truy cập được.

## Xung đột

- Không sửa file/module có active claim chồng lấn.
- `git pull --ff-only` fail hoặc có local change lạ: dừng, báo và điều phối lại.
- Handoff phải cập nhật owner và next step.

## Board active

### DOC-LIFECYCLE-QCVL-2026-07-24

- Owner: worker hiện tại.
- Scope: lifecycle docs/rules, tiếng Việt UTF-8, QCVL display identity, stale/mojibake/link cleanup.
- Trạng thái: active.
- Bước tiếp: tiếp tục audit contract active còn English/stale, commit và release `3200` sau verification.
- Rủi ro: docs/PWA metadata; mutation runtime/data chỉ theo checklist an toàn riêng.

### RUNTIME-PERF-3200

- Owner: chưa phân công.
- Rule: đo mới trước khi sửa; không gộp vào scope documentation.

## Mẫu handoff

```text
Worker:
Scope:
Files:
Page/API:
Status:
Next:
Commit:
Blocked:
```
