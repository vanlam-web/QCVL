create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_id uuid not null,
  code text not null,
  paid_at timestamptz not null default now(),
  amount numeric(12,0) not null,
  payment_method text not null,
  finance_account_id uuid not null,
  cashbook_voucher_id uuid not null,
  status text not null default 'posted',
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payments_org_code_key unique (organization_id, code),
  constraint supplier_payments_id_org_key unique (id, organization_id),
  constraint supplier_payments_supplier_org_fkey foreign key (supplier_id, organization_id)
    references public.suppliers(id, organization_id) on delete restrict,
  constraint supplier_payments_account_org_fkey foreign key (finance_account_id, organization_id)
    references public.finance_accounts(id, organization_id) on delete restrict,
  constraint supplier_payments_cashbook_voucher_fkey foreign key (cashbook_voucher_id)
    references public.cashbook_vouchers(id) on delete restrict,
  constraint supplier_payments_code_check check (code ~ '^PCPN[0-9]{6}$'),
  constraint supplier_payments_amount_check check (amount > 0),
  constraint supplier_payments_method_check check (payment_method in ('cash', 'bank_transfer')),
  constraint supplier_payments_status_check check (status in ('posted', 'cancelled')),
  constraint supplier_payments_note_check check (note is null or char_length(btrim(note)) <= 500)
);

create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_payment_id uuid not null,
  purchase_receipt_id uuid not null,
  allocated_amount numeric(12,0) not null,
  created_at timestamptz not null default now(),
  constraint supplier_payment_allocations_payment_receipt_key unique (supplier_payment_id, purchase_receipt_id),
  constraint supplier_payment_allocations_payment_org_fkey foreign key (supplier_payment_id, organization_id)
    references public.supplier_payments(id, organization_id) on delete restrict,
  constraint supplier_payment_allocations_receipt_org_fkey foreign key (purchase_receipt_id, organization_id)
    references public.purchase_receipts(id, organization_id) on delete restrict,
  constraint supplier_payment_allocations_amount_check check (allocated_amount > 0)
);

alter table public.cashbook_vouchers
  add column related_supplier_payment_id uuid;

alter table public.cashbook_vouchers
  add constraint cashbook_vouchers_supplier_payment_org_fkey foreign key (related_supplier_payment_id, organization_id)
    references public.supplier_payments(id, organization_id) on delete restrict;

create index idx_supplier_payments_supplier
  on public.supplier_payments (organization_id, supplier_id, paid_at desc);
create index idx_supplier_payment_allocations_receipt
  on public.supplier_payment_allocations (organization_id, purchase_receipt_id);
create index idx_cashbook_vouchers_supplier_payment
  on public.cashbook_vouchers (organization_id, related_supplier_payment_id)
  where related_supplier_payment_id is not null;

create or replace function public.next_supplier_payment_code(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select coalesce(max(substring(sp.code from 5)::integer), 0) + 1
    into next_number
  from public.supplier_payments sp
  where sp.organization_id = p_organization_id
    and sp.code ~ '^PCPN[0-9]{6}$';

  return 'PCPN' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.pay_supplier_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_supplier_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplier_record record;
  allocation_record record;
  receipt_record record;
  finance_account_id_value uuid;
  payment_method_value text;
  paid_at_value timestamptz;
  note_value text;
  payment_id_value uuid;
  payment_code_value text;
  total_amount_value numeric(12,0) := 0;
  receipt_paid_value numeric(12,0);
  receipt_outstanding_value numeric(12,0);
  selected_receipt_ids uuid[] := array[]::uuid[];
  voucher_id_value uuid;
  voucher_reason_value text;
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

  select s.*
    into supplier_record
  from public.suppliers s
  where s.id = p_supplier_id
    and s.organization_id = p_organization_id;

  if supplier_record.id is null then
    raise exception 'supplier not found' using errcode = '22023';
  end if;

  payment_method_value := nullif(p_payload->>'payment_method', '');
  if payment_method_value not in ('cash', 'bank_transfer') then
    raise exception 'payment method is required' using errcode = '22023';
  end if;

  paid_at_value := coalesce(nullif(p_payload->>'paid_at', '')::timestamptz, now());
  note_value := nullif(btrim(coalesce(p_payload->>'note', '')), '');
  if note_value is not null and char_length(note_value) > 500 then
    raise exception 'supplier payment note is too long' using errcode = '22023';
  end if;

  if payment_method_value = 'cash' then
    select fa.id
      into finance_account_id_value
    from public.finance_accounts fa
    where fa.organization_id = p_organization_id
      and fa.account_type = 'cash'
      and fa.is_default_cash = true
      and fa.is_active = true
    limit 1;
  else
    finance_account_id_value := nullif(p_payload->>'finance_account_id', '')::uuid;
  end if;

  if finance_account_id_value is null or not exists (
    select 1
    from public.finance_accounts fa
    where fa.id = finance_account_id_value
      and fa.organization_id = p_organization_id
      and fa.is_active = true
      and (
        (payment_method_value = 'cash' and fa.account_type = 'cash')
        or (payment_method_value = 'bank_transfer' and fa.account_type = 'bank')
      )
  ) then
    raise exception 'finance account is invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'allocations') <> 'array' or jsonb_array_length(p_payload->'allocations') = 0 then
    raise exception 'supplier payment allocations are required' using errcode = '22023';
  end if;

  for allocation_record in
    select
      nullif(value->>'purchase_receipt_id', '')::uuid as purchase_receipt_id,
      coalesce((value->>'amount')::numeric, 0) as amount
    from jsonb_array_elements(p_payload->'allocations') as value
  loop
    if allocation_record.purchase_receipt_id is null or allocation_record.amount <= 0 then
      raise exception 'supplier payment allocation is invalid' using errcode = '22023';
    end if;

    if allocation_record.purchase_receipt_id = any(selected_receipt_ids) then
      raise exception 'supplier payment receipt is duplicated' using errcode = '22023';
    end if;
    selected_receipt_ids := array_append(selected_receipt_ids, allocation_record.purchase_receipt_id);

    select pr.*
      into receipt_record
    from public.purchase_receipts pr
    where pr.id = allocation_record.purchase_receipt_id
      and pr.organization_id = p_organization_id
    for update;

    if receipt_record.id is null or receipt_record.supplier_id <> p_supplier_id then
      raise exception 'supplier payment receipt is invalid' using errcode = '22023';
    end if;

    if receipt_record.status <> 'posted' then
      raise exception 'supplier payment receipt must be posted' using errcode = '22023';
    end if;

    select coalesce(sum(spa.allocated_amount), 0)
      into receipt_paid_value
    from public.supplier_payment_allocations spa
    join public.supplier_payments sp on sp.id = spa.supplier_payment_id
      and sp.organization_id = spa.organization_id
      and sp.status = 'posted'
    where spa.organization_id = p_organization_id
      and spa.purchase_receipt_id = receipt_record.id;

    receipt_outstanding_value := receipt_record.remaining_amount - receipt_paid_value;
    if receipt_outstanding_value <= 0 or allocation_record.amount > receipt_outstanding_value then
      raise exception 'supplier payment exceeds selected receipt remaining payable' using errcode = '22023';
    end if;

    total_amount_value := total_amount_value + allocation_record.amount;
  end loop;

  payment_code_value := public.next_supplier_payment_code(p_organization_id);
  voucher_reason_value := 'Thanh toán NCC ' || payment_code_value
    || ' - ' || supplier_record.code || ' - ' || supplier_record.name
    || ' - ' || case when payment_method_value = 'bank_transfer' then 'Chuyển khoản' else 'Tiền mặt' end;

  insert into public.cashbook_vouchers (
    organization_id,
    code,
    base_code,
    revision_no,
    voucher_direction,
    voucher_type,
    status,
    finance_account_id,
    amount,
    is_business_accounted,
    counterparty_type,
    counterparty_name,
    counterparty_phone,
    related_supplier_id,
    reason,
    created_by
  )
  values (
    p_organization_id,
    payment_code_value,
    payment_code_value,
    0,
    'out',
    'material_purchase',
    'posted',
    finance_account_id_value,
    total_amount_value,
    true,
    'supplier',
    supplier_record.code || ' - ' || supplier_record.name,
    supplier_record.phone,
    supplier_record.id,
    voucher_reason_value || coalesce(' - ' || note_value, ''),
    p_actor_user_id
  )
  returning id into voucher_id_value;

  insert into public.supplier_payments (
    organization_id,
    supplier_id,
    code,
    paid_at,
    amount,
    payment_method,
    finance_account_id,
    cashbook_voucher_id,
    status,
    note,
    created_by
  )
  values (
    p_organization_id,
    supplier_record.id,
    payment_code_value,
    paid_at_value,
    total_amount_value,
    payment_method_value,
    finance_account_id_value,
    voucher_id_value,
    'posted',
    note_value,
    p_actor_user_id
  )
  returning id into payment_id_value;

  update public.cashbook_vouchers
  set related_supplier_payment_id = payment_id_value
  where id = voucher_id_value
    and organization_id = p_organization_id;

  for allocation_record in
    select
      nullif(value->>'purchase_receipt_id', '')::uuid as purchase_receipt_id,
      (value->>'amount')::numeric as amount
    from jsonb_array_elements(p_payload->'allocations') as value
  loop
    insert into public.supplier_payment_allocations (
      organization_id,
      supplier_payment_id,
      purchase_receipt_id,
      allocated_amount
    )
    values (
      p_organization_id,
      payment_id_value,
      allocation_record.purchase_receipt_id,
      allocation_record.amount
    );
  end loop;

  insert into public.cashbook_entries (
    organization_id,
    finance_account_id,
    source_type,
    cashbook_voucher_id,
    status,
    direction,
    amount_delta,
    description,
    created_by
  )
  values (
    p_organization_id,
    finance_account_id_value,
    'cashbook_voucher',
    voucher_id_value,
    'posted',
    'out',
    -total_amount_value,
    voucher_reason_value || coalesce(' - ' || note_value, ''),
    p_actor_user_id
  );

  return jsonb_build_object(
    'supplier_payment_id', payment_id_value,
    'code', payment_code_value,
    'amount', total_amount_value,
    'cashbook_voucher_id', voucher_id_value
  );
end;
$$;

create trigger set_supplier_payments_updated_at
before update on public.supplier_payments
for each row execute function public.set_updated_at();

alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;

grant select, insert, update on
  public.supplier_payments,
  public.supplier_payment_allocations
to service_role;
grant execute on function public.next_supplier_payment_code(uuid) to service_role;
grant execute on function public.pay_supplier_tx(uuid, uuid, uuid, jsonb) to service_role;
