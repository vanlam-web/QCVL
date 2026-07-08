# Phase 0 Runbook

> **Hiện tại:** backend chính cho dev/staging là Supabase Cloud. Docker/Supabase local chỉ dùng khi cần isolated local database/test.

## Dev/staging verification with Supabase Cloud

Tạo `.env.local` trỏ tới Supabase Cloud dev/staging project:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<cloud-anon-key>
VITE_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/api
VITE_APP_ENV=staging
```

Kiểm tra app/frontend:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Kiểm tra Edge Function/API với Cloud cần dùng secret/CLI được cấp quyền theo quy trình deploy hiện tại. Không commit key thật vào repo.

## Optional local isolated verification

Chỉ dùng luồng này khi cần test database/migration/RLS/pgTAP cô lập hoặc khi không muốn tác động Supabase Cloud dev/staging.

Yêu cầu Docker Desktop/Supabase CLI khỏe:

```bash
npm run supabase:start
npm run supabase:reset
npm run test:functions
```

Nếu cần test DB:

```bash
npm run test:db
```

Run E2E with externally supplied credentials:

```bash
export E2E_ADMIN_EMAIL="admin@example.test"
# Provide E2E_ADMIN_PASSWORD from your local shell/session secret.
# Optional: export E2E_API_BASE_URL only when E2E API base differs from <SUPABASE_URL>/functions/v1.
npm run test:e2e
```

Playwright derives `VITE_API_BASE_URL` from the selected Supabase URL during E2E, so stale local `VITE_API_BASE_URL` values do not mix cloud API with local Auth/DB.

Never commit Auth passwords, refresh tokens, access tokens, anon/service keys, or `.env.local` files.

## Phase 0 staging limitation

The in-memory rate limiter is acceptable only for a single staging instance. Before multi-instance production traffic, replace it with a distributed store keyed by user and route group.

## Current local blocker

Docker Desktop/Supabase local có thể không ổn định trên một số máy. Đây không còn là blocker cho dev thường nếu Supabase Cloud dev/staging đang hoạt động. Chỉ cần xử lý Docker local khi task yêu cầu isolated DB/migration verification.
