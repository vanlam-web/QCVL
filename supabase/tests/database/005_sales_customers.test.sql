begin;

select plan(53);

select has_table('public', 'customer_groups', 'customer_groups table exists');
select has_column('public', 'customer_groups', 'organization_id', 'customer_groups.organization_id exists');
select has_column('public', 'customer_groups', 'code', 'customer_groups.code exists');
select has_column('public', 'customer_groups', 'name', 'customer_groups.name exists');
select has_column('public', 'customer_groups', 'price_list_id', 'customer_groups.price_list_id exists');
select has_column('public', 'customer_groups', 'is_active', 'customer_groups.is_active exists');
select col_not_null('public', 'customer_groups', 'organization_id', 'customer_groups.organization_id is not null');
select col_not_null('public', 'customer_groups', 'code', 'customer_groups.code is not null');
select col_not_null('public', 'customer_groups', 'name', 'customer_groups.name is not null');
select col_not_null('public', 'customer_groups', 'price_list_id', 'customer_groups.price_list_id is not null');
select col_not_null('public', 'customer_groups', 'is_active', 'customer_groups.is_active is not null');
select has_index('public', 'customer_groups', 'idx_customer_groups_org_active', 'customer_groups has org/active index');
select has_index('public', 'customer_groups', 'idx_customer_groups_org_price_list', 'customer_groups has org/price-list index');

select has_table('public', 'customers', 'customers table exists');
select has_column('public', 'customers', 'organization_id', 'customers.organization_id exists');
select has_column('public', 'customers', 'code', 'customers.code exists');
select has_column('public', 'customers', 'name', 'customers.name exists');
select has_column('public', 'customers', 'name_normalized', 'customers.name_normalized exists');
select has_column('public', 'customers', 'phone', 'customers.phone exists');
select has_column('public', 'customers', 'phone_normalized', 'customers.phone_normalized exists');
select has_column('public', 'customers', 'tax_code', 'customers.tax_code exists');
select has_column('public', 'customers', 'address', 'customers.address exists');
select has_column('public', 'customers', 'customer_group_id', 'customers.customer_group_id exists');
select has_column('public', 'customers', 'created_by', 'customers.created_by exists');
select col_not_null('public', 'customers', 'organization_id', 'customers.organization_id is not null');
select col_not_null('public', 'customers', 'code', 'customers.code is not null');
select col_not_null('public', 'customers', 'name', 'customers.name is not null');
select has_index('public', 'customers', 'idx_customers_org_name', 'customers has org/name index');
select has_index('public', 'customers', 'customers_org_name_normalized_key', 'customers has org/normalized-name unique index');
select has_index('public', 'customers', 'idx_customers_org_code', 'customers has org/code index');
select has_index('public', 'customers', 'idx_customers_org_group', 'customers has org/group index');
select has_index('public', 'customers', 'idx_customers_org_phone_normalized', 'customers has org/phone index');
select has_index('public', 'customers', 'idx_customers_org_created_by', 'customers has org/created-by index');

select fk_ok(
  'public',
  'customers',
  'created_by',
  'public',
  'profiles',
  'user_id',
  'customers.created_by references profiles.user_id'
);

select has_function('public', 'normalize_customer_phone', array['text'], 'phone normalizer exists');
select has_function('public', 'normalize_customer_name', array['text'], 'customer name normalizer exists');
select has_function('public', 'next_customer_code', array['uuid'], 'customer code generator exists');
select has_function('public', 'default_retail_customer_id', array['uuid'], 'default retail customer resolver exists');

select is(
  public.normalize_customer_phone(' 090 123-4567 '),
  '0901234567',
  'phone normalization keeps digits'
);

select is(
  public.normalize_customer_name('  KHÁCH   LẺ  '),
  'khách lẻ',
  'customer name normalization trims spaces and ignores case'
);

select ok(
  public.next_customer_code('00000000-0000-4000-8000-000000000001') ~ '^KH[0-9]{6}$',
  'next customer code uses KH000001 format'
);

select is(
  public.default_retail_customer_id('00000000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000501'::uuid,
  'default retail customer resolver returns KH000001'
);

insert into public.organizations (id, code, name, status)
values ('00000000-0000-4000-8000-000000000099', 'NO-DEFAULT', 'No Default Customer Org', 'active');

select throws_ok(
  $$ select public.default_retail_customer_id('00000000-0000-4000-8000-000000000099') $$,
  '22023',
  'default retail customer KH000001 is not configured',
  'missing KH000001 fails with configuration error'
);

insert into public.customer_groups (id, organization_id, code, name, price_list_id)
values (
  '00000000-0000-4000-8000-000000000402',
  '00000000-0000-4000-8000-000000000001',
  'TEST',
  'Nhom test',
  '00000000-0000-4000-8000-000000000201'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000905',
  'authenticated',
  'authenticated',
  'customer-admin@example.test',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now()
);

insert into public.profiles (user_id, organization_id, display_name)
values (
  '00000000-0000-4000-8000-000000000905',
  '00000000-0000-4000-8000-000000000001',
  'Customer Admin'
);

insert into public.customers (organization_id, code, name, phone, customer_group_id)
values (
  '00000000-0000-4000-8000-000000000001',
  'KH900001',
  'Cong ty ABC',
  '090 123 4567',
  '00000000-0000-4000-8000-000000000402'
);

update public.customers
set tax_code = '0312345678',
    address = '12 Nguyen Trai, Quan 1'
where code = 'KH900001';

select is(
  (select phone_normalized from public.customers where code = 'KH900001'),
  '0901234567',
  'customer phone_normalized is generated'
);

select is(
  (select name_normalized from public.customers where code = 'KH900001'),
  'cong ty abc',
  'customer name_normalized is generated'
);

select is(
  (select tax_code from public.customers where code = 'KH900001'),
  '0312345678',
  'customer tax_code is stored'
);

select is(
  (select address from public.customers where code = 'KH900001'),
  '12 Nguyen Trai, Quan 1',
  'customer one-line address is stored'
);

update public.customers
set created_by = '00000000-0000-4000-8000-000000000905'
where code = 'KH900001';

select is(
  (select created_by::text from public.customers where code = 'KH900001'),
  '00000000-0000-4000-8000-000000000905',
  'customer creator is stored'
);

select throws_ok(
  $$ insert into public.customers (organization_id, code, name, phone)
     values ('00000000-0000-4000-8000-000000000001', 'KH000002', 'Khach trung SDT', '0901234567') $$,
  '23505',
  'duplicate key value violates unique constraint "customers_org_phone_normalized_key"',
  'duplicate normalized phone is rejected'
);

select throws_ok(
  $$ insert into public.customers (organization_id, code, name, phone)
     values ('00000000-0000-4000-8000-000000000001', 'KH900002', '  cong   TY abc  ', null) $$,
  '23505',
  'duplicate key value violates unique constraint "customers_org_name_normalized_key"',
  'duplicate normalized customer name is rejected'
);

insert into public.customers (organization_id, code, name, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'KH900003', 'Cong ty khong SDT 1', null),
  ('00000000-0000-4000-8000-000000000001', 'KH900004', 'Cong ty khong SDT 2', null);

select is(
  (
    select count(*)::integer
    from public.customers
    where code in ('KH900003', 'KH900004')
      and phone_normalized is null
  ),
  2,
  'multiple customers without phone are allowed when names differ'
);

select throws_ok(
  $$ update public.customers
     set name = 'Cong ty ABC'
     where code = 'KH900003' $$,
  '23505',
  'duplicate key value violates unique constraint "customers_org_name_normalized_key"',
  'updating to another customer normalized name is rejected'
);

select throws_ok(
  $$ update public.customers
     set phone = '090.123.4567'
     where code = 'KH900004' $$,
  '23505',
  'duplicate key value violates unique constraint "customers_org_phone_normalized_key"',
  'updating to another customer normalized phone is rejected'
);

select * from finish();
rollback;
