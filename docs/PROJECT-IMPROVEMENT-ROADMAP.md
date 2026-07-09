# QCVL Improvement Roadmap

> Cap nhat: 2026-07-09. Muc tieu: hoan thien du an noi bo chay qua NAS/Tailscale, khong uu tien public internet.

## Nguyen Tac

- Uu tien on dinh nghiep vu tien, cong no, so quy, ton kho hon doi cong nghe.
- Moi thay doi lon phai tach vo UI va ruot nghiep vu theo `docs/CODE_ARCHITECTURE_RULES.md`.
- Lam theo tung batch nho, co test, build, docs, roi moi deploy NAS khi owner yeu cau.
- Khong dua secret, password, token, database dump vao Git hoac docs.
- Xem checklist van hanh: `docs/07-DEPLOYMENT-TrienKhai/INTERNAL-OPS-CHECKLIST.md`.

## Uu Tien 1: Bao Mat Va Quy Trinh NAS

- Doi cac mat khau da tung xuat hien trong chat/docs.
- Khong rewrite Git history neu chua co quyet dinh ro, vi thao tac nay co the lam lech clone/branch cu.
- Dung `npm run build:nas` thay vi set `VITE_API_BASE_URL` bang tay.
- Sau build NAS luon chay `npm run verify:nas-bundle`.
- Khi can smoke NAS, set password bang environment variable tam thoi roi xoa ngay sau khi chay.

## Uu Tien 2: Chuan Hoa Deploy

Muc tieu tiep theo:

- Tao script deploy NAS mot lenh gom: build NAS, verify bundle, copy runtime, restart container, health check, smoke.
- Script khong chua password; password chi doc tu environment variable.
- Script deploy NAS dry-run mac dinh; chi copy khi co `QCVL_NAS_DEPLOY_CONFIRM=true`.
- Docs NAS chi ghi placeholder, khong ghi credential that.

## Uu Tien 3: Tach Backend Theo Module

Hien tai `server/http.ts` va `server/db.ts` con lon. Can tach dan:

- `server/modules/auth`
- `server/modules/sales`
- `server/modules/finance`
- `server/modules/inventory`
- `server/modules/purchase`

Quy tac:

- Route chi parse request va tra response.
- Repository chi lam PostgreSQL.
- Tinh tien, cong no, payment status phai co test server.
- Khong dua sales/finance runtime ve RAM fixture.

## Uu Tien 4: Migration Co Version

Hien tai schema nam trong `database/schema.sql` va mot phan duoc dam bao trong `server/db.ts`.
Can chuyen sang migration co version:

- Tao bang `schema_migrations`.
- Tao thu muc `database/migrations`.
- Moi thay doi schema la mot file SQL rieng.
- `npm run db:migrate` chi chay migration chua ap dung.

## Uu Tien 5: Tach Page Lon

Page lon can tach tiep khi cham vao:

- `src/features/finance/FinancePage.tsx`
- `src/features/pos/PosShell.tsx`
- `src/features/catalog/CatalogPage.tsx`
- `src/features/purchase/PurchaseReceiptsPage.tsx`

Huong tach:

- Component con chi render UI.
- Hook rieng cho state/filter/dialog.
- Presenter/filter/storage/calculation giu logic co the test.

## Khong Uu Tien Hien Tai

- Cookie httpOnly va hardening public internet.
- WAF/CDN/public production pipeline.
- Realtime/Supabase/cloud rewrite.

Ly do: du an dung noi bo, truy cap qua Tailscale/NAS. Bao mat can tap trung vao credential, backup, permission, va khong lam ro ri du lieu.
