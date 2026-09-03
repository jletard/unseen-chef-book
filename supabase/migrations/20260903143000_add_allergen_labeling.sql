-- Ingredient labeling metadata for recursive recipe allergen declarations.

alter table public.ingredients
  add column if not exists label_name text,
  add column if not exists ingredient_statement text,
  add column if not exists allergen_keys text[] not null default '{}'::text[],
  add column if not exists allergen_details jsonb not null default '{}'::jsonb,
  add column if not exists label_review_status text not null default 'unreviewed',
  add column if not exists label_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_label_review_status_check'
  ) then
    alter table public.ingredients add constraint ingredients_label_review_status_check
      check (label_review_status in ('unreviewed', 'confirmed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_allergen_keys_check'
  ) then
    alter table public.ingredients add constraint ingredients_allergen_keys_check
      check (allergen_keys <@ array[
        'milk', 'egg', 'fish', 'crustacean_shellfish', 'tree_nuts',
        'peanuts', 'wheat', 'soy', 'sesame'
      ]::text[]) not valid;
  end if;
end $$;

update public.ingredients
set label_name = coalesce(nullif(trim(label_name), ''), canonical_name, name),
    ingredient_statement = coalesce(nullif(trim(ingredient_statement), ''), canonical_name, name)
where label_name is null or ingredient_statement is null;

comment on column public.ingredients.ingredient_statement is
  'Consumer-facing ingredient declaration. Compound purchased foods include their subingredients here.';
comment on column public.ingredients.allergen_details is
  'Specific sources required for fish, crustacean shellfish, and tree nuts, keyed by allergen key.';

