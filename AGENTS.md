# Hướng dẫn agent dự án QCVL

Xem [AI_TEAM_RULES.md](./AI_TEAM_RULES.md) và [WORKER-START-HERE.md](./docs/WORKER-START-HERE.md).

## Runtime

QCVL là hệ thống POS/ERP tiếng Việt: React + Vite ở `src/`, Node HTTP API ở `server/` (entry `server/index.ts`), PostgreSQL là runtime source of truth. Dùng Node 22 theo `.nvmrc`.

## Lưu ý

- Preflight cần TeamAI board trừ khi `CI=true`. Ví dụ: `CI=true npm test`.
- Test ngày giờ dùng `Asia/Ho_Chi_Minh`: `CI=true TZ=Asia/Ho_Chi_Minh npm test`.
- Local dev cần `npm run api:dev` cho API `3100` và `npm run dev` cho Vite. Không đặt `VITE_API_BASE_URL` khi local dev.
- Có `DATABASE_URL`, API dùng PostgreSQL; không có thì dùng dev-memory ở `logs/dev-memory-state.json`. Không copy file này lên NAS.
- Đăng nhập dev dùng field JSON `login`, không phải `username`.
- `scripts/seed-dev20-data.mjs` là script Supabase-era stale; không dùng để seed runtime hiện hành.
- E2E cần PostgreSQL có fixture; CI chỉ chạy `test:e2e:list`.
- Trước sửa bug local, kiểm tra process `3100`/`3202` đang dùng đúng repo.
