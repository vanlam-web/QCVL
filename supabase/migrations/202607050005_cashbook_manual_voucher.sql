create or replace function public.create_cashbook_voucher_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  voucher_direction_value text;
  voucher_type_value text;
  finance_account_id_value uuid;
  amount_value numeric(12,0);
  is_business_accounted_value boolean;
  counterparty_type_value text;
  counterparty_name_value text;
  counterparty_phone_value text;
  reason_value text;
  voucher_code_value text;
  voucher_id_value uuid;
  amount_delta_value numeric(12,0);
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.organization_id = p_organization_id
      and p.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'actor is not active in organization';
  end if;

  voucher_direction_value := p_payload->>'voucher_direction';
  if voucher_direction_value not in ('in', 'out') then
    raise exception using errcode = '22023', message = 'voucher_direction is invalid';
  end if;

  voucher_type_value := p_payload->>'voucher_type';
  if voucher_type_value not in ('other_income', 'material_purchase', 'customer_refund', 'operating_expense', 'other_expense') then
    raise exception using errcode = '22023', message = 'voucher_type is invalid';
  end if;
  if voucher_direction_value = 'in' and voucher_type_value <> 'other_income' then
    raise exception using errcode = '22023', message = 'voucher_type is invalid for direction';
  end if;
  if voucher_direction_value = 'out' and voucher_type_value = 'other_income' then
    raise exception using errcode = '22023', message = 'voucher_type is invalid for direction';
  end if;

  begin
    finance_account_id_value := (p_payload->>'finance_account_id')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'finance_account_id is invalid';
  end;

  if not exists (
    select 1
    from public.finance_accounts fa
    where fa.id = finance_account_id_value
      and fa.organization_id = p_organization_id
      and fa.is_active = true
  ) then
    raise exception using errcode = '23503', message = 'finance account was not found';
  end if;

  amount_value := coalesce((p_payload->>'amount')::numeric, 0);
  if amount_value <= 0 or amount_value <> trunc(amount_value) then
    raise exception using errcode = '22023', message = 'amount must be a positive whole number';
  end if;

  is_business_accounted_value := coalesce((p_payload->>'is_business_accounted')::boolean, true);
  counterparty_type_value := coalesce(nullif(p_payload->>'counterparty_type', ''), 'none');
  if counterparty_type_value not in ('customer', 'supplier', 'employee', 'other', 'none') then
    raise exception using errcode = '22023', message = 'counterparty_type is invalid';
  end if;

  counterparty_name_value := nullif(btrim(coalesce(p_payload->>'counterparty_name', '')), '');
  counterparty_phone_value := nullif(btrim(coalesce(p_payload->>'counterparty_phone', '')), '');
  reason_value := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  if reason_value is null then
    raise exception using errcode = '22023', message = 'reason is required';
  end if;

  voucher_code_value := public.next_cashbook_voucher_code(p_organization_id, voucher_direction_value);
  amount_delta_value := case when voucher_direction_value = 'in' then amount_value else -amount_value end;

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
    reason,
    created_by
  )
  values (
    p_organization_id,
    voucher_code_value,
    voucher_code_value,
    0,
    voucher_direction_value,
    voucher_type_value,
    'posted',
    finance_account_id_value,
    amount_value,
    is_business_accounted_value,
    counterparty_type_value,
    counterparty_name_value,
    counterparty_phone_value,
    reason_value,
    p_actor_user_id
  )
  returning id into voucher_id_value;

  insert into public.cashbook_entries (
    organization_id,
    finance_account_id,
    entry_time,
    source_type,
    cashbook_voucher_id,
    status,
    direction,
    amount_delta,
    is_business_accounted,
    description,
    created_by
  )
  values (
    p_organization_id,
    finance_account_id_value,
    now(),
    'cashbook_voucher',
    voucher_id_value,
    'posted',
    voucher_direction_value,
    amount_delta_value,
    is_business_accounted_value,
    reason_value,
    p_actor_user_id
  );

  return jsonb_build_object(
    'id', voucher_id_value,
    'code', voucher_code_value,
    'source_type', 'manual_voucher',
    'status', 'posted',
    'amount', amount_value
  );
end;
$$;

grant execute on function public.create_cashbook_voucher_tx(uuid, uuid, jsonb) to service_role;
