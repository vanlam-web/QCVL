# QCVL NAS Dev Runbook

> Cập nhật: 2026-07-09.

## Latest NAS Deploy - 2026-07-09 SalesDocuments Filter

Da deploy len NAS thay doi bo loc trang Hoa don/SalesDocuments:

- Sidebar dung checkbox nhieu chon cho `type`, `status`, `payment_status`.
- Backend NAS phai nhan query comma: `type=invoice,quote`, `status=active,completed`, `payment_status=unpaid,partial,paid`.
- Neu bo het mot nhom checkbox, frontend gui `__none__` va backend tra rong.
- Khong tao filter giao hang, COD, doi tac giao hang, kenh ban, HĐĐT, VAT khi schema/API chua co du lieu that.
- Proof sau restart `qcvl-app`: `GET /api/v1/sales-documents?status=active,completed&page=1&page_size=5` tra `total=24`.
- Proof UI: `http://100.84.228.125:3200/sales-documents` co dong hoa don, checkbox `Da huy` khong duoc check mac dinh, khong con trang rong do backend cu khong hieu comma.
- `npm run smoke:nas` pass voi `/pos`, `/products`, `/customers`, `/finance`, `/sales-documents`; `apiCallCount=17`.

Luu y khi test local:

- Neu khong set `VITE_API_BASE_URL`, frontend dev fallback sang `http://100.84.228.125:3200`.
- Khi sua ca frontend va backend, phai test bang dung cap frontend/backend cung phien ban.
- Loi da gap: frontend local `127.0.0.1:3202` gui `status=active,completed` vao backend NAS cu, backend cu chi so sanh chuoi don nen tra rong. Cach dung la deploy backend tuong ung len NAS, hoac chay API dev cung code moi.

## 1. Trạng thái hiện hành

| Mục | Giá trị |
| --- | --- |
| Workspace local | `D:\Phần mềm\QCVL` |
| Dev URL local | `http://127.0.0.1:3201` hoặc `http://127.0.0.1:3202` |
| NAS URL | `http://100.84.228.125:3200` |
| NAS share root | `\\100.84.228.125\docker\QCVL` |
| Live frontend path | `\\100.84.228.125\docker\QCVL\app\dist` |
| Live backend path | `\\100.84.228.125\docker\QCVL\app\dist-server` |
| NAS app container | `qcvl-app` |
| NAS database | PostgreSQL 16 container `qcvl-postgres` |
| Runtime | React/Vite frontend + QCVL Node API + PostgreSQL |

Browser chỉ được gọi API qua `http://100.84.228.125:3200`. Port `3100` là port trong container, không dùng trong frontend bundle.

## 2. Quyết định kiến trúc

QCVL không dùng Supabase.

Không dùng:

- Supabase CLI.
- Supabase local Docker.
- Supabase Edge Functions.
- Supabase Auth.
- Supabase SDK.
- `VITE_SUPABASE_*`, `SUPABASE_*`.
- `supabase/` folder hoặc npm script `supabase:*`.

Đang dùng:

- Frontend React/Vite.
- Backend QCVL Node API trong `server/`.
- PostgreSQL trên NAS.
- Docker chỉ dùng cho container app/PostgreSQL trên NAS.

Demo/test data phải ghi vào PostgreSQL/API runtime của QCVL, không ghi vào Supabase.

Sales/finance runtime data source of truth:

- POS checkout, báo giá, thu nợ khách, công nợ khách và sổ quỹ mới phải ghi vào PostgreSQL.
- Không coi mảng demo trong `server/http.ts` là nguồn lưu bền.
- Sau thay đổi schema sales/finance phải chạy `npm run db:migrate` trước khi restart NAS.
- Trước khi deploy NAS, phải test khách `DEV20-KH-011`: tạo hóa đơn, trả ngân hàng một phần, restart server, hóa đơn/nợ/sổ quỹ vẫn còn.
- 2026-07-09 proof tren NAS: `HD-POS-021-4330498D` va `PT-CN-MRD47JDC-72CF` van ton tai sau restart `qcvl-app`; document partial, con no `200000`, cashbook co phieu thu.
- Loi `inconsistent types deduced for parameter $2` khi thu no la loi SQL cast tien; fix dung la ep `$2::numeric` trong query cap nhat `customer_debt_entries`.
- Lệnh kiểm bền sales/finance:

```powershell
$env:QCVL_VERIFY_BASE_URL='http://100.84.228.125:3200'
$env:QCVL_VERIFY_PASSWORD='<mật khẩu admin>'
npm run verify:sales-finance-persistence
Remove-Item Env:\QCVL_VERIFY_BASE_URL
Remove-Item Env:\QCVL_VERIFY_PASSWORD
```

Sau khi lệnh in `orderCode` và `receiptCode`, restart app rồi kiểm lại cùng chứng từ:

```powershell
$env:QCVL_VERIFY_BASE_URL='http://100.84.228.125:3200'
$env:QCVL_VERIFY_PASSWORD='<mật khẩu admin>'
$env:QCVL_VERIFY_ORDER_CODE='<orderCode vừa in>'
$env:QCVL_VERIFY_RECEIPT_CODE='<receiptCode vừa in>'
npm run verify:sales-finance-persistence
Remove-Item Env:\QCVL_VERIFY_BASE_URL
Remove-Item Env:\QCVL_VERIFY_PASSWORD
Remove-Item Env:\QCVL_VERIFY_ORDER_CODE
Remove-Item Env:\QCVL_VERIFY_RECEIPT_CODE
```

## 3. Dev URL và NAS URL

| URL | Mục đích | Cách cập nhật |
| --- | --- | --- |
| `http://127.0.0.1:3201` / `http://127.0.0.1:3202` | Preview local | Chạy từ workspace local |
| `http://100.84.228.125:3200` | NAS dev cho owner kiểm tra | Build local rồi copy lên NAS |

## 3A. Quy định đưa lên đâu

| Loại | Đưa lên NAS? | Đưa lên Git? | Giữ ở máy local? | Ghi chú |
| --- | --- | --- | --- | --- |
| Frontend build `dist/` | Có | Không bắt buộc | Có sau build | Copy vào `\\100.84.228.125\docker\QCVL\app\dist` |
| Backend build `dist-server/` | Có | Không bắt buộc | Có sau build | Copy vào `\\100.84.228.125\docker\QCVL\app\dist-server` |
| Runtime source `server/`, `src/`, `public/` | Có khi NAS còn tự build lúc restart | Có | Có | NAS compose hiện chạy `npm ci && npm run build:all && npm run api:start`, nên vẫn cần source/config build |
| Build config `package.json`, `package-lock.json`, `tsconfig*`, `vite.config.ts`, `index.html` | Có | Có | Có | Cần cho NAS build/restart |
| Database/runtime scripts `database/`, `scripts/db-migrate.mjs`, `scripts/seed-dev20-data.mjs` | Có khi cần migrate/seed NAS | Có | Có | Không copy test/import script lên NAS |
| Tài liệu `docs/` | Không | Có | Có | Docs chỉ giữ ở local/git, không đưa lên NAS |
| Test/dev tooling `.github/`, `tests/`, `eslint.config.js`, `playwright.config.ts`, `vite.config.test.ts`, `AI_TEAM_RULES.md`, `Dockerfile`, `docker-compose.nas.yml`, script test/import | Không | Có nếu thuộc repo | Có | Không cần cho runtime NAS hiện tại |
| NAS root `.env`, `docker-compose.yml`, `postgres/` | Có, chỉ ở NAS | Không commit secret/data | Không cần local | `.env` có secret; `postgres/` là dữ liệu runtime |
| `node_modules/` | Có trên NAS do `npm ci` tạo | Không | Có local | Không copy thủ công nếu không cần |

Quy tắc:

- Sửa local không tự xuất hiện trên NAS.
- Kiểm tra local trước khi cần.
- Khi owner nói đưa lên NAS, build và copy một lần vào `\\100.84.228.125\docker\QCVL\app`.
- Sau sửa nghiệp vụ POS/checkout/công nợ, phải test trên dev local trước; chỉ deploy `3200` sau khi test/API xác nhận đúng.
- Nếu sửa schema PostgreSQL, phải copy `database/schema.sql` và chạy `npm run db:migrate` trên môi trường đích trước khi restart `qcvl-app`.
- Hóa đơn POS nợ toàn bộ phải có `payment_status = unpaid`, được cộng vào `total_debt_amount` của khách và xuất hiện trong chi tiết nợ cần thu.
- Docs chỉ giữ ở workspace local/git, không copy lên NAS.
- Nếu chỉ sửa docs, không cần build frontend và không cần đụng NAS.
- Nếu frontend gọi `http://100.84.228.125:3100/api/...`, build đang sai env hoặc fallback sai; sửa về `http://100.84.228.125:3200` rồi build/deploy lại.
- Sau build NAS phải chạy `npm run verify:nas-bundle` để chặn bundle gọi nhầm `:3100`.
- Không tạo/copy thêm bản `dist`, `dist-server`, `server`, `docs` ở ngoài `app`; Docker NAS chỉ mount `\\100.84.228.125\docker\QCVL\app`.

## 4. Build và deploy

Quy trinh rut gon, uu tien dung:

```powershell
npm run build:nas
npm run verify:nas-bundle
npm run health:nas
```

Dry-run deploy, khong copy that:

```powershell
npm run deploy:nas
```

Deploy that khi owner noi ro dua len NAS:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
```

Deploy that va restart `qcvl-app` khi co thay doi backend/server/runtime:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_RESTART='true'
$env:QCVL_NAS_SSH_TARGET='<nas-user>@100.84.228.125'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_RESTART
Remove-Item Env:\QCVL_NAS_SSH_TARGET
```

`deploy:nas` tu chay build, verify bundle, copy dung runtime path va health check. Mac dinh la dry-run de tranh day nham len NAS. Phan lenh copy tay ben duoi chi giu de tham khao/debug khi script loi.

Build:

```powershell
$env:VITE_API_BASE_URL='http://100.84.228.125:3200'
$env:VITE_APP_ENV='nas-dev'
Remove-Item Env:\VITE_ENABLE_PWA -ErrorAction SilentlyContinue
cmd /c npm run build:all
```

Verify bundle:

```powershell
npm run verify:nas-bundle
```

Copy lên NAS:

```powershell
robocopy 'D:\Phần mềm\QCVL\dist' '\\100.84.228.125\docker\QCVL\app\dist' /MIR /NFL /NDL /NJH /NJS /NP
robocopy 'D:\Phần mềm\QCVL\dist-server' '\\100.84.228.125\docker\QCVL\app\dist-server' /MIR /NFL /NDL /NJH /NJS /NP
robocopy 'D:\Phần mềm\QCVL\server' '\\100.84.228.125\docker\QCVL\app\server' /E /NFL /NDL /NJH /NJS /NP
robocopy 'D:\Phần mềm\QCVL\src' '\\100.84.228.125\docker\QCVL\app\src' /E /NFL /NDL /NJH /NJS /NP
robocopy 'D:\Phần mềm\QCVL\public' '\\100.84.228.125\docker\QCVL\app\public' /E /NFL /NDL /NJH /NJS /NP
robocopy 'D:\Phần mềm\QCVL\database' '\\100.84.228.125\docker\QCVL\app\database' /E /NFL /NDL /NJH /NJS /NP
Copy-Item 'D:\Phần mềm\QCVL\package.json' '\\100.84.228.125\docker\QCVL\app\package.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\package-lock.json' '\\100.84.228.125\docker\QCVL\app\package-lock.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\index.html' '\\100.84.228.125\docker\QCVL\app\index.html' -Force
Copy-Item 'D:\Phần mềm\QCVL\vite.config.ts' '\\100.84.228.125\docker\QCVL\app\vite.config.ts' -Force
Copy-Item 'D:\Phần mềm\QCVL\tsconfig.json' '\\100.84.228.125\docker\QCVL\app\tsconfig.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\tsconfig.app.json' '\\100.84.228.125\docker\QCVL\app\tsconfig.app.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\tsconfig.node.json' '\\100.84.228.125\docker\QCVL\app\tsconfig.node.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\tsconfig.server.json' '\\100.84.228.125\docker\QCVL\app\tsconfig.server.json' -Force
Copy-Item 'D:\Phần mềm\QCVL\scripts\db-migrate.mjs' '\\100.84.228.125\docker\QCVL\app\scripts\db-migrate.mjs' -Force
Copy-Item 'D:\Phần mềm\QCVL\scripts\seed-dev20-data.mjs' '\\100.84.228.125\docker\QCVL\app\scripts\seed-dev20-data.mjs' -Force
```

`robocopy` exit code `0`, `1`, `2`, `3` là thành công. Lớn hơn `3` là lỗi.

Restart `qcvl-app` khi có thay đổi backend/server/runtime. Nếu chỉ copy frontend static, thường không cần restart.

Smoke sau deploy:

```powershell
$env:QCVL_SMOKE_PASSWORD='<mật khẩu tài khoản admin QCVL>'
npm run smoke:nas
Remove-Item Env:\QCVL_SMOKE_PASSWORD -ErrorAction SilentlyContinue
```

Smoke phải pass trước khi báo owner rằng NAS đã sẵn sàng. Script fail nếu:

- Bất kỳ API response `>= 400`.
- Browser gọi `100.84.228.125:3100`.
- Trang hiện `Máy chủ gặp lỗi` hoặc `Mã lỗi:`.

## 5. Demo data bắt buộc

- NAS và dev local phải có bộ demo đủ để test các trang chính.
- Khách mặc định phải là `KH000001 - Khách lẻ`.
- Nếu POS tạo báo giá/hóa đơn khi chưa chọn khách, backend phải gắn vào `KH000001 - Khách lẻ`.
- Không tạo bucket công nợ với `customer_id = null`.
- Dữ liệu demo cần có tối thiểu khách hàng, hàng hóa, nhà cung cấp, chứng từ bán, phiếu thu/chi, tồn kho.

## 6. Smoke check sau deploy

Mở:

```text
http://100.84.228.125:3200/login
http://100.84.228.125:3200/dashboard
http://100.84.228.125:3200/pos
http://100.84.228.125:3200/products
http://100.84.228.125:3200/customers
http://100.84.228.125:3200/sales-documents
http://100.84.228.125:3200/finance
```

Kiểm tra thêm nếu vừa sửa POS:

- K01 tiện ích có nút `Khui vật tư`.
- Không còn khu riêng `K01 khui vật tư`.
- POS search dùng `.management-compact-search`.
- POS profile menu dùng `.account-menu-popover`.
- Tạo hóa đơn ghi vào chứng từ và sổ quỹ khi có thanh toán.

## 7. Lỗi có mã request

Nếu UI báo `Máy chủ gặp lỗi... Mã lỗi: req-...`:

- Mã đó dùng để tra log backend tương ứng request.
- Cần xem log `qcvl-app` hoặc server log theo mã request.
- Không đoán lỗi từ UI nếu chưa đọc log.
