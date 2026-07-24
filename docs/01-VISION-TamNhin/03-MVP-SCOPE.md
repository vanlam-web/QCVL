# MVP SCOPE - Pham vi QCVL hien tai

> Trang thai: Da chot dinh huong theo Owner - 2026-07-01
> Source of Truth: pham vi san pham hien tai de tranh copy du KiotViet.
> Doc cleanup / SoT vs runtime: [Quy tắc tài liệu](../DOCUMENT_RULES.md). Owner 2026-07-20: da import het KV — khong mo import moi.

---

## 1. Nguyen tac chung

QCVL tham khao KiotViet de hoc cach to chuc thao tac va du lieu, nhung khong copy 100%.

Pham vi MVP uu tien luong van hanh thuc te cua xuong:

```text
POS ban dut -> hoa don -> tru kho -> thu tien/cong no -> so quy -> doi soat -> bao cao quan tri
```

Nhung man hinh KiotViet khong co du lieu thuc te, it dung, hoac thuoc retail/online/thue se bi loai khoi QCVL hien tai tru khi Owner yeu cau phat trien lai sau.

---

## 2. Trong scope MVP

| Nhom | Noi dung giu |
|---|---|
| POS ban hang | Ban dut tai quay, bao gia, mo lai bao gia de checkout thanh hoa don |
| Hang doi may san xuat | May san xuat gui thong bao vao POS de nhan vien tao hoa don nhap; thong bao nay chi la dau vao thao tac, chua phai ton kho/doanh thu |
| Chung tu ban hang | Bao gia `BG...`, hoa don `HD...`, hoa don sua dang `MaCu.01`, chung tu da huy |
| Khach hang | Ma khach, ten khach, SĐT tuy chon/unique neu co, nhom khach, bang gia, lich su ban, cong no |
| Bang gia | Gia chung, bang gia theo nhom khach, gia sua tay luu lich su theo khach + san pham |
| Hang hoa/kho | San pham dang ban/ngung ban, ton vat ly cuon/tam/tam lo, quy doi don vi, tru kho khi luu hoa don |
| Kiem kho | Phieu tam, can bang kho, huy phieu, phieu tu dong khi sua ton hang thuong |
| Dieu chinh ton | Dieu chinh/huy vat tu toi gian; khong tao module Xuat huy/Xuat dung noi bo rieng |
| Tai chinh | So quy tien mat, tai khoan ngan hang, phieu thu/chi, thu no, phan bo no hoa don cu nhat truoc |
| Doi soat | Doi soat cuoi ngay theo tien mat va tung tai khoan ngan hang |
| Bao cao | Cuoi ngay, ban hang, cong no, hang hoa/ton kho, tai chinh quan tri |
| He thong | Tai khoan, permission system nen tang, active/inactive, may tram; MVP van hanh voi preset noi bo du quyen thao tac chinh |

---

## 3. Ngoai scope hien tai

| Nhom | Quyet dinh |
|---|---|
| Dat hang KiotViet | Khong lam trong QCVL hien tai. QCVL chi ban dut; bao gia khong phai don dat hang |
| Giao hang/van don | Khong lam van don, doi tac giao hang, trang thai giao hang, khu vuc giao hang |
| COD/ban giao hang | Khong lam COD, phi giao hang, doi soat giao hang |
| Ban online | Khong lam website ban hang, Zalo shop, don online, thong ke truy cap website trong QCVL hien tai |
| Ban da kenh/TMDT/MXH | Khong ket noi/dong bo Shopee, Tiktok Shop, Lazada, Tiki, Facebook, Instagram, Zalo OA trong QCVL hien tai |
| Tra hang ban | Khong lam trong QCVL hien tai; hoa don sai xu ly bang sua chung tu `MaCu.01` va huy chung tu cu |
| Tra hang nhap | Khong lam trong lat cat Purchase dau tien; chi xem lai neu sau nay thuc te phat sinh |
| Hoa don dien tu/VAT/thue | Khong phat hanh/quan ly HĐĐT, khong tinh VAT/thue ke toan trong QCVL hien tai |
| So ke toan/to khai thue | Khong lam ho so ke khai thue, so ke toan thue, to khai thue trong QCVL hien tai |
| Thuong hieu retail | Khong tao field/module/report rieng; neu can thi ghi trong ten/ma/nhom hang |
| Diem thuong/loyalty | Khong lam tich diem, Zalo loyalty/onboarding, khuyen mai tu dong, sinh nhat/gioi tinh retail |
| Khuyen mai retail | Khong lam module Campaign/Khuyen mai rieng trong QCVL hien tai; neu can gia theo so luong thi xem lai trong PriceBook sau |
| Nhan su cham cong | Khong lam lich lam viec, bang cham cong, bang luong, hoa hong/KPI |
| Mua dich vu rieng | Xu ly bang phieu chi So quy neu can; khong tao module mua dich vu rieng trong QCVL hien tai |
| Vi dien tu | Chua lam; hien tai chi tien mat va ngan hang |

---

## 4. De sau MVP

| Nhom | Khi nao xem lai |
|---|---|
| Nha cung cap/Purchase | Co trong pham vi du an sau POS MVP; khi lam phai nhap dung cuon/tam mua vao, khong mua m2 cho hang cuon/tam |
| Gia von/lai lo day du | Gia von tu phieu nhap phai duoc luu; bao cao loi nhuan day du lam khi Purchase, chi phi san xuat va phuong phap gia von da chot |
| BOM/dinh muc vat tu nhieu cap | Co trong huong du an; POS MVP chi can khong lam sai ranh gioi, phase BOM sau se deep-scan vat tu con |
| May san xuat tu tru kho | Khi giai quyet duoc cach doi soat/chot tru kho tu du lieu may san xuat; MVP van cho may san xuat gui thong bao de tao hoa don nhap, nhung kho chi tru theo hoa don da luu |
| Production/Work Orders | Neu sau nay can quan ly viec can san xuat/cho lay hang rieng voi POS |
| Gui tin tu dong | Sau khi bill, khach hang va log gui on dinh; hien tai chi ho tro mo/copy de nhan vien gui |

---

## 5. Quy tac ap dung cho implement

1. Neu mot man KiotViet co truong/chuc nang nam ngoai scope tren, khong dua vao UI/API/DB MVP.
2. Neu can luu thong tin phu nhu ten cong ty, MST, dia chi phap ly, chi xem la thong tin noi bo cua khach, khong mo luong HĐĐT/VAT.
3. Bao gia khong giu hang, khong tru kho, khong tao doanh thu, khong tao so quy va khong tao cong no.
4. Hoa don da luu la moc ghi nhan ban hang: tru kho, ghi thanh toan/cong no, so quy va bao cao.
5. Thong bao may san xuat co the tao/sua hoa don nhap trong POS, nhung khong duoc tu dong tao stock movement khi chua chot hoa don.
6. Doi voi spec moi tham khao KiotViet, phai doi chieu file nay truoc khi chuyen vao Source of Truth chi tiet.
7. Phan quyen MVP uu tien don gian: nhan vien noi bo mac dinh co du quyen thao tac chinh. Khong chia nho UI/luong van hanh theo qua nhieu permission neu chua co nhu cau thuc te.
8. Permission system van giu lam nen tang ky thuat. Chi tach quyen manh cho quan ly user/quyen, cau hinh he thong va tai chinh nhay cam neu Owner chot sau.

---

## 6. Tham chieu

- Audit KiotViet: Git history
- Luong ban hang: [POS-ORDER-LIFECYCLE.md](../03-BUSINESS-NghiepVu/Sales/POS-ORDER-LIFECYCLE.md)
- Chung tu ban hang: [SalesDocuments/README.md](../02-PRD-UX-PhongCanh/SalesDocuments/README.md)
- So quy: [CASHBOOK.md](../03-BUSINESS-NghiepVu/Finance/CASHBOOK.md)
