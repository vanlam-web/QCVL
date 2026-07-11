alter table users add column if not exists username text;
alter table users add column if not exists phone text;
alter table users add column if not exists birthday date;
alter table users add column if not exists region text;
alter table users add column if not exists ward text;
alter table users add column if not exists address text;
alter table users add column if not exists note text;

create unique index if not exists users_org_username_uidx
  on users (organization_id, lower(username))
  where username is not null and btrim(username) <> '';

create index if not exists users_org_created_idx
  on users (organization_id, created_at desc);
