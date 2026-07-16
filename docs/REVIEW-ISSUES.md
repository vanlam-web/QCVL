# REVIEW-ISSUES â€” Review Thread Issue Tracker

> **Vai trÃ²:** Tracker issue cho Review Thread.
> **Cáº­p nháº­t:** 2026-07-08.

File nÃ y chá»‰ giá»¯ issue review cÃ²n má»Ÿ hoáº·c cáº§n theo dÃµi. Chi tiáº¿t dÃ i cá»§a issue Ä‘Ã£ Ä‘Ã³ng náº±m trong git history.

---

## CÃ¡ch DÃ¹ng

Review ghi issue á»Ÿ Ä‘Ã¢y khi phÃ¡t hiá»‡n viá»‡c cáº§n Spec / Implement / Owner xá»­ lÃ½.

Má»—i issue cáº§n cÃ³:

- báº±ng chá»©ng
- ngÆ°á»i/luá»“ng phá»¥ trÃ¡ch
- viá»‡c cáº§n lÃ m
- lá»‡nh re-check
- tÃ¬nh tráº¡ng hiá»‡n táº¡i

Issue khÃ´ng thay tháº¿ PR comments, implementation plan, hoáº·c Source of Truth docs.

---

## GiÃ¡ Trá»‹ TÃ¬nh Tráº¡ng

| TÃ¬nh tráº¡ng | Ã nghÄ©a |
|---|---|
| `Open` | Review Ä‘Ã£ xÃ¡c nháº­n issue vÃ  cáº§n follow-up |
| `Waiting for Spec` | Cáº§n Spec chá»‘t hÃ nh vi hoáº·c Source of Truth |
| `Waiting for Implement` | Cáº§n Implement sá»­a/Ä‘iá»u tra |
| `Waiting for Owner` | Cáº§n Owner quyáº¿t nghiá»‡p vá»¥ |
| `Ready for Re-check` | Luá»“ng phá»¥ trÃ¡ch bÃ¡o Ä‘Ã£ xá»­ lÃ½, Review cáº§n kiá»ƒm láº¡i |
| `Closed` | Review Ä‘Ã£ kiá»ƒm láº¡i hoáº·c cháº¥p nháº­n quyáº¿t Ä‘á»‹nh Ä‘Ã³ng |

---

## Issue Äang Má»Ÿ

### `REV-2026-07-08-001` â€” `/pos/cart/validate` documented and called by frontend but not routed in QCVL Node API API

- TÃ¬nh tráº¡ng: `Waiting for Implement`
- Báº±ng chá»©ng:
  - `src/features/orders/order-service.ts` gá»i `POST /api/v1/pos/cart/validate`.
  - `docs/05-BACKEND-MayChu/POS/ORDER-API.md` Ä‘á»‹nh nghÄ©a `POST /pos/cart/validate`.
  - `server/http.ts` handles API routing; re-check current route map before changing `/pos/cart/validate`.
  - `server/http.ts` currently has no confirmed legacy route file for `/pos/cart/validate`.
- Viá»‡c cáº§n lÃ m: Implement route/use-case tÆ°Æ¡ng á»©ng hoáº·c sá»­a frontend/spec náº¿u endpoint khÃ´ng cÃ²n dÃ¹ng; Æ°u tiÃªn giá»¯ Source of Truth backend docs vÃ  thÃªm route Ä‘á»ƒ trÃ¡nh 404 khi UI gá»i `validateCart`.
- Lá»‡nh re-check:
  - `rg -n "/api/v1/pos/cart/validate|/pos/cart/validate" src server docs/05-BACKEND-MayChu/POS/ORDER-API.md`  - `npm test`
- Luá»“ng phá»¥ trÃ¡ch: Implement

---

## Issue ÄÃ£ ÄÃ³ng Gáº§n ÄÃ¢y

| Issue | Káº¿t quáº£ |
|---|---|
| `REV-2026-07-07-007` â€” Browser smoke after lazy route split | Closed; in-app browser smoke for dashboard, sales documents, finance, POS, account, admin, products, price book, customers, suppliers, purchase receipts, inventory, and reports found no alerts or console errors |
| `REV-2026-07-07-003` â€” Generated `deno.lock` stays untracked and pollutes status | Closed; `.gitignore` now ignores root `deno.lock` |
| `REV-2026-07-07-004` â€” Prunable temp review worktree records pollute `git worktree list` | Closed; `git worktree prune` removed stale `/private/tmp/qc-oms-pr6x-review` records |
| `REV-2026-07-03-003` â€” Production bundle exceeds Vite warning threshold | Closed; route page components lazy-load from `src/app/router.tsx`, `npm run build` pass with main chunk `488.71 kB` and no Vite chunk warning |
| `REV-2026-07-07-001` â€” Root `npm test` scans ignored `.worktrees` and runs stale worktree tests | Closed; `vite.config.ts` excludes `**/.worktrees/**`, root `npm test` only runs current `src` suite |
| `REV-2026-07-07-002` â€” Account route hook dependency lint warning | Closed; `AccountRoute` depends on stable `currentUserId` instead of reading `currentUser` in effect |
| `REV-2026-07-05-002` â€” PR #72 docs diff-check fails on trailing whitespace | Closed; PR head `7230c04` removes trailing whitespace and `git diff --check origin/main...HEAD` passes |
| `REV-2026-07-05-001` â€” PR #68 material opening foundation schema drifts from Inventory SoT | Closed; PR head `8565cd9` aligns provisional balance columns/status/unique rule and material opening shape constraints with Inventory SoT; re-check commands pass |
| `REV-2026-07-03-001` â€” Catalog management unit tests fail | Closed; targeted tests pass |
| `REV-2026-07-03-002` â€” Playwright e2e blocked by invalid QCVL Node API API key | Closed; e2e pass |
| `REV-2026-07-03-004` â€” Workspace has many uncommitted changes | Closed; `main...origin/main` sáº¡ch ngÃ y 2026-07-05 |
| `REV-2026-07-03-005` â€” Governance docs old multi-AI wording | Closed; wording Ä‘Ã£ chuyá»ƒn Codex Spec / Implement / Review |
| `REV-2026-07-03-006` â€” Documentation indexes drift | Closed; index Ä‘Ã£ cáº­p nháº­t |
| `REV-2026-07-03-007` â€” Historical audit/draft status unclear | Closed; root audit logs cÅ© Ä‘Ã£ gá»¡ khá»i docs sá»‘ng |

---

## Closed - 2026-07-16 Project Health Hardening

- Lint debt da duoc xu ly de `npm run lint` pass.
- Finance cashbook delete co regression test cho manual voucher va blocked automatic/imported entries.
- POS product quick card accessible name da gom ma hang.
- Local gate da thong nhat qua `verify:local`.
- NAS bundle gate da thong nhat qua `verify:nas-build`.

## Format Report Back

Luá»“ng phá»¥ trÃ¡ch report tháº³ng vá» Review khi Ä‘Ã£ xá»­ lÃ½, bá»‹ cháº·n, hoáº·c quyáº¿t Ä‘á»‹nh defer:

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
