# Unseen Chef Cookbook

The Unseen Chef Cookbook is the kitchen production and recipe-management system for The Unseen Chef.

It turns shared menu/order data and the cookbook database into practical kitchen work: recipes, production totals, shopping, prep, cooking references, and retail/grab-and-go labels.

It is not the public website, ordering application, accounting system, or customer-management system.

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

The cookbook now has working recipe, ingredient, component, menu-item relationship, and recipe-step infrastructure rather than placeholder-only screens.

Recipe data distinguishes purchased ingredients from prepared recipes/components. Recipes support yields, ingredient/component lines, instructions, notes, equipment, and editing. The current cookbook-v2 domain recognizes main, side, component, sauce, dressing, dessert, bread, and other recipe categories.

The reconciliation workflow supports review buckets for unreviewed, needs-classification, minor, major, and ready records, with draft states for editing, ready-for-review, blocked, failed, and archived work. It exists to turn imported/legacy culinary information into clean cookbook records without silently losing unresolved data.

Planning also includes reference catalogs for allergens, categories, protein types, main dishes, sides, and menu-item relationships, plus data-repair tooling for duplicate or inconsistent records.

## Production

Production reads food-production information without making the Cookbook responsible for customers, payments, or accounting.

Current production tooling includes:

- Production lists
- Shopping lists
- Prep lists
- Production-week selection
- Recipe access for cooking
- Avery 6464 retail/grab-and-go label generation

Labels can be built from approved recipe/menu data, include ingredient and allergen information, allow side selections where required, and print six labels to a letter-size Avery 6464 sheet. Print CSS is treated as production functionality, not decoration.

## Relationship to other Unseen Chef applications

- `www.theunseenchef.com` — marketing and public information
- `order.theunseenchef.com` — customer ordering and checkout
- `admin.theunseenchef.com` — orders, customers, reports, accounting, menu management, and business administration
- `book.theunseenchef.com` — recipes, culinary reference data, production, shopping, prep, cooking, reconciliation, data repair, and labels

The applications share Supabase data where appropriate, but each application has a distinct responsibility.

## Operating philosophy

The Cookbook is a production tool. Recipes are foundational data; the product is faster, easier, more accurate, and more consistent kitchen production.

Design priorities are information density, predictable navigation, minimal clicks, minimal unnecessary whitespace, useful mobile access, and reliable printing. Decorative complexity is a negative unless it makes kitchen work easier.

Store information once and reuse it. Purchased products are ingredients; preparations with their own recipe are components. The database should preserve The Unseen Chef's institutional culinary knowledge instead of requiring the cook to repeatedly re-enter it.

## Printing

Printing is a first-class feature. Kitchen documents should maximize useful information per page, remove application chrome, avoid decorative graphics, print cleanly in black and white, and behave reliably on ordinary office printers.

## Development philosophy

Build the smallest solution that completely solves the actual production problem. Prefer maintainable code and existing shared data over duplicated systems. Do not add infrastructure merely because it might someday be useful.

When documentation and the running application disagree, the running application and current database behavior are the facts that documentation must be brought back into alignment with.
