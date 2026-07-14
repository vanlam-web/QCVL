# QCVL NAS Dev Runbook

> Cập nhật: 2026-07-10.

## Latest NAS State - 2026-07-13 Imported 3202 Data

Current promotion result:

- Local `3202` reviewed data was imported into NAS PostgreSQL for test operation.
- Import path uses `npm run import:dev-memory-to-postgres`; real write requires `QCVL_IMPORT_CONFIRM=true`.
- Script creates local backup `backups/dev-memory-state-*.json` before writing to NAS PostgreSQL.
- Snapshot/import groups currently covered: products, default prices, provisional KiotViet stock, BOM, stocktakes, customers, suppliers, purchase receipts, sales documents/orders.
- NAS `3200` must keep returning health `persistence: "postgres"`.
- Invoice cancel on NAS is fixed: cancelling a POS test invoice marks the order cancelled and closes related debt rows. Do not delete invoice rows physically.

Current next work is not another NAS deploy. It is local `3202` finance foundation:

1. Build real persisted `finance_accounts`.
2. Import KiotViet So Quy (`SoQuy_KV*.xlsx`) into accounts + cashbook.
3. Compare totals/filter results with KiotViet.
4. Promote to NAS only after owner accepts the 3202 result.

Do not copy `logs/dev-memory-state.json` directly to NAS. Use the import script and PostgreSQL migrations.

## Latest NAS Deploy - 2026-07-10 Product Import Schema Guard

Da sua loi NAS `/products` va import hang hoa bi `May chu gap loi`:

- Root cause: code da duoc copy tu dev len NAS, nhung PostgreSQL NAS van giu schema cu. Bang `inventory_provisional_balances` thieu cot `note` va thieu unique index `(organization_id, product_id, source_type)`, nen import KiotViet bi 500.
- Fix code: `ensureInventoryProvisionalBalancesTable` phai `alter table ... add column if not exists` cho cac cot runtime can dung, va tao unique index `inventory_provisional_balances_org_product_source_uidx`.
- Fix du lieu NAS ngay 2026-07-10: da bo sung cot/index tren PostgreSQL NAS, deploy code guard len NAS, `health:nas` tra `ok`.
- Proof sau deploy: `GET /api/v1/products?status=active&page=1&page_size=15` tra `total=382`, `total_all=496`; preview import hang hoa thanh cong; full import file KiotViet thanh cong voi `valid_rows=382`, `updated_rows=382`, `provisional_stock_updated_rows=214`, `bom_updated_rows=103`.

Quy tac bat buoc sau nay:

- Deploy code khong dong nghia DB dev va DB NAS giong nhau. Moi thay doi backend co them bang/cot/index phai co schema guard hoac migration ro rang.
- Neu API NAS tra `May chu gap loi` kem `req-...`, dung trace/log de tim loi goc. Khong sua UI truoc khi biet loi SQL/backend.
- Sau deploy lien quan import, phai test ca 3 buoc: list page, preview import, full import.

## Environment Parity Rule - 3202 va 3200

Muc tieu: `127.0.0.1:3202` la noi test truoc, `100.84.228.125:3200` la ban NAS duoc dua len sau khi chot. Hai moi truong chi duoc coi la "giong nhau nhu duc" khi cung thoa ca 3 dieu kien:

- Cung code/build tu workspace hien tai.
- Cung danh sach migration da apply trong `schema_migrations`.
- Cung quy trinh verify sau deploy: health, API danh sach, import preview/full neu thay doi import.

Quy tac bat buoc:

- Neu sua backend co tao bang/cot/index/constraint moi, phai them file `database/migrations/NNNN_*.sql`. Khong chi dua logic `ensure...` trong `server/db.ts`.
- Khong goi schema guard trong API doc danh sach/doc du lieu nhu `/products` hoac `/inventory/stocktakes`. Cac API doc phai gia dinh migration da chay xong; neu thieu schema thi fail som de sua migration.
- `deploy:nas` phai chay `db:migrate` truoc `health:nas`. Neu migration fail thi dung deploy, khong bao NAS san sang.
- Moi lan lam tren `3202`, ghi thay doi vao docs/plan lien quan truoc khi dua `3200`.
- Neu `3200` loi ma `3202` khong loi, kiem tra migration truoc: code giong nhung DB lech van la loi deploy.

Lenh kiem tra trang thai moi truong:

```powershell
$env:QCVL_ENV_NAME='nas'
$env:QCVL_ENV_BASE_URL='http://100.84.228.125:3200'
$env:DATABASE_URL='<DATABASE_URL cua NAS hoac dev>'
npm run env:status
Remove-Item Env:\QCVL_ENV_NAME
Remove-Item Env:\QCVL_ENV_BASE_URL
Remove-Item Env:\DATABASE_URL
```

Quy trinh chuan tu bay gio:

- Sua va test truoc tren `127.0.0.1:3202`.
- Neu can API dev, chay API `3100`; Vite `3202` proxy `/api` sang `3100`.
- Khi owner chot dua len NAS, dung `deploy:nas` ben duoi. Script deploy that se restart `qcvl-app` qua SSH va health check `persistence: "postgres"`.
- Khong vao DSM/Web NAS de restart thu cong tru khi SSH/Container Manager loi.

Lenh bat dev `3202` neu server chua chay:

```powershell
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/s','/c','npm run api:dev') -WorkingDirectory 'D:\Phần mềm\QCVL' -WindowStyle Hidden
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/s','/c','npx vite --host 0.0.0.0 --port 3202') -WorkingDirectory 'D:\Phần mềm\QCVL' -WindowStyle Hidden
```

`npm run api:dev` phai la watch mode (`tsx watch server/index.ts`). Khong chay tay `tsx server/index.ts` khi dang sua backend, vi API `3100` se giu code cu. Dau hieu sai: frontend `3202` co UI moi nhung goi route moi bi `RESOURCE_NOT_FOUND` / `Khong tim thay du lieu can thao tac`. Cach sua: dung process dang nghe port `3100`, bat lai bang `npm run api:dev`, du lieu local van doc tu `logs/dev-memory-state.json`.

Lenh kiem tra:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3100/api/v1/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3202/admin
npm run health:nas
```

## Latest NAS Deploy - 2026-07-11 User Management Persistence

Trang `Thiet lap > Quan ly nguoi dung` phai dung du lieu that trong PostgreSQL:

- `POST /api/v1/users` tao user that, hash password, luu profile co ban va gan permissions.
- `GET /api/v1/users` doc danh sach user theo organization, search va status filter.
- `PATCH /api/v1/users/{id}` doi ten hien thi/trang thai.
- `PUT /api/v1/users/{id}/permissions` thay permissions that.
- Khong dung mock "chi tra user hien tai" cho NAS.

DB schema duoc them qua migration `0004_user_management_profile.sql`: `username`, `phone`, `birthday`, `region`, `ward`, `address`, `note`, index username theo organization.

Validation tao user:

- UI khong goi API khi thieu truong bat buoc.
- Truong bat buoc toi thieu trong hop thoai: ten hien thi, so dien thoai, ten dang nhap, mat khau, nhap lai mat khau, vai tro.
- Email khong bat buoc. Neu bo trong, backend tu sinh email noi bo dang `<username>@users.qcvl.local`.
- Backend chan `username`, `phone`, `password`, `display_name` rong bang `VALIDATION_ERROR`.

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

- Frontend dev `127.0.0.1:3201/3202` mac dinh goi API same-origin `/api`; Vite proxy sang API dev `http://127.0.0.1:3100`.
- Khi sua ca frontend va backend, phai chay ca `npm run api:dev` va Vite dev de test dung cap frontend/backend cung phien ban.
- Neu khong co `DATABASE_URL`, API dev dung memory repository va luu state local vao `logs/dev-memory-state.json` (co the doi bang `QCVL_DEV_MEMORY_STATE_FILE`). State nay giup 3202 khong mat du lieu import sau restart API dev, nhung van chi la du lieu local de test.
- NAS `3200` khong duoc chay memory repository. Backend phai doc `DATABASE_URL` hoac tu tao URL tu `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` trong `.env` NAS. `GET /api/v1/health` phai tra `persistence: "postgres"`. Dau hieu sai: `/admin` tao user xong modal dong nhung reload chi con `Admin / admin`; DB PostgreSQL khong co user moi.
- Neu can xoa sach du lieu test 3202, dung nut xoa du lieu cu/import lai tren UI hoac xoa file `logs/dev-memory-state.json` khi da chap nhan mat du lieu local.
- Loi da gap: frontend local `127.0.0.1:3202` goi nham backend NAS cu nen route import moi tra `RESOURCE_NOT_FOUND`/`Khong tim thay du lieu can thao tac`. Cach dung la chay API dev cung code moi hoac deploy backend tuong ung len NAS khi Owner cho phep.

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

Bundle NAS chỉ được gọi API qua `http://100.84.228.125:3200`. Frontend dev local gọi `/api` same-origin và để Vite proxy sang `http://127.0.0.1:3100`; không hard-code NAS API khi test dev trước deploy.

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

### 4A. Dua du lieu 3202 len NAS PostgreSQL

`127.0.0.1:3202` dung `logs/dev-memory-state.json` khi API dev khong co `DATABASE_URL`. Deploy code len NAS khong tu dua state nay vao PostgreSQL. Khong copy thang `logs/dev-memory-state.json` len NAS.

Quy trinh chuan khi owner chot dua ban 3202 hien tai len NAS:

1. Dry-run de dem du lieu va kiem tra DB dich:

```powershell
npm run import:dev-memory-to-postgres
```

2. Deploy code len NAS:

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_SSH_TARGET='<nas-user>@100.84.228.125'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_SSH_TARGET
```

3. Ghi du lieu local 3202 vao PostgreSQL NAS:

```powershell
$env:QCVL_IMPORT_CONFIRM='true'
npm run import:dev-memory-to-postgres
Remove-Item Env:\QCVL_IMPORT_CONFIRM
```

Script doc DB theo thu tu `QCVL_NAS_DATABASE_URL`, `DATABASE_URL`, roi `\\100.84.228.125\docker\QCVL\.env` voi `POSTGRES_*`. Mac dinh import vao organization code `VAN-LAM`; neu can doi thi set `QCVL_IMPORT_ORGANIZATION_CODE`.

Script ghi cac nhom du lieu da import tren 3202: hang hoa, gia mac dinh, ton tam KiotViet, BOM, kiem kho, khach hang, nha cung cap, phieu nhap, hoa don/chung tu ban hang. Khi ghi that, script tao backup local trong `backups/dev-memory-state-*.json` truoc khi day DB.

4. Verify sau import:

```powershell
npm run health:nas
Invoke-WebRequest -UseBasicParsing 'http://100.84.228.125:3200/api/v1/products?page=1&page_size=1'
Invoke-WebRequest -UseBasicParsing 'http://100.84.228.125:3200/api/v1/customers?page=1&page_size=1'
Invoke-WebRequest -UseBasicParsing 'http://100.84.228.125:3200/api/v1/suppliers?page=1&page_size=1'
Invoke-WebRequest -UseBasicParsing 'http://100.84.228.125:3200/api/v1/purchase/receipts?page=1&page_size=1'
Invoke-WebRequest -UseBasicParsing 'http://100.84.228.125:3200/api/v1/sales-documents?page=1&page_size=1'
```

Neu health khong tra `persistence: "postgres"` thi dung lai, chua coi NAS la ban chuan.

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

Deploy that len NAS. Mac dinh khi `QCVL_NAS_DEPLOY_CONFIRM=true`, script se copy code, migrate DB, restart `qcvl-app`, doi health, va yeu cau `persistence: "postgres"`. Khong vao DSM/Web NAS de restart thu cong nua.

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_SSH_TARGET='<nas-user>@100.84.228.125'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_SSH_TARGET
```

Neu co chu y chi copy ma khong restart, phai set ro `QCVL_NAS_RESTART=false`. Khong dung cach nay cho thay doi backend/server/runtime.

```powershell
$env:QCVL_NAS_DEPLOY_CONFIRM='true'
$env:QCVL_NAS_RESTART='false'
npm run deploy:nas
Remove-Item Env:\QCVL_NAS_DEPLOY_CONFIRM
Remove-Item Env:\QCVL_NAS_RESTART
```

`deploy:nas` tu chay build, verify bundle, copy dung runtime path, migrate DB, restart khi can, va health check. Mac dinh la dry-run neu khong co `QCVL_NAS_DEPLOY_CONFIRM=true` de tranh day nham len NAS. Phan lenh copy tay ben duoi chi giu de tham khao/debug khi script loi.

SSH restart rule:

- Script chay `ssh <nas-user>@100.84.228.125 sudo /usr/local/bin/docker restart qcvl-app`.
- Neu SSH hoi password, nhap mat khau NAS cua user do.
- Neu sudo hoi password lan nua, nhap lai cung mat khau NAS.
- Neu sudo bao user khong co quyen, vao DSM/Container Manager restart mot lan hoac cap quyen admin/sudo cho user do.
- Khong dung `sudo -S` trong deploy script, vi se de ket/fail khi khong truyen password qua stdin.

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

Restart `qcvl-app` khi có thay đổi backend/server/runtime. Script deploy thật mặc định đã làm việc này qua SSH. Nếu health không có `persistence: "postgres"`, coi như deploy lỗi.

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
- Khách mặc định phải là `khachle - Khách lẻ`.
- Nếu POS tạo báo giá/hóa đơn khi chưa chọn khách, backend phải gắn vào `khachle - Khách lẻ`.
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
