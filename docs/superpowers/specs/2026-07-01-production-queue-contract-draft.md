# Production Queue Contract Draft

> Ngay lap: 2026-07-01
> Trang thai: Draft dieu phoi, chua phai Source of Truth Database/Backend/Integration
> Nguon: PRD K02-D, Legacy QuanLyXuong, quyet dinh Owner ve may san xuat va ton kho.

---

## 1. Muc tieu

Production queue la cau noi giua may san xuat va POS:

```text
May san xuat gui thong bao/file
  -> QC-OMS production queue
  -> K02-D hien thi cho thu ngan
  -> Thu ngan bam [+] de tao/bo sung hoa don nhap
```

Ranh gioi da chot:

- Production queue duoc tao hoa don nhap trong POS.
- Hoa don nhap chua tru kho, chua ghi tien, chua tao doanh thu/cong no.
- Ton kho chi tru khi nhan vien chot/lưu hoa don chinh thuc.
- Du lieu may san xuat con dung de doi soat OMS/bill voi thuc te may chay.
- Production queue khong tu tao stock movement trong MVP.

---

## 2. Thuat ngu

| Thuat ngu | Y nghia |
|---|---|
| May san xuat | May in bat, in decal, CNC hoac may/agent tao event san xuat |
| May POS | May thu ngan/nhan vien dang thao tac POS |
| Queue item | Mot thong bao/file dang cho trong K02-D |
| Claim | Viec mot POS bam `[+]`, `[🗑]` hoac `[↩]` va gianh quyen xu ly queue item |
| Add to draft | Dua queue item vao hoa don nhap POS |
| Dismiss | Bo thong bao khoi hang doi, khong anh huong kho/tien/san xuat |
| Restore | Dua thong bao da dismiss ve lai hang doi |

Khong dung "may tram" de chi may san xuat. "May tram" chi nen dung cho POS/workstation dang nhap cua nhan vien.

---

## 3. Scope MVP de xuat

### Trong scope

- Nhan event/file tu may san xuat qua production agent moi.
- Hien thi queue theo block may: In Bat, In Decal, CNC.
- Realtime cap nhat badge va danh sach queue tren tat ca may POS.
- `[+]` parse queue item va tao/bo sung hoa don nhap.
- `[🗑]` dismiss queue item.
- `[↩]` restore queue item da dismiss trong lich su 10 ngay.
- Atomic claim de tranh hai POS cung xu ly mot queue item.
- Luu lich su xu ly: queued, added, dismissed, restored.

### Ngoai scope MVP

- Tu dong chot hoa don tu may san xuat.
- Tu dong tru kho tu event may san xuat.
- Tu dong match file phuc tap voi bill da chot.
- Tu dong gui bill/Zalo khi job DONE.
- Production Work Orders rieng.
- Dashboard san xuat day du thay QuanLyXuong cu.

### De xuat pilot

Owner chot pilot uu tien lam **production agent moi**, khong mac dinh dua vao bridge cu.

De giam thao tac va tranh ep nhan vien match file voi bill qua som, pilot di theo huong:

```text
Thu muc/file/log may san xuat
  -> production agent moi doc du lieu
  -> POST event vao QC-OMS
  -> production queue hien tren POS
  -> nhan vien bam [+] neu muon dua vao nhap
```

Ly do:

- file co the dat ten bat ky va mot file co the co nhieu chi tiet
- tao bill chua chac da san xuat
- may san xuat chay khac bill van can doi soat, khong nen tu sua kho
- agent cho phep doi parser ve sau ma khong doi POS

Bridge tu QuanLyXuong cu chi la phuong an tham khao neu sau nay can lay lai du lieu cu, khong phai huong pilot mac dinh.

---

## 4. Queue item data shape de xuat

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "production_machine_code": "IN_BAT",
  "source": "production_agent | manual_simulator | legacy_bridge",
  "raw_file_name": "TTP_2D_120x50_x5",
  "received_at": "2026-07-01T10:30:00+07:00",
  "status": "queued",
  "parsed": {
    "customer_code": "TTP",
    "product_code": "2D",
    "width_cm": 120,
    "height_cm": 50,
    "quantity": 5
  },
  "parse_status": "ok",
  "parse_error": null
}
```

Trang thai queue item:

| Status | Y nghia |
|---|---|
| `queued` | Dang cho xu ly trong K02-D |
| `added_to_draft` | Da duoc dua vao hoa don nhap |
| `dismissed` | Da bo khoi hang doi |
| `restored` | Da khoi phuc ve hang doi, sau do se quay lai `queued` hoac ghi history rieng |

Draft nay chua chot ten bang/cot. Khi chuyen thanh SoT, uu tien tien to `production_*`.

---

## 5. Filename parser

PRD K02-D hien dang dung format:

```text
KH_[HH_]daixrong(_xSL)?(_ghichu)?
```

Vi du:

```text
TTP_2D_120x50_x5
TTP_2D_120x50_x5_in-gap
TTP_120x50_x5
ABC_120x80
```

Quy tac de giu:

- `KH` la ma khach hang.
- `HH` neu co la ma hang hoa.
- `daixrong` bat buoc neu muon add vao draft.
- Don vi filename theo cm, khi vao POS quy doi m.
- `_xSL` la so luong neu dung format `_x` + so nguyen.
- `ghichu` chi phuc vu may san xuat, khong tu dua vao ghi chu dong bill.
- File sai kich thuoc van hien trong queue, cho nhan vien sua kich thuoc dung de add vao draft.
- Khong sua nguoc `raw_file_name`.

Can dac ta sau:

- Co bat buoc filename theo format nay ngay tu pilot khong.
- Khach/hang khong hop le thi bo qua am tham hay hien queue loi cho quan ly.
- Parser chay khi event vao queue hay chi khi nhan vien bam `[+]`.

Khuyen nghi hien tai: parser nen chay khi event vao queue de hien loi som, nhung chi tao line POS khi nhan vien bam `[+]`.

---

## 6. API draft

Base path de xuat:

```text
/api/v1/production-queue
```

Endpoints:

| Method | Path | Muc dich |
|---|---|---|
| `GET` | `/production-queue` | Lay queue theo may/trang thai |
| `GET` | `/production-queue/history` | Lay lich su 10 ngay theo may |
| `POST` | `/production-queue/events` | Nhan event tu may san xuat/bridge |
| `POST` | `/production-queue/{id}/add-to-draft` | Claim item va tra payload de POS them vao draft |
| `POST` | `/production-queue/{id}/dismiss` | Claim item va dismiss |
| `POST` | `/production-queue/{id}/restore` | Khoi phuc item da dismiss |

Permission de xuat:

- Xem queue/add/dismiss/restore: `perm.create_order`.
- Nhan event tu may san xuat: service credential hoac integration token, khong dung user POS.
- Xem/sua cau hinh may san xuat: `perm.manage_inventory` hoac permission rieng sau.

---

## 7. Atomic claim

Khi hai may POS cung bam mot item:

1. Backend cap nhat item voi dieu kien `status = queued`.
2. May nao update thanh cong truoc nhan ket qua thanh cong.
3. May con lai nhan loi nghiep vu:

```json
{
  "code": "QUEUE_ITEM_ALREADY_HANDLED",
  "message": "Thông báo đã được xử lý bởi máy khác"
}
```

Khong duoc tao trung line hoa don nhap tu cung mot queue item.

---

## 8. Realtime draft

Channel du kien:

```text
production_queue
```

Event toi POS:

```json
{
  "event_type": "queued | added_to_draft | dismissed | restored",
  "queue_item_id": "uuid",
  "production_machine_code": "IN_BAT",
  "status": "queued",
  "timestamp": "2026-07-01T10:30:00+07:00"
}
```

POS khi nhan event:

- cap nhat badge cua block may
- cap nhat danh sach neu dang mo
- neu item da duoc POS khac xu ly, dong item bien mat hoac chuyen lich su

---

## 9. Add to draft output

`POST /production-queue/{id}/add-to-draft` khong tu tao order server trong Phase 2 neu POS draft van local.

Response nen tra payload normalized de frontend add vao draft hien tai:

```json
{
  "queue_item_id": "uuid",
  "customer": {
    "id": "uuid",
    "code": "TTP",
    "name": "Ten khach"
  },
  "draft_line": {
    "product_id": "uuid",
    "sell_method": "area_m2",
    "width_m": 1.2,
    "height_m": 0.5,
    "quantity": 5,
    "source": "production_queue"
  }
}
```

Frontend quyet dinh them vao nhap nao theo PRD K02-D:

- khach co mot nhap: them vao nhap do
- khach chua co nhap: tao nhap local moi
- khach co nhieu nhap: cho thu ngan chon

Can dac ta sau khi backend lam that:

- Neu frontend add line that bai sau khi backend da claim item thi rollback item ve `queued` hay cho restore thu cong.
- Co can endpoint `release-claim` khong.

Khuyen nghi MVP: chi claim sau khi backend validate va response thanh cong; neu frontend fail local hiem gap, cho nhan vien restore tu lich su.

---

## 10. Relation voi ton kho va doi soat

Production queue khong ghi `stock_movements`.

Khi nhap duoc chot thanh hoa don:

```text
POS invoice -> order_items -> stock_movements
```

Doi soat sau nay co the so sanh:

```text
production_queue/raw events
vs
orders/order_items/invoices
```

Neu may san xuat chay khac voi hoa don, phan lech chi vao bao cao doi soat/hao hut tham khao trong MVP.

---

## 11. Thu tu chuyen thanh SoT

1. Business: tao file Production Queue rule neu phase nay bat dau.
2. Database: tao `production_machines`, `production_queue_items`, `production_queue_history` neu can.
3. Backend: tao `PRODUCTION-QUEUE-API.md`.
4. Integration: tao contract cho production agent moi gui event.
5. PRD K02-D cap nhat link sang Business/API khi co SoT.

---

## 12. Cau hoi con lai

Khong can hoi Owner ngay neu chua implement phase nay. De xuat mac dinh neu can code pilot:

1. Pilot dung production agent moi gui API; legacy bridge chi la fallback/tham khao.
2. Parser filename khong bat buoc tuyet doi; file tu do van vao queue, item khong parse du thi cho sua tay khi add vao draft.
3. Queue item loi khach/hang hien cho thu ngan voi trang thai can sua, khong bo qua am tham.
4. Lich su 10 ngay luu DB that de co restore/audit.
5. Khi add-to-draft thanh cong nhung frontend local fail, restore thu cong tu lich su la du cho MVP.
