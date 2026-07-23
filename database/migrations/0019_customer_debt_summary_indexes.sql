-- Speeds legacy KiotViet counterparty-code resolution in customer debt totals.
create index if not exists customer_snapshots_org_code_lower_idx
  on customer_snapshots (organization_id, lower(code));

-- Limits debt payment source scans to posted financial rows.
create index if not exists cashbook_entries_org_debt_payment_idx
  on cashbook_entries (organization_id, created_at desc)
  where status = 'posted'
    and (source_type = 'payment_receipt_method' or source_type = 'kiotviet_cashbook');