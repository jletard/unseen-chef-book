-- Bulk proteins are purchased and inventoried by the pound. Keep the legacy
-- recipe header constraint aligned with the approved-version unit vocabulary.

alter table public.recipes
  drop constraint if exists recipe_yield_unit_matches_kind;

alter table public.recipes
  add constraint recipe_yield_unit_matches_kind
  check (
    yield_kind is null
    or yield_unit is null
    or (yield_kind = 'servings' and yield_unit = 'serving')
    or (yield_kind = 'liquid' and yield_unit in ('fl_oz', 'cup', 'quart'))
    or (yield_kind = 'solid' and yield_unit in ('oz', 'lb', 'g', 'kg'))
    or (yield_kind = 'countable' and yield_unit = 'each')
  );
