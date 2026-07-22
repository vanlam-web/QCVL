update cashbook_entries
set created_at = created_at + interval '7 hours'
where source_type = 'cashbook_voucher'
  and source->>'type' = 'manual_voucher'
  and code ~ '^(PCTM|PCNH)[0-9]{6}$';
