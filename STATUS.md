# Cookbook Status

Last reviewed: 2026-09-15

This file is the short current-state handoff for future work. Read it with `README.md`, `DESIGN.md`, and `TODO.md` before changing the Cookbook.

## Where the application is now

The Cookbook is no longer a prototype shell. It has working Planning, Production, and Cook workflows backed by the shared production Supabase project.

Working application areas include:

- Recipe and component records with yields, ingredient/component lines, steps, notes, equipment, draft/review/approval flow, and current approved versions.
- Reconciliation, fast draft review, identity decisions, component linking, and data-repair tools for legacy/imported culinary data.
- Editable purchased-ingredient catalog and duplicate/merge repair tooling.
- Purchased ingredients classified as `simple` or `compound`.
- Structured purchased compound-ingredient relationships in `ingredient_components` while retaining the supplier/manufacturer ingredient declaration on the ingredient record.
- Production list, shopping list, prep list, production-week selection, This Week, and recipe search.
- Avery 6464 grab-and-go labels generated from approved recipes.
- Purchased-ingredient label metadata: label name, ingredient declaration, allergen keys/details, dietary flags, and review status.
- Recursive label ingredient resolution through both prepared recipe/component dependencies and structured purchased compound ingredients, including cycle detection and incomplete-data blocking.

Recent work on 2026-09-15 added the live compound-ingredient database model and the Book workflow for classifying purchased ingredients, editing supplier declarations, managing ordered child ingredients, and feeding that structure into the label resolver.

## Important architecture reality

There are two recipe-access generations in the codebase.

The newer cookbook-v2/reconciliation path uses approved `recipe_versions` and `recipe_version_items` with recipe dependencies. Label generation already relies on this versioned/approved structure.

Older helpers and API routes still read/write legacy-style `recipe_items` and `recipe_steps` directly. Do not build a new major feature against a legacy path merely because it is easier to find. Before extending recipes, identify which path is authoritative for that workflow and prefer the approved/versioned model for new derived data.

The live Supabase schema is authoritative. Historical one-time migrations are intentionally not stored in this repository. Inspect live behavior before proposing schema changes.

## Current regulatory ingredient-label priority

Environmental Health clarified on 2026-09-14 that compound purchased foods must list their sub-ingredients in the ingredient declaration.

The live database now supports this in two complementary ways:

1. `ingredients.ingredient_statement` remains the authoritative supplier/manufacturer declaration.
2. `ingredient_components` stores the structured parent-to-child ingredient graph used for recursive data, allergen propagation, review completeness, and future nutrition.

`ingredients.ingredient_kind` distinguishes simple purchased ingredients from compound purchased foods. Existing records defaulted to `simple`, so the current operational task is to classify the existing catalog and populate real compound relationships without inventing manufacturer formulation quantities.

The normal Ingredients screen now exposes ingredient type, supplier declaration, and child-ingredient structure. Adding/removing child relationships or changing regulatory wording returns the ingredient to label review. Compound ingredients with no structured children are considered incomplete by the label resolver.

Prepared components remain recipes and continue to resolve recursively from approved recipe versions. Do not turn prepared recipe components into purchased compound ingredients or flatten them into copied text.

## Current nutrition priority

Nutrition is not currently modeled as a first-class Cookbook feature. The 2026-09-15 live-schema review found no existing nutrition table or nutrition columns.

Do not bolt calorie values directly onto menu text or labels.

The intended direction is reusable estimated nutrition derived from ingredient data, recipe quantities, unit conversions, approved recipe yields, and the new structured compound-ingredient graph. Initial customer-facing output should be clearly labeled as estimated nutrition.

The first useful fields are calories, protein, carbohydrate, fat, fiber, and sodium, calculated for the whole approved recipe and per serving/portion where the yield permits it. The system also needs provenance/confidence and manual override capability because purchased products and real kitchen yields vary.

Nutrition should eventually be reusable by Book recipe views and by other Unseen Chef applications rather than recomputed separately in each application.

## Code-review observations

### Strong foundation

- The recipe domain has explicit categories, yields, minimum batches, ingredients versus recipe dependencies, validation, and approval readiness checks.
- Label generation walks recipe dependencies and purchased compound ingredients recursively, aggregates allergens, detects cycles, and blocks incomplete ingredient review/structure.
- Reconciliation and data-repair are treated as first-class workflows instead of silently normalizing uncertain records.
- Purchased compound foods now have a permanent structured model rather than being disguised as prepared recipes/components.
- Application boundaries are generally clean: Book owns culinary knowledge/production, while customer/payment/business administration stays elsewhere.

### Main technical debt to watch

- Legacy direct recipe helpers coexist with cookbook-v2/versioned recipe logic. This is the biggest architectural ambiguity for new feature work.
- Allergen flags still live primarily in the Allergens workflow even though ingredient type/declaration/structure are now available from Ingredients; these workflows may eventually deserve further unification.
- Existing ingredient records were created before `ingredient_kind`; they default to `simple` and must be reviewed rather than trusted as classified.
- No automated test command exists in `package.json`; high-risk derived logic such as recursive ingredient/recipe label expansion, recipe scaling/unit conversion, and future nutrition math would benefit from focused tests.
- The repository cannot recreate the live database from migrations by design, so schema-dependent changes must be documented carefully after inspecting production Supabase.

## Near-term definition of success

1. Existing purchased ingredients are classified correctly as simple or compound, prioritizing ingredients used by approved recipes/current labels.
2. Every purchased compound ingredient used on a label has both its full supplier declaration and structured child ingredients in supplier order.
3. Approved recipes generate complete recursive ingredient statements and allergen output through both purchased compounds and prepared components.
4. Several corrected labels are validated against Environmental Health before the ingredient-label cleanup is considered complete.
5. A nutrition data model is designed around reusable ingredient facts, normalized quantities, the compound ingredient graph, and approved recipe yields before broad customer-facing calorie numbers are added.
6. Documentation stays synchronized with the running application after each major change.
