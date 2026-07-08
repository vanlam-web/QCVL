alter table public.purchase_receipt_items
  add constraint purchase_receipt_items_id_org_key unique (id, organization_id);

alter table public.stock_movements
  add column purchase_receipt_id uuid,
  add column purchase_receipt_item_id uuid;

alter table public.stock_movements
  add constraint stock_movements_purchase_receipt_org_fkey foreign key (purchase_receipt_id, organization_id)
    references public.purchase_receipts(id, organization_id) on delete restrict,
  add constraint stock_movements_purchase_receipt_item_org_fkey foreign key (purchase_receipt_item_id, organization_id)
    references public.purchase_receipt_items(id, organization_id) on delete restrict;

alter table public.stock_movements
  drop constraint stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check check (
    movement_type in ('sale_deduction', 'stocktake_adjustment', 'manual_adjustment', 'remnant_created', 'remnant_discarded', 'purchase_receipt')
  );

create index idx_stock_movements_purchase_receipt
  on public.stock_movements (organization_id, purchase_receipt_id)
  where purchase_receipt_id is not null;

alter table public.cashbook_vouchers
  add column related_purchase_receipt_id uuid,
  add column related_supplier_id uuid;

alter table public.cashbook_vouchers
  add constraint cashbook_vouchers_purchase_receipt_org_fkey foreign key (related_purchase_receipt_id, organization_id)
    references public.purchase_receipts(id, organization_id) on delete restrict,
  add constraint cashbook_vouchers_supplier_org_fkey foreign key (related_supplier_id, organization_id)
    references public.suppliers(id, organization_id) on delete restrict;

create index idx_cashbook_vouchers_purchase_receipt
  on public.cashbook_vouchers (organization_id, related_purchase_receipt_id)
  where related_purchase_receipt_id is not null;

create or replace function public.post_purchase_receipt_tx(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_receipt_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_record record;
  supplier_record record;
  item_record record;
  settings_record record;
  stock_unit_record record;
  finance_account_id_value uuid;
  payment_method_value text;
  paid_amount_value numeric(12,0);
  voucher_id_value uuid;
  voucher_code_value text;
  voucher_reason_value text;
  posted_at_value timestamptz := now();
  item_count integer;
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

  select pr.*
    into receipt_record
  from public.purchase_receipts pr
  where pr.id = p_receipt_id
    and pr.organization_id = p_organization_id
  for update;

  if receipt_record.id is null then
    raise exception 'purchase receipt not found' using errcode = '22023';
  end if;

  if receipt_record.status <> 'draft' then
    raise exception 'purchase receipt is not draft' using errcode = '22023';
  end if;

  select s.*
    into supplier_record
  from public.suppliers s
  where s.id = receipt_record.supplier_id
    and s.organization_id = p_organization_id;

  if supplier_record.id is null then
    raise exception 'supplier not found' using errcode = '22023';
  end if;

  select count(*)
    into item_count
  from public.purchase_receipt_items pri
  where pri.purchase_receipt_id = p_receipt_id
    and pri.organization_id = p_organization_id;

  if item_count = 0 then
    raise exception 'purchase receipt has no items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.purchase_receipt_items pri
    where pri.purchase_receipt_id = p_receipt_id
      and pri.organization_id = p_organization_id
      and pri.inventory_shape <> 'normal'
  ) then
    raise exception 'purchase receipt contains non-normal item' using errcode = '22023';
  end if;

  paid_amount_value := receipt_record.paid_amount;
  payment_method_value := nullif(p_payload->>'payment_method', '');

  if paid_amount_value > 0 then
    if payment_method_value not in ('cash', 'bank_transfer') then
      raise exception 'payment method is required' using errcode = '22023';
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
  end if;

  for item_record in
    select pri.*
    from public.purchase_receipt_items pri
    where pri.purchase_receipt_id = p_receipt_id
      and pri.organization_id = p_organization_id
    order by pri.line_no
  loop
    select pis.*
      into settings_record
    from public.product_inventory_settings pis
    where pis.product_id = item_record.product_id
      and pis.organization_id = p_organization_id;

    if settings_record.id is null or settings_record.inventory_shape <> 'normal' or settings_record.stock_unit_id is null then
      raise exception 'normal inventory settings are required' using errcode = '22023';
    end if;

    select iu.*
      into stock_unit_record
    from public.inventory_units iu
    where iu.id = settings_record.stock_unit_id
      and iu.organization_id = p_organization_id
      and iu.is_active = true;

    if stock_unit_record.id is null then
      raise exception 'stock unit is invalid' using errcode = '22023';
    end if;

    if lower(btrim(item_record.unit_name_snapshot)) not in (
      lower(btrim(stock_unit_record.name)),
      lower(btrim(stock_unit_record.code))
    ) then
      raise exception 'purchase unit must match stock unit in P3' using errcode = '22023';
    end if;

    insert into public.stock_movements (
      organization_id,
      product_id,
      movement_type,
      quantity_delta,
      stock_unit_id,
      display_quantity,
      display_unit_id,
      inventory_object_type,
      purchase_receipt_id,
      purchase_receipt_item_id,
      reason,
      created_by
    )
    values (
      p_organization_id,
      item_record.product_id,
      'purchase_receipt',
      item_record.quantity,
      settings_record.stock_unit_id,
      item_record.quantity,
      settings_record.stock_unit_id,
      null,
      p_receipt_id,
      item_record.id,
      'purchase receipt ' || receipt_record.code,
      p_actor_user_id
    );

    update public.products
    set
      latest_purchase_cost = item_record.unit_cost,
      latest_purchase_cost_at = posted_at_value,
      latest_purchase_cost_updated_by = p_actor_user_id
    where id = item_record.product_id
      and organization_id = p_organization_id;
  end loop;

  if paid_amount_value > 0 then
    voucher_code_value := public.next_cashbook_voucher_code(p_organization_id, 'out');
    voucher_reason_value := 'Phiếu nhập ' || receipt_record.code
      || ' - ' || supplier_record.code || ' - ' || supplier_record.name
      || coalesce(' - CT NCC ' || receipt_record.supplier_document_no, '')
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
      related_purchase_receipt_id,
      related_supplier_id,
      reason,
      created_by
    )
    values (
      p_organization_id,
      voucher_code_value,
      voucher_code_value,
      0,
      'out',
      'material_purchase',
      'posted',
      finance_account_id_value,
      paid_amount_value,
      true,
      'supplier',
      supplier_record.code || ' - ' || supplier_record.name,
      supplier_record.phone,
      p_receipt_id,
      supplier_record.id,
      voucher_reason_value,
      p_actor_user_id
    )
    returning id into voucher_id_value;

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
      -paid_amount_value,
      voucher_reason_value,
      p_actor_user_id
    );
  end if;

  update public.purchase_receipts
  set
    status = 'posted',
    posted_by = p_actor_user_id,
    posted_at = posted_at_value,
    updated_at = posted_at_value
  where id = p_receipt_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'purchase_receipt_id', p_receipt_id,
    'status', 'posted',
    'posted_at', posted_at_value,
    'cashbook_voucher_id', voucher_id_value
  );
end;
$$;

grant execute on function public.post_purchase_receipt_tx(uuid, uuid, uuid, jsonb) to service_role;
