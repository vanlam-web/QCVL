create table public.account_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  device_key text not null,
  device_name text not null,
  device_type text not null default 'unknown',
  browser_name text,
  os_name text,
  ip_address text,
  status text not null default 'active',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_devices_device_type_check check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  constraint account_devices_status_check check (status in ('active', 'signed_out')),
  constraint account_devices_device_name_check check (char_length(btrim(device_name)) between 1 and 120),
  constraint account_devices_device_key_check check (char_length(btrim(device_key)) between 16 and 128),
  constraint account_devices_unique_user_device unique (user_id, device_key)
);

create index idx_account_devices_user_last_seen on public.account_devices (user_id, last_seen_at desc);

create trigger set_account_devices_updated_at
before update on public.account_devices
for each row execute function public.set_updated_at();

alter table public.account_devices enable row level security;

grant select, insert, update on public.account_devices to service_role;
