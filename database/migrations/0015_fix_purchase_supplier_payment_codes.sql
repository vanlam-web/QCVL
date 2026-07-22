with candidates as (
  select
    cbe.id,
    cbe.organization_id,
    regexp_replace(cbe.code, '-post$', '') as target_code,
    prs.data->>'received_at' as receipt_time_text
  from cashbook_entries cbe
  left join purchase_receipt_snapshots prs
    on prs.organization_id = cbe.organization_id
    and (
      prs.code = cbe.source->>'order_code'
      or prs.code = cbe.allocations->0->>'order_code'
    )
  where cbe.source_type = 'purchase_supplier_payment'
    and cbe.code ~ '^PCPN[0-9]{6}(-post)$'
    and not exists (
      select 1
      from cashbook_entries existing
      where existing.organization_id = cbe.organization_id
        and existing.code = regexp_replace(cbe.code, '-post$', '')
        and existing.id <> cbe.id
    )
)
update cashbook_entries cbe
set
  code = candidates.target_code,
  created_at = coalesce(nullif(candidates.receipt_time_text, '')::timestamptz, cbe.created_at),
  source = jsonb_set(
    jsonb_set(cbe.source, '{id}', to_jsonb(candidates.target_code)),
    '{code}',
    to_jsonb(candidates.target_code)
  ),
  allocations = coalesce((
    select jsonb_agg(
      case
        when nullif(candidates.receipt_time_text, '') is null then allocation.value
        else jsonb_set(allocation.value, '{order_created_at}', to_jsonb(candidates.receipt_time_text))
      end
      order by allocation.ordinality
    )
    from jsonb_array_elements(cbe.allocations) with ordinality as allocation(value, ordinality)
  ), cbe.allocations)
from candidates
where cbe.id = candidates.id
  and cbe.organization_id = candidates.organization_id;
