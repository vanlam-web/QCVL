# BOM/Combo MVP Boundary Draft

> Ngay lap: 2026-07-01
> Trang thai: Draft dieu phoi da duoc Owner chot huong BOM; chua phai Source of Truth DB/API
> Nguon: PRD K02-A, export KiotViet, Inventory business da chot.

---

## 1. Ly do can draft

PRD K02-A hien co nhieu y tuong manh:

- Combo cap 1/cap 2.
- Nut sua BOM tren dong POS.
- Deep-scan khi checkout.
- Khui vat tu dong.
- Tong gia vat tu kho de doi chieu bien loi nhuan.

Trong khi do Business Inventory da chot MVP theo huong don gian:

- Tru kho khi luu/chot hoa don chinh thuc.
- Du lieu may san xuat khong tu tru kho.
- Roll/sheet quan ly vat ly rieng.
- BOM la dinh muc vat tu, nhung khong bat buoc lam day du ngay trong POS MVP.

Draft nay khoa ranh gioi de implement khong vo tinh lam BOM phuc tap qua som, dong thoi ghi lai quyet dinh Owner ve BOM nhieu cap.

Quyet dinh Owner da chot:

- BOM la **dinh muc vat tu** de biet mot san pham/dich vu can tru vat tu nao.
- Hieu don gian: BOM la "cong thuc tru kho vat tu", khong phai cong thuc tinh gia ban bat buoc.
- Vi du `In bat` gom bat + muc in + keo dan + khuy bat...
- BOM co the long nhieu cap: `khung sat ban bat` co the gom `in bat` + `khung sat`; BOM cap 3 co the gom `khung sat ban bat` + `ton`.
- Khi long BOM, he thong can deep-scan de ra vat tu con cuoi cung khi checkout/preview.
- Co the sua BOM.
- Trong POS co the them/sua BOM phat sinh; neu luu thi tao combo/BOM moi de dung lai, neu khong luu thi chi xem nhu dinh muc cua dong do de tru kho cho lan ban hien tai.
- Owner giao cho spec tu de xuat chi tiet BOM sao cho gon thao tac va phu hop xưởng.

Cap nhat export KiotViet ngay `2026-07-01`:

- `DanhSachSanPham_KV01072026-104741-899.xlsx` co `189` dong co cot `Hang thanh phan`.
- Dinh dang KiotViet dang la text `MaThanhPhan:SoLuong|MaThanhPhan:SoLuong`.
- Vi du `HH = DCS:0.6|F5:0.3`, `IDC = DCS:0.1`, `SP000525 = DCS:1.2|A5T:0.42|SP000124:4.5`.
- Du lieu nay xac nhan BOM/dinh muc la nghiep vu that, nhung QC-OMS khong nen dung text nay lam schema chinh. Khi import/chuyen doi sau nay, chi nen dung lam nguon tao draft BOM de ra soat.

---

## 2. Nguyen tac MVP de xuat

### 2.1. Ban hang va tinh tien

Combo trong POS truoc het la **dong ban hang**.

MVP phai luu snapshot dong combo:

- ma/tên combo tai thoi diem ban
- so luong
- don gia
- thanh tien
- ghi chu
- neu co kich thuoc thi luu kich thuoc co cau truc
- neu nhan vien sua vat tu trong combo thi luu snapshot cho chung tu

Gia ban combo khong bat buoc bang tong gia vat tu thanh phan. Gia ban van theo bang gia/nhan vien sua gia.

### 2.2. Tru kho

MVP chia 2 cap:

| Truong hop | Cach xu ly |
|---|---|
| Combo co BOM san trong danh muc | Tru kho theo thanh phan khi chot hoa don |
| Nhan vien them/sua BOM ngay trong POS va chon `Khong luu - Chi tru kho` | BOM vua nhap la dinh muc cua dong hang do; tru kho theo BOM nay khi chot hoa don, khong tao combo moi |
| Nhan vien them/sua BOM ngay trong POS va chon `Luu Combo moi` | Tru kho theo BOM nay cho hoa don hien tai va luu thanh combo moi trong danh muc de dung lai |
| Vat tu roll/sheet trong combo | Neu tru thanh phan thi van phai theo rule roll/sheet vat ly, khong tru tong m2 gop |
| Combo long combo | Du an co huong ho tro deep-scan; POS MVP co the chua lam day du neu phase nay chua bat dau |

Nguyen tac an toan: **co BOM thi tru theo BOM, khong co BOM thi khong tu doan vat tu con**. He thong co the canh bao de quan ly bo sung BOM sau.

Khi BOM co nhieu cap, he thong phai deep-scan theo cau hinh BOM de tinh vat tu con cuoi cung. Can co validation chong vong lap, vi du `A -> B -> A`.

De xuat chot cho phase BOM:

- BOM hien hanh duoc version hoa; moi lan sua cau hinh BOM tao version moi.
- Hoa don/bao gia luu snapshot BOM version da dung, de chung tu cu khong bi thay doi khi BOM hien tai duoc sua.
- Deep-scan mac dinh toi da 5 cap; qua gioi han thi backend chan va bao loi cau hinh.
- BOM item co the tro toi vat tu la hoac mot BOM/san pham co BOM con.
- Khi checkout, he thong quy doi ve vat tu la cuoi cung de tao stock movement.
- Neu mot nhanh BOM thieu cau hinh, he thong canh bao nhung khong chan checkout trong POS MVP; dong do duoc flag de quan ly bo sung BOM sau.

### 2.3. Luu hoac khong luu combo moi

Khi nhan vien sua BOM trong don:

- Mac dinh `Khong luu - Chi tru kho`: luu snapshot BOM trong chung tu va dung BOM do de tru kho cho hoa don hien tai.
- Neu chon `Luu Combo moi`: tao combo/SKU moi trong danh muc de dung lai sau.
- Khong tu tao combo moi neu nhan vien khong chon `Luu Combo moi`.

---

## 3. UI K02-A nen hieu the nao

Trong MVP, K02-A co the giu nut `[Sua BOM]` neu san pham da co BOM ro.

Nhung can giam ky vong:

- Deep-scan nhieu cap la huong da chot cho phase BOM, nhung co the chua bat buoc trong POS MVP neu chua co DB/API BOM.
- Khong bat buoc tinh loi nhuan chuan ke toan tu BOM.
- Tong gia vat tu kho neu hien thi chi la tham khao, khong phai loi nhuan chot.
- Neu dong combo khong co BOM san va nhan vien cung khong them BOM phat sinh, checkout van tinh tien theo dong combo nhung khong co vat tu con de tru; can hien canh bao neu san pham duoc danh dau la can BOM.

Thong diep UI de sau:

```text
Combo nay chua co BOM de tru vat tu con.
Hoa don van duoc luu; vui long kiem tra ton kho hoac bo sung BOM sau.
```

---

## 4. Data model de sau

Khi chuyen thanh Source of Truth, co the can:

- `product_boms`
- `product_bom_items`
- `order_item_bom_snapshots`
- relation tu BOM item sang product/vat tu
- version BOM de biet hoa don da ban theo cau hinh nao
- validation chong vong lap neu cho combo long combo

Chua tao DB/API ngay neu phase BOM chua bat dau:

- schema version BOM va snapshot BOM
- gioi han so cap deep-scan, mac dinh de xuat 5 cap
- cach tinh chi phi tham khao tu BOM

---

## 5. Checkout behavior de xuat

```text
Checkout hoa don
  -> Validate dong ban
  -> Voi dong normal/area/linear/sheet: tru kho theo rule Inventory
  -> Voi dong combo:
       neu co BOM san hoac BOM phat sinh trong POS:
         deep-scan neu BOM long nhieu cap
         tao stock movement cho vat tu con cuoi cung theo BOM do
       neu khong co BOM:
         luu snapshot combo
         khong co vat tu con de tru
         ghi canh bao/flag neu san pham can BOM
  -> Ghi tien/cong no/so quy nhu binh thuong
```

De xuat chot tam cho BOM phase:

- BOM thieu cau hinh: cho checkout, hien canh bao va flag dong hang.
- Stock movement am cho vat tu thanh phan: cho phep nhu hang thuong, nhung canh bao.
- Deep-scan toi da 5 cap.
- Sua BOM tao version moi; hoa don cu dung snapshot/version cu.

Khuyen nghi MVP: cho checkout, hien canh bao khong chan ban, vi owner da uu tien thao tac gon va ban thieu ton van duoc cho tiep.

---

## 6. Quan he voi khui vat tu

Khui vat tu la luong Inventory vat ly, khong nen nam trong BOM MVP.

Ranh gioi:

- BOM noi "can vat tu nao".
- Inventory/roll/sheet noi "lay cuon/tam nao".
- Production queue/may san xuat noi "may da chay file nao".
- Checkout hoa don la moc ghi stock movement MVP.

Khui dong theo may san xuat co the dung de de xuat/chon vat tu sau, nhung khong thay the rule checkout trong MVP.

---

## 7. De xuat cap nhat PRD sau

Khi co thoi gian, nen ha mot so cau trong K02-A tu "bat buoc" thanh "sau MVP":

- "Deep-Scan khi thanh toán" -> da chot ve huong nghiep vu, dua vao phase BOM.
- "Combo cap 2 khoa/deep scan backend" -> dung cho phase BOM, chua bat buoc o POS MVP neu DB/API chua co.
- "Tong gia vat tu kho" -> tham khao, khong phai loi nhuan chuan.
- "Luu Combo moi" -> duoc phep neu phase POS/BOM lam den; khong tu dong luu neu nhan vien khong chon.

---

## 8. Noi dung con can dac ta truoc khi implement BOM

1. Chi tiet UI sua BOM trong POS: hien dang cay hay bang phang co nut mo rong.
2. Chi tiet API luu version BOM va snapshot BOM.
3. Cach hien tong chi phi vat tu tham khao tu BOM.
4. Gia ban combo doc lap voi tong chi phi vat tu; tong chi phi chi la tham khao/bao cao.
