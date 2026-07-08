begin;

select plan(31);

select has_table('public', 'suppliers', 'suppliers table exists');
select has_column('public', 'suppliers', 'organization_id', 'suppliers.organization_id exists');
select has_column('public', 'suppliers', 'code', 'suppliers.code exists');
select has_column('public', 'suppliers', 'name', 'suppliers.name exists');
select has_column('public', 'suppliers', 'phone', 'suppliers.phone exists');
select has_column('public', 'suppliers', 'email', 'suppliers.email exists');
select has_column('public', 'suppliers', 'address', 'suppliers.address exists');
select has_column('public', 'suppliers', 'tax_code', 'suppliers.tax_code exists');
select has_column('public', 'suppliers', 'linked_customer_id', 'suppliers.linked_customer_id exists');
select has_column('public', 'suppliers', 'notes', 'suppliers.notes exists');
select has_column('public', 'suppliers', 'status', 'suppliers.status exists');
select has_column('public', 'suppliers', 'created_at', 'suppliers.created_at exists');
select has_column('public', 'suppliers', 'updated_at', 'suppliers.updated_at exists');

select col_not_null('public', 'suppliers', 'organization_id', 'suppliers.organization_id is not null');
select col_not_null('public', 'suppliers', 'code', 'suppliers.code is not null');
select col_not_null('public', 'suppliers', 'name', 'suppliers.name is not null');
select col_not_null('public', 'suppliers', 'status', 'suppliers.status is not null');
select col_is_null('public', 'suppliers', 'phone', 'suppliers.phone can be blank');
select col_is_null('public', 'suppliers', 'linked_customer_id', 'suppliers linked customer can be blank');

select has_index('public', 'suppliers', 'idx_suppliers_org_status', 'suppliers has organization/status index');
select has_index('public', 'suppliers', 'idx_suppliers_org_code', 'suppliers has organization/code index');
select has_index('public', 'suppliers', 'idx_suppliers_org_name', 'suppliers has organization/name index');
select has_index('public', 'suppliers', 'idx_suppliers_org_phone', 'suppliers has organization/phone index');

select has_function('public', 'next_supplier_code', array['uuid'], 'supplier code generator exists');
select ok(
  public.next_supplier_code('00000000-0000-4000-8000-000000000001') ~ '^NCC[0-9]{6}$',
  'next supplier code uses NCC000001 format'
);

insert into public.suppliers (organization_id, code, name, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'NCC900001', 'NCC A', null),
  ('00000000-0000-4000-8000-000000000001', 'NCC900002', 'NCC B', null);

select results_eq(
  $$ select count(*)::integer from public.suppliers where phone is null and code like 'NCC90000%' $$,
  array[2],
  'blank supplier phone is allowed for multiple suppliers'
);

insert into public.suppliers (organization_id, code, name, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'NCC900003', 'NCC C', '0901234567'),
  ('00000000-0000-4000-8000-000000000001', 'NCC900004', 'NCC D', '0901234567');

select results_eq(
  $$ select count(*)::integer from public.suppliers where phone = '0901234567' $$,
  array[2],
  'duplicate supplier phone is not hard-blocked in MVP'
);

insert into public.suppliers (organization_id, code, name, linked_customer_id)
values (
  '00000000-0000-4000-8000-000000000001',
  'NCC900005',
  'NCC Linked',
  '00000000-0000-4000-8000-000000000501'
);

select results_eq(
  $$ select count(*)::integer from public.suppliers where code = 'NCC900005' and linked_customer_id = '00000000-0000-4000-8000-000000000501' $$,
  array[1],
  'supplier can link to customer in same organization'
);

insert into public.organizations (id, code, name)
values ('00000000-0000-4000-8000-000000000099', 'OTHER', 'Other org');

insert into public.customers (id, organization_id, code, name)
values ('00000000-0000-4000-8000-000000000399', '00000000-0000-4000-8000-000000000099', 'KHOTHER', 'Other customer');

select throws_ok(
  $$ insert into public.suppliers (organization_id, code, name, linked_customer_id)
     values ('00000000-0000-4000-8000-000000000001', 'NCC900006', 'NCC Cross Org', '00000000-0000-4000-8000-000000000399') $$,
  '23503',
  'insert or update on table "suppliers" violates foreign key constraint "suppliers_linked_customer_org_fkey"',
  'linked customer must belong to same organization'
);

select throws_ok(
  $$ insert into public.suppliers (organization_id, code, name, status)
     values ('00000000-0000-4000-8000-000000000001', 'NCC900007', 'Bad status', 'blocked') $$,
  '23514',
  'new row for relation "suppliers" violates check constraint "suppliers_status_check"',
  'supplier status is constrained'
);

select throws_ok(
  $$ insert into public.suppliers (organization_id, code, name)
     values ('00000000-0000-4000-8000-000000000001', 'NCC900001', 'Duplicate code') $$,
  '23505',
  'duplicate key value violates unique constraint "suppliers_org_code_key"',
  'supplier code is unique per organization'
);

select * from finish();
rollback;
