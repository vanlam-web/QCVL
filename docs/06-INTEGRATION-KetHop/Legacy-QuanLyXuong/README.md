# Legacy QuanLyXuong - Ngu canh de QC-OMS hieu he cu

> Trang thai: tai lieu ngu canh di tru - 2026-06-28
> Pham vi: mo ta he QuanLyXuong cu nhu mot legacy external system. Khong phai kien truc muc tieu cua QC-OMS.

---

## 1. Muc dich

File nay giup QC-OMS va cac session AI sau hieu he thong QuanLyXuong hien tai dang lam gi, phan nao can hoc lai, va phan nao se bi thay the.

QuanLyXuong cu la nguon thuc te ve:

- Cach may In Bat, In Decal va CNC phat sinh event.
- Cach doc file/log may san xuat.
- Cach gom trang thai `EXPORT`, `RIP`, `PRINTING`, `CUTTING`, `DONE`, `DELETE`.
- Cach Dashboard cu hien thi tien do xuong.
- Cach Auto_CRM parse ten file, tao bill KiotViet va gui Zalo.

QuanLyXuong cu khong phai nen tang can giu lau dai.

---

## 2. So do he cu

```text
QuanLyXuong client
  -> server FastAPI
  -> SQLite theo may
  -> Dashboard cu
  -> Auto_CRM
  -> OpenClaw
  -> Zalo
```

Thanh phan thuc te:

| Thanh phan | Vai tro | Ghi chu |
|---|---|---|
| `QuanLyXuong.py` | Client tren may in/cat | Quet file, doc log, gui event ve server |
| `server.py` | Server trung tam port 8000 | Nhan event, ghi SQLite, broadcast dashboard |
| `Dashboard.py` | Dashboard web port 5000 | Hien thi tien do, thong ke, admin doi trang thai |
| `Auto_CRM.py` | Bot port 8001 | Doc job DONE, parse file, tao bill KiotViet, gui Zalo |
| OpenClaw | Cong gui Zalo | Dung `zalouser` de gui ca nhan/nhom |

---

## 3. Luong may san xuat cu

Moi may chay client rieng va tu nhan dien theo hostname:

```text
inbat   -> InBat
indecal -> InDecal
cnc     -> CNC
```

Client gui event ve:

```text
POST http://192.168.1.104:8000/api/log_event
```

Event chinh:

```text
EXPORT / RIP / PRINTING / CUTTING / DONE / DELETE
```

Server cu ghi vao SQLite:

```text
C:\QuanLyXuong\Data\InBat.db
C:\QuanLyXuong\Data\InDecal.db
C:\QuanLyXuong\Data\CNC.db
```

Trang thai chinh:

```text
EXPORTED -> RIP -> PRINTING/CUTTING -> DONE
                         |
                         v
                      DELETED
```

Khi job `DONE`, server goi Auto_CRM:

```text
GET http://127.0.0.1:8001/wake_up
```

---

## 4. Luong Auto_CRM cu

Auto_CRM xu ly chu yeu `InBat` va `InDecal`.

Luong hien tai:

1. Doc job `DONE` trong SQLite cua may.
2. Kiem tra da xu ly chua bang `crm_memory.json`.
3. Parse ten file de lay ma khach, chat lieu, kich thuoc, so luong.
4. Doi chieu `DanhBa_VIP.json` va `Map_ChatLieu.json`.
5. Neu thieu kich thuoc hoac chat lieu chua khai bao thi bao Zalo noi bo va bo qua.
6. Neu hop le thi mo Chrome/Selenium vao KiotViet.
7. Tao bill, chot thanh toan 0.
8. Chup anh bill.
9. Gui bill hoac tin nhan cho Zalo khach/nhom bang OpenClaw.
10. Cap nhat `zalo_sent = 1` trong SQLite.

Phan co gia tri de dua sang QC-OMS:

- Parser ten file.
- Mapping ma khach, chat lieu, hang hoa.
- Co che danh dau da xu ly de chong gui/trung lap.
- Y tuong gui bill sau khi job DONE.

Phan khong nen be nguyen:

- Selenium tao bill KiotViet.
- Retry vo han khong hien thi ro tren dashboard.
- Hardcode duong dan, IP, group Zalo, credential.
- SQLite la Source of Truth dai han.

---

## 5. Cach QC-OMS nen hieu he cu

QC-OMS can xem QuanLyXuong cu la legacy integration trong giai doan di tru:

```text
QuanLyXuong SQLite / event cu
  -> bridge tam thoi
  -> QC-OMS production_* tables
```

Muc tieu khong phai dong bo hai chieu lau dai. Muc tieu la dung bridge de:

- Doi chieu du lieu cu voi du lieu QC-OMS.
- Kiem chung parser va trang thai may.
- Xay man hinh san xuat trong QC-OMS ma chua cat he cu qua som.
- Chuyen tung may sang agent moi khi QC-OMS on dinh.

Sau khi agent moi chay tot:

```text
May san xuat -> QC-OMS API -> production_* tables
```

Luc do QuanLyXuong client/server/Dashboard/Auto_CRM cu duoc tat.

---

## 6. Huong thay the trong QC-OMS

Bang du lieu muc tieu nen nam trong cung PostgreSQL/Supabase cua QC-OMS, tach module:

```text
sales_*       = POS, don hang, hoa don, thanh toan, cong no
production_*  = may, event, job, queue, heartbeat
reconcile_*   = doi soat sales voi production, hao hut thuc
```

Endpoint muc tieu de thay `/api/log_event` cu:

```text
POST /api/v1/production-events
GET  /api/v1/production-queue
POST /api/v1/production-queue/{id}/add-to-draft
POST /api/v1/production-queue/{id}/dismiss
POST /api/v1/production-queue/{id}/restore
```

Man hinh muc tieu thay Dashboard cu:

```text
QC-OMS / San xuat / Trang thai may
```

Man hinh nay hien thi may dang chay, file dang chay, file DONE, file ket, so lan in lai, ping may va canh bao log.

---

## 7. Ranh gioi voi tai lieu khac

- Muc tieu cuoi cung cua san pham: [Target State QC-OMS](../../01-VISION-TamNhin/02-TARGET-STATE-QC-OMS.md)
- UI hang doi may POS: [K02-D Hang doi](../../02-PRD-UX-PhongCanh/POS/K02/04-K02D-HANG-DOI.md)
- Backend workflow noi bo se duoc mo ta o tang `05-BACKEND-MayChu`.
- Database schema thuc te se duoc mo ta o tang `04-DATABASE`.
