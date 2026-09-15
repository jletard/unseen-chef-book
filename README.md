# Unseen Chef Cookbook

The Unseen Chef Cookbook is the kitchen production and recipe-management system for The Unseen Chef.

It turns shared menu/order data and the cookbook database into practical kitchen work: recipes, production totals, shopping, prep, cooking references, and retail/grab-and-go labels.

It is not the public website, ordering application, accounting system, or customer-management system.

For the short current-state handoff, read `STATUS.md`. Active work is tracked in `TODO.md`, and durable architecture/design rules are in `DESIGN.md`.

## Current application

The application is a Next.js/React/TypeScript App Router application using Tailwind CSS and the same Supabase project as the other Unseen Chef applications. Authentication is implemented and the application is dark-mode only.

Current navigation is:

### Planning
- Menu Items
- Main Dishes
- Components
- Sides
- Ingredients
- Allergens
- Categories
- Protein Types
- Reconciliation
- Data Repair

### Production
- Production List
- Shopping List
- Prep List
- Labels

### Cook
- This Week
- Recipe Search

The selected production week is shared across the protected application.

## Recipes and culinary data

The cookbook has working recipe, ingredient, component, menu-item relationship, recipe-step, reconciliation, and approved-version infrastructure rather than placeholder-only screens.

Recipe data distinguishes purchased ingredients from prepared recipes/components. Recipes support yields, ingredient/component lines, instructions, notes, equipment, editing, draft review, and approved versions. The current cookbook-v2 domain recognizes main, side, component, sauce, dressing, dessert, bread, and other recipe categories.

The reconciliation workflow supports review buckets for unreviewed, needs-classification, minor, major, and ready records, with draft states for editing, ready-for-review, blocked, failed, and archived work. Identity decisions, component-recipe linking, and data-repair tools exist to turn imported/legacy culinary information into clean cookbook records without silently losing unresolved data.

Planning also includes reference catalogs for allergens, categories, protein types, main dishes, sides, and menu-item relationships.

### Recipe-model note

The repository still contains older direct `recipe_items` / `recipe_steps` helpers alongside the newer approved/versioned cookbook-v2 path based on `recipe_versions` and `recipe_version_items`. New derived systems should not assume those paths are interchangeable. Label generation already uses the approved/versioned structure. See `STATUS.md` before extending recipe-derived features.

## Ingredients, allergens, and label declarations

Purchased ingredients have more than a kitchen display name. The live application already supports label-oriented metadata including label name, ingredient declaration, allergen keys/details, dietary flags, and review status.

The Allergens workflow currently provides the main editing/review interface for that label metadata. Compound purchased products can store the supplier/manufacturer ingredient declaration so labels can include sub-ingredients rather than stopping at a commercial product name.

Prepared components are not supposed to be copied into flat text. The label resolver recursively follows approved recipe/component dependencies, aggregates ingredient declarations and allergens, detects recipe-dependency cycles, and flags incomplete purchased-ingredient review.

Environmental Health's September 2026 label review made complete purchased-product sub-ingredient declarations an immediate operational priority. The next development pass should make this metadata easier to manage directly from the Ingredients workflow and complete the remaining ingredient review.

## Nutrition direction

Nutrition is a current development goal but is not yet a first-class implemented data system.

The intended approach is reusable **estimated nutrition** based on ingredient nutrition data, recipe quantities, normalized units, and approved recipe yields. Initial useful outputs are calories, protein, carbohydrate, fat, fiber, and sodium for the recipe and per serving/portion when the yield supports that calculation.

Nutrition should preserve source/provenance and allow manual correction because purchased products, trimming, cooking losses, and real yields vary. Customer-facing values should be presented as estimates unless/until a stronger validation process exists.

Nutrition data should be stored once in the Cookbook and reused by Book views and other Unseen Chef applications rather than separately recalculated in multiple systems.

## Production

Production reads food-production information without making the Cookbook responsible for customers, payments, or accounting.

Current production tooling includes:

- Production lists
- Shopping lists
- Prep lists
- Production-week selection
- Recipe access for cooking
- Avery 6464 retail/grab-and-go label generation

Labels can be built from approved recipe/menu data, include ingredient and allergen information, allow side selections where required, and print six labels to a letter-size Avery 6464 sheet. Printing is blocked when included purchased ingredients have incomplete review data. Print CSS is treated as production functionality, not decoration.

## Relationship to other Unseen Chef applications

- `www.theunseenchef.com` — marketing and public information
- `order.theunseenchef.com` — customer ordering and checkout
- `admin.theunseenchef.com` — orders, customers, reports, accounting, menu management, and business administration
- `book.theunseenchef.com` — recipes, culinary reference data, production, shopping, prep, cooking, reconciliation, data repair, ingredients/allergens, and labels

The applications share Supabase data where appropriate, but each application has a distinct responsibility.

## Operating philosophy

The Cookbook is a production tool. Recipes are foundational data; the product is faster, easier, more accurate, and more consistent kitchen production.

Design priorities are information density, predictable navigation, minimal clicks, minimal unnecessary whitespace, useful mobile access, and reliable printing. Decorative complexity is a negative unless it makes kitchen work easier.

Store information once and reuse it. Purchased products are ingredients; preparations with their own recipe are components. The database should preserve The Unseen Chef's institutional culinary knowledge instead of requiring the cook to repeatedly re-enter it.

For regulatory/customer-facing data, the same rule applies: purchased-product ingredient declarations and nutrition facts belong with the ingredient; prepared-component information should derive from the component recipe; finished-food output should be generated from those reusable sources.

## Printing

Printing is a first-class feature. Kitchen documents should maximize useful information per page, remove application chrome, avoid decorative graphics, print cleanly in black and white, and behave reliably on ordinary office printers.

## Database source of truth

The Cookbook uses the existing production Supabase project. Historical one-time migration files were intentionally removed after application. The live Supabase schema and current application behavior are authoritative; do not invent old migrations because they are absent from Git. See `supabase/README.md`.

## Development philosophy

Build the smallest solution that completely solves the actual production problem. Prefer maintainable code and existing shared data over duplicated systems. Do not add infrastructure merely because it might someday be useful.

When documentation and the running application disagree, the running application and current database behavior are the facts that documentation must be brought back into alignment with.
