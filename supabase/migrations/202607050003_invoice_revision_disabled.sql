create or replace function public.revise_invoice_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_order_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_payload->>'revision_reason', '')), '') is null then
    raise exception 'revision_reason is required' using errcode = '22023';
  end if;

  raise exception 'invoice revision is not implemented yet' using errcode = '0A000';
end;
$$;

grant execute on function public.revise_invoice_tx(uuid, uuid, uuid, jsonb) to service_role;
