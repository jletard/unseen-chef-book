// src/app/(protected)/planning/categories/page.tsx
//
// Planning > Categories
//
// Master list of cuisine and style categories used throughout the Cookbook.
//
// Categories organize Main Dishes and Menu Items, making it easier to browse,
// search, filter, and plan menus. Categories can be created, renamed,
// merged, archived, and reordered as the Cookbook evolves.

export default function CategoriesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Categories</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Manage the master list of cuisine and style categories used
        throughout the Cookbook. Categories help organize recipes and menu
        items and can be updated as your menu continues to evolve.
      </p>
    </>
  );
}