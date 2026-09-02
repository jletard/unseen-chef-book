-- The legacy recipes table has both a unit vocabulary constraint and a
-- kind/unit pairing constraint. Keep its vocabulary aligned with recipe_versions.

alter table public.recipes
  drop constraint if exists recipes_yield_unit_check;

alter table public.recipes
  add constraint recipes_yield_unit_check
  check (yield_unit in ('serving', 'each', 'oz', 'lb', 'fl_oz', 'cup', 'quart', 'g', 'kg'));
