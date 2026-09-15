# Cookbook Status

Last reviewed: 2026-09-15

This file is the short current-state handoff for future work. Read it with `README.md`, `DESIGN.md`, and `TODO.md` before changing the Cookbook.

## Where the application is now

The Cookbook is no longer a prototype shell. It has working Planning, Production, and Cook workflows backed by the shared production Supabase project.

Working application areas include:

- Recipe and component records with yields, ingredient/component lines, steps, notes, equipment, draft/review/approval flow, and current approved versions.
- Reconciliation, fast draft review, identity decisions, component linking, and data-repair tools for legacy/imported culinary data.
- Editable purchased-ingredient catalog and duplicate/merge repair tooling.
- Production list, shopping list, prep list, production-week selection, This Week, and recipe search.
- Avery 6464 grab-and-go labels generated from approved recipes.
- Purchased-ingredient label metadata: label name, ingredient declaration, allergen keys/details, dietary flags, and review status.
- Recursive label ingredient resolution through prepared recipe/component dependencies, including cycle detection and incomplete-data blocking.

Recent work through 2026-09-12 concentrated on recipe reconciliation, ingredient cleanup, component recipe linking, and identity-decision resolution.

## Important architecture reality

There are two recipe-access generations in the codebase.

The newer cookbook-v2/reconciliation path uses approved `recipe_versions` and `recipe_version_items` with recipe dependencies. Label generation already relies on this versioned/approved structure.

Older helpers and API routes still read/write legacy-style `recipe_items` and `recipe_steps` directly. Do not build a new major feature against a legacy path merely because it is easier to find. Before extending recipes, identify which path is authoritative for that workflow and prefer the approved/versioned model for new derived data.

The live Supabase schema is authoritative. Historical one-time migrations are intentionally not stored in this repository. Inspect live behavior before proposing schema changes.

## Current regulatory ingredient-label priority

Environmental Health clarified on 2026-09-14 that compound purchased foods must list their sub-ingredients in the ingredient declaration. The existing data model is already partly prepared for this: purchased ingredients have `ingredient_statement` and label review fields, and the label resolver recursively expands prepared components.

The main gap is workflow and completeness, not starting from zero. Ingredient wording currently lives primarily in the Allergens/label-review interface while the ordinary Ingredients catalog only edits name and measurement kind. The next pass should make ingredient identity, commercial sub-ingredient declaration, allergen review, and verification feel like one coherent ingredient workflow.

Do not flatten prepared component recipes into copied text. Prepared components should continue to resolve recursively from their approved recipes. Purchased compound foods should carry the supplier/manufacturer ingredient declaration as ingredient metadata.

## Current nutrition priority

Nutrition is not currently modeled as a first-class Cookbook feature. Do not bolt calorie values directly onto menu text or labels.

The intended direction is reusable estimated nutrition derived from ingredient data, recipe quantities, unit conversions, and approved recipe yields. Initial customer-facing output should be clearly labeled as estimated nutrition.

The first useful fields are calories, protein, carbohydrate, fat, fiber, and sodium, calculated for the whole approved recipe and per serving/portion where the yield permits it. The system also needs provenance/confidence and manual override capability because purchased products and real kitchen yields vary.

Nutrition should eventually be reusable by Book recipe views and by other Unseen Chef applications rather than recomputed separately in each application.

## Code-review observations

### Strong foundation

- The recipe domain has explicit categories, yields, minimum batches, ingredients versus recipe dependencies, validation, and approval readiness checks.
- Label generation already walks recipe dependencies recursively, aggregates allergens, detects dependency cycles, and blocks incomplete purchased-ingredient review.
- Reconciliation and data-repair are treated as first-class workflows instead of silently normalizing uncertain records.
- Application boundaries are generally clean: Book owns culinary knowledge/production, while customer/payment/business administration stays elsewhere.

### Main technical debt to watch

- Legacy direct recipe helpers coexist with cookbook-v2/versioned recipe logic. This is the biggest architectural ambiguity for new feature work.
- Ingredient metadata is split across the basic Ingredients editor and the Allergens/label-review editor, which makes regulatory data less discoverable than it should be.
- No automated test command exists in `package.json`; high-risk derived logic such as recursive label expansion, recipe scaling/unit conversion, and future nutrition math would benefit from focused tests.
- The repository cannot recreate the live database from migrations by design, so schema-dependent changes must be documented carefully after inspecting production Supabase.

## Near-term definition of success

1. Every purchased compound ingredient used on a label can store and review its complete supplier ingredient declaration, including sub-ingredients.
2. Ingredient review is easy to find from the Ingredients workflow, not only from Allergens.
3. Approved recipes continue to generate complete recursive ingredient statements and allergen output without copied component text.
4. A nutrition data model is designed around reusable ingredient facts, normalized quantities, and approved recipe yields before customer-facing calorie numbers are added broadly.
5. Documentation stays synchronized with the running application after each major change.
