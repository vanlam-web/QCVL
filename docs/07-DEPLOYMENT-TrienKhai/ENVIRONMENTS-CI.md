# ENVIRONMENTS & CI/CD — Nền tảng triển khai QC-OMS

> **Mốc cập nhật:** theo quyết định Supabase Cloud backend chính.
> **Phạm vi:** Dev, staging, production baseline và pipeline.

---

## 1. MÔ HÌNH MÔI TRƯỜNG

| Môi trường | Frontend | Backend/Database | Mục đích |
|---|---|---|---|
| Dev thường | Vite dev server trên máy dev | Supabase Cloud staging/dev project | Phát triển hằng ngày, không bắt buộc Docker/máy chủ LAN |
| Local isolated | Vite dev server | Supabase local Docker | Test migration/RLS/DB cô lập khi cần |
| Preview | Vercel Preview | Không được tự động dùng production | Review UI theo Pull Request |
| Staging | Vercel project/domain staging | Supabase project staging | Demo, E2E và Owner acceptance |
| Production | Vercel project/domain production | Supabase project production | Vận hành thật |

Staging và production phải dùng project, Database, Auth user, secret và URL riêng biệt.

Supabase Cloud là hướng backend chính hiện tại cho dev/staging. Developer mới chỉ cần cấu hình `.env.local` trỏ tới Supabase Cloud dev/staging project đã được cấp quyền.

LAN/Tailscale shared-dev server chỉ là phương án phụ/local fallback nội bộ khi cần chạy một Supabase local chung trong mạng. Không xem LAN/Tailscale là mặc định.

Local Docker Supabase chỉ dùng khi cần isolated local database/test, ví dụ test migration, RLS, pgTAP hoặc làm việc offline. Không bắt buộc cho dev frontend/backend thường ngày.

Preview mặc định dùng Backend staging chỉ khi thay đổi tương thích và dữ liệu test được cô lập. Thay đổi migration chưa deploy staging phải được test bằng Supabase Cloud staging/dev project, Supabase local isolated, hoặc một môi trường preview được phê duyệt riêng.

CI bắt buộc chạy lại migration local trước khi chạy function tests:

1. `npm run supabase:start`
2. `npm run supabase:reset`
3. `npm run test:db`
4. `npm run test:functions`

Thứ tự này chặn lỗi deploy function trước schema, ví dụ function đã select cột mới nhưng DB cloud/chạy thử chưa có migration tương ứng.

Function test runner:

- `npm run test:functions` chạy toàn bộ `supabase/tests/functions`;
- `npm run test:functions -- supabase/tests/functions/health_test.ts` chỉ chạy đúng file được truyền sau `--`;
- khi review một slice nhỏ, ưu tiên chạy targeted path trước rồi chạy lại toàn bộ `npm run test:functions` trước khi merge.

PWA hiện chỉ là app-shell cache:

- cache file build tĩnh để POS/app mở lại nhanh hơn;
- tự cập nhật service worker khi có bản mới;
- không cam kết lưu hóa đơn/báo giá offline;
- mọi nghiệp vụ bán hàng vẫn phải theo API/server khi ghi dữ liệu.

Frontend route pages được lazy-load theo route để giữ app shell nhỏ:

- `src/app/router.tsx` không static import các page lớn như POS, Finance, Inventory, Sales Documents;
- khi thêm page/module mới, dùng `lazy(() => import(...))` ở router thay vì import trực tiếp;
- `src/app/router.test.ts` kiểm rule này để tránh kéo toàn bộ app vào initial bundle;
- `npm run build` phải pass mà không phát sinh cảnh báo chunk lớn mới.

Frontend URL route dùng chung qua `src/app/routes.ts`:

- router, navigation shell, module boundary và route guard dùng `appRoutes`;
- URL động như in báo giá dùng helper riêng, ví dụ `quotePrintPath(documentId)`;
- khi đổi path/module mới, cập nhật constants + `src/app/routes.test.ts` trước để tránh lệch URL giữa menu và router.

Frontend permission codes dùng chung qua `src/features/users/permissions.ts`:

- runtime code dùng `permissions` thay vì gõ lại chuỗi `perm.*` trong router, menu, module boundary, POS hoặc admin;
- `src/features/users/permissions.test.ts` giữ danh sách code ổn định để bắt typo khi đổi quyền;
- test UI vẫn có thể dùng literal khi cần xác nhận text hoặc dữ liệu mock theo đúng hợp đồng API.

Frontend/tooling unit tests:

- `npm test` chạy unit/component tests trong `src`, đồng thời chạy helper unit tests trong `scripts/*.test.mjs` và `tests/e2e/*.test.ts`;
- CI chạy `npm run test:e2e:list` để bắt lỗi load Playwright config hoặc lẫn file test sai scope mà không cần Supabase env hoặc browser/E2E thật;
- test Playwright thật vẫn chạy bằng `npm run test:e2e`, không đặt trong file `*.test.ts` để tránh nhầm scope.
- React component tests phải chờ các async effect/setup hoàn tất trước khi kết thúc test; không để `act(...)` warning tồn tại trong CI log.

Frontend API error contract:

- mọi request gửi `x-request-id` để đối chiếu log FE-BE;
- lỗi API chuẩn trả `trace_id` và được client giữ trong `ApiError.traceId`;
- lỗi mất mạng hoặc response không phải JSON vẫn phải được client map thành `ApiError(INTERNAL_ERROR)` với trace ID an toàn;
- UI dùng `formatApiError` để tránh lộ lỗi kỹ thuật thô cho nhân viên vận hành.

Backend chỉ echo `x-request-id` nếu giá trị an toàn: chữ, số, `.`, `_`, `:`, `-`, tối đa 128 ký tự. Header không hợp lệ phải được thay bằng UUID mới trước khi ghi response hoặc log.

---

## 2. BIẾN MÔI TRƯỜNG

Frontend được phép có:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`
- `VITE_APP_ENV`
- `VITE_SENTRY_DSN` (tùy chọn)
- `VITE_SENTRY_TRACES_SAMPLE_RATE` (tùy chọn, `0` đến `1`)

Ví dụ `.env.local` cho Supabase Cloud dev/staging:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<cloud-anon-key>
VITE_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/api
VITE_APP_ENV=staging
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0
```

`VITE_APP_ENV` nên dùng một trong các giá trị dễ đọc như `development`, `staging`, `production`, hoặc `local-isolated` tùy môi trường đang trỏ tới.

Sentry chỉ bật khi `VITE_SENTRY_DSN` có giá trị. Khi chưa cấu hình DSN, app không gửi event ra Sentry. `VITE_SENTRY_TRACES_SAMPLE_RATE` mặc định là `0` để không bật performance tracing ngoài ý muốn.

Backend secret gồm:

- Supabase project URL/key do runtime cung cấp;
- Service Role Key;
- cấu hình CORS và rate limit;
- secret tích hợp bên ngoài khi có.

Quy tắc:

- Chỉ biến prefix `VITE_` mới được đưa vào bundle trình duyệt.
- Không đặt Service Role Key trong biến Frontend hoặc Vercel client environment.
- Repository chỉ chứa `.env.example`, không chứa giá trị thật.
- Secret production chỉ người/quy trình deploy production được truy cập.

---

## 3. DEV THƯỜNG VỚI SUPABASE CLOUD

Yêu cầu công cụ:

- Node.js bản LTS đang được dự án pin;
- `npm`;
- `.env.local` trỏ tới Supabase Cloud dev/staging project.

Luồng khởi động chuẩn cho developer mới:

```bash
npm ci
npm run dev
```

Sau đó đăng nhập bằng user test/staging được cấp. Không cần bật Docker, Supabase local, máy chủ LAN hoặc Tailscale để chạy dự án ở chế độ dev thường.

## 4. LOCAL ISOLATED DEVELOPMENT

Yêu cầu công cụ:

- Node.js bản LTS đang được dự án pin;
- `npm`;
- Supabase CLI;
- Docker runtime theo yêu cầu của Supabase local.

Luồng này chỉ dùng khi cần database/test cô lập:

```text
1. Cài dependency
2. Khởi động Supabase local
3. Chạy migration + seed
4. Chạy Edge Function API local
5. Chạy Vite dev server
6. Chạy smoke test đăng nhập
```

Các lệnh thực tế phải được đưa vào `package.json` khi scaffold code, tối thiểu gồm `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e` và nhóm lệnh Supabase local.

---

## 5. BRANCH VÀ PROMOTION

| Sự kiện | Kết quả |
|---|---|
| Mở/cập nhật Pull Request | Chạy CI, tạo Vercel Preview nếu phù hợp |
| Merge vào `main` | Deploy staging sau khi CI thành công |
| Owner chấp nhận staging | Promote đúng commit đã test sang production bằng bước thủ công |
| Production lỗi | Rollback ứng dụng về commit trước; Database dùng corrective migration nếu cần |

Không build lại source khác khi promote từ staging sang production nếu pipeline hỗ trợ tái sử dụng artifact. Ít nhất phải giữ nguyên Git SHA đã được nghiệm thu.

---

## 6. CI PIPELINE

Mỗi Pull Request chạy tối thiểu:

1. Cài dependency bằng lockfile.
2. Lint.
3. Typecheck.
4. Unit/component test.
5. Build production Frontend.
6. Kiểm tra format/migration Database.
7. Khởi tạo Supabase local sạch, apply toàn bộ migration.
8. Integration test Backend/RLS.
9. Secret scan và dependency security check phù hợp.

E2E smoke test chạy trên staging sau deploy, tối thiểu:

```text
Đăng nhập → gọi /me → chọn máy trạm → mở POS Shell → đăng xuất
```

Playwright E2E dùng Supabase URL/key đã resolve nhất quán từ process env, Supabase CLI local, hoặc `.env.local`. API base mặc định được derive từ Supabase URL đó theo mẫu `<SUPABASE_URL>/functions/v1`; nếu cần override riêng cho E2E, dùng `E2E_API_BASE_URL`. Không dùng `VITE_API_BASE_URL` để điều khiển Playwright vì biến này có thể còn trỏ môi trường dev/cloud khác.

Deploy staging/production thất bại nếu bước bắt buộc trước đó thất bại.

---

## 7. DATABASE MIGRATION

- Migration được commit trong `supabase/migrations/` và chạy theo thứ tự.
- Không sửa migration đã chạy trên staging/production; tạo migration mới để điều chỉnh.
- Migration phải chạy được trên Database sạch trong CI.
- Thay đổi phá vỡ tương thích phải theo chiến lược expand/migrate/contract.
- Backup trước migration production có rủi ro cao.
- Rollback Database ưu tiên corrective forward migration; không tự động down migration làm mất dữ liệu.

---

## 8. CORS VÀ NETWORK

- Local API chỉ cho origin local đã cấu hình.
- Staging API chỉ cho domain staging/preview được phê duyệt.
- Production API chỉ cho domain production và các origin tích hợp đã chốt.
- Không dùng wildcard `*` cho endpoint có credential trong production.
- Mọi endpoint công khai dùng HTTPS.
- CORS `Access-Control-Allow-Headers` của API phải cho phép tối thiểu: `authorization`, `content-type`, `x-request-id`, `x-workstation-id`, `x-client-device-id`. Thiếu `x-client-device-id` sẽ làm login fail ở browser vì `/me` bị chặn sau preflight.

---

## 9. LOG VÀ HEALTH

Giai đoạn 0 thu thập tối thiểu:

- Edge Function request count, error rate và latency;
- deployment status;
- Auth failure bất thường;
- API `GET /api/v1/health`;
- log có trace ID để đối chiếu lỗi FE–BE.

Không log password, access token, refresh token, Service Role Key hoặc request body nhạy cảm.

Dashboard, retention và alert nâng cao hoàn thiện ở Giai đoạn 8.

---

## 10. BACKUP VÀ RESTORE BASELINE

- Staging và production dùng khả năng backup phù hợp của Supabase project.
- Trước production phải ghi nhận rõ lịch backup hiện có và người chịu trách nhiệm kiểm tra.
- Restore drill, RPO và RTO baseline xem [BACKUP-RESTORE.md](./BACKUP-RESTORE.md); trước production thật cần xác nhận lại theo hạ tầng đang dùng.
- Seed local/staging không được chạy tự động trên production.

---

## 11. ĐIỀU KIỆN SẴN SÀNG GIAI ĐOẠN 0

- Dev thường có thể chạy từ repository sạch bằng Supabase Cloud dev/staging env.
- Local isolated có thể dựng từ repository sạch khi cần test DB/migration.
- Migration Foundation chạy thành công trên Database sạch.
- Staging Frontend gọi đúng staging API/Database.
- Không có production secret trong source hoặc Preview.
- CI chặn merge khi lint, typecheck, test hoặc build thất bại.
- Smoke test đăng nhập chạy thành công sau deploy staging.
