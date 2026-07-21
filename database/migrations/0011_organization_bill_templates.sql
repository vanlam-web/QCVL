alter table organizations add column if not exists bill_templates jsonb;

update organizations
set bill_templates = coalesce(bill_templates, '[]'::jsonb)
where bill_templates is null;

alter table organizations
  alter column bill_templates set default '[]'::jsonb;

alter table organizations
  alter column bill_templates set not null;
