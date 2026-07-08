create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  supplier_id uuid not null,
  received_at timestamptz not null default now(),
  status text not null default 'draft',
  supplier_document_no text,
  subtotal_amount numeric(12,0) not null default 0,
  discount_amount numeric(12,0) not null default 0,
  payable_amount numeric(12,0) not null default 0,
  paid_amount numeric(12,0) not null default 0,
  remaining_amount numeric(12,0) not null default 0,
  notes text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  posted_by uuid references public.profiles(user_id) on delete restrict,
  cancelled_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  cancelled_at timestamptz,
  constraint purchase_receipts_org_code_key unique (organization_id, code),
  constraint purchase_receipts_id_org_key unique (id, organization_id),
  constraint purchase_receipts_supplier_org_fkey foreign key (supplier_id, organization_id)
    references public.suppliers(id, organization_id) on delete restrict,
  constraint purchase_receipts_code_check check (char_length(btrim(code)) between 1 and 50),
  constraint purchase_receipts_status_check check (status in ('draft', 'posted', 'cancelled')),
  constraint purchase_receipts_supplier_document_check check (
    supplier_document_no is null or char_length(btrim(supplier_document_no)) between 1 and 100
  ),
  constraint purchase_receipts_amount_check check (
    subtotal_amount >= 0
    and discount_amount >= 0
    and discount_amount <= subtotal_amount
    and payable_amount = subtotal_amount - discount_amount
    and paid_amount >= 0
    and remaining_amount = payable_amount - paid_amount
  ),
  constraint purchase_receipts_status_audit_check check (
    (status = 'draft' and posted_at is null and cancelled_at is null)
    or (status = 'posted' and posted_at is not null and posted_by is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
  )
);

create table public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  purchase_receipt_id uuid not null,
  product_id uuid not null,
  line_no integer not null,
  inventory_shape text not null default 'normal',
  unit_id uuid,
  unit_name_snapshot text not null,
  quantity numeric(18,6) not null,
  unit_cost numeric(12,0) not null,
  discount_amount numeric(12,0) not null default 0,
  line_amount numeric(12,0) not null,
  physical_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_receipt_items_receipt_line_key unique (purchase_receipt_id, line_no),
  constraint purchase_receipt_items_receipt_product_key unique (purchase_receipt_id, product_id),
  constraint purchase_receipt_items_receipt_org_fkey foreign key (purchase_receipt_id, organization_id)
    references public.purchase_receipts(id, organization_id) on delete cascade,
  constraint purchase_receipt_items_product_org_fkey foreign key (product_id, organization_id)
    references public.products(id, organization_id) on delete restrict,
  constraint purchase_receipt_items_inventory_shape_check check (inventory_shape in ('normal', 'roll', 'sheet')),
  constraint purchase_receipt_items_unit_name_check check (char_length(btrim(unit_name_snapshot)) between 1 and 30),
  constraint purchase_receipt_items_amount_check check (
    line_no > 0
    and quantity > 0
    and unit_cost >= 0
    and discount_amount >= 0
    and discount_amount <= round(quantity * unit_cost)
    and line_amount = round(quantity * unit_cost) - discount_amount
  ),
  constraint purchase_receipt_items_physical_payload_check check (
    physical_payload is null or jsonb_typeof(physical_payload) = 'object'
  )
);

create index idx_purchase_receipts_org_status_received
  on public.purchase_receipts (organization_id, status, received_at desc);
create index idx_purchase_receipts_org_code
  on public.purchase_receipts (organization_id, code);
create index idx_purchase_receipts_org_supplier
  on public.purchase_receipts (organization_id, supplier_id, received_at desc);
create index idx_purchase_receipts_org_supplier_document
  on public.purchase_receipts (organization_id, supplier_document_no)
  where supplier_document_no is not null;
create index idx_purchase_receipt_items_receipt
  on public.purchase_receipt_items (organization_id, purchase_receipt_id, line_no);
create index idx_purchase_receipt_items_product
  on public.purchase_receipt_items (organization_id, product_id);

create or replace function public.next_purchase_receipt_code(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(pr.code from 3)::integer), 0) + 1
    into next_number
  from public.purchase_receipts pr
  where pr.organization_id = p_organization_id
    and pr.code ~ '^PN[0-9]{6}$';

  return 'PN' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.save_purchase_receipt_draft_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_receipt_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_id_value uuid;
  code_value text;
  supplier_id_value uuid;
  received_at_value timestamptz;
  supplier_document_no_value text;
  notes_value text;
  receipt_discount_value numeric(12,0);
  paid_amount_value numeric(12,0);
  subtotal_amount_value numeric(12,0) := 0;
  payable_amount_value numeric(12,0);
  remaining_amount_value numeric(12,0);
  item_value jsonb;
  line_no_value integer := 0;
  product_id_value uuid;
  product_record record;
  unit_name_value text;
  quantity_value numeric(18,6);
  unit_cost_value numeric(12,0);
  line_discount_value numeric(12,0);
  line_amount_value numeric(12,0);
  seen_product_ids uuid[] := array[]::uuid[];
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception 'actor profile is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'purchase receipt items are required' using errcode = '22023';
  end if;

  supplier_id_value := nullif(p_payload->>'supplier_id', '')::uuid;
  if supplier_id_value is null or not exists (
    select 1
    from public.suppliers s
    where s.id = supplier_id_value
      and s.organization_id = p_organization_id
      and s.status = 'active'
  ) then
    raise exception 'supplier must be active' using errcode = '22023';
  end if;

  received_at_value := coalesce(nullif(p_payload->>'received_at', '')::timestamptz, now());
  supplier_document_no_value := nullif(btrim(coalesce(p_payload->>'supplier_document_no', '')), '');
  notes_value := nullif(btrim(coalesce(p_payload->>'notes', '')), '');
  receipt_discount_value := coalesce((p_payload->>'discount_amount')::numeric, 0);
  paid_amount_value := coalesce((p_payload->>'paid_amount')::numeric, 0);

  if receipt_discount_value < 0 or paid_amount_value < 0 then
    raise exception 'receipt amounts must be non-negative' using errcode = '22023';
  end if;

  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    unit_name_value := btrim(coalesce(item_value->>'unit_name', ''));
    quantity_value := coalesce((item_value->>'quantity')::numeric, 0);
    unit_cost_value := coalesce((item_value->>'unit_cost')::numeric, 0);
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_amount_value := round(quantity_value * unit_cost_value) - line_discount_value;

    if product_id_value = any(seen_product_ids) then
      raise exception 'duplicate product in purchase receipt' using errcode = '22023';
    end if;
    seen_product_ids := array_append(seen_product_ids, product_id_value);

    if unit_name_value = '' or char_length(unit_name_value) > 30 then
      raise exception 'unit name is invalid' using errcode = '22023';
    end if;
    if quantity_value <= 0 or unit_cost_value < 0 or line_discount_value < 0 or line_amount_value < 0 then
      raise exception 'item amounts are invalid' using errcode = '22023';
    end if;

    select p.*
      into product_record
    from public.products p
    where p.id = product_id_value
      and p.organization_id = p_organization_id
      and p.status = 'active';

    if product_record.id is null then
      raise exception 'product must be active' using errcode = '22023';
    end if;

    subtotal_amount_value := subtotal_amount_value + line_amount_value;
  end loop;

  if receipt_discount_value > subtotal_amount_value then
    raise exception 'receipt discount exceeds subtotal' using errcode = '22023';
  end if;

  payable_amount_value := subtotal_amount_value - receipt_discount_value;
  remaining_amount_value := payable_amount_value - paid_amount_value;
  code_value := nullif(btrim(coalesce(p_payload->>'code', '')), '');

  if p_receipt_id is null then
    receipt_id_value := gen_random_uuid();
    code_value := coalesce(code_value, public.next_purchase_receipt_code(p_organization_id));

    insert into public.purchase_receipts (
      id,
      organization_id,
      code,
      supplier_id,
      received_at,
      status,
      supplier_document_no,
      subtotal_amount,
      discount_amount,
      payable_amount,
      paid_amount,
      remaining_amount,
      notes,
      created_by
    ) values (
      receipt_id_value,
      p_organization_id,
      code_value,
      supplier_id_value,
      received_at_value,
      'draft',
      supplier_document_no_value,
      subtotal_amount_value,
      receipt_discount_value,
      payable_amount_value,
      paid_amount_value,
      remaining_amount_value,
      notes_value,
      p_actor_user_id
    );
  else
    receipt_id_value := p_receipt_id;

    if not exists (
      select 1
      from public.purchase_receipts pr
      where pr.id = receipt_id_value
        and pr.organization_id = p_organization_id
        and pr.status = 'draft'
    ) then
      raise exception 'purchase receipt draft not found' using errcode = '22023';
    end if;

    update public.purchase_receipts
    set
      code = coalesce(code_value, code),
      supplier_id = supplier_id_value,
      received_at = received_at_value,
      supplier_document_no = supplier_document_no_value,
      subtotal_amount = subtotal_amount_value,
      discount_amount = receipt_discount_value,
      payable_amount = payable_amount_value,
      paid_amount = paid_amount_value,
      remaining_amount = remaining_amount_value,
      notes = notes_value
    where id = receipt_id_value
      and organization_id = p_organization_id
      and status = 'draft';

    delete from public.purchase_receipt_items
    where purchase_receipt_id = receipt_id_value
      and organization_id = p_organization_id;
  end if;

  line_no_value := 0;
  for item_value in select value from jsonb_array_elements(p_payload->'items') loop
    line_no_value := line_no_value + 1;
    product_id_value := (item_value->>'product_id')::uuid;
    unit_name_value := btrim(coalesce(item_value->>'unit_name', ''));
    quantity_value := (item_value->>'quantity')::numeric;
    unit_cost_value := (item_value->>'unit_cost')::numeric;
    line_discount_value := coalesce((item_value->>'discount_amount')::numeric, 0);
    line_amount_value := round(quantity_value * unit_cost_value) - line_discount_value;

    insert into public.purchase_receipt_items (
      organization_id,
      purchase_receipt_id,
      product_id,
      line_no,
      inventory_shape,
      unit_name_snapshot,
      quantity,
      unit_cost,
      discount_amount,
      line_amount
    ) values (
      p_organization_id,
      receipt_id_value,
      product_id_value,
      line_no_value,
      'normal',
      unit_name_value,
      quantity_value,
      unit_cost_value,
      line_discount_value,
      line_amount_value
    );
  end loop;

  return receipt_id_value;
end;
$$;

create trigger set_purchase_receipts_updated_at
before update on public.purchase_receipts
for each row execute function public.set_updated_at();

create trigger set_purchase_receipt_items_updated_at
before update on public.purchase_receipt_items
for each row execute function public.set_updated_at();

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

grant select, insert, update, delete on
  public.purchase_receipts,
  public.purchase_receipt_items
to service_role;
grant execute on function public.next_purchase_receipt_code(uuid) to service_role;
grant execute on function public.save_purchase_receipt_draft_tx(uuid, uuid, uuid, jsonb) to service_role;
