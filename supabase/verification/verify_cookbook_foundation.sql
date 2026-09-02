-- Run after both foundation migrations in the rehearsal database.
-- A successful rehearsal returns `passed: true` and an empty failures array.

begin transaction read only;

with checks as (
  select
    'every complete recipe has one v1' as check_name,
    (select count(*) from public.recipes where status = 'complete') as expected,
    (select count(*) from public.recipe_versions where version_number = 1) as actual

  union all
  select
    'every complete recipe points to v1',
    (select count(*) from public.recipes where status = 'complete'),
    (select count(*)
     from public.recipes r
     join public.recipe_versions v on v.id = r.current_approved_version_id
     where r.status = 'complete' and v.recipe_id = r.id and v.version_number = 1)

  union all
  select
    'all complete-recipe items were preserved',
    (select count(*)
     from public.recipe_items i
     join public.recipes r on r.id = i.recipe_id
     where r.status = 'complete'),
    (select count(*) from public.recipe_version_items)

  union all
  select
    'all complete-recipe steps were preserved',
    (select count(*)
     from public.recipe_steps s
     join public.recipes r on r.id = s.recipe_id
     where r.status = 'complete'),
    (select count(*) from public.recipe_version_steps)

  union all
  select
    'every legacy draft has one aggregate workspace',
    (select count(*) from public.recipes where status = 'draft'),
    (select count(*) from public.recipe_drafts where source_type = 'legacy_backfill')

  union all
  select
    'every menu item has one production source',
    (select count(*) from public.menu_items_v2),
    (select count(*) from public.production_item_sources where source_type = 'menu_item')

  union all
  select
    'every side has one production source',
    (select count(*) from public.side_items),
    (select count(*) from public.production_item_sources where source_type = 'side_item')

  union all
  select
    'every bulk item has one production source',
    (select count(*) from public.bulk_items),
    (select count(*) from public.production_item_sources where source_type = 'bulk_item')

  union all
  select
    'every legacy menu-recipe link was preserved',
    (select count(*) from public.menu_item_recipe_links),
    (select count(*) from public.production_item_recipe_links)
),
failures as (
  select * from checks where expected <> actual
),
broken_version_dependencies as (
  select i.id, i.recipe_version_id, i.dependency_recipe_version_id
  from public.recipe_version_items i
  left join public.recipe_versions d on d.id = i.dependency_recipe_version_id
  where i.item_kind = 'recipe' and d.id is null
),
source_collisions as (
  select source_type, source_id, count(*) as mapping_count
  from public.production_item_sources
  where source_id is not null and mapping_state <> 'rejected'
  group by source_type, source_id
  having count(*) > 1
),
open_queue as (
  select
    p.kind,
    p.active,
    count(*) as task_count
  from public.reconciliation_tasks t
  join public.production_items p on p.id::text = t.subject_id
  where t.task_type = 'missing_recipe' and t.status = 'open'
  group by p.kind, p.active
),
unmatched_embedded_sides as (
  select candidate_payload ->> 'source_name' as source_name
  from public.reconciliation_tasks
  where task_type = 'source_mapping'
    and subject_type = 'embedded_side'
    and status = 'open'
)
select jsonb_pretty(jsonb_build_object(
  'passed',
    not exists (select 1 from failures)
    and not exists (select 1 from broken_version_dependencies)
    and not exists (select 1 from source_collisions),
  'checks', (select jsonb_agg(to_jsonb(c) order by check_name) from checks c),
  'failures', coalesce((select jsonb_agg(to_jsonb(f) order by check_name) from failures f), '[]'::jsonb),
  'broken_version_dependencies', coalesce((select jsonb_agg(to_jsonb(x)) from broken_version_dependencies x), '[]'::jsonb),
  'source_collisions', coalesce((select jsonb_agg(to_jsonb(x)) from source_collisions x), '[]'::jsonb),
  'reconciliation_queue', coalesce((select jsonb_agg(to_jsonb(x) order by kind, active desc) from open_queue x), '[]'::jsonb),
  'unmatched_embedded_sides', coalesce((select jsonb_agg(source_name order by source_name) from unmatched_embedded_sides), '[]'::jsonb),
  'assigned_roles', (select count(*) from public.cookbook_user_roles)
)) as verification_result;

commit;
