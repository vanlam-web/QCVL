begin;

select plan(35);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000901',
  'authenticated',
  'authenticated',
  'cashbook-voucher-test@qc.local',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '20000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000001',
  'Cashbook Voucher Test User'
);

select has_function(
  'public',
  'create_cashbook_voucher_tx',
  array['uuid', 'uuid', 'jsonb'],
  'manual cashbook voucher transaction rpc exists'
);

select has_column(
  'public',
  'cashbook_vouchers',
  'partner_debt_mode',
  'manual cashbook voucher stores partner debt mode'
);

select throws_ok(
  $$ select public.create_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'voucher_direction', 'in',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 45000,
      'reason', 'Sai hướng'
    )
  ) $$,
  '22023',
  'voucher_type is invalid for direction',
  'manual cashbook voucher rejects type/direction mismatch'
);

create temporary table manual_voucher_results (
  name text primary key,
  result jsonb not null
) on commit drop;

insert into manual_voucher_results (name, result)
values (
  'expense',
  public.create_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 45000,
      'is_business_accounted', false,
      'counterparty_type', 'employee',
      'counterparty_name', 'Nguyen Van A',
      'counterparty_phone', '0900000000',
      'reason', 'Mua văn phòng phẩm'
    )
  )
);

insert into manual_voucher_results (name, result)
values (
  'salary_type',
  public.create_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'staff_salary',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 80000,
      'partner_debt_mode', 'not_affect_partner_debt',
      'counterparty_type', 'employee',
      'counterparty_name', 'Nhan vien B',
      'reason', 'Chi lương theo KV'
    )
  )
);

select is(
  (
    select voucher_type
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_type')::uuid)
  ),
  'staff_salary',
  'manual voucher accepts KV staff salary type'
);

select is(
  (
    select partner_debt_mode
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_type')::uuid)
  ),
  'not_affect_partner_debt',
  'manual voucher stores supplied partner debt mode'
);

select throws_ok(
  $$ select public.create_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'staff_salary',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 80000,
      'partner_debt_mode', 'bad_mode',
      'reason', 'Sai mode'
    )
  ) $$,
  '22023',
  'partner_debt_mode is invalid',
  'manual voucher rejects invalid partner debt mode'
);

select ok(
  (select result->>'code' from manual_voucher_results where name = 'expense') like 'PC______',
  'manual out voucher uses PC code'
);

select is(
  (select result->>'source_type' from manual_voucher_results where name = 'expense'),
  'manual_voucher',
  'manual voucher result identifies manual source'
);

select is(
  (
    select voucher_direction
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  'out',
  'manual voucher stores direction'
);

select is(
  (
    select amount::integer
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  45000,
  'manual voucher stores positive amount'
);

select is(
  (
    select is_business_accounted
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  false,
  'manual voucher stores business-accounted flag'
);

select is(
  (
    select counterparty_name
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  'Nguyen Van A',
  'manual voucher stores counterparty name'
);

select is(
  (
    select count(*)::integer
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  1,
  'manual voucher creates one cashbook entry'
);

select is(
  (
    select amount_delta::integer
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  -45000,
  'manual out voucher creates negative cashbook delta'
);

select is(
  (
    select is_business_accounted
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  false,
  'manual voucher mirrors business-accounted flag to entry'
);

select has_function(
  'public',
  'cancel_cashbook_voucher_tx',
  array['uuid', 'uuid', 'uuid'],
  'manual cashbook voucher cancel rpc exists'
);

insert into manual_voucher_results (name, result)
values (
  'cancelled_expense',
  public.cancel_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  )
);

select is(
  (select result->>'status' from manual_voucher_results where name = 'cancelled_expense'),
  'cancelled',
  'manual voucher cancel result is cancelled'
);

select is(
  (
    select status
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  'cancelled',
  'manual voucher cancel updates voucher status'
);

select is(
  (
    select status
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  'cancelled',
  'manual voucher cancel updates entry status'
);

select throws_ok(
  $$ select public.cancel_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ) $$,
  '22023',
  'cashbook voucher is not posted',
  'manual voucher cancel rejects already cancelled voucher'
);

select is(
  (
    select coalesce(sum(amount_delta), 0)::integer
    from public.cashbook_entries
    where status = 'posted'
      and cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'expense')::uuid)
  ),
  0,
  'cancelled manual voucher no longer contributes posted balance'
);

insert into manual_voucher_results (name, result)
values (
  'salary',
  public.create_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 320000,
      'is_business_accounted', true,
      'counterparty_type', 'employee',
      'counterparty_name', 'Tran Thi B',
      'reason', 'Chi lương'
    )
  )
);

select has_function(
  'public',
  'revise_cashbook_voucher_tx',
  array['uuid', 'uuid', 'uuid', 'jsonb'],
  'manual cashbook voucher revise rpc exists'
);

insert into manual_voucher_results (name, result)
values (
  'salary_revised',
  public.revise_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid),
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 350000,
      'is_business_accounted', true,
      'partner_debt_mode', 'affects_partner_debt',
      'counterparty_type', 'employee',
      'counterparty_name', 'Tran Thi B',
      'reason', 'Sửa số tiền lương'
    )
  )
);

select ok(
  (select result->>'code' from manual_voucher_results where name = 'salary_revised') =
    (select result->>'code' from manual_voucher_results where name = 'salary') || '.01',
  'manual voucher revise appends first revision suffix'
);

select is(
  (
    select status
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid)
  ),
  'cancelled',
  'manual voucher revise cancels old voucher'
);

select is(
  (
    select status
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid)
  ),
  'cancelled',
  'manual voucher revise cancels old entry'
);

select is(
  (
    select revision_no
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
  ),
  1,
  'manual voucher revise stores revision number'
);

select is(
  (
    select amount::integer
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
  ),
  350000,
  'manual voucher revise stores new amount'
);

select is(
  (
    select amount_delta::integer
    from public.cashbook_entries
    where cashbook_voucher_id = ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
  ),
  -350000,
  'manual voucher revise creates new posted cashbook entry'
);

select is(
  (
    select revised_from_voucher_id
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
  ),
  ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid),
  'manual voucher revise links new voucher to old voucher'
);

select is(
  (
    select replaced_by_voucher_id
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid)
  ),
  ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid),
  'manual voucher revise links old voucher to replacement'
);

select is(
  (
    select partner_debt_mode
    from public.cashbook_vouchers
    where id = ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
  ),
  'affects_partner_debt',
  'manual voucher revise stores partner debt mode'
);

select throws_ok(
  $$ select public.revise_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid),
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'supplier_payment',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 360000,
      'partner_debt_mode', 'bad_mode',
      'reason', 'Sai mode'
    )
  ) $$,
  '22023',
  'partner_debt_mode is invalid',
  'manual voucher revise rejects invalid partner debt mode'
);

select throws_ok(
  $$ select public.revise_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid),
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 360000,
      'reason', 'Sửa lại lần nữa'
    )
  ) $$,
  '22023',
  'cashbook voucher is not posted',
  'manual voucher revise rejects old cancelled voucher'
);

select throws_ok(
  $$ select public.revise_cashbook_voucher_tx(
    '20000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid),
    jsonb_build_object(
      'voucher_direction', 'out',
      'voucher_type', 'operating_expense',
      'finance_account_id', (select id from public.finance_accounts where organization_id = '00000000-0000-4000-8000-000000000001' and code = 'CASH'),
      'amount', 360000,
      'reason', ''
    )
  ) $$,
  '22023',
  'reason is required',
  'manual voucher revise requires reason'
);

select is(
  (
    select coalesce(sum(amount_delta), 0)::integer
    from public.cashbook_entries
    where status = 'posted'
      and cashbook_voucher_id in (
        ((select result->>'id' from manual_voucher_results where name = 'salary')::uuid),
        ((select result->>'id' from manual_voucher_results where name = 'salary_revised')::uuid)
      )
  ),
  -350000,
  'manual voucher revise keeps only replacement amount in posted balance'
);

select * from finish();
rollback;
