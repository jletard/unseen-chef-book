import RecipeCatalog from "@/components/planning/RecipeCatalog";
import { getRecipes } from "@/lib/recipe-data";

export default async function ComponentsPage() {
  const recipes = (await getRecipes()).filter(
    (recipe) => recipe.recipeType === "component",
  );

  return (
    <>
      <h1 className="text-2xl font-bold">Components</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Reusable preparations such as marinades, sauces, dressings, stocks,
        doughs, and spice blends. Draft components remain visible until their
        recipes are completed.
      </p>
      <RecipeCatalog
        recipes={recipes}
        recipeType="component"
        emptyMessage="No components have been created yet."
      />
    </>
  );
}
