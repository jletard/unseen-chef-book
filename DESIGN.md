# DESIGN

## Project

**Name:** Unseen Chef Cookbook  
**Repository:** `unseen-chef-book`  
**Planned URL:** `book.theunseenchef.com`

The Cookbook is a separate Next.js application that shares the existing Supabase project used by the other Unseen Chef applications.

It manages the culinary information required to turn production totals into shopping lists, scaled recipes, prep sheets, and production documents.

---

## Scope

The Cookbook is responsible for:

- Recipes
- Ingredients
- Recipe scaling
- Component recipes
- Menu item to recipe relationships
- Production totals by food item
- Shopping lists
- Prep sheets
- Production documents

The Cookbook is not responsible for:

- Customer names
- Customer contact information
- Delivery addresses
- Payments
- Accounting
- Order administration
- Marketing content

The application may read production totals from shared order data, but it should expose only food items and quantities.

---

## Core Design Principle

The Cookbook is a kitchen production tool.

It should help answer:

- What food needs to be made?
- How much needs to be made?
- What ingredients are required?
- What can be prepared ahead?
- What recipe should the cook follow?

The interface should be compact, clear, and practical.
The Cookbook thinks in food, not customers.

---

## Technology

Initial stack:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- Supabase
- ESLint
- npm

The application will use the same Supabase project as the public ordering and admin applications.

Shared tables should be reused rather than duplicated.

---

## Application Boundary

The other applications remain responsible for their existing work.

```text
www.theunseenchef.com
Marketing and public information

order.theunseenchef.com
Customer ordering

admin.theunseenchef.com
Orders, customers, reports, menu management, accounting

book.theunseenchef.com
Recipes, ingredients, shopping, prep, production
```

---

## Appearance

The Cookbook uses dark mode only.

There is no light mode.

If someone does not like dark mode, they are not invited.
