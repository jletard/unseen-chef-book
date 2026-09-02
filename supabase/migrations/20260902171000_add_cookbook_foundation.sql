-- Additive cookbook foundation.
-- This migration intentionally does not backfill, rename, merge, or delete
-- any existing cookbook or ordering data.

create extension if not exists pgcrypto;

create or replace function public.cookbook_normalize_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(trim(value), '\s+', ' ', 'g'));
$$;

create table if not exists public.cookbook_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'recipe_editor', 'read_only_cook')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

alter table public.cookbook_user_roles enable row level security;

create or replace function public.has_cookbook_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cookbook_user_roles r
    where r.user_id = auth.uid()
      and r.role = any(required_roles)
  );
$$;

revoke all on function public.has_cookbook_role(text[]) from public;
grant execute on function public.has_cookbook_role(text[]) to authenticated;

drop policy if exists cookbook_roles_read_self_or_owner on public.cookbook_user_roles;
create policy cookbook_roles_read_self_or_owner
on public.cookbook_user_roles for select to authenticated
using (
  user_id = auth.uid()
  or public.has_cookbook_role(array['owner'])
);

drop policy if exists cookbook_roles_owner_manage on public.cookbook_user_roles;
create policy cookbook_roles_owner_manage
on public.cookbook_user_roles for all to authenticated
using (public.has_cookbook_role(array['owner']))
with check (public.has_cookbook_role(array['owner']));

alter table public.ingredients
  add column if not exists canonical_name text,
  add column if not exists normalized_name text,
  add column if not exists ingredient_family_id uuid,
  add column if not exists purchase_specification text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists retired_at timestamptz;

create index if not exists ingredients_normalized_name_idx
  on public.ingredients (normalized_name)
  where retired_at is null;

create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  alias text not null check (length(trim(alias)) > 0),
  normalized_alias text not null,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (normalized_alias)
);

alter table public.recipes
  add column if not exists normalized_name text,
  add column if not exists lifecycle_state text not null default 'active',
  add column if not exists current_approved_version_id uuid,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists retired_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.recipes'::regclass
      and conname = 'recipes_lifecycle_state_check'
  ) then
    alter table public.recipes add constraint recipes_lifecycle_state_check
      check (lifecycle_state in ('active', 'retired')) not valid;
  end if;
end $$;

create index if not exists recipes_normalized_name_idx
  on public.recipes (normalized_name)
  where retired_at is null;

create table if not exists public.recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete restrict,
  revises_version_id uuid,
  draft_state text not null default 'editing'
    check (draft_state in ('editing', 'ready_for_review', 'blocked', 'failed', 'archived')),
  review_bucket text not null default 'unreviewed'
    check (review_bucket in ('unreviewed', 'needs_classification', 'minor', 'major', 'ready')),
  source_type text not null default 'manual',
  source_summary text,
  source_payload jsonb,
  draft_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_payload) = 'object'),
  validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  generation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_metadata) = 'object'),
  revision_number integer not null default 1 check (revision_number > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_drafts_review_queue_idx
  on public.recipe_drafts (draft_state, review_bucket, updated_at desc);
create index if not exists recipe_drafts_recipe_id_idx
  on public.recipe_drafts (recipe_id);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  state text not null default 'approved' check (state in ('approved', 'retired')),
  source_draft_id uuid references public.recipe_drafts(id) on delete restrict,
  supersedes_version_id uuid references public.recipe_versions(id) on delete restrict,
  yield_kind text not null check (yield_kind in ('servings', 'liquid', 'solid', 'countable')),
  base_yield numeric not null check (base_yield > 0),
  yield_unit text not null check (yield_unit in ('serving', 'each', 'fl_oz', 'cup', 'quart', 'g', 'kg')),
  minimum_batch_quantity numeric not null check (minimum_batch_quantity > 0),
  minimum_batch_unit text not null,
  portion_quantity numeric check (portion_quantity is null or portion_quantity > 0),
  portion_unit text,
  active_time_minutes integer check (active_time_minutes is null or active_time_minutes >= 0),
  passive_time_minutes integer check (passive_time_minutes is null or passive_time_minutes >= 0),
  total_time_minutes integer check (total_time_minutes is null or total_time_minutes >= 0),
  chef_notes text,
  production_notes text,
  source_type text not null default 'migration',
  source_summary text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (recipe_id, version_number),
  unique (recipe_id, content_hash)
);

alter table public.recipe_drafts
  drop constraint if exists recipe_drafts_revises_version_id_fkey;
alter table public.recipe_drafts
  add constraint recipe_drafts_revises_version_id_fkey
  foreign key (revises_version_id) references public.recipe_versions(id) on delete restrict;

alter table public.recipes
  drop constraint if exists recipes_current_approved_version_id_fkey;
alter table public.recipes
  add constraint recipes_current_approved_version_id_fkey
  foreign key (current_approved_version_id) references public.recipe_versions(id) on delete restrict;

create table if not exists public.recipe_version_items (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  item_kind text not null check (item_kind in ('ingredient', 'recipe')),
  ingredient_id uuid references public.ingredients(id) on delete restrict,
  dependency_recipe_version_id uuid references public.recipe_versions(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  preparation_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (item_kind = 'ingredient' and ingredient_id is not null and dependency_recipe_version_id is null)
    or
    (item_kind = 'recipe' and ingredient_id is null and dependency_recipe_version_id is not null)
  )
);

create index if not exists recipe_version_items_version_idx
  on public.recipe_version_items (recipe_version_id, sort_order, id);
create index if not exists recipe_version_items_dependency_idx
  on public.recipe_version_items (dependency_recipe_version_id)
  where dependency_recipe_version_id is not null;

create table if not exists public.recipe_version_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  step_number integer not null check (step_number > 0),
  instruction text not null check (length(trim(instruction)) > 0),
  temperature_value numeric,
  temperature_unit text check (temperature_unit is null or temperature_unit in ('F', 'C')),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  is_advance_prep boolean not null default false,
  prep_day_offset integer,
  station text,
  created_at timestamptz not null default now(),
  unique (recipe_version_id, step_number)
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_version_equipment (
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  quantity numeric check (quantity is null or quantity > 0),
  note text,
  sort_order integer not null default 0,
  primary key (recipe_version_id, equipment_id)
);

create table if not exists public.entity_match_decisions (
  id uuid primary key default gen_random_uuid(),
  left_entity_type text not null,
  left_entity_id text not null,
  right_entity_type text not null,
  right_entity_id text not null,
  decision text not null check (decision in ('same', 'alias', 'related', 'distinct', 'ingredient_to_recipe')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  notes text,
  check ((left_entity_type, left_entity_id) < (right_entity_type, right_entity_id)),
  unique (left_entity_type, left_entity_id, right_entity_type, right_entity_id)
);

create table if not exists public.production_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  kind text not null check (kind in ('menu_item', 'side', 'bulk_protein', 'bulk_side', 'component', 'other')),
  active boolean not null default true,
  recipe_requirement text not null default 'required'
    check (recipe_requirement in ('required', 'optional', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz
);

create index if not exists production_items_normalized_name_idx
  on public.production_items (normalized_name);

create table if not exists public.production_item_sources (
  id uuid primary key default gen_random_uuid(),
  production_item_id uuid not null references public.production_items(id) on delete restrict,
  source_type text not null check (source_type in (
    'menu_item', 'side_item', 'embedded_side', 'bulk_item',
    'historical_order_name', 'historical_side_name', 'bulk_snapshot', 'manual'
  )),
  source_id text,
  source_name_snapshot text not null,
  normalized_source_name text not null,
  mapping_state text not null default 'proposed'
    check (mapping_state in ('confirmed', 'proposed', 'rejected')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists production_item_sources_stable_source_uidx
  on public.production_item_sources (source_type, source_id)
  where source_id is not null and mapping_state <> 'rejected';
create index if not exists production_item_sources_normalized_idx
  on public.production_item_sources (normalized_source_name, source_type);

create table if not exists public.production_item_recipe_links (
  id uuid primary key default gen_random_uuid(),
  production_item_id uuid not null references public.production_items(id) on delete restrict,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  role text not null check (role in ('main', 'accompaniment', 'garnish', 'other')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (production_item_id, recipe_id, role)
);

create table if not exists public.recipe_intake_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  requested_count integer not null check (requested_count > 0),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'ready', 'partially_failed', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_intake_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.recipe_intake_batches(id) on delete restrict,
  production_item_id uuid references public.production_items(id) on delete restrict,
  recipe_id uuid references public.recipes(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in (
    'queued', 'generating', 'matching', 'ready', 'needs_input', 'failed', 'cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  input_payload jsonb not null default '{}'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  draft_id uuid references public.recipe_drafts(id) on delete restrict,
  last_error text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_intake_jobs_claim_idx
  on public.recipe_intake_jobs (status, lease_expires_at, created_at);

create table if not exists public.reconciliation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in (
    'missing_recipe', 'ingredient_match', 'recipe_match', 'source_mapping',
    'dependency_blocker', 'cycle', 'invalid_unit', 'other'
  )),
  subject_type text not null,
  subject_id text not null,
  status text not null default 'open' check (status in ('open', 'deferred', 'resolved', 'dismissed')),
  priority integer not null default 100,
  candidate_payload jsonb not null default '{}'::jsonb,
  resolution_payload jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reconciliation_tasks_open_subject_uidx
  on public.reconciliation_tasks (task_type, subject_type, subject_id)
  where status in ('open', 'deferred');
create index if not exists reconciliation_tasks_queue_idx
  on public.reconciliation_tasks (status, priority, created_at);

create table if not exists public.cookbook_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  request_id text,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cookbook_audit_events_subject_idx
  on public.cookbook_audit_events (subject_type, subject_id, created_at desc);

create or replace function public.prevent_approved_recipe_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Approved recipe versions are immutable';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recipe_versions',
    'recipe_version_items',
    'recipe_version_steps',
    'recipe_version_equipment'
  ]
  loop
    execute format('drop trigger if exists prevent_approved_mutation on public.%I', table_name);
    execute format(
      'create trigger prevent_approved_mutation before update or delete on public.%I '
      'for each row execute function public.prevent_approved_recipe_version_mutation()',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ingredient_aliases', 'recipe_drafts', 'equipment',
    'entity_match_decisions', 'production_items',
    'production_item_sources', 'production_item_recipe_links',
    'recipe_intake_batches', 'recipe_intake_jobs', 'reconciliation_tasks',
    'cookbook_audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists cookbook_read on public.%I', table_name);
    execute format(
      'create policy cookbook_read on public.%I for select to authenticated '
      'using (public.has_cookbook_role(array[''owner'', ''recipe_editor'', ''read_only_cook'']))',
      table_name
    );
    execute format('drop policy if exists cookbook_edit on public.%I', table_name);
    execute format(
      'create policy cookbook_edit on public.%I for all to authenticated '
      'using (public.has_cookbook_role(array[''owner'', ''recipe_editor''])) '
      'with check (public.has_cookbook_role(array[''owner'', ''recipe_editor'']))',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recipe_versions', 'recipe_version_items',
    'recipe_version_steps', 'recipe_version_equipment'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists cookbook_read on public.%I', table_name);
    execute format(
      'create policy cookbook_read on public.%I for select to authenticated '
      'using (public.has_cookbook_role(array[''owner'', ''recipe_editor'', ''read_only_cook'']))',
      table_name
    );
    execute format('drop policy if exists cookbook_owner_write on public.%I', table_name);
    execute format(
      'create policy cookbook_owner_write on public.%I for all to authenticated '
      'using (public.has_cookbook_role(array[''owner''])) '
      'with check (public.has_cookbook_role(array[''owner'']))',
      table_name
    );
  end loop;
end $$;

-- Audit rows may be read by cookbook users and appended by editors, but never
-- changed or deleted through an ordinary authenticated session.
drop policy if exists cookbook_edit on public.cookbook_audit_events;
drop policy if exists cookbook_audit_append on public.cookbook_audit_events;
create policy cookbook_audit_append
on public.cookbook_audit_events for insert to authenticated
with check (public.has_cookbook_role(array['owner', 'recipe_editor']));

-- Approval, role assignment, merges, and version retirement remain owner-only
-- server operations. Draft editing is available to recipe editors; approved
-- snapshot tables are owner-write and protected by immutable-table triggers.
