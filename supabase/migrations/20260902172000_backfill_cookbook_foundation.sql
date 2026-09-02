-- Deterministic, additive backfill from the verified September 2, 2026 data.
-- Existing IDs and legacy formula rows remain unchanged.

create or replace function public.cookbook_deterministic_uuid(namespace text, value text)
returns uuid
language sql
immutable
parallel safe
set search_path = ''
as $$
  with hashed as (
    select md5(namespace || ':' || value) as h
  )
  select (
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-' ||
    '5' || substr(h, 14, 3) || '-' ||
    'a' || substr(h, 18, 3) || '-' ||
    substr(h, 21, 12)
  )::uuid
  from hashed;
$$;

update public.ingredients
set
  canonical_name = coalesce(canonical_name, name),
  normalized_name = coalesce(normalized_name, public.cookbook_normalize_name(name))
where canonical_name is null or normalized_name is null;

update public.recipes
set
  normalized_name = coalesce(normalized_name, public.cookbook_normalize_name(name)),
  lifecycle_state = case when status = 'inactive' then 'retired' else 'active' end,
  retired_at = case
    when status = 'inactive' then coalesce(retired_at, updated_at, now())
    else retired_at
  end
where normalized_name is null
   or lifecycle_state is distinct from case when status = 'inactive' then 'retired' else 'active' end;

-- Preserve every currently complete formula as immutable version 1.
insert into public.recipe_versions (
  id,
  recipe_id,
  version_number,
  state,
  yield_kind,
  base_yield,
  yield_unit,
  minimum_batch_quantity,
  minimum_batch_unit,
  chef_notes,
  source_type,
  source_summary,
  approved_at,
  content_hash
)
select
  public.cookbook_deterministic_uuid('recipe-version-v1', r.id::text),
  r.id,
  1,
  'approved',
  r.yield_kind,
  r.base_yield,
  r.yield_unit,
  r.minimum_batch,
  r.yield_unit,
  r.notes,
  'legacy_backfill',
  'Immutable snapshot of the verified legacy complete recipe',
  coalesce(r.updated_at, r.created_at, now()),
  encode(digest(convert_to((
    jsonb_build_object(
      'recipe', jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'recipe_type', r.recipe_type,
        'yield_kind', r.yield_kind,
        'base_yield', r.base_yield,
        'yield_unit', r.yield_unit,
        'minimum_batch', r.minimum_batch,
        'notes', r.notes
      ),
      'items', coalesce((
        select jsonb_agg(to_jsonb(i) - 'created_at' - 'updated_at' order by i.sort_order, i.id)
        from public.recipe_items i
        where i.recipe_id = r.id
      ), '[]'::jsonb),
      'steps', coalesce((
        select jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by s.step_number, s.id)
        from public.recipe_steps s
        where s.recipe_id = r.id
      ), '[]'::jsonb)
    )
  )::text, 'UTF8'), 'sha256'), 'hex')
from public.recipes r
where r.status = 'complete'
on conflict (recipe_id, version_number) do nothing;

insert into public.recipe_version_items (
  id,
  recipe_version_id,
  item_kind,
  ingredient_id,
  dependency_recipe_version_id,
  quantity,
  unit,
  preparation_note,
  sort_order,
  created_at
)
select
  public.cookbook_deterministic_uuid('recipe-version-item-v1', i.id::text),
  public.cookbook_deterministic_uuid('recipe-version-v1', i.recipe_id::text),
  case when i.item_type = 'component' then 'recipe' else 'ingredient' end,
  case when i.item_type = 'ingredient' then i.ingredient_id end,
  case
    when i.item_type = 'component'
      then public.cookbook_deterministic_uuid('recipe-version-v1', i.component_recipe_id::text)
  end,
  i.quantity,
  i.unit,
  i.preparation_note,
  i.sort_order,
  i.created_at
from public.recipe_items i
join public.recipes r on r.id = i.recipe_id and r.status = 'complete'
left join public.recipes dependency
  on dependency.id = i.component_recipe_id
where i.item_type = 'ingredient'
   or dependency.status = 'complete'
on conflict (id) do nothing;

insert into public.recipe_version_steps (
  id,
  recipe_version_id,
  step_number,
  instruction,
  created_at
)
select
  public.cookbook_deterministic_uuid('recipe-version-step-v1', s.id::text),
  public.cookbook_deterministic_uuid('recipe-version-v1', s.recipe_id::text),
  s.step_number,
  s.instruction,
  s.created_at
from public.recipe_steps s
join public.recipes r on r.id = s.recipe_id and r.status = 'complete'
on conflict (id) do nothing;

update public.recipes r
set current_approved_version_id = public.cookbook_deterministic_uuid('recipe-version-v1', r.id::text)
where r.status = 'complete'
  and r.current_approved_version_id is null;

-- Preserve every mutable legacy draft as one aggregate draft workspace.
insert into public.recipe_drafts (
  id,
  recipe_id,
  draft_state,
  review_bucket,
  source_type,
  source_summary,
  draft_payload,
  revision_number,
  created_at,
  updated_at
)
select
  public.cookbook_deterministic_uuid('legacy-recipe-draft', r.id::text),
  r.id,
  'editing',
  'unreviewed',
  'legacy_backfill',
  'Mutable workspace copied from the legacy draft recipe',
  jsonb_build_object(
    'name', r.name,
    'recipe_type', r.recipe_type,
    'yield_kind', r.yield_kind,
    'base_yield', r.base_yield,
    'yield_unit', r.yield_unit,
    'minimum_batch', r.minimum_batch,
    'notes', r.notes,
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) - 'created_at' - 'updated_at' order by i.sort_order, i.id)
      from public.recipe_items i
      where i.recipe_id = r.id
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by s.step_number, s.id)
      from public.recipe_steps s
      where s.recipe_id = r.id
    ), '[]'::jsonb)
  ),
  1,
  r.created_at,
  r.updated_at
from public.recipes r
where r.status = 'draft'
on conflict (id) do nothing;

-- One production identity per stable menu, side, and bulk catalog ID. Names
-- remain independent even when normalized text happens to match.
insert into public.production_items (id, name, normalized_name, kind, active, recipe_requirement)
select
  public.cookbook_deterministic_uuid('production-item-menu', m.id::text),
  m.name,
  public.cookbook_normalize_name(m.name),
  'menu_item',
  coalesce(m.active, true),
  'required'
from public.menu_items_v2 m
on conflict (id) do nothing;

insert into public.production_items (id, name, normalized_name, kind, active, recipe_requirement)
select
  public.cookbook_deterministic_uuid('production-item-side', s.id::text),
  s.name,
  public.cookbook_normalize_name(s.name),
  'side',
  s.active,
  'required'
from public.side_items s
on conflict (id) do nothing;

insert into public.production_items (id, name, normalized_name, kind, active, recipe_requirement)
select
  public.cookbook_deterministic_uuid('production-item-bulk', b.id::text),
  b.name,
  public.cookbook_normalize_name(b.name),
  case when b.category = 'protein' then 'bulk_protein' else 'bulk_side' end,
  b.is_active,
  'required'
from public.bulk_items b
on conflict (id) do nothing;

insert into public.production_item_sources (
  id, production_item_id, source_type, source_id,
  source_name_snapshot, normalized_source_name,
  mapping_state, confirmed_at
)
select
  public.cookbook_deterministic_uuid('production-source-menu', m.id::text),
  public.cookbook_deterministic_uuid('production-item-menu', m.id::text),
  'menu_item',
  m.id::text,
  m.name,
  public.cookbook_normalize_name(m.name),
  'confirmed',
  now()
from public.menu_items_v2 m
on conflict (id) do nothing;

insert into public.production_item_sources (
  id, production_item_id, source_type, source_id,
  source_name_snapshot, normalized_source_name,
  mapping_state, confirmed_at
)
select
  public.cookbook_deterministic_uuid('production-source-side', s.id::text),
  public.cookbook_deterministic_uuid('production-item-side', s.id::text),
  'side_item',
  s.id::text,
  s.name,
  public.cookbook_normalize_name(s.name),
  'confirmed',
  now()
from public.side_items s
on conflict (id) do nothing;

insert into public.production_item_sources (
  id, production_item_id, source_type, source_id,
  source_name_snapshot, normalized_source_name,
  mapping_state, confirmed_at
)
select
  public.cookbook_deterministic_uuid('production-source-bulk', b.id::text),
  public.cookbook_deterministic_uuid('production-item-bulk', b.id::text),
  'bulk_item',
  b.id::text,
  b.name,
  public.cookbook_normalize_name(b.name),
  'confirmed',
  now()
from public.bulk_items b
on conflict (id) do nothing;

-- Preserve the ten verified menu-to-recipe links in the new inventory model.
insert into public.production_item_recipe_links (
  id, production_item_id, recipe_id, role, sort_order, active
)
select
  public.cookbook_deterministic_uuid('production-recipe-link', l.id::text),
  public.cookbook_deterministic_uuid('production-item-menu', l.menu_item_id::text),
  l.recipe_id,
  case
    when l.role = 'component' then 'accompaniment'
    when l.role = 'garnish' then 'garnish'
    else 'main'
  end,
  l.sort_order,
  true
from public.menu_item_recipe_links l
on conflict (id) do nothing;

-- Exact normalized embedded-side matches may point to an existing stable side.
-- Unmatched Basmati Rice and Garlic Roasted Broccoli remain explicit tasks.
with embedded_sides as (
  select distinct trim(side_name) as name,
    public.cookbook_normalize_name(side_name) as normalized_name
  from public.menu_items_v2 m
  cross join lateral unnest(coalesce(m.sides, '{}'::text[])) side_name
  where nullif(trim(side_name), '') is not null
),
exact_matches as (
  select e.*, s.id as side_id
  from embedded_sides e
  join public.side_items s
    on public.cookbook_normalize_name(s.name) = e.normalized_name
)
insert into public.production_item_sources (
  id, production_item_id, source_type, source_id,
  source_name_snapshot, normalized_source_name,
  mapping_state, confirmed_at
)
select
  public.cookbook_deterministic_uuid('production-source-embedded-side', e.normalized_name),
  public.cookbook_deterministic_uuid('production-item-side', e.side_id::text),
  'embedded_side',
  e.normalized_name,
  e.name,
  e.normalized_name,
  'confirmed',
  now()
from exact_matches e
on conflict (id) do nothing;

with embedded_sides as (
  select distinct trim(side_name) as name,
    public.cookbook_normalize_name(side_name) as normalized_name
  from public.menu_items_v2 m
  cross join lateral unnest(coalesce(m.sides, '{}'::text[])) side_name
  where nullif(trim(side_name), '') is not null
),
unmatched as (
  select e.*
  from embedded_sides e
  where not exists (
    select 1 from public.side_items s
    where public.cookbook_normalize_name(s.name) = e.normalized_name
  )
)
insert into public.reconciliation_tasks (
  id, task_type, subject_type, subject_id, priority, candidate_payload
)
select
  public.cookbook_deterministic_uuid('reconciliation-embedded-side', u.normalized_name),
  'source_mapping',
  'embedded_side',
  u.normalized_name,
  20,
  jsonb_build_object(
    'source_name', u.name,
    'normalized_name', u.normalized_name,
    'reason', 'No exact side_items match; do not combine automatically'
  )
from unmatched u
on conflict (id) do nothing;

-- Everything in the stable production catalog without a recipe becomes one
-- durable task, including inactive offerings, all sides, and all bulk items.
insert into public.reconciliation_tasks (
  id, task_type, subject_type, subject_id, priority, candidate_payload
)
select
  public.cookbook_deterministic_uuid('reconciliation-missing-recipe', p.id::text),
  'missing_recipe',
  'production_item',
  p.id::text,
  case
    when p.active and p.kind = 'menu_item' then 10
    when p.active then 20
    else 100
  end,
  jsonb_build_object(
    'production_item_id', p.id,
    'name', p.name,
    'kind', p.kind,
    'active', p.active
  )
from public.production_items p
where p.recipe_requirement = 'required'
  and not exists (
    select 1 from public.production_item_recipe_links l
    where l.production_item_id = p.id and l.active
  )
on conflict (id) do nothing;

insert into public.cookbook_audit_events (
  action, subject_type, subject_id, request_id, new_state
)
select
  'migration_backfill_completed',
  'cookbook_migration',
  '20260902172000',
  '20260902172000_backfill_cookbook_foundation',
  jsonb_build_object('completed_at', now(), 'mode', 'additive')
where not exists (
  select 1
  from public.cookbook_audit_events
  where request_id = '20260902172000_backfill_cookbook_foundation'
);
