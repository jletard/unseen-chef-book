-- Complete legacy recipes created after the original cookbook backfill exist
-- in public.recipes but have no immutable approved version. Snapshot every
-- structurally valid one so component resolution has an approved version to
-- reference. This is a general catch-up, not a name-specific repair.

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
  public.cookbook_deterministic_uuid('recipe-version-catchup', recipe.id::text),
  recipe.id,
  coalesce((
    select max(existing.version_number) + 1
    from public.recipe_versions existing
    where existing.recipe_id = recipe.id
  ), 1),
  'approved',
  recipe.yield_kind,
  recipe.base_yield,
  recipe.yield_unit,
  recipe.minimum_batch,
  recipe.yield_unit,
  recipe.notes,
  'legacy_catchup',
  'Immutable catch-up snapshot of a complete recipe created after the cookbook backfill',
  coalesce(recipe.updated_at, recipe.created_at, now()),
  encode(extensions.digest(convert_to((
    jsonb_build_object(
      'recipe', jsonb_build_object(
        'id', recipe.id,
        'name', recipe.name,
        'recipe_type', recipe.recipe_type,
        'yield_kind', recipe.yield_kind,
        'base_yield', recipe.base_yield,
        'yield_unit', recipe.yield_unit,
        'minimum_batch', recipe.minimum_batch,
        'notes', recipe.notes
      ),
      'items', coalesce((
        select jsonb_agg(to_jsonb(item) - 'created_at' - 'updated_at' order by item.sort_order, item.id)
        from public.recipe_items item
        where item.recipe_id = recipe.id
      ), '[]'::jsonb),
      'steps', coalesce((
        select jsonb_agg(to_jsonb(step) - 'created_at' - 'updated_at' order by step.step_number, step.id)
        from public.recipe_steps step
        where step.recipe_id = recipe.id
      ), '[]'::jsonb)
    )
  )::text, 'UTF8'), 'sha256'), 'hex')
from public.recipes recipe
where recipe.status = 'complete'
  and recipe.yield_kind in ('servings', 'liquid', 'solid', 'countable')
  and recipe.base_yield > 0
  and recipe.yield_unit in ('serving', 'each', 'oz', 'lb', 'fl_oz', 'cup', 'quart', 'g', 'kg')
  and recipe.minimum_batch > 0
  and not exists (
    select 1
    from public.recipe_versions approved
    where approved.recipe_id = recipe.id
      and approved.state = 'approved'
  )
on conflict (recipe_id, content_hash) do nothing;

-- Make the new immutable snapshots discoverable before their component lines
-- are copied, so component-to-component dependencies resolve by version ID.
with latest_approved as (
  select distinct on (version.recipe_id)
    version.recipe_id,
    version.id
  from public.recipe_versions version
  where version.state = 'approved'
  order by
    version.recipe_id,
    version.version_number desc,
    version.approved_at desc,
    version.id desc
)
update public.recipes recipe
set
  normalized_name = public.cookbook_normalize_name(recipe.name),
  lifecycle_state = 'active',
  retired_at = null,
  current_approved_version_id = approved.id
from latest_approved approved
where recipe.status = 'complete'
  and approved.recipe_id = recipe.id
  and (
    recipe.current_approved_version_id is distinct from approved.id
    or recipe.normalized_name is distinct from public.cookbook_normalize_name(recipe.name)
    or recipe.lifecycle_state is distinct from 'active'
    or recipe.retired_at is not null
  );

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
  public.cookbook_deterministic_uuid('recipe-version-catchup-item', item.id::text),
  version.id,
  case when item.item_type = 'component' then 'recipe' else 'ingredient' end,
  case when item.item_type = 'ingredient' then item.ingredient_id end,
  case when item.item_type = 'component' then dependency.current_approved_version_id end,
  item.quantity,
  item.unit,
  item.preparation_note,
  item.sort_order,
  item.created_at
from public.recipe_items item
join public.recipes recipe on recipe.id = item.recipe_id
join public.recipe_versions version
  on version.id = recipe.current_approved_version_id
 and version.source_type = 'legacy_catchup'
left join public.recipes dependency on dependency.id = item.component_recipe_id
where not exists (
    select 1
    from public.recipe_version_items existing
    where existing.recipe_version_id = version.id
      and existing.sort_order = item.sort_order
  )
  and (
    (item.item_type = 'ingredient' and item.ingredient_id is not null)
    or
    (item.item_type = 'component' and dependency.current_approved_version_id is not null)
  )
on conflict (id) do nothing;

insert into public.recipe_version_steps (
  id,
  recipe_version_id,
  step_number,
  instruction,
  created_at
)
select
  public.cookbook_deterministic_uuid('recipe-version-catchup-step', step.id::text),
  version.id,
  step.step_number,
  step.instruction,
  step.created_at
from public.recipe_steps step
join public.recipes recipe on recipe.id = step.recipe_id
join public.recipe_versions version
  on version.id = recipe.current_approved_version_id
 and version.source_type = 'legacy_catchup'
where not exists (
  select 1
  from public.recipe_version_steps existing
  where existing.recipe_version_id = version.id
    and existing.step_number = step.step_number
)
on conflict (id) do nothing;
