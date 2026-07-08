create or replace function public.cancel_cashbook_voucher_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_voucher_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  voucher_record record;
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

  select v.*
    into voucher_record
  from public.cashbook_vouchers v
  where v.id = p_voucher_id
    and v.organization_id = p_organization_id
  for update;

  if voucher_record.id is null then
    raise exception using errcode = '23503', message = 'cashbook voucher was not found';
  end if;
  if voucher_record.status <> 'posted' then
    raise exception using errcode = '22023', message = 'cashbook voucher is not posted';
  end if;
  if voucher_record.replaced_by_voucher_id is not null then
    raise exception using errcode = '22023', message = 'cashbook voucher was already replaced';
  end if;

  update public.cashbook_vouchers
  set status = 'cancelled',
      updated_at = now()
  where id = p_voucher_id
    and organization_id = p_organization_id;

  update public.cashbook_entries
  set status = 'cancelled'
  where cashbook_voucher_id = p_voucher_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'id', voucher_record.id,
    'code', voucher_record.code,
    'source_type', 'manual_voucher',
    'status', 'cancelled',
    'amount', voucher_record.amount
  );
end;
$$;

grant execute on function public.cancel_cashbook_voucher_tx(uuid, uuid, uuid) to service_role;
