# BACKUP-RESTORE

> Pham vi: backup/restore cho QCVL PostgreSQL va file van hanh.

## Du Lieu Can Backup

| Nhom | Bat buoc |
|---|---|
| NAS PostgreSQL database | Co |
| File/storage bill hoac attachment neu sau nay co | Co |
| Environment/secrets | Khong backup vao repo; luu trong secret manager/quy trinh rieng |
| Logs van hanh | Luu theo retention phu hop, khong thay the database backup |

## RPO/RTO Baseline

| Chi so | Baseline |
|---|---|
| RPO | Toi da mat du lieu 24 gio |
| RTO | Khoi phuc service trong 4 gio lam viec |

Khi he thong dung hang ngay, xem lai theo doanh thu/ngay, so hoa don/ngay, va kha nang snapshot/backup cua NAS PostgreSQL.

## Backup Schedule

- Backup database tu dong hang ngay.
- Giu backup toi thieu 14 ngay.
- Truoc migration lon: tao backup/snapshot thu cong neu ha tang ho tro.
- Theo doi backup fail va canh bao.

## Restore Drill

Toi thieu moi thang hoac truoc production milestone lon:

1. Chon mot backup gan nhat.
2. Restore vao moi truong rieng, khong de production.
3. Chay migration/cau hinh can thiet neu co.
4. Kiem tra dang nhap test.
5. Kiem tra khach hang, san pham, hoa don, payment receipts, cashbook, stock movements.
6. Ghi lai thoi gian restore, loi gap phai va ket qua.

## Khong Duoc Lam

- Khong restore de production chi de thu.
- Khong dung backup production cho dev ca nhan neu chua an danh du lieu nhay cam.
- Khong commit dump database, file backup, `.env`, token, hoac credential vao repo.
- Khong xoa backup cu truoc khi backup moi duoc xac nhan.

## Tham Chieu

- [QCVL-NAS-DEV.md](./QCVL-NAS-DEV.md)
- [PRODUCTION.md](./PRODUCTION.md)
- [DEPLOYMENT_CONVENTIONS.md](./DEPLOYMENT_CONVENTIONS.md)
