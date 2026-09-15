# TODO

This file tracks work that is still meaningfully unfinished. Completed foundation work is documented in `README.md`, `DESIGN.md`, and `STATUS.md` rather than kept as a giant historical checklist.

## Working now

- [x] Next.js/React/TypeScript application shell
- [x] Shared Supabase connection
- [x] Authentication
- [x] Dark-mode-only responsive navigation
- [x] Persistent production-week selection
- [x] Menu item, main dish, side, component, ingredient, allergen, category, and protein-type planning views
- [x] Recipe storage, recipe items/components, recipe steps, yields, and recipe editing
- [x] Versioned recipe/reconciliation infrastructure with approved recipe versions
- [x] Menu-item-to-recipe relationships
- [x] Reconciliation workflow and review queues
- [x] Identity-decision resolution and component-recipe linking controls
- [x] Data-repair tooling including ingredient duplicate/merge support
- [x] Production list
- [x] Shopping list
- [x] Prep list
- [x] Cook / This Week view
- [x] Recipe search
- [x] Avery 6464 retail/grab-and-go label builder
- [x] Purchased-ingredient label name, ingredient declaration, allergen data, dietary flags, and review status
- [x] Recursive approved-recipe/component ingredient resolution for labels
- [x] Variable/selected side support for labels
- [x] Six-label letter-size printing without trailing blank pages

## Priority 1 — complete ingredient declarations for labels

Environmental Health clarified that compound purchased foods must include their sub-ingredients in the ingredient declaration. The database and label resolver already support an ingredient statement; the immediate work is to make the workflow complete and reliable.

- [ ] Review the live ingredient schema before making any database changes; preserve existing labeling columns and production data
- [ ] Make label/ingredient-declaration editing easy to reach from the normal Ingredients workflow instead of primarily living under Allergens
- [ ] Decide whether Ingredients and Allergens should share one editor/component so name, measurement kind, ingredient declaration, allergens, dietary flags, and review state stay together
- [ ] Review every purchased compound ingredient used in current recipes and enter the full supplier/manufacturer ingredient declaration including sub-ingredients
- [ ] Keep simple single-ingredient foods simple; do not create fake sub-ingredients where none exist
- [ ] Keep prepared recipes/components recursive; do not copy their ingredient text into parent recipes
- [ ] Add a quick filter/report for ingredients that are used by approved recipes but still have unreviewed/incomplete label data
- [ ] Confirm label output preserves useful component grouping/parentheses while still containing the complete underlying ingredient information
- [ ] Re-test allergen aggregation and required source details for fish, crustacean shellfish, and tree nuts as ingredient declarations are completed
- [ ] Validate several corrected labels against Environmental Health before treating the ingredient-label cleanup as finished

## Priority 2 — build reusable estimated nutrition

Do not add isolated calorie text to menu descriptions. Nutrition should be reusable structured Cookbook data that can flow to recipes, menus, bulk food, labels, and other applications.

### Nutrition data model

- [ ] Inspect the live Supabase schema for any existing nutrition-related fields/tables before adding anything
- [ ] Define the canonical ingredient nutrition basis, preferably a normalized mass/volume/count basis that can be converted into recipe quantities
- [ ] Store source/provenance for nutrition data (supplier label, USDA/reference data, manual estimate, etc.)
- [ ] Support calories, protein, carbohydrate, fat, fiber, and sodium as the first useful nutrient set
- [ ] Support confidence/review status and manual overrides so estimates are distinguishable from verified supplier data
- [ ] Decide how edible yield, trim loss, cooking loss, and drained/cooked weights should be represented without making routine recipe entry painful

### Quantity and yield math

- [ ] Build/centralize unit conversion needed for nutrition calculations rather than embedding conversions in individual screens
- [ ] Use approved recipe quantities and approved yields as the basis for derived nutrition
- [ ] Calculate whole-recipe nutrition and per-serving/per-portion estimates when the approved yield supports it
- [ ] Define behavior for recipes with countable, liquid, or non-serving yields
- [ ] Propagate nutrition recursively through prepared components using the same general dependency model used for ingredient labels
- [ ] Detect cycles/incomplete dependencies and show incomplete nutrition rather than inventing numbers

### Nutrition output

- [ ] Add estimated nutrition to the Book recipe detail/cook view in a compact form
- [ ] Add a reusable customer-facing nutrition payload/API so Order/Admin can display the same numbers without recalculating them separately
- [ ] Add optional estimated nutrition to weekly-menu/bulk-food customer views where operationally useful
- [ ] Keep customer-facing wording explicitly labeled as estimated unless a stronger verification standard has been met
- [ ] Decide later whether full nutrition belongs on the physical Avery labels; do not sacrifice required ingredient/allergen readability merely to fit more data

## Priority 3 — finish recipe/data reconciliation

- [ ] Continue recipe cleanup and approval until legacy/imported cookbook data is fully reconciled
- [ ] Resolve remaining duplicate, incomplete, or ambiguous culinary records through Reconciliation/Data Repair
- [ ] Keep menu-item-to-recipe relationships complete as menus change
- [ ] Continue validating recipe yields, component relationships, and production scaling against real kitchen use
- [ ] Finish identity decisions that still block draft finalization
- [ ] Continue linking ingredient/component identities so new derived systems do not depend on free-text names

## Architecture cleanup to do alongside feature work

- [ ] Inventory remaining screens/APIs that use legacy direct `recipe_items` / `recipe_steps` versus cookbook-v2 `recipe_versions` / `recipe_version_items`
- [ ] Document which recipe model is authoritative for editing, approval, production derivation, labeling, and future nutrition
- [ ] Avoid extending legacy paths with new nutrition/label logic unless there is a deliberate migration reason
- [ ] Consolidate duplicated recipe/ingredient types and data-access helpers where it reduces ambiguity without destabilizing production
- [ ] Add focused automated tests for recursive ingredient-label expansion, dependency cycles, unit conversion, recipe scaling, and future nutrition math
- [ ] Add a test script/tool only when there are meaningful tests to run; do not add empty testing infrastructure for appearance

## Continue improving production use

- [ ] Continue improving shopping/prep/production output where actual production exposes friction
- [ ] Confirm all general-purpose print views remain compact and do not leak application navigation or controls
- [ ] Improve mobile workflows when actual phone use exposes a problem
- [ ] Keep label printing physically aligned on Avery 6464 stock after content grows

## Later, when useful

- [ ] Recipe version-history UI beyond the current approved/draft workflow
- [ ] Ingredient and recipe costing
- [ ] Purchase units and package sizes
- [ ] Vendor purchasing information
- [ ] Inventory
- [ ] Production completion tracking
- [ ] Additional user roles/read-only cook access if multiple users make it necessary
- [ ] Sign Out UI if shared devices or multiple users make it necessary

## Rule

Do not build a feature because an old roadmap says it should exist. Build it when it solves a current kitchen, regulatory, or customer-information problem.
