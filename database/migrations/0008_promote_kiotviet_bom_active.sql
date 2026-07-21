-- Promote KiotViet-imported draft BOMs to active (SoT 2026-07-20: dùng ngay khi bán).
-- Owner đã import hết: KHÔNG cần re-import Excel. Chỉ chạy migration trên DB hiện có.

-- Keep only the newest KV draft per product; archive older drafts.
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, product_id
      order by version desc, created_at desc
    ) as rn
  from product_boms
  where status = 'draft'
    and notes like 'Imported from KiotViet%'
)
update product_boms pb
set status = 'archived'
from ranked r
where pb.id = r.id
  and r.rn > 1;

-- If the product already has a non-KV active BOM, leave that active and archive the KV draft.
update product_boms draft
set status = 'archived'
where draft.status = 'draft'
  and draft.notes like 'Imported from KiotViet%'
  and exists (
    select 1
    from product_boms active
    where active.organization_id = draft.organization_id
      and active.product_id = draft.product_id
      and active.status = 'active'
      and active.id <> draft.id
  );

-- Promote remaining KV drafts to active.
update product_boms
set
  status = 'active',
  notes = replace(notes, 'Review before activating.', 'Trusted for stock deduction.')
where status = 'draft'
  and notes like 'Imported from KiotViet%';
