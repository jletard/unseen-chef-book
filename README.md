# Unseen Chef Cookbook

The Unseen Chef Cookbook is the production and recipe management system for The Unseen Chef.

This application exists to help transform customer orders into food.

It is not a public recipe website.

It is not a restaurant ERP.

It is not an accounting application.

It is the operational cookbook used to plan, prepare, and execute weekly production.

The Cookbook is designed around how a working kitchen actually operates.

---

# Purpose

The Cookbook answers questions such as:

- What do we need to buy?
- What do we need to prep?
- What do we need to cook?
- How much of every ingredient is required?
- What recipes are used this week?
- What can be completed ahead of time?

Everything in the application should make production easier.

---

# Philosophy

The Cookbook is a production system.

Recipes are the foundation, but recipes are not the product.

The product is making weekly production faster, easier, more accurate, and more consistent.

The application should reduce mistakes, reduce repetitive work, and preserve institutional knowledge.

If a feature does not improve Friday planning, Sunday preparation, or Monday production, it probably does not belong in Version 1.

---

# Weekly Workflow

## Friday

Planning day.

After orders close:

- Review production totals.
- Generate shopping lists.
- Scale recipes.
- Purchase ingredients.
- Plan production.

---

## Sunday

Preparation day.

Complete work that can be performed ahead of production.

Examples include:

- Marinades
- Sauces
- Stocks
- Dressings
- Desserts
- Vegetable preparation

---

## Monday

Production day.

Cook, assemble, package, and complete customer orders.

The Cookbook should provide every recipe, quantity, and prep document required to complete production.

---

# Relationship to Other Applications

The Unseen Chef consists of several independent applications that share a common Supabase database.

## Marketing

www.theunseenchef.com

Responsible for:

- Marketing
- Information
- Gallery
- Reviews
- Company information

---

## Ordering

order.theunseenchef.com

Responsible for:

- Customer ordering
- Menu browsing
- Checkout
- Order submission

---

## Administration

admin.theunseenchef.com

Responsible for:

- Orders
- Customers
- Reports
- Accounting
- Menu management
- Business administration

---

## Cookbook

book.theunseenchef.com

Responsible for:

- Recipes
- Ingredients
- Shopping lists
- Production
- Prep sheets
- Kitchen documentation

Each application has a clearly defined responsibility.

The Cookbook does not manage customers, payments, accounting, or marketing.

---

# Design Philosophy

The Cookbook is a production tool.

The interface should favor speed, clarity, and information density over visual decoration.

Design principles include:

- Information first.
- Minimize clicks.
- Minimize scrolling.
- Minimize unnecessary whitespace.
- Avoid unnecessary animations.
- Avoid decorative graphics.
- Prefer text over ambiguous icons.
- Keep navigation predictable.
- Keep workflows simple.
- Optimize for kitchen use.

Every screen should answer the question:

"What is the cook trying to accomplish right now?"

---

# Printing

Printing is a first-class feature.

Kitchen documents are working documents.

Recipes, shopping lists, prep sheets, and production reports should print in a compact, highly readable format.

Printed documents should:

- Maximize useful information per page.
- Eliminate unnecessary whitespace.
- Remove navigation and interface controls.
- Never include decorative graphics or emojis.
- Use clean typography.
- Avoid awkward page breaks whenever practical.
- Print well in black and white.
- Print reliably on inexpensive office printers.

The goal is not beautiful printouts.

The goal is useful printouts.

Every printed page should look comfortable on a clipboard in a professional kitchen.

---

# Mobile

The Cookbook should work naturally on a phone.

A cook should be able to:

- Read recipes.
- View shopping lists.
- View prep sheets.
- Search ingredients.
- Edit recipes.
- Update notes.

Mobile editing must be fully supported.

Desktop remains the preferred environment for creating and heavily editing recipes because larger screens and keyboards provide a better editing experience.

---

# Data Philosophy

Store information once.

Reuse it everywhere.

Examples include:

- One ingredient can appear in many recipes.
- One recipe can appear on many menus.
- One component recipe can be reused by many finished recipes.

Avoid duplicate information whenever practical.

The database should become the institutional culinary knowledge of The Unseen Chef.

---

# Future Vision

The Cookbook should eventually become the single source of truth for kitchen operations.

Possible future capabilities include:

- Component recipes
- Recipe version history
- Shopping list generation
- Prep sheet generation
- Production planning
- Ingredient costing
- Inventory
- Nutrition
- Allergen information
- Vendor purchasing
- Yield tracking
- Recipe notes
- Kitchen documentation

These features should only be added when they provide measurable value to production.

---

# Development Philosophy

Build the smallest solution that completely solves today's problem.

Avoid unnecessary complexity.

Prefer clean architecture over clever code.

Favor maintainability over shortcuts.

When making design decisions, optimize for the person standing in the kitchen at 6:30 AM on Monday with flour on their hands.

If that person can accomplish their task faster, the feature is successful.
