// src/app/planning/menu-items/page.tsx
//
// Planning > Menu Items
//
// Master list of every menu item available to The Unseen Chef.
//
// This page is used to create, edit, organize, and archive menu items.
// Menu items define the customer-facing dish, its description, default
// sides, category, protein type, pricing, and other planning information.
//
// Recipes, ingredients, and production details are managed elsewhere.

export default function MenuItemsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Menu Items</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Master list of every menu item. Create new dishes, edit existing
        items, organize categories, assign default sides, and manage the
        menu catalog used throughout the Cookbook.
      </p>
    </>
  );
}