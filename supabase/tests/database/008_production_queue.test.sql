begin;

select plan(34);

select has_table('public', 'production_machines', 'production_machines');
select has_column('public', 'production_machines', 'organization_id', 'production_machines.organization_id');
select has_column('public', 'production_machines', 'code', 'production_machines.code');
select has_column('public', 'production_machines', 'name', 'production_machines.name');
select has_column('public', 'production_machines', 'status', 'production_machines.status');
select has_column('public', 'production_machines', 'default_product_id', 'production_machines.default_product_id');
select has_index('public', 'production_machines', 'production_machines_org_code_key', 'production_machines org/code unique');

select has_table('public', 'production_queue_items', 'production_queue_items');
select has_column('public', 'production_queue_items', 'organization_id', 'production_queue_items.organization_id');
select has_column('public', 'production_queue_items', 'production_machine_id', 'production_queue_items.production_machine_id');
select has_column('public', 'production_queue_items', 'source', 'production_queue_items.source');
select has_column('public', 'production_queue_items', 'raw_file_name', 'production_queue_items.raw_file_name');
select has_column('public', 'production_queue_items', 'status', 'production_queue_items.status');
select has_column('public', 'production_queue_items', 'parse_status', 'production_queue_items.parse_status');
select has_column('public', 'production_queue_items', 'parsed_payload', 'production_queue_items.parsed_payload');
select has_column('public', 'production_queue_items', 'claimed_by', 'production_queue_items.claimed_by');
select has_column('public', 'production_queue_items', 'claimed_at', 'production_queue_items.claimed_at');
select has_column('public', 'production_queue_items', 'handled_at', 'production_queue_items.handled_at');
select has_index('public', 'production_queue_items', 'idx_production_queue_items_org_status_received', 'queue status index');
select has_index('public', 'production_queue_items', 'idx_production_queue_items_machine_status', 'queue machine/status index');

select has_table('public', 'production_queue_events', 'production_queue_events');
select has_column('public', 'production_queue_events', 'organization_id', 'production_queue_events.organization_id');
select has_column('public', 'production_queue_events', 'queue_item_id', 'production_queue_events.queue_item_id');
select has_column('public', 'production_queue_events', 'event_type', 'production_queue_events.event_type');
select has_column('public', 'production_queue_events', 'actor_user_id', 'production_queue_events.actor_user_id');
select has_column('public', 'production_queue_events', 'created_at', 'production_queue_events.created_at');
select has_index('public', 'production_queue_events', 'idx_production_queue_events_item_time', 'queue event history index');

select has_function('public', 'claim_production_queue_item_tx', array['uuid', 'uuid', 'uuid', 'text'], 'claim function exists');
select has_function('public', 'restore_production_queue_item_tx', array['uuid', 'uuid', 'uuid'], 'restore function exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('80000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'operator@example.test', 'test', now(), now(), now());

insert into public.profiles (user_id, organization_id, display_name, status)
values (
  '80000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Operator',
  'active'
);

insert into public.production_machines (id, organization_id, code, name, status, default_product_id)
values (
  '80000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'TEST-BAT',
  'Máy test bạt',
  'active',
  '00000000-0000-4000-8000-000000000302'
);

insert into public.production_queue_items (
  id,
  organization_id,
  production_machine_id,
  source,
  raw_file_name,
  status,
  parse_status,
  parsed_payload
)
values (
  '80000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000101',
  'manual_simulator',
  'KH000001_DECAL-PP_120x50_x2',
  'queued',
  'ok',
  '{"customer_code":"KH000001","product_code":"DECAL-PP","width_cm":120,"height_cm":50,"quantity":2}'::jsonb
);

select results_eq(
  $$
    select status
    from public.claim_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001',
      'added_to_draft'
    )
  $$,
  $$ values ('added_to_draft'::text) $$,
  'claim moves queued item to added_to_draft'
);

select is(
  (
    select count(*)::integer
    from public.claim_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001',
      'dismissed'
    )
  ),
  0,
  'second claim returns no row'
);

select is(
  (
    select count(*)::integer
    from public.production_queue_events
    where queue_item_id = '80000000-0000-4000-8000-000000000201'
      and event_type = 'added_to_draft'
  ),
  1,
  'claim writes history event'
);

select results_eq(
  $$
    select status
    from public.restore_production_queue_item_tx(
      '00000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000201',
      '80000000-0000-4000-8000-000000000001'
    )
  $$,
  $$ values ('queued'::text) $$,
  'restore returns item to queued'
);

select is(
  (
    select count(*)::integer
    from public.production_queue_events
    where queue_item_id = '80000000-0000-4000-8000-000000000201'
      and event_type = 'restored'
  ),
  1,
  'restore writes history event'
);

select * from finish();
rollback;
