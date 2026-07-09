# QCVL Database Migrations

- Moi thay doi schema tao file moi theo mau `0003_name.sql`.
- Khong sua migration da chay tren NAS.
- DB cu da co bang tu `schema.sql` phai baseline bang `QCVL_MIGRATION_BASELINE=true`.
- Luon chay `npm run db:migrate:dry-run` truoc `npm run db:migrate`.
- Khong drop table/cot tren NAS neu chua co backup va lenh owner ro rang.
