# Bắt đầu làm việc QCVL

Cập nhật: `2026-07-24`

Đây là file đầu tiên cho mọi worker. Giữ ngắn và đúng hiện hành.

## Runtime và điều phối

- Branch chung: `main`; source chung: `origin/main`.
- Board: `Y:\TeamAI\WORKER-NOW.md` khi truy cập được.
- Local dev: `http://127.0.0.1:3202`; NAS release target duy nhất: `http://100.84.228.125:3200`.
- Runtime source: PostgreSQL NAS; không dùng Supabase.
- Claim scope/file trên board trước khi sửa, không overlap claim active.
- Scope hoàn tất, commit sạch và verification pass sẽ release direct `3200`; không cần Owner xác nhận deploy riêng. Destructive data workflow giữ checkpoint/Owner approval riêng.

## Bắt đầu task

```powershell
git pull --ff-only
npm run preflight
```

Nêu module, file, page/API và target (`3200`, docs hoặc local dev). Với lỗi local, kiểm tra process thật:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '3100|3202|server/index|vite|tsx' } | Select-Object ProcessId,CommandLine
```

Sửa đúng repo đang phục vụ `3100`; không giả định nó là thư mục shell hiện tại.

## Thứ tự đọc

1. `AI_TEAM_RULES.md`.
2. `docs/AI/README.md`.
3. `docs/PROJECT-COORDINATION.md`.
4. `docs/CURRENT-DATA-SOURCE.md`.
5. Tài liệu feature của page/API chạm.
6. Code hiện hành.
7. Audit callers, duplicate/dead/obsolete code, rule, docs, plan và script liên quan.

Kế hoạch/spec lịch sử chỉ truy bằng Git history khi cần evidence; không coi là workflow hiện hành.

## Dừng trước khi đổi

Dừng và xin quyết định Owner khi chưa có contract rõ cho tiền, nợ, lifecycle hóa đơn, kho, import, quyền,
schema không migration, destructive data operation hoặc file đang thuộc claim khác. Release code đã verified lên `3200` không cần gate riêng.

## Kết thúc tốt

- Chạy focused tests/verification.
- Dọn duplicate/dead/stale scope đã chạm hoặc tạo plan con có link.
- Kiểm tra `git status --short`; commit verified scope, push và release direct `3200` qua `npm run deploy:nas:image`.
- Ghi commit hash, active image, health PostgreSQL và smoke result. Nếu release fail, ghi rollback evidence.
