# TARGET STATE QC-OMS - He thong duy nhat

> Trang thai: Da chot dinh huong theo Owner - 2026-06-28
> Source of Truth: muc tieu san pham cuoi cung cua QC-OMS.

---

## 1. Dinh huong cuoi cung

QC-OMS khong phai ban web cua QuanLyXuong cu.

Muc tieu cuoi cung la chi con mot he thong chinh:

```text
QC-OMS = ke toan + POS + quan ly xuong + giam sat may san xuat + cong no + bao cao + ho tro gui khach
```

QuanLyXuong cu, Dashboard cu va Auto_CRM chi duoc xem la he thong legacy de hoc luong van hanh thuc te va di tru dan. Khong giu lau kien truc:

```text
QuanLyXuong cu + Dashboard cu + Auto_CRM + QC-OMS rieng le
```

Khi QC-OMS du nang luc thay the, QuanLyXuong cu phai duoc tat han.

---

## 2. Nguyen tac san pham

QC-OMS phai la phan mem quan tri xuong thuc thu, khong chi la man hinh theo doi may.

He thong can phan tach ro ba mien du lieu:

| Mien du lieu | Nguon tao du lieu | Muc dich |
|---|---|---|
| POS / Ke toan | Nhan vien nhap don, thu ngan, quan ly | Don hang, hoa don, thanh toan, cong no, doanh thu |
| San xuat | May in, may cat, agent doc log/file | File san xuat, trang thai may, thoi gian chay, lan in lai |
| Doi soat | QC-OMS tinh tu POS va San xuat | Chenh lech, hao hut thuc, canh bao, bao cao |

Hai mien POS va San xuat duoc thiet ke doc lap ve nghia vu va quyen ghi, nhung nen nam trong cung PostgreSQL/Supabase cua QC-OMS de doi soat an toan.

Khong nen tach thanh hai database vat ly khac nhau neu chua co ly do van hanh bat buoc. Cach dung dung la tach schema/bang/module:

```text
sales_*       = du lieu POS / ke toan
production_*  = du lieu may san xuat
reconcile_*   = du lieu doi soat / hao hut
```

Neu may san xuat can chay khi mat mang, agent tren may co the dung local cache tam thoi, nhung Source of Truth van la QC-OMS.

---

## 3. Luong tong quat mong muon

```text
Nhan vien nhap don
  -> sales orders / invoices / payments

May san xuat gui event
  -> production jobs / machine events / queue

QC-OMS doi soat
  -> so sanh don nhap voi thuc te may chay
  -> tinh hao hut thuc
  -> hien thi canh bao va bao cao

QC-OMS bill
  -> in / preview / ho tro gui Zalo, nhom Zalo, Facebook neu khach cau hinh
```

Trong giai doan dau, gui tin cho khach nen la co che ho tro nhan vien: sinh anh bill, mo dung noi gui, copy noi dung/anh, nhan vien kiem tra va bam gui. Tu dong gui qua OpenClaw chi nen lam sau khi du lieu bill, khach va log gui da on dinh.

---

## 4. Man hinh may dang van hanh

Man hinh Dashboard cu phai duoc thay bang man hinh trong QC-OMS:

```text
QC-OMS / San xuat / Trang thai may
```

Man hinh nay can hien thi:

- May In Bat dang lam file nao.
- May In Decal dang lam file nao.
- May CNC dang cat file nao.
- May nao mat ket noi hoac khong ping.
- File nao ket qua lau.
- File nao da DONE.
- File nao in/cat lai nhieu lan.
- Tong m2 theo ca, ngay, may va khach.
- Canh bao log may khong cap nhat.

Man hinh nay khong doc truc tiep SQLite cu. Du lieu can di qua bang `production_*` cua QC-OMS.

---

## 5. Doi soat va hao hut thuc

Day la diem khac biet chinh giua QC-OMS va QuanLyXuong cu.

QC-OMS phai so sanh duoc:

```text
POS ghi nhan: khach dat 10 m2
May thuc te: in 11.4 m2
Ket qua: hao hut thuc 1.4 m2
```

He thong can phat hien cac truong hop:

- POS co hoa don nhung may chua chay.
- May co file chay nhung POS chua co don.
- May in lai lan 2, lan 3.
- May DONE nhung bill chua gui khach.
- Chenh lech kich thuoc, so luong hoac vat lieu.
- Hao hut theo may, vat lieu, khach, nhan vien, ca lam.

---

## 6. Lo trinh thay the legacy

Thu tu thay the QuanLyXuong cu:

1. Tao DB san xuat trong QC-OMS.
2. Viet bridge doc du lieu QuanLyXuong cu va day vao QC-OMS de kiem chung.
3. Lam man hinh giam sat may trong QC-OMS.
4. Lam POS / hoa don nhap trong QC-OMS.
5. Cho hang doi may bam `[+]` dua vao hoa don nhap.
6. Lam doi soat POS voi san xuat.
7. Tinh hao hut thuc.
8. Viet agent may san xuat moi gui truc tiep ve QC-OMS.
9. Tat han QuanLyXuong cu, Dashboard cu va Auto_CRM cu.

---

## 7. Tham chieu

- Luong legacy de hoc va di tru: [Legacy-QuanLyXuong](../06-INTEGRATION-KetHop/Legacy-QuanLyXuong/README.md)
- Hang doi may trong POS: [K02-D Hang doi](../02-PRD-UX-PhongCanh/POS/K02/04-K02D-HANG-DOI.md)
- Thanh toan va gui bill: [K03-D Thanh toan](../02-PRD-UX-PhongCanh/POS/K03/04-K03D-THANH-TOAN.md)
