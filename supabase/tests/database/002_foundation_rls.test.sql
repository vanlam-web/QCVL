begin;

select plan(11);

insert into public.organizations (id, code, name)
values
  ('10000000-0000-4000-8000-000000000001', 'ORG-A', 'Organization A'),
  ('20000000-0000-4000-8000-000000000001', 'ORG-B', 'Organization B');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'user-a@example.test', 'test', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'user-b@example.test', 'test', now(), now(), now());

insert into public.profiles (user_id, organization_id, display_name)
values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'User A'),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'User B');

insert into public.workstations (id, organization_id, code, name, status)
values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'POS-A', 'POS A', 'active'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', 'POS-X', 'POS inactive', 'inactive'),
  ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'POS-B', 'POS B', 'active');

insert into public.user_permissions (user_id, permission_code, granted_by)
values
  ('10000000-0000-4000-8000-000000000001', 'perm.create_order', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'perm.manage_users', '20000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$ select code from public.organizations order by code $$,
  $$ values ('ORG-A'::text) $$,
  'authenticated user can read only their organization'
);
select results_eq(
  $$ select display_name from public.profiles order by display_name $$,
  $$ values ('User A'::text) $$,
  'authenticated user can read only their active profile'
);
select results_eq(
  $$ select code from public.workstations order by code $$,
  $$ values ('POS-A'::text) $$,
  'authenticated user can read only active workstations in their organization'
);
select results_eq(
  $$ select permission_code from public.user_permissions order by permission_code $$,
  $$ values ('perm.create_order'::text) $$,
  'authenticated user can read only their permissions'
);
select results_eq(
  $$ select count(*)::integer from public.permissions where status = 'active' $$,
  $$ values (10::integer) $$,
  'authenticated active user can read active permission catalog'
);
select results_eq(
  $$ select public.current_organization_id() $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid) $$,
  'current_organization_id resolves from active profile'
);

select throws_ok(
  $$ insert into public.organizations (code, name) values ('ORG-C', 'Organization C') $$,
  '42501',
  'permission denied for table organizations',
  'authenticated user cannot insert organizations'
);
select throws_ok(
  $$ update public.profiles set display_name = 'Hacked' $$,
  '42501',
  'permission denied for table profiles',
  'authenticated user cannot update profiles directly'
);
select throws_ok(
  $$ insert into public.user_permissions (user_id, permission_code, granted_by)
     values ('10000000-0000-4000-8000-000000000001', 'perm.manage_users', '10000000-0000-4000-8000-000000000001') $$,
  '42501',
  'permission denied for table user_permissions',
  'authenticated user cannot insert permissions directly'
);
select throws_ok(
  $$ delete from public.workstations $$,
  '42501',
  'permission denied for table workstations',
  'authenticated user cannot delete workstations directly'
);
select throws_ok(
  $$ select public.replace_user_permissions(
       '10000000-0000-4000-8000-000000000001'::uuid,
       '10000000-0000-4000-8000-000000000001'::uuid,
       array['perm.create_order'],
       'rls-test'
     ) $$,
  '42501',
  'permission denied for function replace_user_permissions',
  'authenticated user cannot execute administrative transaction functions'
);

select * from finish();
rollback;
