alter table public.profiles
  add column if not exists username text,
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_check
      check (username is null or char_length(btrim(username)) between 1 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_check
      check (phone is null or char_length(btrim(phone)) between 8 and 20);
  end if;
end;
$$;

create unique index if not exists profiles_org_username_key
  on public.profiles (organization_id, lower(username))
  where username is not null;
