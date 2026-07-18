alter table orders add column if not exists base_code text;
alter table orders add column if not exists revision_no integer not null default 0;
alter table orders add column if not exists revised_from_order_id text references orders(id) on delete set null;
alter table orders add column if not exists replaced_by_order_id text references orders(id) on delete set null;
alter table orders add column if not exists cancel_reason_type text;
alter table orders add column if not exists revision_reason_code text;
alter table orders add column if not exists revision_reason_note text;

update orders
set base_code = coalesce(base_code, regexp_replace(code, '\.\d+$', ''));

create index if not exists orders_org_base_revision_idx
  on orders (organization_id, base_code, revision_no);
