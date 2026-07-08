begin;

select plan(7);

insert into public.organizations (id, code, name)
values
  ('30000000-0000-4000-8000-000000000001', 'ORG-TX-A', 'Transaction Org A'),
  ('40000000-0000-4000-8000-000000000001', 'ORG-TX-B', 'Transaction Org B');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', 'test', now(), now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'target@example.test', 'test', now(), now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'second-admin@example.test', 'test', now(), now(), now()),
  ('40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'other@example.test', 'test', now(), now(), now());

insert into public.profiles (user_id, organization_id, display_name)
values
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Admin'),
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Target'),
  ('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Second Admin'),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Other Org User');

insert into public.user_permissions (user_id, permission_code, granted_by)
values
  ('30000000-0000-4000-8000-000000000001', 'perm.manage_users', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', 'perm.create_order', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', 'perm.apply_discount', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'perm.manage_users', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000001', 'perm.manage_users', '40000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ select public.replace_user_permissions(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-000000000002'::uuid,
       array['perm.refund_order', 'perm.create_order'],
       'trace-replace-1'
     ) $$,
  'replace_user_permissions replaces a complete permission set'
);
select results_eq(
  $$ select permission_code from public.user_permissions where user_id = '30000000-0000-4000-8000-000000000002'::uuid order by permission_code $$,
  $$ values ('perm.create_order'::text), ('perm.refund_order'::text) $$,
  'target permissions are exactly the replacement set'
);
select results_eq(
  $$
    select action, permissions_before, permissions_after, trace_id
    from public.permission_audit_logs
    where target_user_id = '30000000-0000-4000-8000-000000000002'::uuid
    order by created_at desc
    limit 1
  $$,
  $$
    values (
      'replace'::text,
      '["perm.apply_discount", "perm.create_order"]'::jsonb,
      '["perm.create_order", "perm.refund_order"]'::jsonb,
      'trace-replace-1'::text
    )
  $$,
  'replace writes sorted before/after audit JSON arrays'
);

select throws_ok(
  $$ select public.replace_user_permissions(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '40000000-0000-4000-8000-000000000001'::uuid,
       array['perm.create_order'],
       'trace-cross-tenant'
     ) $$,
  'P0001',
  'CROSS_TENANT',
  'replace rejects cross-organization targets'
);
select throws_ok(
  $$ select public.replace_user_permissions(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-000000000002'::uuid,
       array['perm.create_order', 'perm.not_real'],
       'trace-invalid'
     ) $$,
  'P0001',
  'INVALID_PERMISSION',
  'replace rejects unknown permission codes'
);

update public.permissions
set status = 'deprecated'
where code = 'perm.refund_order';

select throws_ok(
  $$ select public.replace_user_permissions(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-000000000002'::uuid,
       array['perm.refund_order'],
       'trace-deprecated'
     ) $$,
  'P0001',
  'INVALID_PERMISSION',
  'replace rejects deprecated permission codes'
);

delete from public.user_permissions
where user_id = '30000000-0000-4000-8000-000000000003'::uuid
  and permission_code = 'perm.manage_users';

select throws_ok(
  $$ select public.replace_user_permissions(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-000000000001'::uuid,
       array['perm.create_order'],
       'trace-last-admin'
     ) $$,
  'P0001',
  'LAST_ADMIN_REQUIRED',
  'replace rejects removing manage_users from the final active administrator'
);

select * from finish();
rollback;
