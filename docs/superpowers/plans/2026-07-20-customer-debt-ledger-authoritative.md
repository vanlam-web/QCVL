# Customer Debt Ledger Authoritative Plan

Date: 2026-07-20

## Goal

Make customer debt explainable from one visible ledger source. Customer list, customer detail, POS customer debt, and checkout debt badge must agree.

## Root Issue

The backend canonical total mixes invoice debt, KiotViet anchor balances, QCVL payments, KiotViet cashbook rows, and linked supplier offsets. The UI ledger does not always include all those contributors, then pins the newest visible row to the backend total. This can make debt appear to decrease without a visible transaction.

## Scope

- `server/modules/finance/customer-debt.ts`
- `server/db.ts`
- `src/features/catalog/customer-debt-ledger.ts`
- Customer debt views in `/customers`
- POS debt views in `/pos`
- Focused tests for customer debt, POS debt, and finance persistence

## Fix Design

1. Keep one backend debt formula for totals.
2. Expose every contributor used by that formula as a visible ledger row.
3. Treat KiotViet anchor as the opening ledger row only.
4. Treat KiotViet cashbook debt rows as visible payment/adjustment ledger rows.
5. Treat linked supplier receipts as visible offset rows.
6. Prevent double counting where the latest anchor source is also counted as linked supplier offset.
7. Remove frontend pinning of newest running balance to backend total.
8. If backend total and visible ledger running balance diverge, tests must fail.

## Steps

1. Add regression tests for hidden debt deltas and newest-row pinning.
2. Extend customer debt API data so visible ledger can include all formula contributors.
3. Update frontend ledger builder to use real rows only.
4. Verify customer list, customer detail, POS customer panel, and checkout debt badge all use same total.
5. Run focused backend/frontend tests.
6. Record result in TeamAI.
7. Commit and push only after verification passes.

## Verification

```powershell
npm exec vitest run server/db.test.ts server/http.test.ts
npm exec vitest run src/features/catalog/customer-debt-ledger.test.ts src/features/catalog/CustomersPage.test.tsx src/features/pos/CustomerPanel.test.tsx src/features/pos/CheckoutPanel.test.tsx
npm run typecheck
npm run build
```

## NAS

Do not deploy NAS until Owner explicitly says deploy/chốt deploy.
