# Bill, Printer and Messaging Draft

> Ngay lap: 2026-07-01
> Trang thai: Draft tham khao da duoc chuyen phan nghiep vu chinh sang Source of Truth Sales tai `docs/03-BUSINESS-NghiepVu/Sales/POS-BILL-PRINT-MESSAGING.md`
> Ly do de draft: 06-INTEGRATION chi nen chot khi Business va Backend/API lien quan da ro.

---

## 1. Muc tieu

Gom lai cac quyet dinh lien quan bill sau khi ban hang/bao gia:

- tao bill de in hoac gui khach
- ho tro mo dung noi gui Zalo/Facebook
- nhan vien tu kiem tra va bam gui
- khong tu dong gui tin trong MVP

Draft nay giup sau nay tach thanh Integration chinh thuc cho Printer/Messaging ma khong lam POS phuc tap som.

---

## 2. Quyet dinh da chot

### 2.0. Tham khao KiotViet `Mau in`

KiotViet `PrintTemplates` co cac nhom mau:

- Dat hang
- Hoa don
- Giao hang
- Tra hang
- Doi tra hang
- Dat hang nhap
- Nhap hang
- Tra hang nhap
- Chuyen hang
- Phieu thu
- Phieu chi
- Binh luan

Tai khoan dang ra soat co mau dang chon `Bao gia chua the - A4` va thao tac `Xem truoc mau in`.

Quyet dinh QC-OMS:

- Giu mau `Bao gia` va `Hoa don/bill ban hang`.
- Giu mau `Phieu thu` va `Phieu chi` khi Finance can in/xuat phieu.
- Khong lam mau `Dat hang`, `Giao hang`, `Tra hang`, `Doi tra hang`, `Chuyen hang` trong scope ban dut.
- Khong lam mau `Dat hang nhap`, `Nhap hang`, `Tra hang nhap` cho toi khi phase Purchase/Supplier bat dau.
- Mau in QC-OMS la bill/phieu thu chi noi bo, khong phai HĐĐT.

### 2.1. Trong MVP

- Sau khi luu bao gia `BG...` hoac hoa don `HD...`, he thong mo Bill Preview / Print Popup.
- Bill duoc tao tu snapshot chung tu, khong lay lai gia/ten hang/khach hien tai.
- Bill bao gia va bill hoa don co the la hai mau khac nhau.
- Bill mac dinh luon co san.
- Co the co nhieu mau bill, nhung UI phai giu gon va de chon.
- Nhan vien co the in bill neu can.
- Neu khach da cau hinh gui bill hop le, he thong hoi co gui bill hay khong.
- Neu nhan vien chon gui, he thong sinh anh bill va mo dung noi gui theo cau hinh khach.
- He thong co gang copy anh bill vao clipboard de nhan vien dan bang `Ctrl+V`.
- Nhan vien phai tu kiem tra dung khach/nhom/cuoc tro chuyen va tu bam gui.
- Neu khong mo/copy duoc, he thong giu bill tren man hinh de nhan vien tai anh hoac thao tac thu cong.

### 2.2. Ngoai scope MVP

- Khong tu dong gui tin thay nhan vien.
- Khong tich hop Zalo OA API/Messenger Platform trong MVP.
- Khong luu lich su gui bill trong MVP.
- Khong lam bot gui lai, queue gui tin, trang thai da gui/loi gui.
- Khong co phan quyen/duyet nhieu buoc truoc khi gui bill.
- Khong dung HĐĐT/VAT/thue trong bill QC-OMS.

---

## 3. Luong de xuat

```text
Luu bao gia/hoa don thanh cong
  -> Tao bill tu snapshot chung tu
  -> Mo Bill Preview / Print Popup
  -> Nhan vien chon mau bill can in/gui
  -> Neu in: goi co che in cua trinh duyet/may tram
  -> Neu khach co cau hinh gui bill:
       hoi [Gui] / [Khong gui]
       Neu [Gui]:
         sinh anh bill
         copy anh vao clipboard neu trinh duyet/OS cho phep
         mo Zalo/Facebook theo cau hinh
         nhan vien kiem tra, paste va bam gui
```

Nguyen tac: he thong chi chuan bi va dieu huong, khong thuc hien hanh dong gui cuoi cung.

---

## 4. Mau bill

### 4.1. Du lieu bat buoc

- Ma chung tu: `BG...` hoac `HD...`.
- Thoi gian tao/ban.
- Khach hang snapshot: ma, ten, SĐT neu co.
- Nhan vien ban/tao.
- Danh sach dong hang:
  - ma hang
  - ten hang snapshot
  - kich thuoc/met toi/m2 neu co
  - so luong tinh tien
  - don gia
  - thanh tien
- Ghi chu dong va ghi chu chung neu co.
- Tong tien hang.
- Giam gia neu co.
- Khach can tra.
- Khach da tra.
- Con no/tien thua neu co.

### 4.2. Du lieu khong dua vao bill MVP

- Kenh ban.
- Van don/COD/phi giao hang.
- VAT/HĐĐT/thue.
- Diem thuong/loyalty.
- Thuong hieu retail rieng neu khong nam trong ten/ma hang.

---

## 5. Cau hinh gui bill theo khach

Nguon cau hinh nam o ho so khach hang/POS customer panel:

| Kenh | Du lieu can co |
|---|---|
| Zalo ca nhan | Link/ID hoac cach mo hoi thoai duoc xac minh |
| Nhom Zalo | Link/ID nhom duoc xac minh |
| Facebook/Messenger | Link/username/hoi thoai phu hop |

Quy tac:

- Khach chua bat gui bill thi khong hoi gui.
- Khach bat gui bill nhung thieu/sai cau hinh thi hien canh bao, khong tu mo noi gui.
- Neu mot khach co nhieu kenh, MVP nen cho chon mot kenh mac dinh de thao tac nhanh.
- Vi day la ho tro gui, sai cau hinh khong duoc lam fail checkout/luu bao gia.

---

## 6. Printer

MVP nen uu tien in qua trinh duyet:

- Render bill HTML trong popup.
- Goi print dialog cua browser/POS station.
- Luu lua chon mau bill/may in gan nhat o muc may tram hoac browser neu lam duoc don gian.

Chua can:

- Driver in rieng.
- Agent in ngam.
- In tu dong khong hien dialog.
- Quan ly hang doi in phuc tap.

Khi can in ngam/on dinh hon, mo spec Integration Printer rieng:

- loai may in
- USB/LAN
- kich thuoc giay
- encoding/font tieng Viet
- retry khi may in mat ket noi
- log lenh in

---

## 7. Render anh bill

De xuat MVP:

- Frontend render anh tu bill HTML de trien khai nhanh.
- Anh bill duoc hien lai trong popup truoc khi gui.
- Neu browser khong cho copy anh vao clipboard, cung cap tai anh hoac copy fallback.

De sau:

- Backend render anh/PDF neu can chat luong dong nhat, font on dinh, hoac can gui qua integration server-side.

---

## 8. Loi va fallback

| Tinh huong | Cach xu ly MVP |
|---|---|
| Khong mo duoc link Zalo/Facebook | Hien loi ro, giu anh bill tren man hinh |
| Chua dang nhap Zalo/Facebook | Hien huong dan dang nhap ngan gon, khong fail chung tu |
| Clipboard bi chan | Cho tai/copy thu cong |
| Anh bill render loi | Cho in/xem HTML bill, bao loi render anh |
| Khach chua co cau hinh gui | Khong hien popup gui bill |

Checkout/luu bao gia da thanh cong thi loi gui bill khong duoc rollback chung tu.

---

## 9. Khi nao chuyen thanh Source of Truth

Tach thanh spec chinh thuc khi bat dau phase Bill/Printer/Messaging:

- PRD-UX: chot man hinh quan ly mau bill neu can.
- Business: chot quy tac bill snapshot va gui bill khong rollback chung tu.
- Database: chot co luu mau bill/cau hinh may in/cau hinh khach vao DB hay local config.
- Backend: chot API lay/render bill va config.
- Integration: tao `docs/06-INTEGRATION-KetHop/Printer/` va `docs/06-INTEGRATION-KetHop/Messaging/` neu can.

---

## 10. De xuat uu tien

1. MVP gan: Bill Preview tu snapshot chung tu, in browser, khong can DB mau bill phuc tap.
2. Sau do: cau hinh gui bill theo khach, sinh anh bill, mo Zalo/Facebook, nhan vien tu gui.
3. De sau: mau bill tuy bien, render backend, agent printer, API gui tin chinh thuc.
