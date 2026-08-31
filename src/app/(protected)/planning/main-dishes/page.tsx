import RecipeCatalog from "@/components/planning/RecipeCatalog";
import { getRecipes } from "@/lib/recipe-data";

export default async function MainDishesPage() {
  const recipes = (await getRecipes()).filter(
    (recipe) => recipe.recipeType === "main",
  );

  return (
    <>
      <h1 className="text-2xl font-bold">Main Dishes</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Top-level production recipes for proteins and finished entrées.
      </p>
      <RecipeCatalog
        recipes={recipes}
        recipeType="main"
        emptyMessage="No main recipes have been created yet."
      />
    </>
  );
}
