# KiotViet Customer Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import danh sách khách hàng KiotViet vào QCVL để chuẩn bị nền khách hàng cho hóa đơn, công nợ và nhập/bán hàng.

**Architecture:** Import dùng `Mã khách hàng` làm khóa upsert, cho phép trùng `Tên khách hàng` giống KiotViet. Parser tách dữ liệu vận hành, dữ liệu tham chiếu KV và cột bỏ qua; API preview/import dùng cùng dialog import hiện có. Không mở nghiệp vụ giao hàng; `Khu vực giao hàng` và `Phường/Xã` chỉ dùng để bổ sung địa chỉ và lưu raw.

**Tech Stack:** React, TypeScript, Vite/Vitest, server TSX, PostgreSQL repository khi có.

---

## Current Review Gate 2026-07-12

Customer is the active page before moving to Supplier/Purchase because invoices, POS stock-out, customer debt, and `Khach le` all depend on stable customer records.

Already covered by docs/tests:

- Import uses `Ma khach hang` as the upsert key and allows duplicate customer names.
- Phone is optional and used for search/disambiguation, not as the import key.
- Customer type and company are kept for later invoice/customer identity needs.
- Delivery address workflow is out of scope; ward/area can only supplement profile address and raw source data.
- KV current debt/total sales are reference fields, not QCVL official receivables.
- Search uses shared compact search, accent-insensitive matching, no suggestion dropdown.
- Customer row click opens shared inline detail.
- Detail does not repeat group/price-list fields already shown in the row.
- Detail actions `Xoa`, `Chinh sua`, `Ngung hoat dong` are visible but disabled until API is wired.
- Creator display maps to QCVL account when possible; unmatched imported source creator shows `Chua khop tai khoan`.

Review before leaving Customers:

1. Open real imported customers on `3202` and confirm key fields: code, name, phone, customer type, company, tax code, address, note, creator, created date.
2. Confirm customer code `khachle` exists and remains the default customer for invoice/POS flows when no customer is selected.
3. Confirm search finds by code, name, and phone without accents, and the old suggestion/listbox does not appear.
4. Confirm detail tabs show only useful data: `Thong tin`, `No can thu`, `Lich su`.
5. Confirm `No can thu` and `Lich su` do not fabricate data when APIs have no records.
6. Confirm cleanup/import delete behavior is safe: imported KV customers can be deleted only when no real references block them; manually created customers must remain.

If those checks pass, Customers is stable enough to move to Suppliers. Do not add customer delivery, birthday, gender, Facebook, email, CCCD, bank account, points, or VAT/e-invoice flows in this stock-completion slice.

---

### Task 1: Docs And Import Contract

**Files:**
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/01-CUSTOMER-LIST.md`
- Modify: `docs/02-PRD-UX-PhongCanh/Customers/02-CUSTOMER-DETAIL.md`

- [x] **Step 1: Record source file shape**

File `DanhSachKhachHang_KV11072026-234256-524.xlsx` has 531 rows and these columns:

```text
Loại khách, Chi nhánh tạo, Mã khách hàng, Tên khách hàng, Điện thoại, Địa chỉ,
Khu vực giao hàng, Phường/Xã, Công ty, Mã số thuế, Số CMND/CCCD, Ngày sinh,
Giới tính, Email, Facebook, Nhóm khách hàng, Ghi chú, Người tạo, Ngày tạo,
Ngày giao dịch cuối, Nợ cần thu hiện tại, Tổng bán, Tổng bán trừ trả hàng, Trạng thái
```

- [x] **Step 2: Lock import mapping**

Import columns:

```text
Mã khách hàng -> code
Tên khách hàng -> name
Loại khách -> customer_type
Công ty -> company_name
Điện thoại -> phone
Mã số thuế -> tax_code
Địa chỉ -> address
Khu vực giao hàng -> area_name, also address supplement
Phường/Xã -> ward_name, also address supplement
Nhóm khách hàng -> customer_group_id by group name/code
Ghi chú -> note
Người tạo -> source_creator_name, map to QCVL created_by by username first after removing {DEL}; if the KV file stores a human name, map by unique QCVL display name/exact display-name token match.
Ngày tạo -> source_created_at / created_at
Ngày giao dịch cuối -> last_transaction_at
Trạng thái -> active/inactive
Nợ cần thu hiện tại -> kiotviet_current_debt
Tổng bán -> kiotviet_total_sales
Tổng bán trừ trả hàng -> kiotviet_net_sales
```

Ignored columns:

```text
Chi nhánh tạo, Số CMND/CCCD, Ngày sinh, Giới tính, Email, Facebook
```

- [x] **Step 3: Lock validation**

Rules:

```text
Mã khách hàng bắt buộc và unique theo organization.
Tên khách hàng bắt buộc nhưng được trùng.
SĐT không bắt buộc. Nếu có, dùng để tìm; không chặn import vì dữ liệu KV có thể cần giữ nguyên.
Không tạo nghiệp vụ địa chỉ giao hàng.
Không lấy Nợ cần thu/Tổng bán KV làm công nợ chính.
```

### Task 2: Parser

**Files:**
- Create: `server/modules/catalog/customer-import.ts`
- Create: `server/modules/catalog/customer-import.test.ts`

- [x] **Step 1: Write failing parser tests**
- [x] **Step 2: Run parser tests and confirm RED**
- [x] **Step 3: Implement parser mapping and preview/apply helpers**
- [x] **Step 4: Run parser tests and confirm GREEN**

### Task 3: API And Repository

**Files:**
- Modify: `server/http.ts`
- Modify: `server/modules/catalog/catalog-routes.ts`
- Modify: `server/http.test.ts`
- Modify: `server/db.ts` if persistence support is needed for NAS

- [x] **Step 1: Add failing route tests for preview/import**
- [x] **Step 2: Run route tests and confirm RED**
- [x] **Step 3: Add preview/import routes**
- [x] **Step 4: Run route tests and confirm GREEN**

### Task 4: Frontend Import UI

**Files:**
- Create: `src/features/catalog/CustomerImportDialog.tsx`
- Create: `src/features/catalog/CustomerImportDialog.test.tsx`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `src/features/catalog/types.ts`
- Modify: `src/features/catalog/CustomersPage.tsx`
- Modify: `src/features/catalog/CustomersPage.test.tsx`

- [x] **Step 1: Add failing dialog/service/page tests**
- [x] **Step 2: Run frontend tests and confirm RED**
- [x] **Step 3: Add import button/dialog/service types**
- [x] **Step 4: Run frontend tests and confirm GREEN**

### Task 5: Delete Old Import Data

**Files:**
- Modify: `src/features/catalog/CustomerImportDialog.tsx`
- Modify: `src/features/catalog/catalog-service.ts`
- Modify: `server/modules/catalog/catalog-routes.ts`
- Modify: `server/http.ts`
- Modify: `src/features/catalog/CustomerImportDialog.test.tsx`
- Modify: `src/features/catalog/catalog-service.test.ts`
- Modify: `server/http.test.ts`

- [x] **Step 1: Bring over shared delete action**

Customer import must use the same KiotViet import cleanup pattern already used by Product import and Stocktake import: a separate `Xóa dữ liệu cũ` action inside the import dialog. Do not hide cleanup inside `Import` and do not use an import checkbox.

- [x] **Step 2: Add customer delete endpoint**

Add `DELETE /api/v1/customers/import/kiotviet`.

Response:

```json
{
  "deleted_rows": 531,
  "blocked_rows": 0
}
```

- [x] **Step 3: Lock delete rule**

Delete only customer data created by the KiotViet customer import for the current page/module. Do not delete manually created customers. If a future repository detects sales/debt references, it must return `blocked_rows` instead of deleting those customers.

Current demo fallback deletes imported rows with generated id prefix `customer-kv-*` and local sample rows with code prefix `DEV20-KH-*`. It keeps `khachle` and manually created customers; imported updates to an already existing customer are not rolled back because there is no old snapshot.

- [x] **Step 4: Test and document**

Focused tests cover service endpoint, dialog action, and API route. Docs now record the delete action so the customer page does not miss behavior already present in Product/Stocktake import.

### Task 6: Verification

**Files:**
- No new files.

- [x] **Step 1: Run focused tests**

```powershell
npx vitest run server/modules/catalog/customer-import.test.ts server/http.test.ts src/features/catalog/CustomerImportDialog.test.tsx src/features/catalog/CustomersPage.test.tsx src/features/catalog/catalog-service.test.ts
```

- [x] **Step 2: Run typecheck**

```powershell
npm run typecheck
```

- [x] **Step 3: Browser QA**

Open:

```text
http://127.0.0.1:3202/customers
```

Verify:

```text
Import KV opens dialog.
Preview shows total, valid, create, update, group, current debt, total sales, ignored columns.
Import reloads customer list.
Search can find imported customer by code, name, phone without accents.
No dropdown suggestion appears.
```

---

## Self-Review

**Spec coverage:** Plan covers duplicate names, customer type, company, address supplement without delivery workflow, KV reference totals, ignored fields, parser, API, UI and docs.

**Placeholder scan:** No TODO/TBD. Deferred behavior is explicit and non-writing.

**Type consistency:** Planned fields use stable names across parser, API, type and UI.
