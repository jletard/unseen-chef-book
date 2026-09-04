# DESIGN

## Project

**Name:** Unseen Chef Cookbook  
**Repository:** `unseen-chef-book`  
**URL:** `book.theunseenchef.com`

The Cookbook is a separate Next.js application sharing the existing Supabase project used by the other Unseen Chef applications.

Its job is to manage culinary knowledge and turn production data into useful kitchen work.

## Application boundary

The Cookbook owns or presents:

- Recipes and recipe editing
- Purchased ingredients
- Prepared component recipes
- Recipe ingredients/components and steps
- Main dishes and sides
- Menu-item-to-recipe relationships
- Allergen/reference data used by kitchen workflows
- Production totals
- Shopping lists
- Prep lists
- Cook views and recipe search
- Reconciliation and data-repair workflows
- Retail/grab-and-go labels

It is not responsible for customer management, contact information, delivery addresses, payments, accounting, order administration, or marketing content.

The Cookbook may read shared order/menu data required to determine what food must be produced.

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

Recipes support yields, ingredients/components, steps, notes, equipment, and editing. Shared culinary information should be stored once and reused wherever possible.

Reconciliation is an explicit part of the application. Imported or legacy records can be reviewed as unreviewed, needs classification, minor, major, or ready. Unresolved data should remain visible rather than being silently guessed away.

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

## Interface

The Cookbook is dark mode only. There is no light mode. If someone does not like dark mode, they are not invited.

The interface should favor speed, clarity, information density, predictable navigation, and minimal unnecessary interaction. Mobile use is supported, while desktop remains preferable for substantial recipe editing.

## Printing

Printing is production functionality. Navigation and controls should disappear from printed output; layouts should be compact, readable, black-and-white friendly, and reliable on ordinary printers.

Avery 6464 labels use a six-label letter-size layout. Label printing must preserve physical label alignment and must not create blank trailing pages.

## Design rule

The Cookbook thinks in food, not customers.

Every feature should answer a real kitchen question: what needs to be made, how much, what is required, what can be prepared ahead, what recipe should be followed, or what information must accompany the food.
