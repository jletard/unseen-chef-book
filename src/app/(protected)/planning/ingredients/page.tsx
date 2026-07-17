// src/app/(protected)/planning/ingredients/page.tsx
//
// Planning > Ingredients
//
// Master list of every ingredient used throughout the Cookbook.
//
// Ingredients are the raw products purchased from suppliers. They are used
// by Main Dishes, Components, and Sides to build recipes.
//
// Ingredient records provide a single source of truth for names, units,
// purchasing information, and other planning data.

export default function IngredientsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Ingredients</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Build and manage the master ingredient catalog used throughout the
        Cookbook. Maintain ingredient names, units, purchasing information,
        and other data shared by every recipe.
      </p>
    </>
  );
}