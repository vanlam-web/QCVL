begin;

select plan(61);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'workstations', 'workstations table exists');
select has_table('public', 'permissions', 'permissions table exists');
select has_table('public', 'user_permissions', 'user_permissions table exists');
select has_table('public', 'permission_audit_logs', 'permission_audit_logs table exists');
select has_table('public', 'account_devices', 'account_devices table exists');

select col_is_pk('public', 'organizations', 'id', 'organizations.id is the primary key');
select col_is_pk('public', 'profiles', 'user_id', 'profiles.user_id is the primary key');
select has_column('public', 'profiles', 'username', 'profiles.username exists');
select has_column('public', 'profiles', 'phone', 'profiles.phone exists');
select has_column('public', 'profiles', 'email', 'profiles.email exists');
select has_column('public', 'profiles', 'birthday', 'profiles.birthday exists');
select has_column('public', 'profiles', 'region', 'profiles.region exists');
select has_column('public', 'profiles', 'ward', 'profiles.ward exists');
select has_column('public', 'profiles', 'address', 'profiles.address exists');
select has_column('public', 'profiles', 'note', 'profiles.note exists');

select has_index(
  'public',
  'profiles',
  'idx_profiles_organization_id',
  'profiles has an organization index'
);
select has_index(
  'public',
  'profiles',
  'idx_profiles_org_status',
  'profiles has an organization and status index'
);
select has_index(
  'public',
  'workstations',
  'idx_workstations_org_status',
  'workstations has an organization and status index'
);
select has_index(
  'public',
  'permission_audit_logs',
  'idx_permission_audit_org_time',
  'permission audit logs have an organization and time index'
);
select has_index(
  'public',
  'account_devices',
  'idx_account_devices_user_last_seen',
  'account devices have a user and last seen index'
);

select fk_ok(
  'public',
  'profiles',
  'organization_id',
  'public',
  'organizations',
  'id',
  'profiles.organization_id references organizations.id'
);
select fk_ok(
  'public',
  'user_permissions',
  'permission_code',
  'public',
  'permissions',
  'code',
  'user_permissions.permission_code references permissions.code'
);
select fk_ok(
  'public',
  'account_devices',
  'user_id',
  'public',
  'profiles',
  'user_id',
  'account_devices.user_id references profiles.user_id'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.organizations'::regclass),
  'organizations has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass),
  'profiles has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.workstations'::regclass),
  'workstations has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.permissions'::regclass),
  'permissions has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_permissions'::regclass),
  'user_permissions has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.permission_audit_logs'::regclass),
  'permission_audit_logs has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.account_devices'::regclass),
  'account_devices has row level security enabled'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.organizations'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_catalog.pg_attribute where attrelid = 'public.organizations'::regclass and attname = 'code')
      ]::smallint[]
  ),
  'organizations.code is unique'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.workstations'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_catalog.pg_attribute where attrelid = 'public.workstations'::regclass and attname = 'organization_id'),
        (select attnum from pg_catalog.pg_attribute where attrelid = 'public.workstations'::regclass and attname = 'code')
      ]::smallint[]
  ),
  'workstations organization and code pair is unique'
);

select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.organizations'::regclass and conname = 'organizations_code_format_check'),
  'organizations code format is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_display_name_check'),
  'profiles display name is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_username_check'),
  'profiles username is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_phone_check'),
  'profiles phone is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_email_check'),
  'profiles email is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_region_check'),
  'profiles region is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_ward_check'),
  'profiles ward is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_address_check'),
  'profiles address is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_note_check'),
  'profiles note is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.workstations'::regclass and conname = 'workstations_code_format_check'),
  'workstations code format is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.permissions'::regclass and conname = 'permissions_code_format_check'),
  'permission code format is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.permissions'::regclass and conname = 'permissions_status_check'),
  'permission status is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.permission_audit_logs'::regclass and conname = 'permission_audit_logs_action_check'),
  'permission audit action is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.permission_audit_logs'::regclass and conname = 'permission_audit_logs_before_is_array_check'),
  'permissions_before must be a JSON array'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.permission_audit_logs'::regclass and conname = 'permission_audit_logs_after_is_array_check'),
  'permissions_after must be a JSON array'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.account_devices'::regclass and conname = 'account_devices_unique_user_device'),
  'account devices are unique per user and device key'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.account_devices'::regclass and conname = 'account_devices_device_type_check'),
  'account device type is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.account_devices'::regclass and conname = 'account_devices_status_check'),
  'account device status is constrained'
);

select ok(
  to_regprocedure('public.set_updated_at()') is not null,
  'set_updated_at function exists'
);
select ok(
  exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.organizations'::regclass and tgname = 'set_organizations_updated_at' and not tgisinternal),
  'organizations updated_at trigger exists'
);
select ok(
  exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'set_profiles_updated_at' and not tgisinternal),
  'profiles updated_at trigger exists'
);
select ok(
  exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.workstations'::regclass and tgname = 'set_workstations_updated_at' and not tgisinternal),
  'workstations updated_at trigger exists'
);
select ok(
  exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.account_devices'::regclass and tgname = 'set_account_devices_updated_at' and not tgisinternal),
  'account devices updated_at trigger exists'
);

select results_eq(
  $$ select code from public.organizations where id = '00000000-0000-4000-8000-000000000001'::uuid $$,
  $$ values ('VAN-LAM'::text) $$,
  'seed creates the Văn Lâm organization'
);
select results_eq(
  $$ select code from public.workstations where id = '00000000-0000-4000-8000-000000000101'::uuid $$,
  $$ values ('POS-01'::text) $$,
  'seed creates the POS-01 workstation'
);
select results_eq(
  $$ select count(*)::integer from public.permissions where status = 'active' $$,
  $$ values (10::integer) $$,
  'seed creates exactly 10 active permissions'
);
select results_eq(
  $$
    select count(*)::integer
    from public.permissions
    where code = any (array[
      'perm.view_shift_report',
      'perm.access_admin_panel',
      'perm.create_order',
      'perm.edit_order_locked',
      'perm.apply_discount',
      'perm.refund_order',
      'perm.manage_inventory',
      'perm.edit_price_book',
      'perm.manage_users'
    ])
  $$,
  $$ values (9::integer) $$,
  'seed includes the required Phase 0 permission catalog'
);

select * from finish();
rollback;
