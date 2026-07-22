with receipt_link_times as (
  select
    c.id,
    coalesce(pr.created_at, o.created_at) as target_created_at
  from cashbook_entries c
  left join payment_receipts pr
    on pr.organization_id = c.organization_id
   and (
     c.source->>'id' = pr.id
     or c.source->>'code' = pr.code
     or c.code = pr.code
     or c.code like pr.code || '-%'
   )
  left join orders o
    on o.organization_id = c.organization_id
   and (
     o.id = pr.order_id
     or o.code = c.source->>'order_code'
     or c.allocations @> jsonb_build_array(jsonb_build_object('order_id', o.id::text))
     or c.allocations @> jsonb_build_array(jsonb_build_object('order_code', o.code))
   )
  where c.source_type = 'payment_receipt_method'
)
update cashbook_entries c
set created_at = receipt_link_times.target_created_at
from receipt_link_times
where c.id = receipt_link_times.id
  and receipt_link_times.target_created_at is not null
  and c.created_at <> receipt_link_times.target_created_at;
