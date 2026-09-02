-- Convert reviewed drafts into immutable approved recipe versions.

alter table public.recipe_versions
  drop constraint if exists recipe_versions_yield_unit_check;
alter table public.recipe_versions
  add constraint recipe_versions_yield_unit_check
  check (yield_unit in ('serving', 'each', 'oz', 'lb', 'fl_oz', 'cup', 'quart', 'g', 'kg'));

create or replace function public.finalize_ready_recipe_draft(ready_draft_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  draft public.recipe_drafts%rowtype;
  payload jsonb;
  line jsonb;
  step_row jsonb;
  equipment_row jsonb;
  normalized text;
  resolved_ids uuid[];
  resolved_ingredient_id uuid;
  dependency_version_id uuid;
  dependency_draft public.recipe_drafts%rowtype;
  recipe_id_value uuid;
  version_id_value uuid;
  previous_version_id uuid;
  next_version integer;
  content_hash_value text;
  production_item_id_value uuid;
  item_index integer := 0;
  step_index integer := 0;
  equipment_index integer := 0;
  equipment_id_value uuid;
  created_ingredients integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_cookbook_role(array['owner']) then
    raise exception 'Cookbook owner role required' using errcode = '42501';
  end if;

  select * into draft from public.recipe_drafts where id = ready_draft_id for update;
  if draft.id is null then
    raise exception 'Draft not found' using errcode = 'P0002';
  end if;
  if draft.draft_state <> 'ready_for_review' or draft.review_bucket <> 'ready' then
    raise exception 'Only Ready drafts can be finalized' using errcode = '55000';
  end if;
  payload := draft.draft_payload;

  if nullif(trim(payload->>'name'), '') is null
     or nullif(payload->>'recipeCategory', '') is null
     or nullif(payload->>'yieldKind', '') is null
     or nullif(payload->>'yieldUnit', '') is null
     or (payload->>'baseYield')::numeric <= 0
     or (payload->>'minimumBatchQuantity')::numeric <= 0 then
    raise exception 'Draft recipe header is incomplete' using errcode = '22023';
  end if;

  -- Resolve every dependency before creating an approved parent version.
  for line in select value from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    if line->>'kind' = 'recipe' then
      dependency_version_id := null;
      if nullif(line->>'nestedDraftId', '') is not null then
        select * into dependency_draft
        from public.recipe_drafts
        where id = (line->>'nestedDraftId')::uuid;
        if dependency_draft.id is null
           or dependency_draft.draft_state <> 'archived'
           or dependency_draft.recipe_id is null then
          raise exception 'Prepared component "%" must be finalized first', line->>'proposedName'
            using errcode = '55000';
        end if;
        select current_approved_version_id into dependency_version_id
        from public.recipes where id = dependency_draft.recipe_id;
      else
        normalized := public.cookbook_normalize_name(line->>'proposedName');
        select array_agg(distinct r.current_approved_version_id) into resolved_ids
        from public.recipes r
        where r.retired_at is null
          and r.current_approved_version_id is not null
          and r.normalized_name = normalized;
        if coalesce(array_length(resolved_ids, 1), 0) <> 1 then
          raise exception 'Prepared component "%" has % exact approved matches',
            line->>'proposedName', coalesce(array_length(resolved_ids, 1), 0)
            using errcode = '55000';
        end if;
        dependency_version_id := resolved_ids[1];
      end if;
      if dependency_version_id is null then
        raise exception 'Prepared component "%" has no approved version', line->>'proposedName'
          using errcode = '55000';
      end if;
    elsif line->>'kind' <> 'ingredient' then
      raise exception 'Unknown recipe item kind' using errcode = '22023';
    end if;
  end loop;

  normalized := public.cookbook_normalize_name(payload->>'name');
  perform pg_advisory_xact_lock(hashtextextended('recipe:' || normalized, 0));
  recipe_id_value := draft.recipe_id;
  if recipe_id_value is null then
    select array_agg(r.id order by r.created_at) into resolved_ids
    from public.recipes r
    where r.retired_at is null and r.normalized_name = normalized;
    if coalesce(array_length(resolved_ids, 1), 0) > 1 then
      raise exception 'Recipe "%" has multiple exact identities', payload->>'name'
        using errcode = '55000';
    elsif coalesce(array_length(resolved_ids, 1), 0) = 1 then
      recipe_id_value := resolved_ids[1];
    end if;
  end if;
  if recipe_id_value is null then
    insert into public.recipes (
      name, recipe_type, status, yield_kind, base_yield, yield_unit,
      minimum_batch, notes, normalized_name, lifecycle_state, created_by
    ) values (
      payload->>'name', payload->>'recipeCategory', 'complete', payload->>'yieldKind',
      (payload->>'baseYield')::numeric, payload->>'yieldUnit',
      (payload->>'minimumBatchQuantity')::numeric,
      nullif(payload->>'chefNotes', ''), normalized, 'active', actor_id
    ) returning id into recipe_id_value;
  end if;

  select current_approved_version_id into previous_version_id
  from public.recipes where id = recipe_id_value for update;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.recipe_versions where recipe_id = recipe_id_value;
  content_hash_value := encode(
    extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex'
  );

  select id into version_id_value
  from public.recipe_versions
  where recipe_id = recipe_id_value and content_hash = content_hash_value;
  if version_id_value is null then
    insert into public.recipe_versions (
      recipe_id, version_number, source_draft_id, supersedes_version_id,
      yield_kind, base_yield, yield_unit, minimum_batch_quantity,
      minimum_batch_unit, portion_quantity, portion_unit, chef_notes,
      production_notes, source_type, source_summary, approved_by, content_hash
    ) values (
      recipe_id_value, next_version, draft.id, previous_version_id,
      payload->>'yieldKind', (payload->>'baseYield')::numeric, payload->>'yieldUnit',
      (payload->>'minimumBatchQuantity')::numeric, payload->>'minimumBatchUnit',
      nullif(payload->>'portionQuantity', '')::numeric, nullif(payload->>'portionUnit', ''),
      nullif(payload->>'chefNotes', ''), nullif(payload->>'productionNotes', ''),
      draft.source_type, draft.source_summary, actor_id, content_hash_value
    ) returning id into version_id_value;

    for line in select value from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
    loop
      item_index := item_index + 1;
      resolved_ingredient_id := null;
      dependency_version_id := null;
      if line->>'kind' = 'ingredient' then
        normalized := public.cookbook_normalize_name(line->>'proposedName');
        perform pg_advisory_xact_lock(hashtextextended('ingredient:' || normalized, 0));
        select array_agg(distinct candidate_id) into resolved_ids
        from (
          select i.id as candidate_id from public.ingredients i
          where i.retired_at is null and i.normalized_name = normalized
          union
          select a.ingredient_id from public.ingredient_aliases a
          join public.ingredients i on i.id = a.ingredient_id and i.retired_at is null
          where a.normalized_alias = normalized
        ) candidates;
        if coalesce(array_length(resolved_ids, 1), 0) > 1 then
          raise exception 'Ingredient "%" has multiple exact identities', line->>'proposedName'
            using errcode = '55000';
        elsif coalesce(array_length(resolved_ids, 1), 0) = 1 then
          resolved_ingredient_id := resolved_ids[1];
        else
          insert into public.ingredients (
            name, measurement_kind, canonical_name, normalized_name, created_by
          ) values (
            line->>'proposedName',
            case
              when line->>'unit' in ('fl_oz', 'cup', 'quart') then 'liquid'
              when line->>'unit' = 'each' then 'countable'
              else 'solid'
            end,
            line->>'proposedName', normalized, actor_id
          ) returning id into resolved_ingredient_id;
          created_ingredients := created_ingredients + 1;
        end if;
      else
        if nullif(line->>'nestedDraftId', '') is not null then
          select r.current_approved_version_id into dependency_version_id
          from public.recipe_drafts d join public.recipes r on r.id = d.recipe_id
          where d.id = (line->>'nestedDraftId')::uuid;
        else
          select r.current_approved_version_id into dependency_version_id
          from public.recipes r
          where r.retired_at is null
            and r.normalized_name = public.cookbook_normalize_name(line->>'proposedName')
          order by r.created_at limit 1;
        end if;
      end if;

      insert into public.recipe_version_items (
        recipe_version_id, item_kind, ingredient_id, dependency_recipe_version_id,
        quantity, unit, preparation_note, sort_order
      ) values (
        version_id_value, line->>'kind', resolved_ingredient_id, dependency_version_id,
        (line->>'quantity')::numeric, line->>'unit', nullif(line->>'preparationNote', ''), item_index - 1
      );
    end loop;

    for step_row in select value from jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb))
    loop
      step_index := step_index + 1;
      insert into public.recipe_version_steps (
        recipe_version_id, step_number, instruction, temperature_value,
        temperature_unit, duration_minutes, is_advance_prep, prep_day_offset, station
      ) values (
        version_id_value, step_index, step_row->>'instruction',
        nullif(step_row->>'temperatureValue', '')::numeric,
        nullif(step_row->>'temperatureUnit', ''),
        nullif(step_row->>'durationMinutes', '')::integer,
        coalesce((step_row->>'isAdvancePrep')::boolean, false),
        nullif(step_row->>'prepDayOffset', '')::integer,
        nullif(step_row->>'station', '')
      );
    end loop;

    for equipment_row in select value from jsonb_array_elements(coalesce(payload->'equipment', '[]'::jsonb))
    loop
      equipment_index := equipment_index + 1;
      normalized := public.cookbook_normalize_name(equipment_row->>'name');
      insert into public.equipment (name, normalized_name)
      values (equipment_row->>'name', normalized)
      on conflict (normalized_name) do update set name = excluded.name
      returning id into equipment_id_value;
      insert into public.recipe_version_equipment (
        recipe_version_id, equipment_id, quantity, note, sort_order
      ) values (
        version_id_value, equipment_id_value,
        nullif(equipment_row->>'quantity', '')::numeric,
        nullif(equipment_row->>'note', ''), equipment_index - 1
      );
    end loop;
  end if;

  update public.recipes set
    name = payload->>'name', recipe_type = payload->>'recipeCategory', status = 'complete',
    yield_kind = payload->>'yieldKind', base_yield = (payload->>'baseYield')::numeric,
    yield_unit = payload->>'yieldUnit', minimum_batch = (payload->>'minimumBatchQuantity')::numeric,
    notes = nullif(payload->>'chefNotes', ''), normalized_name = public.cookbook_normalize_name(payload->>'name'),
    current_approved_version_id = version_id_value
  where id = recipe_id_value;

  update public.recipe_drafts set
    recipe_id = recipe_id_value, draft_state = 'archived', updated_by = actor_id, updated_at = now()
  where id = draft.id;

  production_item_id_value := case
    when coalesce((draft.generation_metadata->>'inline_component')::boolean, false) then null
    else nullif(draft.source_payload->'production_item'->>'id', '')::uuid
  end;
  if production_item_id_value is not null then
    insert into public.production_item_recipe_links (
      production_item_id, recipe_id, role, sort_order, active
    ) values (production_item_id_value, recipe_id_value, 'main', 0, true)
    on conflict (production_item_id, recipe_id, role) do update set active = true;

    update public.reconciliation_tasks set
      status = 'resolved', resolution_payload = jsonb_build_object(
        'recipe_id', recipe_id_value, 'recipe_version_id', version_id_value, 'draft_id', draft.id
      ), resolved_by = actor_id, resolved_at = now(), updated_at = now()
    where task_type = 'missing_recipe' and subject_type = 'production_item'
      and subject_id = production_item_id_value::text and status in ('open', 'deferred');
  end if;

  insert into public.cookbook_audit_events (
    actor_id, action, subject_type, subject_id, new_state
  ) values (
    actor_id, 'recipe_draft_finalized', 'recipe_draft', draft.id::text,
    jsonb_build_object('recipe_id', recipe_id_value, 'version_id', version_id_value)
  );

  return jsonb_build_object(
    'draft_id', draft.id, 'recipe_id', recipe_id_value, 'version_id', version_id_value,
    'created_ingredients', created_ingredients
  );
end;
$$;

revoke all on function public.finalize_ready_recipe_draft(uuid) from public;
grant execute on function public.finalize_ready_recipe_draft(uuid) to authenticated;
