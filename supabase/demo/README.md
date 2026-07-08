# Purchase/Supplier Demo Seed

Local-only smoke data for validating Purchase/Supplier UI flows after `supabase db reset`.

Run against the local database:

```bash
psql "$DATABASE_URL" -f supabase/demo/purchase_demo.sql
```

The script is idempotent. It replaces only the demo supplier `NCCDEMO01` and its `HD-DEMO-*` purchase data, then creates:

- one active supplier with linked customer data,
- one draft purchase receipt,
- one posted normal purchase receipt with partial supplier payment,
- one posted roll/sheet receipt with physical inventory objects and object-linked stock movements,
- one `PCPN...` supplier payment and matching cashbook outflow.

Suggested UI smoke paths:

- `/suppliers`: search `NCCDEMO01`, inspect payable, open supplier payment path.
- `/purchase/receipts`: search `HD-DEMO`, inspect draft/post/payment history and roll/sheet physical summaries.
