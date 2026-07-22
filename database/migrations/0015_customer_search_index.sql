create table if not exists customer_search_index (
  customer_id text primary key references customer_snapshots(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'active',
  normalized_code text not null default '',
  normalized_name text not null default '',
  normalized_haystack text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists customer_search_index_org_status_code_idx
  on customer_search_index (organization_id, status, normalized_code);

create index if not exists customer_search_index_org_status_name_idx
  on customer_search_index (organization_id, status, normalized_name);

create index if not exists customer_search_index_org_status_updated_idx
  on customer_search_index (organization_id, status, updated_at desc);

insert into customer_search_index (
  customer_id,
  organization_id,
  status,
  normalized_code,
  normalized_name,
  normalized_haystack,
  updated_at
)
select
  cs.id,
  cs.organization_id,
  coalesce(nullif(cs.data->>'status', ''), 'active'),
  translate(lower(coalesce(cs.data->>'code', '')), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),
  translate(lower(coalesce(cs.data->>'name', '')), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),
  translate(lower(coalesce(concat_ws(' ', cs.data->>'code', cs.data->>'name', cs.data->>'phone', cs.data->>'tax_code', cs.data->>'address', cs.data->>'note'), '')), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),
  now()
from customer_snapshots cs
on conflict (customer_id)
do update set
  organization_id = excluded.organization_id,
  status = excluded.status,
  normalized_code = excluded.normalized_code,
  normalized_name = excluded.normalized_name,
  normalized_haystack = excluded.normalized_haystack,
  updated_at = now();
