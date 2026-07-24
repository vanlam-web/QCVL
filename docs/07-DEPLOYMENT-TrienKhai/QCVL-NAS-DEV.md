# Runbook release trực tiếp NAS QCVL `3200`

Cập nhật: `2026-07-24`

## Quy tắc

- NAS release target duy nhất: `http://100.84.228.125:3200`.
- `3202` chỉ local development, không là staging hoặc promotion target.
- Khi scope hoàn tất, checklist đóng, commit sạch và verification pass: commit/push rồi release direct `3200`; không cần Owner xác nhận deploy riêng.
- Import/xóa/repair destructive, migration phá vỡ tương thích vẫn cần checkpoint Owner và rollback evidence riêng.
- Không dùng copy tay `robocopy`/`Copy-Item`; dùng image deploy để có checksum, migration, restart, health, smoke và rollback tự động.

## Cấu hình release

Máy trong LAN dùng SMB LAN `\\192.168.1.188\docker\QCVL`. Không dùng SMB qua Tailscale.

```powershell
$env:QCVL_NAS_IMAGE_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_ENV_PATH='\\192.168.1.188\docker\QCVL\.env'
$env:QCVL_NAS_SSH_TARGET='adminnas@192.168.1.188'
$env:QCVL_NAS_SSH_KEY="$env:USERPROFILE\.ssh\qcvl_nas_ed25519"
$env:QCVL_SMOKE_PASSWORD='<runtime secret>'
npm run deploy:nas:image
Remove-Item Env:\QCVL_NAS_IMAGE_DEPLOY_CONFIRM,Env:\QCVL_NAS_ENV_PATH,Env:\QCVL_NAS_SSH_TARGET,Env:\QCVL_NAS_SSH_KEY,Env:\QCVL_SMOKE_PASSWORD
```

`deploy:nas:image` yêu cầu Git commit sạch, tạo image theo commit, kiểm checksum, chạy migration trong image mới, switch/restart `qcvl-app`, health PostgreSQL, smoke khi có password và rollback image trước nếu fail.

## Checklist release bắt buộc

- [ ] Scope hoàn tất, không còn item checklist mở.
- [ ] `git status --short` sạch sau commit; không commit secret/dump/backup/log hoặc artifact build.
- [ ] `npm run typecheck`, focused tests và `npm run preflight` pass.
- [ ] Migration đã review; destructive data/migration có checkpoint riêng.
- [ ] NAS access kiểm tra qua SMB LAN và SSH batch mode.
- [ ] Chạy `npm run deploy:nas:image` với config trên.
- [ ] Xác minh `npm run deploy:nas:image:status`, `npm run health:nas`, `npm run smoke:nas`.
- [ ] Ghi Git SHA, active image, health/smoke result hoặc rollback result vào handoff/walkthrough.

## Kiểm tra NAS trước release

```powershell
Test-Path '\\192.168.1.188\docker\QCVL\.env'
ssh -i "$env:USERPROFILE\.ssh\qcvl_nas_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes adminnas@192.168.1.188 "echo ok"
npm run deploy:nas:image:status
```

## Cấm

- Không reset/delete container, volume hoặc PostgreSQL để “sửa nhanh”.
- Không release working tree dirty.
- Không tuyên bố release xong nếu chỉ copy/build mà thiếu active-image, health PostgreSQL và smoke route/page đã chạm.
- Không dùng `3202` như một bước rollout hoặc như evidence `3200` đã chạy code mới.

## Sự cố

| Hiện tượng | Kiểm tra trước |
|---|---|
| Release fail | Đọc full deploy log; script phải rollback image cũ và health lại. |
| `3200` sai sau release | Active image, Git SHA, migration/schema, `qcvl-app` image ID và health. |
| Health không phải PostgreSQL | NAS `.env`, `DATABASE_URL`, migration và container log. |
| API route mới trả 404 | Active image và process `qcvl-app`; không kiểm local `3202`. |
| SMB không truy cập | Dùng LAN SMB `192.168.1.188`, kiểm tra quyền/share. |

Lịch sử rollout `3202` chỉ truy bằng Git history khi cần evidence.
