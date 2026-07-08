# Optional internal shared-dev server

> **Vai trò:** Legacy/optional fallback nội bộ. Không phải backend mặc định hiện tại.

Backend chính cho dev/staging hiện tại là Supabase Cloud. Tài liệu này chỉ giữ lại cách chạy một Supabase local chung trong LAN/Tailscale khi cần phương án phụ, demo nội bộ, hoặc kiểm thử không muốn dùng Cloud.

Developer mới không cần bật Docker, Supabase CLI, máy chủ LAN hoặc Tailscale nếu đã có `.env.local` trỏ tới Supabase Cloud dev/staging.

## Khi nào dùng shared-dev LAN/Tailscale

Dùng phương án này khi:

- cần một database local chung cho nhiều máy trong nội bộ;
- Supabase Cloud dev/staging tạm không dùng được;
- cần thử nghiệm mạng nội bộ;
- cần fallback nhanh trước khi có môi trường Cloud phù hợp.

Không dùng phương án này làm mặc định cho dev thường.

## Model

```text
Internal Windows server
- Runs Docker Desktop
- Runs Supabase/Postgres local
- Optionally runs the shared web app on port 3000

Developer machines
- Install Git and Node.js 22
- Clone this repository
- Run the frontend only
- Connect to Supabase/API on the internal server
```

Developer machines do not need Docker Desktop or Supabase CLI unless they want their own isolated local database.

## Legacy/internal server addresses

These addresses are environment-specific and may change.

LAN:

```text
App:      http://192.168.1.104:3000
Supabase: http://192.168.1.104:54321
API:      http://192.168.1.104:54321/functions/v1/api
```

Tailscale:

```text
App:      http://100.123.122.45:3000
Supabase: http://100.123.122.45:54321
API:      http://100.123.122.45:54321/functions/v1/api
```

## Server commands

Run Supabase/Postgres on the internal server:

```powershell
cd "Y:\QC-OMS"
npm run supabase:start
npm run supabase:reset
```

Run the web app for other machines:

```powershell
cd "Y:\QC-OMS"
npm run dev:server
```

Open Windows Firewall inbound ports on the server:

```powershell
New-NetFirewallRule -DisplayName "QC-OMS App 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "QC-OMS Supabase API 54321" -Direction Inbound -Protocol TCP -LocalPort 54321 -Action Allow
```

Do not expose Postgres port `54322` broadly. Keep it for server/admin/backup.

## Developer machine commands

```powershell
git clone https://github.com/vanlam-web/QC-OMS.git
cd QC-OMS
npm ci
npm run dev
```

For LAN fallback, create `.env.local` with the internal LAN address:

```env
VITE_SUPABASE_URL=http://192.168.1.104:54321
VITE_SUPABASE_ANON_KEY=<local-shared-dev-anon-key>
VITE_API_BASE_URL=http://192.168.1.104:54321/functions/v1/api
VITE_APP_ENV=shared-dev
```

For Tailscale fallback:

```env
VITE_SUPABASE_URL=http://100.123.122.45:54321
VITE_SUPABASE_ANON_KEY=<local-shared-dev-anon-key>
VITE_API_BASE_URL=http://100.123.122.45:54321/functions/v1/api
VITE_APP_ENV=shared-dev
```

Never commit `.env.local`, service role keys, passwords, access tokens, refresh tokens, or real Cloud keys.
