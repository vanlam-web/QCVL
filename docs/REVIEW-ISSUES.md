# REVIEW-ISSUES — Review Thread Issue Tracker

> **Vai trò:** Tracker issue cho Review Thread.
> **Cập nhật:** 2026-07-08.

File này chỉ giữ issue review còn mở hoặc cần theo dõi. Chi tiết dài của issue đã đóng nằm trong git history.

---

## Cách Dùng

Review ghi issue ở đây khi phát hiện việc cần Spec / Implement / Owner xử lý.

Mỗi issue cần có:

- bằng chứng
- người/luồng phụ trách
- việc cần làm
- lệnh re-check
- tình trạng hiện tại

Issue không thay thế PR comments, implementation plan, hoặc Source of Truth docs.

---

## Giá Trị Tình Trạng

| Tình trạng | Ý nghĩa |
|---|---|
| `Open` | Review đã xác nhận issue và cần follow-up |
| `Waiting for Spec` | Cần Spec chốt hành vi hoặc Source of Truth |
| `Waiting for Implement` | Cần Implement sửa/điều tra |
| `Waiting for Owner` | Cần Owner quyết nghiệp vụ |
| `Ready for Re-check` | Luồng phụ trách báo đã xử lý, Review cần kiểm lại |
| `Closed` | Review đã kiểm lại hoặc chấp nhận quyết định đóng |

---

## Issue Đang Mở

### `REV-2026-07-08-001` — `/pos/cart/validate` documented and called by frontend but not routed in Supabase API

- Tình trạng: `Waiting for Implement`
- Bằng chứng:
  - `src/features/orders/order-service.ts` gọi `POST /api/v1/pos/cart/validate`.
  - `docs/05-BACKEND-MayChu/POS/ORDER-API.md` định nghĩa `POST /pos/cart/validate`.
  - `supabase/functions/api/routes/router.ts` chỉ dispatch `/api/v1/orders/checkout` và `/api/v1/orders/*` sang `handleOrders`; không dispatch `/api/v1/pos/cart/validate`.
  - `supabase/functions/api/routes/orders.ts` không có branch xử lý `/api/v1/pos/cart/validate`.
- Việc cần làm: Implement route/use-case tương ứng hoặc sửa frontend/spec nếu endpoint không còn dùng. Theo Source of Truth hiện tại, ưu tiên giữ endpoint như validate mềm trả `warnings`, không dùng để chặn checkout vì tồn âm hoặc thiếu object cuộn/tấm.
- Lệnh re-check:
  - `rg -n "/api/v1/pos/cart/validate|/pos/cart/validate" src supabase/functions docs/05-BACKEND-MayChu/POS/ORDER-API.md`
  - `npm run test:functions -- supabase/tests/functions/orders_test.ts`
  - `npm test`
- Luồng phụ trách: Implement

---

## Issue Đã Đóng Gần Đây

| Issue | Kết quả |
|---|---|
| `REV-2026-07-07-006` — Local DB tests blocked because Docker daemon is not running | Closed; Docker daemon started, `npx supabase start` succeeded, `npx supabase test db supabase/tests/database/001_foundation_schema.test.sql` passed 61 tests |
| `REV-2026-07-07-007` — Browser smoke after lazy route split | Closed; in-app browser smoke for dashboard, sales documents, finance, POS, account, admin, products, price book, customers, suppliers, purchase receipts, inventory, and reports found no alerts or console errors |
| `REV-2026-07-07-005` — Function test fixtures drift after `UserListItem` adds `username` and `phone` | Closed; catalog, inventory/finance, and orders fixtures now include `username`/`phone`; `npm run test:functions -- supabase/tests/functions/me_test.ts supabase/tests/functions/users_test.ts supabase/tests/functions/health_test.ts` pass with 106 tests |
| `REV-2026-07-07-003` — Generated `deno.lock` stays untracked and pollutes status | Closed; `.gitignore` now ignores root `deno.lock` |
| `REV-2026-07-07-004` — Prunable temp review worktree records pollute `git worktree list` | Closed; `git worktree prune` removed stale `/private/tmp/qc-oms-pr6x-review` records |
| `REV-2026-07-03-003` — Production bundle exceeds Vite warning threshold | Closed; route page components lazy-load from `src/app/router.tsx`, `npm run build` pass with main chunk `488.71 kB` and no Vite chunk warning |
| `REV-2026-07-07-001` — Root `npm test` scans ignored `.worktrees` and runs stale worktree tests | Closed; `vite.config.ts` excludes `**/.worktrees/**`, root `npm test` only runs current `src` suite |
| `REV-2026-07-07-002` — Account route hook dependency lint warning | Closed; `AccountRoute` depends on stable `currentUserId` instead of reading `currentUser` in effect |
| `REV-2026-07-05-002` — PR #72 docs diff-check fails on trailing whitespace | Closed; PR head `7230c04` removes trailing whitespace and `git diff --check origin/main...HEAD` passes |
| `REV-2026-07-05-001` — PR #68 material opening foundation schema drifts from Inventory SoT | Closed; PR head `8565cd9` aligns provisional balance columns/status/unique rule and material opening shape constraints with Inventory SoT; re-check commands pass |
| `REV-2026-07-03-001` — Catalog management unit tests fail | Closed; targeted tests pass |
| `REV-2026-07-03-002` — Playwright e2e blocked by invalid Supabase API key | Closed; e2e pass |
| `REV-2026-07-03-004` — Workspace has many uncommitted changes | Closed; `main...origin/main` sạch ngày 2026-07-05 |
| `REV-2026-07-03-005` — Governance docs old multi-AI wording | Closed; wording đã chuyển Codex Spec / Implement / Review |
| `REV-2026-07-03-006` — Documentation indexes drift | Closed; index đã cập nhật |
| `REV-2026-07-03-007` — Historical audit/draft status unclear | Closed; root audit logs cũ đã gỡ khỏi docs sống |

---

## Format Report Back

Luồng phụ trách report thẳng về Review khi đã xử lý, bị chặn, hoặc quyết định defer:

```text
[<Thread> -> Review]

Issue ID:
- ...

Files changed or reviewed:
- ...

Root cause:
- ...

Fix or decision:
- ...

Verification:
- ...

Remaining risk:
- ...

Current owner:
- Spec / Implement / Review / Owner

Next owner:
- Spec / Implement / Review / Owner

Next action:
- ...

Owner decision needed:
- Yes / No

Ready for Review re-check:
- Yes / No
```
