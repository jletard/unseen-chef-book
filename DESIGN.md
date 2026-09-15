# DESIGN

## Project

**Name:** Unseen Chef Cookbook  
**Repository:** `unseen-chef-book`  
**URL:** `book.theunseenchef.com`

The Cookbook is a separate Next.js application sharing the existing Supabase project used by the other Unseen Chef applications.

Its job is to manage culinary knowledge and turn production data into useful kitchen work.

Read `STATUS.md` for the current implementation handoff and `TODO.md` for active priorities.

## Application boundary

The Cookbook owns or presents:

- Recipes and recipe editing
- Purchased ingredients
- Prepared component recipes
- Recipe ingredients/components and steps
- Main dishes and sides
- Menu-item-to-recipe relationships
- Allergen/reference data used by kitchen workflows
- Purchased-product ingredient declarations used for labeling
- Derived recipe ingredient/allergen output
- Production totals
- Shopping lists
- Prep lists
- Cook views and recipe search
- Reconciliation and data-repair workflows
- Retail/grab-and-go labels
- Future reusable nutrition data and recipe nutrition estimates

It is not responsible for customer management, contact information, delivery addresses, payments, accounting, order administration, or marketing content.

The Cookbook may read shared order/menu data required to determine what food must be produced and may expose reusable culinary/label/nutrition data to the other Unseen Chef applications.

## Current navigation

```text
Planning
  Menu Items
  Main Dishes
  Components
  Sides
  Ingredients
  Allergens
  Categories
  Protein Types
  Reconciliation
  Data Repair

Production
  Production List
  Shopping List
  Prep List
  Labels

Cook
  This Week
  Recipe Search
```

## Culinary data model

A purchased product is an ingredient. A preparation with its own recipe is a recipe/component and should be referenced rather than copied into another recipe.

Current recipe categories are:

- main
- side
- component
- sauce
- dressing
- dessert
- bread
- other

Recipes support yields, ingredients/components, steps, notes, equipment, draft review, approval, and editing. Shared culinary information should be stored once and reused wherever possible.

The newer cookbook-v2 path is version-aware and works with approved recipe versions and recipe-version dependencies. Older direct recipe item/step helpers still exist in the repository. New systems that derive information from recipes should prefer the approved/versioned path unless a specific existing workflow requires otherwise.

Reconciliation is an explicit part of the application. Imported or legacy records can be reviewed as unreviewed, needs classification, minor, major, or ready. Unresolved data should remain visible rather than being silently guessed away.

## Ingredient and label-data design

Purchased ingredients have two related but distinct jobs:

1. Kitchen identity and measurement behavior.
2. Customer/regulatory metadata such as label name, full ingredient declaration, allergens, dietary flags, and review status.

Those are properties of the same ingredient and should feel like one workflow even if the UI presents different review modes.

### Compound purchased foods

If a purchased commercial food contains multiple ingredients, store the supplier/manufacturer ingredient declaration with the purchased ingredient, including required sub-ingredients. Do not replace that declaration with a simplified kitchen nickname.

### Prepared components

If The Unseen Chef prepares something from a recipe, that preparation remains a recipe/component. Do not copy the component's ingredient declaration into every parent recipe. Customer-facing ingredient output should recursively resolve the approved component recipe.

### Generated label output

Derived label information should:

- Follow approved recipe/component dependencies.
- Preserve useful grouping when a named prepared component is shown.
- Aggregate allergens from all dependencies.
- Detect cycles and missing/unreviewed ingredient data.
- Refuse to imply completeness when required source data is missing.

The September 2026 Environmental Health review makes complete purchased-product sub-ingredient declarations a current production requirement, not a speculative future feature.

## Nutrition design direction

Nutrition should be stored and calculated as reusable structured culinary data, not typed independently into menu descriptions.

The canonical direction is:

- Nutrition facts live at the purchased-ingredient level when they come from a supplier/reference source.
- Recipe nutrition derives from ingredient nutrition, normalized recipe quantities, and approved recipe yields.
- Prepared components propagate nutrition recursively into parent recipes.
- Customer-facing numbers are clearly identified as estimates unless a stronger verification standard exists.
- Source/provenance and review confidence are preserved.
- Manual correction is allowed because real yields, trimming, cooking loss, and purchased-product formulations vary.

The initial useful nutrient set is calories, protein, carbohydrate, fat, fiber, and sodium. Do not expand to a full regulatory Nutrition Facts implementation until there is an actual operational requirement.

Do not place nutrition logic separately in Book, Admin, and Order. Book should be the culinary source; other applications should consume its reusable result/data.

## Technology

Current stack:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- Supabase
- ESLint
- npm

The application uses the same Supabase project as the ordering and admin applications. Shared tables and existing database behavior are reused rather than recreated locally.

The live Supabase schema is authoritative. Historical one-time database migrations are intentionally not a reconstruction mechanism for this repository. Inspect the production schema before adding or changing schema-dependent features.

## Interface

The Cookbook is dark mode only. There is no light mode. If someone does not like dark mode, they are not invited.

The interface should favor speed, clarity, information density, predictable navigation, and minimal unnecessary interaction. Mobile use is supported, while desktop remains preferable for substantial recipe editing.

Regulatory/customer metadata should not make the everyday cooking view noisy. Store the data richly, but present the cook with the information needed for the task at hand.

## Printing

Printing is production functionality. Navigation and controls should disappear from printed output; layouts should be compact, readable, black-and-white friendly, and reliable on ordinary printers.

Avery 6464 labels use a six-label letter-size layout. Label printing must preserve physical label alignment and must not create blank trailing pages. Required ingredient/allergen readability has priority over optional extra information such as nutrition.

## Design rules

The Cookbook thinks in food, not customers.

Store facts once, derive output many times.

Do not silently invent missing culinary, ingredient, allergen, or nutrition data. Incomplete is better than confidently wrong.

Every feature should answer a real kitchen question: what needs to be made, how much, what is required, what can be prepared ahead, what recipe should be followed, or what information must accompany the food.
