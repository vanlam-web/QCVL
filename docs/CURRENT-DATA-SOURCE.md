# Current Data Source Rules

> Cap nhat: 2026-07-09. File nay la quy tac bat buoc de tranh lam nham cach luu du lieu cu.

## Ket Luan Hien Tai

QCVL dung **Node API + PostgreSQL tren NAS** lam runtime chinh.

Khong dung Supabase cho:

- auth
- API
- realtime
- local dev
- seed/demo data
- sales/finance runtime data

Docker chi dung de chay container app va PostgreSQL tren NAS. Khong dung Docker local de chay Supabase.

## Source Of Truth Cho Sales/Finance

PostgreSQL la nguon dung duy nhat cho cac du lieu sau:

- POS checkout
- bao gia
- hoa don / sales documents
- chi tiet hang trong hoa don
- phieu thu
- phuong thuc thanh toan: tien mat / ngan hang
- cong no khach hang
- thu no khach hang
- so quy

Khong duoc dua cac phan tren ve mang RAM, fixture demo, cache localStorage, hoac file tam lam nguon luu ben.

## Vai Tro Cua `server/http.ts`

`server/http.ts` co the con demo fixture cho test nhe hoac fallback khi repository test khong co method DB.

Nhung trong runtime co PostgreSQL repository:

- sales documents doc tu PostgreSQL
- customer debts doc tu PostgreSQL
- cashbook doc tu PostgreSQL
- checkout / quote / debt collection ghi vao PostgreSQL
- customer financial totals tinh tu PostgreSQL

Khong merge du lieu sales/finance PostgreSQL voi mang RAM trong runtime that.

## Khi Sua Code Lien Quan Tien/No/Hoa Don

Bat buoc lam theo thu tu:

1. Sua schema trong `database/schema.sql` neu can bang/cot/index moi.
2. Sua repository trong `server/db.ts`.
3. Sua route trong `server/http.ts` nhung giu API response shape neu UI dang dung.
4. Them/cap nhat test trong `server/http.test.ts`.
5. Chay:

```powershell
npm run typecheck
npm run lint
npm test -- server/http.test.ts
npm run build:all
```

6. Neu co schema change, chay migrate truoc restart moi truong dich:

```powershell
$env:DATABASE_URL='<postgres-url>'
$env:ADMIN_PASSWORD='<admin-password>'
npm run db:migrate
Remove-Item Env:\DATABASE_URL
Remove-Item Env:\ADMIN_PASSWORD
```

7. Kiem tra persistence sales/finance:

```powershell
$env:QCVL_VERIFY_BASE_URL='http://100.84.228.125:3200'
$env:QCVL_VERIFY_PASSWORD='<admin-password>'
npm run verify:sales-finance-persistence
Remove-Item Env:\QCVL_VERIFY_BASE_URL
Remove-Item Env:\QCVL_VERIFY_PASSWORD
```

8. Restart app, roi chay lai script voi `QCVL_VERIFY_ORDER_CODE` va `QCVL_VERIFY_RECEIPT_CODE`.

## Dau Hieu Lam Sai Cach Cu

Can dung lai neu thay:

- them hoa don/cong no/so quy vao mang global trong `server/http.ts`
- du lieu POS moi chi ton tai sau khi server chua restart
- restart NAS lam mat hoa don, phieu thu, no can thu, so quy
- fixture demo duoc coi la du lieu that cua NAS
- API sales/finance doc tu RAM truoc, PostgreSQL sau
- code moi nhac Supabase cho runtime QCVL

## Bang Doi Chieu Nhanh

| Viec | Dung | Sai |
| --- | --- | --- |
| Tao hoa don POS | `orders`, `order_items`, `payment_receipts`, `customer_debt_entries`, `cashbook_entries` trong PostgreSQL | push vao mang RAM |
| Tao bao gia | `orders.order_type = 'quote'` trong PostgreSQL | luu tam trong memory |
| Thu no | transaction cap nhat debt/order va tao receipt/cashbook | tru tien tren object RAM |
| Xem khach no | doc open debt rows tu PostgreSQL | tinh tu demo fixture |
| Test restart | chay verifier truoc va sau restart | chi nhin UI truoc restart |

## Proof Da Chay

Ngay 2026-07-09, NAS `http://100.84.228.125:3200` da duoc verify:

- `HD-POS-021-4330498D`
- `PT-CN-MRD47JDC-72CF`
- hoa don partial, con no `200000`
- hoa don/no can thu/so quy van con sau restart `qcvl-app`
- SalesDocuments filter da deploy cung backend NAS: query comma `status=active,completed` tra `total=24`; UI `/sales-documents` co du lieu va khong bi rong do backend cu khong hieu comma.

Chi tiet deploy xem [07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md](./07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md).
