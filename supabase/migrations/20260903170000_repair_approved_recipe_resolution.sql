-- Keep recipe identity lookup and immutable approved-version lookup aligned.

create or replace function public.sync_recipe_normalized_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_name := public.cookbook_normalize_name(new.name);
  return new;
end;
$$;

drop trigger if exists sync_recipe_normalized_name on public.recipes;
create trigger sync_recipe_normalized_name
before insert or update of name on public.recipes
for each row execute function public.sync_recipe_normalized_name();

-- Older and legacy write paths could change a display name without refreshing
-- normalized_name. Resolution always follows the current recipe name.
update public.recipes
set normalized_name = public.cookbook_normalize_name(name)
where normalized_name is distinct from public.cookbook_normalize_name(name);

-- A recipe is approved only when it has an immutable approved version. Repair
-- a missing or invalid convenience pointer from that authoritative history.
with latest_approved as (
  select distinct on (version.recipe_id)
    version.recipe_id,
    version.id as version_id
  from public.recipe_versions version
  where version.state = 'approved'
  order by version.recipe_id, version.version_number desc, version.approved_at desc, version.id desc
)
update public.recipes recipe
set current_approved_version_id = latest.version_id
from latest_approved latest
where latest.recipe_id = recipe.id
  and (
    recipe.current_approved_version_id is null
    or not exists (
      select 1
      from public.recipe_versions current_version
      where current_version.id = recipe.current_approved_version_id
        and current_version.recipe_id = recipe.id
        and current_version.state = 'approved'
    )
  );
