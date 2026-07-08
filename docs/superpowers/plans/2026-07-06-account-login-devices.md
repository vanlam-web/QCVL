# Account Login Devices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real signed-in devices on `/account` using data recorded by the backend.

**Architecture:** `GET /api/v1/me` records the current request as an account device and returns recent devices with the current device marked. The first phase is observe-only: UI shows device, browser/OS, IP and last activity; session revoke is documented for later.

**Tech Stack:** Supabase Postgres migration, Deno Edge Function API, React/Vitest UI.

---

### Task 1: Backend Device Contract And Tests

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/get-current-user.ts`
- Test: `supabase/tests/functions/me_test.ts`

- [ ] Add `CurrentUserDeviceData` with `id`, `device_name`, `device_type`, `browser_name`, `os_name`, `ip_address`, `last_seen_at`, `created_at`, `is_current_device`, `status`.
- [ ] Extend `CurrentUserData` and `CurrentUserRecord` with `devices`.
- [ ] Extend repository with `recordCurrentUserDevice(input)`.
- [ ] Write failing `GET /api/v1/me` test that sends `user-agent` and `x-forwarded-for`, expects `recordCurrentUserDevice` called and `devices` returned.

### Task 2: Database And Repository

**Files:**
- Create: `supabase/migrations/202607060002_account_devices.sql`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Test: `supabase/tests/database/001_foundation_schema.test.sql`

- [ ] Add `public.account_devices` table with user FK, device metadata, `device_key`, timestamps and status.
- [ ] Upsert current device by `(user_id, device_key)`.
- [ ] List latest active devices for current user.

### Task 3: Account UI

**Files:**
- Modify: `src/lib/api/types.ts`
- Modify: `src/features/account/AccountPage.tsx`
- Test: `src/features/account/AccountPage.test.tsx`
- Modify: `docs/02-PRD-UX-PhongCanh/System/00-UI-SHELL-V1.md`

- [ ] Render device rows from `currentUser.devices`.
- [ ] Mark current device with `Đang dùng`.
- [ ] Keep empty fallback if devices list is empty.
- [ ] Document phase 1 observe-only behavior.

### Verification

- [ ] `deno test --allow-env --allow-net supabase/tests/functions/me_test.ts`
- [ ] `npm run test:db`
- [ ] `npx vitest run src/features/account/AccountPage.test.tsx --exclude '.worktrees/**'`
- [ ] `npm run build`
