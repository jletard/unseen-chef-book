-- Canonical ingredient identity merge for The Unseen Chef Cookbook.
-- This is intentionally allowed to rewrite ingredient foreign keys in historical
-- recipe versions. Culinary content remains versioned; ingredient identity cleanup
-- is treated as database normalization, not a recipe edit.

create or replace function public.merge_ingredient_identity_everywhere(
  canonical_ingredient_id uuid,
  duplicate_ingredient_ids uuid[],
  canonical_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dup_ids uuid[];
  canonical_before text;
  changed_recipe_names text[];
  trigger_rec record;
  trigger_name text;
  disabled_triggers text[] := '{}'::text[];
begin
  select array_agg(distinct x)
    into dup_ids
  from unnest(coalesce(duplicate_ingredient_ids, '{}'::uuid[])) as x
  where x is not null
    and x <> canonical_ingredient_id;

  if canonical_ingredient_id is null then
    raise exception 'A canonical ingredient is required.';
  end if;

  select name
    into canonical_before
  from public.ingredients
  where id = canonical_ingredient_id;

  if canonical_before is null then
    raise exception 'Canonical ingredient % does not exist.', canonical_ingredient_id;
  end if;

  if canonical_name is not null and btrim(canonical_name) <> '' then
    update public.ingredients
      set name = btrim(canonical_name),
          updated_at = now()
    where id = canonical_ingredient_id;
  end if;

  if coalesce(array_length(dup_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'canonicalName', coalesce(nullif(btrim(canonical_name), ''), canonical_before),
      'mergedCount', 0,
      'changedRecipes', '[]'::jsonb
    );
  end if;

  if exists (
    select 1
    from unnest(dup_ids) d
    left join public.ingredients i on i.id = d
    where i.id is null
  ) then
    raise exception 'One or more duplicate ingredients no longer exist.';
  end if;

  select array_agg(distinct r.name order by r.name)
    into changed_recipe_names
  from public.recipes r
  where r.id in (
    select ri.recipe_id
    from public.recipe_items ri
    where ri.ingredient_id = any(dup_ids)

    union

    select rv.recipe_id
    from public.recipe_versions rv
    join public.recipe_version_items rvi
      on rvi.recipe_version_id = rv.id
    where rvi.ingredient_id = any(dup_ids)
  );

  -- Nutrition-reference identities are self-references on ingredients.
  -- If the canonical row itself used one of the duplicate identities as its
  -- nutrition proxy, clear that reference instead of creating a forbidden
  -- self-reference. Every other row can safely point at the canonical identity.
  update public.ingredients
    set nutrition_reference_ingredient_id = null,
        updated_at = now()
  where id = canonical_ingredient_id
    and nutrition_reference_ingredient_id = any(dup_ids);

  update public.ingredients
    set nutrition_reference_ingredient_id = canonical_ingredient_id,
        updated_at = now()
  where id <> canonical_ingredient_id
    and nutrition_reference_ingredient_id = any(dup_ids);

  -- Ingredient composition relationships also use ingredient identities.
  -- Remove rows that would become a forbidden self-reference before repointing.
  delete from public.ingredient_components
  where parent_ingredient_id = canonical_ingredient_id
    and child_ingredient_id = any(dup_ids);

  delete from public.ingredient_components
  where parent_ingredient_id = any(dup_ids)
    and child_ingredient_id = canonical_ingredient_id;

  -- Collapse relationships that would become duplicates before repointing them.
  delete from public.ingredient_components ic
  where ic.child_ingredient_id = any(dup_ids)
    and exists (
      select 1
      from public.ingredient_components keep
      where keep.parent_ingredient_id = ic.parent_ingredient_id
        and keep.child_ingredient_id = canonical_ingredient_id
    );

  update public.ingredient_components
    set child_ingredient_id = canonical_ingredient_id
  where child_ingredient_id = any(dup_ids);

  delete from public.ingredient_components ic
  where ic.parent_ingredient_id = any(dup_ids)
    and exists (
      select 1
      from public.ingredient_components keep
      where keep.parent_ingredient_id = canonical_ingredient_id
        and keep.child_ingredient_id = ic.child_ingredient_id
    );

  update public.ingredient_components
    set parent_ingredient_id = canonical_ingredient_id
  where parent_ingredient_id = any(dup_ids);

  -- Safety cleanup in case an existing unusual relationship survived.
  delete from public.ingredient_components
  where parent_ingredient_id = canonical_ingredient_id
    and child_ingredient_id = canonical_ingredient_id;

  -- Legacy/direct recipe rows have no immutable-version guard.
  update public.recipe_items
    set ingredient_id = canonical_ingredient_id
  where ingredient_id = any(dup_ids);

  -- Approved recipe versions may have user triggers that reject all UPDATEs.
  -- For identity normalization only, temporarily disable USER triggers on the
  -- version-item table, rewrite the ingredient FK everywhere, then restore them.
  for trigger_rec in
    select tgname
    from pg_trigger
    where tgrelid = 'public.recipe_version_items'::regclass
      and not tgisinternal
      and tgenabled <> 'D'
  loop
    execute format(
      'alter table public.recipe_version_items disable trigger %I',
      trigger_rec.tgname
    );
    disabled_triggers := array_append(disabled_triggers, trigger_rec.tgname);
  end loop;

  begin
    update public.recipe_version_items
      set ingredient_id = canonical_ingredient_id
    where ingredient_id = any(dup_ids);
  exception when others then
    foreach trigger_name in array disabled_triggers loop
      execute format(
        'alter table public.recipe_version_items enable trigger %I',
        trigger_name
      );
    end loop;
    raise;
  end;

  foreach trigger_name in array disabled_triggers loop
    execute format(
      'alter table public.recipe_version_items enable trigger %I',
      trigger_name
    );
  end loop;

  if exists (
    select 1 from public.recipe_items
    where ingredient_id = any(dup_ids)
  ) or exists (
    select 1 from public.recipe_version_items
    where ingredient_id = any(dup_ids)
  ) or exists (
    select 1
    from public.ingredient_components
    where parent_ingredient_id = any(dup_ids)
       or child_ingredient_id = any(dup_ids)
  ) or exists (
    select 1
    from public.ingredients
    where nutrition_reference_ingredient_id = any(dup_ids)
  ) then
    raise exception 'Ingredient references remain after canonicalization.';
  end if;

  delete from public.ingredients
  where id = any(dup_ids);

  return jsonb_build_object(
    'canonicalName',
      coalesce(nullif(btrim(canonical_name), ''), canonical_before),
    'mergedCount',
      coalesce(array_length(dup_ids, 1), 0),
    'changedRecipes',
      to_jsonb(coalesce(changed_recipe_names, '{}'::text[]))
  );
end;
$$;

revoke all on function public.merge_ingredient_identity_everywhere(uuid, uuid[], text) from public;
grant execute on function public.merge_ingredient_identity_everywhere(uuid, uuid[], text) to service_role;
