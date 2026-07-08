# KV Product Export Inventory Draft

> Ngay lap: 2026-06-30
> Trang thai: Draft phan tich export KV, khong phai Source of Truth nghiep vu
> Nguon du lieu: `/Users/vanlam/Downloads/DanhSachSanPham_KV30062026-122559-834.xlsx`
> Pham vi: Hang hoa, don vi tinh, ton kho, trang thai ban hang, combo/BOM tham khao cho QC-OMS

## 1. Muc tieu

File nay ghi lai nhung gi rut ra tu export san pham KiotViet de tang toc dac ta Inventory/BOM cho QC-OMS.

Nguyen tac ap dung:

- KV chi la du lieu tham khao, khong copy 1:1.
- Phan nao hop nghiep vu QC-OMS se de xuat giu.
- Phan nao chua chac se hoi Owner chot.
- Phan nao lam phuc tap hoac khong hop MVP se de xuat bo hoac doi.
- Sau khi Owner chot, moi cap nhat Source of Truth o `docs/03`, `docs/04`, `docs/05`.

## 2. Tom tat export

Workbook co 1 sheet:

```text
DanhSachSanPham_KV30062026-1225
```

Tong so dong du lieu: 656.

Cot trong export:

```text
Loai hang
Nhom hang(3 Cap)
Ma hang
Ten hang
Thuong hieu
Gia ban
Gia von
Ton kho
KH dat
Du kien het hang
Ton nho nhat
Ton lon nhat
DVT
Ma DVT Co ban
Quy doi
Hinh anh
Trong luong
Dang kinh doanh
Duoc ban truc tiep
Mo ta
Mau ghi chu
Vi tri
Hang thanh phan
Thoi gian tao
```

## 3. Thong ke quan trong

### 3.1. Loai hang

```text
Hang hoa: 460
Combo - dong goi: 184
Dich vu: 12
```

Nhan xet:

- QC-OMS can tach ro `product_type`: vat tu/hang hoa, thanh pham/combo, dich vu.
- KV dung `Combo - dong goi` cho nhieu mat hang co cong thuc thanh phan. QC-OMS khong nen mac dinh tat ca combo deu giong nhau; can chot lai BOM/Combo sau.

### 3.2. Trang thai kinh doanh

```text
Dang kinh doanh = 1: 495
Dang kinh doanh = 0: 161
Duoc ban truc tiep = 1: 656
Duoc ban truc tiep = 0: 0
```

Nhan xet:

- `Dang kinh doanh` trong KV co the map sang `status = active/inactive`.
- `Duoc ban truc tiep` khong giup phan loai vi tat ca dong deu bang 1.
- QC-OMS da chot san pham inactive khong tim thay trong POS, chi thay o trang Hang hoa qua bo loc trang thai.

### 3.3. Don vi tinh

Export co 93 gia tri DVT khac nhau, gom ca khac nhau do viet hoa/viet thuong.

DVT pho bien:

```text
Cai: 82
m2: 65
Tam: 62
m: 61
Tac: 56
To: 38
cai: 37
blank: 31
cay: 17
m toi: 14
Ram: 11
Cuon/cuon: 14
```

Nhan xet:

- QC-OMS can chuan hoa danh muc don vi tinh, khong giu nguyen 93 gia tri nhu KV.
- Can tach `unit_name` hien thi va `unit_kind` nghiep vu, vi `Cai/cai`, `Cay/cay`, `Tam/tam/Ta'm` dang bi trung y nghia.
- Cac don vi dang gom kich thuoc vao ten DVT nhu `Kho 91`, `Kho 127`, `500 To`, `1000 To`, `5 kg`, `10 kg` can hoi lai co nen la unit hay la quy cach/variant.

### 3.4. Don vi co quy doi

Co 140 dong co `Ma DVT Co ban`.

Vi du:

```text
Fomex 5mm: Tam -> Tac/Tam CNC/Tac CNC
Alu: Tam -> Tac hoac m toi
Mica: Tam -> m toi hoac m2
Giay: Ram -> To
Sat: Cay -> m
Bat/decal/PP: Cuon -> cac kho in
Keo/muc: Thung/Can -> chai/lit
```

Nhan xet:

- QC-OMS can co mo hinh quy doi don vi.
- Nhung khong nen copy cach KV dung nhieu dong san pham rieng cho moi DVT neu co the lam model gon hon.
- Can chot luong ban hang va tru kho cho san pham co nhieu don vi: ban theo DVT phu thi tru ton cua DVT co ban hay ton rieng tung DVT.
- Rieng vat tu dang cuon khong duoc quan ly nhu tong `m2` gop nhu KV; QC-OMS can quan ly tung cuon nhap vao de biet moi cuon con bao nhieu met dai va dien tich con lai.

### 3.5. Ton kho

Thong ke ton kho:

```text
Tong ton kho so hoc: 38,792.817
Dong ton kho = 0: 249
Dong ton kho am: 57
Tong ton am: -6,045.12
Ton kho max: 5,746
```

Nhan xet:

- KV dang cho phep hoac da phat sinh ton am.
- QC-OMS can chot chinh sach ban qua ton: chan, canh bao cho qua, hay cho am theo quyen.
- Ton am trong export co ca hang hoa vat tu, giay, alu/fomex/mica, dich vu/phi van chuyen bi nhap nhu hang hoa.

### 3.6. Hang inactive van co ton

Co 63 dong `Dang kinh doanh = 0` nhung `Ton kho != 0`.

Nhan xet:

- QC-OMS can cho san pham inactive van nam trong ton kho va bao cao.
- POS khong duoc ban/tim san pham inactive.
- Trang Hang hoa can bo loc inactive va van hien so ton de xu ly/chuyen doi/kiem ke.

### 3.7. Combo/BOM

Co 189 dong co `Hang thanh phan`.

Dinh dang KV:

```text
MaThanhPhan:SoLuong|MaThanhPhan:SoLuong
```

Vi du:

```text
HH = DCS:0.6|F5:0.3
IDC = DCS:0.1
SP000525 = DCS:1.2|A5T:0.42|SP000124:4.5
```

Tat ca ma thanh phan trong export deu tim thay trong danh muc san pham.

Nhan xet:

- QC-OMS nen co BOM/Combo rieng, nhung can dac ta sau Inventory.
- Can chot combo dung de ban thanh pham, de tinh dinh muc vat tu, hay ca hai.
- Can chot BOM co duoc sua theo tung don hang khong.

## 4. De xuat giu tu KV

### 4.1. Giu

- `Ma hang` la ma san pham bat buoc va unique trong organization.
- `Ten hang` la bat buoc.
- `Loai hang` can co nhung nen chuan hoa thanh enum QC-OMS.
- `Nhom hang(3 Cap)` can giu de phan loai, nhung nen tach thanh category tree.
- `Gia ban`, `Gia von` can co trong san pham, nhung gia ban mac dinh van di theo bang gia da chot.
- `Ton kho`, `KH dat`, `Ton nho nhat`, `Ton lon nhat` can dung cho inventory/reorder.
- `DVT`, `Ma DVT Co ban`, `Quy doi` la du lieu quan trong cho quy doi.
- `Dang kinh doanh` map sang active/inactive.
- `Hang thanh phan` dung lam tham khao cho BOM/Combo.

### 4.2. Can hoi lai truoc khi giu

- Co cho ton kho am trong MVP khong.
- Don vi nao la unit that su, don vi nao la quy cach/variant.
- Co quan ly ton tung DVT rieng hay chi ton theo don vi co ban.
- Voi vat tu dang cuon, he thong de xuat cuon/khổ mac dinh theo cong thuc toi uu hao hut, nhan vien duoc sua de xuat va chon lai cuon/khổ thuc te.
- Combo/BOM tru kho khi nao: luc tao don, luc xuat kho, hay luc hoan thanh san xuat.
- `KH dat` co can MVP khong hay de sau.
- `Du kien het hang` co can MVP khong hay chi tinh sau.
- `Thuong hieu`, `Vi tri`, `Trong luong`, `Mau ghi chu` co can trong MVP khong.

### 4.3. De xuat khong copy 1:1

- Khong giu nguyen 93 DVT, can normalize.
- Khong coi `Duoc ban truc tiep` la rule vi export tat ca deu bang 1.
- Khong coi moi `Combo - dong goi` la thanh pham san xuat thuc su; can chot lai tung nhom.
- Khong dung DVT de chua quy cach phuc tap neu QC-OMS co truong rieng cho width/height/khổ/quy cach.
- Khong dua draft nay cho implementation lam Source of Truth.

## 5. Cau hoi can Owner chot

### Q1. Chinh sach ton am

Owner da chot:

```text
Khi POS ban hang ma ton khong du, he thong canh bao nhung van cho ban tiep.
```

Ghi chu dua vao Source of Truth sau:

- POS phai hien canh bao ton khong du truoc khi thanh toan/luu hoa don.
- Nhan vien van co the tiep tuc ban sau khi thay canh bao.
- Stock movement co the lam ton kho am.
- Bao cao ton kho phai hien ro cac mat hang ton am de xu ly sau.

Lua chon da chot: 2.

Khi POS ban hang ma ton khong du:

1. Chan ban.
2. Canh bao nhung cho ban tiep.
3. Cho ban am neu nguoi dung co quyen.

### Q2. Don vi va quy doi

Owner da chot:

```text
QC-OMS quan ly ton kho theo mot don vi ton chinh.
Don vi ban phu chi dung de ban, tinh gia va quy doi ve don vi ton chinh khi tru kho.
Hang dong goi dac biet co the tao SKU rieng khi that su la mat hang doc lap, khong phai rule mac dinh.
```

Ghi chu dua vao Source of Truth sau:

- Moi san pham co mot `stock_unit_id` lam don vi ton chinh.
- POS co the ban bang `sale_unit_id` khac neu co cau hinh quy doi.
- Khi ban bang don vi phu, stock movement luu ca so luong ban theo don vi hien thi va so luong da quy doi theo don vi ton chinh.
- Khong tao nhieu ton kho doc lap cho cung mot vat tu chi vi khac DVT.
- Neu hang dong goi la mat hang doc lap that su, tao SKU rieng va co lien ket quy doi/BOM rieng.

Lua chon da chot: ket hop theo huong mot ton goc cho vat tu chinh, SKU rieng chi khi can.

Voi san pham co don vi co ban va don vi phu, QC-OMS nen:

1. Quan ly ton theo mot don vi co ban, cac don vi phu chi de ban/quy doi.
2. Quan ly ton rieng theo tung DVT nhu cac dong san pham rieng.
3. Ket hop: vat tu chinh theo don vi co ban, hang dong goi theo ton rieng.

### Q3. Don vi co kem kich thuoc

Owner da chot mot phan:

```text
Quy doi don gian nhu 1 ram giay = 500 to thi dung unit conversion binh thuong.
Vat tu dang cuon khong quan ly ton theo tong m2 nhu KV.
QC-OMS phai quan ly ton kho theo tung cuon nhap vao, de biet trong kho con bao nhieu cuon va moi cuon con bao nhieu met dai.
```

Ghi chu dua vao Source of Truth sau:

- DVT/quy doi don gian van dung he so quy doi, vi du `Ram -> To`.
- Cuon la doi tuong ton kho vat ly rieng, khong chi la DVT.
- Moi cuon nhap kho can co ma/so cuon rieng trong pham vi san pham.
- Moi cuon can luu it nhat:
  - san pham/vat tu
  - kho rong cua cuon
  - chieu dai ban dau
  - dien tich ban dau neu can tinh nhanh
  - chieu dai con lai
  - dien tich con lai
  - trang thai cuon: con dung, het, huy/loi neu can
- Khi ban/xuat theo `m2`, he thong quy doi ra chieu dai tieu hao theo kho rong cuon de tru vao cuon cu the.
- Bao cao ton kho vat tu cuon phai xem duoc ca tong ton va chi tiet tung cuon.
- Cach KV gom cuon thanh tong `m2` chi dung de tham khao, khong copy vao QC-OMS.

### Q3A. De xuat khổ/cuon khi xuat vat tu dang cuon

Owner da chot:

```text
Khi xuat vat tu dang cuon, nhan vien chon cuon bi tru.
Phan mem phai co de xuat mac dinh theo cong thuc toi uu hao hut.
Doi voi mat hang bat/in cuon, he thong suy luan khổ in phu hop dua tren kich thuoc file in, bien chua va cac cuon dang co.
Nhan vien co the sua de xuat, sua bien chua va chon khổ/cuon khac neu thuc te can.
```

Ghi chu dua vao Source of Truth sau:

- Dau vao toi thieu de de xuat:
  - san pham/vat tu dang cuon
  - kich thuoc file in thanh pham
  - bien chua mac dinh
  - danh sach cuon dang con ton, gom khổ rong va chieu dai con lai
- Kich thuoc tieu hao mac dinh:
  - `chieu_rong_tieu_hao = chieu_rong_file + bien_chua_rong`
  - `chieu_dai_tieu_hao = chieu_dai_file + bien_chua_dai`
  - Neu nghiep vu cho phep xoay file, he thong co the so sanh ca hai chieu de chon phuong an it hao hut hon.
- De xuat mac dinh uu tien:
  1. Cuon co khổ du de in kich thuoc tieu hao.
  2. Trong cac cuon du khổ, chon phuong an hao hut ngang it nhat.
  3. Neu co nhieu cuon cung hao hut, uu tien cuon dang dung do/da khui truoc.
  4. Neu van bang nhau, uu tien cuon co chieu dai con lai phu hop de giam manh le.
- Nhan vien duoc override:
  - chon khổ/cuon khac
  - giam hoac tang bien chua
  - chon phuong an khong toi uu neu thuc te san xuat can
- Khi nhan vien override, don/xuat kho phai luu snapshot:
  - khổ/cuon he thong de xuat
  - khổ/cuon thuc te nhan vien chon
  - bien chua mac dinh va bien chua da sua
  - ly do/ghi chu neu co

Vi du:

```text
File in 2m x 3m.
Bien chua mac dinh 0.1m moi chieu.
Kich thuoc tieu hao 2.1m x 3.1m.
He thong tim cac cuon co khổ phu hop va de xuat khổ hao hut it nhat.
```

```text
File in 2.5m x 2.05m.
He thong co the de xuat khổ 2.6m theo bien chua mac dinh.
Nhan vien co the doi sang khổ 2.1m neu don nay chi can chua bien 0.05m va thuc te san xuat chap nhan.
```

### Q3B. Phan loai hinh dang ton kho va bien chua mac dinh

Owner da chot:

```text
QC-OMS se co cac loai hang rieng cho hang thuong, hang dang cuon va hang dang tam.
Hang dang cuon va hang dang tam co bien chua/hao hut mac dinh phu hop voi tung loai.
Nhan vien van duoc sua bien chua/hao hut tren tung don neu thuc te san xuat can.
```

Ghi chu dua vao Source of Truth sau:

- Moi san pham co `inventory_shape`:
  - `normal`: hang thuong, dung unit conversion don gian neu co
  - `roll`: vat tu dang cuon, quan ly ton theo tung cuon
  - `sheet`: vat tu dang tam, quan ly theo kich thuoc tam va quy doi cat/ban
- `normal` dung cho cac hang nhu giay ram/to, keo, muc, linh kien, dich vu vat tu khong can toi uu cat.
- `roll` dung cho bat, decal, PP, canvas va vat tu in kho lon dang cuon.
- `sheet` dung cho alu, fomex, mica, PVC, tam nhua va vat tu dang tam.
- Cau hinh mac dinh cua `roll` nen co:
  - khổ cuon
  - chieu dai ban dau/chieu dai con lai theo tung cuon
  - bien chua mac dinh
  - co cho phep xoay file hay khong
  - co uu tien cuon dang khui hay khong
  - cong thuc de xuat khổ/cuon it hao hut
- Cau hinh mac dinh cua `sheet` nen co:
  - kich thuoc tam goc, vi du `2.44 x 1.22`
  - dien tich tam
  - cac don vi duoc ban: nguyen tam, m toi, m2
  - bien chua/cat hao mac dinh
  - co cho phep xoay chieu cat hay khong
  - quy tac tru kho ve don vi ton chinh
- Goi y bien chua mac dinh ban dau:
  - in bat thuong: `0.1m` moi chieu
  - decal/PP in dan: `0.05m` moi chieu
  - in can gia cong/nep/cang khung: `0.1m` den `0.2m` tuy loai viec
  - cat tam don gian: `0.01m` den `0.02m`
  - CNC/cat can chinh xac: `0.02m` den `0.05m`
- Cac gia tri tren la default de de xuat, khong khoa cung; nhan vien co the sua tren tung dong hang/don hang.
- Khi nhan vien sua, he thong luu snapshot default va gia tri thuc te da dung de tinh hao hut/tru kho.

### Q3C. Tam lo va cach tao tu dong

Owner da chot:

```text
Khong can buoc xac nhan tam lo moi sau moi lan cat vi se lam thao tac ruom ra.
He thong tu dong tao tam lo theo rule mac dinh.
Nhan vien co phuong thuc sua hoac xoa tam lo sau do neu thuc te sai.
```

De xuat rule tu dong cho MVP:

- Khi don hang cat/ban lam ton den hang `inventory_shape = sheet`, he thong tinh phan tieu hao theo kich thuoc va bien cat hao da ap dung.
- He thong uu tien chon tam lo phu hop nho nhat truoc; neu khong co tam lo phu hop thi dung tam nguyen.
- Sau khi tru phan tieu hao, he thong tu dong sinh tam lo moi tu phan con lai neu phan con lai dat nguong giu lai.
- Nguong giu lai mac dinh:
  - duoi `0.3m2` thi bo, khong tao tam lo
  - neu thuc te manh nho van tan dung duoc, nhan vien co the sua/tao tam lo thu cong de giu lai
- De tranh rac du lieu, MVP chi luu toi da 1-2 manh thua lon nhat sau mot lan cat.
- Moi tam lo can luu:
  - san pham/vat tu
  - kich thuoc dai/rong
  - dien tich
  - nguon goc: tu don/dong hang nao neu co
  - trang thai: `available`, `used`, `discarded`
- Nhan vien co the sua tam lo sau khi he thong tao:
  - sua kich thuoc thuc te
  - xoa/bo tam lo neu thuc te khong giu lai
  - danh dau da huy/khong dung duoc
- Moi thao tac sua/xoa tam lo can ghi log toi thieu: ai sua, luc nao, gia tri cu/moi, ly do neu co.

Cac DVT nhu `Kho 91`, `Kho 127`, `500 To`, `1000 To`, `5 kg`, `10 kg` nen:

1. Tach thanh quy cach/variant, khong coi la DVT chuan.
2. Giu la DVT hien thi de nhanh va giong KV.
3. MVP giu tam, sau nay normalize.

### Q4. Inactive co ton

San pham ngung ban nhung con ton:

1. Van hien o trang Hang hoa va bao cao ton, khong hien POS.
2. Can co luong rieng de thanh ly/xuat huy.
3. Tam chi can loc trang thai, xu ly xuat huy de sau.

### Q5. BOM/Combo

Owner da chot theo huong don gian MVP:

```text
Tao don thi tru kho.
Khong lam phuc tap bang quy trinh tru kho rieng theo may san xuat trong MVP.
Sau nay neu co phuong thuc tru kho phu hop hon ket hop voi may san xuat thi mo spec rieng.
```

Ghi chu dua vao Source of Truth sau:

- Khi tao/lưu don ban co dong hang can tru kho, he thong ghi stock movement theo dinh muc/quy doi tai thoi diem do.
- Voi combo/BOM, MVP co the tru theo vat tu thanh phan da cau hinh neu dong hang do co BOM ro rang.
- Neu BOM/dinh muc chua ro, he thong chi tru theo dong hang chinh va de phan vat tu chi tiet cho giai doan sau.
- Production data khong thay the stock movement trong MVP.
- Khi sau nay co quy trinh xac nhan san xuat/chon cuon/tam tot hon, se tao spec moi de thay doi thoi diem tru kho.

Lua chon cu duoi day da duoc thay bang quyet dinh MVP moi:

1. Ban hang thanh pham va tu dong tru vat tu theo dinh muc.
2. Chi de tinh gia/dinh muc tham khao, chua tu dong tru kho MVP.
3. Tach thanh module san xuat/BOM rieng sau Inventory.

### Q6. Du lieu may san xuat va tru kho

Owner da chot tam thoi:

```text
Chua dung du lieu may san xuat de tu dong tru kho chinh thuc.
Giai doan dau chi dung du lieu may san xuat de so sanh giua OMS/bill va thuc te may chay, xem lech nhu the nao.
Trong MVP, tao/lưu don van la moc tru kho de giu thao tac don gian.
```

Ly do:

- Tao don/bill chua chac da san xuat.
- File tren may san xuat co the dat ten bat ky.
- Mot file san xuat co the chua nhieu chi tiet, khong tuong ung 1-1 voi mot dong bill.
- Chua co cach match file may san xuat voi bill/dong bill du chac de tu dong tru kho.

Ghi chu dua vao Source of Truth sau:

- Giai doan dau, production data chi phuc vu:
  - giam sat may san xuat
  - doi soat OMS/bill voi thuc te may chay
  - phat hien file chay nhung chua thay bill
  - phat hien bill co hang san xuat nhung chua thay file chay
  - so sanh kich thuoc, so luong, tong `m2`
  - dem so lan chay lai/in lai
  - tinh hao hut thuc de tham khao
- Production data khong tu sinh `stock_movement` chinh thuc trong MVP.
- Stock movement chinh thuc trong MVP di theo don/bill va quy tac kho da chot, khong dua vao match file tu dong.
- Khi sau nay co rule match chac hon, se mo spec rieng de nang cap tu doi soat sang gan file/bill va tru kho tu dong.

### Q7. Du kien vat tu va thuc te vat tu

Owner da chot theo huong don gian MVP:

```text
MVP khong tach so kho thanh hai lop du kien va thuc te.
Tao/lưu don la moc tru kho chinh thuc.
Du lieu may san xuat chi dung de so sanh/doi soat, khong tao but toan kho rieng.
```

Giai thich:

- Neu tach `du kien` va `thuc te`, he thong se can them trang thai giu hang, xac nhan san xuat, doi soat tru kho, hoan tra vat tu va dieu chinh chenh lech. Viec nay dung ve dai han nhung lam MVP ruom ra.
- MVP chi can mot so kho chinh thuc: khi don duoc tao/lưu theo nghiep vu da chot, he thong tru kho.
- Neu sau do may san xuat chay khac voi bill, phan lech chi hien trong bao cao doi soat, chua tu dong sua so kho.
- Khi co quy trinh san xuat on dinh hon, se mo spec moi de them lop `planned_materials`/`actual_materials` hoac co che dieu chinh ton theo thuc te.

Ghi chu dua vao Source of Truth sau:

- `stock_movements` MVP la nguon chinh thuc cua ton kho.
- Production/reconciliation co the tinh cac chi so:
  - m2 bill
  - m2 may chay
  - chenhlech m2
  - so lan chay lai
  - hao hut tham khao
- Cac chi so doi soat khong tu dong sinh them stock movement trong MVP.

### Q8. Kiem kho theo tham khao KiotViet

Nguon tham khao Owner cung cap:

```text
Tinh nang Kiem kho KiotViet cho phep tao phieu kiem kho, nhap so luong thuc te, tinh chenh lech va can bang kho.
Trang thai gom: Phieu tam, Da can bang kho, Da huy.
Khi can bang kho, ton kho tren he thong duoc cap nhat theo so thuc te.
```

De xuat giu cho QC-OMS:

- Co module `Kiem kho` de doi soat ton thuc te voi ton tren he thong.
- Co ma phieu tu sinh dang `KK000001`.
- Co 3 trang thai chinh:
  - `draft`: Phieu tam, chua doi ton kho
  - `balanced`: Da can bang kho, da tao stock movement dieu chinh
  - `cancelled`: Da huy, khong anh huong ton kho
- Nguoi dung tao phieu kiem kho thu cong:
  1. Bam `+ Kiem kho`
  2. Chon san pham/vat tu can kiem
  3. Nhap so luong thuc te
  4. He thong tinh chenh lech:

```text
chenh_lech = so_luong_thuc_te - so_luong_he_thong
```

- `Luu tam` chi luu phieu, khong tao stock movement.
- `Can bang kho` tao stock movement loai `stocktake_adjustment` cho tung dong chenh lech va doi phieu sang `balanced`.
- `Huy phieu` doi trang thai sang `cancelled`, khong xoa vat ly.

De xuat ap dung cho QC-OMS:

- Cho phep sua ton ngay khi sua mot hang hoa trong trang Hang hoa.
- Khi nguoi dung sua so ton truc tiep o Hang hoa, he thong tu dong sinh mot phieu kiem kho/stocktake de truy vet thay doi.
- Phieu tu dong co trang thai `balanced` ngay, vi ton kho da duoc cap nhat tai thoi diem nguoi dung luu hang hoa.
- Ghi chu phieu tu dong theo mau:

```text
Phieu kiem kho duoc tao tu dong khi cap nhat Hang hoa: <Ten hang> (<Ma hang>)
```

- Phieu tu dong van tao stock movement loai `stocktake_adjustment`, giong thao tac `Can bang kho` thu cong.
- Neu nguoi dung sua thong tin hang hoa nhung khong sua so ton, khong sinh phieu kiem kho.
- Bang danh sach phieu can co cac cot chinh:
  - ma kiem kho
  - thoi gian tao
  - ngay can bang
  - tong so luong thuc te
  - tong gia tri thuc te
  - tong chenh lech
  - so luong lech tang
  - so luong lech giam
  - ghi chu
  - trang thai
  - nguoi tao
- Bo loc can co:
  - tim theo ma phieu
  - khoang thoi gian tao
  - trang thai
  - nguoi tao
- Co xuat Excel va tuy chinh cot hien thi sau MVP neu can; MVP co the lam sau phan nghiep vu can bang kho.

Ghi chu rieng cho hang `roll` va `sheet`:

- Hang `normal`: kiem theo so luong ton chinh.
- Hang `roll`: khong sua tong ton truc tiep; phai kiem/sua theo tung cuon.
- Hang `sheet`: khong sua tong ton truc tiep; phai kiem/sua theo tam nguyen, tam lo hoac tam do cu the.
- Tong ton cua hang `roll`/`sheet` chi la so tong hop tu cac doi tuong vat ly ben duoi.
- Khi sua ton trong trang Hang hoa:
  - `normal`: cho sua tong ton va tu sinh phieu kiem kho
  - `roll`: mo luong sua danh sach cuon
  - `sheet`: mo luong sua danh sach tam/tam lo

De xuat chot:

```text
QC-OMS giu luong Kiem kho giong KV o muc phieu tam -> can bang -> huy.
Khi sua ton truc tiep trong Hang hoa, he thong tu dong tao phieu kiem kho da can bang de truy vet.
Can bang kho tao stock movement dieu chinh.
Hang cuon/tam bat buoc xu ly theo doi tuong vat ly, khong sua tong ton truc tiep.
```

## 6. De xuat thu tu dac ta tiep theo

1. Owner chot Q1-Q4, Q6-Q8 de viet Inventory Business/Production reconciliation draft.
2. Cap nhat Source of Truth Inventory:
   - `docs/03-BUSINESS-NghiepVu/Inventory/README.md`
   - `docs/03-BUSINESS-NghiepVu/Inventory/STOCK-RULES.md`
   - `docs/03-BUSINESS-NghiepVu/Inventory/UNIT-CONVERSION.md`
3. Viet them draft doi soat san xuat neu can:
   - `docs/superpowers/specs/YYYY-MM-DD-production-reconciliation-draft.md`
4. Sau do moi chot Q5 va viet BOM/Combo draft.
5. Sau khi Business chot, moi viet Database/API Inventory.
