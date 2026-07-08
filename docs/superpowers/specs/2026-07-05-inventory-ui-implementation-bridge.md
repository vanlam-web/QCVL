# Inventory UI Implementation Bridge

> Ngay lap: 2026-07-05
> Trang thai: Trace bridge, not Source of Truth. Da dong bo voi main o commit `3b50523`.
> Lien quan: `docs/02-PRD-UX-PhongCanh/Inventory/`, `docs/03-BUSINESS-NghiepVu/Inventory/`, `docs/04-DATABASE/Inventory/INVENTORY-TABLES.md`, `docs/05-BACKEND-MayChu/Inventory/INVENTORY-API.md`

## 1. Hien trang main

- [x] `/inventory` route.
- [x] Danh sach hang hoa/tong ton.
- [x] Search, status filter, shape filter, pagination.
- [x] KPI tong/so luong/ton am.
- [x] Detail panel cho san pham.
- [x] Stock movement history.
- [x] Normal product stock adjustment UI.
- [ ] Quan ly cuon/tam vat ly theo tung object trong UI.
- [ ] Khui vat tu UI.
- [ ] Stocktake UI day du.

## 2. Muc tieu lat cat dau

Lat cat Inventory UI dau tien chi lam:

- danh sach hang hoa/tong ton
- search, filter, table, summary/KPI
- mo chi tiet inline readonly cho hang thuong/cuon/tam neu API da co du lieu
- hien ro ton am
- hien nhan phan biet ton tam m2 va ton vat ly da chuan hoa

Chua lam trong lat cat dau:

- sua BOM
- production auto stock
- auto match file may san xuat voi ton kho
- purchase roll/sheet object nang cao
- stocktake neu UI/API/test chua san sang
- tu dong quan ly tung cuon/tam neu du lieu hien tai chi la tong m2 tu KiotViet

## 3. Route va page

| Route | Muc dich | Trang thai |
|---|---|---|
| `/inventory` | Danh sach hang hoa va tong ton | Da co |
| Detail panel trong `/inventory` | Chi tiet ton san pham | Da co |
| `/inventory/stocktake` | Kiem kho | De phase rieng |
| `/inventory/movements` | Lich su stock movement | De sau list/detail |

Khong tao them route moi neu cung noi dung da nam trong `/inventory`.

## 4. Mapping API -> UI

| UI | API/nguon | Ghi chu |
|---|---|---|
| List hang + tong ton | `GET /api/v1/inventory/products` | Dung pagination backend, khong load toan bo roi loc FE |
| Search | `search` query | Tim ma/ten; exact code khong bi filter che neu API ho tro |
| Trang thai hang | `status=active/inactive/all` | Trang kho duoc xem inactive; POS khong duoc ban inactive |
| Loai ton | `inventory_shape=normal/roll/sheet` | Hien nhan de doc: Hang thuong, Cuon, Tam |
| Ton am | `negative_only=true` hoac filter FE neu response da co `is_negative` | Khong an ton am |
| Chi tiet san pham | `GET /api/v1/inventory/products/{product_id}` | Load khi mo detail, khong goi per-row tren list |
| Cuon vat ly | detail response hoac `GET /inventory/rolls` | Chi doc trong lat cat dau |
| Tam/tam lo | detail response hoac `GET /inventory/sheets` | Chi doc trong lat cat dau |
| Stock movement gan day | detail response | Chi hien 10 dong gan nhat neu co |

## 4B. Nguyen tac du lieu hien tai

Hien tai du lieu KiotViet cua nhieu hang cuon/tam chi co tong m2, chua du de biet tung cuon/tam con bao nhieu.

UI phai theo cac quy tac:

- khong tao danh sach cuon/tam ao tu tong m2
- van hien ton tong m2 de ban va doi soat
- gan nhan `Ton tam m2` cho du lieu chua chuan hoa
- gan nhan `Da chuan hoa` cho phan da co cuon/tam vat ly
- neu mot hang vua co ton tam vua co ton chuan hoa, hien tong chung kem dien giai nguon, vi du `120 m2 = 80 m2 tam + 40 m2 da chuan hoa`
- ton am khong bi an va co filter rieng
- canh bao ton am/het ton chi nhe bang mau do/trang thai, khong modal chan thao tac

## 5. Filter va table MVP

Filter lam truoc:

- nhom hang neu du lieu products da co group
- ton kho: tat ca, con ton, het ton, ton am
- loai ton: tat ca, hang thuong, cuon, tam
- trang thai hang: dang kinh doanh, ngung ban, tat ca
- thoi gian tao: toan thoi gian/tuy chinh neu API co field

Table mac dinh:

- ma hang
- ten hang
- loai ton
- don vi ton
- trang thai chuan hoa: ton tam m2, da chuan hoa, hon hop
- gia ban mac dinh neu co
- ton hien tai
- trang thai
- cap nhat gan nhat neu co
- hanh dong mo chi tiet

Cot tien can canh phai. Cot so luong/ton can canh phai. Text dai trong ten hang khong lam nhay chieu cao bat thuong.

## 6. Tong/footer

Footer/list summary chi hien nhung so tinh duoc tu API/list hien tai:

- tong so dong theo filter
- so hang ton am neu API tra ve hoac filter dang la ton am
- tong ton chi hien khi cung don vi; neu nhieu don vi thi khong cong thanh mot so gay sai

Khong hien `khach dat`, `kenh ban`, `thuong hieu`, `vi tri kho` trong lat cat dau.

## 7. Detail

Click row mo detail inline hoac panel:

- header: ma hang, ten hang, trang thai, loai ton
- tong ton hien tai
- nguon ton: tam m2, da chuan hoa, hon hop
- cau hinh ton: track inventory, don vi ton, allow negative
- neu cuon: danh sach cuon, kho rong, chieu dai con, dien tich con, status
- neu tam: danh sach tam/tam lo, kich thuoc, dien tich, status
- stock movement gan day neu co

Detail phai hien loading ngay khi click, khong doi API xong moi mo UI.

## 7B. Ghi chu UI cho khui va tấm

Khui vat tu khong nam trong lat cat UI dau tien neu chua du API, nhung khi lam phai theo huong:

- mot lan khui chi khui mot vat tu
- chon loai vat tu, sau do chon kho/quy cach
- khong bat nhap lo, ngay mua, nha cung cap trong thao tac khui
- neu da chuan hoa, hien san so con lai he thong tinh; nhan vien duoc sua
- neu chua chuan hoa, so con lai mac dinh `0`; nhan vien duoc sua neu biet
- nhap `0` nghia la phan cu het/bo; nhap lon hon `0` nghia la con dung lai duoc

Voi tam:

- UI dung kho thao tac don gian, vi du `1.2 x 2.4`
- he thong de xuat phuong an tiet kiem vat tu nhat
- nhan vien co dropdown doi sang phuong an de thao tac hon, vi du dung tam nguyen truoc
- kich thuoc phan con lai/rẻo hien theo may tinh, nhan vien duoc sua
- checkbox `Bo reo nho` mac dinh bat khi reo nho duoc de xuat bo
- neu phan m toi con duoi `0.2m`, de xuat bo nhu reo nho

## 8. State va performance

- Initial page khong duoc goi detail per-row.
- Lookup phu chi load khi can.
- Empty state phan biet khong co du lieu va dang bi filter.
- Search code nen uu tien ra dung hang, khong bi filter thoi gian/trang thai che neu API cho phep.
- Loi API hien trong vung workspace, co nut thu lai.

## 9. Acceptance criteria

1. Trang Inventory/Hang hoa load list bang 1 request chinh.
2. Loc duoc active/inactive/all va ton am.
3. Hang inactive thay duoc trong Inventory nhung khong bat buoc xuat hien o POS.
4. Click row mo detail readonly va hien loading tuc thi.
5. Khong co goi API chi tiet theo tung row khi load list.
6. Khong hien field KiotViet khong co du lieu trong QC-OMS.
7. UI phan biet ton tam m2 va ton da chuan hoa.
8. BOM, stocktake va production auto stock duoc ghi ro la phase sau neu chua implement.
