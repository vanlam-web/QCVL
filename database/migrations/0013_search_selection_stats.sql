create table if not exists search_selection_stats (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'supplier', 'product')),
  entity_id text not null,
  select_count integer not null default 0 check (select_count >= 0),
  last_selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, entity_type, entity_id)
);

create index if not exists search_selection_stats_rank_idx
  on search_selection_stats (organization_id, user_id, entity_type, select_count desc, last_selected_at desc);
