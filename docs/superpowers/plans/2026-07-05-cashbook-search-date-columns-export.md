# Cashbook Search Date Columns Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After PR #73, add the next safe KiotViet-parity read-only cashbook slice: search scope, date range, column chooser, and CSV export.

**Architecture:** Build on PR #73 cashbook list/detail UI and the existing `GET /finance/cashbook` route. This slice does not add new finance tables and does not create/edit/cancel cashbook vouchers. CSV export is client-side from the currently loaded rows, matching KiotViet's visible-list export MVP before server-side export is needed.

**Tech Stack:** React, TypeScript, Vitest, Supabase Edge Function tests with Deno, existing `FinancePage`, existing finance service, existing foundation repository.

---

## KV Audit Added On 2026-07-05

Observed on KiotViet `Sổ quỹ`:

- Main page has search `Theo mã phiếu`; advanced search also supports `Theo ghi chú` and `Theo nội dung chuyển khoản`.
- Main actions include `Xuất file` and a column chooser.
- Time filter has `Tháng này` and `Tùy chỉnh`.
- Default table columns are `Mã phiếu`, `Thời gian`, `Loại thu chi`, `Người nộp/nhận`, `Giá trị`.
- Column chooser includes `Thời gian tạo`, `Người tạo`, `Nhân viên`, `Chi nhánh`, `Tên tài khoản`, `Số tài khoản`, `Mã người nộp/nhận`, `Số điện thoại`, `Địa chỉ`, `Nội dung chuyển khoản`, `Ghi chú`, `Loại sổ quỹ`, `Trạng thái`.
- Row selection changes toolbar to `Đã chọn 1`; this plan does not implement row selection or bulk actions.

## Current Code Constraint

Current DB/API after PR #72 and before PR #73:

- `cashbook_entries` supports `entry_time`, `direction`, `source_type`, `status`, `is_business_accounted`, `description`.
- `cashbook_vouchers` supports `voucher_type`, `counterparty_type`, `counterparty_name`, `counterparty_phone`, but list query does not join/filter these yet.
- There is no `partner_debt_mode` or `counterparty_code` column.

Therefore:

- This plan implements search scope, date range, visible columns, and CSV export.
- `Loại thu chi`, `Người nộp/nhận`, and `Công nợ đối tác` advanced filters move to the next schema-backed slice.

## Out Of Scope

- Manual `POST /finance/cashbook-vouchers`.
- Revision/cancel of manual vouchers.
- Transfer/withdraw paired transaction.
- E-wallet.
- Partner-debt filter.
- Counterparty code/phone filtering.
- Server-side export of all matching rows.
- Print templates.

## File Map

- Modify `supabase/functions/api/contracts.ts`: add `searchScope` to repository list input.
- Modify `supabase/functions/api/use-cases/finance.ts`: parse `search_scope`.
- Modify `supabase/functions/api/repositories/foundation-repository.ts`: apply scoped search to hydrated rows.
- Modify `supabase/tests/functions/inventory_finance_test.ts`: route/use-case coverage for `search_scope` and date bypass for exact code search.
- Modify `src/features/finance/types.ts`: add search scope and column key types.
- Modify `src/features/finance/finance-service.ts`: serialize `search_scope`, expose `buildCashbookCsv`.
- Modify `src/features/finance/finance-service.test.ts`: query and CSV tests.
- Modify `src/features/finance/FinancePage.tsx`: date controls, search scope select, column chooser, export button.
- Modify `src/features/finance/FinancePage.test.tsx`: UI behavior tests.
- Modify `src/styles/index.css`: compact controls and column chooser styling.

## Task 1: Backend Search Scope

**Files:**
- Modify: `supabase/functions/api/contracts.ts`
- Modify: `supabase/functions/api/use-cases/finance.ts`
- Modify: `supabase/functions/api/repositories/foundation-repository.ts`
- Test: `supabase/tests/functions/inventory_finance_test.ts`

- [ ] **Step 1: Write failing function test**

Add this test near existing cashbook tests in `supabase/tests/functions/inventory_finance_test.ts`:

```ts
Deno.test("cashbook scoped code search ignores default date filters", async () => {
  const repository = createMockRepository();
  const response = await handleApiRequest(
    new Request(
      "http://local.test/api/v1/finance/cashbook?search=CTM001180&search_scope=code&from=2026-07-01T00%3A00%3A00.000Z&to=2026-07-31T23%3A59%3A59.999Z&page=1&page_size=15",
      { headers: authHeaders(["perm.manage_finance"]) },
    ),
    { repository },
  );

  assertEquals(response.status, 200);
  assertEquals(repository.calls.listCashbookEntries.at(-1), {
    organizationId: "org-1",
    search: "CTM001180",
    searchScope: "code",
    direction: undefined,
    sourceType: undefined,
    status: undefined,
    financeAccountId: undefined,
    isBusinessAccounted: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    pageSize: 15,
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts
```

Expected: FAIL because `searchScope` is not parsed/passed.

- [ ] **Step 3: Add contract field**

In `supabase/functions/api/contracts.ts`, extend `listCashbookEntries(input)`:

```ts
searchScope?: "code" | "note" | "transfer_content";
```

- [ ] **Step 4: Parse `search_scope`**

In `supabase/functions/api/use-cases/finance.ts`, inside `listCashbookEntries`, compute:

```ts
const search = url.searchParams.get("search")?.trim() || undefined;
const searchScope = parseOptionalEnum(url.searchParams.get("search_scope"), ["code", "note", "transfer_content"]);
const isExactVoucherSearch = searchScope === "code" && search !== undefined && /^[A-Z]{2,}[A-Z0-9]*\d{3,}(?:\.\d+)?$/i.test(search);
```

Pass:

```ts
search,
searchScope,
from: isExactVoucherSearch ? undefined : url.searchParams.get("from")?.trim() || undefined,
to: isExactVoucherSearch ? undefined : url.searchParams.get("to")?.trim() || undefined,
```

- [ ] **Step 5: Apply scoped hydrated-row search**

In `supabase/functions/api/repositories/foundation-repository.ts`, replace the current generic search block with:

```ts
if (input.search !== undefined) {
  const search = input.search.toLocaleLowerCase("vi");
  items = items.filter((item) => {
    const codeMatch = item.code.toLocaleLowerCase("vi").includes(search);
    const noteMatch = item.note?.toLocaleLowerCase("vi").includes(search) === true;
    if (input.searchScope === "code") return codeMatch;
    if (input.searchScope === "note") return noteMatch;
    if (input.searchScope === "transfer_content") return false;
    return codeMatch || noteMatch;
  });
}
```

`transfer_content` returns no extra matches until bank transfer content is stored on cashbook rows in a later schema slice.

- [ ] **Step 6: Run function tests to verify GREEN**

Run:

```bash
npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts
```

Expected: PASS.

## Task 2: Frontend Service And CSV Helper

**Files:**
- Modify: `src/features/finance/types.ts`
- Modify: `src/features/finance/finance-service.ts`
- Test: `src/features/finance/finance-service.test.ts`

- [ ] **Step 1: Write failing service test**

In `src/features/finance/finance-service.test.ts`, extend the cashbook list call with:

```ts
search_scope: "code",
```

Expected URL includes:

```text
search_scope=code
```

Add a CSV helper test:

```ts
it("builds a cashbook CSV from visible rows", () => {
  expect(buildCashbookCsv([
    {
      id: "entry-1",
      code: "CTM001180",
      status: "posted",
      direction: "out",
      amount_delta: -30000,
      finance_account: { id: "cash-1", code: "CASH", name: "Quỹ tiền mặt", account_type: "cash" },
      is_business_accounted: true,
      source_type: "cashbook_voucher",
      created_at: "2026-07-04T07:46:00.000Z",
      note: "Vận chuyển",
    },
  ])).toBe([
    "Mã phiếu,Thời gian,Loại thu chi,Người nộp/nhận,Giá trị,Quỹ/Tài khoản,Trạng thái,Ghi chú,Hạch toán KQKD",
    "CTM001180,2026-07-04T07:46:00.000Z,,,-30000,CASH,posted,Vận chuyển,true",
  ].join("\\n"));
});
```

- [ ] **Step 2: Run service test to verify RED**

Run:

```bash
npm test -- src/features/finance/finance-service.test.ts
```

Expected: FAIL because `search_scope` and `buildCashbookCsv` do not exist.

- [ ] **Step 3: Add frontend types**

In `src/features/finance/types.ts`, add:

```ts
export type CashbookSearchScope = "all" | "code" | "note" | "transfer_content";
export type CashbookColumnKey =
  | "code"
  | "created_at"
  | "source_type"
  | "counterparty"
  | "finance_account"
  | "amount_delta"
  | "status"
  | "note"
  | "is_business_accounted";
```

- [ ] **Step 4: Serialize `search_scope`**

In `src/features/finance/finance-service.ts`, add optional input:

```ts
search_scope?: CashbookSearchScope
```

Serialize:

```ts
if (input.search_scope && input.search_scope !== "all") params.set("search_scope", input.search_scope);
```

- [ ] **Step 5: Add CSV helper**

In `src/features/finance/finance-service.ts`, export:

```ts
export function buildCashbookCsv(items: CashbookEntry[]) {
  const rows = [
    ["Mã phiếu", "Thời gian", "Loại thu chi", "Người nộp/nhận", "Giá trị", "Quỹ/Tài khoản", "Trạng thái", "Ghi chú", "Hạch toán KQKD"],
    ...items.map((entry) => [
      entry.code,
      entry.created_at,
      "",
      "",
      String(entry.amount_delta),
      entry.finance_account.code,
      entry.status,
      entry.note ?? "",
      String(entry.is_business_accounted),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
```

- [ ] **Step 6: Run service test to verify GREEN**

Run:

```bash
npm test -- src/features/finance/finance-service.test.ts
```

Expected: PASS.

## Task 3: UI Search Scope, Date Range, Columns, Export

**Files:**
- Modify: `src/features/finance/FinancePage.tsx`
- Modify: `src/styles/index.css`
- Test: `src/features/finance/FinancePage.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests to `src/features/finance/FinancePage.test.tsx`:

```tsx
it("filters cashbook by search scope and date range", async () => {
  const service = makeService();
  render(<FinancePage service={service} />);

  await screen.findByRole("table", { name: "Sổ quỹ" });
  await userEvent.selectOptions(screen.getByLabelText("Tìm theo"), "code");
  await userEvent.type(screen.getByLabelText("Tìm sổ quỹ"), "CTM001180");
  await userEvent.type(screen.getByLabelText("Từ ngày"), "2026-07-01");
  await userEvent.type(screen.getByLabelText("Đến ngày"), "2026-07-31");
  await userEvent.click(screen.getByRole("button", { name: "Lọc sổ" }));

  expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
    search: "CTM001180",
    search_scope: "code",
    from: "2026-07-01",
    to: "2026-07-31",
  }));
});

it("toggles cashbook columns and exports visible rows", async () => {
  const service = makeService();
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cashbook");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<FinancePage service={service} />);

  await screen.findByRole("table", { name: "Sổ quỹ" });
  await userEvent.click(screen.getByRole("button", { name: "Cột" }));
  await userEvent.click(screen.getByLabelText("Ghi chú"));
  expect(screen.getByRole("columnheader", { name: "Ghi chú" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Xuất file" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã tạo file sổ quỹ");
  expect(createObjectURL).toHaveBeenCalled();
  expect(click).toHaveBeenCalled();

  createObjectURL.mockRestore();
  revokeObjectURL.mockRestore();
  click.mockRestore();
});
```

- [ ] **Step 2: Run UI tests to verify RED**

Run:

```bash
npm test -- src/features/finance/FinancePage.test.tsx
```

Expected: FAIL because controls and export action are missing.

- [ ] **Step 3: Add state**

In `FinancePage.tsx`, add:

```ts
const [cashbookSearchScope, setCashbookSearchScope] = useState<CashbookSearchScope>("all");
const [lastCashbookSearchScope, setLastCashbookSearchScope] = useState<CashbookSearchScope>("all");
const [cashbookFrom, setCashbookFrom] = useState("");
const [lastCashbookFrom, setLastCashbookFrom] = useState("");
const [cashbookTo, setCashbookTo] = useState("");
const [lastCashbookTo, setLastCashbookTo] = useState("");
const [showCashbookColumns, setShowCashbookColumns] = useState(false);
const [visibleCashbookColumns, setVisibleCashbookColumns] = useState<CashbookColumnKey[]>([
  "code",
  "created_at",
  "source_type",
  "counterparty",
  "finance_account",
  "amount_delta",
  "status",
]);
```

- [ ] **Step 4: Add filter controls**

Add controls with labels exactly:

```tsx
<label>
  Tìm theo
  <select value={cashbookSearchScope} onChange={(event) => setCashbookSearchScope(event.target.value as CashbookSearchScope)}>
    <option value="all">Tất cả</option>
    <option value="code">Mã phiếu</option>
    <option value="note">Ghi chú</option>
    <option value="transfer_content">Nội dung chuyển khoản</option>
  </select>
</label>
<label>
  Từ ngày
  <input type="date" value={cashbookFrom} onChange={(event) => setCashbookFrom(event.target.value)} />
</label>
<label>
  Đến ngày
  <input type="date" value={cashbookTo} onChange={(event) => setCashbookTo(event.target.value)} />
</label>
```

- [ ] **Step 5: Wire filters**

Extend `loadCashbook` input with:

```ts
search_scope?: CashbookSearchScope
from?: string
to?: string
```

Pass to service:

```ts
search_scope: nextSearchScope,
from: nextFrom.trim() || undefined,
to: nextTo.trim() || undefined,
```

Reset must clear `cashbookSearchScope`, `cashbookFrom`, and `cashbookTo`.

- [ ] **Step 6: Add column definitions and rendering**

Add:

```ts
const cashbookColumnDefinitions: Array<{ key: CashbookColumnKey; label: string }> = [
  { key: "code", label: "Mã phiếu" },
  { key: "created_at", label: "Thời gian" },
  { key: "source_type", label: "Loại sổ quỹ" },
  { key: "counterparty", label: "Người nộp/nhận" },
  { key: "finance_account", label: "Quỹ/tài khoản" },
  { key: "amount_delta", label: "Giá trị" },
  { key: "status", label: "Trạng thái" },
  { key: "note", label: "Ghi chú" },
  { key: "is_business_accounted", label: "Hạch toán KQKD" },
];
```

Render table headers and cells from `visibleCashbookColumns`. Use existing detail row `colSpan={visibleCashbookColumns.length}`.

- [ ] **Step 7: Add export action**

Import `buildCashbookCsv` and add a `Xuất file` button:

```tsx
function exportCashbook() {
  const csv = buildCashbookCsv(cashbookEntries ?? []);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "so-quy.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  setMessage("Đã tạo file sổ quỹ.");
}
```

- [ ] **Step 8: Run UI tests to verify GREEN**

Run:

```bash
npm test -- src/features/finance/FinancePage.test.tsx
```

Expected: PASS.

## Task 4: Full Verification And PR

**Files:**
- All files changed in Tasks 1-3.

- [ ] **Step 1: Run focused checks**

Run:

```bash
npm test -- src/features/finance/finance-service.test.ts src/features/finance/FinancePage.test.tsx
npm run test:functions -- supabase/tests/functions/inventory_finance_test.ts
```

Expected: both PASS.

- [ ] **Step 2: Run full checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
npm test
npm run build
```

Expected:

- typecheck PASS
- lint PASS
- diff-check PASS
- vitest PASS
- build PASS with only the existing Vite chunk-size warning

- [ ] **Step 3: Commit**

Run:

```bash
git add supabase/functions/api/contracts.ts supabase/functions/api/use-cases/finance.ts supabase/functions/api/repositories/foundation-repository.ts supabase/tests/functions/inventory_finance_test.ts src/features/finance/types.ts src/features/finance/finance-service.ts src/features/finance/finance-service.test.ts src/features/finance/FinancePage.tsx src/features/finance/FinancePage.test.tsx src/styles/index.css
git commit -m "feat: add cashbook search date columns export"
```

- [ ] **Step 4: Open PR**

Run:

```bash
git push -u origin codex/cashbook-search-date-columns-export
gh pr create --base main --head codex/cashbook-search-date-columns-export --title "feat: add cashbook search date columns export" --body-file /tmp/cashbook-search-date-columns-export-pr.md
```

PR body must include:

- KV observations used
- scope and out-of-scope
- RED/GREEN evidence
- remaining risks: manual vouchers, transfer pair, e-wallet, partner-debt filter, counterparty code/phone filter, server-side export, print

## Follow-Up Slice After This Plan

Do this only after a DB/API design PR adds the missing foundation:

- Add `partner_debt_mode` and counterparty code/source fields for manual vouchers and automatic receipt rows.
- Expand `cashbook_vouchers.voucher_type` to cover actual KV categories: supplier payment, staff salary, shipping expense, tax/VAT, commission, transfer.
- Join/hydrate voucher and receipt data into cashbook list rows.
- Add filters for `Loại thu chi`, `Người nộp/nhận`, `SĐT`, and `Công nợ đối tác`.
