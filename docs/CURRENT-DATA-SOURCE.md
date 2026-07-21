# Current Data Source Rules

> Cap nhat: 2026-07-18. File nay la quy tac bat buoc de tranh lam nham cach luu du lieu cu.

## AI Quick Read

- Runtime source of truth: Node API + PostgreSQL on NAS.
- Dev UI: `127.0.0.1:3202`; NAS runtime: `100.84.228.125:3200`.
- Truoc khi sua bug thay tren `3202`, kiem tra process that cua `3100`/`3202` dang chay tu repo nao. Da tung gap frontend `3202` chay workspace nay nhung API `3100` chay `D:\phan mem\QCVL`; sua nham repo lam UI van loi.
- Seed nhom `cg-retail` / `cg-vip` khong phai nhom khach that tren POS. Khach khong chon nhom phai luu `customer_group_id = null`; POS khong hien chip nhom seed va pricing dung `Gia chung`.
- Historical KiotViet export archive for verification: `Y:\DuLieuKV`.
- Use `Y:\DuLieuKV` first when checking data exported from KiotViet before `12/07` or when cross-checking import source files.
- Do not revive Supabase, RAM-only sales/finance, or demo fixture storage for runtime.
- Do not copy `logs/dev-memory-state.json` to NAS.
- If behavior touches money, debt, invoice lifecycle, inventory, import, permissions, or users, read the matching feature doc before editing.
- Long dated notes below are evidence/history. Use the latest matching fact, not old timelines, when they conflict.

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

## Local 3202 Development Data

`127.0.0.1:3202` la dev UI. API dev o `127.0.0.1:3100`.

- Khach hang import KiotViet co `source_creator_name` phai map sang QCVL user bang `users.username` sau khi bo `{DEL}`. Khong map bang ten hien thi, SDT, hoac email. List API phai resolve lai theo tai khoan hien tai de du lieu import cu va doi ten hien thi van cap nhat dung.
- Khach hang import KiotViet trong dev-memory phai duoc luu vao `logs/dev-memory-state.json` giong hang hoa/kiem kho. Khong chi giu trong mang RAM, vi API dev restart se lam mat du lieu import va detail se mat `Nguoi tao`.
- API dev bat buoc chay bang `npm run api:dev`. Script nay dung `tsx watch server/index.ts` de tu restart khi sua `server/**`; khong chay tay `tsx server/index.ts` vi se giu backend cu va route moi co the tra 404.
- Khi UI co code moi nhung du lieu khong luu/search khong ra, chay `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '3100|3202|server/index|vite|tsx' }` de xem `3100` dang load `server/index.ts` tu thu muc nao. Neu process chay tu repo khac, can patch/pull dung repo dang chay hoac restart API tu repo hien tai.
- Neu API dev co `DATABASE_URL`, du lieu nam trong PostgreSQL cua URL do.
- Neu API dev khong co `DATABASE_URL`, du lieu nam trong dev-memory repository va phai duoc luu vao `logs/dev-memory-state.json`.
- Khong restart API dev bang memory rong khi dang test import Hang hoa/Kiem kho; se lam mat du lieu import tren 3202.
- File `logs/dev-memory-state.json` chi la state local de tranh mat du lieu khi restart 3100. Khong copy file nay len NAS.
- Khi can dua du lieu da import tren 3202 len NAS, dung `npm run import:dev-memory-to-postgres`. Lenh mac dinh dry-run; ghi that can `QCVL_IMPORT_CONFIRM=true`. Script ghi vao PostgreSQL NAS va tao backup local `backups/dev-memory-state-*.json`.
- Deploy code len NAS khong tu dong copy du lieu 3202. Sau deploy phai chay import script neu owner muon NAS co dung bo du lieu local da review.
- Sales document detail phai giu `unit_price`, `discount_amount`, `line_total`, `quantity`, `unit_name` thuc su cua tung dong; khong rebuild dong chi tu `subtotal_amount` cua hoa don vi se lam sai gia tri dong va tong. `payment_receipts` phai hydrate tu cashbook lien ket de tab `Lịch sử thanh toán` hien dung.
- Bảng chi tiết hỏa đơn/phiếu nhập tách riêng `Số lượng` và `Đơn vị`; không ghép chung 1 ô nếu đã có cột riêng trong layout chung.
- POS quick products tren local `3202` phai sap theo lich su that trong dev-memory (`salesDocuments.items` da luu/import), khong dung fixture demo trong `server/http.ts`. Tren NAS/PostgreSQL, nguon sap xep la `pos_product_usage`.
- File Hang hoa KiotViet `DanhSachSanPham_KV*.xlsx` co cot `Thoi gian tao`; day la ngay tao goc cua san pham. Khong duoc dung ngay import/local write time lam ngay tao nghiep vu. Khi don du lieu sau mot moc ngay, khong xoa products/catalog theo `created_at` neu gia tri do chua duoc doi chieu tu cot `Thoi gian tao`.
- Danh sach Hang hoa mac dinh sap xep theo `products.created_at desc` voi gia tri ngay tao goc tu cot KV `Thoi gian tao`; hang moi nhat len truoc. Khong dung `updated_at` lam thu tu mac dinh vi moi lan import/sua se day hang vua ghi len dau. Bang gia co the giu thu tu `Ma hang`/`Ten hang` de de so sanh gia. POS quick products van dung `sort=pos_usage`.
- Neu frontend bao `Khong tim thay du lieu can thao tac` ngay sau khi them route/import moi, goi truc tiep API `3100` de kiem tra. Neu route tra `RESOURCE_NOT_FOUND`, backend dang chay ban cu: dung process 3100 va bat lai bang `npm run api:dev`.
- Neu tao khach/hang/chung tu moi bao OK nhung refresh mat, khong chap nhan flow chi push vao RAM trong `server/http.ts`. Repository PostgreSQL/dev-memory phai co method create/upsert that va test phai chung minh record doc lai duoc sau create.
- Nut `Xoa du lieu cu` trong cac dialog import KiotViet khong duoc dung `window.confirm`. Phai dung hop xac nhan inline trong modal de in-app browser va user thay ro buoc xac nhan; native confirm da tung lam nut nhin nhu khong tac dung.
- Neu UI bao `Khong xoa duoc du lieu import cu` nhung goi truc tiep `DELETE /api/v1/.../import/kiotviet` thanh cong, kiem tra frontend service dang bi Vite/HMR giu ban cu. Cach xu ly: touch/sua nhe service file, reload trang 3202, roi test lai flow UI. Khong do loi backend khi request UI chua goi dung method moi.
- Nut `Xoa du lieu cu` cua import Khach hang phai don ca du lieu import `customer-kv-*` va du lieu mau local `DEV20-KH-*`. Khong xoa `khachle`, khong xoa khach tao tay. Neu sau nay co PostgreSQL references hoa don/cong no thi repository phai tra `blocked_rows`.
- Nut `Xoa du lieu cu` cua import Nha cung cap chi xoa supplier duoc tao tu import KV (`supplier-kv-*`) trong dev-memory, tra `deleted_rows`/`blocked_rows`, giu dialog mo va reload danh sach. Sau khi test xoa that, phai import lai file NCC that neu user dang review du lieu.
- Khi nap/luu dev-memory state, phieu kiem kho `source_type = kiotviet_import` phai sanitize/remap `created_by` tu du lieu nguon. Neu file import khong co cot nguoi tao thi `created_by = null`; neu co `source_creator_name` thi chi map voi QCVL `users.username` sau khi bo `{DEL}`. Khong hien lai QCVL importer `Admin`, khong map bang ten hien thi, SĐT, hoac email.
- Bao cao KiotViet `BaoCaoXuatNhapTonChiTiet_KV*.xlsx` la bang doi soat aggregate, khong tu dong ghi de ton van hanh. Parser nam o `server/modules/inventory/kiotviet-xnt-report.ts`; script doi soat nam o `scripts/compare-kiotviet-xnt.ts` va ghi ket qua moi nhat vao `logs/kiotviet-xnt-comparison-latest.json`.
- Khi so ton QCVL voi KiotViet, dung bucket XNT (`Nhap NCC`, `Nhap kiem`, `Xuat ban`, `Xuat kiem`, `Ton cuoi ki`) de tim nguon lech. Khong doan bang UI tong hop, khong bien `Ton KV tam nhap` thanh ton that.
- Neu Owner chot XNT lam checkpoint, dung `scripts/apply-kiotviet-xnt-checkpoint.ts` de tao phieu can bang ton tu `Ton cuoi ki`. Ma KiotViet co `{DEL}` chi duoc map vao product placeholder dung ma; neu placeholder khong ton tai thi bo qua, khong strip ve ma goc active.
- KiotViet So Quy export (`SoQuy_KV*.xlsx`) la nguon import lich su cho finance/cashbook. File archive da day len `Y:\DuLieuKV`; file moi nhat da xem: `SoQuy_KV24062026-181948-016.xlsx`, 205 dong hop le, gom `Tien mat` va `Ngan hang`.
- KiotViet Bao cao cong no theo khach hang (`BaoCaoCongNoTheoKhachHang_KV*.xlsx`) cung nam trong `Y:\DuLieuKV` va duoc dung de doi chieu cong no lich su; vi du `CB000001` xuat hien trong file cong no nhu dong `Dieu chinh`, khong phai dong So Quy.
- Ma `CB...` trong bao cao cong no la phieu can bang/dieu chinh cong no KiotViet. Khi dua vao QCVL, phai hien va luu nhu chung tu dieu chinh cong no ma `CB...`; khong gan nhan chung chung la `import`, khong tao hoa don `HD...`, va khong dua vao import So Quy.
- So Quy phai di qua `finance_accounts` that: `Tien mat` map vao quy tien mat mac dinh; `Ngan hang` map bang cap `(Ten tai khoan, So tai khoan)`. Khong hard-code tai khoan trong UI JSON.
- KiotViet So Quy export khong co cot loai doi tuong nop/nhan rieng. Export chi co `Ma nguoi nop/nhan`, `Nguoi nop/nhan`, `So dien thoai`, `Dia chi`; QCVL phai suy luan `counterparty.type` tu ma/danh muc tin cay (`KH...` -> khach hang, `NCC...` -> nha cung cap), con khong khop thi giu `other` va giu text nguon.
- Import So Quy KV chi duoc xoa/ghi lai cac row co `source_system = kiotviet`. Khong xoa cashbook sinh tu POS, thu no, hoac phieu thu/chi QCVL tao tay.
- KPI So Quy (`Quy dau ky`, `Tong thu`, `Tong chi`, `Ton quy`) phai tinh theo toan bo ket qua sau filter API, khong tinh rieng page hien tai va khong dung so hard-code. Khi co `from`, `Quy dau ky` la tong so du cua cac dong cung bo loc truoc ngay `from`; neu khong co `from`, `Quy dau ky = 0`. `Tong chi` tra ve so duong; `Ton quy = Quy dau ky + Tong thu - Tong chi`.
- File export `SoQuy_KV*.xlsx` khong co cot ma hoa don/phieu nhap duoc phan bo la dung nghiep vu, khong phai loi export: thanh toan hoa don/phieu nhap sinh ra dong so quy, con link phan bo thuoc payment detail/chung tu nguon. Khi can hien link tam thoi, UI chi duoc suy ra voi mau ma ro `TTHD... -> HD...`, `PCPN... -> PN...`; khong dung so tien/ten/gio de map.
- Da doi soat truc tiep tren KV: `TTHD011149` la khach thanh toan cho hoa don `HD011149`; `PCPN000685` la chi tra NCC cho phieu nhap `PN000685`. Huong dung: hoa don/nhap hang la nguon nghiep vu tao thanh toan, thanh toan tao dong so quy; file So Quy la nguon tien/quy/tai khoan thuc te de doi soat, khong phai nguon duy nhat de dung lai hoa don/nhap hang.
- Quy uoc ma So Quy KV da duoc Owner chot ngay `2026-07-13`: `CTM` = chi tien mat; `CNH` = chi o quy ngan hang; `TTHD` = thanh toan hoa don ban ngay luc tao hoa don; `TT` = khach thanh toan sau, co the phan bo mot lan cho nhieu hoa don (vi du `TT001842`); `PCPN` = thanh toan nha cung cap cho phieu nhap; `Chuyen/Rut` la phieu tao truc tiep o So Quy de chuyen tien giua cac quy/tai khoan.
- Prefix So Quy KV da thay trong cac file `SoQuy_KV13072026-*.xlsx` ngay `2026-07-13` theo ma phieu duy nhat: `TTHD`, `TT`, `CTM`, `PCPN`, `CNH`, `TTM`, `TTD_CTM`, `PC`, `TTD_CNH`, `CTD_TTM`, `TNH`, `TTMHD`, `CTD_TNH`, `TNHHD`, `CVDT`, `TTD_CVDT`, `TTHDO`, `CTD_TVDT`, `TVDT`.
- Nguon sinh tu chung tu: `TTHD...`/`TTHDO...` sinh tu hoa don thanh toan ngay; `PCPN...` sinh tu phieu nhap co tra NCC. Khong import lai 2 nhom nay neu da sinh tu hoa don/phieu nhap, de tranh trung tien.
- Nguon can xu ly rieng: `TT...`, `TTMHD...`, `TNHHD...` la khach tra no sau, co the lien quan mot hoac nhieu hoa don; phai lay allocation tu detail/payment source, khong map mot-ma-mot sang `HD...`. `TTM...` va `TNH...` la thu tien mat/ngan hang truc tiep, co the la thu nhap khac hoac chuyen/rut; phai dua vao `Loai thu chi`.
- Nguon chi truc tiep: `CTM...`, `CNH...` la chi tien mat/ngan hang; `PC...` la chi tra NCC khong gan ro phieu nhap trong ma phieu, can giu nhu phieu chi/cong no NCC rieng.
- Nguon chuyen/rut: `TTD_*`, `CTD_*`, `TVDT`, `CVDT` la cac dong doi ung chuyen tien giua quy/tai khoan. Phai xu ly theo cap thu/chi neu can doi soat quy, khong tinh nhu doanh thu/chi phi kinh doanh.
- `Chuyen/Rut` khong phai doanh thu/chi phi. Khi lam du, phai tao cap dong ra/vao giua quy nguon va quy dich, khong lam doi tong quy toan he thong.
- Huong lam tam duoc Owner chot ngay `2026-07-13`: neu phieu thu/chi cong no tu So Quy khong co allocation ro, phan bo vao cac chung tu no cu nhat cua dung doi tac cho den het so tien. Ap dung cho khach tra no (`TT`, `TTM`, `TTMHD`, `TNHHD` co `Loai thu chi` la khach tra no/tien khach tra) va NCC tra no (`PC`, neu khong co bang phan bo PN). Khi sau nay co detail/allocation that tu KiotViet thi dung allocation that, khong dung FIFO.
- Doi soat truc tiep KV ngay `2026-07-13`: `TT001842` la khach `XD` tra 3,000,000 va KV gan 11 hoa don; `TTM000001` la khach `RD` tra 6,000,000 nhung detail khong hien bang hoa don; `TNHHD000006` la khach `KH000384` tra 6,252,260 qua ngan hang va co the gan `HD007698.01`; `PC000046` la chi NCC `NCC000011` 180,000 va gan 2 phieu nhap `PN000657`, `PN000664`; `TTD_CTM001191` la phieu thu chuyen/rut duoc tao tu `CTM001191`.
- Full export So Quy ngay `2026-07-13` da xem 3 file `SoQuy_KV13072026-143930-099.xlsx`, `SoQuy_KV13072026-144028-526.xlsx`, `SoQuy_KV13072026-144039-112.xlsx`: them cot `Thoi gian tao`, `Dia chi`, `Noi dung chuyen khoan`, `Ghi chu`; parser/import phai giu cac cot nay. Van khong co cot ma hoa don/phieu nhap.
- Ngay `2026-07-13`: state local `3202` da bo sung lai `source.source_creator_name` cho 6,899 dong So Quy dang co tu cac file `SoQuy_KV13072026-143930/144028/144039/151736`. Khong them dong moi, khong nap lai cac dong ngay hom nay; backup truoc khi sua nam o `backups/dev-memory-state-before-cashbook-creator-2026-07-13T09-32-50-675Z.json`.
- Ngay `2026-07-13`: script `npm run import:dev-memory-to-postgres` da duoc mo rong de sync `financeAccounts` va `cashbookEntries` tu `logs/dev-memory-state.json` len PostgreSQL NAS. Khi ghi that, script tao backup local `backups/dev-memory-state-*.json`, upsert `finance_accounts`, va dong bo exact `cashbook_entries` theo state local: dong so quy nao tren NAS khong co trong state local se bi xoa de tranh du lieu test/stale lam lech tong quy. Van khong copy raw `logs/dev-memory-state.json` len NAS.
- NAS import ngay `2026-07-13` da ghi `financeAccounts=12`, `cashbookEntries=6899`, trong do `kv_cashbook=6899`. Doi soat bank 2026 sau khi loai account `{DEL}`: `total_in=1,474,101,384`, `total_out=1,458,842,863`, `rows=1050`, khop local `3202`. Code da copy len NAS bang `QCVL_NAS_RESTART=false`; can restart/reset container `qcvl-app` de process dang chay nap code moi.
- Ket luan moi ngay `2026-07-13`: file chi tiet hoa don/nhap hang KiotViet co cot `Khach da tra`, `Tien mat`, `Chuyen khoan`, `Tien da tra NCC`, nhung cac cot nay la tong da thanh toan tai thoi diem export, co the da bao gom phieu tra no sau (`TT`, `TTM`, `TNHHD`, `PC`). Khi dung So Quy de dung lien ket tien/no, imported hoa don/phieu nhap KV phai reset ve no goc truoc, sau do So Quy rebuild allocation: `TTHD/TTHDO` -> dung `HD...`, `PCPN` -> dung `PN...`, `TT/TTM/TNHHD/PC` -> FIFO theo doi tac va chi phan bo vao chung tu da ton tai truoc thoi diem phieu tien. Khong cong them `Khach da tra` vao cong no sau khi da ap So Quy, vi se double-count.
- Ngay `2026-07-14`: Owner da duyet xoa du lieu gia/test khong thuoc import chuan khoi local `3202`. Da xoa 5 dong So Quy KV ngay `2026-07-13` khong co chung tu goc trong QCVL (`TTHD011149`, `TTHD011152`, `CNH000495`, `PCPN000685`, `CTM001196`) va 7 hoa don POS/test (`HD-POS-021-37F1D9E6`, `HD-POS-021-560F0F74`, `HD-POS-021-11542D0A`, `HD-POS-021-07FBE133`, `HD-POS-021-1371B9C0`, `HD-POS-021-5B462517`, `HD-POS-021-77D02F23`) cung nhom dong hang tuong ung. Backup truoc xoa: `backups/dev-memory-state-before-delete-approved-fake-data-2026-07-14T15-44-30-303Z.json`. Sau xoa: `cashbookEntries=6899`, `salesDocuments=12355`, `salesDocumentItems=12355`. Ho so khach `Test KH` chua xoa vi khong nam trong pham vi `A+B` da duyet.
- Khi kiem tra doi soat, khong dung ma `HD-POS...` de dai dien import KV. Tu 2026-07-16, POS QCVL sinh chung tu moi theo dang KV `HD...`/`BG...` voi 6 so tu tang; `HD-POS...`/`BG-POS...` chi la data lich su/test cu, neu can xoa phai bao cao va duoc duyet. Chung tu KV hop le co dang `HD...`, `BG...`, `TTHD...`, `PCPN...` theo nguon import tu file.
- POS checkout phat sinh phieu thu cashbook theo ma `TTHD...` gan voi hoa don `HD...`; thu no khach sau checkout sinh ma `TT...`; backend luu `created_by` theo display name dang dang nhap, khong phai ten placeholder.
- Lam finance/cashbook import tren local `3202` truoc; chi day NAS khi da doi soat tong/filter voi KiotViet. Trang `/finance` local da co nut `Import KV` cho So Quy va dev-memory luu duoc cashbook/account import; PostgreSQL finance account migration/repository la buoc tiep theo truoc khi day NAS.
- NAS `3200` phai dung PostgreSQL va health phai tra `persistence: "postgres"`.
- Ngay `2026-07-14`: NAS `3200` co `products=682`, `inventory_provisional_balances=337`, `stock_movements=0`. Vi chua co movement van hanh, UI `/products` fallback hien `kiotviet_provisional_stock` trong cot `Ton QCVL` de V1 khong trong; detail van phai ghi ro day la `Ton KV tam nhap`/du lieu doi chieu. Khong dung so fallback nay cho POS, khui vat tu, BOM active, hay ton van hanh chinh thuc.
- Ngay `2026-07-15`: local `3202` da duoc bo sung lai du lieu NAS de khop `3200` cho cac tap du lieu chinh nay: `products=682`, `customers=542`, `suppliers=45`, `purchaseReceipts=684`, `salesDocuments=12361`, `cashbookEntries=6904`, `provisionalStockBalances=337`. Sau khi restart API `3100`, UI `/suppliers` tren `3202` va `3200` khop exact o list/detail THN. Cung ngay, cac chinh UI shell/detail da duoc build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false`; health NAS sau deploy tra `persistence: "postgres"` trace `50e19ed9-f7aa-434d-bb13-9d84a68285a6`; share `dist`, `dist-server`, `src`, `server`, `public`, `database` khong con file lech theo `robocopy /MIR /L`, va cac file config copy le khop SHA-256. Chua smoke toan bo UI sau login tren NAS; container `qcvl-app` chua restart, nen backend runtime moi chi chac chan sau restart.
- Ngay `2026-07-16`: purchase receipt create search tren `3202` da gan voi remote product catalog search, merge cache local + ket qua API, va chon duoc hang theo ma/tên ke ca khi san pham chua nam trong cache nap san. Soi lai local truoc khi copy len NAS; thanh `Tìm hàng (F3)` trong `Nhập hàng` khong con chi la local filter.
- Ngay `2026-07-16`: POS tren `3202` da sua luong don vi quy doi sau reload. Draft localStorage dung key `qc-oms.pos.invoice-tabs.v1`; khi F5/mo lai POS, dong hang hydrate lai theo catalog hien tai nen san pham nhu `F5 - Fomex 5mm` van chon duoc cac don vi KV `Tấc`, `Tấm CNC`, `Tấc CNC`. Luoi `Sản phẩm nhanh` co gian theo man hinh/noi dung, chuyen 2 hoac 3 cot theo be rong va tinh so thẻ theo chieu cao con lai, khong con khoa 3 cot co dinh.
- Ngay `2026-07-16`: da build/copy batch POS grid va cac thay doi UI/data-source hien tai len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `a2fec157-a21e-4f75-b143-56ae45969c55`, `persistence: "postgres"`.
- Ngay `2026-07-16`: POS nhanh tren local `3202` da chuyen the san pham sang 3 hang co dinh: ma hang, ten hang, gia/ĐVT. Dòng dài co `...` khi khong du be rong. Project health hardening ban dau chi verify NAS bundle build; follow-up da deploy-copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `03587c69-ef05-450d-b74f-46a1553d45c2`, `persistence: "postgres"`.
- Ngay `2026-07-16`: finance cashbook detail tren NAS `3200` da duoc harden de khong crash khi `counterparty` hoac `created_by` trong payload null. Smoke browser sau deploy moi pass voi `TTHD011154`; health trace `b8188e7e-333d-477f-b62b-e80f64964b4f`, `persistence: "postgres"`.
- Ngay `2026-07-16`: da build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false` cho fix search hang nhap theo ma. `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `00862d6f-ed41-41ec-b534-dbadbf7029d7`, `persistence: "postgres"`.
- Ngay `2026-07-17`: da build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false` cho fix `/pos/cart/validate` validate that truoc checkout. `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `b8d7fc33-7f95-4e34-8533-0e1e0794ddce`, `persistence: "postgres"`. Container chua restart trong deploy nay; owner se reset NAS de backend runtime nap code moi.
- Ngay `2026-07-17`: da build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false` cho batch bo loc hang hoa/collapse sidebar. `verify:local` pass truoc deploy (`79` test files / `556` tests), `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `96c33eeb-d8d8-4060-b9e3-fe38ddb368c5`, `persistence: "postgres"`. Container chua restart trong deploy nay; owner reset/restart NAS neu can backend runtime nap code moi.
- Ngay `2026-07-17`: sau khi xoa du lieu test sau `2026-07-11`, phat hien hang hoa active bi xoa nham vi state cu dang giu `products.created_at = ngay import 2026-07-14` thay vi ngay tao KV. Da khoi phuc local `3202` tu backup `backups/dev-memory-state-before-delete-after-2026-07-11-2026-07-17T06-54-29-119Z.json`, doc lai cot `Thoi gian tao` trong `C:\Users\Admin\Downloads\DanhSachSanPham_KV12072026-222359-533.xlsx`, cap nhat `497` san pham active ve ngay tao goc, va restart API `3100`. Ket qua local: `products=682`, `active=497`, `inactive=185`, `active sau 2026-07-11 = 0`, UI `/products` hien `1 - 15 trong 497 hang hoa (611 ma hang)`.
- Ngay `2026-07-17`: cap nhat thu tu mac dinh `/products` theo `created_at desc` dua tren ngay tao goc KiotViet de hang moi nhat len truoc, khong theo `updated_at`. `/price-book` tiep tuc uu tien `Ma hang`/`Ten hang` de de so sanh gia; click header van sort theo cot nguoi dung chon.
- Ngay `2026-07-17`: batch UI/link/filter da on tren local `3202` truoc deploy. Link chung `ManagementRecordLink` dung cho chung tu/doi tac that co dieu huong; text khong co link giu mau chu thuong. So quy link `HD...` sang `/sales-documents`, `PN...` sang `/receipts`. Bo loc thoi gian dong khi click ngoai hoac vung trong sidebar, giu khong dong khi thao tac tren control/menu. Product detail tab `Thong tin` khong hien dong `Don vi`; cot list va tab `Don vi & quy doi` van giu don vi that. Placeholder unit `Can cap nhat`/`Cần cập nhật` khong hien tren list/detail.
- Ngay `2026-07-17`: mau link co dieu huong da duoc chuan hoa sang `--color-info` cho `ManagementRecordLink` va `finance-cashbook-linked-document-link` de de nhan biet hon tren theme toi; link khong co dich dieu huong van giu mau text thuong. Khong gan lai gach chan.
- Ngay `2026-07-17`: cac link record noi bo dung `?open=` de mo dung detail thay vi chi dung `?search=`. Cac trang `/customers`, `/products`, `/sales-documents`, `/receipts`, `/suppliers`, `/finance` phai tu mo detail theo ma record sau khi route load; o tim kiem tren UI van de trong de phan biet mo chi tiet voi loc danh sach. Ten record trong detail hien tai (vi du ten khach/NCC dang mo) khong tu link ve chinh no; chi giu link cheo den record khac.
- Ngay `2026-07-17`: Sales/Purchase detail lines da tach `So luong` va `Don vi`; tab lich su thanh toan chi hien khi co payment row that. Finance cashbook detail cho phep sua popup phieu thu/chi theo phan co the sua; du lieu import/chung tu sinh tu KV van giu cac truong chung tu quy dinh, khong sua truc tiep tai UI.
- Ngay `2026-07-17`: da build/copy batch UI/link/filter/detail len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `verify:local`, `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `14a943e1-b214-4573-83c1-c3c6e859c208`, `persistence: "postgres"`. Container chua restart trong deploy nay; backend runtime moi chi nap sau restart. `smoke:nas` chua chay vi moi truong thieu `QCVL_SMOKE_PASSWORD`.
- Ngay `2026-07-17`: da build/copy fix link `?open=` va bo self-link title Khach hang/NCC len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`. `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `00766c83-5c9b-4125-b26c-80b339df85bc`, `persistence: "postgres"`. Container chua restart trong deploy nay.
- Ngay `2026-07-18`: Dashboard local `3202` da chuyen sang du lieu hoa don that va toi uu tai trang. KPI tren cung bo o `Tra hang`; bieu do doanh thu dung du lieu theo bo loc rieng; top hang/top khach loc rieng tung bang. Cot hoat dong ben phai lay cot trai lam chuan chieu cao, noi dung du thi cuon trong danh sach. Tab `Giao dich` load 20 dong dau, cuon toi cuoi load them moi lo 20 dong; link so tien co khoang cach rieng va mo chung tu hoa don. Tab `He thong` danh cho log them/sua/xoa, co the rong voi du lieu import hien tai. Da build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true`, `QCVL_NAS_RESTART=false`; `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `594e6b39-4b2f-47c7-bdc5-2279ee83377f`, `persistence: "postgres"`.
- Ngay `2026-07-15`: NAS `supplier_snapshots` da duoc bo sung 7 link KH-NCC theo local `3202` (`K`, `NCC000007`, `NCC000014`, `NCC000019`, `NCC000031`, `NCC000035`, `np`). Backup truoc khi update: `backups/nas-supplier-linked-customer-before-2026-07-15-2026-07-15T05-16-56-365Z.json`. Sau reload, `/suppliers` tren `3200` da hien card `Khach hang dong thoi la Nha cung cap` cho `NCC000035 - Ut Teo`.
- Ngay `2026-07-15`: `PurchaseReceiptsPage` tren local `3202` va NAS `3200` da chuyen sang read-only detail cho phiếu posted, co note box chung, footer action `In`, va tab `Lịch sử thanh toán` chi hien khi co thanh toán thuc su. Phiếu dang no nhung chua co payment row khong hien tab history; action `Thanh toán NCC` nam trong footer tab `Thông tin`. Neu import KV co `paid_amount` nhung `supplier_payments` rong, UI co the sinh row read-only `PCPN...` de doi chieu.

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
$env:DATABASE_URL = '<postgres-url>'
$env:ADMIN_PASSWORD = '<admin-password>'
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
| Huy hoa don POS | cap nhat trang thai hoa don thanh `cancelled`, giu audit va bo tac dong ton/no/tien theo status | xoa hoa don/items hoac sua ton truc tiep |
| Tao bao gia | `orders.order_type = 'quote'` trong PostgreSQL | luu tam trong memory |
| Thu no | transaction cap nhat debt/order va tao receipt/cashbook | tru tien tren object RAM |
| Xem khach no | doc open debt rows tu PostgreSQL | tinh tu demo fixture |
| Test restart | chay verifier truoc va sau restart | chi nhin UI truoc restart |

## Proof Da Chay

- Ngay `2026-07-16`: da don lint debt va them local gate `verify:local`/`verify:nas-build`. Trang thai mong doi truoc khi deploy NAS: `npm run verify:local` pass, `npm run verify:nas-build` pass, va khong deploy khi chua co `QCVL_NAS_DEPLOY_CONFIRM=true`.

Ngay 2026-07-09, NAS `http://100.84.228.125:3200` da duoc verify:

- `HD-POS-021-4330498D`
- `PT-CN-MRD47JDC-72CF`
- hoa don partial, con no `200000`
- hoa don/no can thu/so quy van con sau restart `qcvl-app`
- SalesDocuments filter da deploy cung backend NAS: query comma `status=active,completed` tra `total=24`; UI `/sales-documents` co du lieu va khong bi rong do backend cu khong hieu comma.

Chi tiet deploy xem [07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md](./07-DEPLOYMENT-TrienKhai/QCVL-NAS-DEV.md).

- Ngay `2026-07-18`: POS checkout tren local `3202` da cap nhat header hoa don: nguoi ban la ten hien thi cua user dang nhap, ngay va gio hoa don la input `date` + `time` co the sua, va checkout/bao gia gui `created_at` da sua xuong backend. Backend luu `created_at` nay vao chung tu moi, fallback ve `runtimeIso()` neu payload khong hop le. Da build/copy len NAS `3200` bang `QCVL_NAS_DEPLOY_CONFIRM=true` va `QCVL_NAS_RESTART=false`; `build:nas`, `verify:nas-bundle`, `db:migrate`, va `health:nas` pass; health trace `3d577feb-c36e-4150-8a72-b28a8d6c3648`, `persistence: "postgres"`. Test lien quan: `src/features/pos/CheckoutPanel.test.tsx`, `server/http.test.ts`.
