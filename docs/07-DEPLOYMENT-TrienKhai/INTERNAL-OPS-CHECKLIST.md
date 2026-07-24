# Checklist vận hành nội bộ QCVL

Cập nhật: `2026-07-24`. Dùng cho vận hành NAS `3200`.

## Hằng ngày

- Mở `http://100.84.228.125:3200/api/v1/health` hoặc chạy `npm run health:nas`.
- Kiểm tra POS, hóa đơn mới, sổ quỹ và công nợ qua UI/read-only theo quyền vận hành.
- Khi có lỗi, lưu trace ID và log; không reset container, volume hoặc PostgreSQL để sửa nhanh.

## Trước release direct `3200`

- [ ] Scope checklist đã đóng; Git commit sạch, không chứa secret/dump/backup/artifact build.
- [ ] `npm run typecheck`, focused tests và `npm run preflight` pass.
- [ ] Migration đã review; dữ liệu destructive/migration phá vỡ tương thích có checkpoint Owner riêng.
- [ ] Kiểm tra NAS `.env`, SSH và `npm run deploy:nas:image:status`.
- [ ] Release bằng `npm run deploy:nas:image`; không dùng copy tay hoặc local `3202` làm rollout gate.

## Sau release direct `3200`

- [ ] `npm run deploy:nas:image:status` báo active image đúng commit release.
- [ ] `npm run health:nas` báo PostgreSQL persistence.
- [ ] Có `QCVL_SMOKE_PASSWORD`: chạy `npm run smoke:nas`.
- [ ] Mở route/page đã chạm; mutation hợp lệ phải đọc lại qua API/UI.
- [ ] Ghi Git SHA, image, health/smoke hoặc rollback evidence vào walkthrough/handoff.

## Hằng tuần

- Kiểm tra backup PostgreSQL NAS và dung lượng volume.
- Quét secret trong repository.
- Kiểm tra active image có commit/source trace rõ.

## Ranh giới lưu trữ

- NAS: image/runtime config cần thiết và PostgreSQL data.
- Git: source code, migration, script, docs, test; không commit password, token, database dump hoặc backup dữ liệu thật.
- Local: credential trong environment, log/debug riêng, export/backup chưa duyệt.
- Không đưa docs, plan, test artifact, screenshot hoặc clipboard lên NAS runtime.
