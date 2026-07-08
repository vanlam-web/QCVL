create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'active'
$$;

grant execute on function public.current_organization_id() to authenticated;
revoke execute on function public.current_organization_id() from anon;

grant usage on schema public to authenticated;
grant select on
  public.organizations,
  public.profiles,
  public.workstations,
  public.permissions,
  public.user_permissions
to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on
  public.organizations,
  public.profiles,
  public.workstations,
  public.permissions,
  public.user_permissions,
  public.permission_audit_logs
to service_role;

create policy "authenticated can read own organization"
on public.organizations
for select
to authenticated
using (id = public.current_organization_id());

create policy "authenticated can read own active profile"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  and status = 'active'
  and organization_id = public.current_organization_id()
);

create policy "authenticated can read active workstations in own organization"
on public.workstations
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and status = 'active'
);

create policy "authenticated can read active permission catalog"
on public.permissions
for select
to authenticated
using (
  status = 'active'
  and public.current_organization_id() is not null
);

create policy "authenticated can read own permissions"
on public.user_permissions
for select
to authenticated
using (
  user_id = auth.uid()
  and public.current_organization_id() is not null
);

create or replace function public.replace_user_permissions(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_permission_codes text[],
  p_trace_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_org_id uuid;
  v_target_org_id uuid;
  v_normalized_codes text[] := array[]::text[];
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_valid_count integer := 0;
  v_active_admin_count integer := 0;
begin
  if p_trace_id is null or char_length(btrim(p_trace_id)) = 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select p.organization_id
  into v_actor_org_id
  from public.profiles p
  where p.user_id = p_actor_user_id
    and p.status = 'active'
  for update;

  if v_actor_org_id is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = p_actor_user_id
      and up.permission_code = 'perm.manage_users'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select p.organization_id
  into v_target_org_id
  from public.profiles p
  where p.user_id = p_target_user_id
  for update;

  if v_target_org_id is null or v_target_org_id <> v_actor_org_id then
    raise exception using errcode = 'P0001', message = 'CROSS_TENANT';
  end if;

  perform 1
  from public.profiles p
  where p.organization_id = v_actor_org_id
  for update;

  select coalesce(array_agg(code order by code), array[]::text[])
  into v_normalized_codes
  from (
    select distinct btrim(code) as code
    from unnest(coalesce(p_permission_codes, array[]::text[])) as requested(code)
    where btrim(code) <> ''
  ) normalized;

  select count(*)::integer
  into v_valid_count
  from public.permissions p
  where p.status = 'active'
    and p.code = any (v_normalized_codes);

  if v_valid_count <> cardinality(v_normalized_codes) then
    raise exception using errcode = 'P0001', message = 'INVALID_PERMISSION';
  end if;

  select coalesce(jsonb_agg(up.permission_code order by up.permission_code), '[]'::jsonb)
  into v_before
  from public.user_permissions up
  where up.user_id = p_target_user_id;

  delete from public.user_permissions up
  where up.user_id = p_target_user_id;

  insert into public.user_permissions (user_id, permission_code, granted_by)
  select p_target_user_id, code, p_actor_user_id
  from unnest(v_normalized_codes) as requested(code);

  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  into v_after
  from unnest(v_normalized_codes) as requested(code);

  select count(distinct p.user_id)::integer
  into v_active_admin_count
  from public.profiles p
  join public.user_permissions up on up.user_id = p.user_id
  where p.organization_id = v_actor_org_id
    and p.status = 'active'
    and up.permission_code = 'perm.manage_users';

  if v_active_admin_count = 0 then
    raise exception using errcode = 'P0001', message = 'LAST_ADMIN_REQUIRED';
  end if;

  insert into public.permission_audit_logs (
    organization_id,
    actor_user_id,
    target_user_id,
    action,
    permissions_before,
    permissions_after,
    trace_id
  ) values (
    v_actor_org_id,
    p_actor_user_id,
    p_target_user_id,
    'replace',
    v_before,
    v_after,
    p_trace_id
  );
end;
$$;

create or replace function public.create_profile_with_permissions(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_permission_codes text[],
  p_trace_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_org_id uuid;
begin
  select p.organization_id
  into v_actor_org_id
  from public.profiles p
  where p.user_id = p_actor_user_id
    and p.status = 'active'
  for update;

  if v_actor_org_id is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = p_actor_user_id
      and up.permission_code = 'perm.manage_users'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  insert into public.profiles (user_id, organization_id, display_name, status)
  values (p_user_id, v_actor_org_id, p_display_name, 'active');

  perform public.replace_user_permissions(
    p_actor_user_id,
    p_user_id,
    p_permission_codes,
    p_trace_id
  );
end;
$$;

create or replace function public.update_profile_status(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_display_name text,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_org_id uuid;
  v_target_org_id uuid;
  v_next_status text;
  v_next_display_name text;
  v_active_admin_count integer := 0;
begin
  select p.organization_id
  into v_actor_org_id
  from public.profiles p
  where p.user_id = p_actor_user_id
    and p.status = 'active'
  for update;

  if v_actor_org_id is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = p_actor_user_id
      and up.permission_code = 'perm.manage_users'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select p.organization_id,
         coalesce(p_status, p.status),
         coalesce(p_display_name, p.display_name)
  into v_target_org_id, v_next_status, v_next_display_name
  from public.profiles p
  where p.user_id = p_target_user_id
  for update;

  if v_target_org_id is null or v_target_org_id <> v_actor_org_id then
    raise exception using errcode = 'P0001', message = 'CROSS_TENANT';
  end if;

  if v_next_status not in ('active', 'inactive')
    or char_length(btrim(v_next_display_name)) not between 1 and 100 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform 1
  from public.profiles p
  where p.organization_id = v_actor_org_id
  for update;

  update public.profiles
  set display_name = v_next_display_name,
      status = v_next_status
  where user_id = p_target_user_id;

  select count(distinct p.user_id)::integer
  into v_active_admin_count
  from public.profiles p
  join public.user_permissions up on up.user_id = p.user_id
  where p.organization_id = v_actor_org_id
    and p.status = 'active'
    and up.permission_code = 'perm.manage_users';

  if v_active_admin_count = 0 then
    raise exception using errcode = 'P0001', message = 'LAST_ADMIN_REQUIRED';
  end if;
end;
$$;

revoke all on function public.replace_user_permissions(uuid, uuid, text[], text) from public, anon, authenticated;
revoke all on function public.create_profile_with_permissions(uuid, uuid, text, text[], text) from public, anon, authenticated;
revoke all on function public.update_profile_status(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.replace_user_permissions(uuid, uuid, text[], text) to service_role;
grant execute on function public.create_profile_with_permissions(uuid, uuid, text, text[], text) to service_role;
grant execute on function public.update_profile_status(uuid, uuid, text, text) to service_role;
