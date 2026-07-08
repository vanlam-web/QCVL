create table public.production_machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active',
  default_product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_machines_org_code_key unique (organization_id, code),
  constraint production_machines_id_org_key unique (id, organization_id),
  constraint production_machines_code_check check (code = upper(code) and code ~ '^[A-Z0-9-]+$'),
  constraint production_machines_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint production_machines_status_check check (status in ('active', 'inactive')),
  constraint production_machines_default_product_org_fkey foreign key (default_product_id, organization_id)
    references public.products(id, organization_id) on delete restrict
);

create index idx_production_machines_org_status
  on public.production_machines (organization_id, status, code);

create table public.production_queue_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  production_machine_id uuid not null,
  source text not null,
  raw_file_name text not null,
  received_at timestamptz not null default now(),
  status text not null default 'queued',
  parse_status text not null default 'pending',
  parse_error text,
  parsed_payload jsonb not null default '{}'::jsonb,
  claimed_by uuid references public.profiles(user_id) on delete restrict,
  claimed_at timestamptz,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_queue_items_id_org_key unique (id, organization_id),
  constraint production_queue_items_machine_org_fkey foreign key (production_machine_id, organization_id)
    references public.production_machines(id, organization_id) on delete restrict,
  constraint production_queue_items_source_check check (source in ('legacy_bridge', 'production_agent', 'manual_simulator')),
  constraint production_queue_items_status_check check (status in ('queued', 'added_to_draft', 'dismissed')),
  constraint production_queue_items_parse_status_check check (parse_status in ('pending', 'ok', 'error')),
  constraint production_queue_items_raw_name_check check (char_length(btrim(raw_file_name)) between 1 and 255),
  constraint production_queue_items_payload_object_check check (jsonb_typeof(parsed_payload) = 'object'),
  constraint production_queue_items_claim_state_check check (
    (status = 'queued' and claimed_by is null and claimed_at is null and handled_at is null)
    or (status in ('added_to_draft', 'dismissed') and claimed_by is not null and claimed_at is not null and handled_at is not null)
  )
);

create index idx_production_queue_items_org_status_received
  on public.production_queue_items (organization_id, status, received_at desc);
create index idx_production_queue_items_machine_status
  on public.production_queue_items (organization_id, production_machine_id, status, received_at desc);

create table public.production_queue_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  queue_item_id uuid not null,
  event_type text not null,
  actor_user_id uuid references public.profiles(user_id) on delete restrict,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint production_queue_events_item_org_fkey foreign key (queue_item_id, organization_id)
    references public.production_queue_items(id, organization_id) on delete cascade,
  constraint production_queue_events_type_check check (event_type in ('queued', 'added_to_draft', 'dismissed', 'restored')),
  constraint production_queue_events_payload_object_check check (jsonb_typeof(event_payload) = 'object')
);

create index idx_production_queue_events_item_time
  on public.production_queue_events (organization_id, queue_item_id, created_at desc);
create index idx_production_queue_events_org_time
  on public.production_queue_events (organization_id, created_at desc);

create or replace function public.claim_production_queue_item_tx(
  p_organization_id uuid,
  p_queue_item_id uuid,
  p_actor_user_id uuid,
  p_target_status text
)
returns table (
  id uuid,
  organization_id uuid,
  production_machine_id uuid,
  source text,
  raw_file_name text,
  received_at timestamptz,
  status text,
  parse_status text,
  parse_error text,
  parsed_payload jsonb,
  claimed_by uuid,
  claimed_at timestamptz,
  handled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_status not in ('added_to_draft', 'dismissed') then
    raise exception 'Invalid target status'
      using errcode = '22023';
  end if;

  return query
  with updated as (
    update public.production_queue_items pqi
    set status = p_target_status,
        claimed_by = p_actor_user_id,
        claimed_at = now(),
        handled_at = now(),
        updated_at = now()
    where pqi.organization_id = p_organization_id
      and pqi.id = p_queue_item_id
      and pqi.status = 'queued'
    returning pqi.*
  ),
  event_insert as (
    insert into public.production_queue_events (
      organization_id,
      queue_item_id,
      event_type,
      actor_user_id
    )
    select updated.organization_id, updated.id, p_target_status, p_actor_user_id
    from updated
    returning 1
  )
  select
    updated.id,
    updated.organization_id,
    updated.production_machine_id,
    updated.source,
    updated.raw_file_name,
    updated.received_at,
    updated.status,
    updated.parse_status,
    updated.parse_error,
    updated.parsed_payload,
    updated.claimed_by,
    updated.claimed_at,
    updated.handled_at
  from updated;
end;
$$;

create or replace function public.restore_production_queue_item_tx(
  p_organization_id uuid,
  p_queue_item_id uuid,
  p_actor_user_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  production_machine_id uuid,
  source text,
  raw_file_name text,
  received_at timestamptz,
  status text,
  parse_status text,
  parse_error text,
  parsed_payload jsonb,
  claimed_by uuid,
  claimed_at timestamptz,
  handled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with updated as (
    update public.production_queue_items pqi
    set status = 'queued',
        claimed_by = null,
        claimed_at = null,
        handled_at = null,
        updated_at = now()
    where pqi.organization_id = p_organization_id
      and pqi.id = p_queue_item_id
      and pqi.status in ('added_to_draft', 'dismissed')
    returning pqi.*
  ),
  event_insert as (
    insert into public.production_queue_events (
      organization_id,
      queue_item_id,
      event_type,
      actor_user_id
    )
    select updated.organization_id, updated.id, 'restored', p_actor_user_id
    from updated
    returning 1
  )
  select
    updated.id,
    updated.organization_id,
    updated.production_machine_id,
    updated.source,
    updated.raw_file_name,
    updated.received_at,
    updated.status,
    updated.parse_status,
    updated.parse_error,
    updated.parsed_payload,
    updated.claimed_by,
    updated.claimed_at,
    updated.handled_at
  from updated;
end;
$$;

create trigger set_production_machines_updated_at
before update on public.production_machines
for each row execute function public.set_updated_at();

create trigger set_production_queue_items_updated_at
before update on public.production_queue_items
for each row execute function public.set_updated_at();

alter table public.production_machines enable row level security;
alter table public.production_queue_items enable row level security;
alter table public.production_queue_events enable row level security;

grant select, insert, update, delete on
  public.production_machines,
  public.production_queue_items,
  public.production_queue_events
to service_role;

grant execute on function public.claim_production_queue_item_tx(uuid, uuid, uuid, text) to service_role;
grant execute on function public.restore_production_queue_item_tx(uuid, uuid, uuid) to service_role;
