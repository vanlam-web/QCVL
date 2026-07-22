# Customer bill template preference

Branch: `cursor/customer-bill-preference-0482`

## Goal

Remember A4/K80 per named customer when staff changes the template on bill print.

## Design

- Store `preferred_bill_template: 'a4'|'k80'|null` inside `customer_snapshots.data` JSON (no migration).
- Walk-in `code === 'khachle'` never stores preference; always uses org default (unless `?template=`).
- Resolve order: `?template=` → customer preference → org `default_bill_template`.
- Auto-save on print toolbar A4/K80 change (no checkbox in this slice).

## Out of scope (lúc đó)

Zalo/image send, full KV HTML editor, ESC/POS printer choice.

## Follow-up

Multi-bill tick theo khách: [2026-07-22-customer-multi-bill.md](./2026-07-22-customer-multi-bill.md).
