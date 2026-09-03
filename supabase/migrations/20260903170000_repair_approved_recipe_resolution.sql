-- Keep recipe identity lookup and immutable approved-version lookup aligned.

create or replace function public.sync_recipe_normalized_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_name := public.cookbook_normalize_name(new.name);
  if new.status = 'inactive' then
    new.lifecycle_state := 'retired';
    new.retired_at := coalesce(new.retired_at, now());
  elsif new.status = 'complete' then
    new.lifecycle_state := 'active';
    new.retired_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_recipe_normalized_name on public.recipes;
create trigger sync_recipe_normalized_name
before insert or update of name, status on public.recipes
for each row execute function public.sync_recipe_normalized_name();

-- Older and legacy write paths could change a display name without refreshing
-- normalized_name. Resolution always follows the current recipe name.
update public.recipes
set
  normalized_name = public.cookbook_normalize_name(name),
  lifecycle_state = case when status = 'inactive' then 'retired' else 'active' end,
  retired_at = case
    when status = 'inactive' then coalesce(retired_at, updated_at, now())
    else null
  end
where normalized_name is distinct from public.cookbook_normalize_name(name)
   or lifecycle_state is distinct from case when status = 'inactive' then 'retired' else 'active' end
   or (status = 'inactive' and retired_at is null)
   or (status <> 'inactive' and retired_at is not null);

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
